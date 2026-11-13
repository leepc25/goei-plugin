// 망상홈쇼핑 방송 (2026-11-11 사용자: 컷 A 와이드·컷 B 바스트 두 장면으로 구현, 설계 /mnt/project-files/망상홈쇼핑_1109/방송화면_재설계_1109.md).
// 한 번 호출로 편성(상품 n개)·상품마다 큐시트·채팅을 받아, 화면이 큐시트를 차례로 재생한다 (컷|표정|대사|화면 사건).
// 상품 줄·요청문·참고 자료는 상점(core/shop.ts)을 그대로 쓰고, 설정 값만 사이트 것($hs_sh_*, 우주몰·포인트몰과 같은 방식).
// 여기는 순수 계산: 설정·저장 모양·응답 해석·동작 고르기. 화면은 ui/homeshop.ts, 그림은 host/homeshop.ts.
import { expectOf, type PackSpec } from './datapack';
import { lastBot, parseShelf, shopSettings, ShopError, SHOP_CTX_VAR, SHOP_SHARED_VARS, type ShopIdentity, type ShopItem, type ShopSettings } from './shop';
import type { Chat } from './types';
import { userTurns, type PromptMessage } from './request';
import { aliveAnchors } from './wallet';
import { fillGuide, guideSections } from './guides';

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
  /** 가림 판: 배경 판과 같은 크기, 진행자를 가리는 곳(진열대 윤곽 그대로)만 판의 점이 있다. 진행자를 다 그린 뒤 덮는다. 없으면 over 줄로 (tools/homeshop/over_mask.py) */
  mask?: string;
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
      ...(typeof v.mask === 'string' && typeof files[v.mask] === 'string' ? { mask: v.mask } : {}),
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
/** 상점 설정 함수에 넘길 변수: $hs_sh_* 를 $sh_* 로 비춘다 (core/malls.ts mallVars 와 같은 방식)
 *  맥락 반영은 제 값($hs_sh_ctx)이 '1'/'0'이면 그 값, 없으면 기본 상점 값 (가게 표와 맞춤, 전수검사 11-13) */
export function hsVars(vars: Vars): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(vars ?? {})) if (!k.startsWith('$sh_') || SHOP_SHARED_VARS.includes(k)) out[k] = v;
  for (const [k, v] of Object.entries(vars ?? {})) {
    if (!k.startsWith('$hs_sh_')) continue;
    const sh = `$sh_${k.slice(7)}`;
    if (sh === SHOP_CTX_VAR ? v !== '1' && v !== '0' : SHOP_SHARED_VARS.includes(sh)) continue;
    out[sh] = v;
  }
  return out;
}

