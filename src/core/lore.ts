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
import { hasVirtual, isVirtual } from './world/virtual';
import { readDirectory, type AppendixWhen } from './world/directory';
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
/** 📎부록 폴더 (core/world/directory.ts). 켜지는 자리는 본 항목 폴더를 따른다 */
const APPENDIX = '부록';
const folderWord = (name: string) => name.replace(/[^\p{L}\p{N}]/gu, '');
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** 확증이 있어야 켜는 키: 흔한 구절·낱말과 같은 이름 (따옴표, 뒤에 괴담·측 등, 상황판, 투입 중일 때만) */
export const CONFIRM_KEYS = new Set([
  '어두운 정원', '거대한 세상', '욕망의 방', '학교의 악몽', '성자의 도시', '눈먼 자들의 저택', '검은 그늘 속에서', '한여름 밤의 꿈',
  '금지된 비디오', '금지된 영상', '생체 공장', '생체공장', '해피엔딩', '붉은 숙녀', '타락한 성당', '미스테리 월드', '어드벤쳐 파크',
  '교회', '강변', '지하실', '미술관', '병원', '극단', '세계정치', '세계 정치', '기독교 상점', '헐값 매입', '대박 알선', '사장', '국장',
  // 흔한 영어 이름·낱말과 같은 키 (2026-10-21: Jay는 흔한 이름, 브라우니는 과자)
  'Jay', 'Brownie', '브라우니', 'Yu-ri', 'Route 16', 'Red Lady',
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
const EN_TITLE = /(?:^|[^a-z])(?:chief|ban-?jang|team-?jang|leader|agent|director|manager|officer|mr\.?|ms\.?|mrs\.?|sir|madam)\s+$/;
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
  /** 같은 순서끼리 놓을 차례: 보통은 index, 부록은 본 항목 바로 뒤 */
  rank: number;
  /** 📎부록 항목이면 본 항목과 켜지는 조건 */
  appendix?: AppendixInfo;
}

export interface AppendixInfo {
  /** 본 항목 로어북 이름 ('' = 못 찾음) */
  parent: string;
  /** 본 항목의 이름·키 (상태창 목표 칸과 맞춰 본다) */
  parentNames: string[];
  when: AppendixWhen;
  /** 동행·투입과 맞춰 볼 요원 이름들 (요원 하나마다 이름·로어북 이름·별칭) */
  agentNames: string[][];
}

export function keyRegex(key: string, en: boolean, person = false): RegExp | null {
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

/** 자리 항목 4개가 다 있는 카드인지 (없으면 고른 글이 들어갈 곳이 없어 아무것도 하지 않는다) */
export function hasSlots(lore: LoreEntry[] | undefined): boolean {
  const names = new Set((lore ?? []).map((e) => str(e.comment)));
  return LORE_KINDS.every((k) => names.has(SLOTS[k].comment));
}

/** 네 폴더(+ 📎부록) 안의 키 있는 보통 항목인지 */
function folderKeys(books: LoreEntry[]): Map<string, LoreKind | 'appendix'> {
  const kinds = new Map<string, LoreKind | 'appendix'>();
  for (const e of books) {
    if (e.mode !== 'folder' || typeof e.key !== 'string') continue;
    const w = folderWord(str(e.comment));
    const k = w === APPENDIX ? 'appendix' : FOLDER_KIND[w];
    if (k && !kinds.has(e.key)) kinds.set(e.key, k);
  }
  return kinds;
}
const managedHere = (e: LoreEntry, kinds: Map<string, LoreKind | 'appendix'>) => e.mode !== 'folder' && kinds.has(str(e.folder)) && !!str(e.key).trim() && !e.alwaysActive;
/** 부록이 키 말고도 켜질 길이 있는지 (키 없는 부록도 고른다) */
const otherTriggers = (w: AppendixWhen) => w.withParent || w.target || w.places.length > 0 || w.agents.length > 0;

/**
 * 보내는 방식에 맞게 네 폴더 항목의 첫 줄을 맞춘다. 플러그인이 고름: @@dont_activate를 붙여 Risu가 켜지 않게
 * (사용자가 새로 넣은 항목 포함). Risu가 직접: 그 줄을 떼어 Risu가 예전처럼 켜게. 바꿀 것이 없으면 null
 */
export function syncDecorators(lore: LoreEntry[] | undefined, mode: LoreMode): LoreEntry[] | null {
  const books = lore ?? [];
  if (!hasSlots(books) && !hasVirtual(books)) return null;
  const kinds = folderKeys(books);
  // 해금이 걸린 부록은 Risu가 직접 켜는 방식에서도 켜지 않게 둔다 (해금 상태는 플러그인만 안다)
  const locked = new Set(readDirectory(books).appendices.filter((r) => r.unlock).map((r) => r.lore));
  let n = 0;
  const next = books.map((e) => {
    if (!managedHere(e, kinds) || isVirtual(e)) return e;
    const content = str(e.content);
    const on = hasDontActivate(content);
    const keep = mode === 'plugin' || (kinds.get(str(e.folder)) === 'appendix' && locked.has(str(e.comment)));
    if (keep && !on) {
      n++;
      return { ...e, content: `${DONT_ACTIVATE}\n${content}` };
    }
    if (!keep && on) {
      n++;
      return { ...e, content: content.replace(/^\s*@@dont_activate[ \t]*\r?\n?/m, '') };
    }
    return e;
  });
  return n ? next : null;
}

/** 플러그인이 고르는 항목: 자리 항목이 있는 카드에서 네 폴더 안의 키 있는 항목 (첫 줄은 syncDecorators가 맞춘다) */
export function managedEntries(lore: LoreEntry[] | undefined): ManagedEntry[] {
  const books = lore ?? [];
  const hit = cache.get(books);
  if (hit) return hit;
  // 자리 항목이 있는 카드(옛 방식: Risu 가 자리 항목으로 끼움) 또는 가상 로어북이 붙은 카드(플러그인이 요청에 직접 끼움)
  if (!hasSlots(books) && !hasVirtual(books)) {
    cache.set(books, []);
    return [];
  }
  const kinds = folderKeys(books);
  const dir = readDirectory(books);
  const groups = new Map<string, string[]>();
  for (const a of dir.agents) groups.set(a.lore, [a.group, /^[A-Z]\d\d$/.test(a.affiliation) ? '' : a.affiliation].filter(Boolean));
  const apps = new Map(dir.appendices.map((r) => [r.lore, r]));
  // 부록의 본 항목: 네 폴더 안의 항목 (자리·순서를 이어받는다)
  const parentAt = (name: string) => books.findIndex((x) => x.mode !== 'folder' && str(x.comment) === name && kinds.has(str(x.folder)) && kinds.get(str(x.folder)) !== 'appendix');
  const agentNames = (name: string) => {
    const a = dir.agents.find((x) => x.lore === name || x.name === name || x.aliases.includes(name));
    return a ? [...new Set([a.name, a.lore, a.english, ...a.aliases].filter(Boolean))] : [name];
  };
  const out: ManagedEntry[] = [];
  books.forEach((e, index) => {
    const folderKind = kinds.get(str(e.folder));
    const content = str(e.content);
    if (!folderKind || e.mode === 'folder' || e.alwaysActive) return;
    let kind: LoreKind;
    let order = Number(e.insertorder ?? 0);
    let rank = index;
    let appendix: AppendixInfo | undefined;
    if (folderKind === 'appendix') {
      const row = apps.get(str(e.comment));
      if (!row || (!str(e.key).trim() || !row.keys) && !otherTriggers(row)) return;
      const at = row.parent ? parentAt(row.parent) : -1;
      const p = at >= 0 ? books[at] : undefined;
      kind = p ? (kinds.get(str(p.folder)) as LoreKind) : 'org';
      if (p) {
        order = Number(p.insertorder ?? 0);
        rank = at + 0.5 + index / 1e7;
      }
      appendix = { parent: p ? row.parent : '', parentNames: p ? [row.parent, ...keysOf(p)] : row.parent ? [row.parent] : [], when: row, agentNames: row.agents.map(agentNames) };
    } else {
      if (!managedHere(e, kinds)) return;
      kind = folderKind;
    }
    const raw = appendix && !appendix.when.keys ? [] : keysOf(e);
    const longKo = raw.filter((k) => hangul(k) && syllables(k) >= 3);
    const keys: LoreKey[] = [];
    for (const text of raw) {
      const en = !hangul(text);
      const re = keyRegex(text, en, kind === 'agent');
      if (!re) continue;
      const alias = kind === 'agent' && !en && syllables(text) === 2 && longKo.some((l) => l.replace(/\s+/g, '').includes(text));
      keys.push({ text, en, rule: CONFIRM_KEYS.has(text) ? 'confirm' : alias ? 'alias' : 'plain', re });
    }
    out.push({ kind, name: str(e.comment), order, index, content, keys, rawKeys: raw, groups: groups.get(str(e.comment)) ?? [], rank, ...(appendix ? { appendix } : {}) });
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
    // 띄고 붙은 호칭: 「연지 씨」「제이 반장이」처럼 호칭 뒤에 조사가 와도 된다
    const honorAt = (h: string) => next.startsWith(h) && (!isLetter(next[h.length]) || JOSA.some((j) => next.startsWith(j, h.length)));
    return { ok: true, honor: tail.length !== next.length && HONOR.some(honorAt) };
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
        // 영어 이름은 앞의 직함으로 확증 (Guard Chief Jay, Agent Kyuras)
        const r = key.en ? { ok: true, honor: EN_TITLE.test(lower.slice(Math.max(0, start - 16), start)) } : rightOk(lower, end);
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
  /** 상태창 위치 칸 (마지막 응답) */
  place?: string;
  /** 상태창 동행 칸 (마지막 응답) */
  companions?: string[];
  /** 이 채팅에서 해금한 부록 이름 */
  unlocked?: string[];
}

/** 부록 해금 기록 (채팅 변수, JSON 배열) */
export const UNLOCK_VAR = '$goei_unlocked';
/** 모델이 해금을 알리는 태그 [🔓|부록 이름] */
const UNLOCK_TAG = /\[\s*🔓\s*[|｜]\s*([^\]\r\n]+?)\s*\]/gu;

export function readUnlocked(ss: Record<string, unknown> | undefined): string[] {
  try {
    const v = JSON.parse(String(ss?.[UNLOCK_VAR] ?? '[]'));
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [];
  } catch {
    return [];
  }
}

/** 해금 목록을 바꾼 채팅 변수 값 */
export const unlockedValue = (names: string[]) => JSON.stringify([...new Set(names)]);

export const hasUnlockTag = (text: string) => typeof text === 'string' && text.includes('🔓') && new RegExp(UNLOCK_TAG.source, 'u').test(text);

/** 글 속 해금 태그의 부록 이름들 */
export function unlockTags(text: string): string[] {
  return hasUnlockTag(text) ? [...text.matchAll(UNLOCK_TAG)].map((m) => m[1].trim()) : [];
}

/** 해금 태그를 지운 글 (태그만 있던 줄은 줄째) */
export function stripUnlockTags(text: string): string {
  if (!hasUnlockTag(text)) return text;
  return text.replace(new RegExp(`^[ \\t]*${UNLOCK_TAG.source}[ \\t]*\\r?\\n?`, 'gmu'), '').replace(UNLOCK_TAG, '').replace(/\n{3,}/g, '\n\n').trimEnd();
}

export type LoreReason = 'status' | 'input' | 'user' | 'char' | 'confirmed' | 'place' | 'agent' | 'parent';

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
  /** 고르지 않을 로어북 이름 (캐릭터로 플레이: 유저가 연기하는 요원은 주인공 자리에 따로 넣는다) */
  exclude?: string[];
}

export const DEFAULT_DEPTH = 10;
/** 카드에 토큰 예산이 없을 때 (깡통봇 등) 기본값 (사용자 2026-10-27: 깊이 10 · 예산 99999) */
export const DEFAULT_BUDGET = 99999;

/** 채팅에서 상태 신호를 읽는다 */
export function loreState(chat: Chat): LoreState {
  const msgs = chat.message ?? [];
  let target = '';
  let place = '';
  let companions: string[] = [];
  for (let i = msgs.length - 1; i >= 0 && !target; i--) {
    if (msgs[i].role === 'user') continue;
    const tags = findStatusTags(str(msgs[i].data));
    if (tags.length) ({ target, place, companions } = tags[tags.length - 1]);
    if (tags.length) break;
  }
  const w = parseWorld(chat.scriptstate?.[WORLD_KEY]);
  const board = [...w.an.filter((a) => a.state === '활성').map((a) => a.name), ...w.ms.filter((m) => m.state === '출현').map((m) => m.name)];
  const deployed = Object.entries(w.agents).filter(([, r]) => r.st === '작전투입' || r.st === '외근').map(([n]) => n);
  return { target, board, deployed, place, companions, unlocked: readUnlocked(chat.scriptstate) };
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
    if (state.target && !e.appendix && names(e, state.target)) add(i, 'status', state.target, state.target, 100);
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
    const ok = hit.marked || present || picks.has(hit.entry) || hit.honor;
    if (ok) add(hit.entry, picks.has(hit.entry) || !hit.marked ? why : 'confirmed', hit.key.text, hit.snippet, score);
  }
  pickAppendices(entries, picks, state, add);
  let list = [...picks.values()];
  if (o.budget > 0) {
    // 본 항목 먼저 (부록은 남는 몫에)
    const keep: LorePick[] = [];
    let used = 0;
    for (const p of list.slice().sort((a, b) => Number(!!a.entry.appendix) - Number(!!b.entry.appendix) || b.score - a.score)) {
      const n = tokens(p.entry.content);
      if (used + n > o.budget) continue;
      used += n;
      keep.push(p);
    }
    const on = new Set(keep.map((p) => p.entry.name));
    list = keep.filter((p) => !p.entry.appendix?.when.needParent || on.has(p.entry.appendix.parent));
  }
  return sortPicks(list);
}

const sortPicks = (list: LorePick[]) => list.sort((a, b) => a.entry.order - b.entry.order || a.entry.rank - b.entry.rank || a.entry.index - b.entry.index);

const squash = (t: string) => t.replace(/\s+/g, '').toLowerCase();

/** 부록: 상태창 목표·위치·동행, 본 항목과 같이 켜기, 그리고 해금·본 항목 조건으로 끄기 */
function pickAppendices(entries: ManagedEntry[], picks: Map<number, LorePick>, state: LoreState, add: (i: number, why: LoreReason, key: string, snippet: string, score: number) => void): void {
  if (!entries.some((e) => e.appendix)) return;
  const place = squash(state.place ?? '');
  const present = [...(state.companions ?? []), ...state.deployed];
  entries.forEach((e, i) => {
    const a = e.appendix;
    if (!a) return;
    if (a.when.target && state.target && a.parentNames.some((n) => sameName(n, state.target))) add(i, 'status', state.target, state.target, 100);
    const w = place ? a.when.places.find((x) => squash(x) && place.includes(squash(x))) : undefined;
    if (w) add(i, 'place', w, state.place ?? '', 40);
    for (const group of a.agentNames) {
      const who = present.find((p) => group.some((n) => sameName(n, p)));
      if (who) add(i, 'agent', group[0], who, 20);
    }
  });
  const on = new Set([...picks.values()].map((p) => p.entry.name));
  entries.forEach((e, i) => {
    const a = e.appendix;
    if (a?.when.withParent && a.parent && on.has(a.parent)) add(i, 'parent', a.parent, a.parent, 10);
  });
  const parentOn = new Set([...picks.values()].filter((p) => !p.entry.appendix).map((p) => p.entry.name));
  const unlocked = new Set(state.unlocked ?? []);
  for (const [i, p] of picks) {
    const a = p.entry.appendix;
    if (!a) continue;
    if ((a.when.unlock && !unlocked.has(p.entry.name)) || (a.when.needParent && !parentOn.has(a.parent))) picks.delete(i);
  }
}

/** 해금 전인 부록 중 본 항목이 켜진 것 (모델에게 해금 조건만 알린다) */
export function lockedAppendices(entries: ManagedEntry[], picks: LorePick[], unlocked: string[]): ManagedEntry[] {
  const on = new Set(picks.map((p) => p.entry.name));
  const done = new Set(unlocked);
  return entries.filter((e) => e.appendix?.when.unlock && !done.has(e.name) && e.appendix.parent && on.has(e.appendix.parent));
}

/** 해금 안내 한 줄 (본 항목과 같은 자리에) */
export function unlockHint(e: ManagedEntry): string {
  return `[Locked appendix: 「${e.name}」] Hidden information about ${e.appendix!.parent} that no character knows yet. Unlock it when this happens in the story: ${e.appendix!.when.unlock}\n`
    + `Do not invent, reveal, or hint at the hidden information before it is unlocked. In the one reply where the condition is clearly met, write [🔓|${e.name}] on its own line at the very end.`;
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
  return sortPicks(out);
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
  /** 본 항목은 켜졌지만 해금 전이라 조건만 알린 부록 */
  locked: ManagedEntry[];
}

/** 이번 요청에 넣을 로어북과 채팅 변수 */
export function computeLore(lore: LoreEntry[] | undefined, chat: Chat, o: LoreOptions & { mode: LoreMode; input?: string }): LoreResult | null {
  const entries = managedEntries(lore).filter((e) => !o.exclude?.includes(e.name));
  if (!entries.length) return null;
  const msgs = loreMessages(chat, o.input, o.mode === 'risu');
  const picks = o.mode === 'risu' ? pickLoreRisu(entries, msgs, o.depth) : pickLore(entries, msgs, loreState(chat), o, msgs.at(-1)?.role === 'user');
  // Risu가 직접 켤 때는 자리를 비운다 (picks는 확인 화면에 보일 Risu 방식 추정).
  // 자리 항목이 없는 카드의 가상 항목(플러그인 세계 데이터)은 Risu가 볼 수 없으니, Risu 방식으로 고른 것을 플러그인이 끼운다 (QC 2026-10-28)
  const books = lore ?? [];
  const texts = o.mode === 'risu' ? (hasSlots(books) ? null : slotTexts(picks.filter((p) => isVirtual(books[p.entry.index])), o.env)) : slotTexts(picks, o.env);
  const locked = texts ? lockedAppendices(entries, picks, readUnlocked(chat.scriptstate)) : [];
  for (const e of locked) texts![e.kind] = [texts![e.kind], unlockHint(e)].filter(Boolean).join('\n\n');
  return { picks, vars: Object.fromEntries(LORE_KINDS.map((k) => [slotVar(k), texts?.[k] ?? ''])), locked };
}

/** 채팅 변수가 이미 이 값인지 (같으면 저장하지 않는다) */
export const sameVars = (ss: Record<string, unknown> | undefined, vars: Record<string, string>) =>
  Object.entries(vars).every(([k, v]) => String(ss?.[k] ?? '') === v);

/** 카드 로어북 설정(검색 깊이·토큰 예산)으로 고르기 설정. 예산은 늘 켜진 다른 로어북 몫을 뺀 나머지 (Risu가 자리 항목을 통째로 빼지 않게) */
export function loreOptions(char: { name?: string; globalLore?: LoreEntry[]; loreSettings?: unknown }, chat: Chat, mode: LoreMode, user = ''): LoreOptions & { mode: LoreMode } {
  const ls = (char.loreSettings ?? {}) as { scanDepth?: unknown; tokenBudget?: unknown };
  const depth = Number(ls.scanDepth) > 0 ? Number(ls.scanDepth) : DEFAULT_DEPTH;
  const total = Number(ls.tokenBudget) > 0 ? Number(ls.tokenBudget) : DEFAULT_BUDGET;
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
 * 다시 굴리기처럼 입력 처리를 거치지 않은 요청을 맞춘다. 비어 있던 자리는 요청에서 찾을 수 없어서,
 * 이웃 자리 글(앞 자리 뒤, 없으면 뒷자리 앞)에 붙여 넣는다. 이웃도 모두 비어 있으면 그대로 둔다
 */
export function patchSlots<M extends { content?: unknown }>(messages: M[], old: Record<string, unknown> | undefined, next: Record<string, string>): { messages: M[]; changed: number } {
  let changed = 0;
  let out = messages;
  const vars = LORE_KINDS.map(slotVar);
  /** 지금 요청에 들어 있는 자리마다의 글 */
  const cur = vars.map((k) => String(old?.[k] ?? ''));
  const find = (text: string) => (text ? out.findIndex((m) => typeof m?.content === 'string' && m.content.includes(text)) : -1);
  const swap = (at: number, from: string, to: string) => {
    out = out.map((m, i) => (i === at ? { ...m, content: (m.content as string).replace(from, () => to) } : m));
  };
  vars.forEach((k, i) => {
    if (!(k in next)) return;
    const v = next[k];
    const prev = cur[i];
    if (prev === v) return;
    if (prev) {
      const at = find(prev);
      if (at < 0) return;
      swap(at, prev, v);
    } else {
      const before = [...cur.slice(0, i)].reverse().find((t) => t && find(t) >= 0);
      const after = cur.slice(i + 1).find((t) => t && find(t) >= 0);
      if (before) swap(find(before), before, `${before}\n\n${v}`);
      else if (after) swap(find(after), after, `${v}\n\n${after}`);
      else return;
    }
    cur[i] = v;
    changed++;
  });
  return { messages: out, changed };
}

/**
 * 🙂Roster의 한 줄 소개 중, 같은 요청에 전체 로어북(「### Character - 이름」)이 들어간 인물 줄을 뺀다.
 * 같은 인물을 두 번 읽히지 않게 (토큰 절약). 어느 방식으로 들어갔든 요청 속 제목으로 판단한다
 */
export function trimRoster<M extends { content?: unknown }>(messages: M[]): M[] {
  const names = new Set<string>();
  for (const m of messages) {
    if (typeof m?.content !== 'string') continue;
    for (const x of m.content.matchAll(/^###\s*Character\s*-\s*(.+?)\s*$/gm)) names.add(x[1].toLowerCase());
  }
  if (!names.size) return messages;
  return messages.map((m) => {
    const c = m?.content;
    if (typeof c !== 'string' || !c.includes('## Roster')) return m;
    // 「## Roster」부터 다음 「## 」 제목 전까지만 (같은 메시지에 다른 로어북이 붙어 있어도 건드리지 않게)
    const next = c.replace(/^## Roster\n[\s\S]*?(?=^## |(?![\s\S]))/m, (sec) =>
      sec.replace(/^- ([^(\n]+?) \([^\n]*\n?/gm, (line, name: string) => (names.has(name.trim().toLowerCase()) ? '' : line)));
    return next === c ? m : { ...m, content: next };
  });
}

// ── 요청에 직접 끼우기 (자리 로어북 없는 카드, 2026-10-27) ──

export interface LoreBlockPart {
  /** Risu 로어북 순서와 같은 자리 번호 (Tag 100 · Faction 101 · Roster 102 · 세력 200 · 시드 399 · 특수 400 · 괴이 500 · 요원 600) */
  order: number;
  text: string;
}

/** 고른 로어 글을 자리 번호와 함께 (slotTexts 의 결과를 순서대로) */
export function slotParts(texts: Record<LoreKind, string>): LoreBlockPart[] {
  return LORE_KINDS.filter((k) => texts[k]?.trim()).map((k) => ({ order: SLOTS[k].order, text: texts[k].trim() }));
}

/** 자리 번호 순으로 이어 한 덩어리 글 */
export function joinLoreBlock(parts: LoreBlockPart[]): string {
  return parts
    .filter((p) => p.text.trim())
    .sort((a, b) => a.order - b.order)
    .map((p) => p.text.trim())
    .join('\n\n');
}

/**
 * 로어 덩어리를 요청에 끼운다: 첫 대화 메시지(system 이 아닌 첫 메시지) 바로 앞, 없으면 맨 끝.
 * Risu 가 로어북을 넣던 자리(본 프롬프트 뒤·대화 앞)와 같다. 표식(LORE_MARK)으로 한 번만 끼운다
 */
export const LORE_MARK = '<!-- goei:lore -->';
export function insertLoreBlock<M extends { role?: string; content?: unknown }>(messages: M[], block: string, firstChat?: string | string[]): M[] {
  if (!block.trim() || messages.some((m) => typeof m?.content === 'string' && m.content.startsWith(LORE_MARK))) return messages;
  const msg = { role: 'system', content: `${LORE_MARK}\n${block.trim()}` } as M;
  // 첫 대화 메시지: 첫 장면(인사말)이나 채팅의 첫 글이 들어 있는 메시지 (앞에 준 것부터). 못 찾으면 system 아닌 첫 메시지
  const keys = (Array.isArray(firstChat) ? firstChat : [firstChat]).map((k) => (k ?? '').trim().slice(0, 80)).filter(Boolean);
  let at = -1;
  for (const key of keys) {
    at = messages.findIndex((m) => m?.role !== 'system' && typeof m?.content === 'string' && m.content.includes(key));
    if (at >= 0) break;
  }
  if (at < 0) at = messages.findIndex((m) => m?.role !== 'system');
  return at < 0 ? [...messages, msg] : [...messages.slice(0, at), msg, ...messages.slice(at)];
}
