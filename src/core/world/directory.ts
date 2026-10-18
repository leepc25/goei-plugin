// 카드 명부: 로어북 폴더(🚧괴이·🎁파밍·🙂요원)에서 괴이·미스틱 사이트·요원을 모으고, 요원 소속은 조직 목록에서 고른다.
// 세부값은 「Directory」 로어북(옛 이름 「괴이봇 명부」, 플러그인 창에서 편집)에서 읽는다.
// 값의 우선순위: 명부 > 옛 World catalog / Agent roster 줄 > 로어북 키에서 추정.
// 세력 호칭·괴담톡 탭·첫 턴 로어북도 명부에 두고, 옛 카드는 Faction display·Phone tabs·Start trigger에서 읽는다.
// 폴더가 없는 카드는 옛 목록 그대로 쓴다.
import { BUILTIN, extraFactions, extraNames, extraTabId, extraTabs, type FactionSpec, pickSpec } from '../factions';
import { DIRECTORY_COMMENT, directoryEntries, isDirectory, LEGACY_DATA, parseSeedManifest } from '../lorebooks';
import type { LoreEntry } from '../types';

export { DIRECTORY_COMMENT } from '../lorebooks';
export const DIRECTORY_SCHEMA = 1;

export type PlaceKind = 'anomaly' | 'site';

export interface PlaceRow {
  /** 로어북 이름(comment). 명부의 열쇠 */
  lore: string;
  /** 상황판·지도에 보일 이름 */
  label: string;
  english: string;
  aliases: string[];
  /** 무작위 발생 후보(프리셋 노출) */
  preset: boolean;
  inFolder: boolean;
  /** 위키 사진 에셋 이름 (비우면 영문명으로 찾는다) */
  photo?: string;
}

export interface AgentRow {
  lore: string;
  id: string;
  name: string;
  english: string;
  aliases: string[];
  legacyEnglish: string[];
  /** A00~E00 또는 조직 이름 */
  affiliation: string;
  rank: string;
  department: string;
  /** 요원풀을 보여 줄 유저 소속 */
  rosterFor: string[];
  /** 괴담톡 연락처 탭 */
  phoneTabs: string[];
  /** 폴더 안 구분선 이름 (예: 관리국). 조직을 짐작할 때 참고만 한다. 없으면 '' */
  group: string;
  inFolder: boolean;
  /** 사진 에셋 이름 (비우면 영문명으로 찾는다) */
  photo?: string;
}

/** 지도 거점. 조직의 본거지이거나(org) 조직과 무관한 장소(org = '') */
export interface BaseRow {
  /** 표시명. 명부의 열쇠 */
  name: string;
  /** 지도 표시명 (비면 표시명) */
  label: string;
  /** 위키 문서로 이어질 로어북 이름 (없으면 '') */
  lore: string;
  english: string;
  aliases: string[];
  /** 조직 이름 (orgAffiliation이 아니라 OrgRow.name). 무관하면 '' */
  org: string;
  /** 시도 코드 (02 = 서울) */
  sido: string;
  gu: string;
  /** 지역 지도 위 위치 (%) */
  x: number;
  y: number;
  show: boolean;
}

export interface Directory {
  anomalies: PlaceRow[];
  sites: PlaceRow[];
  agents: AgentRow[];
  orgs: OrgRow[];
  bases: BaseRow[];
  /** 요원 폴더의 구분선 이름 순서 */
  groups: string[];
  refill: number;
  /** 카드에 명부 폴더가 하나라도 있는지 */
  folders: boolean;
  /** 명부 로어북이 있는지 */
  saved: boolean;
  /** 지금까지 새 세력에 준 코드 (지워도 다시 쓰지 않는다) */
  usedCodes: string[];
  /** 내 소속(또는 none) → 소속 코드 → 부르는 이름 */
  display: Record<string, Record<string, string>>;
  phoneTabs: PhoneTabsData;
  /** 「A00-1」 같은 시작 조합 → 첫 턴에 실을 로어북 이름 */
  seeds: Record<string, string[]>;
}

export interface PhoneTabData {
  id: string;
  name: string;
  name_by_faction?: Record<string, string>;
  visible_for: string[];
}
export interface PhoneTabsData {
  order_by_faction?: Record<string, string[]>;
  tabs: PhoneTabData[];
}

