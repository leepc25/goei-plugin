// 플레이 세력 목록: 기본 다섯(A00~E00, scenarios.json) + 「괴이봇 명부」 조직 중 플레이 가능으로 켠 것(F00~).
// 새 세력은 시작 화면에서 직접 입력·커스텀 임무로 시작하고, 태그·세력 로어북의 자리표시자 변수로 모델에게 알린다.
import { directoryEntries } from './lorebooks';
import { SCENARIOS } from './scenarios';
import type { Faction, FactionType, LoreEntry, Scenario, ScriptState } from './types';

export const BUILTIN = ['A00', 'B00', 'C00', 'D00', 'E00'];
export const TAG_BOOK = '🏷️Tag';
export const FACTION_BOOK = '📜Faction';

export const FACTION_TYPES: { id: FactionType; label: string; help: string }[] = [
  { id: 'org', label: '조직형', help: '관리국·백일몽처럼 작전과 내부 공지가 있어요' },
  { id: 'civilian', label: '민간형', help: '민간인처럼 작전 없이 방문·이동만 하고, 공지는 시민 공개 안내예요' },
  { id: 'freelancer', label: '프리랜서형', help: '프리랜서처럼 의뢰를 받아 움직이고, 공지는 등록 계약자 안내예요' },
];

/** 새 세력의 첫 장면: 원본 인사말이 없어서 카드에 있는 공용 빈 첫 장면을 쓴다 */
export const EXTRA_SCENARIOS: Scenario[] = [
  { fm: 1, label: '직접 입력', kind: 'direct' },
  { fm: 2, label: '커스텀 임무', kind: 'preset' },
];

export const isFactionCode = (v: unknown): v is string => typeof v === 'string' && /^[A-Z]00$/.test(v);

/** 명부 조직 칸에 저장되는 세력 값 (조직 이름이 열쇠) */
export interface FactionSpec {
  code?: string;
  playable?: boolean;
  hidden?: boolean;
  type?: FactionType;
  title?: string;
  blurb?: string;
  photo?: string;
  /** 영문명: 위키 사진은 「영문명_default」 → 「영문명」 → photo 순 */
  english?: string;
  gm_name?: string;
  gm_desc?: string;
  seed?: string[];
  tab?: string;
}

