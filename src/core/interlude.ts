// 본부 막간을 본편 요청에 끼운다 (2026-10-22 설계 2판).
// 채팅에 메시지를 넣지 않는다: Risu 다시 굴리기는 마지막 봇 메시지부터 지우고 새로 만들어서, 막간 메시지가 날아가거나 덮어써진다.
// 대신 대화마다 그때 마지막 메시지(chatId)를 적어 두고, 본편 요청을 만들 때 그 메시지 바로 뒤에 넣는다.
// 그 메시지가 다시 굴리기·삭제로 사라졌으면 넣지 않는다.
import { messageText } from './refs';
import type { Chat } from './types';
import { visitRecord, type VisitTurn } from './visit';
import { currentFacts, fieldRecord, type FieldEvent, type FieldFact } from './field';

/** 블록 머리 (13-2 확정 2026-10-26, 11-01 다시 맞춤): `[Field visit · 10:40–12:10]` */
export const INTERLUDE_HEAD = '[Field visit';
/** 대화만 있고 사건이 없는 막간(옛 본부 방문)에 붙이는 한 줄. 카드 규칙문(visitContextRules)이 있으면 그것 */
const TALK_ONLY_NOTE = 'A face-to-face talk the protagonist had right after the preceding scene. It really happened; only minutes passed.';
/** 막간 하나에 넣을 최대 대화 수 (가장 최근 것부터) */
const MAX_TURNS = 30;

export interface Interlude { anchor: string; index: number; turns: VisitTurn[]; events: FieldEvent[]; /** 방문 시작·끝 표식 (머리·끝 줄의 시각·장소용, 글에는 안 넣음) */ marks?: FieldEvent[] }

/** 막간 하나에 넣을 최대 사건 수 (가장 최근 것부터) */
const MAX_EVENTS = 60;
export const FACTS_HEAD = '[Field facts]';
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
  const groups = new Map<string, { turns: VisitTurn[]; events: FieldEvent[]; marks: FieldEvent[] }>();
  const slot = (a: string) => groups.get(a) ?? (groups.set(a, { turns: [], events: [], marks: [] }), groups.get(a)!);
  for (const t of visitRecord(chat).turns) if (t.anchor && at.has(t.anchor)) slot(t.anchor).turns.push(t);
  // 방문 시작·끝은 표식: 글 줄로는 안 넣고 머리 `[Field visit · 시작–끝]`·끝 줄 `[End · …]`의 시각·장소로만 쓴다
  // 확정 사실만 담은 줄(ko 가 빈 글, 예: 가방)도 [Field facts] 칸에만 둔다 (10-31: 바뀔 때마다 줄이 쌓여 토큰을 썼다)
  for (const e of fieldRecord(chat).events) {
    if (!at.has(e.anchor)) continue;
    if (e.kind === 'enter_field' || e.kind === 'exit_field') slot(e.anchor).marks.push(e);
    else if (!(e.fact && e.ko === '')) slot(e.anchor).events.push(e);
  }
  const list = [...groups].map(([anchor, g]) => ({ anchor, index: at.get(anchor)!, turns: g.turns.slice(-MAX_TURNS), events: g.events.slice(-MAX_EVENTS), marks: g.marks })).sort((a, b) => a.index - b.index);
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

/** 줄 앞 필드 시각 「10:40 」 떼기 → [시각, 나머지] */
const splitTime = (t: string): [string, string] => { const m = /^(\d\d:\d\d) (.*)$/.exec(t); return m ? [m[1], m[2]] : ['', t]; };
const ROOM_KO: Record<string, string> = { office: '사무실', lounge: '휴게실', infirmary: '의무실', quarters: '숙소' };

/** 막간 글 — 13-2 확정 형식(2026-10-26, 11-01 다시 맞춤):
 *  [Field visit · 시작–끝] / [Scene · 장소 · 시각] 아래 그 장면의 대화 원문과 영어 짧은 사실 문장을 일어난 순서대로 / [End · 장소 · 시각 · with 동행].
 *  같은 메시지 뒤 방문이 여럿이면 방문마다 블록. 안내문 없음(토큰). 주인공 {user} → 이름. 대화만 있는 옛 본부 방문은 카드 규칙문(없으면 한 줄)만 */