export interface PlaceData {
  preset?: boolean;
  label?: string;
  english?: string;
  aliases?: string[];
  photo?: string;
}
export interface AgentData {
  id?: string;
  name?: string;
  english?: string;
  aliases?: string[];
  legacy_english?: string[];
  affiliation?: string;
  rank?: string;
  department?: string;
  roster_for?: string[];
  phone_tabs?: string[];
  photo?: string;
}
export interface BaseData {
  label?: string;
  lore?: string;
  english?: string;
  aliases?: string[];
  org?: string;
  sido: string;
  gu: string;
  x: number;
  y: number;
  show?: boolean;
}
export interface DirectoryData {
  schema: number;
  refill?: number;
  괴이?: Record<string, PlaceData>;
  '미스틱 사이트'?: Record<string, PlaceData>;
  요원?: Record<string, AgentData>;
  조직?: Record<string, OrgData>;
  거점?: Record<string, BaseData>;
  호칭?: Record<string, Record<string, string>>;
  '괴담톡 탭'?: PhoneTabsData;
  '시작 로어북'?: Record<string, string[]>;
  /** 새 세력에 준 적 있는 코드 */
  codes_used?: string[];
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown) => (Array.isArray(v) ? v.map(s).filter(Boolean) : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const squash = (t: string) => t.replace(/\s+/g, '').toLowerCase();
const ascii = (t: string) => /^[\x20-\x7e]+$/.test(t) && /[A-Za-z]/.test(t);

function parse(raw: unknown): unknown {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    return JSON.parse(raw.replace(/^﻿/, '').trim().replace(/^```[\w-]*\s*\n/, '').replace(/\n\s*```\s*$/, ''));
  } catch {
    return null;
  }
}

function book(lore: LoreEntry[], comment: string): unknown {
  const parts = lore.filter((e) => e.comment === comment && typeof e.content === 'string' && e.content.trim());
  return parts.length ? parse(parts.map((e) => e.content).join('\n')) : null;
}

const dataCache = new WeakMap<LoreEntry[], DirectoryData | null>();

export function readDirectoryData(lore: LoreEntry[]): DirectoryData | null {
  if (dataCache.has(lore)) return dataCache.get(lore)!;
  const parts = directoryEntries(lore).filter((e) => typeof e.content === 'string' && e.content.trim());
  const d = obj(parts.length ? parse(parts.map((e) => e.content).join('\n')) : null);
  const out = d.schema === DIRECTORY_SCHEMA ? (d as unknown as DirectoryData) : null;
  dataCache.set(lore, out);
  return out;
}

// ── 세력 호칭·괴담톡 탭·첫 턴 로어북 (명부, 없으면 옛 로어북) ──

const strMap = (v: unknown): Record<string, string> => Object.fromEntries(Object.entries(obj(v)).map(([k, x]) => [k, s(x)]).filter(([, x]) => x));

export function displaySection(lore: LoreEntry[]): Record<string, Record<string, string>> {
  const d = readDirectoryData(lore)?.호칭;
  const raw = d && typeof d === 'object' ? d : obj(book(lore, 'Faction display'));
  const out: Record<string, Record<string, string>> = {};
  for (const [viewer, m] of Object.entries(obj(raw))) if (Object.keys(strMap(m)).length) out[viewer] = strMap(m);
  return out;
}

export function phoneTabsSection(lore: LoreEntry[]): PhoneTabsData {
  const saved = readDirectoryData(lore)?.['괴담톡 탭'];
  const d = saved && typeof saved === 'object' ? obj(saved) : obj(book(lore, 'Phone tabs'));
  const tabs = (Array.isArray(d.tabs) ? (d.tabs as unknown[]) : []).map(obj).map((t) => {
    const tab: PhoneTabData = { id: s(t.id), name: s(t.name), visible_for: list(t.visible_for) };
    const by = strMap(t.name_by_faction);
    if (Object.keys(by).length) tab.name_by_faction = by;
    return tab;
  }).filter((t) => /^[TX]\d+$/.test(t.id));
  const order = Object.fromEntries(Object.entries(obj(d.order_by_faction)).map(([k, v]) => [k, list(v)]).filter(([, v]) => v.length));
  return Object.keys(order).length ? { order_by_faction: order, tabs } : { tabs };
}

export function seedSection(lore: LoreEntry[]): Record<string, string[]> {
  const saved = readDirectoryData(lore)?.['시작 로어북'];
  if (saved && typeof saved === 'object') return Object.fromEntries(Object.entries(obj(saved)).map(([k, v]) => [k, list(v)]));
  const raw = lore.filter((e) => e.comment === 'Start trigger' && typeof e.content === 'string').map((e) => e.content).join('\n');
  return Object.fromEntries(parseSeedManifest(raw));
}

const FOLDER_WORDS: Record<'anomaly' | 'site' | 'agent', string> = { anomaly: '괴이', site: '파밍', agent: '요원' };

/** 폴더 이름에서 이모지·기호를 떼고 본다 (🚧괴이 → 괴이) */
const folderWord = (name: string) => name.replace(/[^\p{L}\p{N}]/gu, '');

const isFolder = (e: LoreEntry) => e.mode === 'folder';
const SEPARATOR = /^\s*-{2,}\s*(.*?)\s*-{2,}\s*$/;

