// 상점 (2026-11-07 사용자 설계, docs/인계/상점_1107/). 라이트보드 알터 스토어를 괴이 세계에 맞게 고친 것.
// - 메뉴·탭이 아니다. 본편 모델이 거래가 가능한 자리에서 응답 끝에 `[shop: 가게 이름|주인 이름]` 표식을 쓰면
//   플러그인이 그 응답 아래에 「상점 열기」 카드를 붙이고(표식은 화면에서 지움), 누르면 창 위에 상점 팝업이 뜬다.
// - 물건은 보조 모델이 맥락대로 창작한다. 첫 호출에서 진열대와 함께 가게 정체(파는 종류·없는 것·값대)를 받아 채팅 변수에 고정하고,
//   이후 호출(새로고침·주인에게 말하기)마다 정체를 넘기며 범위 밖 물건은 플러그인이 버린다 (뜬금없는 요청에 모델이 아무거나 만들지 않게).
// - 주인에게 말하기(흥정·문의·요청)는 글을 그대로 넘기고, 모델이 맥락을 읽어 응답 형식 안에서 「변경 없음 / 일부 / 전체」를 고른다.
//   문구를 맞춰 보는 일은 없다. 흥정이 받아들여지면 그 칸 값만 바뀐다. 주인이 거래를 끊으면 진열대를 잠근다.
// - 구입은 플러그인이 한다: 가계부 src:'store' + 소지품 from:'store'. 다음 턴 [Inventory] 글의 This turn 에 「새로 산 것」·주인과 나눈 말이 간다.
// - 잔고·소지품은 모델에 넘기지 않는다. PixelLab 그림은 표시용(이름 매칭)이라 모델과 무관하다.
import type { Chat } from './types';
import { ITEM_KINDS, itemKind, itemKindLabel, type ItemKind } from './items';
import { messageKey } from './people/store';
import { parseWon } from './wallet';
import { craftMessages, type CraftMessage, type ThoughtsMode } from './craft';
import { genSettings } from './advanced';

export const SHOP_VAR = '$st_shop';
/** 설정 (채팅 변수, 새 채팅 기본값은 prefs.vars) */
export const SHOP_ON_VAR = '$sh_on';
export const SHOP_COUNT_VAR = '$sh_count';
export const SHOP_CTX_VAR = '$sh_ctx';
export const SHOP_PRICE_VAR = '$sh_price';
export const SHOP_DIVERSE_VAR = '$sh_diverse';
export const SHOP_THOUGHTS_VAR = '$sh_thoughts';
export const SHOP_PREV_VAR = '$sh_prev';
export const SHOP_MODEL_VAR = '$sh_model';
/** 주인이 거래를 끊을 수 있는지 (사용자 11-07: 설정으로) */
export const SHOP_KICK_VAR = '$sh_kick';

export type ShopCount = '0' | '1' | '2';
export const SHOP_COUNTS: { id: ShopCount; label: string; range: [number, number] }[] = [
  { id: '0', label: '3~5', range: [3, 5] },
  { id: '1', label: '5~8', range: [5, 8] },
  { id: '2', label: '8~12', range: [8, 12] },
];

export interface ShopSettings {
  on: boolean;
  count: ShopCount;
  /** 최근 본문·상태창·괴이를 넘겨 맥락대로 (끄면 가게 정체만) */
  context: boolean;
  /** 값 기준 한 줄 (비우면 모델이 정함) */
  price: string;
  /** 다양성: 흔한 것만 늘어놓지 않게 */
  diverse: boolean;
  thoughts: ThoughtsMode;
  /** 지난 진열대 피하기 */
  avoidPrev: boolean;
  model: 'main' | 'aux';
  /** 주인이 거래를 끊을 수 있음 (끄면 응답의 <closed/> 를 무시) */
  kick: boolean;
}