export function interludeText(g: Interlude, rules: string | null, visitor: string): string {
  const me = safe(visitor);
  const who = (t: string) => safe(t).replace(/\{user\}/g, me);
  // 방문별로 나눈다 (visit 없는 옛 사건·대화는 한 묶음)
  const visits = new Map<string, { turns: VisitTurn[]; events: FieldEvent[]; marks: FieldEvent[] }>();
  const of = (v: string) => visits.get(v) ?? (visits.set(v, { turns: [], events: [], marks: [] }), visits.get(v)!);
  for (const e of g.events) of(e.visit ?? '').events.push(e);
  for (const e of g.marks ?? []) of(e.visit ?? '').marks.push(e);
  // 대화는 시각으로 가장 가까운 방문에 (방문 표식이 없으면 '')
  const spans = [...visits].map(([v, x]) => { const ts = [...x.events, ...x.marks].map((e) => e.at || 0); return { v, a: Math.min(...ts), b: Math.max(...ts) }; }).filter((x) => Number.isFinite(x.a));
  for (const t of g.turns) {
    const at = t.at || 0;
    const hit = spans.find((x) => at >= x.a - 60_000 && at <= x.b + 60_000) ?? spans.find((x) => at <= x.b) ?? spans[spans.length - 1];
    of(hit?.v ?? '').turns.push(t);
  }
  const blocks: string[] = [];
  for (const [, x] of visits) {
    const turns = [...x.turns].sort((a, b) => (a.at || 0) - (b.at || 0));
    const evs = mergeRuns([...x.events].sort((a, b) => (a.at || 0) - (b.at || 0)));
    const items = [...evs.map((e) => ({ at: e.at || 0, ev: e })), ...turns.map((t) => ({ at: t.at || 0, turn: t }))].sort((a, b) => a.at - b.at) as { at: number; turn?: VisitTurn; ev?: FieldEvent }[];
    if (!items.length) continue;
    // 시작·끝 시각: 표식 줄의 시각, 없으면 첫·마지막 사건 줄의 시각
    const enter = x.marks.find((e) => e.kind === 'enter_field'), exit = x.marks.find((e) => e.kind === 'exit_field');
    const times = evs.map((e) => splitTime(e.text)[0]).filter(Boolean);
    const t0 = (enter && splitTime(enter.text)[0]) || times[0] || '', t1 = (exit && splitTime(exit.text)[0]) || times[times.length - 1] || '';
    const span = t0 && t1 && t0 !== t1 ? `${t0}–${t1}` : t0 || t1;
    const parts: string[] = [`${INTERLUDE_HEAD}${span ? ` · ${span}` : ''}]`];
    // 대화만 있는 막간(옛 본부 방문): 카드 규칙문 한 줄
    if (!evs.length && turns.length) parts.push(rules?.trim() || TALK_ONLY_NOTE);
    let place = '', partner = '', lastPlace = '', lastTime = '';
    const followers: string[] = [];
    for (const { turn: t, ev } of items) {
      if (ev) {
        const [tm, line] = splitTime(ev.text);
        if (tm) lastTime = tm;
        if (ev.scene && ev.scene !== place) { place = ev.scene; lastPlace = place; partner = ''; parts.push(`[Scene · ${safe(place)}${tm ? ` · ${tm}` : ''}]`); }
        // 이동 줄은 장면 머리가 대신한다 (스쳐 지나간 장면은 뺀다, 13-2)
        if (ev.kind === 'move' && ev.scene) continue;
        if (ev.kind === 'follow') for (const w of ev.who ?? []) if (!followers.includes(w)) followers.push(w);
        if (ev.kind === 'unfollow') for (const w of ev.who ?? []) { const k = followers.indexOf(w); if (k >= 0) followers.splice(k, 1); }
        parts.push(who(line));
        continue;
      }
      if (!t) continue;
      // 대화: 장면 안에서 그대로. 장면을 모르면(옛 방문) 만난 방을 장면으로
      const room = t.room ? ROOM_KO[t.room] ?? t.room : '';
      if (!place && room && room !== lastPlace) { lastPlace = room; parts.push(`[Scene · ${safe(room)}]`); }
      if (t.name !== partner) { partner = t.name; parts.push(`— with ${safe(t.name)} —`); }
      const v = safe(t.visitor || visitor);
      parts.push(t.act ? `${v} (action): ${safe(t.user)}` : `${v}: ${safe(t.user)}`, `${safe(t.name)}: ${safe(t.reply)}`, ...(t.extra ?? []).map((e) => `${safe(e.name)} (cut in): ${safe(e.line)}`));
    }
    // 끝 줄: 방문이 끝났을 때만 (표식이 있을 때). 장소 = 끝 표식의 장면, 시각, 동행
    if (exit) {
      const endPlace = exit.scene || lastPlace, endTime = splitTime(exit.text)[0] || lastTime;
      parts.push(`[End${endPlace ? ` · ${safe(endPlace)}` : ''}${endTime ? ` · ${endTime}` : ''}${followers.length ? ` · with ${followers.map(safe).join(', ')}` : ''}]`);
    }
    blocks.push(parts.join('\n'));
  }
  return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n');
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
