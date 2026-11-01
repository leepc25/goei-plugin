// 필드 장부 (docs/필드_기능_설계.md 8장): 필드에서 일어난 일을 사건으로 채팅에 쌓아 두고,
// 본편 요청이 나갈 때 정제해서 끼운다 (core/interlude.ts). 모델은 부르지 않는다. 사건은 게임 코드만 만든다.
import type { Chat } from './types';

export const FIELD_KEY = 'goeiFieldV1';
/** 장부에 남길 사건 수 (넘으면 오래된 것부터 버린다) */
export const MAX_EVENTS = 300;

export type FieldKind =
  | 'move' | 'act' | 'hurt' | 'down' | 'kill' | 'flee' | 'provoke' | 'gift' | 'trade' | 'quest'
  | 'follow' | 'unfollow' | 'enter_anomaly' | 'exit_anomaly' | 'enter_site' | 'detected' | 'appoint' | 'call'
  /** 필드 방문 시작·끝 (10-31 사용자: 방문 한 번 = 보고서 한 장, 출동은 그 안의 한 덩어리). 모델 글에는 안 넣는다 */
  | 'enter_field' | 'exit_field';

/** 지금 확정된 사실 하나. 같은 key는 가장 나중 것이 이긴다. permanent는 되돌릴 수 없는 일(사망 등) */
export interface FieldFact { key: string; value: string; permanent?: boolean }

export interface FieldEvent {
  id: string;
  /** 일어난 때 (ms) */
  at: number;
  /** 그때 본편 마지막 메시지 chatId (다시 굴리기·삭제에 안전한 기준) */
  anchor: string;
  kind: FieldKind;
  /** 모델에게 가는 한 줄 = 활동 결과 (영어 짧은 문장, 주인공 {user}). 게임이 만든다 */
  text: string;
  /** 사람이 읽는 한 줄 = 기록 메뉴 보고서 (한글, 주인공 {user}). 빈 글이면 보고서에 안 넣음. 빈 글 + fact = 확정 사실만 담은 줄 → [Field log]에도 안 넣고 [Field facts]에만. 없으면 text */
  ko?: string;
  /** 장면 이름 */
  scene?: string;
  who?: string[];
  /** 목격한 소속 (세력 평판용): 코드와 「명단 인물인지(named) / 이름 없는 몹인지」 */
  witness?: { faction: string; named: boolean };
  /** 방문 번호·id (게임이 준다). 같은 채팅 메시지 뒤에 여러 번 들락날락해도 방문마다 상한을 따로 세게 */
  visit?: string;
  /** 1 = 공간이 남으면, 3 = 반드시 */
  weight?: 1 | 2 | 3;
  fact?: FieldFact;
}
export interface FieldRecord { events: FieldEvent[] }

const KINDS = new Set<string>(['move', 'act', 'hurt', 'down', 'kill', 'flee', 'provoke', 'gift', 'trade', 'quest', 'follow', 'unfollow', 'enter_anomaly', 'exit_anomaly', 'enter_site', 'detected', 'appoint', 'call', 'enter_field', 'exit_field']);

/** 요청에 그대로 들어가는 글이라 템플릿 기호와 줄바꿈을 막는다 */
export const plain = (s: unknown, max = 300) =>
  String(s ?? '').replace(/\{\{/g, '｛｛').replace(/\}\}/g, '｝｝').replace(/%%/g, '％％').replace(/\s+/g, ' ').trim().slice(0, max);

export function fieldRecord(chat: Chat): FieldRecord {
  const v = chat[FIELD_KEY] as FieldRecord | undefined;
  const list = Array.isArray(v?.events) ? v!.events : [];
  return {
    events: list.filter((e) => e && typeof e.id === 'string' && typeof e.text === 'string' && typeof e.anchor === 'string' && typeof e.at === 'number' && KINDS.has(e.kind)).slice(-MAX_EVENTS),
  };
}

/** 사건 하나를 더한 채팅 (같은 id는 무시) */
export function withFieldEvent(chat: Chat, ev: FieldEvent): Chat {
  const old = fieldRecord(chat).events;
  if (old.some((e) => e.id === ev.id)) return chat;
  const clean: FieldEvent = {
    ...ev,
    text: plain(ev.text),
    ...(typeof ev.ko === 'string' ? { ko: plain(ev.ko) } : {}),
    scene: ev.scene ? plain(ev.scene, 60) : undefined,
    who: ev.who?.map((w) => plain(w, 40)).slice(0, 8),
    fact: ev.fact ? { key: plain(ev.fact.key, 40), value: plain(ev.fact.value, 120), ...(ev.fact.permanent ? { permanent: true } : {}) } : undefined,
    ...(ev.witness ? { witness: { faction: plain(ev.witness.faction, 12), named: !!ev.witness.named } } : {}),
    ...(ev.visit ? { visit: plain(ev.visit, 40) } : {}),
  };
  return { ...chat, [FIELD_KEY]: { events: [...old, clean].slice(-MAX_EVENTS) } };
}

/** 확정 사실: 같은 key는 나중 것이 이긴다. 순서는 처음 나온 순서 */
export function currentFacts(events: FieldEvent[]): FieldFact[] {
  const by = new Map<string, FieldFact>();
  for (const e of [...events].sort((a, b) => a.at - b.at)) if (e.fact?.key) by.set(e.fact.key, e.fact);
  return [...by.values()];
}
