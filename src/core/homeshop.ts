// 망상홈쇼핑 방송 (2026-11-11 사용자: 컷 A 와이드·컷 B 바스트 두 장면으로 구현, 설계 /mnt/project-files/망상홈쇼핑_1109/방송화면_재설계_1109.md).
// 한 번 호출로 편성(상품 n개)·상품마다 큐시트·채팅을 받아, 화면이 큐시트를 차례로 재생한다 (컷|표정|대사|화면 사건).
// 상품 줄·요청문·참고 자료는 상점(core/shop.ts)을 그대로 쓰고, 설정 값만 사이트 것($hs_sh_*, 우주몰·포인트몰과 같은 방식).
// 여기는 순수 계산: 설정·저장 모양·응답 해석·동작 고르기. 화면은 ui/homeshop.ts, 그림은 host/homeshop.ts.
import { expectOf, type PackSpec } from './datapack';
import { parseShelf, shopSettings, ShopError, type ShopIdentity, type ShopItem, type ShopSettings } from './shop';

declare const __HOMESHOP_PACK__: string | undefined;
/** 방송 그림 팩: 방송 화면을 처음 열 때 받는다 (host/homeshop.ts) */
export const HOMESHOP_PACK: PackSpec = { name: 'goei-data-homeshop', label: '망상홈쇼핑 방송 그림', expect: expectOf(typeof __HOMESHOP_PACK__ === 'string' ? __HOMESHOP_PACK__ : undefined) };

export const HS_SITE = 'hs';
export const HS_NAME = '망상홈쇼핑';
export const HS_HOST = '레드 프라이데이';
/** 편성 상태 (상품·큐시트·채팅·지금 부) */
export const HS_VAR = '$hs_show';
/** 「창을 열 때」 자동 호출: 마지막으로 편성을 받은 응답 */
export const HS_AT_VAR = '$hs_show_at';

type Vars = Record<string, unknown> | undefined;
const clean = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
function numIn(v: unknown, def: number, lo: number, hi: number, round = true): number {
  const n = Number(v);
  if (v === undefined || v === '' || !Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, round ? Math.round(n) : n));
}

// ── 그림 팩 ──

