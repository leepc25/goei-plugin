// 기본 설정과 괴이 생성 수치. 우선순위: 이 채팅의 변수($st_*, $wg_*) > 플러그인 저장소의 기본값(설정 창)
// > 옛 카드의 Settings 로어북(있으면) > 내장 기본값. 채팅 변수 키는 원본 ensureDefaults·WG.get과 같다.
import { GUIDE_NAMES, isGuideName, setGuideOverride } from './guides';
import type { LoreEntry, ScriptState } from './types';
import { DEFAULT_SETTINGS, type WorldSettings } from './world/engine';
import { imgFold, imgRecent, imgSize } from './imgtag';

export type AssetModel = 'main' | 'aux';

export interface BasicSettings {
  /** 새 채팅을 상황판(괴이 발생·요원 시스템)을 켜고 시작할지. Settings 기본설정의 「상황판」(옛 이름 통합관제) */
  anomalyOn: boolean;
  /** 에셋(캐릭터 이미지) 출력 */
  assetOn: boolean;
  /** main: 본문 AI가 이미지 태그를 함께 적음, aux: 보조 모델이 완성된 본문에 태그를 보충 */
  assetModel: AssetModel;
  /** 캐릭터로 플레이할 때 주인공(유저가 고른 요원)도 이미지 태그를 받을지 */
  assetPlayer: boolean;
  /** 캐릭터당 이미지 수 1~4 */
  assetLimit: number;
  /** 요원 표시 인원 0~20 */
  agentLimit: number;
  /** 지원 투입 */
  supportOn: boolean;
}

export const ST = {
  assetOn: '$st_asset_on',
  assetModel: '$st_asset_model',
  assetPlayer: '$st_asset_player',
  assetLimit: '$st_asset_limit',
  agentLimit: '$st_agent_limit',
  supportOn: '$st_support_on',
} as const;

export const AGENT_MAX = 20;

export const BASIC_DEFAULTS: BasicSettings = { anomalyOn: true, assetOn: true, assetModel: 'main', assetPlayer: false, assetLimit: 2, agentLimit: 12, supportOn: true };

/** 괴이 생성 수치. label은 옛 Settings 로어북 「괴이생성」의 항목 이름 (원본 WG.spec) */
export interface WorldField {
  key: Exclude<keyof WorldSettings, 'agent_limit'>;
  label: string;
  max: number | null;
  fraction: boolean;
}
export const WORLD_SPEC: WorldField[] = (
  [
    ['추가 발생 여유분', 'extra_cap', null, false],
    ['미스틱 사이트 추가 여유분', 'extra_ms_cap', null, false],
    ['인시던트 추가 여유분', 'extra_in_cap', null, false],
    ['프리셋 괴이 상한', 'preset_cap', null, false],
    ['프리셋 괴이 발생 확률', 'preset_p', 100, false],
    ['랜덤 괴이 상한', 'random_cap', null, false],
    ['랜덤 괴이 발생 확률', 'random_p', 100, false],
    ['인시던트 상한', 'incident_cap', null, false],
    ['인시던트 발생 확률', 'incident_p', 100, false],
    ['미스틱 사이트 상한', 'mystic_cap', null, false],
    ['미스틱 사이트 발생 확률', 'mystic_p', 100, false],
    ['프리셋 자동 종료', 'preset_expire', 1, false],
    ['랜덤 괴이 자동 종료', 'random_expire', 1, false],
    ['인시던트 자동 종료', 'incident_expire', 1, false],
    ['미스틱 사이트 자동 종료', 'mystic_expire', 1, false],
    ['프리셋 괴이 RP 유지 시간', 'preset_ttl', 8760, true],
    ['랜덤 괴이 RP 유지 시간', 'random_ttl', 8760, true],
    ['인시던트 RP 유지 시간', 'incident_ttl', 8760, true],
    ['미스틱 사이트 RP 유지 시간', 'mystic_ttl', 8760, true],
    ['인시던트 중 거점 비율', 'landmark_share', 100, false],
  ] as [string, WorldField['key'], number | null, boolean][]
).map(([label, key, max, fraction]) => ({ key, label, max, fraction }));