/** 폴더별 소속 로어북 (폴더 안 순서 그대로). 구분선은 요원 폴더에서만 의미가 있다 */
export function folderMembers(lore: LoreEntry[]): Record<'anomaly' | 'site' | 'agent', LoreEntry[]> | null {
  const keys: Partial<Record<'anomaly' | 'site' | 'agent', string>> = {};
  for (const e of lore) {
    if (!isFolder(e)) continue;
    const w = folderWord(s(e.comment));
    for (const k of Object.keys(FOLDER_WORDS) as ('anomaly' | 'site' | 'agent')[]) {
      if (w === FOLDER_WORDS[k] && !keys[k] && typeof e.key === 'string') keys[k] = e.key;
    }
  }
  if (!keys.anomaly && !keys.site && !keys.agent) return null;
  const pick = (k?: string) => (k ? lore.filter((e) => !isFolder(e) && e.folder === k && s(e.comment)) : []);
  return { anomaly: pick(keys.anomaly), site: pick(keys.site), agent: pick(keys.agent) };
}

function keysOf(e: LoreEntry | undefined): string[] {
  if (!e) return [];
  return [s(e.key), s(e.secondkey)].join(',').split(',').map((t) => t.trim()).filter(Boolean);
}

/** 영문명 추정: 키 중 처음 나오는 영문 */
function guessEnglish(e: LoreEntry | undefined): string {
  return keysOf(e).find(ascii) ?? '';
}

// ── 옛 목록 ──

interface LegacyPlace extends PlaceRow {}

function legacyPlaces(lore: LoreEntry[], group: '괴이' | '미스틱 사이트'): LegacyPlace[] {
  const world = obj(book(lore, 'World catalog'));
  const rows = Array.isArray(world[group]) ? (world[group] as unknown[]) : [];
  const out: LegacyPlace[] = [];
  for (const r of rows) {
    if (!Array.isArray(r) || r.length !== 5) continue;
    const label = s(r[1]);
    if (!label) continue;
    out.push({ lore: s(r[2]) || label, label, english: s(r[3]), aliases: list(r[4]), preset: r[0] === true, inFolder: false });
  }
  return out;
}

/** 옛 World catalog의 랜드마크 줄 (노출, 표시명, 지도 표시명, 정식 로어북명, 영문명, 지역, 구, X, Y, 별칭) */
function legacyBases(lore: LoreEntry[]): (BaseRow & { hint: string[] })[] {
  const world = obj(book(lore, 'World catalog'));
  const rows = Array.isArray(world['랜드마크']) ? (world['랜드마크'] as unknown[]) : [];
  const out: (BaseRow & { hint: string[] })[] = [];
  for (const r of rows) {
    if (!Array.isArray(r) || r.length !== 10 || !s(r[1])) continue;
    out.push({
      name: s(r[1]), label: s(r[2]), lore: s(r[3]), english: s(r[4]), aliases: list(r[9]), org: '',
      sido: s(r[5]), gu: s(r[6]), x: Number(r[7]), y: Number(r[8]), show: r[0] === true, hint: [s(r[3]), s(r[2]), s(r[1])].filter(Boolean),
    });
  }
  return out;
}

const num = (v: unknown, d = 50) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : d);

/** 명부의 거점 (있으면), 없으면 옛 World catalog 줄에서 조직을 짐작해 옮긴다 */
function buildBases(lore: LoreEntry[], data: DirectoryData | null, orgs: OrgRow[]): BaseRow[] {
  const orgName = (v: unknown) => {
    const n = s(v);
    return n && orgs.some((o) => o.name === n) ? n : '';
  };
  if (data && data.거점 && typeof data.거점 === 'object') {
    return Object.entries(obj(data.거점)).filter(([name]) => s(name)).map(([name, raw]) => {
      const d = obj(raw);
      return {
        name: s(name), label: s(d.label), lore: s(d.lore), english: s(d.english), aliases: list(d.aliases), org: orgName(d.org),
        sido: s(d.sido), gu: s(d.gu), x: num(d.x), y: num(d.y), show: d.show !== false,
      };
    });
  }
  const names = factionDisplayNames(lore);
  return legacyBases(lore).map(({ hint, ...b }) => {
    const k = hint.map(squash);
    const o =
      orgs.find((x) => k.includes(squash(x.name))) ??
      orgs.find((x) => x.faction && k.includes(squash(names[x.faction] ?? ''))) ??
      orgs.find((x) => x.spec.title && k.includes(squash(x.spec.title)));
    return { ...b, org: o?.name ?? '' };
  });
}

function legacyAgents(lore: LoreEntry[]): { rows: AgentRow[]; refill: number | null } {
  const roster = obj(book(lore, 'Agent roster'));
  const chars = Array.isArray(roster.characters) ? (roster.characters as unknown[]) : [];
  const rows: AgentRow[] = [];
  for (const c of chars.map(obj)) {
    const name = s(c.name);
    if (!name) continue;
    rows.push({
      lore: s(c.lore) || name, id: s(c.id), name, english: s(c.english), aliases: list(c.aliases), legacyEnglish: list(c.legacy_english),
      affiliation: s(c.affiliation), rank: s(c.rank), department: s(c.department), rosterFor: list(c.roster_for), phoneTabs: list(c.phone_tabs),
      group: '', inFolder: false,
    });
  }
  const refill = Number.isInteger(roster.refill) && (roster.refill as number) >= 0 ? (roster.refill as number) : null;
  return { rows, refill };
}

