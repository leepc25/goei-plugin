// 플레이 세력 목록: 기본 다섯(A00~E00, scenarios.json) + 「괴이봇 명부」 조직 중 플레이 가능으로 켠 것(F00~).
// 새 세력은 시작 화면에서 직접 입력·커스텀 임무로 시작하고, 태그·세력 로어북의 자리표시자 변수로 모델에게 알린다.
import { directoryEntries } from './lorebooks';
import { migrateRoster } from './world/roster-v';
import type { DirectoryData } from './world/directory';
import { guideText } from './guides';
import { SCENARIOS } from './scenarios';
import { factionScenes, pickScenes, type ScenesData } from './scenes';
import type { Faction, FactionType, LoreEntry, Scenario, ScriptState } from './types';

export const BUILTIN = ['A00', 'B00', 'C00', 'D00', 'E00'];
export const TAG_BOOK = '🏷️Tag';
export const FACTION_BOOK = '📜Faction';

export const FACTION_TYPES: { id: FactionType; label: string; help: string }[] = [
  // 유형이 바꾸는 것은 Faction 지침의 소개 끝 한 줄(TYPE_GM)과 사진 없을 때의 공용 대체 그림뿐 (2026-11-05 사용자 질문에 맞춰 설명을 사실대로)
  { id: 'org', label: '조직형', help: '직접 추가한 조직을 플레이 세력으로 켜면 Faction 세력 목록에 붙는 소개 끝 한 줄이 「작전을 운영하고 내부 공지와 소속 요원이 있다」가 돼요. 원래 조직은 사진 없을 때의 대체 그림 종류만 달라져요' },
  { id: 'civilian', label: '민간형', help: '직접 추가한 조직을 플레이 세력으로 켜면 Faction 세력 목록에 붙는 소개 끝 한 줄이 「작전 없음, 구성원은 방문·이동만」이 돼요. 원래 조직은 사진 없을 때의 대체 그림 종류만 달라져요' },
  { id: 'freelancer', label: '프리랜서형', help: '직접 추가한 조직을 플레이 세력으로 켜면 Faction 세력 목록에 붙는 소개 끝 한 줄이 「구성원은 계약 임무를 받는다」가 돼요. 원래 조직은 사진 없을 때의 대체 그림 종류만 달라져요' },
];

/** 새 세력의 첫 장면: 원본 인사말이 없어서 카드에 있는 공용 빈 첫 장면을 쓴다 */
export const EXTRA_SCENARIOS: Scenario[] = [
  { fm: 1, label: '직접 입력', kind: 'direct' },
  { fm: 2, label: '커스텀 임무', kind: 'preset' },
];

export const isFactionCode = (v: unknown): v is string => typeof v === 'string' && /^[A-Z]00$/.test(v);

/** 인물별 첫 장면의 시나리오 번호 (그 인물로 플레이할 때만 목록에 보인다. core/scenes.ts agentScene) */
export const PLAYER_FM = 0;
export const playerScenario = (name: string, label?: string): Scenario => ({ fm: PLAYER_FM, label: label?.trim() || `${name}의 첫 장면`, kind: 'opening' });

/** 명부 조직 칸에 저장되는 세력 값 (조직 이름이 열쇠) */
export interface FactionSpec {
  code?: string;
  playable?: boolean;
  hidden?: boolean;
  type?: FactionType;
  title?: string;
  blurb?: string;
  /** 대표 사진 (위키 정보표·시작 화면·ID카드). 비우면 「영문명_default」 → 「영문명」 */
  photo?: string;
  /** 얼굴 사진 (작은 사진). 비우면 「영문명」 → 대표 사진 */
  face?: string;
  /** 대표 사진에서 얼굴로 자를 틀 「가로,세로,크기」 (%) */
  crop?: string;
  english?: string;
  gm_name?: string;
  gm_desc?: string;
  seed?: string[];
  tab?: string;
}

export const SPEC_KEYS = ['code', 'playable', 'hidden', 'type', 'title', 'blurb', 'photo', 'face', 'crop', 'english', 'gm_name', 'gm_desc', 'seed', 'tab'] as const;

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
  for (const k of ['title', 'blurb', 'photo', 'face', 'crop', 'english', 'gm_name', 'gm_desc', 'tab'] as const) if (s(d[k])) out[k] = s(d[k]);
  if (Array.isArray(d.seed)) out.seed = list(d.seed);
  return out;
}

function loreText(lore: LoreEntry[], comment: string): string {
  return lore
    .filter((e) => e.comment === comment && typeof e.content === 'string')
    .map((e) => e.content as string)
    .join('\n');
}

