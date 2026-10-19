// 본편 로어북 고르기 (2026-10-19, 사용자 결정 「플러그인이 고르게 하자」).
// 🌆세력·🎁파밍·🚧괴이·🙂요원 폴더 항목은 본문 첫 줄 @@dont_activate로 Risu가 스스로 켜지 않는다.
// 플러그인이 최근 글을 한국어 규칙(앞뒤 경계, 조사·호칭, 긴 이름 우선)으로 보고 켤 항목을 골라 CBS를 풀고,
// 늘 켜진 자리 항목(「{{getvar::goei_lore_…}}」)이 읽는 채팅 변수에 넣는다. 그래서 Risu가 이 글을 토큰으로 세고
// 넘치면 오래된 채팅을 지금처럼 지운다. 키는 로어북에 그대로 있어 사용자가 고칠 수 있다.
// 규칙 표: docs/호출키_검토_1019.md
import { evaluate, type CbsEnv } from './cbs';
import { tokens } from './gnet';
import { messageText } from './refs';
import type { Chat, LoreEntry } from './types';
import { readDirectory } from './world/directory';
import { parseWorld } from './world/engine';
import { WORLD_KEY } from './world/output';
import { findStatusTags } from './world/status';

export type LoreKind = 'org' | 'site' | 'anomaly' | 'agent';
export const LORE_KINDS: LoreKind[] = ['org', 'site', 'anomaly', 'agent'];

/** 자리 항목: 로어북 이름, 읽는 채팅 변수(앞 $ 없이), 삽입 순서 (그 폴더 항목들이 원래 놓이던 자리) */
export const SLOTS: Record<LoreKind, { comment: string; name: string; order: number; label: string }> = {
  org: { comment: '📚Lore slot · Faction', name: 'goei_lore_org', order: 200, label: '세력' },
  site: { comment: '📚Lore slot · Mystic', name: 'goei_lore_site', order: 400, label: '특수' },
  anomaly: { comment: '📚Lore slot · Anomaly', name: 'goei_lore_anomaly', order: 500, label: '괴이' },
  agent: { comment: '📚Lore slot · Agent', name: 'goei_lore_agent', order: 600, label: '요원' },
};
export const slotVar = (k: LoreKind) => `$${SLOTS[k].name}`;
export const DONT_ACTIVATE = '@@dont_activate';

const FOLDER_KIND: Record<string, LoreKind> = { 세력: 'org', 조직: 'org', 파밍: 'site', 괴이: 'anomaly', 요원: 'agent' };
const folderWord = (name: string) => name.replace(/[^\p{L}\p{N}]/gu, '');
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** 확증이 있어야 켜는 키: 흔한 구절·낱말과 같은 이름 (따옴표, 뒤에 괴담·측 등, 상황판, 투입 중일 때만) */
export const CONFIRM_KEYS = new Set([
  '어두운 정원', '거대한 세상', '욕망의 방', '학교의 악몽', '성자의 도시', '눈먼 자들의 저택', '검은 그늘 속에서', '한여름 밤의 꿈',
  '금지된 비디오', '금지된 영상', '생체 공장', '생체공장', '해피엔딩', '붉은 숙녀', '타락한 성당', '미스테리 월드', '어드벤쳐 파크',
  '교회', '강변', '지하실', '미술관', '병원', '극단', '세계정치', '세계 정치', '기독교 상점', '헐값 매입', '대박 알선', '사장', '국장',
]);