/** 폴더 로어북에 맞는 옛 줄: 로어북 이름 → 표시명 → 별칭 (띄어쓰기 무시) */
function matchLegacy<T extends { lore: string; label?: string; name?: string; aliases: string[] }>(rows: T[], lore: string, used: Set<T>): T | undefined {
  const k = squash(lore);
  const tests: ((r: T) => boolean)[] = [
    (r) => r.lore === lore,
    (r) => squash(r.lore) === k,
    (r) => squash(r.label ?? r.name ?? '') === k,
    (r) => r.aliases.some((a) => squash(a) === k),
  ];
  for (const t of tests) {
    const hit = rows.find((r) => !used.has(r) && t(r));
    if (hit) return hit;
  }
  return undefined;
}

// ── 새 요원의 처음 값 ──

export interface TabInfo {
  id: string;
  name: string;
  visibleFor: string[];
}

export function phoneTabs(lore: LoreEntry[]): TabInfo[] {
  const out = phoneTabsSection(lore).tabs.map((t) => ({ id: t.id, name: t.name, visibleFor: [...t.visible_for] }));
  // 새 세력: 기본 다섯 세력 모두에게 열린 탭은 새 세력에도 열고, 전용 탭을 덧붙인다 (phone.ts tabCatalog와 같음)
  const extra = extraFactions(lore).map((f) => f.code);
  if (!extra.length) return out;
  for (const t of out) if (BUILTIN.every((f) => t.visibleFor.includes(f))) t.visibleFor.push(...extra.filter((f) => !t.visibleFor.includes(f)));
  for (const t of extraTabs(lore)) if (!out.some((x) => x.id === t.id)) out.push(t);
  return out;
}

/** 기본 플레이 세력 코드 (요원 소속에 코드로 들어가는 세력) */
export const FACTIONS = BUILTIN;

export function factionDisplayNames(lore: LoreEntry[]): Record<string, string> {
  const m = displaySection(lore).none ?? {};
  const out: Record<string, string> = { A00: '관리국', B00: '가짜 관리국', C00: '백일몽', D00: '민간인', E00: '프리랜서' };
  for (const f of FACTIONS) if (s(m[f])) out[f] = s(m[f]);
  return { ...extraNames(lore), ...out };
}

/** 구분선 이름 → 소속 코드 (가장 긴 표시명이 들어 있는 쪽). 없으면 '' */
export function groupFaction(group: string, names: Record<string, string>): string {
  let best = '';
  let len = 0;
  for (const f of FACTIONS) {
    const n = names[f];
    if (n && group.includes(n) && n.length > len) {
      best = f;
      len = n.length;
    }
  }
  return best;
}

// ── 조직 ──
// 요원의 소속(affiliation)은 다섯 플레이 세력 코드(A00~E00)이거나 조직 이름이다.
// 조직마다 요원 목록에 보일 세력·괴담톡 탭의 처음 값을 두고, 요원에게 조직을 고르면 그 값이 들어간다.

export interface OrgRow {
  name: string;
  /** 기본 플레이 세력 조직이면 그 코드, 아니면 ''. 요원 소속에는 이 코드가 들어간다 */
  faction: string;
  rosterFor: string[];
  phoneTabs: string[];
  /** 시작 화면·세력 값 (새 세력은 code·playable, 기본 세력은 이름·설명·사진·숨김) */
  spec: FactionSpec;
}

export interface OrgData extends FactionSpec {
  roster_for?: string[];
  phone_tabs?: string[];
}

export const orgAffiliation = (o: OrgRow) => o.faction || o.name;

export function orgOf(orgs: OrgRow[], affiliation: string): OrgRow | undefined {
  return affiliation ? orgs.find((o) => (o.faction ? o.faction === affiliation : o.name === affiliation)) : undefined;
}

/** 가장 많이 쓰인 값 (같으면 먼저 나온 것) */
function mode(values: string[][]): string[] | null {
  const n = new Map<string, number>();
  for (const v of values) n.set(JSON.stringify(v), (n.get(JSON.stringify(v)) ?? 0) + 1);
  let best: string | null = null;
  for (const [k, c] of n) if (best === null || c > n.get(best)!) best = k;
  return best === null ? null : (JSON.parse(best) as string[]);
}

function orgDefaults(code: string, tabs: TabInfo[]): { rosterFor: string[]; phoneTabs: string[] } {
  if (code) {
    const own = tabs.find((t) => t.id.startsWith('T') && t.visibleFor.length === 1 && t.visibleFor[0] === code);
    return { rosterFor: code === 'D00' || code === 'E00' ? ['D00', 'E00'] : [code], phoneTabs: own ? [own.id] : [] };
  }
  const open = tabs.find((t) => t.id.startsWith('T') && FACTIONS.every((f) => t.visibleFor.includes(f)));
  return { rosterFor: ['D00', 'E00'], phoneTabs: open ? [open.id] : [] };
}