type Vars = Record<string, unknown> | undefined;
const clean = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function shopSettings(vars: Vars): ShopSettings {
  const c = String(vars?.[SHOP_COUNT_VAR] ?? '');
  const t = String(vars?.[SHOP_THOUGHTS_VAR] ?? '');
  return {
    on: vars?.[SHOP_ON_VAR] !== '0',
    count: c === '0' || c === '2' ? c : '1',
    context: vars?.[SHOP_CTX_VAR] !== '0',
    price: clean(vars?.[SHOP_PRICE_VAR], 80),
    diverse: vars?.[SHOP_DIVERSE_VAR] !== '0',
    thoughts: t === 'inner' || t === 'note' ? t : 'off',
    avoidPrev: vars?.[SHOP_PREV_VAR] !== '0',
    model: vars?.[SHOP_MODEL_VAR] === 'main' ? 'main' : 'aux',
    kick: vars?.[SHOP_KICK_VAR] !== '0',
  };
}
export const shopOn = (vars: Vars): boolean => shopSettings(vars).on;

// ── 표식 `[shop: 가게|주인]` ──

const TAG = /\[\s*shop\s*[:：]\s*([^\]|｜]*?)\s*(?:[|｜]\s*([^\]]*?)\s*)?\]/giu;

export interface ShopTag {
  raw: string;
  shop: string;
  owner: string;
}

export const hasShopTag = (text: string): boolean => typeof text === 'string' && /\[\s*shop\s*[:：]/iu.test(text);

/** 글 속 마지막 표식 (가게 이름이 비면 없음) */
export function findShopTag(text: string): ShopTag | null {
  if (!hasShopTag(text)) return null;
  let out: ShopTag | null = null;
  for (const m of text.matchAll(TAG)) {
    const shop = clean(m[1], 30);
    if (shop) out = { raw: m[0], shop, owner: clean(m[2], 30) };
  }
  return out;
}

/** 표식을 지운 글 (표식만 있던 줄은 줄째) */
export function stripShopTags(text: string): string {
  if (!hasShopTag(text)) return text;
  return text.replace(new RegExp(`^[ \\t]*${TAG.source}[ \\t]*\\r?\\n?`, 'gimu'), '').replace(TAG, '').replace(/\n{3,}/g, '\n\n').trimEnd();
}

// ── 저장 ──

export interface ShopItem {
  id: string;
  name: string;
  desc: string;
  kind: ItemKind;
  effect: string;
  price: number;
  /** 흥정 전 값 (깎였을 때만) */
  orig?: number;
  /** 산 뒤 (진열대에서 빠진 것, 영수증·다음 턴 사건용) */
  sold?: boolean;
}

export interface ShopIdentity {
  /** 파는 종류 (ITEM_KINDS id). 비면 제한 없음 */
  sells: ItemKind[];
  /** 없는 것·안 파는 것 (한 줄) */
  never: string;
  /** 값대 설명 (한 줄) */
  prices: string;
  min: number;
  max: number;
}

export interface ShopLine {
  who: 'me' | 'owner';
  text: string;
}

export interface ShopState {
  shop: string;
  owner: string;
  /** 표식이 있던 응답의 메시지 키. 구입·사건의 기준(anchor) */
  key: string;
  loaded: boolean;
  identity: ShopIdentity;
  items: ShopItem[];
  talk: ShopLine[];
  /** 주인이 거래를 끊음 */
  closed: boolean;
  /** 지난 진열대의 물건 이름 (새로고침 때 피하기) */
  prev: string[];
}

const EMPTY_ID: ShopIdentity = { sells: [], never: '', prices: '', min: 0, max: 0 };

export const emptyShop = (tag: ShopTag, key: string): ShopState => ({ shop: tag.shop, owner: tag.owner, key, loaded: false, identity: EMPTY_ID, items: [], talk: [], closed: false, prev: [] });

const isItem = (e: unknown): e is ShopItem => {
  const x = e as ShopItem;
  return !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.name === 'string' && Number.isSafeInteger(x.price);
};

export function readShop(vars: Vars): ShopState | null {
  const raw = vars?.[SHOP_VAR];
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const o = JSON.parse(raw) as Partial<ShopState>;
    if (!o || typeof o !== 'object' || typeof o.shop !== 'string' || !o.shop) return null;
    const id = (o.identity ?? {}) as Partial<ShopIdentity>;
    return {
      shop: o.shop,
      owner: typeof o.owner === 'string' ? o.owner : '',
      key: typeof o.key === 'string' ? o.key : '',
      loaded: !!o.loaded,
      identity: {
        sells: Array.isArray(id.sells) ? id.sells.filter((k): k is ItemKind => ITEM_KINDS.some((x) => x.id === k)) : [],
        never: clean(id.never, 120),
        prices: clean(id.prices, 120),
        min: Number.isSafeInteger(id.min) ? (id.min as number) : 0,
        max: Number.isSafeInteger(id.max) ? (id.max as number) : 0,
      },
      items: (Array.isArray(o.items) ? o.items.filter(isItem) : []).map((x) => ({ ...x, kind: itemKind(x.kind), desc: clean(x.desc, 120), effect: clean(x.effect, 60) })).slice(0, 40),
      talk: (Array.isArray(o.talk) ? o.talk : []).filter((l): l is ShopLine => !!l && (l.who === 'me' || l.who === 'owner') && typeof l.text === 'string').slice(-40),
      closed: !!o.closed,
      prev: Array.isArray(o.prev) ? o.prev.filter((x): x is string => typeof x === 'string').slice(-40) : [],
    };
  } catch {
    return null;
  }
}

