// 이름 → 정식 로어북 찾기. 원본 WG.registry / resolve / termPresent / referenceEntries와 같은 규칙.
// 카드 명부(숨긴 항목 포함)와 World catalog 랜드마크의 표시명·영문명·로어북명·별칭을 모두 쓴다.
import type { LoreEntry } from '../types';
import { readDirectory } from './directory';

export interface RegistryEntry {
  key: string;
  name: string;
  /** 정식 로어북 이름 (없으면 '') */
  lore: string;
  terms: string[];
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
  const places = { 괴이: dir.anomalies, '미스틱 사이트': dir.sites };
  for (const [group, rows] of Object.entries(places)) {
    rows.forEach((p, i) => add(`World catalog/${group}/${i + 1}`, p.label, p.lore, [p.english, ...p.aliases]));
  }
  dir.bases.forEach((b, i) => add(`거점/${i + 1}`, b.name, b.lore, [b.english, b.label, ...b.aliases]));
  for (const a of dir.agents) add(`Agent roster/${a.id}`, a.name, a.lore, [a.english, ...a.aliases, ...a.legacyEnglish]);
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

/** 글에 이름이 나온 모든 항목 (키 순) */
export function referenceEntries(r: Registry, content: string): RegistryEntry[] {
  const found = new Map<string, RegistryEntry>();
  for (const [term, list] of r.byTerm) {
    if (!termPresent(content, term)) continue;
    for (const e of list) found.set(e.key, e);
  }
  return [...found.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}