/** 이름 뒤에 붙어도 되는 말: 조사·서술·부름·호칭. 이 뒤에는 무엇이 와도 된다 (여진이었다) */
const JOSA = [
  '에게서', '에게', '한테', '께서', '께', '이랑', '하고', '까지', '부터', '마저', '조차', '처럼', '보다', '밖에', '으로', '로서', '로',
  '이나', '이든', '이라도', '라도', '에서', '에는', '에도', '에', '엔', '은', '는', '이', '가', '을', '를', '의', '와', '과', '랑', '도', '만', '나', '든',
  '였', '여', '야', '예요', '라', '란', '아',
];
const HONOR = ['님', '씨', '쌤', '선배', '언니', '오빠', '누나', '형', '양', '군', '팀장', '대리', '반장', '국장', '이사', '원장', '수녀', '신부', '요원'];
const SUFFIXES = [...new Set([...HONOR, ...JOSA])].sort((a, b) => b.length - a.length);
/** 확증 규칙: 이름 바로 뒤에 붙으면 그 이름을 고유명으로 쓴 것 */
const MARKERS = ['괴담', '괴이', '괴현상', '측', '소속', '직원', '쪽 사람'];
const OPEN = '「『"\'“‘<《〈[(【';
const CLOSE = '」』"\'”’>》〉])】';
const EN_STOP = new Set(['the', 'of', 'and', 'with', 'a', 'an', 'in', 'on', 'to', 'for']);

const isLetter = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);
const hangul = (s: string) => /[가-힣]/.test(s);
const syllables = (s: string) => [...s.replace(/\s+/g, '')].length;
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type KeyRule = 'plain' | 'alias' | 'confirm';

export interface LoreKey {
  text: string;
  en: boolean;
  rule: KeyRule;
  re: RegExp;
}

export interface ManagedEntry {
  kind: LoreKind;
  name: string;
  order: number;
  /** 로어북 안 위치 (같은 순서끼리 원래 차례) */
  index: number;
  content: string;
  keys: LoreKey[];
  /** Risu 방식(띄어쓰기 지우고 포함) 비교용 키 */
  rawKeys: string[];
  /** 요원: 구분선·소속 이름 (「가짜 관리국 사장」) */
  groups: string[];
}