export const HS_KEY = {
  on: '$hs_on', net: '$hs_net', auto: '$hs_sh_auto',
  chatMin: '$hs_chat_min', chatMax: '$hs_chat_max', chatGap: '$hs_chat_gap',
  cueMin: '$hs_cue_min', cueMax: '$hs_cue_max',
  sayCueMin: '$hs_say_cue_min', sayCueMax: '$hs_say_cue_max', sayChatMin: '$hs_say_chat_min', sayChatMax: '$hs_say_chat_max',
  speed: '$hs_speed', hold: '$hs_hold', frame: '$hs_frame',
  cut: '$hs_fx_cut', bulb: '$hs_fx_bulb', tear: '$hs_fx_tear', tearP: '$hs_tear_p', scan: '$hs_fx_scan',
  fillLo: '$hs_fill_lo', fillHi: '$hs_fill_hi', fillCool: '$hs_fill_cool', rareP: '$hs_rare_p', rareCool: '$hs_rare_cool',
  clips: '$hs_clips', read: '$hs_read', scalePc: '$hs_scale_pc', scalePhone: '$hs_scale_ph',
  next: '$hs_next', turn: '$hs_turn', lock: '$hs_lock', left: '$hs_left',
  drop: '$hs_drop', dropRate: '$hs_drop_rate', dropFast: '$hs_drop_fast', dropStep: '$hs_drop_step', soonAt: '$hs_soon_at', endLo: '$hs_end_lo', endHi: '$hs_end_hi',
  callLo: '$hs_call_lo', callHi: '$hs_call_hi', forms: '$hs_forms', aud: '$hs_aud_on', peek: '$hs_peek', say: '$hs_say', barter: '$hs_barter',
} as const;
/** 숫자 칸 범위·기본값 (설정 화면과 읽기가 같이 쓴다) */
export const HS_NUM: Record<string, { key: string; lo: number; hi: number; def: number; unit: string }> = {
  chatMin: { key: HS_KEY.chatMin, lo: 0, hi: 120, def: 30, unit: '줄' },
  chatMax: { key: HS_KEY.chatMax, lo: 0, hi: 120, def: 40, unit: '줄' },
  chatGap: { key: HS_KEY.chatGap, lo: 5, hi: 100, def: 22, unit: '×0.1초' },
  cueMin: { key: HS_KEY.cueMin, lo: 2, hi: 20, def: 12, unit: '줄' },
  cueMax: { key: HS_KEY.cueMax, lo: 2, hi: 20, def: 16, unit: '줄' },
  sayCueMin: { key: HS_KEY.sayCueMin, lo: 1, hi: 6, def: 1, unit: '줄' },
  sayCueMax: { key: HS_KEY.sayCueMax, lo: 1, hi: 6, def: 3, unit: '줄' },
  sayChatMin: { key: HS_KEY.sayChatMin, lo: 0, hi: 12, def: 2, unit: '줄' },
  sayChatMax: { key: HS_KEY.sayChatMax, lo: 0, hi: 12, def: 5, unit: '줄' },
  speed: { key: HS_KEY.speed, lo: 3, hi: 40, def: 11, unit: '자/초' },
  hold: { key: HS_KEY.hold, lo: 0, hi: 50, def: 12, unit: '×0.1초' },
  frame: { key: HS_KEY.frame, lo: 50, hi: 250, def: 110, unit: 'ms' },
  tearP: { key: HS_KEY.tearP, lo: 0, hi: 100, def: 6, unit: '%' },
  fillLo: { key: HS_KEY.fillLo, lo: 1, hi: 30, def: 3, unit: '번' },
  fillHi: { key: HS_KEY.fillHi, lo: 1, hi: 30, def: 6, unit: '번' },
  fillCool: { key: HS_KEY.fillCool, lo: 0, hi: 60, def: 8, unit: '번' },
  rareP: { key: HS_KEY.rareP, lo: 0, hi: 100, def: 10, unit: '%' },
  rareCool: { key: HS_KEY.rareCool, lo: 0, hi: 120, def: 20, unit: '번' },
  next: { key: HS_KEY.next, lo: 0, hi: 60, def: 0, unit: '초' },
  left: { key: HS_KEY.left, lo: 1, hi: 999, def: 30, unit: '개' },
  dropRate: { key: HS_KEY.dropRate, lo: 10, hi: 400, def: 100, unit: '%' },
  dropFast: { key: HS_KEY.dropFast, lo: 10, hi: 50, def: 20, unit: '×0.1배' },
  dropStep: { key: HS_KEY.dropStep, lo: 1, hi: 20, def: 3, unit: '개' },
  soonAt: { key: HS_KEY.soonAt, lo: 0, hi: 99, def: 5, unit: '개' },
  endLo: { key: HS_KEY.endLo, lo: 1, hi: 99, def: 2, unit: '개' },
  endHi: { key: HS_KEY.endHi, lo: 1, hi: 99, def: 8, unit: '개' },
  callLo: { key: HS_KEY.callLo, lo: 1, hi: 60, def: 6, unit: '턴' },
  callHi: { key: HS_KEY.callHi, lo: 1, hi: 60, def: 12, unit: '턴' },
};
/** 출연 형태 기본 목록 (설정에서 고친다, 쉼표·줄바꿈으로 나눔) */
/** 주문 전화번호 기본값 */
export const HS_TEL_DEFAULT = '080-404-0000';
/** 내 채팅을 읽는 동안 진행자 컷에서 대기와 번갈아 트는 동작 (이름은 영문·우리말 어느 쪽이든) */
export const HS_READ_DEFAULT = '고개 꺾기, 굳은 응시';
export const HS_FORMS_DEFAULT = '전화 출연, 엑스트라, 모델';
export type HsAuto = 'manual' | 'open';
export type HsScale = 'auto' | 'fit' | '0.5' | '1' | '2';
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
/** 남은 수량이 저절로 줄기: 빠르기(1 = 큐시트 끝에 맞춤) · 가격 공개·주문 폭주 뒤 배수 · 매진 임박 기준 수(0 = 안 붙임) · 끝날 때 남기는 수 [최소, 최대] */
export interface HsDrop {
  on: boolean;
  rate: number;
  fast: number;
  /** 한 번에 줄어드는 수 최대 */
  step: number;
  soon: number;
  end: [number, number];
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
  /** 내 채팅 한 번에 돌아오는 진행자 줄 수 · 다른 시청자 줄 수 */
  sayCue: [number, number];
  sayChat: [number, number];
  /** 자막 속도 (글자/초) · 대사 뒤 쉼 (초) · 동작 한 장 길이 (ms) */
  speed: number;
  hold: number;
  frame: number;
  fx: { cut: boolean; bulb: boolean; tear: boolean; scan: boolean; tearP: number };
  rules: HsRules;
  /** 동작 분류 고침 (「컷:이름=분류」 줄) */
  clipsText: string;
  /** 내 채팅을 읽는 동안 트는 동작 이름들 */
  read: string[];
  scalePc: HsScale;
  scalePhone: HsScale;
  /** 큐시트가 끝난 뒤 다음 부로 넘어가기까지 (초, 0 = 안 넘어감) */
  next: number;
  /** 본편 턴이 넘어가면 편성 한 칸 넘기기 · 지난 부 잠그기 */
  turn: boolean;
  lock: boolean;
  /** 남은 수량 시작 값 */
  left: number;
  drop: HsDrop;
  /** 할부 호출: 다음 호출까지 턴 [최소, 최대] · 출연 형태 목록 */
  call: [number, number];
  forms: string[];
  /** 방청 신청 · 스티커 들추기 · 채팅 보내기 · 물건 맞교환 */
  aud: boolean;
  peek: boolean;
  say: boolean;
  barter: boolean;
}
/** 수 칸 하나를 적을 값. 최소·최대 줄(pair)이면 최소가 최대를 넘을 때 짝도 같이 맞춘다 (가게 표·게시판 표와 같은 방식, 전수검사 11-13) */
export function hsNumVars(vars: Vars, k: string, raw: number, pair?: readonly [string, string]): Record<string, string> {
  const d = HS_NUM[k];
  if (!d || !Number.isFinite(raw)) return {};
  const v = Math.max(d.lo, Math.min(d.hi, Math.round(raw)));
  const out: Record<string, string> = { [d.key]: String(v) };
  if (!pair || !pair.includes(k)) return out;
  const [a, b] = pair;
  const other = HS_NUM[k === a ? b : a];
  if (!other) return out;
  const cur = numIn(vars?.[other.key], other.def, other.lo, other.hi);
  if ((k === a && v > cur) || (k === b && v < cur)) out[other.key] = String(v);
  return out;
}
const n = (vars: Vars, k: keyof typeof HS_NUM) => numIn(vars?.[HS_NUM[k].key], HS_NUM[k].def, HS_NUM[k].lo, HS_NUM[k].hi);
const scaleOf = (v: unknown, def: HsScale): HsScale => (v === '0.5' || v === '1' || v === '2' || v === 'auto' || v === 'fit' ? v : def);
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
    sayCue: pair(n(vars, 'sayCueMin'), n(vars, 'sayCueMax')),
    sayChat: pair(n(vars, 'sayChatMin'), n(vars, 'sayChatMax')),
    speed: n(vars, 'speed'),
    hold: n(vars, 'hold') / 10,
    frame: n(vars, 'frame'),
    fx: { cut: vars?.[HS_KEY.cut] !== '0', bulb: vars?.[HS_KEY.bulb] !== '0', tear: vars?.[HS_KEY.tear] !== '0', scan: vars?.[HS_KEY.scan] !== '0', tearP: n(vars, 'tearP') / 100 },
    rules: { fill: pair(n(vars, 'fillLo'), n(vars, 'fillHi')), fillCool: n(vars, 'fillCool'), rareP: n(vars, 'rareP') / 100, rareCool: n(vars, 'rareCool') },
    clipsText: String(vars?.[HS_KEY.clips] ?? ''),
    read: (() => { const f = String(vars?.[HS_KEY.read] ?? '').split(/[,\n]/).map((x) => x.trim().slice(0, 30)).filter(Boolean); return f.length ? f : HS_READ_DEFAULT.split(',').map((x) => x.trim()); })(),
    scalePc: scaleOf(vars?.[HS_KEY.scalePc], 'auto'),
    scalePhone: scaleOf(vars?.[HS_KEY.scalePhone], 'auto'),
    next: n(vars, 'next'),
    turn: vars?.[HS_KEY.turn] !== '0',
    lock: vars?.[HS_KEY.lock] !== '0',
    left: n(vars, 'left'),
    drop: { on: vars?.[HS_KEY.drop] !== '0', rate: n(vars, 'dropRate') / 100, fast: n(vars, 'dropFast') / 10, step: n(vars, 'dropStep'), soon: n(vars, 'soonAt'), end: pair(n(vars, 'endLo'), n(vars, 'endHi')) },
    call: pair(n(vars, 'callLo'), n(vars, 'callHi')),
    forms: (() => { const f = String(vars?.[HS_KEY.forms] ?? '').split(/[,\n]/).map((x) => x.trim().slice(0, 30)).filter(Boolean); return f.length ? f : HS_FORMS_DEFAULT.split(',').map((x) => x.trim()); })(),
    aud: vars?.[HS_KEY.aud] !== '0',
    peek: vars?.[HS_KEY.peek] !== '0',
    say: vars?.[HS_KEY.say] !== '0',
    barter: vars?.[HS_KEY.barter] !== '0',
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
/** 모델에 주고 받는 컷 낱말 (11-12 사용자: 고르는 낱말은 영어로. 읽을 때는 우리말도 받는다) */
export const CUE_CUT_WORD: Record<CueCut, string> = { A: 'wide', B: 'bust', C: 'product', D: 'phone' };
export type CueEvent = '' | 'price' | 'left' | 'rush' | 'soon' | 'sold' | 'call' | 'tear' | 'look';
/** 화면 사건 낱말 (모델에 주는 것과 읽는 것이 같게) */
export const CUE_EVENT_WORD: Record<Exclude<CueEvent, ''>, string> = { price: 'price', left: 'left -N', rush: 'rush', soon: 'soon', sold: 'sold', call: 'call', tear: 'tear', look: 'look' };
/** 화면에 띄우는 사건 딱지 글 */
export const CUE_EVENT_LABEL: Record<Exclude<CueEvent, ''>, string> = { price: '가격 공개', left: '남은 수량', rush: '주문 폭주', soon: '매진 임박', sold: '매진', call: '전화 연결', tear: '신호 찢김', look: '응시' };
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
  /** 스티커를 들췄을 때 보이는 한 줄 (진실 보장 없음) */
  peek?: string;
  /** 이 부가 방송되는 동안 흐르는 시청자 채팅 (11-12 사용자: 상품마다) */
  chat?: HsChatLine[];
}
/** 전화 주문 상담원의 말 (편성과 같이 받는다) */
export interface HsOps { hello: string; done: string; barter: string }
export interface HsChatLine { nick: string; text: string }
export interface HsShow {
  loaded: boolean;
  /** 받은 응답 키 */
  key: string;
  title: string;
  parts: HsPart[];
  /** 부 머리(#n) 없이 온 채팅 (부마다 채팅이 없을 때만 쓴다) */
  chat: HsChatLine[];
  /** 지금 방송 중인 부 (0부터). parts.length 이면 방송 끝 */
  at: number;
  /** 지난 편성의 상품 이름 (새로 받을 때 피하기) */
  prev: string[];
  ops?: HsOps;
  /** 마지막으로 본 본편 응답 키 (본편 턴이 넘어가면 편성 한 칸) */
  tk?: string;
}
export const emptyShow = (): HsShow => ({ loaded: false, key: '', title: '', parts: [], chat: [], at: 0, prev: [] });

