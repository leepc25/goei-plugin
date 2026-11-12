// 소지품 (2026-11-07 사용자와 합의, docs/인계/소지품_1107/소지품_계획_1107.md 「최종안」).
// 목표는 본편 모델이 지금 상황(무엇을 갖고 있는지·한계·이번 턴 사건)을 알고 응답에 반영하는 것. 화면·목록은 그 보조.
// 플러그인은 막지도 경고하지도 않는다: 칸이 넘쳐도 그냥 넣고 「17/16」로 보여 주며, 푸는 건 본편 응답.
// 저장은 채팅 변수 `$st_items` (JSON). 물건 줄은 기준 메시지(anchor)가 채팅에 남아 있을 때만 산다 (가계부 `$st_wallet` 와 같은 방식).
// 종류 14개는 없앴다 (2026-11-07 밤 사용자). 물건마다 판정: 사용 가능 · 소모성(남은 횟수 숫자 하나, 사용마다 1 빼고 0이면 없어짐) · 장착(무기·장비).
// 비소모 물건은 숫자 없이 상태만 설명 글로. 상태 4단계(멀쩡·손상·고장·파괴)는 보조 모델만 본문을 보고 바꾼다 (memory goei-equip-design).
import type { Chat } from './types';
import { guideOr } from './guides';
import { aliveAnchors } from './wallet';
import { messageKey } from './people/store';
import type { PromptMessage } from './request';
import type { ItemChange, ItemNow } from './people/updater';
import { currentShop, shopEvents, shopOn, shopGuide } from './shop';
import { mallEvents, soldPasses } from './malls';
import { boughtPasses } from './shopctx';
import { EQUIP_LABEL, EQUIP_SLOTS, STATE_LABEL, cleanIcon, itemEquip, itemState, itemUses, itemWeight, type ItemEquip, type ItemState } from './itemtraits';
export * from './itemtraits';
import type { StartItem } from './startitems';
import { FORM_EMPTY, kindOfIcon, leftWordIn, nameFilled, offWordIn, traitsFor } from './itemrules';
import { splitIconWord } from './iconmatch';
export * from './itemrules';

export const ITEMS_VAR = '$st_items';
/** 「사용」 자리: 다음 보낼 때 본편에 넘길 물건 [{id, n}] (JSON 배열). 보내면 비운다 */
export const ITEM_USE_VAR = '$st_item_use';
/** 「사용」 상자를 보낸 턴의 마지막 유저 메시지 키. 비면 아직 안 보냄. 같은 키면 그 턴의 다시 굴리기 (상자를 다시 넘긴다) */
export const ITEM_USE_AT_VAR = '$st_item_use_at';
/** 설정 (채팅 변수, 새 채팅 기본값은 prefs.vars): 칸 수·한계 문장·본편에 넘기기·보조 모델 자동 읽기 */
export const ITEM_SLOTS_VAR = '$it_slots';
export const ITEM_LIMIT_VAR = '$it_limit';
/** 그림 대체 말 표 (한 줄 「외투 → 코트」; 비우면 core/iconmatch ICON_ALIAS_DEFAULT) — 2026-11-09 사용자: 매칭기 재설계 */
export const ITEM_ICON_ALIAS_VAR = '$it_icon_alias';
/** 분류 말(과자·다과·음식)은 그 분류 그림 가운데 물건마다 하나를 뽑아 보여 주기 ('0' = 끔, 기본 켬) — 2026-11-10 사용자 */
export const ITEM_ICON_POOL_VAR = '$it_icon_pool';
export const itemIconPoolOn = (vars: Record<string, unknown> | undefined) => vars?.[ITEM_ICON_POOL_VAR] !== '0';
export const ITEM_AUTO_VAR = '$it_auto';
export const ITEM_SLOTS_DEFAULT = 16;
export const ITEM_SLOTS_MIN = 8;
export const ITEM_SLOTS_MAX = 40;
export const ITEM_LIMIT_DEFAULT = 'one bag, pockets, and two hands';
/** 소지 한도 kg (2026-11-08 사용자): 고유 인물은 명부 「소지 한도」를 시작할 때 $it_carry_pc 에 적고, 그 값이 없으면(페르소나·아바타) 설정 값 */
export const ITEM_CARRY_VAR = '$it_carry';
export const ITEM_CARRY_PC_VAR = '$it_carry_pc';
export const ITEM_CARRY_DEFAULT = 25;
export const ITEM_CARRY_MIN = 1;
export const ITEM_CARRY_MAX = 300;
/** 고치기 (2026-11-08 사용자: 손으로 물건을 고치는 건 말이 안 됨 → 켜야만 단추가 보임, 기본 끔) */
export const ITEM_EDIT_VAR = '$it_edit';
export const itemEditOn = (vars: Record<string, unknown> | undefined) => vars?.[ITEM_EDIT_VAR] === '1';

export type ItemFrom = 'store' | 'story' | 'manual';

export interface Item {
  id: string;
  /** 이름 (≤30). 같은 이름이 또 들어오면 새 줄 대신 설명만 갱신 */
  name: string;
  /** 설명 (≤80). 양·상태도 여기 글로 */
  desc: string;
  /** 효과 (≤60, 없으면 빈 문자열) */
  effect: string;
  /** 숨긴 진짜 효과 (≤60). 화면엔 절대 안 보이고 본편 모델만 받는다 (11-09 사용자: 우주몰 물건은 보이는 효과가 광고 문구) */
  truth?: string;
  /** 쪽지 내용 (≤400): 산 정보 등 읽는 글. 소지품에서 열어 읽고, 본편에도 그대로 간다 */
  text?: string;
  /** 사용 가능 */
  use: boolean;
  /** 소모성: 처음 횟수. 남은 횟수 = 이것 − 살아 있는 사용 기록의 n 합 (itemLeft). 0 이 되면 목록에서 안 보인다 */
  uses?: number;
  equip?: ItemEquip;
  /** 장착 칸 번호 (0부터). 없으면 소지품 격자 */
  slot?: number;
  state: ItemState;
  /** 그림 찾기용 낱말 */
  icon?: string;
  /** 무게 kg (물건을 만드는 모델이 정함). 없으면 0 으로 센다 */
  weight?: number;
  from: ItemFrom;
  /** 기준 메시지 키 (messageKey). 직접 넣은 건 빈 문자열 (늘 산다) */
  anchor: string;
  /** 상점: 값·가계부 거래 id */
  price?: number;
  walletId?: string;
  /** 상점: 원이 아닌 값으로 치른 것 (그 가게의 결제 수단·흥정으로 정한 대가, 2026-11-08 사용자) */
  paidWith?: string;
  /** 본문: 근거 인용 */
  quote?: string;
  /** 상점에 판 응답 키: 그 응답이 살아 있는 동안 목록에서 안 보인다 (다시 굴리면 판 돈과 함께 돌아온다) */
  soldAt?: string;
  /** 상점: 산 곳 (core/shopctx.ts ItemStore). 설정 「메인 요청에 붙이는 것 · 구매」가 그 가게 것만 거를 때 본다 */
  store?: string;
  /** 종류 (그림 낱말의 종류 코드: wear·tool·device …). 들어올 때 한 번 정해 저장하고, 갈래는 이것과 판정 표로 코드가 정한다 (core/itemrules.ts) */
  kind?: string;
  /** 치움 (2026-11-12 사용자: 본문이 버림·두고 옴·잃음을 쓰면 빠져야 한다). 목록에서 지우지 않고 숨긴다 — 같은 물건(id·갈래·무게·그림)으로 되살리려고.
   *  left = 두고 옴·맡김, gone = 버림·잃음·줌, drop = 사용자가 「버리기」, destroy = 파괴 */
  outHow?: ItemOut;
  /** 치운 응답 키: 그 응답이 살아 있는 동안만 숨는다 (다시 굴리면 돌아온다). 빈 문자열 = 늘 (사용자가 버림) */
  outAt?: string;
  /** 두고 온 자리 (≤30) */
  place?: string;
  /** 사용자가 버린 때의 마지막 메시지 키: 그 뒤의 메시지를 근거로 한 「다시 얻음」만 되살린다 */
  outKey?: string;
  /** 되찾은 응답 키: 그 응답이 살아 있는 동안은 치운 것이 아니다 (그 응답을 다시 굴리면 다시 치운 상태) */
  backAt?: string;
  at: string;
}
export type ItemOut = 'left' | 'gone' | 'drop' | 'destroy';

/** left = 두고 옴(화면 말은 「없어짐」, 자리는 메모에), off = 본문에서 장착을 풂 */
export type ItemLogWhat = 'get' | 'use' | 'drop' | 'gone' | 'destroy' | 'merge' | 'sell' | 'left' | 'off';
export type ItemLogBy = 'story' | 'manual' | 'use' | 'store';

/** 사용·처분 기록 한 줄 (화면 「기록」·찾기). 상한 없음, 저장 안전용 400줄 */
export interface ItemLog {
  id: string;
  name: string;
  what: ItemLogWhat;
  by: ItemLogBy;
  anchor: string;
  quote?: string;
  note?: string;
  /** 물건 id (사용 기록: 남은 횟수 셈) */
  item?: string;
  /** 사용 횟수 (사용 기록, 기본 1) */
  n?: number;
  /** 그림 찾기용 낱말 */
  icon?: string;
  at: string;
}