export const shopVars = (st: ShopState | null): Record<string, string> => ({ [SHOP_VAR]: st ? JSON.stringify(st) : '' });

/** 채팅의 마지막 봇 응답 (키·글) */
function lastBot(chat: Chat): { key: string; text: string; index: number } | null {
  const list = chat.message ?? [];
  for (let i = list.length - 1; i >= 0; i--) if (list[i].role === 'char') return { key: messageKey(list[i], i), text: typeof list[i].data === 'string' ? list[i].data : '', index: i };
  return null;
}

/** 이 채팅에서 지금 열 수 있는 상점: 마지막 응답의 표식과 저장된 상태가 맞을 때만 */
export function currentShop(chat: Chat): ShopState | null {
  const st = readShop(chat.scriptstate);
  const last = lastBot(chat);
  if (!st || !last || st.key !== last.key) return null;
  return st;
}

/**
 * 응답이 붙은 뒤 (body.ts onOutput): 이 응답의 표식으로 상태를 맞춘다. 바뀔 게 없으면 null.
 * - 표식이 있고 같은 가게면 진열대·대화를 그대로 두고 기준만 이 응답으로 (한 방문 한 판)
 * - 다른 가게면 새 상태(진열대는 열 때 받는다). 표식이 없으면 비운다 (「표식이 사라지면 비움」)
 * - 지난 응답들의 표식은 지운다 (카드가 마지막 응답 아래에만 붙게). 저장 본문에서만 지우고 이번 응답 것은 둔다
 */
export function settleShop(chat: Chat, responseIndex: number): { vars: Record<string, string>; message?: Chat['message'] } | null {
  const list = chat.message ?? [];
  const m = list[responseIndex];
  if (!m || m.role !== 'char') return null;
  const text = typeof m.data === 'string' ? m.data : '';
  const tag = findShopTag(text);
  const key = messageKey(m, responseIndex);
  const cur = readShop(chat.scriptstate);
  let next: ShopState | null = null;
  if (tag) {
    next = cur && cur.shop === tag.shop ? { ...cur, key, owner: tag.owner || cur.owner } : emptyShop(tag, key);
  }
  let message: Chat['message'] | undefined;
  for (let i = 0; i < list.length; i++) {
    if (i === responseIndex || list[i].role !== 'char' || !hasShopTag(String(list[i].data ?? ''))) continue;
    message ??= [...list];
    message[i] = { ...list[i], data: stripShopTags(String(list[i].data)) };
  }
  const same = JSON.stringify(next) === JSON.stringify(cur);
  if (same && !message) return null;
  return { vars: shopVars(next), ...(message ? { message } : {}) };
}

// ── 값 ──