// 조직 영문명 기본값 (📜Faction·조직 로어북에 쓰인 영어 이름). 위키 사진은 「영문명_default」 → 「영문명」 순으로 찾는다
const ORG_ENGLISH: Record<string, string> = {
  A00: 'Management Bureau', B00: 'Fake Management Bureau', C00: 'Baekilmong', D00: 'Civilian', E00: 'Freelancer',
  특수재난대응협회: 'Special Disaster Response Association', '중림 지하상가': 'Jungnim Underground Shopping Center', 교황청: 'Vatican',
  이슬람: 'Islam', 발푸르기스: 'Walpurgis Society', 흡혈귀: 'Vampires',
  무명찬란교: 'Mumyeong Chanrangyo', 극단: 'The Troupe', 병원: 'The Hospital', '세계정치 게시판': 'The World Politics Forum',
};

/** 로어북 폴더 「🌆세력」(또는 「조직」)의 항목들 */
function orgFolder(lore: LoreEntry[]): LoreEntry[] {
  const keys = new Set(lore.filter((e) => isFolder(e) && ['세력', '조직'].includes(folderWord(s(e.comment))) && typeof e.key === 'string').map((e) => e.key as string));
  return keys.size ? lore.filter((e) => !isFolder(e) && keys.has(String(e.folder ?? '')) && s(e.comment)) : [];
}

/** 조직 목록: 다섯 플레이 세력 → 명부에 적힌 조직 → 요원 소속에만 있는 조직 */
export function buildOrgs(lore: LoreEntry[], agents: AgentRow[], saved: Record<string, unknown>): OrgRow[] {
  const names = factionDisplayNames(lore);
  const tabs = phoneTabs(lore);
  const out: OrgRow[] = [];
  const make = (name: string, faction: string) => {
    const members = agents.filter((a) => a.affiliation === (faction || name));
    const d = obj(saved[name]);
    const spec = pickSpec(d);
    if (faction) {
      spec.code = faction;
      delete spec.playable;
    }
    if (!spec.english && ORG_ENGLISH[faction || name]) spec.english = ORG_ENGLISH[faction || name];
    const base = !faction && spec.playable && spec.code ? { rosterFor: [spec.code], phoneTabs: [extraTabId(spec.code)] } : orgDefaults(faction, tabs);
    out.push({
      name,
      faction,
      spec,
      rosterFor: Array.isArray(d.roster_for) ? list(d.roster_for) : (mode(members.map((m) => m.rosterFor)) ?? base.rosterFor),
      phoneTabs: Array.isArray(d.phone_tabs) ? list(d.phone_tabs) : (mode(members.map((m) => m.phoneTabs)) ?? base.phoneTabs),
    });
  };
  for (const f of FACTIONS) make(names[f], f);
  for (const name of Object.keys(saved)) if (s(name) && !out.some((o) => o.name === name)) make(name, '');
  for (const a of agents) if (a.affiliation && !orgOf(out, a.affiliation)) make(a.affiliation, '');
  // 세력 폴더에 넣은 로어북도 조직으로 (이름이 같거나 한쪽이 다른 쪽을 품으면 이미 있는 조직: 협회 ↔ 특수재난대응협회)
  for (const e of orgFolder(lore)) {
    const name = s(e.comment);
    const same = (o: OrgRow) => o.name === name || (Math.min(o.name.length, name.length) >= 2 && (o.name.includes(name) || name.includes(o.name)));
    if (out.some(same)) continue;
    make(name, '');
    const o = out[out.length - 1];
    if (!o.spec.english) {
      const en = guessEnglish(e);
      if (en) o.spec.english = en;
    }
  }
  return out;
}

/** 구분선 이름으로 조직 짐작 (참고용): 세력 표시명 → 같은 이름 → 이름이 들어 있는 조직(긴 것 우선) */
export function orgHint(group: string, orgs: OrgRow[], lore: LoreEntry[]): OrgRow | undefined {
  if (!group) return undefined;
  const code = groupFaction(group, factionDisplayNames(lore));
  if (code) return orgs.find((o) => o.faction === code);
  return orgs.find((o) => o.name === group) ?? [...orgs].sort((x, y) => y.name.length - x.name.length).find((o) => !o.faction && group.includes(o.name));
}

/** 요원에게 조직을 정한다: 소속과 요원 목록·괴담톡 탭이 조직 값으로 바뀐다 */
export function assignOrg(a: AgentRow, o: OrgRow | undefined): void {
  a.affiliation = o ? orgAffiliation(o) : '';
  a.rosterFor = o ? [...o.rosterFor] : [];
  a.phoneTabs = o ? [...o.phoneTabs] : [];
}

/** 저장된 ID가 없는 새 요원: 이름에서 정해지는 고정 ID (P10000~P99999) */
export function stableAgentId(lore: string, taken: Set<string>): string {
  let h = 2166136261;
  for (const ch of lore) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  let n = 10000 + (h % 90000);
  while (taken.has(`P${n}`)) n = n >= 99999 ? 10000 : n + 1;
  return `P${n}`;
}

// ── 합치기 ──