function keyRegex(key: string, en: boolean, person = false): RegExp | null {
  if (en) {
    const words = key.toLowerCase().split(/[\s\-‐_]+/).filter(Boolean);
    if (!words.length || words.every((w) => EN_STOP.has(w))) return null;
    const body = words.map((w, i) => (EN_STOP.has(w) && i > 0 && i < words.length - 1 ? `(?:${escRe(w)}[\\s\\-]+)?` : `${escRe(w)}${i < words.length - 1 ? '[\\s\\-]*' : ''}`)).join('');
    return new RegExp(`(?<![a-z0-9])${body}(?:'s|’s|s'|es|s)?(?![a-z0-9])`, 'giu');
  }
  const parts = key.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  // 키의 띄어쓰기는 있어도 없어도. 세 글자 넘는 장소 이름은 키에 없는 띄어쓰기도 봐준다 (여우 상담실 = 여우상담실).
  // 사람 이름은 빼고 (「이 도형」이 이도형으로 걸리지 않게). 낱말 끝 「의」는 빼도 (인류 신비전 = 인류의 신비전)
  const gap = !person && syllables(key) >= 3 ? '\\s*' : '';
  const word = (p: string) => [...p].map(escRe).join(gap);
  const body = parts
    .map((p, i) => (i < parts.length - 1 && p.endsWith('의') && [...p].length >= 3 ? `${word(p.slice(0, -1))}(?:의)?` : word(p)))
    .join('\\s*');
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}`, 'giu');
}

function keysOf(e: LoreEntry): string[] {
  const all = str(e.key).split(',');
  if (e.selective) all.push(...str(e.secondkey).split(','));
  return [...new Set(all.map((k) => k.trim()).filter(Boolean))];
}

export const hasDontActivate = (content: string) => content.split('\n').some((l) => l.trim() === DONT_ACTIVATE) && /^\s*@@/.test(content);

/** 본문 앞의 장식 줄(@@…)을 뗀다 */
export function stripDecorators(content: string): string {
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length && /^\s*@@/.test(lines[i])) i++;
  return lines.slice(i).join('\n');
}

const cache = new WeakMap<LoreEntry[], ManagedEntry[]>();

/** 플러그인이 고르는 항목: 네 폴더 안에서 @@dont_activate가 붙은 것. 붙지 않은 항목은 Risu가 지금처럼 켠다 */
export function managedEntries(lore: LoreEntry[] | undefined): ManagedEntry[] {
  const books = lore ?? [];
  const hit = cache.get(books);
  if (hit) return hit;
  const kinds = new Map<string, LoreKind>();
  for (const e of books) {
    const k = e.mode === 'folder' ? FOLDER_KIND[folderWord(str(e.comment))] : undefined;
    if (k && typeof e.key === 'string') kinds.set(e.key, k);
  }
  const groups = new Map<string, string[]>();
  for (const a of readDirectory(books).agents) groups.set(a.lore, [a.group, /^[A-Z]\d\d$/.test(a.affiliation) ? '' : a.affiliation].filter(Boolean));
  const out: ManagedEntry[] = [];
  books.forEach((e, index) => {
    const kind = kinds.get(str(e.folder));
    const content = str(e.content);
    if (!kind || e.mode === 'folder' || !hasDontActivate(content)) return;
    const raw = keysOf(e);
    const longKo = raw.filter((k) => hangul(k) && syllables(k) >= 3);
    const keys: LoreKey[] = [];
    for (const text of raw) {
      const en = !hangul(text);
      const re = keyRegex(text, en, kind === 'agent');
      if (!re) continue;
      const alias = kind === 'agent' && !en && syllables(text) === 2 && longKo.some((l) => l.replace(/\s+/g, '').includes(text));
      keys.push({ text, en, rule: CONFIRM_KEYS.has(text) ? 'confirm' : alias ? 'alias' : 'plain', re });
    }
    out.push({ kind, name: str(e.comment), order: Number(e.insertorder ?? 0), index, content, keys, rawKeys: raw, groups: groups.get(str(e.comment)) ?? [] });
  });
  cache.set(books, out);
  return out;
}

// ── 글 속에서 찾기 ──

export interface KeyHit {
  entry: number;
  key: LoreKey;
  start: number;
  end: number;
  /** 확증: 따옴표·괄호로 감쌈, 뒤에 괴담·측 등, 앞에 소속 이름 */
  marked: boolean;
  /** 뒤에 호칭 (연지 씨, 연지야) */
  honor: boolean;
  snippet: string;
}

/** 걸린 자리 앞뒤 낱말 하나씩 (화면에 까닭으로 보인다) */
function around(text: string, start: number, end: number): string {
  let a = start;
  for (let n = 0; a > 0 && n < 2; ) if (/\s/.test(text[--a])) n++;
  let b = end;
  for (let n = 0; b < text.length && n < 2; b++) if (/\s/.test(text[b])) n++;
  return text.slice(a, b).replace(/\s+/g, ' ').trim();
}

function rightOk(text: string, end: number): { ok: boolean; honor: boolean } {
  const tail = text.slice(end);
  if (!isLetter(tail[0])) {
    const next = tail.replace(/^\s+/, '');
    return { ok: true, honor: tail.length !== next.length && HONOR.some((h) => next.startsWith(h) && !isLetter(next[h.length])) };
  }
  const sfx = SUFFIXES.find((s) => tail.startsWith(s));
  if (!sfx) return { ok: false, honor: false };
  return { ok: true, honor: HONOR.includes(sfx) || sfx === '아' || sfx === '야' };
}

/** 한 글에서 모든 항목의 키가 걸린 자리. 겹치면 가장 긴 이름만 (가짜 관리국 ⊃ 관리국) */
export function findHits(text: string, entries: ManagedEntry[]): KeyHit[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const hits: KeyHit[] = [];
  entries.forEach((e, ei) => {
    for (const key of e.keys) {
      key.re.lastIndex = 0;
      for (const m of lower.matchAll(key.re)) {
        const start = m.index ?? 0;
        const end = start + m[0].length;
        const r = key.en ? { ok: true, honor: false } : rightOk(lower, end);
        if (!r.ok) continue;
        const tail = lower.slice(end).replace(/^\s+/, '');
        const quoted = OPEN.includes(lower[start - 1] ?? '') && CLOSE.includes(lower[end] ?? '');
        const before = lower.slice(Math.max(0, start - 20), start).trimEnd();
        const marked = quoted || MARKERS.some((w) => tail.startsWith(w)) || e.groups.some((g) => g && before.endsWith(g.toLowerCase()));
        hits.push({ entry: ei, key, start, end, marked, honor: r.honor, snippet: around(text, start, end) });
      }
    }
  });
  return hits.filter((h) => !hits.some((o) => o !== h && o.entry !== h.entry && o.start <= h.start && o.end >= h.end && o.end - o.start > h.end - h.start));
}

// ── 고르기 ──

export interface LoreMessage {
  role: string;
  data: string;
}

export interface LoreState {
  /** 상태창 괴이 칸 (마지막 응답) */
  target: string;
  /** 상황판에 발생해 있는 괴이·특수 이름 */
  board: string[];
  /** 작전투입·외근 중인 요원 이름 */
  deployed: string[];
}

export type LoreReason = 'status' | 'input' | 'user' | 'char' | 'confirmed';

export interface LorePick {
  entry: ManagedEntry;
  score: number;
  reasons: { why: LoreReason; key: string; snippet: string }[];
}

export interface LoreOptions {
  /** 볼 메시지 수 (Risu 검색 깊이, 카드 기본 10) */
  depth: number;
  /** 넣을 로어북 글 상한 (추정 토큰). 0이면 없음 */
  budget: number;
  env: CbsEnv;
}

export const DEFAULT_DEPTH = 10;

/** 채팅에서 상태 신호를 읽는다 */
export function loreState(chat: Chat): LoreState {
  const msgs = chat.message ?? [];
  let target = '';
  for (let i = msgs.length - 1; i >= 0 && !target; i--) {
    if (msgs[i].role === 'user') continue;
    const tags = findStatusTags(str(msgs[i].data));
    if (tags.length) target = tags[tags.length - 1].target;
    if (tags.length) break;
  }
  const w = parseWorld(chat.scriptstate?.[WORLD_KEY]);
  const board = [...w.an.filter((a) => a.state === '활성').map((a) => a.name), ...w.ms.filter((m) => m.state === '출현').map((m) => m.name)];
  const deployed = Object.entries(w.agents).filter(([, r]) => r.st === '작전투입' || r.st === '외근').map(([n]) => n);
  return { target, board, deployed };
}

const sameName = (a: string, b: string) => a.replace(/\s+/g, '').toLowerCase() === b.replace(/\s+/g, '').toLowerCase();

/** 항목 이름이나 키 중 하나가 이 이름과 같은지 */
function names(e: ManagedEntry, name: string): boolean {
  return !!name.trim() && (sameName(e.name, name) || e.rawKeys.some((k) => sameName(k, name)));
}

/**
 * 켤 항목을 고른다. messages는 오래된 것부터, 마지막이 이번 입력(있으면).
 * 켜는 조건: 보통 키가 걸림 / 두 글자 별칭·구절형 키는 확증(따옴표·뒤에 괴담·호칭·투입 중·상황판·같은 항목의 다른 키)이 있을 때 /
 * 상태창 괴이 칸. 점수는 상한을 넘을 때 뺄 차례에만 쓴다 (상태창 > 이번 입력 > 최근 사용자 글 > 최근 응답).
 */
export function pickLore(entries: ManagedEntry[], messages: LoreMessage[], state: LoreState, o: Pick<LoreOptions, 'depth' | 'budget'>, inputLast = false): LorePick[] {
  const window = messages.slice(-Math.max(1, o.depth));
  const picks = new Map<number, LorePick>();
  const add = (i: number, why: LoreReason, key: string, snippet: string, score: number) => {
    const p = picks.get(i) ?? { entry: entries[i], score: 0, reasons: [] };
    p.score += score;
    if (!p.reasons.some((r) => r.why === why && r.key === key)) p.reasons.push({ why, key, snippet });
    picks.set(i, p);
  };
  entries.forEach((e, i) => {
    if (state.target && names(e, state.target)) add(i, 'status', state.target, state.target, 100);
  });
  const pending: { hit: KeyHit; why: LoreReason; score: number }[] = [];
  window.forEach((m, wi) => {
    const age = window.length - 1 - wi;
    const isInput = inputLast && wi === window.length - 1;
    const why: LoreReason = isInput ? 'input' : m.role === 'user' ? 'user' : 'char';
    const score = (isInput ? 30 : 0) + (m.role === 'user' ? 3 : 1) * 0.8 ** age;
    for (const hit of findHits(m.data, entries)) pending.push({ hit, why, score });
  });
  for (const { hit, why, score } of pending) if (hit.key.rule === 'plain') add(hit.entry, why, hit.key.text, hit.snippet, score);
  for (const { hit, why, score } of pending) {
    if (hit.key.rule === 'plain') continue;
    const e = entries[hit.entry];
    const present = state.deployed.some((n) => names(e, n)) || state.board.some((n) => names(e, n));
    const ok = hit.marked || present || picks.has(hit.entry) || (hit.key.rule === 'alias' && hit.honor);
    if (ok) add(hit.entry, picks.has(hit.entry) || !hit.marked ? why : 'confirmed', hit.key.text, hit.snippet, score);
  }
  let list = [...picks.values()];
  if (o.budget > 0) {
    const keep: LorePick[] = [];
    let used = 0;
    for (const p of list.slice().sort((a, b) => b.score - a.score)) {
      const n = tokens(p.entry.content);
      if (used + n > o.budget) continue;
      used += n;
      keep.push(p);
    }
    list = keep;
  }
  return list.sort((a, b) => a.entry.order - b.entry.order || a.entry.index - b.entry.index);
}

/** Risu 방식: 키를 소문자로, 띄어쓰기를 모두 지우고 메시지마다 포함 검사 (v2026.8.250 lorebook.svelte.ts) */
export function pickLoreRisu(entries: ManagedEntry[], messages: LoreMessage[], depth: number): LorePick[] {
  const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  const window = messages.slice(-Math.max(1, depth)).map((m) => ({ m, flat: squash(m.data) }));
  const out: LorePick[] = [];
  for (const entry of entries) {
    const reasons: LorePick['reasons'] = [];
    for (const k of entry.rawKeys) {
      const key = squash(k);
      const at = key ? window.find((w) => w.flat.includes(key)) : undefined;
      if (at) reasons.push({ why: at.m.role === 'user' ? 'user' : 'char', key: k, snippet: k });
    }
    if (reasons.length) out.push({ entry, score: 0, reasons });
  }
  return out.sort((a, b) => a.entry.order - b.entry.order || a.entry.index - b.entry.index);
}

/** 고른 항목을 자리마다 이어 붙인다 (CBS를 풀고 장식 줄을 뗀다) */
export function slotTexts(picks: LorePick[], env: CbsEnv): Record<LoreKind, string> {
  const out = { org: [], site: [], anomaly: [], agent: [] } as Record<LoreKind, string[]>;
  for (const p of picks) {
    const text = stripDecorators(evaluate(p.entry.content, env)).trim();
    if (text) out[p.entry.kind].push(text);
  }
  return Object.fromEntries(LORE_KINDS.map((k) => [k, out[k].join('\n\n')])) as Record<LoreKind, string>;
}

/** 채팅 메시지 → 고르기에 쓸 글. 플러그인 규칙은 표식·카드를 걷어 낸 글, Risu 방식은 원문 그대로 */
export function loreMessages(chat: Chat, input?: string, raw = false): LoreMessage[] {
  const msgs = (chat.message ?? []).map((m) => ({ role: m.role === 'user' ? 'user' : 'char', data: raw ? str(m.data) : messageText(str(m.data)) }));
  if (input !== undefined) msgs.push({ role: 'user', data: raw ? input : messageText(input) });
  return msgs.filter((m) => m.data);
}

export type LoreMode = 'plugin' | 'risu';

export interface LoreResult {
  picks: LorePick[];
  vars: Record<string, string>;
}

/** 이번 요청에 넣을 로어북과 채팅 변수 */
export function computeLore(lore: LoreEntry[] | undefined, chat: Chat, o: LoreOptions & { mode: LoreMode; input?: string }): LoreResult | null {
  const entries = managedEntries(lore);
  if (!entries.length) return null;
  const msgs = loreMessages(chat, o.input, o.mode === 'risu');
  const picks = o.mode === 'risu' ? pickLoreRisu(entries, msgs, o.depth) : pickLore(entries, msgs, loreState(chat), o, msgs.at(-1)?.role === 'user');
  const texts = slotTexts(picks, o.env);
  return { picks, vars: Object.fromEntries(LORE_KINDS.map((k) => [slotVar(k), texts[k]])) };
}

/** 채팅 변수가 이미 이 값인지 (같으면 저장하지 않는다) */
export const sameVars = (ss: Record<string, unknown> | undefined, vars: Record<string, string>) =>
  Object.entries(vars).every(([k, v]) => String(ss?.[k] ?? '') === v);

/** 카드 로어북 설정(검색 깊이·토큰 예산)으로 고르기 설정. 예산은 늘 켜진 다른 로어북 몫을 뺀 나머지 (Risu가 자리 항목을 통째로 빼지 않게) */
export function loreOptions(char: { name?: string; globalLore?: LoreEntry[]; loreSettings?: unknown }, chat: Chat, mode: LoreMode, user = ''): LoreOptions & { mode: LoreMode } {
  const ls = (char.loreSettings ?? {}) as { scanDepth?: unknown; tokenBudget?: unknown };
  const depth = Number(ls.scanDepth) > 0 ? Number(ls.scanDepth) : DEFAULT_DEPTH;
  const total = Number(ls.tokenBudget) > 0 ? Number(ls.tokenBudget) : 0;
  const slots = new Set(LORE_KINDS.map((k) => SLOTS[k].comment));
  const always = (char.globalLore ?? []).filter((e) => e.alwaysActive && e.mode !== 'folder' && !slots.has(str(e.comment))).reduce((n, e) => n + tokens(str(e.content)), 0);
  return {
    mode,
    depth,
    budget: total ? Math.max(1, Math.floor((total - always) * 0.9)) : 0,
    env: { vars: chat.scriptstate ?? {}, char: char.name, ...(user ? { user } : {}) },
  };
}

/**
 * 요청 직전 보정: 입력 때 넣어 둔 글(old)과 지금 다시 고른 글(next)이 다르면 요청 속 그 글을 바꾼다.
 * 다시 굴리기처럼 입력 처리를 거치지 않은 요청을 맞춘다. 비어 있던 자리는 찾을 수 없어 그대로 둔다
 */
export function patchSlots<M extends { content?: unknown }>(messages: M[], old: Record<string, unknown> | undefined, next: Record<string, string>): { messages: M[]; changed: number } {
  let changed = 0;
  let out = messages;
  for (const [k, v] of Object.entries(next)) {
    const prev = String(old?.[k] ?? '');
    if (!prev || prev === v) continue;
    const at = out.findIndex((m) => typeof m?.content === 'string' && m.content.includes(prev));
    if (at < 0) continue;
    out = out.map((m, i) => (i === at ? { ...m, content: (m.content as string).replace(prev, () => v) } : m));
    changed++;
  }
  return { messages: out, changed };
}
