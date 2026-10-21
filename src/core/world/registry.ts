// 이름 → 정식 로어북 찾기. 원본 WG.registry / resolve / termPresent / referenceEntries와 같은 규칙.
// 카드 명부(숨긴 항목 포함)와 World catalog 랜드마크의 표시명·영문명·로어북명·별칭을 모두 쓴다.
import type { LoreEntry } from '../types';
import { orgLoreName, readDirectory } from './directory';

export interface RegistryEntry {
  key: string;
  name: string;
  /** 정식 로어북 이름 (없으면 '') */
  lore: string;
  terms: string[];
  /** 성을 뗀 두 글자 이름처럼 흔한 낱말과 겹치는 이름 (유리·도형·성주). 글에서 찾을 때는 호칭이 붙어야 친다 */
  weak?: string[];
}

export interface Registry {
  entries: RegistryEntry[];
  byTerm: Map<string, RegistryEntry[]>;
  byLore: Map<string, RegistryEntry[]>;
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown) => (Array.isArray(v) ? v.map(s).filter(Boolean) : []);

function json(lore: LoreEntry[], comment: string): Record<string, unknown> | null {
  const raw = lore.find((e) => e.comment === comment)?.content;
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function buildRegistry(lore: LoreEntry[] | undefined): Registry {
  const books = lore ?? [];
  const entries: RegistryEntry[] = [];
  const add = (key: string, name: string, loreName: string, terms: string[]) => {
    const uniq = [...new Set([name, loreName, ...terms].map((t) => t.trim()).filter(Boolean))];
    entries.push({ key, name, lore: loreName, terms: uniq });
  };
  const dir = readDirectory(books);
  // 별칭 거르기 (2026-10-21 점검): 원본 명부의 별칭에는 소속·부서·다른 항목 이름이 섞여 있어서
  // 「관리국」 한 마디에 요원 26명 로어북이, 「백일몽」에 16명이 괴담넷·괴담톡·위키 요청에 딸려 들어갔다.
  // 조직·부서·직급 이름과 다른 항목의 정식 이름은 그 항목만 가리키는 이름이 아니라서 별칭으로 쓰지 않는다.
  const low = (t: string) => t.trim().toLowerCase();
  const shared = new Set<string>();
  for (const o of dir.orgs) for (const t of [o.name, o.spec.english ?? '', orgLoreName(books, o.name)]) if (t) shared.add(low(t));
  for (const a of dir.agents) for (const t of [a.department, a.rank, a.group]) if (t) shared.add(low(t));
  // 둘 이상의 항목이 같이 쓰는 별칭(현장탐사팀, Field Exploration Team, Vampire)도 그 무리 이름이지 한 항목의 이름이 아니다
  const seen = new Map<string, number>();
  for (const list of [...dir.anomalies, ...dir.sites, ...dir.agents].map((r) => r.aliases)) for (const t of new Set(list.map(low))) seen.set(t, (seen.get(t) ?? 0) + 1);
  for (const [t, n] of seen) if (n > 1) shared.add(t);
  const own = new Map<string, string>();
  const claim = (t: string, key: string) => t && !own.has(low(t)) && own.set(low(t), key);
  dir.anomalies.forEach((p, i) => [p.label, p.lore].forEach((t) => claim(t, `an${i}`)));
  dir.sites.forEach((p, i) => [p.label, p.lore].forEach((t) => claim(t, `ms${i}`)));
  dir.bases.forEach((b, i) => claim(b.name, `lm${i}`));
  dir.agents.forEach((a) => [a.name, a.lore].forEach((t) => claim(t, `ag${a.id}`)));
  const aliasesOf = (list: string[], key: string) => list.filter((t) => !shared.has(low(t)) && (own.get(low(t)) ?? key) === key);
  const places = { 괴이: dir.anomalies, '미스틱 사이트': dir.sites };
  const tag = { 괴이: 'an', '미스틱 사이트': 'ms' } as const;
  for (const [group, rows] of Object.entries(places)) {
    rows.forEach((p, i) => add(`World catalog/${group}/${i + 1}`, p.label, p.lore, [p.english, ...aliasesOf(p.aliases, `${tag[group as keyof typeof tag]}${i}`)]));
  }
  // 거점 로어북이 비면 연결 조직의 로어북 (거점에서 걸든 조직에서 걸든 같은 칸 b.org). 거점 별칭은 조직 이름이어도 둔다 (거점이 곧 그 조직 자리)
  dir.bases.forEach((b, i) => add(`거점/${i + 1}`, b.name, b.lore || (b.org ? orgLoreName(books, b.org) : ''), [b.english, b.label, ...b.aliases.filter((t) => (own.get(low(t)) ?? `lm${i}`) === `lm${i}`)]));
  for (const a of dir.agents) add(`Agent roster/${a.id}`, a.name, a.lore, [a.english, ...aliasesOf(a.aliases, `ag${a.id}`), ...a.legacyEnglish]);
  // 성을 뗀 이름 (고연지 → 연지): 본편 로어북 고르기(core/lore.ts)와 같은 「보조 키」 규칙
  for (const e of entries) {
    if (!e.key.startsWith('Agent roster/')) continue;
    const full = [e.name, e.lore].filter((t) => /[가-힣]/.test(t) && t.replace(/\s+/g, '').length >= 3);
    const weak = e.terms.filter((t) => /^[가-힣]{2}$/.test(t) && full.some((f) => f.replace(/\s+/g, '').includes(t)));
    if (weak.length) e.weak = weak;
  }
  const byTerm = new Map<string, RegistryEntry[]>();
  const byLore = new Map<string, RegistryEntry[]>();
  for (const e of entries) {
    if (e.lore) byLore.set(e.lore.toLowerCase(), [...(byLore.get(e.lore.toLowerCase()) ?? []), e]);
    for (const t of e.terms) byTerm.set(t.toLowerCase(), [...(byTerm.get(t.toLowerCase()) ?? []), e]);
  }
  return { entries, byTerm, byLore };
}

export function resolveName(r: Registry, name: string): RegistryEntry[] {
  const key = name.trim().toLowerCase();
  return r.byLore.get(key) ?? r.byTerm.get(key) ?? [];
}

export function searchRegistry(r: Registry, query: string): RegistryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return r.entries.filter((e) => e.terms.some((t) => t.toLowerCase().includes(q)));
}