/** 순서: 명부에 적힌 순서 → 옛 목록 순서 → 새로 들어온 것(폴더 순서). 처음 옮겨도 요원 표시 순서가 그대로다 */
function ordered<T extends { lore: string }>(rows: T[], saved: string[], legacy: string[], legacyLore: Map<string, string>): T[] {
  const rank = (r: T, i: number) => {
    const a = saved.indexOf(r.lore);
    if (a >= 0) return a;
    const b = legacy.indexOf(legacyLore.get(r.lore) ?? r.lore);
    return b >= 0 ? 100000 + b : 200000 + i;
  };
  return rows.map((r, i) => [rank(r, i), i, r] as const).sort((x, y) => x[0] - y[0] || x[1] - y[1]).map((x) => x[2]);
}

const cache = new WeakMap<LoreEntry[], Directory>();

export function readDirectory(lore: LoreEntry[] | undefined): Directory {
  const books = lore ?? [];
  const hit = cache.get(books);
  if (hit) return hit;
  const data = readDirectoryData(books);
  const members = folderMembers(books);
  const exists = new Set(books.filter((e) => !isFolder(e)).map((e) => s(e.comment)));
  const byLore = new Map(books.filter((e) => !isFolder(e)).map((e) => [s(e.comment), e] as const));

  const places = (kind: PlaceKind): PlaceRow[] => {
    const group = kind === 'anomaly' ? '괴이' : '미스틱 사이트';
    const legacy = legacyPlaces(books, group);
    const saved = obj(data?.[group]);
    const folder = members?.[kind] ?? [];
    const used = new Set<LegacyPlace>();
    const legacyLore = new Map<string, string>();
    const out: PlaceRow[] = [];
    const seen = new Set<string>();
    const merge = (base: PlaceRow, d: Record<string, unknown>): PlaceRow => ({
      ...base,
      preset: typeof d.preset === 'boolean' ? d.preset : base.preset,
      label: s(d.label) || base.label,
      english: typeof d.english === 'string' ? s(d.english) : base.english,
      aliases: Array.isArray(d.aliases) ? list(d.aliases) : base.aliases,
      ...(s(d.photo) ? { photo: s(d.photo) } : {}),
    });
    for (const e of folder) {
      const name = s(e.comment);
      if (seen.has(name)) continue;
      seen.add(name);
      const old = matchLegacy(legacy, name, used);
      if (old) {
        used.add(old);
        legacyLore.set(name, old.lore);
      }
      const base: PlaceRow = old
        ? { ...old, lore: name, inFolder: true }
        : { lore: name, label: name, english: guessEnglish(e), aliases: [], preset: true, inFolder: true };
      out.push(merge(base, obj(saved[name])));
    }
    // 폴더 밖: 명부에 적힌 것(로어북이 있을 때) → 옛 목록에만 있는 것
    for (const [name, d] of Object.entries(saved)) {
      if (seen.has(name) || !exists.has(name)) continue;
      seen.add(name);
      const old = legacy.find((r) => !used.has(r) && r.lore === name);
      if (old) used.add(old);
      out.push(merge(old ?? { lore: name, label: name, english: guessEnglish(byLore.get(name)), aliases: [], preset: false, inFolder: false }, obj(d)));
    }
    for (const r of legacy) if (!used.has(r) && !seen.has(r.lore) && !(members?.[kind].length && data)) out.push(r);
    return ordered(out, Object.keys(saved), legacy.map((r) => r.lore), legacyLore);
  };

  const agents = (): { rows: AgentRow[]; groups: string[]; refill: number | null; orgs: OrgRow[] } => {
    const legacy = legacyAgents(books);
    const saved = obj(data?.요원);
    const used = new Set<AgentRow>();
    const legacyLore = new Map<string, string>();
    const fresh = new Set<AgentRow>();
    const out: AgentRow[] = [];
    const groups: string[] = [];
    const seen = new Set<string>();
    const merge = (base: AgentRow, d: Record<string, unknown>): AgentRow => ({
      ...base,
      id: /^P\d{3,}$/.test(s(d.id)) ? s(d.id) : base.id,
      name: s(d.name) || base.name,
      english: typeof d.english === 'string' ? s(d.english) : base.english,
      aliases: Array.isArray(d.aliases) ? list(d.aliases) : base.aliases,
      legacyEnglish: Array.isArray(d.legacy_english) ? list(d.legacy_english) : base.legacyEnglish,
      affiliation: typeof d.affiliation === 'string' ? s(d.affiliation) : base.affiliation,
      rank: typeof d.rank === 'string' ? s(d.rank) : base.rank,
      department: typeof d.department === 'string' ? s(d.department) : base.department,
      ...(s(d.photo) ? { photo: s(d.photo) } : {}),
      rosterFor: Array.isArray(d.roster_for) ? list(d.roster_for) : base.rosterFor,
      phoneTabs: Array.isArray(d.phone_tabs) ? list(d.phone_tabs) : base.phoneTabs,
    });
    let group = '';
    for (const e of members?.agent ?? []) {
      const name = s(e.comment);
      const sep = SEPARATOR.exec(name);
      if (sep) {
        group = sep[1].trim();
        if (group && !groups.includes(group)) groups.push(group);
        continue;
      }
      if (seen.has(name)) continue;
      seen.add(name);
      const old = matchLegacy(legacy.rows, name, used);
      if (old) {
        used.add(old);
        legacyLore.set(name, old.lore);
      }
      let base: AgentRow;
      if (old) base = { ...old, lore: name, group, inFolder: true };
      else base = { lore: name, id: '', name, english: guessEnglish(e), aliases: [], legacyEnglish: [], affiliation: '', rosterFor: [], phoneTabs: [], rank: '', department: '', group, inFolder: true };
      const row = merge(base, obj(saved[name]));
      if (!old && !saved[name]) fresh.add(row);
      out.push(row);
    }
    for (const [name, d] of Object.entries(saved)) {
      if (seen.has(name) || !exists.has(name)) continue;
      seen.add(name);
      const old = legacy.rows.find((r) => !used.has(r) && r.lore === name);
      if (old) used.add(old);
      out.push(merge(old ?? { lore: name, id: '', name, english: '', aliases: [], legacyEnglish: [], affiliation: '미분류', rosterFor: [], phoneTabs: [], rank: '', department: '', group: '', inFolder: false }, obj(d)));
    }
    for (const r of legacy.rows) if (!used.has(r) && !seen.has(r.lore) && !(members?.agent.length && data)) out.push(r);
    const sorted = ordered(out, Object.keys(saved), legacy.rows.map((r) => r.lore), legacyLore);
    out.splice(0, out.length, ...sorted);
    // ID 채우기: 겹치거나 없으면 이름에서 정한 고정 ID
    const taken = new Set<string>();
    for (const r of out) {
      if (!/^P\d{3,}$/.test(r.id) || taken.has(r.id)) r.id = '';
      else taken.add(r.id);
    }
    for (const r of out) if (!r.id) taken.add((r.id = stableAgentId(r.lore, taken)));
    // 조직: 새로 들어온 요원은 구분선을 참고해 조직을 짐작하고, 못 찾으면 소속 미정
    const orgs = buildOrgs(books, out.filter((r) => !fresh.has(r)), obj(data?.조직));
    for (const r of fresh) {
      const o = orgHint(r.group, orgs, books);
      if (o) assignOrg(r, o);
    }
    return { rows: out, groups, refill: legacy.refill, orgs };
  };

  const ag = agents();
  const savedRefill = data && Number.isInteger(data.refill) && (data.refill as number) >= 0 ? (data.refill as number) : null;
  const dir: Directory = {
    anomalies: places('anomaly'),
    sites: places('site'),
    agents: ag.rows,
    orgs: ag.orgs,
    bases: buildBases(books, data, ag.orgs),
    groups: ag.groups,
    refill: savedRefill ?? ag.refill ?? 5,
    folders: !!members,
    saved: !!data,
    usedCodes: list(data?.codes_used),
    display: displaySection(books),
    phoneTabs: phoneTabsSection(books),
    seeds: seedSection(books),
  };
  cache.set(books, dir);
  return dir;
}