/** 원본 WG.get의 채팅 변수 이름 */
export const wgKey = (key: string) => `$wg_${key}`;

function worldValue(f: WorldField, v: unknown): number | null {
  const n = num(v);
  if (n === null || n < 0 || (f.max !== null && n > f.max) || (!f.fraction && !Number.isInteger(n))) return null;
  return n;
}

interface SettingsBook {
  basic: Record<string, unknown>;
  world: Record<string, unknown>;
}

const cache = new WeakMap<LoreEntry[], SettingsBook>();

export type Theme = 'light' | 'dark' | 'paper';
/** 채팅 속 상태창 배색: 채팅 테마를 따르거나 하나로 고정, 또는 숨김 (태그는 그대로 나온다) */
export type StatusStyle = 'auto' | Theme | 'off';

/** 설정 창에서 고친 새 채팅 기본값 (플러그인 저장소). 없는 항목은 아래 단계 값을 쓴다 */
export interface Prefs {
  basic: Partial<BasicSettings>;
  world: Partial<WorldSettings>;
  theme?: Theme;
  /** 괴담톡·괴담넷·위키 설정의 새 채팅 기본값: 채팅 변수 이름 → 값 (각 설정 화면의 「기본값으로 저장」) */
  vars?: Record<string, string>;
  /** 창 모양 (이 기기·모든 채팅 공통): 메뉴 위치, 창 바깥 어둡기(%) */
  nav?: 'left' | 'right';
  /** 위키 목록 서랍 쪽 (PC, 이 기기 공통, 2026-10-27 사용자). 없으면 왼쪽. 모바일은 늘 오른쪽 책갈피 */
  wikiSide?: 'right';
  /** 상황판 요원 칸 모양 (이 기기 공통): 모니터 벽(기본) 또는 목록 */
  agents?: 'wall' | 'list';
  dim?: number;
  /** 채팅 속 상태창 배색 (없으면 테마 따름) */
  status?: StatusStyle;
  /** 채팅 속 캐릭터 이미지 칸 크기·접힌 높이 (%, 이 기기 공통, 없으면 원본 카드와 같은 100%·68%) */
  imgSize?: number;
  imgFold?: number;
  /** 이미지를 접을지 (기본 켬). 끄면 늘 펼친 채 (사용자 2026-10-27) */
  imgFoldOn?: boolean;
  /** 이미지를 띄울 최근 메시지 수·요청에 이미지 태그를 남길 최근 메시지 수 (0이면 전부, 없으면 6) */
  imgShow?: number;
  imgSend?: number;
  /** 즐겨찾기 (이 기기·모든 채팅 공통, 최대 MARK_MAX): 창 안 화면 상태와 이름 */
  marks?: Mark[];
  /** 이미지 태그 지침 (core/imgprompt.ts): 틀, 끈 이름, 임의 추가 이름, 표정 세트. 없으면 기본 */
  imgPrompt?: string;
  imgNamesOff?: string[];
  imgNamesExtra?: string[];
  imgKeywords?: string[];
  /** 세계 편집 창 폭 (브라우저 폭의 %, 50~100. 없으면 90) */
  editorWidth?: number;
  /** 고친 지침 (core/guides.ts GuideName → 글). 없으면 기본 */
  guides?: Record<string, string>;
  /** 세력 관계 격자: 한 칸을 바꾸면 반대 칸도 (기본 켬) */
  relationsSym?: boolean;
  /** 새 채팅의 시작 잔고 (원). 없으면 0 */
  walletStart?: number;
}

/** 즐겨찾기 하나: s는 app.ts가 앞뒤 이동 기록에 쓰는 화면 상태 그대로, name은 저장할 때 붙인 이름 */
export interface Mark {
  s: { tab: string } & Record<string, unknown>;
  name: string;
}
export const MARK_MAX = 5;

/** 창 바깥 어둡기 기본값 (%). 예전엔 100%라 뒤 채팅이 거의 안 보였다 */
export const DIM_DEFAULT = 50;
export const DIM_STEPS = [0, 25, 50, 75, 100];

let prefs: Prefs = { basic: {}, world: {} };