// 한국어 이름 뒤에 붙어도 되는 조사·호칭 (원본 목록 그대로)
const SUFFIXES = ['님께서는', '님께서', '님에게', '선배님', '선배', '에게서', '에게는', '에게', '한테', '에서는', '에서', '으로는', '으로', '이랑', '처럼', '보다', '까지', '부터', '마저', '조차', '밖에', '께서', '께', '이는', '이가', '이야', '은', '는', '가', '를', '을', '와', '과', '랑', '의', '씨', '님', '야', '아', '이', '도', '만', '에', '로'];
const isWord = (c: string) => c !== '' && /[\p{L}\p{N}_]/u.test(c);

/** 글 속에 그 이름이 단어로 들어 있는지 (뒤에 조사는 허용) */
export function termPresent(content: string, term: string): boolean {
  if (!content || !term) return false;
  const hay = content.toLowerCase();
  const needle = term.toLowerCase();
  let from = 0;
  for (;;) {
    const a = hay.indexOf(needle, from);
    if (a < 0) return false;
    const b = a + needle.length;
    const left = a === 0 ? '' : hay[a - 1];
    if (!isWord(left)) {
      if (!isWord(hay[b] ?? '')) return true;
      const tail = hay.slice(b);
      if (SUFFIXES.some((sfx) => tail.startsWith(sfx) && !isWord(tail[sfx.length] ?? ''))) return true;
    }
    from = a + 1;
  }
}

const HONOR = ['님', '씨', '쌤', '선배', '언니', '오빠', '누나', '형', '아', '야', '팀장', '대리', '과장', '주임', '사원', '반장', '이사', '전무', '원장', '요원'];

/** 성을 뗀 두 글자 이름이 사람을 부르는 꼴로 쓰였는지 (연지 씨, 연지야, 도형 대리) */
function calledByName(content: string, term: string): boolean {
  const hay = content.toLowerCase();
  for (let a = hay.indexOf(term); a >= 0; a = hay.indexOf(term, a + 1)) {
    if (a > 0 && isWord(hay[a - 1])) continue;
    const tail = hay.slice(a + term.length).replace(/^\s/, '');
    if (HONOR.some((h) => tail.startsWith(h))) return true;
  }
  return false;
}

/** 글에 이름이 나온 모든 항목 (키 순) */
export function referenceEntries(r: Registry, content: string): RegistryEntry[] {
  const found = new Map<string, RegistryEntry>();
  for (const [term, list] of r.byTerm) {
    if (!termPresent(content, term)) continue;
    for (const e of list) if (!e.weak?.includes(term) || calledByName(content, term)) found.set(e.key, e);
  }
  return [...found.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}
