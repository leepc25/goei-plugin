// 본부 막간을 본편 요청에 끼운다 (2026-10-22 설계 2판).
// 채팅에 메시지를 넣지 않는다: Risu 다시 굴리기는 마지막 봇 메시지부터 지우고 새로 만들어서, 막간 메시지가 날아가거나 덮어써진다.
// 대신 대화마다 그때 마지막 메시지(chatId)를 적어 두고, 본편 요청을 만들 때 그 메시지 바로 뒤에 넣는다.
// 그 메시지가 다시 굴리기·삭제로 사라졌으면 넣지 않는다.
import { messageText } from './refs';
import type { Chat } from './types';
import { visitRecord, type VisitTurn } from './visit';
import { currentFacts, fieldRecord, type FieldEvent, type FieldFact } from './field';

export const INTERLUDE_HEAD = '[Field log]';
const DEFAULT_RULES = 'The block below is a face-to-face conversation the protagonist had at bureau HQ right after the preceding scene and before the next input. It really happened. Nothing else happened in between and only a few minutes passed.';
/** 막간 하나에 넣을 최대 대화 수 (가장 최근 것부터) */
const MAX_TURNS = 30;

export interface Interlude { anchor: string; index: number; turns: VisitTurn[]; events: FieldEvent[] }

/** 막간 하나에 넣을 최대 사건 수 (가장 최근 것부터) */
const MAX_EVENTS = 60;
export const FACTS_HEAD = '[Field facts]';
const EVENT_NOTE = 'What happened in the field, in order, grouped under [place]. All real; times are the field clock.';
const FACTS_NOTE = 'Current facts from the field. Do not contradict them.';

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
  const list = [...groups].map(([anchor, g]) => ({ anchor, index: at.get(anchor)!, turns: g.turns.slice(-MAX_TURNS), events: g.events.slice(-MAX_EVENTS) })).sort((a, b) => a.index - b.index);
  // 지난 막간은 큰일만 (싸움·살해·쓰러짐·동행 등 weight 2 이상): 토큰을 아낀다 (10-31). 가장 최근 막간은 다 넣는다
  return list.map((g, i) => (i < list.length - 1 ? { ...g, events: g.events.filter((e) => (e.weight ?? 1) >= 2) } : g));
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

const ORDER_NOTE = 'Dialogue is in order. "— with X —" marks who {user} spoke to next; "(action)" = done, not said; "(cut in)" = a bystander joined in.';

/** 이어진 이동·돈 줄을 한 줄로 묶는다: 「15:10 {user} moved to A.」+「15:20 {user} moved to B.」 → 「15:20 {user} moved to A → B.」, 돈 줄은 「Money (won): -1500 편의점 컵라면, -4500 편의점 담배」 */
function mergeRuns(evs: FieldEvent[]): FieldEvent[] {
  const out: FieldEvent[] = [];
  for (const e of evs) {
    const prev = out[out.length - 1];
    if (prev && prev.kind === e.kind && prev.scene === e.scene && e.kind === 'trade') {
      const m = /Money: (.*)$/.exec(e.text);
      if (m) { out[out.length - 1] = { ...prev, text: `${prev.text}, ${m[1]}` }; continue; }
    }
    if (prev && prev.kind === 'move' && e.kind === 'move') {
      const a = /moved to (.*)\.$/.exec(prev.text), b = /^(\d\d:\d\d )?.*moved to (.*)\.$/.exec(e.text);
      if (a && b) { out[out.length - 1] = { ...e, text: `${b[1] ?? ''}{user} moved to ${a[1]} → ${b[2]}.` }; continue; }
    }
    out.push(e);
  }
  return out.map((e) => (e.kind === 'trade' ? { ...e, text: e.text.replace('Money: ', 'Money (won): ') } : e));
}

/** 막간 글: 일어난 순서대로 (2026-10-23 사용자: 요원별로 묶으면 순서와 끼어들기를 알 수 없다). 모델만 읽는 글이라 영어 짧은 문장(10-31), 주인공 = {user} → 이름 */
export function interludeText(g: Interlude, rules: string | null, visitor: string): string {
  const parts: string[] = [];
  let at = '';
  let place = '';
  const me = safe(visitor);
  const who = (t: string) => safe(t).replace(/\{user\}/g, me);
  type Item = { at: number; turn?: VisitTurn; ev?: FieldEvent };
  const items: Item[] = [...g.turns.map((t) => ({ at: t.at || 0, turn: t })), ...mergeRuns([...g.events].sort((a, b) => a.at - b.at)).map((e) => ({ at: e.at || 0, ev: e }))].sort((a, b) => a.at - b.at);
  items.forEach(({ turn: t, ev }) => {
    if (ev) {
      at = '';
      if (ev.scene && ev.scene !== place) { place = ev.scene; parts.push(`[${safe(place)}]`); }
      parts.push(who(ev.text));
      return;
    }
    if (!t) return;
    const v = safe(t.visitor || visitor);
    const here = `${t.room ?? ''}|${t.name}`;
    if (here !== at) {
      at = here;
      parts.push('', `— with ${safe(t.name)}${t.room ? ` (${safe(t.room)})` : ''} —`);
    }
    parts.push(t.act ? `${v} (action): ${safe(t.user)}` : `${v}: ${safe(t.user)}`, `${safe(t.name)}: ${safe(t.reply)}`, ...(t.extra ?? []).map((e) => `${safe(e.name)} (cut in): ${safe(e.line)}`));
  });
  const base = rules?.trim() || DEFAULT_RULES;
  // 대화가 없으면 대화 규칙문은 빼고 사건 안내만 (토큰 절약, 10-31)
  const talk = g.events.length ? base.replace(/\s*Nothing else happened in between and only a few minutes passed\./, '') : base;
  const head = [...(g.turns.length ? [talk] : []), ...(g.events.length ? [EVENT_NOTE] : [])];
  return [INTERLUDE_HEAD, ...head, ...(g.turns.length ? [ORDER_NOTE.replace(/\{user\}/g, me)] : []), ...parts].join('\n').replace(/\n{3,}/g, '\n\n');
}

/** 지금 확정된 사실을 마지막 사용자 메시지 앞에 넣는다. 없으면 그대로 */
export function withFieldFacts<M extends { role?: unknown; content?: unknown }>(messages: M[], chat: Chat, visitor = '{user}'): M[] {
  const facts = liveFacts(chat);
  if (!facts.length || messages.some((m) => typeof m?.content === 'string' && m.content.startsWith(FACTS_HEAD))) return messages;
  const me = safe(visitor);
  const text = [FACTS_HEAD, FACTS_NOTE, ...facts.map((f) => `- ${safe(f.key).replace(/\{user\}/g, me)}: ${safe(f.value)}${f.permanent ? ' (permanent)' : ''}`)].join('\n');
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
