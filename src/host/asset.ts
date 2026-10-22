// 응답이 끝난 뒤 보조 모델로 이미지 태그를 보충한다 (원본 onOutput → imgTagFireCore).
// 에셋 모듈의 Image tag 로어북은 모듈에 있을 수 있어서 getCurrentLorebookEntries로 읽는다.
import { ASSET_NOTE, AssetError, finishAsset, planAsset, readImageData, withUser } from '../core/asset';
import { playerAgent } from '../core/player';
import { basicSettings } from '../core/settings';
import type { Chat, LoreEntry } from '../core/types';
import { runModel } from './llm';
import { updateChat } from './risu';
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
    let entries: LoreEntry[];
    try {
      entries = ((await risuai.getCurrentLorebookEntries()) ?? []) as LoreEntry[];
    } catch {
      entries = t.lore ?? [];
    }
    // 메인모델과 같은 구조: 「주인공 이미지」 ON이면 {{user}} 금지를 빼고, 캐릭터로 플레이하지 않으면 페르소나를 명단에. OFF면 주인공 요원을 명단에서 뺀다
    const agent = playerAgent(t.lore, t.chat.scriptstate);
    const base = readImageData(entries);
    const data = s.assetPlayer ? withUser(base, agent ? undefined : userInfo().name) : base;
    const exclude = agent && !s.assetPlayer ? [agent.english, data.aliases.get(agent.name.toLowerCase())].filter((v): v is string => typeof v === 'string' && !!v) : [];
    const job = planAsset(msg.data, data, s.assetLimit, exclude);
    if (!job) return;
    const raw = await runModel(job.messages, 'aux');
    const next = finishAsset(job, raw, data, s.assetLimit);
    if (!next) {
      await note('이번 응답에는 붙일 이미지가 없었어요.');
      return;
    }
    const saved = await updateChat(t.charIndex, t.chatIndex, (latest) => {
      const list = latest.message ?? [];
      const i = t.messageIndex;
      // 작업 중에 메시지가 바뀌었거나(수정·다시 생성) 새 메시지가 붙었으면 버린다
      if (i !== list.length - 1 || list[i]?.role !== 'char' || list[i].data !== job.original) return null;
      const message = list.slice();
      message[i] = { ...list[i], data: next };
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