export type ClipGroup = 'base' | 'filler' | 'event' | 'rare' | 'off';
export const CLIP_GROUPS: ClipGroup[] = ['base', 'filler', 'event', 'rare', 'off'];
export const CLIP_GROUP_LABEL: Record<ClipGroup, string> = { base: '기본', filler: '가끔', event: '대사·사건', rare: '드물게', off: '안 씀' };
export interface HsClip { name: string; ko: string; ver: string; group: ClipGroup; frames: number; file: string }
export type CutId = 'A' | 'B';
export interface HsCutArt {
  plate: string;
  /** 불 꺼진 판 (전구 반짝임: 전구 자리만 이 판의 점으로 바꾼다. 영업 안 함 화면) */
  off?: string;
  host: string;
  x: number;
  y: number;
  /** 이 줄부터 아래는 배경 판을 진행자 위에 다시 덮는다 (진열대) */
  over?: number;
  /** 뒷벽 화면 칸 [x0,y0,x1,y1] */
  screen?: [number, number, number, number];
  /** 전구 [x, y, 반지름] */
  bulbs?: [number, number, number][];
  clips: HsClip[];
}
export interface HsPack {
  w: number;
  h: number;
  box: number;
  cuts: Record<CutId, HsCutArt>;
  files: Record<string, string>;
  font: string;
}
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 방송 그림 팩 글을 푼다 (scripts/data-pack.mjs homeshopPackText). 형식이 다르면 던진다 */
export function parseHomeshopPack(text: string): HsPack {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('방송 그림 팩이 JSON 이 아니에요.');
  }
  if (!obj(j) || j.schema !== 1 || j.kind !== 'homeshop' || !obj(j.meta) || !obj(j.files)) throw new Error('방송 그림 팩 형식이 달라요.');
  const m = j.meta as Record<string, unknown>;
  const files = j.files as Record<string, string>;
  const cut = (v: unknown): HsCutArt => {
    if (!obj(v) || typeof v.plate !== 'string' || typeof v.host !== 'string' || !Array.isArray(v.clips)) throw new Error('방송 그림 팩 형식이 달라요 (컷).');
    const clips = (v.clips as unknown[]).filter((c): c is HsClip => obj(c) && typeof c.name === 'string' && typeof c.file === 'string' && typeof files[c.file as string] === 'string' && Number(c.frames) > 0)
      .map((c) => ({ name: c.name, ko: String(c.ko ?? c.name), ver: String(c.ver ?? '1'), group: (CLIP_GROUPS as string[]).includes(String(c.group)) ? (c.group as ClipGroup) : 'event', frames: Number(c.frames), file: c.file }));
    return {
      plate: v.plate, host: v.host, x: Number(v.x) || 0, y: Number(v.y) || 0, clips,
      ...(typeof v.off === 'string' ? { off: v.off } : {}),
      ...(typeof v.over === 'number' ? { over: v.over } : {}),
      ...(Array.isArray(v.screen) && v.screen.length === 4 ? { screen: v.screen.map(Number) as [number, number, number, number] } : {}),
      ...(Array.isArray(v.bulbs) ? { bulbs: (v.bulbs as unknown[]).filter(Array.isArray).map((b) => [Number(b[0]), Number(b[1]), Number(b[2]) || 4] as [number, number, number]) } : {}),
    };
  };
  if (!obj(m.cuts)) throw new Error('방송 그림 팩 형식이 달라요 (cuts).');
  return { w: Number(m.w) || 512, h: Number(m.h) || 384, box: Number(m.box) || 256, cuts: { A: cut(m.cuts.A), B: cut(m.cuts.B) }, files, font: typeof j.font === 'string' ? j.font : '' };
}

// ── 설정 (채팅마다, 전부 설정 → 인터넷 → 망상홈쇼핑에서 고친다. 여기 값은 기본값일 뿐) ──

/** 상점 설정 이름($sh_*) → 망상홈쇼핑 이름($hs_sh_*) */
export const hsKey = (shKey: string): string => `$hs_${shKey.slice(1)}`;
/** 상점 설정 함수에 넘길 변수: $hs_sh_* 를 $sh_* 로 비춘다 (core/malls.ts mallVars 와 같은 방식) */
export function hsVars(vars: Vars): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(vars ?? {})) if (!k.startsWith('$sh_')) out[k] = v;
  for (const [k, v] of Object.entries(vars ?? {})) if (k.startsWith('$hs_sh_')) out[`$sh_${k.slice(7)}`] = v;
  return out;
}