export const SPEC_KEYS = ['code', 'playable', 'hidden', 'type', 'title', 'blurb', 'photo', 'english', 'gm_name', 'gm_desc', 'seed', 'tab'] as const;

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown) => (Array.isArray(v) ? v.map(s).filter(Boolean) : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** 저장 값에서 세력 값만 골라 정리한다 (빈 값은 뺀다) */
export function pickSpec(raw: unknown): FactionSpec {
  const d = obj(raw);
  const out: FactionSpec = {};
  if (isFactionCode(d.code)) out.code = d.code;
  if (d.playable === true) out.playable = true;
  if (d.hidden === true) out.hidden = true;
  if (FACTION_TYPES.some((t) => t.id === d.type)) out.type = d.type as FactionType;
  for (const k of ['title', 'blurb', 'photo', 'english', 'gm_name', 'gm_desc', 'tab'] as const) if (s(d[k])) out[k] = s(d[k]);
  if (Array.isArray(d.seed)) out.seed = list(d.seed);
  return out;
}

function loreText(lore: LoreEntry[], comment: string): string {
  return lore
    .filter((e) => e.comment === comment && typeof e.content === 'string')
    .map((e) => e.content as string)
    .join('\n');
}

function orgSpecs(lore: LoreEntry[]): [string, FactionSpec][] {
  const raw = directoryEntries(lore).map((e) => String(e.content ?? '')).join('\n').trim();
  if (!raw) return [];
  try {
    const d = obj(JSON.parse(raw.replace(/^﻿/, '').replace(/^```[\w-]*\s*\n/, '').replace(/\n\s*```\s*$/, '')));
    if (d.schema !== 1) return [];
    return Object.entries(obj(d.조직)).map(([name, v]) => [name.trim(), pickSpec(v)] as [string, FactionSpec]).filter(([name]) => name);
  } catch {
    return [];
  }
}

/** 이 카드의 태그 로어북에 새 세력 자리표시자가 들어 있는지 */
export function placeholdersReady(lore: LoreEntry[] | undefined): boolean {
  const tag = loreText(lore ?? [], TAG_BOOK);
  const fac = loreText(lore ?? [], FACTION_BOOK);
  return tag.includes('{{getvar::fac_codes}}') && tag.includes('{{getvar::fac_ac}}') && (!fac || placeFactionExtra(fac) === fac);
}

const builtinType = (code: string): FactionType => (code === 'D00' ? 'civilian' : code === 'E00' ? 'freelancer' : 'org');

/** 새 세력의 괴담톡 전용 탭 ID (F00 → T105) */
export const extraTabId = (code: string) => `T${100 + code.charCodeAt(0) - 65}`;

const cache = new WeakMap<LoreEntry[], Faction[]>();

/**
 * 세력 전체 (숨긴 기본 세력 포함). 기본 세력은 명부의 같은 code 칸으로 이름·설명·사진·숨김만 바꾼다.
 * 새 세력은 카드 태그 로어북에 자리표시자가 있을 때만 나온다 (없으면 모델이 그 코드를 모름).
 */
export function factionList(lore: LoreEntry[] | undefined): Faction[] {
  const books = lore ?? [];
  const hit = cache.get(books);
  if (hit) return hit;
  const specs = orgSpecs(books);
  const out: Faction[] = SCENARIOS.factions.map((f, i) => {
    const spec = specs.find(([, v]) => v.code === f.code)?.[1] ?? {};
    return {
      ...f,
      name: spec.title || f.name,
      blurb: spec.blurb || f.blurb,
      photo: spec.photo || `f0${i + 1}`,
      english: spec.english ?? '',
      type: builtinType(f.code),
      builtin: true,
      hidden: !!spec.hidden,
    };
  });
  if (placeholdersReady(books)) {
    const extras: Faction[] = [];
    for (const [name, spec] of specs) {
      if (!spec.playable || !spec.code || BUILTIN.includes(spec.code) || extras.some((f) => f.code === spec.code)) continue;
      extras.push({
        code: spec.code,
        name: spec.title || name,
        affiliation: name,
        blurb: spec.blurb ?? '',
        scenarios: EXTRA_SCENARIOS,
        photo: spec.photo ?? '',
        english: spec.english ?? '',
        type: spec.type ?? 'org',
        builtin: false,
        hidden: false,
        gmName: spec.gm_name ?? '',
        gmDesc: spec.gm_desc ?? '',
        seed: spec.seed ?? [name],
        tab: spec.tab || Array.from(name).slice(0, 2).join(''),
        org: name,
      });
    }
    out.push(...extras.sort((a, b) => a.code.localeCompare(b.code)));
  }
  cache.set(books, out);
  return out;
}

export const extraFactions = (lore: LoreEntry[] | undefined) => factionList(lore).filter((f) => !f.builtin);
/** 요원 목록 공개 대상 등에 쓰는 코드 전체 */
export const factionCodes = (lore: LoreEntry[] | undefined) => factionList(lore).map((f) => f.code);

export function factionType(code: string, lore?: LoreEntry[]): FactionType {
  if (BUILTIN.includes(code)) return builtinType(code);
  return factionList(lore).find((f) => f.code === code)?.type ?? 'org';
}

/** 새 세력 코드 → 표시 이름 (기본 세력 이름은 Faction display 로어북을 따른다) */
export function extraNames(lore: LoreEntry[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of extraFactions(lore)) out[f.code] = f.org ?? f.name;
  return out;
}

/** 새 세력의 괴담톡 전용 탭 */
export function extraTabs(lore: LoreEntry[] | undefined): { id: string; name: string; visibleFor: string[] }[] {
  return extraFactions(lore).map((f) => ({ id: extraTabId(f.code), name: f.tab ?? f.code, visibleFor: [f.code] }));
}

/** 비어 있는 다음 코드 (F00부터). 한 번 쓴 코드는 다시 주지 않는다 */
export function nextCode(used: Iterable<string>): string | null {
  const taken = new Set([...BUILTIN, ...used]);
  for (let c = 'F'.charCodeAt(0); c <= 'Z'.charCodeAt(0); c++) {
    const code = `${String.fromCharCode(c)}00`;
    if (!taken.has(code)) return code;
  }
  return null;
}

const TYPE_GM: Record<FactionType, string> = {
  org: 'Organization: runs operations, has internal notices and its own agents.',
  civilian: 'Civilian-type: no operations; members only visit and move around.',
  freelancer: 'Freelancer-type: members take contracted missions.',
};

/**
 * 태그·세력 로어북 자리표시자에 들어갈 채팅 변수. 새 세력이 없으면 모두 빈 값이라 원래 글과 같다.
 * $fac_codes: [AC] 코드 줄 뒤, $fac_ac: 코드별 이름 줄, $fac_pool: 배치 칸 세력 목록, $fac_extra: 📜Faction 세력 목록 끝.
 */
export function factionVars(lore: LoreEntry[] | undefined): ScriptState {
  const extras = extraFactions(lore);
  const tag = loreText(lore ?? [], TAG_BOOK);
  const gmName = (f: Faction) => f.gmName || f.org || f.name;
  return {
    $fac_codes: extras.map((f) => ` | ${f.code}`).join(''),
    $fac_ac: extras.map((f) => `\n   - ${f.code} = ${gmName(f)}`).join(''),
    $fac_pool: extras
      .map((f) => f.org ?? f.name)
      .filter((n) => !tag.includes(n))
      .map((n) => ` | ${n}`)
      .join(''),
    $fac_extra: extras
      .map((f) => `\n\n### ${gmName(f)} [${f.code}]\n${f.gmDesc || `A faction the protagonist can belong to. See the 「${f.org}」 entry.`}\n${TYPE_GM[f.type ?? 'org']}`)
      .join(''),
  };
}

export const FACTION_VAR_KEYS = ['$fac_codes', '$fac_ac', '$fac_pool', '$fac_extra'];

/** 채팅 변수가 지금 명부와 다르면 고칠 값, 같으면 null */
export function staleFactionVars(lore: LoreEntry[] | undefined, ss: ScriptState | undefined): ScriptState | null {
  const want = factionVars(lore);
  const v = ss ?? {};
  return FACTION_VAR_KEYS.some((k) => String(v[k] ?? '') !== want[k]) ? want : null;
}

// ── 로어북 자리표시자 넣기 (Lite 카드 만들 때와 같은 규칙. tools/build_lite_card.py) ──

const AC_CODES = /(code = A00 \| B00 \| C00 \| D00 \| E00)(?!\{\{getvar::fac_codes\}\})/;
const AC_LAST = /(\n[ \t]*- E00 = [^\n]*)(?!\{\{getvar::fac_ac\}\})/;
const POOL = /(\n[ \t]*- Faction pool:[^\n]*?)( \| etc\.)?(\n)/;

const EXTRA = '{{getvar::fac_extra}}';

/**
 * 📜Faction에서 새 세력 설명이 들어갈 자리: 세력 목록(첫 「## 」 절)의 끝, 다음 「## 」 제목 바로 앞.
 * 다음 제목이 없으면 글 끝. 옛 빌드처럼 글 끝(--- 뒤)에 붙어 있으면 그 자리로 옮긴다.
 */
function placeFactionExtra(text: string): string {
  const bare = text.split(EXTRA).join('');
  const body = bare.replace(/\s+$/, '');
  const next = body.slice(1).search(/\n## /);
  if (next < 0) return text.includes(EXTRA) ? text : `${body}${EXTRA}\n`;
  const at = next + 1;
  const want = `${body.slice(0, at).replace(/\s+$/, '')}${EXTRA}\n\n${body.slice(at).replace(/^\s+/, '')}\n`;
  if (text.includes(EXTRA) && text.indexOf(EXTRA) === want.indexOf(EXTRA) && text.split(EXTRA).length === 2) return text;
  return want;
}

export interface PlaceholderResult {
  lore: LoreEntry[];
  changed: boolean;
  /** 자리를 못 찾은 부분 */
  missing: string[];
}

/** 🏷️Tag의 [AC] 코드 목록·배치 세력 목록과 📜Faction 세력 목록 끝에 자리표시자를 넣는다. 이미 맞는 자리에 있으면 그대로 */
export function withFactionPlaceholders(lore: LoreEntry[]): PlaceholderResult {
  const missing: string[] = [];
  let changed = false;
  const tagAt = lore.findIndex((e) => e.comment === TAG_BOOK && typeof e.content === 'string');
  const facAt = lore.findIndex((e) => e.comment === FACTION_BOOK && typeof e.content === 'string');
  const next = lore.slice();
  if (tagAt < 0) missing.push(TAG_BOOK);
  else {
    let t = next[tagAt].content as string;
    if (!t.includes('{{getvar::fac_codes}}')) {
      if (AC_CODES.test(t)) t = t.replace(AC_CODES, '$1{{getvar::fac_codes}}');
      else missing.push('[AC] 코드 목록');
    }
    if (!t.includes('{{getvar::fac_ac}}')) {
      if (AC_LAST.test(t)) t = t.replace(AC_LAST, '$1{{getvar::fac_ac}}');
      else missing.push('[AC] E00 줄');
    }
    if (!t.includes('{{getvar::fac_pool}}')) {
      if (POOL.test(t)) t = t.replace(POOL, (_m, line: string, etc: string | undefined, nl: string) => `${line}{{getvar::fac_pool}}${etc ?? ''}${nl}`);
      else missing.push('Faction pool 줄');
    }
    if (t !== next[tagAt].content) {
      next[tagAt] = { ...next[tagAt], content: t };
      changed = true;
    }
  }
  if (facAt < 0) missing.push(FACTION_BOOK);
  else {
    const f = next[facAt].content as string;
    const t = placeFactionExtra(f);
    if (t !== f) {
      next[facAt] = { ...next[facAt], content: t };
      changed = true;
    }
  }
  return { lore: next, changed, missing };
}