/** 칸 값 표기: 숫자와 쉼표만 (₩·원 없음). 억 단위는 「1.2억」으로 줄인다 (칸을 뚫고 나가지 않게) */
export function shortWon(n: number): string {
  const a = Math.abs(Math.trunc(n));
  if (a >= 100_000_000) {
    const eok = a / 100_000_000;
    return `${n < 0 ? '−' : ''}${eok >= 100 ? Math.round(eok) : Math.round(eok * 10) / 10}억`;
  }
  return `${n < 0 ? '−' : ''}${a.toLocaleString('en-US')}`;
}

const hash = (text: string) => {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
};
const normName = (s: string) => clean(s, 30).toLowerCase().replace(/[\s·.,'"「」()]/g, '');
export const sameShopName = (a: string, b: string) => normName(a) === normName(b) && normName(a) !== '';

// ── 응답 해석 ──

export class ShopError extends Error {}

// items.ts 가 이 파일을 되불러오므로(순환) ITEM_KINDS 는 모듈을 읽을 때가 아니라 쓸 때 본다
/** 모델이 종류를 한국어 이름으로 적어도 받는다 */
function kindOf(s: string): ItemKind | null {
  const t = clean(s, 20).toLowerCase();
  if (ITEM_KINDS.some((k) => k.id === t)) return t as ItemKind;
  const hit = ITEM_KINDS.find((k) => k.label === t || k.label.split('·').includes(t));
  return hit ? hit.id : null;
}

function priceOf(s: string): number | null {
  const n = parseWon(s.replace(/[^\d억만천백,.₩원\-−]/g, ''));
  return n !== null && n >= 0 ? n : null;
}

/** 「이름|값|종류|설명|효과」 한 줄 → 물건. 이름이나 값이 없으면 null */
function parseLine(line: string): Omit<ShopItem, 'id'> | null {
  const cells = line.replace(/^[-*•+]\s*/, '').split('|').map((c) => c.trim());
  if (cells.length < 2) return null;
  const name = clean(cells[0], 30);
  const price = priceOf(cells[1] ?? '');
  if (!name || price === null) return null;
  const kind = kindOf(cells[2] ?? '') ?? 'misc';
  return { name, price, kind, desc: clean(cells[3], 120), effect: clean(cells[4], 60) };
}

function block(raw: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}\\s*>`, 'i').exec(raw);
  return m ? m[1].trim() : '';
}

export interface ShelfReply {
  identity: ShopIdentity;
  owner: string;
  items: Omit<ShopItem, 'id'>[];
}

/** 첫 호출·새로고침 응답. 정체 블록은 첫 호출에만 (이미 있으면 known 을 그대로) */
export function parseShelf(raw: string, known: ShopIdentity | null): ShelfReply {
  const shelf = block(raw, 'shelf');
  if (!shelf) throw new ShopError('응답에 <shelf> 블록이 없어요.');
  const items = shelf.split('\n').map(parseLine).filter((x): x is Omit<ShopItem, 'id'> => !!x);
  if (!items.length) throw new ShopError('<shelf> 블록에 읽을 수 있는 물건 줄이 없어요 (이름|값|종류|설명|효과).');
  let identity = known ?? EMPTY_ID;
  const idText = block(raw, 'shop-identity');
  if (!known) {
    if (!idText) throw new ShopError('응답에 <shop-identity> 블록이 없어요.');
    const get = (k: string) => (new RegExp(`^\\s*${k}\\s*[:：]\\s*(.*)$`, 'im').exec(idText)?.[1] ?? '').trim();
    const sells = get('sells').split(/[,，/·]/).map((s) => kindOf(s)).filter((k): k is ItemKind => !!k);
    const range = get('price_range');
    const nums = range.split(/[~\-–—]/).map((s) => priceOf(s)).filter((n): n is number => n !== null);
    identity = { sells: [...new Set(sells)], never: clean(get('never'), 120), prices: clean(get('prices') || range, 120), min: nums.length === 2 ? Math.min(...nums) : 0, max: nums.length === 2 ? Math.max(...nums) : 0 };
    if (!identity.sells.length) throw new ShopError('<shop-identity> 의 sells 에 아는 종류가 없어요.');
  }
  return { identity, owner: clean(block(raw, 'owner'), 300), items };
}

export type TalkMode = 'none' | 'partial' | 'all';
export interface TalkReply {
  owner: string;
  mode: TalkMode;
  add: Omit<ShopItem, 'id'>[];
  reprice: { name: string; price: number }[];
  remove: string[];
  /** 전체 다시 짬 */
  all: Omit<ShopItem, 'id'>[];
  closed: boolean;
}

/** 주인에게 말한 뒤의 응답: 대사 + 진열대 변경(없음·일부·전체) + 거래 끊음 */
export function parseTalk(raw: string): TalkReply {
  const owner = clean(block(raw, 'owner'), 400);
  if (!owner) throw new ShopError('응답에 <owner> 블록(주인 대사)이 없어요.');
  const m = /<change\b([^>]*)>([\s\S]*?)<\/change\s*>/i.exec(raw);
  const modeRaw = (m && /mode\s*=\s*["']?(none|partial|all)/i.exec(m[1])?.[1]) ?? 'none';
  const mode = modeRaw.toLowerCase() as TalkMode;
  const out: TalkReply = { owner, mode, add: [], reprice: [], remove: [], all: [], closed: /<closed\s*\/?>/i.test(raw) };
  const body = m ? m[2] : '';
  if (mode === 'all') {
    out.all = body.split('\n').map(parseLine).filter((x): x is Omit<ShopItem, 'id'> => !!x);
    if (!out.all.length) throw new ShopError('mode="all" 인데 물건 줄이 없어요.');
  } else if (mode === 'partial') {
    for (const line0 of body.split('\n')) {
      const line = line0.trim();
      if (!line) continue;
      if (line.startsWith('+')) {
        const it = parseLine(line.slice(1));
        if (it) out.add.push(it);
      } else if (line.startsWith('~')) {
        const [name, price] = line.slice(1).split('|').map((c) => c.trim());
        const n = priceOf(price ?? '');
        if (name && n !== null) out.reprice.push({ name: clean(name, 30), price: n });
      } else if (line.startsWith('-')) {
        const name = clean(line.slice(1), 30);
        if (name) out.remove.push(name);
      }
    }
    if (!out.add.length && !out.reprice.length && !out.remove.length) out.mode = 'none';
  }
  return out;
}

// ── 적용 (정체 밖 물건은 버린다) ──

/** 가게 정체에 맞는 물건만. 값대는 여유 있게(절반~두 배) 본다 — 가게에 비싼 물건 하나쯤은 있을 수 있다 */
export function fitsIdentity(it: Pick<ShopItem, 'kind' | 'price'>, id: ShopIdentity): boolean {
  if (id.sells.length && !id.sells.includes(it.kind)) return false;
  if (id.min > 0 && id.max > 0 && (it.price < id.min / 2 || it.price > id.max * 2)) return false;
  return true;
}

const itemId = (key: string, name: string, n: number) => `s_${hash(`${key}|${normName(name)}|${n}`)}`;

function withIds(st: ShopState, list: Omit<ShopItem, 'id'>[], exclude: ShopItem[] = []): ShopItem[] {
  const out: ShopItem[] = [];
  for (const it of list) {
    if (!fitsIdentity(it, st.identity)) continue;
    if (out.some((x) => sameShopName(x.name, it.name)) || exclude.some((x) => sameShopName(x.name, it.name))) continue;
    out.push({ ...it, id: itemId(st.key, it.name, out.length + exclude.length) });
  }
  return out;
}

/** 첫 호출·새로고침 결과를 상태에 */
export function applyShelf(st: ShopState, r: ShelfReply, s: ShopSettings): ShopState {
  const base: ShopState = { ...st, identity: st.loaded ? st.identity : r.identity, loaded: true };
  const [lo] = SHOP_COUNTS.find((c) => c.id === s.count)!.range;
  const items = withIds(base, r.items).slice(0, 40);
  if (!items.length) throw new ShopError('받은 물건이 모두 가게 정체(파는 종류·값대) 밖이라 버렸어요. 다시 받아 보세요.');
  if (items.length < Math.min(lo, 3) && r.items.length >= lo) throw new ShopError('가게 정체에 맞는 물건이 너무 적어요. 다시 받아 보세요.');
  const prev = [...new Set([...st.prev, ...st.items.filter((x) => !x.sold).map((x) => x.name)])].slice(-40);
  const talk = r.owner ? [...st.talk, { who: 'owner' as const, text: r.owner }] : st.talk;
  return { ...base, items: [...st.items.filter((x) => x.sold), ...items], talk: talk.slice(-40), prev, closed: false };
}

/** 주인에게 말한 결과를 상태에 (내 말은 부르는 쪽이 먼저 적는다) */
export function applyTalk(st: ShopState, r: TalkReply, kick = true): ShopState {
  let items = st.items.slice();
  if (r.mode === 'all') {
    const fresh = withIds(st, r.all, items.filter((x) => x.sold));
    if (fresh.length) items = [...items.filter((x) => x.sold), ...fresh];
  } else if (r.mode === 'partial') {
    for (const n of r.remove) items = items.filter((x) => x.sold || !sameShopName(x.name, n));
    for (const p of r.reprice) {
      items = items.map((x) => (!x.sold && sameShopName(x.name, p.name) && p.price !== x.price ? { ...x, price: p.price, orig: x.orig ?? x.price } : x));
    }
    items = [...items, ...withIds(st, r.add, items)];
  }
  const talk: ShopLine[] = [...st.talk, { who: 'owner', text: r.owner }];
  return { ...st, items: items.slice(0, 40), talk: talk.slice(-40), closed: st.closed || (kick && r.closed) };
}

export function sayToOwner(st: ShopState, text: string): ShopState {
  const talk: ShopLine[] = [...st.talk, { who: 'me', text: clean(text, 300) }];
  return { ...st, talk: talk.slice(-40) };
}

/** 구입: 진열대에서 빠지고(sold) 산 값이 남는다. 없거나 이미 샀으면 그대로 */
export function markSold(st: ShopState, id: string): ShopState {
  const it = st.items.find((x) => x.id === id && !x.sold);
  if (!it) return st;
  return { ...st, items: st.items.map((x) => (x.id === id ? { ...x, sold: true } : x)) };
}

export const shelfItems = (st: ShopState): ShopItem[] => st.items.filter((x) => !x.sold);
export const soldItems = (st: ShopState): ShopItem[] => st.items.filter((x) => x.sold);

/** 다음 턴 본편에 넘길 이번 방문 사건 (core/items.ts itemsBlock 의 This turn). 마지막 응답의 상점일 때만 */
export function shopEvents(chat: Chat): string[] {
  const st = currentShop(chat);
  if (!st) return [];
  const out: string[] = [];
  const lastOwner = [...st.talk].reverse().find((l) => l.who === 'owner');
  const spoke = st.talk.some((l) => l.who === 'me');
  if (st.closed) out.push(`was refused service and sent out of ${st.shop}${lastOwner ? ` ("${lastOwner.text.slice(0, 80)}")` : ''}`);
  else if (spoke && lastOwner) out.push(`talked with the owner of ${st.shop}; last thing the owner said: "${lastOwner.text.slice(0, 80)}"`);
  return out;
}

// ── 요청문 ──

export interface ShopSource {
  /** 가게·주인 */
  st: ShopState;
  /** 참고 자료 (refs.ts refText: 봇 설명·활성 로어북·주인 로어북·위키 가게 문서) */
  refs: string;
  /** 최근 본문 (2~4턴) */
  story: string;
  /** 상태창 마지막 줄 */
  status: string;
  /** 진행 중 괴이·사건 */
  situation: string;
  /** 주인공 신분 */
  identity: string;
  /** 지침에 붙일 언어 줄 (genSettings.language) */
  language: string | null;
}

const kindsLine = () => ITEM_KINDS.map((k) => `${k.id} (${k.label}: ${k.hint})`).join(', ');

const SYSTEM_COMMON =
  'You run a shop inside an ongoing Korean urban-horror roleplay (서울의 이면, 괴이). You are the application backend for the shop screen, not the narrator: ' +
  'you only decide what is on the shelf and what the shop owner says. The protagonist is the player. Write everything in Korean unless told otherwise. ' +
  'Prices are in Korean won as plain integers. Never mention the player\'s money or inventory (you do not know them). Do not write anything outside the required blocks.';

const SHELF_RULES = (s: ShopSettings, st: ShopState) => {
  const r = SHOP_COUNTS.find((c) => c.id === s.count)!.range;
  return [
    `Shelf size: ${r[0]} to ${r[1]} items. One item per line, exactly: 이름|값|종류|설명|효과. 종류 must be one of: ${kindsLine()}. 설명 ≤ 60 chars (what it is, condition, quantity). 효과 ≤ 40 chars or empty (what it does in the story; leave empty for ordinary goods).`,
    'Items must be things this shop would actually stock, in this world, at this moment. Everyday goods are fine; strange goods only if the shop is that kind of place.',
    s.diverse ? 'Variety: avoid the most obvious choices; mix cheap and dear, common and specific. Do not repeat items from the previous shelf.' : '',
    s.price ? `Price guide from the player: ${s.price}` : 'Prices should feel like real Korean prices for that kind of shop.',
    s.avoidPrev && st.prev.length ? `Previously shown here (do not repeat): ${st.prev.join(', ')}` : '',
  ].filter(Boolean).join('\n');
};

const IDENTITY_FORMAT =
  '<shop-identity>\nsells: comma-separated 종류 ids this shop sells (subset of the list above)\nnever: what this shop does not and will not sell (one line)\nprices: price character in one line (e.g. 동네 철물점 값, 비싸지 않음)\nprice_range: lowest~highest won a normal item here costs, e.g. 1000~300000\n</shop-identity>';

export const SHOP_THOUGHTS =
  '1. What kind of place is this shop, who runs it, what does the scene say about it?\n2. What would really be on its shelf right now (season, district, events going on)?\n3. Which of those fit the required kinds; pick a varied set within the size limit.\n4. Owner\'s first line: in character, short, no exposition.';

const TALK_THOUGHTS =
  '1. What did the player actually say or want (question, request, haggling, chat)?\n2. Given this owner\'s character and the shop identity, what is the honest reaction: answer only, fetch something, re-stock the whole shelf, lower a price, refuse, or end the dealing?\n3. Pick exactly one change mode. Only things within the shop identity may be added.\n4. Write the owner\'s line in character.';

function material(src: ShopSource, s: ShopSettings): string {
  const parts = [`[가게]\n${src.st.shop}${src.st.owner ? ` / 주인: ${src.st.owner}` : ''}`];
  if (src.st.loaded) {
    const id = src.st.identity;
    parts.push(`[가게 정체 — 고정]\nsells: ${id.sells.join(', ')}\nnever: ${id.never || '-'}\nprices: ${id.prices || '-'}${id.min && id.max ? `\nprice_range: ${id.min}~${id.max}` : ''}`);
  }
  if (src.refs) parts.push(`[참고 자료 — 작중 인물에게 자동 공개되지 않음]\n${src.refs}`);
  if (s.context) {
    if (src.identity) parts.push(`[주인공 신분]\n${src.identity}`);
    if (src.status) parts.push(`[상태창 — 지금 시각·장소]\n${src.status}`);
    if (src.situation) parts.push(`[진행 중 괴이·사건]\n${src.situation}`);
    if (src.story) parts.push(`[최근 본문]\n${src.story}`);
  }
  return parts.join('\n\n');
}

const craft = (messages: CraftMessage[], s: ShopSettings, thoughts: string) => craftMessages(messages, { thoughts: s.thoughts, memo: false, reiterate: 0 }, { thoughts });

/** 첫 호출(정체 + 진열대 + 주인 첫 대사) 또는 새로고침(진열대 + 한마디) */
export function shelfPrompt(src: ShopSource, s: ShopSettings): CraftMessage[] {
  const first = !src.st.loaded;
  const system = [
    SYSTEM_COMMON,
    SHELF_RULES(s, src.st),
    first
      ? `First visit. Decide the shop's identity once from the scene and the owner's character; it will be fixed for the rest of this visit.\nOutput, in this order:\n${IDENTITY_FORMAT}\n<owner>\nthe owner's first line to the protagonist, in character, 1–3 sentences, Korean, no stage directions\n</owner>\n<shelf>\n이름|값|종류|설명|효과\n...\n</shelf>`
      : 'Re-stock: the identity is fixed; make a different shelf that still fits it.\nOutput, in this order:\n<owner>\none short line from the owner about the new goods (or empty)\n</owner>\n<shelf>\n이름|값|종류|설명|효과\n...\n</shelf>',
    src.language ?? '',
  ].filter(Boolean).join('\n\n');
  return craft([{ role: 'system', content: system }, { role: 'user', content: `${material(src, s)}\n\n[현재 작업]\n${first ? '가게 정체·주인 첫 대사·진열대' : '진열대 새로 짜기'}` }], s, SHOP_THOUGHTS);
}