export const HS_KEY = {
  on: '$hs_on', net: '$hs_net', auto: '$hs_sh_auto',
  chatMin: '$hs_chat_min', chatMax: '$hs_chat_max', chatGap: '$hs_chat_gap',
  cueMin: '$hs_cue_min', cueMax: '$hs_cue_max',
  speed: '$hs_speed', hold: '$hs_hold', frame: '$hs_frame',
  cut: '$hs_fx_cut', bulb: '$hs_fx_bulb', tear: '$hs_fx_tear', tearP: '$hs_tear_p', scan: '$hs_fx_scan',
  fillLo: '$hs_fill_lo', fillHi: '$hs_fill_hi', fillCool: '$hs_fill_cool', rareP: '$hs_rare_p', rareCool: '$hs_rare_cool',
  clips: '$hs_clips', scalePc: '$hs_scale_pc', scalePhone: '$hs_scale_ph',
  next: '$hs_next', turn: '$hs_turn', lock: '$hs_lock', left: '$hs_left',
} as const;
/** 숫자 칸 범위·기본값 (설정 화면과 읽기가 같이 쓴다) */
export const HS_NUM: Record<string, { key: string; lo: number; hi: number; def: number; unit: string }> = {
  chatMin: { key: HS_KEY.chatMin, lo: 0, hi: 120, def: 40, unit: '줄' },
  chatMax: { key: HS_KEY.chatMax, lo: 0, hi: 120, def: 60, unit: '줄' },
  chatGap: { key: HS_KEY.chatGap, lo: 5, hi: 100, def: 22, unit: '×0.1초' },
  cueMin: { key: HS_KEY.cueMin, lo: 2, hi: 20, def: 6, unit: '줄' },
  cueMax: { key: HS_KEY.cueMax, lo: 2, hi: 20, def: 10, unit: '줄' },
  speed: { key: HS_KEY.speed, lo: 3, hi: 40, def: 11, unit: '자/초' },
  hold: { key: HS_KEY.hold, lo: 0, hi: 50, def: 12, unit: '×0.1초' },
  frame: { key: HS_KEY.frame, lo: 50, hi: 250, def: 110, unit: 'ms' },
  tearP: { key: HS_KEY.tearP, lo: 0, hi: 100, def: 6, unit: '%' },
  fillLo: { key: HS_KEY.fillLo, lo: 1, hi: 30, def: 3, unit: '번' },
  fillHi: { key: HS_KEY.fillHi, lo: 1, hi: 30, def: 6, unit: '번' },
  fillCool: { key: HS_KEY.fillCool, lo: 0, hi: 60, def: 8, unit: '번' },
  rareP: { key: HS_KEY.rareP, lo: 0, hi: 100, def: 10, unit: '%' },
  rareCool: { key: HS_KEY.rareCool, lo: 0, hi: 120, def: 20, unit: '번' },
  next: { key: HS_KEY.next, lo: 0, hi: 60, def: 6, unit: '초' },
  left: { key: HS_KEY.left, lo: 1, hi: 999, def: 30, unit: '개' },
};
export type HsAuto = 'manual' | 'open';
export type HsScale = 'auto' | '0.5' | '1' | '2';
export interface HsRules {
  /** 대기 동작을 몇 번 돌린 뒤 「가끔」 동작을 하나 끼울지 [최소, 최대] */
  fill: [number, number];
  /** 같은 「가끔」 동작이 다시 나오기까지 대기 반복 수 */
  fillCool: number;
  /** 「가끔」 자리에서 「드물게」 동작이 대신 나올 확률 (0~1) */
  rareP: number;
  /** 「드물게」 동작이 다시 나오기까지 대기 반복 수 */
  rareCool: number;
}
export interface HsSettings {
  on: boolean;
  /** 인터넷 즐겨찾기에 상시 노출 */
  net: boolean;
  auto: HsAuto;
  shop: ShopSettings;
  chat: [number, number];
  /** 채팅 한 줄 간격 (초) */
  chatGap: number;
  cue: [number, number];
  /** 자막 속도 (글자/초) · 대사 뒤 쉼 (초) · 동작 한 장 길이 (ms) */
  speed: number;
  hold: number;
  frame: number;
  fx: { cut: boolean; bulb: boolean; tear: boolean; scan: boolean; tearP: number };
  rules: HsRules;
  /** 동작 분류 고침 (「컷:이름=분류」 줄) */
  clipsText: string;
  scalePc: HsScale;
  scalePhone: HsScale;
  /** 큐시트가 끝난 뒤 다음 부로 넘어가기까지 (초, 0 = 안 넘어감) */
  next: number;
  /** 본편 턴이 넘어가면 편성 한 칸 넘기기 · 지난 부 잠그기 */
  turn: boolean;
  lock: boolean;
  /** 남은 수량 시작 값 */
  left: number;
}
const n = (vars: Vars, k: keyof typeof HS_NUM) => numIn(vars?.[HS_NUM[k].key], HS_NUM[k].def, HS_NUM[k].lo, HS_NUM[k].hi);
const scaleOf = (v: unknown, def: HsScale): HsScale => (v === '0.5' || v === '1' || v === '2' || v === 'auto' ? v : def);
export function hsSettings(vars: Vars): HsSettings {
  const shop = shopSettings(hsVars(vars));
  const pair = (a: number, b: number): [number, number] => [Math.min(a, b), Math.max(a, b)];
  // 상품 수 기본 3~5 (상점 기본 대신): 따로 고치지 않았을 때만
  const size: [number, number] = vars?.[hsKey('$sh_min')] === undefined && vars?.[hsKey('$sh_max')] === undefined ? [3, 5] : shop.size;
  return {
    on: vars?.[HS_KEY.on] !== '0',
    net: vars?.[HS_KEY.net] !== '0',
    auto: vars?.[HS_KEY.auto] === 'manual' ? 'manual' : 'open',
    shop: { ...shop, on: true, size, feature: false, kick: false },
    chat: pair(n(vars, 'chatMin'), n(vars, 'chatMax')),
    chatGap: n(vars, 'chatGap') / 10,
    cue: pair(n(vars, 'cueMin'), n(vars, 'cueMax')),
    speed: n(vars, 'speed'),
    hold: n(vars, 'hold') / 10,
    frame: n(vars, 'frame'),
    fx: { cut: vars?.[HS_KEY.cut] !== '0', bulb: vars?.[HS_KEY.bulb] !== '0', tear: vars?.[HS_KEY.tear] !== '0', scan: vars?.[HS_KEY.scan] !== '0', tearP: n(vars, 'tearP') / 100 },
    rules: { fill: pair(n(vars, 'fillLo'), n(vars, 'fillHi')), fillCool: n(vars, 'fillCool'), rareP: n(vars, 'rareP') / 100, rareCool: n(vars, 'rareCool') },
    clipsText: String(vars?.[HS_KEY.clips] ?? ''),
    scalePc: scaleOf(vars?.[HS_KEY.scalePc], 'auto'),
    scalePhone: scaleOf(vars?.[HS_KEY.scalePhone], '0.5'),
    next: n(vars, 'next'),
    turn: vars?.[HS_KEY.turn] !== '0',
    lock: vars?.[HS_KEY.lock] !== '0',
    left: n(vars, 'left'),
  };
}

