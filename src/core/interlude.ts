// 본부 막간을 본편 요청에 끼운다 (2026-10-22 설계 2판).
// 채팅에 메시지를 넣지 않는다: Risu 다시 굴리기는 마지막 봇 메시지부터 지우고 새로 만들어서, 막간 메시지가 날아가거나 덮어써진다.
// 대신 대화마다 그때 마지막 메시지(chatId)를 적어 두고, 본편 요청을 만들 때 그 메시지 바로 뒤에 넣는다.
// 그 메시지가 다시 굴리기·삭제로 사라졌으면 넣지 않는다.
import { messageText } from './refs';
import type { Chat } from './types';
import { visitRecord, type VisitTurn } from './visit';
import { currentFacts, fieldRecord, type FieldEvent, type FieldFact, type FieldKind } from './field';

export const INTERLUDE_HEAD = '[필드 막간]';
const DEFAULT_RULES = 'The block below is a face-to-face conversation the protagonist had at bureau HQ right after the preceding scene and before the next input. It really happened. Nothing else happened in between and only a few minutes passed.';
const ROOM: Record<string, string> = { office: '사무실', lounge: '휴게실', infirmary: '의무실', quarters: '숙소' };
/** 막간 하나에 넣을 최대 대화 수 (가장 최근 것부터) */
const MAX_TURNS = 30;

export interface Interlude { anchor: string; index: number; turns: VisitTurn[]; events: FieldEvent[] }

const KIND_LABEL: Record<FieldKind, string> = {
  move: '이동', act: '행동', hurt: '부상', down: '쓰러짐', kill: '살해', flee: '도주', provoke: '도발', gift: '선물', trade: '거래', quest: '의뢰',
  follow: '동행', unfollow: '동행 해제', enter_anomaly: '괴이 진입', exit_anomaly: '괴이 퇴장', enter_site: '거점 진입', detected: '발각', appoint: '약속', call: '통화',
};
/** 막간 하나에 넣을 최대 사건 수 (가장 최근 것부터) */
const MAX_EVENTS = 60;
export const FACTS_HEAD = '[Field facts]';
const EVENT_NOTE = 'Besides conversations, the block lists other things that happened in the field (movement, actions, fights and so on) in the order they happened. All of it really happened, and time passes naturally as these events imply. If the protagonist ended up somewhere other than where the preceding scene was, continue from the final location in the [Field facts] block.';
const FACTS_NOTE = 'These are the current facts established in the field. Do not contradict them; permanent changes cannot be undone.';

/** 채팅 메시지 chatId → 순서 */
function anchorsOf(chat: Chat): Map<string, number> {
  const msgs = (chat.message ?? []) as { chatId?: string }[];
  const at = new Map<string, number>();
  msgs.forEach((m, i) => at.set(m.chatId ? String(m.chatId) : `#${i + 1}`, i));
  return at;
}

/** 아직 있는 메시지 뒤에서 나눈 대화와 필드 사건을 막간별로 (채팅 순서) */
export function interludes(chat: Chat): Interlude[] {
  const at = anchorsOf(chat);
  const groups = new Map<string, { turns: VisitTurn[]; events: FieldEvent[] }>();
  const slot = (a: string) => groups.get(a) ?? (groups.set(a, { turns: [], events: [] }), groups.get(a)!);
  for (const t of visitRecord(chat).turns) if (t.anchor && at.has(t.anchor)) slot(t.anchor).turns.push(t);
  for (const e of fieldRecord(chat).events) if (at.has(e.anchor)) slot(e.anchor).events.push(e);
  return [...groups].map(([anchor, g]) => ({ anchor, index: at.get(anchor)!, turns: g.turns.slice(-MAX_TURNS), events: g.events.slice(-MAX_EVENTS) })).sort((a, b) => a.index - b.index);
}

/** 확정 사실: 아직 있는 메시지에 붙은 사건에서만 (다시 굴려 사라진 일은 빠진다) */
export function liveFacts(chat: Chat): FieldFact[] {
  const at = anchorsOf(chat);
  return currentFacts(fieldRecord(chat).events.filter((e) => at.has(e.anchor)));
}

/** 기준 메시지가 사라져 본편에 안 들어가는 대화 */
export function orphanTurns(chat: Chat): VisitTurn[] {
  const live = new Set(interludes(chat).flatMap((g) => g.turns.map((t) => t.id)));
  return visitRecord(chat).turns.filter((t) => t.anchor && !live.has(t.id));
}

const safe = (s: string) => s.replace(/\{\{/g, '｛｛').replace(/\}\}/g, '｝｝').replace(/%%/g, '％％');

const ORDER_NOTE = 'Lines are in the order they happened. A heading marks where and to whom the protagonist spoke next; "(행동)" is something the protagonist did rather than said; "(끼어듦)" is a nearby person chiming in.';

/** 막간 글: 일어난 순서대로 (2026-10-23 사용자: 요원별로 묶으면 순서와 끼어들기를 알 수 없다) */
export function interludeText(g: Interlude, rules: string | null, visitor: string): string {
  const parts: string[] = [];
  let at = '';
  type Item = { at: number; turn?: VisitTurn; ev?: FieldEvent };
  const items: Item[] = [...g.turns.map((t) => ({ at: t.at || 0, turn: t })), ...g.events.map((e) => ({ at: e.at || 0, ev: e }))].sort((a, b) => a.at - b.at);
  items.forEach(({ turn: t, ev }) => {
    if (ev) {
      at = '';
      parts.push('', `(${KIND_LABEL[ev.kind]}) ${safe(ev.text)}`);
      return;
    }
    if (!t) return;
    const me = safe(t.visitor || visitor);
    const here = `${t.room ?? ''}|${t.name}`;
    if (here !== at) {
      at = here;
      parts.push('', `— ${t.room ? `${ROOM[t.room] ?? t.room}, ` : ''}${safe(t.name)}에게 —`);
    }
    parts.push(t.act ? `${me} (행동): ${safe(t.user)}` : `${me}: ${safe(t.user)}`, `${safe(t.name)}: ${safe(t.reply)}`, ...(t.extra ?? []).map((e) => `${safe(e.name)} (끼어듦): ${safe(e.line)}`));
  });
  const base = rules?.trim() || DEFAULT_RULES;
  const head = g.events.length ? [base.replace(/\s*Nothing else happened in between and only a few minutes passed\./, ''), EVENT_NOTE] : [base];
  return [INTERLUDE_HEAD, ...head, ORDER_NOTE, ...parts].join('\n').replace(/\n{3,}/g, '\n\n');
}

/** 지금 확정된 사실을 마지막 사용자 메시지 앞에 넣는다. 없으면 그대로 */
export function withFieldFacts<M extends { role?: unknown; content?: unknown }>(messages: M[], chat: Chat): M[] {
  const facts = liveFacts(chat);
  if (!facts.length || messages.some((m) => typeof m?.content === 'string' && m.content.startsWith(FACTS_HEAD))) return messages;
  const text = [FACTS_HEAD, FACTS_NOTE, ...facts.map((f) => `- ${safe(f.key)}: ${safe(f.value)}${f.permanent ? ' (permanent)' : ''}`)].join('\n');
  const at = messages.map((m) => m?.role).lastIndexOf('user');
  const block = { role: 'system', content: text } as M;
  return at < 0 ? [...messages, block] : [...messages.slice(0, at), block, ...messages.slice(at)];
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