/** 기능 설정으로 기본값에 담을 수 있는 채팅 변수 (상태·기록 변수는 빼고 설정만) */
export const PREF_VAR = /^(\$ph_(model|auto|status|related|context|incoming|incoming_chance|group_invites|group_invite_chance|announcements|announcement_gap|announcement_history|announcement_page_size|all_contacts|anomaly_contacts|storage_(auto|limit)_(dm|group|notice))|\$lb_cfg_lb-gn\.[a-z_]+|\$gn_storage_(auto|limit)_dm|\$nw_(mode|model|length|refresh_previous|writing_request|context)|\$ph_context_(messages|announcements)|\$(ph|nw)_adv_[a-z_]+|\$hq_(adv_[a-z_]+|ui)|\$gen_[a-z_]+|\$pp_[a-z_]+|\$st_col_[a-z]+|\$st_wallet_edit)$/;

export function getPrefs(): Prefs {
  return prefs;
}

/** 저장소에서 읽은 값을 검사해 넣는다. 틀린 항목은 버린다 */
export function setPrefs(raw: unknown): Prefs {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const b = o.basic && typeof o.basic === 'object' ? (o.basic as Record<string, unknown>) : {};
  const w = o.world && typeof o.world === 'object' ? (o.world as Record<string, unknown>) : {};
  const basic: Partial<BasicSettings> = {};
  if (typeof b.anomalyOn === 'boolean') basic.anomalyOn = b.anomalyOn;
  if (typeof b.assetOn === 'boolean') basic.assetOn = b.assetOn;
  if (b.assetModel === 'main' || b.assetModel === 'aux') basic.assetModel = b.assetModel;
  if (typeof b.assetPlayer === 'boolean') basic.assetPlayer = b.assetPlayer;
  const al = int(b.assetLimit, 1, 4);
  if (al !== null) basic.assetLimit = al;
  const ag = int(b.agentLimit, 0, AGENT_MAX);
  if (ag !== null) basic.agentLimit = ag;
  if (typeof b.supportOn === 'boolean') basic.supportOn = b.supportOn;
  const world: Partial<WorldSettings> = {};
  for (const f of WORLD_SPEC) {
    const n = worldValue(f, w[f.key]);
    if (n !== null) world[f.key] = n;
  }
  const theme = o.theme === 'light' || o.theme === 'dark' || o.theme === 'paper' ? o.theme : undefined;
  const vars: Record<string, string> = {};
  if (o.vars && typeof o.vars === 'object') {
    for (const [k, v] of Object.entries(o.vars as Record<string, unknown>)) if (PREF_VAR.test(k) && typeof v === 'string') vars[k] = v;
  }
  const nav = o.nav === 'right' ? 'right' : undefined;
  const wikiSide = o.wikiSide === 'right' ? 'right' : undefined;
  const agents = o.agents === 'list' ? 'list' : undefined;
  const dim = int(o.dim, 0, 100);
  const status = o.status === 'off' || o.status === 'light' || o.status === 'dark' || o.status === 'paper' ? o.status : undefined;
  const size = imgSize(o.imgSize);
  const fold = imgFold(o.imgFold);
  const imgFoldOn = o.imgFoldOn === false ? false : undefined;
  const show = imgRecent(o.imgShow);
  const send = imgRecent(o.imgSend);
  const marks: Mark[] = (Array.isArray(o.marks) ? o.marks : [])
    .filter((m): m is Mark => !!m && typeof m === 'object' && typeof (m as Mark).name === 'string' && !!(m as Mark).s && typeof (m as Mark).s.tab === 'string')
    .slice(0, MARK_MAX)
    .map((m) => ({ s: m.s, name: m.name.slice(0, 80) }));
  const strList = (v: unknown, max: number, len: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim().slice(0, len)).slice(0, max) : []);
  const imgPrompt = typeof o.imgPrompt === 'string' && o.imgPrompt.trim() ? o.imgPrompt.slice(0, 6000) : undefined;
  const imgNamesOff = strList(o.imgNamesOff, 200, 40);
  const imgNamesExtra = strList(o.imgNamesExtra, 60, 40);
  const imgKeywords = strList(o.imgKeywords, 60, 24);
  const editorWidth = int(o.editorWidth, 50, 100);
  const guides: Record<string, string> = {};
  if (o.guides && typeof o.guides === 'object') {
    for (const [k, v] of Object.entries(o.guides as Record<string, unknown>)) if (isGuideName(k) && typeof v === 'string' && v.trim()) guides[k] = v.slice(0, 120000);
  }
  for (const k of GUIDE_NAMES) setGuideOverride(k, guides[k]);
  const relationsSym = o.relationsSym === false ? false : undefined;
  const walletStart = int(o.walletStart, 0, 1_000_000_000_000);
  prefs = { basic, world, ...(walletStart !== null ? { walletStart } : {}), ...(editorWidth !== null ? { editorWidth } : {}), ...(Object.keys(guides).length ? { guides } : {}), ...(relationsSym === false ? { relationsSym } : {}), ...(theme ? { theme } : {}), ...(imgPrompt ? { imgPrompt } : {}), ...(imgNamesOff.length ? { imgNamesOff } : {}), ...(imgNamesExtra.length ? { imgNamesExtra } : {}), ...(imgKeywords.length ? { imgKeywords } : {}), ...(Object.keys(vars).length ? { vars } : {}), ...(nav ? { nav } : {}), ...(wikiSide ? { wikiSide } : {}), ...(agents ? { agents } : {}), ...(dim !== null ? { dim } : {}), ...(status ? { status } : {}), ...(size !== null ? { imgSize: size } : {}), ...(fold !== null ? { imgFold: fold } : {}), ...(imgFoldOn === false ? { imgFoldOn } : {}), ...(show !== null ? { imgShow: show } : {}), ...(send !== null ? { imgSend: send } : {}), ...(marks.length ? { marks } : {}) };
  return prefs;
}