/** 동작 분류 고침 글 → { 'B:grin': 'off' }. 한 줄에 「컷:이름=분류」(분류: 기본·가끔·대사·드물게·안씀 또는 base·filler·event·rare·off) */
const GROUP_WORD: Record<string, ClipGroup> = { base: 'base', 기본: 'base', filler: 'filler', 가끔: 'filler', event: 'event', 대사: 'event', 사건: 'event', rare: 'rare', 드물게: 'rare', off: 'off', 안씀: 'off' };
export function parseClipGroups(text: string): Record<string, ClipGroup> {
  const out: Record<string, ClipGroup> = {};
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = /^\s*([AB])\s*[:：]\s*([^=＝]+?)\s*[=＝]\s*(\S+)\s*$/i.exec(line);
    const g = m ? GROUP_WORD[m[3].replace(/\s/g, '').toLowerCase()] : undefined;
    if (m && g) out[`${m[1].toUpperCase()}:${m[2].trim().toLowerCase()}`] = g;
  }
  return out;
}
/** 설정에서 고친 분류를 입힌 동작 목록 (이름은 영문·우리말 어느 쪽으로 적어도 됨) */
export function clipsOf(art: HsCutArt, cut: CutId, over: Record<string, ClipGroup>): HsClip[] {
  return art.clips.map((c) => ({ ...c, group: over[`${cut}:${c.name.toLowerCase()}`] ?? over[`${cut}:${c.ko.toLowerCase()}`] ?? c.group }));
}

// ── 편성 (저장 모양) ──