/** 주인에게 말하기 (흥정·문의·요청·잡담). 대화는 이번 방문 것 전부 */
export function talkPrompt(src: ShopSource, s: ShopSettings): CraftMessage[] {
  const st = src.st;
  const shelf = shelfItems(st).map((x) => `${x.name}|${x.price}|${x.kind}|${x.desc}|${x.effect}`).join('\n') || '(empty)';
  const sold = soldItems(st).map((x) => x.name).join(', ');
  const system = [
    SYSTEM_COMMON,
    'The protagonist speaks to the owner. Read what they mean from context — do not keyword-match. Decide the owner\'s reaction from the owner\'s character and the fixed shop identity. ' +
    'Haggling: the owner may refuse, counter, or accept; accept only when it makes sense for this owner, and then lower that item\'s price. ' +
    'Requests for something not on the shelf: fetch it (partial add) only if it fits the shop identity; otherwise the owner says they do not carry it. ' +
    'If the player wants a different selection, re-stock the whole shelf (all). Questions and small talk change nothing (none). ' +
    (s.kick ? 'If the owner has had enough (insults, endless haggling, trouble), they may end the dealing: say so in character and add <closed/>.' : 'The owner never ends the dealing; however annoyed, they keep the shop open (never output <closed/>).'),
    `Output, in this order:\n<owner>\nthe owner's reply, in character, Korean, 1–4 sentences, no stage directions\n</owner>\n<change mode="none|partial|all">\nnone: empty.\npartial: one change per line — "+ 이름|값|종류|설명|효과" to add, "~ 이름|새값" to change a price, "- 이름" to remove.\nall: full new shelf, one item per line (이름|값|종류|설명|효과).\n</change>\n<closed/> only if the owner ends the dealing.`,
    SHELF_RULES(s, st),
    src.language ?? '',
  ].filter(Boolean).join('\n\n');
  const talk = st.talk.map((l) => `${l.who === 'me' ? '[주인공]' : '[주인]'} ${l.text}`).join('\n');
  return craft([{ role: 'system', content: system }, { role: 'user', content: `${material(src, s)}\n\n[지금 진열대]\n${shelf}${sold ? `\n\n[이번 방문에 산 것]\n${sold}` : ''}\n\n[이번 방문 대화 — 마지막 줄이 지금 한 말]\n${talk}` }], s, TALK_THOUGHTS);
}

/** 본편 [Inventory] 안내에 붙는 표식 지침 (설정 「상점」 켬일 때, 1~2줄) */
export const SHOP_GUIDE =
  'Shop tag: when the scene ends somewhere the protagonist could buy things from someone present (a store, stall, vendor, dealer), add one line after the status line: [shop: 가게 이름|주인 이름] (주인 이름 = the seller's name exactly as already given in the story or the roster; if the seller has no name in the story, leave it empty — never invent a name or a description). Omit the tag when no trade is possible. Never list goods or prices yourself; the shop screen handles them.';

export const genLanguage = (vars: Vars): string | null => genSettings(vars).language;
export const kindLabel = itemKindLabel;