export interface Items {
  list: Item[];
  log: ItemLog[];
  /** 설정 「다 쓴 물건」이 「남겨 두기」면 true (readItems 가 채움, 저장하지 않음): 남은 0 인 소모품도 목록에 남는다 */
  keep?: boolean;
}

const isItem = (e: unknown): e is Item => {
  const x = e as Item;
  return !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.anchor === 'string' && (x.from === 'store' || x.from === 'story' || x.from === 'manual');
};
const isLog = (e: unknown): e is ItemLog => {
  const x = e as ItemLog;
  return !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.what === 'string';
};

const clean = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function normItem(x: Item): Item {
  const { uses: u0, equip: e0, slot: s0, icon: i0, weight: w0, ...rest } = x;
  const uses = itemUses(u0);
  const weight = itemWeight(w0);
  const equip = itemEquip(e0);
  const slot = equip && Number.isSafeInteger(s0) && (s0 as number) >= 0 && (s0 as number) < EQUIP_SLOTS[equip] ? s0 : undefined;
  const icon = cleanIcon(i0);
  return {
    ...rest, desc: clean(x.desc, 80), effect: clean(x.effect, 60), use: x.use === true || !!uses, state: itemState(x.state),
    ...(uses ? { uses } : {}), ...(equip ? { equip } : {}), ...(slot !== undefined ? { slot } : {}), ...(icon ? { icon } : {}), ...(weight !== undefined ? { weight } : {}),
  };
}

export function readItems(vars: Record<string, unknown> | undefined): Items {
  const raw = vars?.[ITEMS_VAR];
  const empty: Items = { list: [], log: [] };
  if (vars?.[ITEM_SPENT_VAR] === 'keep') empty.keep = true;
  if (typeof raw !== 'string' || !raw.trim()) return empty;
  try {
    const o = JSON.parse(raw) as Partial<Items>;
    if (!o || typeof o !== 'object') return empty;
    const list = (Array.isArray(o.list) ? o.list.filter(isItem) : []).map(normItem).slice(-200);
    return { list, log: Array.isArray(o.log) ? o.log.filter(isLog).slice(-400) : [], ...(vars?.[ITEM_SPENT_VAR] === 'keep' ? { keep: true } : {}) };
  } catch {
    return empty;
  }
}

export const itemsVars = (it: Items): Record<string, string> => ({ [ITEMS_VAR]: JSON.stringify({ list: it.list, log: it.log }) });

/** 이 물건을 쓴 횟수 (살아 있는 사용 기록만 — 응답을 지우거나 다시 굴리면 돌아온다) */
export function itemUsed(it: Items, id: string, alive: Set<string>): number {
  let n = 0;
  for (const l of it.log) if (l.what === 'use' && l.item === id && (!l.anchor || alive.has(l.anchor))) n += l.n ?? 1;
  return n;
}
/** 소모성 남은 횟수 (비소모는 undefined) */
export function itemLeft(it: Items, e: Item, alive: Set<string>): number | undefined {
  return e.uses === undefined ? undefined : Math.max(0, e.uses - itemUsed(it, e.id, alive));
}

/** 살아 있는 물건 (직접 넣은 건 늘, 나머지는 기준 메시지가 남아 있을 때). 소모성은 남은 횟수가 0이면 빠진다 */
export function liveItems(it: Items, alive: Set<string>): Item[] {
  return it.list.filter((e) => (!e.anchor || alive.has(e.anchor)) && !(e.soldAt && alive.has(e.soldAt)) && !isOut(e, alive) && (it.keep || e.uses === undefined || (itemLeft(it, e, alive) ?? 1) > 0));
}
/** 치운 물건인가: 치운 응답이 살아 있고(사용자가 버린 것은 늘), 되찾은 응답이 살아 있지 않을 때 */
export const isOut = (e: Item, alive: Set<string>): boolean => !!e.outHow && (!e.outAt || alive.has(e.outAt)) && !(e.backAt && alive.has(e.backAt));
/** 치운 물건 가운데 되살릴 수 있는 같은 이름의 것 (파괴된 것·기준 메시지가 사라진 것·판 것은 아님) */
export function outItemOf(it: Items, alive: Set<string>, name: string): Item | undefined {
  return it.list.find((e) => e.outHow && e.outHow !== 'destroy' && isOut(e, alive) && (!e.anchor || alive.has(e.anchor)) && !(e.soldAt && alive.has(e.soldAt)) && sameItemName(e.name, name));
}
/** 치운 물건들 (화면 기록·시험용): 지금 숨어 있는 줄 */
export const outItems = (it: Items, alive: Set<string>): Item[] => it.list.filter((e) => isOut(e, alive) && (!e.anchor || alive.has(e.anchor)));

/** 장착 칸 차지: 갈래별 칸 번호 → 물건 (같은 칸에 둘이면 앞의 것) */
export function equippedOf(list: Item[]): Record<ItemEquip, (Item | undefined)[]> {
  const out: Record<ItemEquip, (Item | undefined)[]> = { weapon: Array(EQUIP_SLOTS.weapon).fill(undefined), gear: Array(EQUIP_SLOTS.gear).fill(undefined) };
  for (const e of list) if (e.equip && e.slot !== undefined && !out[e.equip][e.slot]) out[e.equip][e.slot] = e;
  return out;
}
/** 장착 칸에 실제로 놓인 물건인가 */
export const isEquipped = (e: Item, list: Item[]): boolean => !!e.equip && e.slot !== undefined && equippedOf(list)[e.equip][e.slot]?.id === e.id;
/** 소지품 격자에 있는 것 (장착 칸에 놓인 것 빼고) */
export const gridItems = (list: Item[]): Item[] => list.filter((e) => !isEquipped(e, list));

/** 장착: slot 을 안 주면 빈 칸 첫 번째(없으면 그대로). 그 칸에 다른 물건이 있으면 그 물건은 격자로 */
export function equipItem(it: Items, alive: Set<string>, id: string, slot?: number): Items {
  const live = liveItems(it, alive);
  const cur = live.find((x) => x.id === id);
  if (!cur?.equip) return it;
  const occ = equippedOf(live)[cur.equip];
  const at = slot ?? occ.findIndex((x) => !x);
  if (!Number.isSafeInteger(at) || at < 0 || at >= EQUIP_SLOTS[cur.equip]) return it;
  const other = occ[at];
  return {
    ...it,
    list: it.list.map((x) => {
      if (x.id === id) return { ...x, slot: at };
      if (other && x.id === other.id && other.id !== id) {
        const { slot: _s, ...rest } = x;
        return rest;
      }
      return x;
    }),
  };
}
/** 장착 풀기 (격자로) */
export function unequipItem(it: Items, id: string): Items {
  const cur = it.list.find((x) => x.id === id);
  if (!cur || cur.slot === undefined) return it;
  const { slot: _s, ...rest } = cur;
  return { ...it, list: it.list.map((x) => (x.id === id ? rest : x)) };
}
export const liveItemsOf = (it: Items, chat: Chat): Item[] => liveItems(it, aliveAnchors(chat));