/** Settings 로어북 (이전 이름 통합설정). 같은 이름이 여럿이면 원본처럼 삽입 순서가 큰 쪽 */
export function readSettingsBook(lore: LoreEntry[] | undefined): SettingsBook {
  const list = lore ?? [];
  const hit = cache.get(list);
  if (hit) return hit;
  let out: SettingsBook = { basic: {}, world: {} };
  for (const name of ['Settings', '통합설정']) {
    const books = list.filter((e) => e.comment === name && typeof e.content === 'string' && e.content.trim());
    if (!books.length) continue;
    const chosen = books.reduce((a, b) => (Number(b.insertorder ?? b.insertion_order ?? 0) > Number(a.insertorder ?? a.insertion_order ?? 0) ? b : a));
    try {
      const data = JSON.parse(String(chosen.content).replace(/^﻿/, '').trim()) as Record<string, unknown>;
      const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
      out = { basic: obj(data['기본설정']), world: obj(data['괴이생성']) };
    } catch {
      // 구문이 틀리면 기본값으로 (원본도 값마다 기본값으로 돌아감)
    }
    break;
  }
  cache.set(list, out);
  return out;
}

function num(v: unknown): number | null {
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function int(v: unknown, min: number, max: number): number | null {
  const n = num(v);
  return n !== null && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function flag(v: unknown): boolean | null {
  if (v === true || v === '1' || v === 1 || v === 'ON') return true;
  if (v === false || v === '0' || v === 0 || v === 'OFF') return false;
  return null;
}

function model(v: unknown): AssetModel | null {
  if (v === 'main' || v === '메인') return 'main';
  if (v === 'aux' || v === '보조') return 'aux';
  return null;
}

/** 카드 기본값 (Settings 기본설정) */
export function basicDefaults(lore: LoreEntry[] | undefined): BasicSettings {
  const b = readSettingsBook(lore).basic;
  const book: BasicSettings = {
    anomalyOn: flag(b['상황판'] ?? b['통합관제']) ?? BASIC_DEFAULTS.anomalyOn,
    assetOn: flag(b['에셋 출력']) ?? BASIC_DEFAULTS.assetOn,
    assetModel: model(b['에셋 모델']) ?? BASIC_DEFAULTS.assetModel,
    assetPlayer: flag(b['주인공 에셋']) ?? BASIC_DEFAULTS.assetPlayer,
    assetLimit: int(b['캐릭터당 이미지 수'], 1, 4) ?? BASIC_DEFAULTS.assetLimit,
    agentLimit: int(b['요원 표시 인원'], 0, AGENT_MAX) ?? BASIC_DEFAULTS.agentLimit,
    supportOn: flag(b['지원 투입']) ?? BASIC_DEFAULTS.supportOn,
  };
  return { ...book, ...prefs.basic };
}

/** 이 채팅의 값 (채팅 변수가 없거나 틀리면 카드 기본값) */
export function basicSettings(lore: LoreEntry[] | undefined, ss: ScriptState | undefined): BasicSettings {
  const d = basicDefaults(lore);
  const v = ss ?? {};
  return {
    anomalyOn: v.$st_anomaly_on === undefined ? d.anomalyOn : v.$st_anomaly_on === '1',
    assetOn: flag(v[ST.assetOn]) ?? d.assetOn,
    assetModel: model(v[ST.assetModel]) ?? d.assetModel,
    assetPlayer: flag(v[ST.assetPlayer]) ?? d.assetPlayer,
    assetLimit: int(v[ST.assetLimit], 1, 4) ?? d.assetLimit,
    agentLimit: int(v[ST.agentLimit], 0, AGENT_MAX) ?? d.agentLimit,
    supportOn: flag(v[ST.supportOn]) ?? d.supportOn,
  };
}

/** 채팅 변수로 적을 값. 에셋 모듈 로어북이 getvar로 읽는다 (원본 ensureDefaults와 같은 형식) */
export function basicVars(s: BasicSettings): ScriptState {
  return {
    [ST.assetOn]: s.assetOn ? '1' : '0',
    [ST.assetModel]: s.assetModel,
    [ST.assetPlayer]: s.assetPlayer ? '1' : '0',
    [ST.assetLimit]: String(s.assetLimit),
    [ST.agentLimit]: String(s.agentLimit),
    [ST.supportOn]: s.supportOn ? '1' : '0',
  };
}

/** 빠진 변수만 채운다. 바꿀 것이 없으면 null */
export function missingBasicVars(lore: LoreEntry[] | undefined, ss: ScriptState | undefined): ScriptState | null {
  const all = basicVars(basicSettings(lore, ss));
  const v = ss ?? {};
  const out: ScriptState = {};
  for (const [k, val] of Object.entries(all)) if (v[k] === undefined || v[k] === '' || v[k] === null || v[k] === 'null') out[k] = val;
  return Object.keys(out).length ? out : null;
}

/** 새 채팅의 괴이 생성 수치: 내장 기본값 < 옛 Settings 로어북 < 플러그인 저장소 */
export function worldDefaults(lore: LoreEntry[] | undefined): WorldSettings {
  const w = readSettingsBook(lore).world;
  const out: WorldSettings = { ...DEFAULT_SETTINGS };
  for (const f of WORLD_SPEC) {
    const n = worldValue(f, w[f.label]);
    if (n !== null) out[f.key] = n;
  }
  Object.assign(out, prefs.world);
  out.agent_limit = basicDefaults(lore).agentLimit;
  return out;
}

/** 이 채팅의 괴이 생성 수치 ($wg_* 채팅 변수가 있으면 그 값) + 요원 표시 인원 */
export function worldSettings(lore: LoreEntry[] | undefined, ss?: ScriptState): WorldSettings {
  const out = worldDefaults(lore);
  const v = ss ?? {};
  for (const f of WORLD_SPEC) {
    const n = worldValue(f, v[wgKey(f.key)]);
    if (n !== null) out[f.key] = n;
  }
  out.agent_limit = basicSettings(lore, ss).agentLimit;
  return out;
}

/** 시작할 때 채팅에 적을 괴이 생성 수치 (나중에 기본값을 바꿔도 이 채팅은 그대로) */
export function worldVarsOf(w: WorldSettings): ScriptState {
  const out: ScriptState = {};
  for (const f of WORLD_SPEC) out[wgKey(f.key)] = String(w[f.key]);
  return out;
}