const CUT_IN: [RegExp, CueCut][] = [[/^(a|와이드|wide|전체|스튜디오)/i, 'A'], [/^(b|바스트|bust|정면|진행자)/i, 'B'], [/^(c|상품|클로즈|close|product)/i, 'C'], [/^(d|전화|call|phone)/i, 'D']];
function eventOf(cell: string): { ev: CueEvent; n?: number } {
  const s = cell.replace(/\s+/g, '').toLowerCase();
  if (!s || s === '-') return { ev: '' };
  const left = /(?:left|남은수량|수량)[-−–]?(\d+)/.exec(s);
  if (left) return { ev: 'left', n: Math.max(1, Math.min(99, Number(left[1]))) };
  if (/price|가격/.test(s)) return { ev: 'price' };
  if (/rush|폭주/.test(s)) return { ev: 'rush' };
  if (/soon|임박/.test(s)) return { ev: 'soon' };
  if (/sold|매진|완판/.test(s)) return { ev: 'sold' };
  if (/call|phone|전화/.test(s)) return { ev: 'call' };
  if (/tear|찢김|신호|끊김/.test(s)) return { ev: 'tear' };
  if (/look|stare|응시|시선|쳐다/.test(s)) return { ev: 'look' };
  return { ev: '' };
}
/** 큐 한 줄 「컷|표정|대사|화면 사건」. 대사가 없으면 null */
export function parseCue(line: string, moods: Map<string, string>): HsCue | null {
  const cells = line.split('|').map((x) => x.trim());
  if (cells.length < 3) return null;
  const text = clean(cells[2], 160);
  if (!text) return null;
  const cut = CUT_IN.find(([re]) => re.test(cells[0]))?.[1] ?? 'B';
  // 그림 묶음이 아직 안 왔으면(표정 표가 비었으면) 낱말 그대로 두고 재생 때 찾는다 (moodName)
  const word = cells[1].replace(/\s+/g, '').toLowerCase();
  const mood = moods.get(word) ?? (moods.size ? 'talk' : word || 'talk');
  return { cut, mood, text, ...eventOf(cells[3] ?? '') };
}
/** 저장된 표정(동작 이름 또는 그림이 늦어 남은 낱말) → 동작 이름 */
export const moodName = (mood: string, moods: Map<string, string>): string => moods.get(mood.replace(/\s+/g, '').toLowerCase()) ?? (moods.size ? 'talk' : mood);
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
export interface ShowReply { title: string; items: Omit<ShopItem, 'id'>[]; cues: HsCue[][]; chat: HsChatLine[]; chats: HsChatLine[][]; peeks: string[]; ops: HsOps }
/** 편성 응답: <title> · <shelf>(상점 줄) · <cue>(「#n」 아래 그 상품의 큐 줄) · <chat>(「#n」 아래 그 상품 동안의 닉|말) */
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
  if (items.some((_, i) => !cues[i]?.length)) throw new HsError(`<cue> 블록에 상품마다 큐 줄이 있어야 해요 (#1 … #${shelf.items.length}, 줄 꼴: cut|mood|line|event).`);
  const { shared: chat, parts: chats } = parseChat(block(raw, 'chat'));
  // 번호 머리('#3', '3.', '3)')만 뗀다. 구분 기호 없는 앞 숫자('3번 접으면')·소수('3.5배')는 글이라 둔다 (전수검사 11-13)
  const peeks = block(raw, 'peek').split('\n').map((x) => clean(x.replace(/^\s*(?:[#＃]\s*\d+\s*[.)|:]?|\d+\s*[.)|:](?!\d))\s*/, ''), 80)).filter(Boolean);
  const opLine = (re: RegExp) => clean(block(raw, 'operator').split('\n').map((x) => re.exec(x)?.[1] ?? '').find(Boolean) ?? '', 120);
  const ops: HsOps = { hello: opLine(/^\s*(?:인사|hello)\s*[|:]\s*(.+)$/i), done: opLine(/^\s*(?:확정|done)\s*[|:]\s*(.+)$/i), barter: opLine(/^\s*(?:맞교환|barter)\s*[|:]\s*(.+)$/i) };
  return { title: clean(block(raw, 'title'), 40), items, cues: cues.slice(0, items.length), chat, chats: chats.slice(0, items.length), peeks, ops };
}

/** 채팅 줄 「닉|말」. 「#n」 머리 아래 줄은 그 부의 것, 머리 앞 줄은 공용.
 *  머리는 「|」 없는 줄이 꾸밈 뒤 #숫자로 시작하면 (뒤 상품명·「.」·「:」는 버림, 전수검사 11-13) */
export function parseChat(text: string): { shared: HsChatLine[]; parts: HsChatLine[][] } {
  const shared: HsChatLine[] = [];
  const parts: HsChatLine[][] = [];
  let cur: HsChatLine[] = shared;
  for (const line of text.split('\n')) {
    const head = line.includes('|') ? null : /^[\s*_\[(【\-]*[#＃]\s*(\d+)/.exec(line);
    if (head) {
      const n = Math.max(1, Math.min(20, Number(head[1])));
      while (parts.length < n) parts.push([]);
      cur = parts[n - 1];
      continue;
    }
    const i = line.indexOf('|');
    const nick = clean(i >= 0 ? line.slice(0, i) : '', 16);
    const said = clean(i >= 0 ? line.slice(i + 1) : line, 80);
    if (said) cur.push({ nick: nick || '익명', text: said });
  }
  return { shared, parts };
}

let seq = 0;
const itemId = (key: string, i: number) => `ms${(Date.now() % 1e9).toString(36)}${(seq++).toString(36)}_${i}_${key.slice(-4)}`;
/** 받은 편성을 상태로 (지금 부는 처음부터) */
export function applyShow(st: HsShow, r: ShowReply, key: string): HsShow {
  const parts = r.items.map((it, i) => ({ item: { ...it, id: itemId(key, i) }, cues: r.cues[i], ...(r.peeks?.[i] ? { peek: r.peeks[i] } : {}), ...(r.chats?.[i]?.length ? { chat: r.chats[i] } : {}) }));
  return { loaded: true, key, title: r.title, parts, chat: r.chat, at: 0, prev: [...st.prev, ...st.parts.map((p) => p.item.name)].slice(-24), ...(r.ops ? { ops: r.ops } : {}), tk: key };
}

/** 본편 턴이 넘어갔으면 편성 한 칸 넘긴 상태, 아니면 null (다시 굴리기는 턴이 아니다). 자동 호출이 수동이어도 넘긴다 (전수검사 11-13) */
export function turnStep(show: HsShow, turnOn: boolean, key: string): HsShow | null {
  if (!turnOn || !show.loaded || show.tk === undefined || show.tk === key || show.at >= show.parts.length) return null;
  return { ...show, at: Math.min(show.at + 1, show.parts.length), tk: key };
}

export function readShow(vars: Vars): HsShow {
  const raw = vars?.[HS_VAR];
  if (typeof raw !== 'string' || !raw) return emptyShow();
  try {
    const j = JSON.parse(raw) as Partial<HsShow>;
    if (!j || !Array.isArray(j.parts)) return emptyShow();
    const lines = (x: unknown): HsChatLine[] => (Array.isArray(x) ? x.filter((c): c is HsChatLine => !!c && typeof c.text === 'string').map((c) => ({ nick: String(c.nick ?? ''), text: c.text })) : []);
    const parts = j.parts.filter((p): p is HsPart => !!p && typeof p === 'object' && !!p.item && typeof p.item.name === 'string' && Array.isArray(p.cues)).map((p) => { const { chat, ...rest } = p; const c = lines(chat); return c.length ? { ...rest, chat: c } : rest; });
    return {
      loaded: j.loaded === true && parts.length > 0, key: String(j.key ?? ''), title: String(j.title ?? ''), parts,
      chat: lines(j.chat),
      at: Math.max(0, Math.min(parts.length, Math.floor(Number(j.at) || 0))),
      prev: Array.isArray(j.prev) ? j.prev.map(String).slice(-24) : [],
      ...(j.ops && typeof j.ops === 'object' ? { ops: { hello: String(j.ops.hello ?? ''), done: String(j.ops.done ?? ''), barter: String(j.ops.barter ?? '') } } : {}),
      ...(typeof j.tk === 'string' ? { tk: j.tk } : {}),
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

// ── 남은 수량 저절로 줄기 (값은 전부 설정 HsDrop) ──

/** 한 번에 줄이는 수는 1~설정 「한 번에 줄어드는 수」. 너무 잦아지면(DROP_GAP_MS 안쪽, 화면 갱신 한계) 한 번에 더 많이 줄인다 */
const DROP_GAP_MS = 1000;
/** 이번 부에서 끝날 때 남길 수 (시작 값보다 작게, 1 이상) */
export const dropEnd = (left: number, d: HsDrop, rnd: () => number = Math.random): number =>
  Math.max(1, Math.min(left - 1, d.end[0] + Math.floor(rnd() * (d.end[1] - d.end[0] + 1))));
/** 남은 방송 길이(ms. 빨라지는 구간은 배수만큼 길게 친다)와 큐시트가 앞으로 뺄 수. at = 지금 큐 자리, restMs = 지금 큐의 남은 시간 */
export function dropRest(cues: HsCue[], at: number, restMs: number, fast: boolean, s: Pick<HsSettings, 'speed' | 'hold' | 'drop'>): { ms: number; planned: number } {
  let ms = Math.max(0, restMs) * (fast ? s.drop.fast : 1);
  let planned = 0;
  for (let i = at + 1; i < cues.length; i++) {
    const c = cues[i];
    // 매진 뒤로는 줄 것이 없다
    if (c.ev === 'sold') break;
    if (c.ev === 'price' || c.ev === 'rush') fast = true;
    if (c.ev === 'left') planned += c.n ?? 1;
    ms += cueMs(c, s) * (fast ? s.drop.fast : 1);
  }
  return { ms, planned };
}
/** 다음에 줄일 수와 그때까지(ms, 빨라진 동안은 배수만큼 빨리 흐른다). 더 줄일 것이 없으면 null. 끝 수(end, 1 이상) 아래로는 안 내려간다 */
export function nextDrop(left: number, end: number, rest: { ms: number; planned: number }, d: HsDrop, rnd: () => number = Math.random): { n: number; wait: number } | null {
  const room = left - rest.planned - Math.max(1, end);
  if (!d.on || room <= 0 || rest.ms <= 0) return null;
  const unit = rest.ms / room / d.rate;
  const base = Math.max(1, Math.ceil(DROP_GAP_MS / unit));
  const n = Math.min(room, Math.floor(base * (1 + rnd() * Math.max(1, d.step))));
  // 마지막 몫이 방송 끝을 넘겨 버려지지 않게, 남은 시간의 절반 안에 줄인다
  return { n, wait: Math.min(n * unit * (0.6 + rnd() * 0.8), rest.ms / 2) };
}


// ── 주문·할부 장부·택배 상자·방청 (설계 8-4 ~ 8-10) ──
// 할부는 물건이 아니라 사람에게 붙는 장부다 (11-09 사용자: 물건에 붙이면 쓰거나 버릴 때 의무도 사라진다). 가계부는 건드리지 않는다.
// 호출 턴은 주문 때 미리 뽑아 적는다. 「몇 회 냈나」는 저장하지 않고 지금 턴 수로 센다 — 응답을 지우거나 다시 굴리면 저절로 되돌아간다 (가계부 방식).

export const HS_ORDERS_VAR = '$hs_orders';
export const HS_AUD_VAR = '$hs_aud';
export const HS_ORDERS_MAX = 40;
export interface HsOrder {
  id: string;
  /** 상품 (상자를 열면 소지품에 들어갈 것) */
  item: Omit<ShopItem, 'id' | 'sold' | 'soldKey' | 'tag' | 'was' | 'orig'>;
  /** 할부 회차 (맞교환이면 0) */
  n: number;
  /** 맞교환으로 낸 물건 이름 */
  barter?: string;
  /** 주문한 응답 키 (그 응답이 지워지면 주문도 없던 일) · 주문 때 턴 */
  anchor: string;
  turn: number;
  /** 불려 가는 턴들 (n 개, 오름차순) */
  dues: number[];
  /** 소지품의 택배 상자 id · 연 응답 키 */
  boxId: string;
  openKey?: string;
}
export function readOrders(vars: Vars): HsOrder[] {
  try {
    const arr: unknown = JSON.parse(String(vars?.[HS_ORDERS_VAR] ?? '') || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter((o): o is HsOrder => !!o && typeof o === 'object' && typeof (o as HsOrder).id === 'string' && !!(o as HsOrder).item && typeof (o as HsOrder).item.name === 'string' && Array.isArray((o as HsOrder).dues));
  } catch {
    return [];
  }
}
export const ordersVars = (list: HsOrder[]): Record<string, string> => ({ [HS_ORDERS_VAR]: list.length ? JSON.stringify(list.slice(-HS_ORDERS_MAX)) : '' });
/** 살아 있는 주문 (주문한 응답이 남아 있는 것) */
export const liveOrders = (vars: Vars, alive: Set<string>): HsOrder[] => readOrders(vars).filter((o) => !o.anchor || alive.has(o.anchor));
/** 낸 회차: 예정 턴이 지금 턴 이하인 것 */
export const paidOf = (o: HsOrder, turnNow: number): number => o.dues.filter((d) => d <= turnNow).length;
/** 상자를 열었나 (연 응답이 살아 있을 때만) */
export const orderOpened = (o: HsOrder, alive: Set<string>): boolean => o.openKey !== undefined && (!o.openKey || alive.has(o.openKey));
/** 호출 턴 뽑기: 지금 턴에서 간격(최소~최대)씩. 다른 주문의 호출 턴과 겹치면 한 턴 미룬다 (한 턴에 하나) */
export function scheduleDues(taken: number[], turn: number, n: number, gap: [number, number], rnd: () => number = Math.random): number[] {
  const used = new Set(taken);
  const out: number[] = [];
  let t = turn;
  for (let i = 0; i < n; i++) {
    t += gap[0] + Math.floor(rnd() * (gap[1] - gap[0] + 1));
    while (used.has(t)) t++;
    used.add(t);
    out.push(t);
  }
  return out;
}
const boxName = (name: string) => `택배 상자(미개봉) · ${name}`.slice(0, 30);
/** 새 주문 (장부 줄 + 상자 정보). 상자 물건은 부른 쪽이 소지품에 넣고 boxId 를 채운다 */
export function newOrder(chat: Chat, item: ShopItem, s: Pick<HsSettings, 'call'>, barter = '', rnd: () => number = Math.random): HsOrder {
  const alive = aliveAnchors(chat);
  const turn = userTurns(chat);
  const n = barter ? 0 : installments(item);
  const taken = liveOrders(chat.scriptstate, alive).flatMap((o) => o.dues);
  const { id: _id, sold: _s, soldKey: _k, tag: _t, was: _w, orig: _o, ...rest } = item;
  return { id: `ho_${item.id}`, item: rest, n, ...(barter ? { barter } : {}), anchor: lastBot(chat)?.key ?? '', turn, dues: scheduleDues(taken, turn, n, s.call, rnd), boxId: '' };
}
export const HS_BOX = { name: boxName, desc: `${HS_NAME}에서 온 택배 상자. 아직 열지 않았다.`, icon: 'cardboard box' };
/** 소지품 물건 id → 그 상자의 주문 (안 연 것만) */
export function boxOrder(vars: Vars, itemId: string, alive: Set<string>): HsOrder | null {
  if (!itemId || !String(vars?.[HS_ORDERS_VAR] ?? '').includes(itemId)) return null;
  return liveOrders(vars, alive).find((o) => o.boxId === itemId && !orderOpened(o, alive)) ?? null;
}

export interface HsAudience { anchor: string; no: string; name: string }
export function readAudience(vars: Vars): HsAudience | null {
  try {
    const j = JSON.parse(String(vars?.[HS_AUD_VAR] ?? '') || 'null') as HsAudience | null;
    return j && typeof j.no === 'string' ? { anchor: String(j.anchor ?? ''), no: j.no, name: String(j.name ?? '') } : null;
  } catch {
    return null;
  }
}

export const HS_BLOCK_HEAD = '[망상홈쇼핑]';
/** 지금 턴에 불려 가는 주문 (예정 턴 = 지금 턴). 여러 건이어도 하나 */
export function callNow(chat: Chat): { order: HsOrder; nth: number } | null {
  const t = userTurns(chat);
  for (const o of liveOrders(chat.scriptstate, aliveAnchors(chat))) {
    const i = o.dues.indexOf(t);
    if (i >= 0) return { order: o, nth: i + 1 };
  }
  return null;
}
/** 본편에 이번 턴에만 넘길 글: 할부 호출 지시 · 방청 신청 한 줄. 없으면 빈 글 (평소엔 아무것도 안 보낸다, 설계 8-8) */
export function homeshopBlock(chat: Chat): string {
  const s = hsSettings(chat.scriptstate);
  if (!s.on) return '';
  const g = guideSections('Hs');
  const lines: string[] = [];
  const call = callNow(chat);
  if (call && g.CALL) {
    const { order: o, nth } = call;
    const form = s.forms[(o.id.length + nth * 7 + o.turn) % s.forms.length];
    lines.push(fillGuide(g.CALL, { item: o.item.name, nth: String(nth), total: String(o.n), left: String(o.n - nth), form }));
  }
  const aud = readAudience(chat.scriptstate);
  if (aud && s.aud && g.AUDIENCE && aud.anchor === (lastBot(chat)?.key ?? '')) lines.push(fillGuide(g.AUDIENCE, { no: aud.no, name: aud.name }));
  return lines.length ? `${HS_BLOCK_HEAD}\n${lines.join('\n')}` : '';
}
/** 요청: 위 글을 마지막 유저 메시지 앞에 system 으로 (소지품 블록과 같은 자리). 이미 있으면 그대로 */
export function withHomeshop<M extends PromptMessage>(messages: M[], chat: Chat): M[] {
  if (messages.some((m) => typeof m?.content === 'string' && m.content.startsWith(HS_BLOCK_HEAD))) return messages;
  const text = homeshopBlock(chat);
  if (!text) return messages;
  const at = messages.map((m) => m?.role).lastIndexOf('user');
  const b = { role: 'system', content: text } as M;
  return at < 0 ? [...messages, b] : [...messages.slice(0, at), b, ...messages.slice(at)];
}