// ── 옛 형식으로 내보내기 (상황판·괴담톡·이름 찾기가 쓰는 모양) ──

export function worldRowsOf(dir: Directory): Record<'괴이' | '미스틱 사이트', unknown[][]> {
  const row = (p: PlaceRow) => [p.preset, p.label, p.lore, p.english, p.aliases];
  return { 괴이: dir.anomalies.map(row), '미스틱 사이트': dir.sites.map(row) };
}

export function rosterOf(dir: Directory): Record<string, unknown>[] {
  return dir.agents.map((a) => ({
    id: a.id, name: a.name, english: a.english, lore: a.lore, aliases: a.aliases, legacy_english: a.legacyEnglish,
    affiliation: a.affiliation, rank: a.rank, department: a.department, roster_for: a.rosterFor, phone_tabs: a.phoneTabs,
  }));
}

// ── 명부 로어북 쓰기 ──

/** 지금 명부 전체를 저장 형식으로 (창에서 고친 값 포함) */
export function directoryData(dir: Directory): DirectoryData {
  const place = (p: PlaceRow): PlaceData => ({ preset: p.preset, label: p.label, english: p.english, aliases: p.aliases, ...(p.photo ? { photo: p.photo } : {}) });
  const out: DirectoryData = { schema: DIRECTORY_SCHEMA, refill: dir.refill, 괴이: {}, '미스틱 사이트': {}, 요원: {}, 조직: {} };
  for (const o of dir.orgs) out.조직![o.name] = { roster_for: o.rosterFor, phone_tabs: o.phoneTabs, ...cleanSpec(o.spec) };
  const used = [...new Set([...dir.usedCodes, ...dir.orgs.map((o) => (o.faction ? '' : o.spec.code ?? ''))])].filter((c) => c && !BUILTIN.includes(c)).sort();
  if (used.length) out.codes_used = used;
  out.거점 = {};
  for (const b of dir.bases) {
    const d: BaseData = { sido: b.sido, gu: b.gu, x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10 };
    if (b.label && b.label !== b.name) d.label = b.label;
    if (b.lore) d.lore = b.lore;
    if (b.english) d.english = b.english;
    if (b.aliases.length) d.aliases = b.aliases;
    if (b.org) d.org = b.org;
    if (!b.show) d.show = false;
    out.거점[b.name] = d;
  }
  if (Object.keys(dir.display).length) out.호칭 = dir.display;
  if (dir.phoneTabs.tabs.length) out['괴담톡 탭'] = dir.phoneTabs;
  if (Object.keys(dir.seeds).length) out['시작 로어북'] = dir.seeds;
  for (const p of dir.anomalies) out.괴이![p.lore] = place(p);
  for (const p of dir.sites) out['미스틱 사이트']![p.lore] = place(p);
  for (const a of dir.agents) {
    const d: AgentData = {
      id: a.id, name: a.name, english: a.english, aliases: a.aliases, affiliation: a.affiliation, rank: a.rank,
      department: a.department, roster_for: a.rosterFor, phone_tabs: a.phoneTabs,
    };
    if (a.legacyEnglish.length) d.legacy_english = a.legacyEnglish;
    if (a.photo) d.photo = a.photo;
    out.요원![a.lore] = d;
  }
  return out;
}

