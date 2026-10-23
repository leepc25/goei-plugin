import type { CardAgent } from '../game/bridge';
import type { Chat, LoreEntry } from './types';

export const VISIT_KEY = 'goeiHqVisitV1';
export const VISIT_LORE = '본부 방문 대화 기록';
export interface VisitTurn {
  id: string; at: number; agentId: string; name: string; user: string; reply: string;
  /** 주인공 요원 이름 (캐릭터로 플레이일 때) */
  visitor?: string;
  /** 이 대화가 일어난 자리: 그때 마지막 본편 메시지 (막간 끼우기의 기준) */
  anchor?: string;
  /** 만난 방 (office·lounge·infirmary·quarters) */
  room?: string;
}
export interface VisitRecord { turns: VisitTurn[] }
export type VisitRoom = 'office' | 'lounge' | 'infirmary' | 'quarters';
export function visitRoom(a: CardAgent): VisitRoom | null {
  if (a.locked) return null;
  if (/외근|비번|격리|작전투입|실종|사망|미정/.test(a.state)) return null;
  if (/부상|치료/.test(a.state)) return 'infirmary';
  if (/수면|취침/.test(a.state)) return 'quarters';
  if (/휴게|휴식/.test(a.state)) return 'lounge';
  return !a.locked && /내근|대기/.test(a.state) ? 'office' : null;
}
/** 채팅의 지금 자리: 마지막 메시지의 chatId (없으면 메시지 수) */
export function anchorOf(chat: Chat): string {
  const msgs = Array.isArray(chat.message) ? chat.message as { chatId?: string }[] : [];
  const last = msgs[msgs.length - 1];
  return last?.chatId ? String(last.chatId) : `#${msgs.length}`;
}
export function visitRecord(chat: Chat): VisitRecord {
  const v = chat[VISIT_KEY] as VisitRecord | undefined;
  return { turns: Array.isArray(v?.turns) ? v.turns.filter(t => t && typeof t.id === 'string' && typeof t.reply === 'string' && typeof t.user === 'string' && typeof t.agentId === 'string').slice(-100) : [] };
}
/** 모델 응답을 명령으로 실행하지 않고 실제 오간 대화만 저장한다. 본편에는 요청 때 막간으로 끼운다(core/interlude.ts).
 * 0.16.42~43이 넣던 로어북 항목 「본부 방문 대화 기록」은 지운다 */
export function withVisitTurn(chat: Chat, turn: VisitTurn): Chat {
  const old = visitRecord(chat).turns;
  if (old.some(t => t.id === turn.id)) return chat;
  const turns = [...old, turn].slice(-100);
  return withoutOldLore({ ...chat, [VISIT_KEY]: { turns } });
}
export function withoutOldLore(chat: Chat): Chat {
  const local = Array.isArray(chat.localLore) ? chat.localLore as LoreEntry[] : [];
  return local.some(l => l.comment === VISIT_LORE) ? { ...chat, localLore: local.filter(l => l.comment !== VISIT_LORE) } : chat;
}