/** 큐시트의 컷: A 와이드 · B 바스트 · C 상품 클로즈업(A 를 코드로 2배) · D 전화 연결(B 위 그래픽) */
export type CueCut = 'A' | 'B' | 'C' | 'D';
export const CUE_CUT_WORD: Record<CueCut, string> = { A: '와이드', B: '바스트', C: '상품', D: '전화' };
export type CueEvent = '' | 'price' | 'left' | 'rush' | 'soon' | 'sold' | 'call' | 'tear' | 'look';
/** 화면 사건 낱말 (모델에 주는 것과 읽는 것이 같게) */
export const CUE_EVENT_WORD: Record<Exclude<CueEvent, ''>, string> = { price: '가격 공개', left: '남은 수량 -N', rush: '주문 폭주', soon: '매진 임박', sold: '매진', call: '전화 연결', tear: '신호 찢김', look: '응시' };
export interface HsCue {
  cut: CueCut;
  /** 표정 = 동작 이름 (팩의 name. 모르는 말이면 talk) */
  mood: string;
  text: string;
  ev: CueEvent;
  /** 남은 수량 -N 의 N */
  n?: number;
}
export interface HsPart {
  item: ShopItem;
  cues: HsCue[];
}
export interface HsChatLine { nick: string; text: string }
export interface HsShow {
  loaded: boolean;
  /** 받은 응답 키 */
  key: string;
  title: string;
  parts: HsPart[];
  chat: HsChatLine[];
  /** 지금 방송 중인 부 (0부터). parts.length 이면 방송 끝 */
  at: number;
  /** 지난 편성의 상품 이름 (새로 받을 때 피하기) */
  prev: string[];
}
export const emptyShow = (): HsShow => ({ loaded: false, key: '', title: '', parts: [], chat: [], at: 0, prev: [] });

const CUT_IN: [RegExp, CueCut][] = [[/^(a|와이드|wide|전체|스튜디오)/i, 'A'], [/^(b|바스트|bust|정면|진행자)/i, 'B'], [/^(c|상품|클로즈|close|product)/i, 'C'], [/^(d|전화|call|phone)/i, 'D']];
function eventOf(cell: string): { ev: CueEvent; n?: number } {
  const s = cell.replace(/\s+/g, '');
  if (!s || s === '-') return { ev: '' };
  const left = /남은수량[-−–]?(\d+)|수량[-−–](\d+)/.exec(s);
  if (left) return { ev: 'left', n: Math.max(1, Math.min(99, Number(left[1] ?? left[2]))) };
  if (/가격공개|가격/.test(s)) return { ev: 'price' };
  if (/주문폭주|폭주/.test(s)) return { ev: 'rush' };
  if (/매진임박|임박/.test(s)) return { ev: 'soon' };
  if (/매진|완판/.test(s)) return { ev: 'sold' };
  if (/전화/.test(s)) return { ev: 'call' };
  if (/찢김|신호|끊김/.test(s)) return { ev: 'tear' };
  if (/응시|시선|쳐다/.test(s)) return { ev: 'look' };
  return { ev: '' };
}
/** 큐 한 줄 「컷|표정|대사|화면 사건」. 대사가 없으면 null */
export function parseCue(line: string, moods: Map<string, string>): HsCue | null {
  const cells = line.split('|').map((x) => x.trim());
  if (cells.length < 3) return null;
  const text = clean(cells[2], 160);
  if (!text) return null;
  const cut = CUT_IN.find(([re]) => re.test(cells[0]))?.[1] ?? 'B';
  const mood = moods.get(cells[1].replace(/\s+/g, '').toLowerCase()) ?? 'talk';
  return { cut, mood, text, ...eventOf(cells[3] ?? '') };
}
/** 표정 낱말 → 동작 이름 (팩의 우리말 이름·영문 이름 둘 다 받는다) */
export function moodMap(pack: Pick<HsPack, 'cuts'> | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of [...(pack?.cuts.A.clips ?? []), ...(pack?.cuts.B.clips ?? [])]) {
    m.set(c.name.toLowerCase(), c.name);
    m.set(c.ko.replace(/\s+/g, '').toLowerCase(), c.name);
  }
  return m;
}