/** 빈 값은 저장하지 않는다 */
function cleanSpec(spec: FactionSpec): FactionSpec {
  const out: FactionSpec = {};
  for (const [k, v] of Object.entries(spec) as [keyof FactionSpec, unknown][]) {
    if (v === undefined || v === false || v === '' || (Array.isArray(v) && !v.length && k !== 'seed')) continue;
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

const HELP =
  '괴이: 이면세계 플러그인이 쓰는 명부입니다. 플러그인 창 「설정 → 카드 명부」에서 고치세요. ' +
  '괴이는 🚧괴이, 미스틱 사이트는 🎁파밍, 요원은 🙂요원 폴더에 로어북을 넣으면 자동으로 들어옵니다. 요원의 소속은 창에서 조직을 골라 정합니다. 거점은 지도에 찍히는 장소이고 조직에 묶지 않아도 됩니다. 모델에게는 보내지 않습니다.';

export function directoryContent(data: DirectoryData): string {
  return JSON.stringify({ schema: data.schema, _help: HELP, refill: data.refill, 괴이: data.괴이, '미스틱 사이트': data['미스틱 사이트'], 요원: data.요원, 조직: data.조직, ...(data.거점 ? { 거점: data.거점 } : {}), ...(data.호칭 ? { 호칭: data.호칭 } : {}), ...(data['괴담톡 탭'] ? { '괴담톡 탭': data['괴담톡 탭'] } : {}), ...(data['시작 로어북'] ? { '시작 로어북': data['시작 로어북'] } : {}), ...(data.codes_used?.length ? { codes_used: data.codes_used } : {}) }, null, 1);
}

/** 로어북 목록에 명부를 넣거나 바꾼 새 목록 (원래 목록은 그대로). 설정 폴더가 있으면 그 안에 둔다 */
export function withDirectory(lore: LoreEntry[], data: DirectoryData): LoreEntry[] {
  const content = directoryContent(data);
  // 새 이름 항목을 먼저 쓰고, 없으면 옛 이름 항목을 새 이름으로 바꿔 쓴다. 남는 명부 항목은 지운다
  const own = lore.findIndex((e) => e.comment === DIRECTORY_COMMENT);
  const at = own >= 0 ? own : lore.findIndex((e) => isDirectory(e.comment));
  if (at >= 0) {
    const next = lore.filter((e, i) => i === at || !isDirectory(e.comment));
    const i = next.indexOf(lore[at]);
    next[i] = { ...next[i], comment: DIRECTORY_COMMENT, content, key: '', alwaysActive: false };
    return next;
  }
  const settingsFolder = lore.find((e) => isFolder(e) && folderWord(s(e.comment)) === '설정');
  const entry: LoreEntry = {
    key: '', secondkey: '', insertorder: 0, comment: DIRECTORY_COMMENT, content, mode: 'normal', alwaysActive: false,
    selective: false, useRegex: false, bookVersion: 2,
  };
  if (settingsFolder && typeof settingsFolder.key === 'string') entry.folder = settingsFolder.key;
  return [...lore, entry];
}

export function sameData(a: DirectoryData, b: DirectoryData): boolean {
  return directoryContent(a) === directoryContent(b);
}

/**
 * 명부로 옮기기: 명부를 지금 값으로 적고(옛 이름이면 Directory로), 옮긴 옛 데이터 로어북
 * (World catalog·Agent roster·Faction display·Phone tabs·Start trigger)을 뺀다. 폴더가 없는 카드는 그대로 돌려준다(옛 목록이 유일한 자료라서).
 */
export function migrateLore(lore: LoreEntry[], dir: Directory = readDirectory(lore)): LoreEntry[] {
  if (!dir.folders) return lore;
  return withDirectory(lore, directoryData(dir)).filter((e) => !LEGACY_DATA.includes(String(e.comment ?? '')));
}
