// 응답이 끝난 뒤 보조 모델로 이미지 태그를 보충한다 (원본 onOutput → imgTagFireCore).
// 자료(캐릭터·별칭·표정)는 명부 + 설정(이미지 지침)으로 조립한다. 로어북 「Image tag」는 더 쓰지 않는다.
import { ASSET_NOTE, AssetError, finishAsset, imageDataFrom, planAsset, withUser } from '../core/asset';
import { playerAgent } from '../core/player';
import { imgCharacters, imgPromptConfig } from '../core/imgprompt';
import { basicSettings, getPrefs } from '../core/settings';
import type { Chat, LoreEntry } from '../core/types';
import { runModel, type LlmMessage } from './llm';
import { updateChat } from './risu';
import { findShopTag, stripShopTags } from '../core/shop';
import { userInfo } from './user';

export interface AssetTarget {
  charIndex: number;
  chatIndex: number;
  lore: LoreEntry[] | undefined;
  chat: Chat;
  messageIndex: number;
}

let running = false;

/** 보조모델 모드일 때만. 실패해도 본문은 그대로 두고, 이유를 설정 탭에 한 줄 남긴다 */
export async function supplementAssets(t: AssetTarget): Promise<void> {
  const s = basicSettings(t.lore, t.chat.scriptstate);
  if (!s.assetOn || s.assetModel !== 'aux' || running) return;
  const msg = t.chat.message?.[t.messageIndex];
  if (!msg || msg.role !== 'char' || typeof msg.data !== 'string' || !msg.data) return;
  // 마지막 응답에만 (원본과 같음)
  if (t.messageIndex !== (t.chat.message?.length ?? 0) - 1) return;
  running = true;
  const note = (text: string) =>
    updateChat(t.charIndex, t.chatIndex, (c) => (c.scriptstate?.[ASSET_NOTE] === text ? null : { ...c, scriptstate: { ...(c.scriptstate ?? {}), [ASSET_NOTE]: text } })).catch(() => null);
  try {
    // 메인모델과 같은 구조: 「주인공 이미지」 ON이면 {{user}} 금지를 빼고, 캐릭터로 플레이하지 않으면 페르소나를 명단에. OFF면 주인공 요원을 명단에서 뺀다
    const agent = playerAgent(t.lore, t.chat.scriptstate);
    // 명부 + 설정(이미지 지침)의 대상 목록·표정 세트로 자료를 조립한다 (메인 모델 지침과 같은 목록)
    const cfg = imgPromptConfig(getPrefs());
    const picked = imgCharacters(t.lore, cfg, { assetPlayer: s.assetPlayer, playerEnglish: agent?.english || undefined, userName: userInfo().name });
    // 출력 대상을 설정에서 전부 껐으면 보충하지 않는다. imageDataFrom 은 빈 목록을 「명부 전부」로 읽어서, 다 꺼도 보조 모델이 명부 전원에게
    // 태그를 붙였다(메인 모델 경로 body.ts withImgPrompt 는 지침을 안 넣음). 2026-10-28 QC (tests/browser.mjs 16절)
    if (!picked.length) throw new AssetError('이미지 자료 오류 (characters): 출력 대상이 없습니다. 명부에 요원이 있는지, 설정에서 전부 끄지 않았는지 확인하세요.');
    const tuned = imageDataFrom(t.lore, picked, cfg.keywords);
    const data = s.assetPlayer ? withUser(tuned, agent ? undefined : userInfo().name) : tuned;
    const exclude = agent && !s.assetPlayer ? [agent.english, data.aliases.get(agent.name.toLowerCase())].filter((v): v is string => typeof v === 'string' && !!v) : [];
    const job = planAsset(msg.data, data, s.assetLimit, exclude);
    if (!job) return;
    const raw = await runModel(job.messages, 'aux', undefined, '이미지 태그 보충');
    const next = finishAsset(job, raw, data, s.assetLimit);
    if (!next) {
      await note('이번 응답에는 붙일 이미지가 없었어요.');
      return;
    }
    const saved = await updateChat(t.charIndex, t.chatIndex, (latest) => {
      const list = latest.message ?? [];
      const i = t.messageIndex;
      // 작업 중에 메시지가 바뀌었거나(수정·다시 생성) 새 메시지가 붙었으면 버린다
      // 상점 표식은 갱신기(상점 판단)가 그새 붙이거나 바꿀 수 있다 (11-09): 표식을 뺀 글로 비교하고, 지금 붙어 있는 표식을 그대로 이어 붙인다
      if (i !== list.length - 1 || list[i]?.role !== 'char' || stripShopTags(String(list[i].data ?? '')) !== stripShopTags(job.original)) return null;
      const tag = findShopTag(String(list[i].data ?? ''));
      const message = list.slice();
      message[i] = { ...list[i], data: tag ? `${stripShopTags(next)}\n${tag.raw}` : stripShopTags(next) };
      return { ...latest, message, scriptstate: { ...(latest.scriptstate ?? {}), [ASSET_NOTE]: '' } };
    });
    if (!saved) console.log('[goei] 이미지 태그: 그새 응답이 바뀌어 저장하지 않았어요.');
  } catch (error) {
    const why = error instanceof AssetError ? error.message : `보조 모델 호출 실패: ${error instanceof Error ? error.message : String(error)}`;
    console.log(`[goei] 이미지 태그 보충 실패: ${why}`);
    await note(why.slice(0, 300));
  } finally {
    running = false;
  }
}

/** 호출 흐름 미리 계산: 마지막 응답에 대해 태그 보충이 보낼 요청 (보충할 게 없으면 null) */
export function previewAsset(lore: LoreEntry[] | undefined, chat: Chat): LlmMessage[] | null {
  const s = basicSettings(lore, chat.scriptstate);
  const list = chat.message ?? [];
  const msg = list[list.length - 1];
  if (!s.assetOn || s.assetModel !== 'aux' || !msg || msg.role !== 'char' || typeof msg.data !== 'string' || !msg.data) return null;
  try {
    const agent = playerAgent(lore, chat.scriptstate);
    const cfg = imgPromptConfig(getPrefs());
    const picked = imgCharacters(lore, cfg, { assetPlayer: s.assetPlayer, playerEnglish: agent?.english || undefined, userName: userInfo().name });
    if (!picked.length) return null;
    const tuned = imageDataFrom(lore, picked, cfg.keywords);
    const data = s.assetPlayer ? withUser(tuned, agent ? undefined : userInfo().name) : tuned;
    const exclude = agent && !s.assetPlayer ? [agent.english, data.aliases.get(agent.name.toLowerCase())].filter((v): v is string => typeof v === 'string' && !!v) : [];
    return planAsset(msg.data, data, s.assetLimit, exclude)?.messages ?? null;
  } catch {
    return null;
  }
}