const hash = (text: string) => {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
};
const normName = (s: string) => clean(s, 30).toLowerCase().replace(/[\s·.,'"「」()]/g, '');
export const sameItemName = (a: string, b: string) => normName(a) === normName(b) && normName(a) !== '';
export const itemId = (anchor: string, name: string) => `i_${hash(`${anchor}|${normName(name)}`)}`;

export interface ItemInput {
  name: string;
  desc?: string;
  effect?: string;
  /** 숨긴 진짜 효과 */
  truth?: string;
  /** 쪽지 내용 */
  text?: string;
  /** 판정 (안 주면 새 물건은 사용 X·비소모·장착 X, 있던 물건은 그대로) */
  use?: boolean;
  uses?: unknown;
  equip?: unknown;
  state?: unknown;
  icon?: unknown;
  /** 무게 kg */
  weight?: unknown;
  /** 넣자마자 장착 (시작 소지품) */
  wear?: boolean;
  from: ItemFrom;
  anchor: string;
  price?: number;
  walletId?: string;
  paidWith?: string;
  /** 상점: 산 곳 (core/shopctx.ts ItemStore) */
  store?: string;
  quote?: string;
  id?: string;
  at?: string;
}

/** 판정 고치기 (patch 에 있는 칸만). 소모성이면 사용 가능. 장착 갈래가 바뀌거나 없어지면 칸에서 내린다 */
function withTraits(cur: Item, p: { use?: boolean; uses?: unknown; equip?: unknown; state?: unknown; icon?: unknown; weight?: unknown }): Item {
  const next: Item = { ...cur };
  if (p.uses !== undefined) {
    const u = itemUses(p.uses);
    if (u) next.uses = u;
    else delete next.uses;
  }
  if (p.use !== undefined) next.use = !!p.use;
  if (next.uses) next.use = true;
  if (p.equip !== undefined) {
    const eq = itemEquip(p.equip);
    if (eq !== next.equip) delete next.slot;
    if (eq) next.equip = eq;
    else delete next.equip;
  }
  if (p.state !== undefined) next.state = itemState(p.state);
  if (p.icon !== undefined) {
    const ic = cleanIcon(p.icon);
    if (ic) next.icon = ic;
    else delete next.icon;
  }
  if (p.weight !== undefined && p.weight !== null && p.weight !== '') {
    const w = itemWeight(p.weight);
    if (w !== undefined) next.weight = w;
  }
  return next;
}

/** 획득 기록의 값: 원 · 원이 아닌 대가 */
const paidNote = (e: ItemInput): string =>
  [Number.isSafeInteger(e.price) && (e.price! > 0 || !e.paidWith) ? `₩ ${e.price!.toLocaleString('en-US')}` : '', e.paidWith ? clean(e.paidWith, 60) : ''].filter(Boolean).join(' + ');

/** 물건 더하기. 같은 이름이 살아 있으면 새 줄을 만들지 않고 설명·효과·판정만 갱신하고, 둘 다 소모성이면 횟수를 더한다.
 * 이름이 비면 그대로. 빈 설명은 있던 설명을 지우지 않는다 */
export function addItem(it: Items, alive: Set<string>, e: ItemInput): Items {
  const name = clean(e.name, 30);
  if (!name) return it;
  const desc = clean(e.desc, 80);
  const effect = clean(e.effect, 60);
  const truth = e.truth ? clean(e.truth, 60) : '';
  const text = e.text ? clean(e.text, 400) : '';
  const quote = e.quote ? clean(e.quote, 120) : undefined;
  // 갈래는 종류 + 판정 표로 코드가 정한다 (모델이 적은 사용·장착 깃발은 표에 줄이 없을 때만). 손으로 넣은 것·시작 소지품(manual)은 적힌 대로
  const kind = kindOfIcon(e.icon);
  const ruled = e.from === 'manual' ? undefined : traitsFor(kind, e.icon, name, { use: e.use, uses: e.uses, equip: e.equip });
  if (ruled) e = { ...e, use: ruled.use, uses: ruled.uses ?? (itemUses(e.uses) ? e.uses : undefined), equip: ruled.equip ?? '' };
  const found = liveItems(it, alive).find((x) => sameItemName(x.name, name));
  if (found) {
    if (ruled) e = { ...e, equip: ruled.equip ?? found.equip ?? '' };
    const addUses = itemUses(e.uses);
    const stack = !!addUses && found.uses !== undefined;
    const more = stack ? { uses: Math.min(999, found.uses! + addUses!) } : { uses: e.uses };
    // 무게는 1개당 (2026-11-08 사용자): 같은 소모품이 더 들어와도 1개당 무게는 그대로, 합은 개수만큼 곱해진다
    const weight = found.weight !== undefined ? undefined : e.weight;
    const next: Item = { ...withTraits(found, { use: e.use, ...more, equip: e.equip, state: e.state, icon: e.icon, weight }), desc: desc || found.desc, effect: effect || found.effect, ...(truth ? { truth } : {}), ...(quote ? { quote } : {}), ...(kind && !found.kind ? { kind } : {}) };
    if (JSON.stringify(next) === JSON.stringify(found)) return it;
    return { ...it, list: it.list.map((x) => (x.id === found.id ? next : x)) };
  }
  const id = e.id ?? itemId(e.anchor, name);
  // 되살림 (2026-11-12 사용자: 버렸다가 다시 줍는 맥락이면 같은 물건으로): 치운 같은 이름의 물건이 있으면 새 줄을 만들지 않고 그 줄을 돌려놓는다 — id·갈래·무게·그림 그대로.
  // 본문에서 얻은 것(story)은 늘, 그 밖(직접 넣기·상점)은 같은 id 로 겹칠 때만
  const back = outItemOf(it, alive, name);
  if (back && (e.from === 'story' || back.id === id)) {
    const { outHow: _h, outAt: _a, place: _p, outKey: _k, backAt: _b, ...rest } = back;
    // 본문 근거로 되찾은 것은 그 응답에 묶는다 (그 응답을 다시 굴리면 다시 치운 상태로). 그 밖은 치운 표시를 지운다
    const row: Item = e.from === 'story' && e.anchor ? { ...back, backAt: e.anchor } : rest;
    const next: Item = { ...row, desc: desc || back.desc, effect: effect || back.effect, ...(quote ? { quote } : {}) };
    const got = addItemLog(it, { name: back.name, item: back.id, ...(back.icon ? { icon: back.icon } : {}), what: 'get', by: e.from, anchor: e.anchor, ...(quote ? { quote } : {}) });
    return { ...got, list: got.list.map((x) => (x.id === back.id ? next : x)) };
  }
  if (it.list.some((x) => x.id === id)) return it;
  const row: Item = withTraits({
    id, name, desc, effect, use: false, state: 'ok', from: e.from, anchor: e.anchor, at: e.at ?? new Date().toISOString(),
    ...(Number.isSafeInteger(e.price) ? { price: e.price } : {}),
    ...(e.walletId ? { walletId: e.walletId } : {}),
    ...(e.paidWith ? { paidWith: clean(e.paidWith, 60) } : {}),
    ...(e.store ? { store: clean(e.store, 16) } : {}),
    ...(truth ? { truth } : {}),
    ...(text ? { text } : {}),
    ...(quote ? { quote } : {}),
    ...(kind ? { kind } : {}),
  }, { use: e.use, uses: e.uses, equip: e.equip, state: e.state, icon: e.icon, weight: e.weight });
  // 획득 기록 (2026-11-07 사용자: 기록에 사용만 있고 얻은 건 없음). 값은 note 에
  const got = addItemLog(it, { name, item: id, ...(row.icon ? { icon: row.icon } : {}), what: 'get', by: e.from, anchor: e.anchor, ...(quote ? { quote } : {}), ...(paidNote(e) ? { note: paidNote(e) } : {}), at: row.at });
  const out = { ...got, list: [...got.list, row].slice(-200) };
  return e.wear && row.equip ? equipItem(out, alive, id) : out;
}

/** 이름·설명·효과·판정·상태 고치기. 상태는 보조 모델만 (화면엔 고치는 칸 없음) */
export function updateItem(it: Items, id: string, patch: { name?: string; desc?: string; effect?: string; use?: boolean; uses?: unknown; equip?: unknown; state?: unknown; icon?: unknown; weight?: unknown }): Items {
  const cur = it.list.find((x) => x.id === id);
  if (!cur) return it;
  const next: Item = {
    ...withTraits(cur, patch),
    ...(patch.name !== undefined && clean(patch.name, 30) ? { name: clean(patch.name, 30) } : {}),
    ...(patch.desc !== undefined ? { desc: clean(patch.desc, 80) } : {}),
    ...(patch.effect !== undefined ? { effect: clean(patch.effect, 60) } : {}),
  };
  return { ...it, list: it.list.map((x) => (x.id === id ? next : x)) };
}

/** 남은 횟수를 본문대로 맞추기 (보조 모델이 본문에서 남은 양을 말할 때): 처음 횟수 = 남은 + 쓴 횟수 */
export function setItemLeft(it: Items, alive: Set<string>, id: string, left: number): Items {
  const cur = it.list.find((x) => x.id === id);
  if (!cur || cur.uses === undefined || !Number.isSafeInteger(left) || left < 0) return it;
  const uses = Math.min(999, left + itemUsed(it, id, alive));
  if (uses < 1 || uses === cur.uses) return it;
  return { ...it, list: it.list.map((x) => (x.id === id ? { ...x, uses } : x)) };
}

const logId = (what: string, anchor: string, name: string, n: number) => `l_${hash(`${what}|${anchor}|${normName(name)}|${n}`)}`;

/** 기록 한 줄 (살아 있는 기록만 — 기준 메시지가 사라지면 같이 빠지도록 anchor 를 둔다) */
export function addItemLog(it: Items, l: Omit<ItemLog, 'id' | 'at'> & { id?: string; at?: string }): Items {
  const id = l.id ?? logId(l.what, l.anchor, l.name, it.log.length);
  if (it.log.some((x) => x.id === id)) return it;
  const row: ItemLog = { ...l, id, name: clean(l.name, 30), at: l.at ?? new Date().toISOString(), ...(l.quote ? { quote: clean(l.quote, 120) } : {}), ...(l.note ? { note: clean(l.note, 60) } : {}) };
  return { ...it, log: [...it.log, row].slice(-400) };
}

/** 물건 빼기 → 기록에 한 줄. what: drop(버림)·gone(본문에서 없어짐)·destroy(파괴)·sell(상점에 팖) */
/** 버림·없어짐·두고 옴·파괴는 목록에서 지우지 않고 숨긴다 (outHow): 치운 응답을 다시 굴리면 돌아오고, 다시 얻으면 같은 물건으로 되살아난다 (addItem).
 *  장착 칸에서도 내린다. 그 밖(상점 맞교환·상자 열기)과 다 쓴 소모품(hard)은 지금처럼 줄을 지운다.
 *  extra.place = 두고 온 자리, extra.key = 사용자가 버린 때의 마지막 메시지 키 */
export function removeItem(it: Items, id: string, what: ItemLogWhat, by: ItemLogBy, anchor = '', extra: { quote?: string; note?: string; place?: string; key?: string; hard?: boolean } = {}): Items {
  const cur = it.list.find((x) => x.id === id);
  if (!cur) return it;
  const { place: p0, key, hard, ...logExtra } = extra;
  const place = p0 ? clean(p0, 30) : '';
  const how: ItemOut | '' = hard ? '' : what === 'left' ? 'left' : what === 'gone' ? 'gone' : what === 'drop' ? 'drop' : what === 'destroy' ? 'destroy' : '';
  const note = what === 'left' ? [`두고 옴${place ? `: ${place}` : ''}`, logExtra.note].filter(Boolean).join(' · ') : logExtra.note;
  const log = { name: cur.name, item: id, ...(cur.icon ? { icon: cur.icon } : {}), what, by, anchor, ...(logExtra.quote ? { quote: logExtra.quote } : {}), ...(note ? { note } : {}) };
  if (!how) return addItemLog({ ...it, list: it.list.filter((x) => x.id !== id) }, log);
  const { slot: _s, backAt: _b, place: _p, outKey: _k, ...rest } = cur;
  const out: Item = { ...rest, outHow: how, outAt: anchor, ...(place ? { place } : {}), ...(key ? { outKey: key } : {}) };
  return addItemLog({ ...it, list: it.list.map((x) => (x.id === id ? out : x)) }, log);
}

/** 삭제 (2026-11-13 사용자: 잘못 들어온 물건을 없애는 단추. 「버리기」와 다르다): 목록에서 줄을 지우고 그 물건의 기록 줄도 지운다.
 *  기록이 없으니 메인 요청에도 넘어가지 않는다 (버린 것·잃은 것으로 치지 않는다) */
export function purgeItem(it: Items, id: string): Items {
  if (!it.list.some((x) => x.id === id)) return it;
  return { ...it, list: it.list.filter((x) => x.id !== id), log: it.log.filter((l) => l.item !== id) };
}

/** 상점에 팔기: 목록에서 지우지 않고 판 응답(anchor)에 묶어 숨긴다 → 기록에 sell 한 줄. 판 돈(가계부)도 같은 응답에 묶이니,
 *  응답을 다시 굴리거나 지우면 물건과 돈이 같이 돌아온다 (11-08 전수점검: 지우면 물건만 사라지고 돈은 없어졌다). 장착 칸에서도 뺀다 */
export function sellItem(it: Items, id: string, anchor: string, note?: string): Items {
  const cur = it.list.find((x) => x.id === id);
  if (!cur || !anchor) return it;
  const { slot: _slot, ...rest } = cur;
  return addItemLog({ ...it, list: it.list.map((x) => (x.id === id ? { ...rest, soldAt: anchor } : x)) }, { name: cur.name, item: id, ...(cur.icon ? { icon: cur.icon } : {}), what: 'sell', by: 'manual', anchor, ...(note ? { note } : {}) });
}

/** 합칠 수 있나 (2026-11-08 사용자): 둘 다 소모성이고 이름에 같은 낱말이 있을 때만 — 같은 소모품이 두 칸으로 갈라진 것을 한 묶음으로 */
export function canMerge(a: Item, b: Item): boolean {
  if (a.id === b.id || a.uses === undefined || b.uses === undefined) return false;
  const words = (n: string) => clean(n, 30).toLowerCase().split(/[\s·.,'"「」()\-_/]+/).filter((w) => w.length >= 1);
  const wa = new Set(words(a.name));
  return words(b.name).some((w) => wa.has(w));
}

/** 두 줄을 하나로 (직접). keep 가 남고 other 는 빠진다. 이름·설명은 남는 쪽 그대로, 남은 횟수만 더한다 (2026-11-08 사용자, 무게는 1개당이라 그대로).
 * 기록은 마지막 응답에 묶어 다음 요청의 「This turn」으로 본편에 넘긴다 (mergedNow) */
export function mergeItems(it: Items, alive: Set<string>, keepId: string, otherId: string, anchor = ''): Items {
  const keep = it.list.find((x) => x.id === keepId);
  const other = it.list.find((x) => x.id === otherId);
  if (!keep || !other || !canMerge(keep, other)) return it;
  const weight = keep.weight ?? other.weight; // 1개당 무게 (합은 남은 개수만큼 곱해진다)
  const merged: Item = {
    ...keep,
    uses: Math.min(999, keep.uses! + (itemLeft(it, other, alive) ?? 0)),
    ...(weight !== undefined ? { weight } : {}),
    // 직접 넣은 줄과 합치면 늘 사는 쪽(anchor '')으로
    anchor: keep.anchor && other.anchor ? keep.anchor : '',
    from: keep.anchor && other.anchor ? keep.from : 'manual',
  };
  const list = it.list.filter((x) => x.id !== otherId).map((x) => (x.id === keepId ? merged : x));
  return addItemLog({ ...it, list }, { name: other.name, item: other.id, ...(other.icon ? { icon: other.icon } : {}), what: 'merge', by: 'manual', anchor, note: `${merged.name}와 합침` });
}

/** 설정의 소지 한도 (1~300kg, 기본 25) */
export function itemCarrySetting(vars: Record<string, unknown> | undefined): number {
  const n = Number(vars?.[ITEM_CARRY_VAR]);
  if (!Number.isSafeInteger(n)) return ITEM_CARRY_DEFAULT;
  return Math.min(ITEM_CARRY_MAX, Math.max(ITEM_CARRY_MIN, n));
}
/** 이 채팅 주인공의 소지 한도 kg: 고유 인물로 시작했으면 명부 값, 아니면 설정 값 */
export function itemCarry(vars: Record<string, unknown> | undefined): number {
  const pc = itemWeight(vars?.[ITEM_CARRY_PC_VAR]);
  return pc !== undefined && pc > 0 ? pc : itemCarrySetting(vars);
}
/** 물건 한 줄의 무게 kg: 무게는 1개당이고 소모품은 남은 개수만큼 곱한다 (2026-11-08 사용자). left = 남은 개수(비소모는 undefined) */
export const lineWeight = (e: Item, left: number | undefined): number | undefined => (e.weight === undefined ? undefined : Math.round(e.weight * (e.uses !== undefined ? left ?? e.uses : 1) * 1000) / 1000);
/** 무게 합 kg (장착한 것까지 전부, 무게 없는 물건은 0) */
export const totalWeight = (list: Item[], left?: (e: Item) => number | undefined): number => Math.round(list.reduce((n, e) => n + (lineWeight(e, left?.(e)) ?? 0), 0) * 1000) / 1000;
/** 본편에 넘기는 무게 숫자 (kg, 소수 한 자리까지) */
const kgText = (n: number) => `${Number(n.toFixed(1))} kg`;

/** 칸 수 설정 (8~40, 기본 16) */
export function itemSlots(vars: Record<string, unknown> | undefined): number {
  const n = Number(vars?.[ITEM_SLOTS_VAR]);
  if (!Number.isSafeInteger(n)) return ITEM_SLOTS_DEFAULT;
  return Math.min(ITEM_SLOTS_MAX, Math.max(ITEM_SLOTS_MIN, n));
}
export const itemLimit = (vars: Record<string, unknown> | undefined): string => clean(vars?.[ITEM_LIMIT_VAR], 60) || ITEM_LIMIT_DEFAULT;
/** 본편에 넘기기 (기본 켬, '0' 이면 끔) */
/** 소지품·상점 스위치 (2026-11-07 사용자: 둘은 연동, 하나를 끄면 같이 꺼짐). '0' 이면 둘 다 끔. shop.ts 도 이 값을 본다. 가계부는 따로(상태창 잔고 칸 $st_col_wallet) */
export const ITEM_ON_VAR = '$it_on';
export const invOn = (vars: Record<string, unknown> | undefined) => vars?.[ITEM_ON_VAR] !== '0';
/** 진행 중에 소지품을 다시 켠 때의 메시지 수. 그 뒤 첫 응답이 오기 전까지 [Inventory] 에 「꺼져 있던 동안의 변화는 목록에 없다」를 붙인다 */
export const ITEM_RESUMED_VAR = '$it_resumed';
/** 다시 켠 뒤 아직 응답이 안 왔나 */
export function invJustResumed(chat: Chat): boolean {
  const at = Number(chat.scriptstate?.[ITEM_RESUMED_VAR] ?? '');
  if (!Number.isInteger(at) || at < 0) return false;
  return !(chat.message ?? []).slice(at).some((m) => m.role === 'char');
}
const RESUMED_EVENT = 'item tracking was switched off for a while and just came back on — this list may not match what happened in the story since; follow the story and treat the list as a starting point';
/** 위 글은 지침 「본편에 붙는 글」 INVENTORY.RESUMED 절에서 읽는다. 절이 없으면 위 글 */
export const resumedEvent = (): string => guideOr('Main', 'INVENTORY.RESUMED', RESUMED_EVENT);
/** 소지품을 메인 요청에 넣는가. 2026-11-11 사용자: 넣지 않을 거면 쓰는 뜻이 없다 → 따로 끄는 줄을 없애고 「사용」과 같은 값 */
export const itemPushOn = (vars: Record<string, unknown> | undefined) => invOn(vars);
/** 보조 모델이 본문을 읽어 목록을 맞추기 (기본 켬, '0' 이면 끔) */
export const itemAutoOn = (vars: Record<string, unknown> | undefined) => invOn(vars) && vars?.[ITEM_AUTO_VAR] !== '0';
/** 시작 소지품 (기본 켬): 고유 인물로 시작할 때 명부의 시작 소지품을 넣고 무기·장비를 장착 */
export const ITEM_START_VAR = '$it_start';
/** 다 쓴 물건: remove(기본, 남은 0 이면 목록에서 빠짐) · keep(「다 씀」으로 남겨 둠) */
export const ITEM_SPENT_VAR = '$it_spent';
/** 상태 바꾸기 (기본 켬): 보조 모델이 손상·고장·파괴를 바꾼다 */
export const ITEM_STATE_VAR = '$it_state';
export const itemStateOn = (vars: Record<string, unknown> | undefined) => vars?.[ITEM_STATE_VAR] !== '0';
/** 본편에 넘길 내용: full(기본, 이름·설명·효과·판정) · state(이름·판정) · name(이름만) */
/** 물건으로 만드는 범위 (2026-11-13 사용자: 「어느선까지 만들게 할거냐」「좀 러프한 분류」 → 세 단계). 갱신기가 본문에서 읽어 새로 만드는 물건에만 적용한다.
 *  상점에서 산 것·직접 넣은 것·전에 갖고 있던 것을 되찾는 것은 단계와 상관없이 들어온다. 기본은 넓게(= 전과 같은 동작) */
export const ITEM_SCOPE_VAR = '$it_scope';
export type ItemScope = 'narrow' | 'mid' | 'wide';
export const itemScope = (vars: Record<string, unknown> | undefined): ItemScope => (vars?.[ITEM_SCOPE_VAR] === 'narrow' || vars?.[ITEM_SCOPE_VAR] === 'mid' ? vars[ITEM_SCOPE_VAR] as ItemScope : 'wide');
/** 단계마다 만들지 않는 종류 (그림 말의 종류 코드, core/itemrules.ts kindOfIcon. 옷·음식·서류·잡동사니) */
export const ITEM_SCOPE_SKIP: Record<ItemScope, string[]> = { narrow: ['wear', 'food', 'paper', 'misc'], mid: ['food', 'misc'], wide: [] };
/** 갱신기에 넘기는 한 줄 (자료 items_rule) */
const ITEM_SCOPE_RULE: Record<ItemScope, string> = {
  narrow: 'Report `new` only for things with a use in the story: weapons, tools and devices, medicine, keys, talismans, sealed objects, anomaly-related objects, valuables. Do not report clothes, food and drink, documents or small everyday things.',
  mid: 'Report `new` for things with a use in the story and for issued or bought gear worn or carried on the body (clothes, bags) and mission documents. Do not report food and drink or small everyday things.',
  wide: '',
};
/** 만들지 않을 것: 사용자가 직접 적는 글 (갱신기에 그대로 넘긴다) */
export const ITEM_SKIP_VAR = '$it_skip';
export const ITEM_SKIP_MAX = 300;
export const itemSkip = (vars: Record<string, unknown> | undefined): string => clean(vars?.[ITEM_SKIP_VAR], ITEM_SKIP_MAX);
/** 자료 items_rule: 범위 단계의 글 + 사용자가 적은 「만들지 않을 것」. 둘 다 없으면 undefined */
export function itemsRule(vars: Record<string, unknown> | undefined): string | undefined {
  const skip = itemSkip(vars);
  const out = [ITEM_SCOPE_RULE[itemScope(vars)], skip ? `Never report as \`new\`: ${skip}` : ''].filter(Boolean).join(' ');
  return out || undefined;
}
export const ITEM_DETAIL_VAR = '$it_detail';
export type ItemDetail = 'full' | 'state' | 'name';
export const itemDetail = (vars: Record<string, unknown> | undefined): ItemDetail => (vars?.[ITEM_DETAIL_VAR] === 'state' || vars?.[ITEM_DETAIL_VAR] === 'name' ? vars[ITEM_DETAIL_VAR] as ItemDetail : 'full');
/** 사용·처분 기록 넘기기: 최근 응답 N개의 기록(획득·사용·버림·없어짐·파괴·판 것)을 [Inventory] 에 (0~10, 기본 0) */
export const ITEM_LOGTURNS_VAR = '$it_logturns';
export const ITEM_LOGTURNS_MAX = 10;
/** 값이 없을 때 (2026-11-11 사용자: 기본 0이면 기록이 안 넘어간다 → 3턴) */
export const ITEM_LOGTURNS_DEFAULT = 3;
export const itemLogTurns = (vars: Record<string, unknown> | undefined): number => {
  const raw = vars?.[ITEM_LOGTURNS_VAR];
  if (raw === undefined || raw === null || raw === '') return ITEM_LOGTURNS_DEFAULT;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? Math.min(ITEM_LOGTURNS_MAX, n) : ITEM_LOGTURNS_DEFAULT;
};
export const itemStartOn = (vars: Record<string, unknown> | undefined) => invOn(vars) && vars?.[ITEM_START_VAR] !== '0';

export interface ItemUse {
  id: string;
  n: number;
}

/** 「사용」 자리 읽기: [{id, n}] (칸 수 정하지 않음, 저장 안전용 40줄) */
export function readItemUse(vars: Record<string, unknown> | undefined): ItemUse[] {
  const raw = vars?.[ITEM_USE_VAR];
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const a = JSON.parse(raw);
    if (!Array.isArray(a)) return [];
    const out: ItemUse[] = [];
    for (const x of a) {
      const id = typeof x?.id === 'string' ? x.id : '';
      const n = Number(x?.n ?? 1);
      if (!id || !Number.isSafeInteger(n) || n < 1 || out.some((u) => u.id === id)) continue;
      out.push({ id, n: Math.min(99, n) });
    }
    return out.slice(0, 40);
  } catch {
    return [];
  }
}
export const itemUseVars = (list: ItemUse[]): Record<string, string> => ({ [ITEM_USE_VAR]: list.length ? JSON.stringify(list.slice(0, 40)) : '' });

/** 쓸 수 있나: 사용 가능 · 고장 아님 */
export const canUse = (e: Item): boolean => e.use && e.state !== 'broken';

/** 「사용」 자리에 하나 더 (같은 물건이면 ×n 늘림). 소모성은 남은 횟수를 넘지 않게. 못 쓰는 물건이면 그대로 */
export function addUse(list: ItemUse[], e: Item, left: number | undefined): ItemUse[] {
  if (!canUse(e)) return list;
  const cur = list.find((u) => u.id === e.id);
  const n = (cur?.n ?? 0) + 1;
  if (left !== undefined && n > left) return list;
  if (e.uses === undefined && cur) return list;
  return cur ? list.map((u) => (u.id === e.id ? { ...u, n } : u)) : [...list, { id: e.id, n: 1 }];
}
/** 「사용」 자리에서 빼기 */
export const dropUse = (list: ItemUse[], id: string): ItemUse[] => list.filter((u) => u.id !== id);

/** 마지막 응답 뒤에 직접 합친 것 → 「This turn」 사건 (2026-11-08 사용자: 합쳐도 본편이 몰랐다) */
export function mergedNow(it: Items, lastAnchor: string): string[] {
  if (!lastAnchor) return [];
  return it.log.filter((l) => l.what === 'merge' && l.anchor === lastAnchor).map((l) => `combined ${l.name} into ${String(l.note ?? '').replace(/와 합침$/, '')}`);
}

/** 마지막 응답에서 본문이 벗거나·두고 오거나·잃은 것 → 「This turn」 사건 (2026-11-12 사용자: 본편도 알아야 다음 응답에서 그 물건을 도로 입히지 않는다) */
export function movedNow(it: Items, lastAnchor: string): string[] {
  if (!lastAnchor) return [];
  return it.log.filter((l) => l.by === 'story' && l.anchor === lastAnchor).flatMap((l) => {
    if (l.what === 'off') return [`took off ${l.name} (still carrying it)`];
    if (l.what === 'left') { const place = /^두고 옴: ([^·]+)/.exec(String(l.note ?? ''))?.[1]?.trim(); return [`left ${l.name}${place ? ` at ${place}` : ' behind'} — no longer carrying or wearing it`]; }
    if (l.what === 'gone' || l.what === 'destroy') return l.note === '다 씀' ? [] : [`no longer has ${l.name}`];
    return [];
  });
}

/** 이번 턴에 인터넷 쇼핑몰 등에 판 것 (2026-11-10 사용자: 우주 쇼핑몰에 입던 옷을 팔았는데 본편은 그 옷을 계속 입고 나왔다 — 판 일이 본편에 안 넘어가고 있었다).
 *  마지막 응답 뒤의 판매 기록(what=sell). 지금 열린 상점(skipPlace)에 판 것은 shopEvents 가 따로 넘기므로 뺀다 */
export function soldNow(it: Items, lastAnchor: string, skipPlace = '', passes?: (place: string, plain: boolean) => boolean): string[] {
  if (!lastAnchor) return [];
  return it.log.filter((l) => l.what === 'sell' && l.anchor === lastAnchor).flatMap((l) => {
    const note = String(l.note ?? '');
    const place = note.replace(/에 팖$/, '').trim();
    if (skipPlace && place === skipPlace) return [];
    // 설정 「메인 요청에 붙이는 것」이 꺼 둔 가게에 판 것은 뺀다 (core/malls.ts soldPasses)
    if (passes && !passes(place, /에 팖$/.test(note))) return [];
    return [`just sold ${l.name}${place ? ` to ${place}` : ''} and handed it over — the protagonist no longer has, carries or wears it`];
  });
}

/** 이번 턴에 새로 산 것 (상점): 마지막 응답 뒤에 들어온 store 줄 — 아직 본편이 모르는 것 */
export function newlyBought(list: Item[], lastAnchor: string): Item[] {
  return list.filter((e) => e.from === 'store' && e.anchor === lastAnchor);
}

/** 본편에 넘기는 「새로 산 것」 이름: 원이 아닌 값으로 치렀으면 무엇으로 치렀는지 붙인다 (본편 모델이 몸·빚 같은 결과를 이야기로) */
export const boughtLine = (e: Item): string => (e.paidWith ? `${e.name} (paid with ${e.paidWith}${e.price ? ` + ${e.price.toLocaleString('en-US')} won` : ''})` : e.name);

/** 본편에 넘기는 물건 한 줄: 이름 — 설명 (효과) [장착] [남은 횟수] [상태] */
export function itemLine(e: Item, left: number | undefined, equipped: boolean, detail: ItemDetail = 'full'): string {
  const tags = detail === 'name' ? [] : [
    equipped ? `equipped ${e.equip === 'weapon' ? 'weapon' : 'gear'}` : '',
    left === 0 ? 'used up' : left !== undefined ? `${left} use${left === 1 ? '' : 's'} left` : '',
    e.state === 'damaged' ? 'damaged' : e.state === 'broken' ? 'broken, cannot be used' : '',
  ].filter(Boolean);
  // 숨긴 진짜 효과(truth)는 여기 안 적는다 — 평소엔 광고 문구(effect)만. 쓰는 턴에만 itemsBlock 이 「Really:」로 넘긴다 (11-09 사용자: 매 턴 보내면 모델이 아는 척한다)
  const body = detail === 'full' ? `${e.desc ? ` — ${e.desc}` : ''}${e.effect ? ` (${e.effect})` : ''}${e.text ? ` — reads: "${e.text}"` : ''}` : '';
  return `- ${e.name}${body}${tags.map((t) => ` [${t}]`).join('')}`;
}

export interface BlockUse {
  name: string;
  n: number;
  /** 소모성이면 이번에 쓰고 난 뒤 남는 횟수 */
  after?: number;
}

/** 본편에 넘기는 글. 비면 빈 문자열 (붙이지 않는다). 전부 넘김 — 자르지 않는다. 칸 수는 소지품 격자만 센다 (장착 칸에 놓인 건 빼고) */
export function itemsBlock(list: Item[], opts: { slots: number; limit: string; carry?: number; left?: (e: Item) => number | undefined; use?: BlockUse[]; bought?: string[]; events?: string[]; always?: boolean; detail?: ItemDetail; recent?: string[] }): string {
  const lines = list.map((e) => itemLine(e, opts.left?.(e), isEquipped(e, list), opts.detail));
  const use = (opts.use ?? []).filter((u) => u.name);
  const bought = (opts.bought ?? []).filter(Boolean);
  const extra = (opts.events ?? []).filter(Boolean);
  if (!lines.length && !use.length && !bought.length && !extra.length && !opts.always) return '';
  const carried = gridItems(list).length;
  const out = [`[Inventory] ${carried}/${opts.slots}${carried > opts.slots ? ' (over the limit)' : ''}`, ...(lines.length ? lines : ['- (nothing)'])];
  // 무게 (2026-11-08 사용자): 「무겁다」 같은 말 없이 지금 상황만 — 합계·한도, 넘었으면 얼마나
  if (opts.carry) {
    const w = totalWeight(list, opts.left);
    out.push(`Weight: ${kgText(w)} / ${kgText(opts.carry)}${w > opts.carry ? ` (${kgText(w - opts.carry)} over)` : ''}`);
  }
  out.push(`Carry limit: ${opts.limit}`);
  const recent = (opts.recent ?? []).filter(Boolean);
  if (recent.length) out.push(`Recently: ${recent.join('; ')}`);
  const events: string[] = [];
  if (use.length) events.push(`uses ${use.map((u) => `${u.name}${u.n > 1 ? ` ×${u.n}` : ''}${u.after === 0 ? ' (used up after this)' : u.after !== undefined ? ` (${u.after} left after this)` : ''}`).join(', ')}`);
  if (bought.length) events.push(`just bought ${bought.join(', ')}`);
  events.push(...extra);
  if (carried > opts.slots) events.push('carrying more than the limit');
  if (events.length) out.push(`This turn: ${events.join('; ')}`);
  // 숨긴 진짜 효과: 이번 턴에 쓰는 물건, 몸에 걸친 장비만 (11-09 사용자: 평소엔 광고 문구만 가고, 쓰는 순간에 「이번에 일어나는 일」로 받는다)
  const reveal = list.filter((e) => e.truth && (use.some((u) => u.name === e.name) || isEquipped(e, list)));
  if (reveal.length) {
    // 글은 지침 「본편에 붙는 글」 INVENTORY.REALLY · INVENTORY.REALLY_UNKNOWN 절. 절이 없으면 여기 남긴 글
    out.push(guideOr('Main', 'INVENTORY.REALLY', 'Really (what these actually do — decided by no one in advance, known to no one in the story; let it happen and show only what is experienced):'));
    for (const e of reveal) out.push(e.truth === '?' ? guideOr('Main', 'INVENTORY.REALLY_UNKNOWN', () => `- ${e.name}: not even its seller knows${e.effect ? ` (the label says 「${e.effect}」 and may be false)` : ''} — decide what it really does now, then keep it the same from here on.`, { name: e.name, label_note: e.effect ? ` (the label says 「${e.effect}」 and may be false)` : '' }) : `- ${e.name}: ${e.truth}${e.effect ? ` (the label says 「${e.effect}」)` : ''}`);
  }
  return out.join('\n');
}

/** 물건·기록 찾기 (이름·설명·효과·근거·기록 글) */
export function searchItems(it: Items, alive: Set<string>, q: string): { items: Item[]; log: ItemLog[] } {
  const k = q.trim().toLowerCase();
  if (!k) return { items: liveItems(it, alive), log: it.log.slice().reverse() };
  const hit = (...s: (string | undefined)[]) => s.some((x) => (x ?? '').toLowerCase().includes(k));
  return {
    items: liveItems(it, alive).filter((e) => hit(e.name, e.desc, e.effect, e.quote, e.equip ? EQUIP_LABEL[e.equip] : '', e.state !== 'ok' ? STATE_LABEL[e.state] : '')),
    log: it.log.filter((l) => hit(l.name, l.note, l.quote)).reverse(),
  };
}

// ── 본편 요청·응답 (body.ts) ──

export const INVENTORY_HEAD = '[Inventory]';
/** 본편에 넘기기가 꺼지고 상점만 켜졌을 때의 글 머리 */
export const SHOP_HEAD = '[Shop]';
export const INVENTORY_NOTE =
  'What the protagonist carries right now (name — state (effect) [equipped / uses left / condition]); nothing else is on hand. Equipped items are in hand or worn. Keep it in mind when you write what they do, and when "This turn" lists an event, handle it in this response: ' +
  'describe a used item taking effect (or failing), and if they carry more than the limit, let that show in the story — something is awkward to hold, dropped, left behind, or someone remarks on it. A broken item does not work. If a "Really" list follows, those items\' real effects differ from or go beyond their labels: what happens follows the Really line, nobody knew it beforehand, and the protagonist learns it only through what happens. Never print this list back.';

/** 채팅의 마지막 유저 메시지 키 (없으면 '') */
export function lastUserKey(chat: Chat): string {
  const list = chat.message ?? [];
  for (let i = list.length - 1; i >= 0; i--) if (list[i].role === 'user') return messageKey(list[i], i);
  return '';
}
const LOG_VERB: Record<ItemLogWhat, string> = { get: 'got', use: 'used', drop: 'dropped', gone: 'lost', destroy: 'destroyed', merge: 'combined into', sell: 'sold', left: 'left behind', off: 'took off' };
/** 최근 봇 응답 n개에 묶인 사용·처분 기록 (설정 「사용·처분 기록 넘기기」). 직접 넣은·버린 줄(기준 메시지 없음)은 셀 수 없어 뺀다 */
export function recentItemLog(chat: Chat, it: Items, n: number): string[] {
  if (n <= 0) return [];
  const list = chat.message ?? [];
  const keys = new Set<string>();
  for (let i = list.length - 1; i >= 0 && keys.size < n; i--) if (list[i].role === 'char') keys.add(messageKey(list[i], i));
  return it.log.filter((l) => l.anchor && keys.has(l.anchor)).map((l) => `${LOG_VERB[l.what]} ${l.name}${(l.n ?? 1) > 1 ? ` ×${l.n}` : ''}`);
}

/** 채팅의 마지막 봇 응답 키 (없으면 '') */
export function lastBotKey(chat: Chat): string {
  const list = chat.message ?? [];
  for (let i = list.length - 1; i >= 0; i--) if (list[i].role === 'char') return messageKey(list[i], i);
  return '';
}

export interface UsedNow {
  name: string;
  anchor: string;
  n: number;
  /** 소모성이면 남은 횟수 (프로그램이 이미 뺀 값) */
  left?: number;
}

/** 이 응답들에서 「사용」 자리로 쓴 물건 (기록 what=use). 보조 모델 자료 used_now */
export function usedItemsAt(it: Items, anchors: string[], alive: Set<string>): UsedNow[] {
  const set = new Set(anchors.filter(Boolean));
  return it.log.filter((l) => l.what === 'use' && l.by === 'use' && set.has(l.anchor)).map((l) => {
    const e = l.item ? it.list.find((x) => x.id === l.item) : undefined;
    const left = e ? itemLeft(it, e, alive) : undefined;
    return { name: l.name, anchor: l.anchor, n: l.n ?? 1, ...(left !== undefined ? { left } : {}) };
  });
}

/** 이번 요청에 넘길 「사용」 목록: 아직 안 보냈거나(at 비어 있음), 보낸 턴을 다시 굴리는 중일 때(at = 지금 마지막 유저 키) */
export function pendingItemUse(vars: Record<string, unknown> | undefined, userKey: string): ItemUse[] {
  const at = typeof vars?.[ITEM_USE_AT_VAR] === 'string' ? (vars[ITEM_USE_AT_VAR] as string) : '';
  return !at || at === userKey ? readItemUse(vars) : [];
}

/** 이 채팅의 [Inventory] 글 (소지품이 꺼졌거나 넘길 게 없으면 '') */
export function inventoryText(chat: Chat): string {
  const vars = chat.scriptstate;
  if (!itemPushOn(vars)) {
    // 소지품이 꺼져 있다 (상점도 같이 꺼진다): 물건 목록은 없고, 이번 턴에 판 일·쇼핑몰 사건만 [Shop] 글로 넘긴다
    const soldOff = [...soldNow(readItems(vars), lastBotKey(chat), currentShop(chat)?.shop, (place, plain) => soldPasses(vars, place, plain)), ...mallEvents(chat)];
    return soldOff.length ? [SHOP_HEAD, `This turn: ${soldOff.join('; ')}`].join('\n') : '';
  }
  const it = readItems(vars);
  const userKey = lastUserKey(chat);
  // 다시 굴리기: 이번 턴 사용 기록(옛 응답에 묶인 것)은 셈에서 빼고 본다 — 지금 응답이 그 사용을 다시 쓰는 중
  const alive = aliveAnchors(chat);
  const reroll = typeof vars?.[ITEM_USE_AT_VAR] === 'string' && vars[ITEM_USE_AT_VAR] === userKey && userKey;
  const after = reroll ? new Set([...alive].filter((k) => !it.log.some((l) => l.what === 'use' && l.by === 'use' && l.anchor === k && keyAfter(chat, k, userKey)))) : alive;
  const live = liveItems(it, after);
  const left = (e: Item) => itemLeft(it, e, after);
  // 상점(core/shop.ts): 켜져 있으면 물건이 없어도 블록을 보내 표식 지침을 넘기고, 이번 방문의 사건(주인과 나눈 말·쫓겨남)을 This turn 에 더한다
  const shop = shopOn(vars);
  const use = pendingItemUse(vars, userKey).flatMap((u): BlockUse[] => {
    const e = live.find((x) => x.id === u.id);
    if (!e || !canUse(e)) return [];
    const l = left(e);
    const n = l !== undefined ? Math.min(u.n, l) : 1;
    return n > 0 ? [{ name: e.name, n, ...(l !== undefined ? { after: l - n } : {}) }] : [];
  });
  const resumed = invJustResumed(chat);
  const soldOff = [...soldNow(it, lastBotKey(chat), currentShop(chat)?.shop, (place, plain) => soldPasses(vars, place, plain)), ...mallEvents(chat)];
  const text = itemsBlock(live, {
    slots: itemSlots(vars),
    limit: itemLimit(vars),
    carry: itemCarry(vars),
    left,
    use,
    bought: newlyBought(live, lastBotKey(chat)).filter((e) => boughtPasses(vars, e.store)).map(boughtLine),
    events: [...(resumed ? [resumedEvent()] : []), ...mergedNow(it, lastBotKey(chat)), ...movedNow(it, lastBotKey(chat)), ...soldOff, ...(shop ? shopEvents(chat) : [])],
    always: shop || resumed || soldOff.length > 0,
    detail: itemDetail(vars),
    recent: recentItemLog(chat, it, itemLogTurns(vars)),
  });
  const guide = shop ? shopGuide(vars) : '';
  // 안내 글은 지침 「본편에 붙는 글」 INVENTORY.NOTE 절. 절이 없으면 INVENTORY_NOTE
  return text ? `${text}\n${guideOr('Main', 'INVENTORY.NOTE', INVENTORY_NOTE)}${guide ? `\n${guide}` : ''}` : '';
}

/** 메시지 키 k 가 유저 키 userKey 뒤의 응답인가 (다시 굴리는 턴의 옛 응답) */
function keyAfter(chat: Chat, k: string, userKey: string): boolean {
  const list = chat.message ?? [];
  let seen = false;
  for (let i = 0; i < list.length; i++) {
    const key = messageKey(list[i], i);
    if (key === userKey) seen = true;
    else if (seen && key === k) return true;
  }
  return false;
}

/** 요청: [Inventory] 글을 마지막 유저 메시지 앞에 system 으로 넣는다 (상태창 블록과 같은 자리). 이미 있으면 그대로 */
export function withInventory<M extends PromptMessage>(messages: M[], chat: Chat): M[] {
  if (messages.some((m) => typeof m?.content === 'string' && (m.content.startsWith(INVENTORY_HEAD) || m.content.startsWith(SHOP_HEAD)))) return messages;
  const text = inventoryText(chat);
  if (!text) return messages;
  const at = messages.map((m) => m?.role).lastIndexOf('user');
  const block = { role: 'system', content: text } as M;
  return at < 0 ? [...messages, block] : [...messages.slice(0, at), block, ...messages.slice(at)];
}

/**
 * 응답이 붙은 뒤: 「사용」 자리를 정리한다. 바뀔 게 없으면 null.
 * - 처음 보낸 턴: at 에 유저 키를 적고, 사용 기록(물건 id·횟수)을 이 응답에 묶어 남긴다 (응답이 지워지면 기록도 빠지고 횟수가 돌아온다)
 * - 같은 턴 다시 굴리기: 기록만 새 응답에 다시 묶는다 (옛 응답의 기록은 그 응답과 함께 사라짐)
 * - 다음 턴: 자리를 비운다
 * 소모성은 남은 횟수가 0이 되면 목록에서 빠진다 (liveItems) — 따로 지우지 않는다
 */
export function settleItemUse(chat: Chat, responseIndex: number): Record<string, string> | null {
  const vars = chat.scriptstate ?? {};
  const queue = readItemUse(vars);
  const at = typeof vars[ITEM_USE_AT_VAR] === 'string' ? (vars[ITEM_USE_AT_VAR] as string) : '';
  if (!queue.length && !at) return null;
  const userKey = lastUserKey(chat);
  if (at && at !== userKey) return { ...itemUseVars([]), [ITEM_USE_AT_VAR]: '' };
  if (!queue.length) return { [ITEM_USE_AT_VAR]: '' };
  const m = chat.message?.[responseIndex];
  if (!m || m.role !== 'char') return null;
  const anchor = messageKey(m, responseIndex);
  const it0 = readItems(vars);
  let it = it0;
  // 이 응답 기록을 빼고 센 남은 횟수 (다시 굴리기면 옛 응답 기록은 이미 죽어 있다)
  const alive = new Set([...aliveAnchors(chat)].filter((k) => k !== anchor));
  for (const u of queue) {
    if (it.log.some((l) => l.what === 'use' && l.anchor === anchor && l.item === u.id)) continue;
    const item = liveItems(it0, alive).find((e) => e.id === u.id);
    if (!item || !canUse(item)) continue;
    const left = itemLeft(it0, item, alive);
    const n = left !== undefined ? Math.min(u.n, left) : 1;
    if (n < 1) continue;
    it = addItemLog(it, { name: item.name, item: item.id, n, ...(item.icon ? { icon: item.icon } : {}), what: 'use', by: 'use', anchor, ...(left !== undefined && left - n <= 0 ? { note: '다 씀' } : {}) });
  }
  if (it === it0 && at === userKey) return null;
  return { ...(it === it0 ? {} : itemsVars(it)), [ITEM_USE_AT_VAR]: userKey };
}

// ── 보조 모델(인물 갱신기) 자료·보고 (host/people.ts) ──

/** 자료 items_now: 지금 가진 것과 판정·상태 */
export function itemsNowOf(chat: Chat, pictures?: (name: string, icon?: string) => string[] | null): ItemNow[] {
  const it = readItems(chat.scriptstate);
  const alive = aliveAnchors(chat);
  const live = liveItems(it, alive);
  return live.map((e) => {
    const left = itemLeft(it, e, alive);
    return { name: e.name, desc: e.desc, use: e.use, state: e.state, ...(left !== undefined ? { left } : {}), ...(e.weight !== undefined ? { weight: e.weight } : {}), ...(e.equip ? { equip: e.equip, equipped: isEquipped(e, live) } : {}), ...(pictures?.(e.name, e.icon)?.length ? { pictures: pictures(e.name, e.icon)! } : {}) };
  });
}

/** 자료 items_away: 치워 둔 물건(되살릴 수 있는 것)의 이름·자리. 되찾으면 갱신기가 이 이름 그대로 new 를 쓴다 */
export function itemsAwayOf(chat: Chat): { name: string; place?: string }[] {
  const it = readItems(chat.scriptstate);
  const alive = aliveAnchors(chat);
  return outItems(it, alive)
    .filter((e) => outItemOf(it, alive, e.name) === e)
    .map((e) => ({ name: e.name, ...(e.place ? { place: e.place } : {}) }));
}

/** 그림 말이 바뀌어 더는 「빈」 그림이 아닌데 이름이 「빈 …」이면 「빈」을 뗀다 (찬 수집기가 「빈 꿈결 수집기」로 남지 않게).
 *  새 그림 말이 그 물건의 것일 때만(물건 이름이 그림 말에 들어 있음), 같은 이름의 다른 물건이 없을 때만 */
function unEmptyName(it: Items, alive: Set<string>, id: string, icon: string | undefined): Items {
  const cur = it.list.find((x) => x.id === id);
  if (!cur || !icon) return it;
  const name = nameFilled(cur.name);
  const word = splitIconWord(icon).word;
  if (name === cur.name || word.trim().startsWith(`${FORM_EMPTY} `) || !normName(word).includes(normName(name))) return it;
  if (liveItems(it, alive).some((e) => e.id !== id && sameItemName(e.name, name))) return it;
  return updateItem(it, id, { name });
}

/**
 * 보고된 변화를 목록에 (2026-11-12 다시 짬, /bugs_1112/물건_상태_그림_조사와_고침안.md 10절). 줄은 그 응답에 묶인다.
 *  new 더하기(같은 이름은 갱신 · 치운 같은 이름은 되살림 · 「빈 X」가 있는데 「… X」가 새로 오면 그 줄을 바꿈)
 *  update 설명·효과·상태·남은 횟수·무게·그림 말(상태가 바뀌면 갱신기가 그림을 다시 고른다) — 사용·장착 갈래는 받지 않는다 (갈래는 들어올 때 표로 정한 것. 「equip: none」에 갈래가 지워져 장착 단추가 사라지던 것)
 *  unequip 장착만 풂 · left 두고 옴(자리) · gone 없어짐 · destroyed 파괴 — 모두 숨기기만 하고 지우지 않는다 (removeItem)
 * 안전망: update 의 설명에 「두고 옴」 말이 있으면 left 로, 「벗음」 말만 있으면 unequip 으로 처리한다 (설정의 말 표).
 * opts.order = 채팅의 메시지 키 차례: 사용자가 「버리기」로 치운 물건은 버린 뒤의 메시지를 근거로 한 new 일 때만 되살린다
 */
export function applyItemChanges(it0: Items, alive: Set<string>, changes: ItemChange[], opts: { state?: boolean; order?: string[]; skipKinds?: string[] } = {}): Items {
  let it = it0;
  // 설정 「상태 바꾸기」가 꺼져 있으면 손상·고장은 받지 않고, 파괴는 「없어짐」으로 (목록에서는 빠지되 상태 단계는 쓰지 않는다)
  const stateOn = opts.state !== false;
  const order = opts.order ?? [];
  for (const c0 of changes) {
    let c: ItemChange = stateOn ? c0 : { ...c0, state: undefined, ...(c0.action === 'destroyed' ? { action: 'gone' as const } : {}) };
    const live = liveItems(it, alive);
    const cur = live.find((e) => e.name === c.name);
    if (c.action === 'update' && cur) {
      const word = leftWordIn(c.desc);
      if (word) c = { ...c, action: 'left' };
      else if (offWordIn(c.desc) && isEquipped(cur, live)) it = offItem(it, cur, c);
    }
    if (c.action === 'unequip') {
      if (cur && isEquipped(cur, live)) it = offItem(it, cur, c);
    } else if (c.action === 'left') {
      if (cur) it = removeItem(it, cur.id, 'left', 'story', c.anchor, { quote: c.quote, place: c.place, ...(c.desc && !c.place ? { note: c.desc } : {}) });
    } else if (c.action === 'gone' || c.action === 'destroyed') {
      if (cur) it = removeItem(it, cur.id, c.action === 'gone' ? 'gone' : 'destroy', 'story', c.anchor, { quote: c.quote, ...(c.desc ? { note: c.desc } : {}) });
    } else if (c.action === 'update' && cur) {
      it = updateItem(it, cur.id, {
        desc: c.desc || cur.desc, effect: c.effect || cur.effect,
        ...(c.state ? { state: c.state } : {}), ...(c.icon ? { icon: c.icon } : {}), ...(c.weight !== undefined ? { weight: c.weight } : {}),
      });
      it = unEmptyName(it, alive, cur.id, c.icon);
      if (c.uses !== undefined && cur.uses !== undefined) {
        it = setItemLeft(it, alive, cur.id, c.uses);
        // 남은 0 = 다 씀: 목록에서 빼고 기록
        if (c.uses === 0 && !it.keep) it = removeItem(it, cur.id, 'gone', 'story', c.anchor, { quote: c.quote, note: '다 씀', hard: true });
      }
    } else if (c.action === 'new') {
      // 사용자가 버린 물건: 버린 때보다 뒤의 메시지가 근거일 때만 되살린다 (같은 응답·앞 응답을 근거로 도로 생기지 않게)
      const back = outItemOf(it, alive, c.name);
      if (back?.outHow === 'drop' && !(order.indexOf(c.anchor) > (back.outKey ? order.indexOf(back.outKey) : -1) && order.includes(c.anchor))) continue;
      // 범위 설정에서 뺀 종류는 새로 만들지 않는다 (갖고 있던 것을 되찾는 것은 받는다)
      if (!back && !cur && opts.skipKinds?.length && opts.skipKinds.includes(kindOfIcon(c.icon))) continue;
      // 「빈 X」를 지닌 채 「… X」를 새로 얻었다고 오면(찬 수집기) 같은 물건이 찬 것 — 줄을 둘로 두지 않고 그 줄을 바꾼다
      const empty = !back && !cur ? live.find((e) => e.name.startsWith(`${FORM_EMPTY} `) && nameFilled(e.name) !== e.name && normName(c.name).endsWith(normName(nameFilled(e.name))) && !c.name.trim().startsWith(`${FORM_EMPTY} `)) : undefined;
      if (empty && !live.some((e) => sameItemName(e.name, c.name))) {
        it = updateItem(it, empty.id, { name: c.name, desc: c.desc || empty.desc, effect: c.effect || empty.effect, ...(c.state ? { state: c.state } : {}), ...(c.icon ? { icon: c.icon } : {}) });
        it = { ...it, list: it.list.map((x) => (x.id === empty.id && c.quote ? { ...x, quote: clean(c.quote, 120) } : x)) };
        it = addItemLog(it, { name: clean(c.name, 30), item: empty.id, ...(empty.icon ? { icon: empty.icon } : {}), what: 'get', by: 'story', anchor: c.anchor, ...(c.quote ? { quote: c.quote } : {}), note: `${empty.name}에서 바뀜` });
        continue;
      }
      it = addItem(it, alive, { name: c.name, desc: c.desc, effect: c.effect, use: c.use, uses: c.uses, equip: c.equip ?? undefined, state: c.state, icon: c.icon, weight: c.weight, from: 'story', anchor: c.anchor, quote: c.quote });
    }
  }
  return it;
}
/** 본문에서 장착을 풂: 칸만 비우고(갈래는 그대로 — 다시 장착할 수 있다) 기록 한 줄 */
function offItem(it: Items, cur: Item, c: ItemChange): Items {
  return addItemLog(unequipItem(it, cur.id), { name: cur.name, item: cur.id, ...(cur.icon ? { icon: cur.icon } : {}), what: 'off', by: 'story', anchor: c.anchor, ...(c.quote ? { quote: c.quote } : {}) });
}

// ── 고유 인물 시작 소지품 (core/startitems.ts 의 줄) ──
/** 시작 소지품 → 새 채팅의 소지품. 직접 넣은 물건처럼 기준 메시지 없이(늘 산다) */
export function startItemsState(list: StartItem[], at = new Date().toISOString()): Items {
  let it: Items = { list: [], log: [] };
  const alive = new Set<string>();
  for (const e of list) {
    it = addItem(it, alive, {
      name: e.name, desc: e.desc, effect: e.effect, use: !!e.use, uses: e.uses, equip: e.equip, icon: e.icon, weight: e.weight,
      wear: e.wear !== false, from: 'manual', anchor: '', at,
    });
  }
  return it;
}

/** 시작 변수: 줄이 없으면 빈 소지품 */
export const startItemsVars = (list: StartItem[]): Record<string, string> => (list.length ? itemsVars(startItemsState(list)) : { [ITEMS_VAR]: '' });
/** 시작 소지 한도: 고유 인물의 명부 값 (없으면 빈 칸 → 설정 값을 쓴다) */
export const startCarryVars = (carry: number | undefined): Record<string, string> => ({ [ITEM_CARRY_PC_VAR]: carry && carry > 0 ? String(carry) : '' });
