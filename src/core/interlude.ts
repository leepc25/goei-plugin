// 본부 막간을 본편 요청에 끼운다 (2026-10-22 설계 2판).
// 채팅에 메시지를 넣지 않는다: Risu 다시 굴리기는 마지막 봇 메시지부터 지우고 새로 만들어서, 막간 메시지가 날아가거나 덮어써진다.
// 대신 대화마다 그때 마지막 메시지(chatId)를 적어 두고, 본편 요청을 만들 때 그 메시지 바로 뒤에 넣는다.
// 그 메시지가 다시 굴리기·삭제로 사라졌으면 넣지 않는다.
import { messageText } from './refs';
import type { Chat } from './types';
import { visitRecord, type VisitTurn } from './visit';

export const INTERLUDE_HEAD = '[본부 막간]';
const DEFAULT_RULES = 'The block below is a face-to-face conversation the protagonist had at bureau HQ right after the preceding scene and before the next input. It really happened. Nothing else happened in between and only a few minutes passed.';
const ROOM: Record<string, string> = { office: '사무실', lounge: '휴게실', infirmary: '의무실', quarters: '숙소' };
/** 막간 하나에 넣을 최대 대화 수 (가장 최근 것부터) */
const MAX_TURNS = 30;

export interface Interlude { anchor: string; index: number; turns: VisitTurn[] }

/** 아직 있는 메시지 뒤에서 나눈 대화를 막간별로 (채팅 순서) */
export function interludes(chat: Chat): Interlude[] {
  const msgs = (chat.message ?? []) as { chatId?: string }[];
  const at = new Map<string, number>();
  msgs.forEach((m, i) => at.set(m.chatId ? String(m.chatId) : `#${i + 1}`, i));
  const groups = new Map<string, VisitTurn[]>();
  for (const t of visitRecord(chat).turns) {
    if (!t.anchor || !at.has(t.anchor)) continue;
    groups.set(t.anchor, [...(groups.get(t.anchor) ?? []), t]);
  }
  return [...groups].map(([anchor, turns]) => ({ anchor, index: at.get(anchor)!, turns: turns.slice(-MAX_TURNS) })).sort((a, b) => a.index - b.index);
}

/** 기준 메시지가 사라져 본편에 안 들어가는 대화 */
export function orphanTurns(chat: Chat): VisitTurn[] {
  const live = new Set(interludes(chat).flatMap((g) => g.turns.map((t) => t.id)));
  return visitRecord(chat).turns.filter((t) => t.anchor && !live.has(t.id));
}

const safe = (s: string) => s.replace(/\{\{/g, '｛｛').replace(/\}\}/g, '｝｝').replace(/%%/g, '％％');

export function interludeText(g: Interlude, rules: string | null, visitor: string): string {
  const parts: string[] = [];
  let who = '';
  for (const t of g.turns) {
    if (t.name !== who) {
      who = t.name;
      parts.push(`\n${safe(t.name)}${t.room ? ` (${ROOM[t.room] ?? t.room})` : ''}`);
    }
    parts.push(`${safe(t.visitor || visitor)}: ${safe(t.user)}`, `${safe(t.name)}: ${safe(t.reply)}`);
  }
  return [INTERLUDE_HEAD, rules?.trim() || DEFAULT_RULES, ...parts].join('\n').replace(/\n{3,}/g, '\n\n');
}

const norm = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** 요청 메시지 중 채팅 메시지 index에 해당하는 것 (끝 글자로 찾는다. 같은 글이 뒤에 또 있으면 그만큼 건너뛴다). 못 찾으면 -1 */
function findInRequest(messages: { role?: unknown; content?: unknown }[], msgs: { data?: string }[], index: number): number {
  const text = norm(messageText(String(msgs[index]?.data ?? '')));
  if (!text) return -1;
  const tail = text.slice(-40);
  let skip = msgs.slice(index + 1).filter((m) => norm(messageText(String(m.data ?? ''))).includes(tail)).length;
  for (let j = messages.length - 1; j >= 0; j--) {
    const m = messages[j];
    if (m?.role === 'system' || typeof m?.content !== 'string' || !norm(m.content).includes(tail)) continue;
    if (skip-- > 0) continue;
    return j;
  }
  return -1;
}

/** 본편 요청에 막간을 끼운다. 기준 메시지를 요청에서 못 찾으면: 새 입력 바로 앞이면 마지막 사용자 메시지 앞에, 아니면 넣지 않는다 */
export function withInterludes<M extends { role?: unknown; content?: unknown }>(messages: M[], chat: Chat, rules: string | null, visitor: string): M[] {
  const groups = interludes(chat);
  if (!groups.length || messages.some((m) => typeof m?.content === 'string' && m.content.startsWith(INTERLUDE_HEAD))) return messages;
  const msgs = (chat.message ?? []) as { role?: string; data?: string }[];
  let out = messages.slice();
  // 뒤에서부터 넣어야 앞 위치가 안 밀린다
  for (const g of [...groups].reverse()) {
    let at = findInRequest(out, msgs, g.index);
    if (at >= 0) at += 1;
    else if (g.index === msgs.length - 2 && msgs[msgs.length - 1]?.role === 'user') at = out.map((m) => m?.role).lastIndexOf('user');
    else if (g.index === msgs.length - 1) at = out.length;
    if (at < 0) continue;
    out = [...out.slice(0, at), { role: 'system', content: interludeText(g, rules, visitor) } as M, ...out.slice(at)];
  }
  return out;
}