function directoryRaw(lore: LoreEntry[]): Record<string, unknown> {
  const raw = directoryEntries(lore).map((e) => String(e.content ?? '')).join('\n').trim();
  if (!raw) return {};
  try {
    const d = obj(JSON.parse(raw.replace(/^﻿/, '').replace(/^```[\w-]*\s*\n/, '').replace(/\n\s*```\s*$/, '')));
    return d.schema === 1 ? (migrateRoster(d as unknown as DirectoryData) as unknown as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** 명부 「첫 장면」 저장값 (기본값은 core/scenes.ts 가 팩에서 읽는다) */
export function scenesOf(lore: LoreEntry[] | undefined): ScenesData {
  return pickScenes(directoryRaw(lore ?? [])['첫 장면']);
}

/** 시작 화면에 보일 시나리오: 공용 장면(숨긴 것 빼고) + 직접 입력·커스텀 임무. 기본 세력은 scenarios.json 의 직접 입력·커스텀 임무 번호를 그대로 */
function scenarioList(code: string, scenes: ScenesData, tail: Scenario[]): Scenario[] {
  const openings: Scenario[] = factionScenes(code, scenes).filter((r) => !r.hidden && (r.ko.trim() || r.en.trim())).map((r) => ({ fm: r.fm, label: r.label, kind: 'opening' }));
  return [...openings, ...tail.filter((t) => t.kind !== 'opening')];
}

function orgSpecs(lore: LoreEntry[]): [string, FactionSpec][] {
  return Object.entries(obj(directoryRaw(lore).조직)).map(([name, v]) => [name.trim(), pickSpec(v)] as [string, FactionSpec]).filter(([name]) => name);
}

/** 시작 묶음 (명부 「시작 묶음」): 조직이 아닌 시작 화면 칸. 2026-11-05 사용자 「중립」 */
export interface StartGroup {
  name: string;
  code: string;
  blurb: string;
  english: string;
  photo: string;
  hidden: boolean;
}
export function startGroups(lore: LoreEntry[] | undefined): StartGroup[] {
  const out: StartGroup[] = [];
  for (const [name, raw] of Object.entries(obj(directoryRaw(lore ?? [])['시작 묶음']))) {
    const d = obj(raw);
    if (!s(name) || !isFactionCode(d.code) || BUILTIN.includes(d.code) || out.some((g) => g.code === d.code)) continue;
    out.push({ name: s(name), code: d.code, blurb: s(d.blurb), english: s(d.english), photo: s(d.photo), hidden: d.hidden === true });
  }
  return out;
}

/** 시작 화면 칸 순서 (명부 「시작 화면」 order). 빠진 코드는 기본 순서대로 뒤에 */
export function startOrder(lore: LoreEntry[] | undefined): string[] {
  return list(obj(directoryRaw(lore ?? [])['시작 화면']).order);
}

export function sortByStart(codes: string[], list: Faction[]): Faction[] {
  if (!codes.length) return list;
  const at = new Map(codes.map((c, i) => [c, i]));
  return [...list].sort((a, b) => (at.get(a.code) ?? 1e9 + list.indexOf(a)) - (at.get(b.code) ?? 1e9 + list.indexOf(b)));
}

/** 이 카드의 태그 로어북에 새 세력 자리표시자가 들어 있는지 */
export function placeholdersReady(lore: LoreEntry[] | undefined): boolean {
  // v0.17 카드는 🏷️Tag 로어북이 없고 플러그인 내장 Tag 지침(src/data/guides/tag.txt, 자리표시자 있음)이 가상 항목으로 들어간다
  // (core/world/virtual.ts). 카드에 없으면 그 지침 글로 판단한다. 2026-10-28 QC: 카드만 보다가 새 세력이 시작 화면에 안 나오고
  // 명부에 「Tag 로어북에 자리가 없다」는 잘못된 안내가 떴다 (tests/browser.mjs 20절). 📜Faction 도 없으면 명부 조직으로 조립돼 자리가 필요 없다
  // 가상 항목(goeiVirtual, core/world/virtual.ts VIRTUAL — 순환 import 를 피해 이름으로)은 플러그인이 조립한 것이라 뺀다: 가상 📜Faction 은 명부 조직을 직접 나열한다
  const books = (lore ?? []).filter((e) => (e as Record<string, unknown>).goeiVirtual !== true);
  const tag = books.some((e) => e.comment === TAG_BOOK) ? loreText(books, TAG_BOOK) : guideText('Tag');
  const fac = loreText(books, FACTION_BOOK);
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
  const scenes = scenesOf(books);
  const out: Faction[] = SCENARIOS.factions.map((f, i) => {
    const spec = specs.find(([, v]) => v.code === f.code)?.[1] ?? {};
    return {
      ...f,
      scenarios: scenarioList(f.code, scenes, f.scenarios),
      name: spec.title || f.name,
      blurb: spec.blurb || f.blurb,
      photo: spec.photo ?? '',
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
        scenarios: scenarioList(spec.code, scenes, EXTRA_SCENARIOS),
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
  // 시작 묶음: 자리표시자와 무관 (모델에게 코드를 알릴 일이 없다)
  for (const g of startGroups(books)) {
    if (out.some((f) => f.code === g.code)) continue;
    out.push({ code: g.code, name: g.name, affiliation: g.name, blurb: g.blurb, scenarios: scenarioList(g.code, scenes, EXTRA_SCENARIOS), photo: g.photo, english: g.english, type: 'org', builtin: false, hidden: g.hidden, group: true });
  }
  const sorted = sortByStart(startOrder(books), out);
  cache.set(books, sorted);
  return sorted;
}

/** 새 세력 (명부 조직 중 플레이로 켠 것). 시작 묶음은 세력이 아니라서 뺀다 */
export const extraFactions = (lore: LoreEntry[] | undefined) => factionList(lore).filter((f) => !f.builtin && !f.group);
/** 시작 묶음 코드인가 */
export const isGroupCode = (lore: LoreEntry[] | undefined, code: string) => !!factionList(lore).find((f) => f.code === code)?.group;
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