export class HsError extends ShopError {}
const HS_IDENTITY: ShopIdentity = { sells: HS_NAME, never: '', prices: '' };
function block(raw: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}\\s*>`, 'i').exec(raw);
  return m ? m[1].trim() : '';
}
export interface ShowReply { title: string; items: Omit<ShopItem, 'id'>[]; cues: HsCue[][]; chat: HsChatLine[] }
/** 편성 응답: <title> · <shelf>(상점 줄) · <cue>(「#n」 아래 그 상품의 큐 줄) · <chat>(닉|말) */
export function parseShow(raw: string, moods: Map<string, string>): ShowReply {
  const shelf = parseShelf(raw, HS_IDENTITY);
  const cueText = block(raw, 'cue');
  if (!cueText) throw new HsError('응답에 <cue> 블록이 없어요.');
  const cues: HsCue[][] = [];
  let cur: HsCue[] | null = null;
  for (const line of cueText.split('\n')) {
    if (/^\s*#\s*\d+/.test(line)) {
      cur = [];
      cues.push(cur);
      continue;
    }
    const c = parseCue(line, moods);
    if (!c) continue;
    if (!cur) {
      cur = [];
      cues.push(cur);
    }
    cur.push(c);
  }
  const items = shelf.items.slice(0, cues.length || shelf.items.length);
  if (items.some((_, i) => !cues[i]?.length)) throw new HsError(`<cue> 블록에 상품마다 큐 줄이 있어야 해요 (#1 … #${shelf.items.length}, 줄 꼴: 컷|표정|대사|화면 사건).`);
  const chat: HsChatLine[] = [];
  for (const line of block(raw, 'chat').split('\n')) {
    const i = line.indexOf('|');
    const nick = clean(i >= 0 ? line.slice(0, i) : '', 16);
    const text = clean(i >= 0 ? line.slice(i + 1) : line, 80);
    if (text) chat.push({ nick: nick || '익명', text });
  }
  return { title: clean(block(raw, 'title'), 40), items, cues: cues.slice(0, items.length), chat };
}

let seq = 0;
const itemId = (key: string, i: number) => `ms${(Date.now() % 1e9).toString(36)}${(seq++).toString(36)}_${i}_${key.slice(-4)}`;
/** 받은 편성을 상태로 (지금 부는 처음부터) */
export function applyShow(st: HsShow, r: ShowReply, key: string): HsShow {
  const parts = r.items.map((it, i) => ({ item: { ...it, id: itemId(key, i) }, cues: r.cues[i] }));
  return { loaded: true, key, title: r.title, parts, chat: r.chat, at: 0, prev: [...st.prev, ...st.parts.map((p) => p.item.name)].slice(-24) };
}

export function readShow(vars: Vars): HsShow {
  const raw = vars?.[HS_VAR];
  if (typeof raw !== 'string' || !raw) return emptyShow();
  try {
    const j = JSON.parse(raw) as Partial<HsShow>;
    if (!j || !Array.isArray(j.parts)) return emptyShow();
    const parts = j.parts.filter((p): p is HsPart => !!p && typeof p === 'object' && !!p.item && typeof p.item.name === 'string' && Array.isArray(p.cues));
    return {
      loaded: j.loaded === true && parts.length > 0, key: String(j.key ?? ''), title: String(j.title ?? ''), parts,
      chat: Array.isArray(j.chat) ? j.chat.filter((c): c is HsChatLine => !!c && typeof c.text === 'string').map((c) => ({ nick: String(c.nick ?? ''), text: c.text })) : [],
      at: Math.max(0, Math.min(parts.length, Math.floor(Number(j.at) || 0))),
      prev: Array.isArray(j.prev) ? j.prev.map(String).slice(-24) : [],
    };
  } catch {
    return emptyShow();
  }
}
export const showVars = (st: HsShow): Record<string, string> => ({ [HS_VAR]: JSON.stringify(st) });

