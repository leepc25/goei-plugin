// 요청 조립의 마지막 안전망 (QC 개선 나3, 2026-10-29. 정책: 요청은 막지 않고, 모델이 플러그인 표식을 보지 않게 한다).
// 플러그인이 채팅 본문에 남기는 표식(지시문·전화·시작 카드·안 보냄·시드)은 각 조립 단계가 정상이면 이미 지워져 있다.
// 한 단계가 던져 그 단계 이전 모양이 남았을 때를 위해 onBeforeRequest 맨 끝(과 시작기의 catch)에서 한 번 더 지운다.
// 표식 줄만 지우고 본문은 남긴다(시드는 수명과 상관없이 본문 유지 = 첫 전송과 같은 모양). 멱등이고, 어떤 입력에도 던지지 않는다.
// 지우지 않는 것(결정, docs/qc/09_개선_나_2_3.md): 상태창 줄 [▣|…](모델 자신의 출력이고 다음 턴 이어 쓰기에 필요),
// 이미지 태그 <img=…>(최근 것은 모델이 봐야 한다), 플러그인이 끼운 참고 블록의 머리글(모델이 읽어야 하는 글).
import type { PromptMessage } from './request';
import { cleanOutput, hasWorldTags } from './world/tags';
import { hasUnlockTag, stripUnlockTags } from './lore';

/** 플러그인 표식 목록 (원문에는 있고 모델에는 가면 안 되는 글). 시험·문서에서 전수 확인에 쓴다 */
export const PLUGIN_MARKERS = ['%%SCENE_CARD:', '%%/SCENE_CARD%%', '%%PHONE_CALL:', '%%/PHONE_CALL%%', '%%GOEI_START%%', '%%/GOEI_START%%', '%%GOEI_UNSENT%%', '%%SEED%%', '%%/SEED%%'] as const;

/** 여는 표식(뒤의 줄바꿈까지) · 닫는 표식(앞의 줄바꿈까지) · 안 보냄 표식(앞의 줄바꿈까지) */
const OPEN_RE = /%%(?:SCENE_CARD:[0-9a-f]*|PHONE_CALL:[0-9a-f]*|GOEI_START|SEED)%%[ \t]*(?:\r?\n)?/g;
const CLOSE_RE = /(?:\r?\n)?[ \t]*%%\/(?:SCENE_CARD|PHONE_CALL|GOEI_START|SEED)%%/g;
const UNSENT_RE = /(?:\r?\n)?[ \t]*%%GOEI_UNSENT%%/g;

export function hasPluginMarkers(text: unknown): text is string {
  return typeof text === 'string' && text.includes('%%') && PLUGIN_MARKERS.some((m) => text.includes(m));
}

/** 글 하나에서 표식만 지운다 (본문 유지). 표식이 없으면 같은 글 */
export function stripMarkerText(text: string): string {
  if (!hasPluginMarkers(text)) return text;
  return text.replace(OPEN_RE, '').replace(CLOSE_RE, '').replace(UNSENT_RE, '').replace(/\n{3,}/g, '\n\n');
}

export interface StripOptions {
  /** 괴이 카드일 때만: 지난 응답에 남은 상황판 태그([AN|…]·[IN|…]·[MS|…]·[AG|…]·[AC|…])와 해금 표시([🔓|…])도 지운다 (stripHistoryTags 와 같음) */
  worldTags?: boolean;
}

/**
 * 요청 메시지 전체에서 플러그인 표식을 지운다. 바뀐 것이 없으면 같은 배열을 돌려준다.
 * 메시지 하나가 이상해도(글이 아닌 content·null) 그 메시지만 그대로 두고 나머지는 처리한다. 절대 던지지 않는다
 */
export function stripMarkers<M extends PromptMessage>(messages: M[], opts: StripOptions = {}): M[] {
  try {
    if (!Array.isArray(messages)) return messages;
    let changed = false;
    const out = messages.map((m) => {
      try {
        const c = m?.content;
        if (typeof c !== 'string') return m;
        let next = stripMarkerText(c);
        if (opts.worldTags && m.role === 'assistant') {
          if (hasWorldTags(next)) next = cleanOutput(next);
          if (hasUnlockTag(next)) next = stripUnlockTags(next);
        }
        if (next === c) return m;
        changed = true;
        return { ...m, content: next };
      } catch {
        return m;
      }
    });
    return changed ? out : messages;
  } catch {
    return messages;
  }
}