/** 할부 회차: 값 칸의 글(「무이자 10회」)에서 숫자. 없으면 0 */
export const installments = (it: Pick<ShopItem, 'pay'>): number => Number(/(\d+)\s*회/.exec(it.pay ?? '')?.[1] ?? 0);

// ── 동작 고르기 (재생 규칙. 기본값은 game-src/homeshop/homeshop.json 과 HS_NUM, 전부 설정에서 고친다) ──

export interface IdleState {
  /** 대기 동작을 돈 횟수 (전체) */
  loops: number;
  /** 다음 「가끔」 자리까지 남은 대기 반복 */
  until: number;
  /** 동작 이름 → 마지막으로 쓴 때의 loops */
  last: Record<string, number>;
  /** 동작 이름 → 마지막으로 쓴 판 */
  ver: Record<string, string>;
  lastFill: string;
}
export const idleState = (): IdleState => ({ loops: 0, until: -1, last: {}, ver: {}, lastFill: '' });
const between = (r: [number, number], rnd: () => number) => r[0] + Math.floor(rnd() * (r[1] - r[0] + 1));
/** 같은 이름의 1·2판은 번갈아 */
export function pickVersion(clips: HsClip[], name: string, st: IdleState): HsClip | null {
  const list = clips.filter((c) => c.name === name && c.group !== 'off');
  if (!list.length) return null;
  const c = list.find((x) => x.ver !== st.ver[name]) ?? list[0];
  st.ver[name] = c.ver;
  return c;
}
/** 아무 일 없을 때 다음에 틀 동작: 기본 대기를 돌리다가 정해진 횟수마다 「가끔」 하나, 그 자리에서 확률로 「드물게」 */
export function nextIdle(clips: HsClip[], st: IdleState, rules: HsRules, rnd: () => number = Math.random): HsClip | null {
  const base = clips.find((c) => c.group === 'base') ?? clips.find((c) => c.group !== 'off') ?? null;
  if (st.until < 0) st.until = between(rules.fill, rnd);
  if (st.until > 0) {
    st.until--;
    st.loops++;
    return base;
  }
  st.until = between(rules.fill, rnd);
  st.loops++;
  const ready = (name: string, cool: number) => st.last[name] === undefined || st.loops - st.last[name] > cool;
  const names = (g: ClipGroup) => [...new Set(clips.filter((c) => c.group === g).map((c) => c.name))];
  const rare = names('rare').filter((x) => ready(x, rules.rareCool));
  const lastRare = Math.max(-Infinity, ...names('rare').map((x) => st.last[x] ?? -Infinity));
  let name = '';
  if (rare.length && st.loops - lastRare > rules.rareCool && rnd() < rules.rareP) name = rare[Math.floor(rnd() * rare.length)];
  else {
    const fill = names('filler').filter((x) => x !== st.lastFill && ready(x, rules.fillCool));
    const any = fill.length ? fill : names('filler').filter((x) => x !== st.lastFill);
    if (any.length) {
      name = any[Math.floor(rnd() * any.length)];
      st.lastFill = name;
    }
  }
  if (!name) return base;
  st.last[name] = st.loops;
  return pickVersion(clips, name, st) ?? base;
}
/** 큐의 표정에 맞는 동작. 그 컷에 없으면 말하기, 그것도 없으면 기본 */
export function moodClip(clips: HsClip[], mood: string, st: IdleState): HsClip | null {
  return pickVersion(clips, mood, st) ?? pickVersion(clips, 'talk', st) ?? clips.find((c) => c.group === 'base') ?? null;
}
/** 큐 한 줄의 길이 (ms): 글자 수 ÷ 자막 속도 + 쉼 */
export const cueMs = (c: Pick<HsCue, 'text'>, s: Pick<HsSettings, 'speed' | 'hold'>): number => Math.round((Array.from(c.text).length / s.speed + s.hold) * 1000);
