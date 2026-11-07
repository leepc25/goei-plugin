// 소지품 (2026-11-07 사용자와 합의, docs/인계/소지품_1107/소지품_계획_1107.md 「최종안」).
// 목표는 본편 모델이 지금 상황(무엇을 갖고 있는지·한계·이번 턴 사건)을 알고 응답에 반영하는 것. 화면·목록은 그 보조.
// 플러그인은 막지도 경고하지도 않는다: 칸이 넘쳐도 그냥 넣고 「17/16」로 보여 주며, 푸는 건 본편 응답.
// 저장은 채팅 변수 `$st_items` (JSON). 물건 줄은 기준 메시지(anchor)가 채팅에 남아 있을 때만 산다 (가계부 `$st_wallet` 와 같은 방식).
// 개수(×n)는 두지 않는다 — 양·상태는 설명 글로 (「두 봉지 남음」「입고 있음」).
import type { Chat } from './types';
import { aliveAnchors } from './wallet';
import { messageKey } from './people/store';
import type { PromptMessage } from './request';
import { shopEvents, shopOn, SHOP_GUIDE } from './shop';

export const ITEMS_VAR = '$st_items';
/** 「사용」 상자: 다음 보낼 때 본편에 넘길 물건 이름들 (JSON 배열). 보내면 비운다 */
export const ITEM_USE_VAR = '$st_item_use';
/** 「사용」 상자를 보낸 턴의 마지막 유저 메시지 키. 비면 아직 안 보냄. 같은 키면 그 턴의 다시 굴리기 (상자를 다시 넘긴다) */
export const ITEM_USE_AT_VAR = '$st_item_use_at';
/** 설정 (채팅 변수, 새 채팅 기본값은 prefs.vars): 칸 수·한계 문장·본편에 넘기기·보조 모델 자동 읽기 */
export const ITEM_SLOTS_VAR = '$it_slots';
export const ITEM_LIMIT_VAR = '$it_limit';
export const ITEM_PUSH_VAR = '$it_push';
export const ITEM_AUTO_VAR = '$it_auto';
export const ITEM_SLOTS_DEFAULT = 16;
export const ITEM_SLOTS_MIN = 8;
export const ITEM_SLOTS_MAX = 40;
export const ITEM_LIMIT_DEFAULT = '가방 하나와 주머니, 두 손';

export type ItemKind = 'weapon' | 'wear' | 'tool' | 'device' | 'charm' | 'medical' | 'food' | 'paper' | 'key' | 'seal' | 'anomaly' | 'valuable' | 'consumable' | 'misc';

/** 종류 14개 (고정). 장터·보조 모델·직접 넣기 모두 이 값 중 하나를 적고, 그림은 값을 따라간다. 목록 밖 값은 misc */
export const ITEM_KINDS: { id: ItemKind; label: string; hint: string }[] = [
  { id: 'weapon', label: '무기', hint: '총·칼·둔기' },
  { id: 'wear', label: '방호구·옷', hint: '조끼·장갑·제복' },
  { id: 'tool', label: '도구', hint: '손전등·밧줄·공구' },
  { id: 'device', label: '전자기기', hint: '폰·녹음기·카메라·측정기' },
  { id: 'charm', label: '종교물·부적', hint: '십자가·염주·부적·성수' },
  { id: 'medical', label: '의료', hint: '약·붕대·주사' },
  { id: 'food', label: '음식·기호품', hint: '물·초콜릿·담배·술' },
  { id: 'paper', label: '기록물', hint: '서류·사진·수첩·USB' },
  { id: 'key', label: '열쇠·출입증', hint: '열쇠·카드키·신분증' },
  { id: 'seal', label: '봉인구·용기', hint: '수갑·봉인 상자·시료통' },
  { id: 'anomaly', label: '회수물·이상물', hint: '괴이에서 나온 것' },
  { id: 'valuable', label: '귀중품', hint: '보석·시계·금붙이 (현금은 가계부)' },
  { id: 'consumable', label: '소모품', hint: '건전지·탄약·소금·초' },
  { id: 'misc', label: '기타', hint: '어디에도 안 맞는 것' },
];

export const itemKind = (v: unknown): ItemKind => (ITEM_KINDS.some((k) => k.id === v) ? (v as ItemKind) : 'misc');
export const itemKindLabel = (k: ItemKind): string => ITEM_KINDS.find((x) => x.id === k)?.label ?? '기타';

export type ItemFrom = 'store' | 'story' | 'manual';

export interface Item {
  id: string;
  /** 이름 (≤30). 같은 이름이 또 들어오면 새 줄 대신 설명만 갱신 */
  name: string;
  /** 설명 (≤80). 양·상태도 여기 글로 */
  desc: string;
  kind: ItemKind;
  /** 효과 (≤60, 없으면 빈 문자열) */
  effect: string;
  from: ItemFrom;
  /** 기준 메시지 키 (messageKey). 직접 넣은 건 빈 문자열 (늘 산다) */
  anchor: string;
  /** 장터: 값·가계부 거래 id */
  price?: number;
  walletId?: string;
  /** 본문: 근거 인용 */
  quote?: string;
  at: string;
}

export type ItemLogWhat = 'use' | 'drop' | 'gone' | 'merge';
export type ItemLogBy = 'story' | 'manual' | 'use';

/** 사용·처분 기록 한 줄 (화면 「기록」·찾기). 상한 없음, 저장 안전용 400줄 */
export interface ItemLog {
  id: string;
  name: string;
  what: ItemLogWhat;
  by: ItemLogBy;
  anchor: string;
  quote?: string;
  note?: string;
  at: string;
}

export interface Items {
  list: Item[];
  log: ItemLog[];
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

export function readItems(vars: Record<string, unknown> | undefined): Items {
  const raw = vars?.[ITEMS_VAR];
  const empty: Items = { list: [], log: [] };
  if (typeof raw !== 'string' || !raw.trim()) return empty;
  try {
    const o = JSON.parse(raw) as Partial<Items>;
    if (!o || typeof o !== 'object') return empty;
    const list = (Array.isArray(o.list) ? o.list.filter(isItem) : []).map((x) => ({ ...x, kind: itemKind(x.kind), desc: clean(x.desc, 80), effect: clean(x.effect, 60) })).slice(-200);
    return { list, log: Array.isArray(o.log) ? o.log.filter(isLog).slice(-400) : [] };
  } catch {
    return empty;
  }
}

export const itemsVars = (it: Items): Record<string, string> => ({ [ITEMS_VAR]: JSON.stringify(it) });

/** 살아 있는 물건 (직접 넣은 건 늘, 나머지는 기준 메시지가 남아 있을 때) */
export function liveItems(it: Items, alive: Set<string>): Item[] {
  return it.list.filter((e) => !e.anchor || alive.has(e.anchor));
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
  kind?: unknown;
  effect?: string;
  from: ItemFrom;
  anchor: string;
  price?: number;
  walletId?: string;
  quote?: string;
  id?: string;
  at?: string;
}

/** 물건 더하기. 같은 이름이 살아 있으면 새 줄을 만들지 않고 설명·효과·종류만 갱신 (「두 개」 같은 건 설명 글로).
 * 이름이 비면 그대로. 빈 설명은 있던 설명을 지우지 않는다 */
export function addItem(it: Items, alive: Set<string>, e: ItemInput): Items {
  const name = clean(e.name, 30);
  if (!name) return it;
  const desc = clean(e.desc, 80);
  const effect = clean(e.effect, 60);
  const kind = e.kind === undefined ? undefined : itemKind(e.kind);
  const quote = e.quote ? clean(e.quote, 120) : undefined;
  const found = liveItems(it, alive).find((x) => sameItemName(x.name, name));
  if (found) {
    const next: Item = { ...found, desc: desc || found.desc, effect: effect || found.effect, kind: kind ?? found.kind, ...(quote ? { quote } : {}) };
    if (JSON.stringify(next) === JSON.stringify(found)) return it;
    return { ...it, list: it.list.map((x) => (x.id === found.id ? next : x)) };
  }
  const id = e.id ?? itemId(e.anchor, name);
  if (it.list.some((x) => x.id === id)) return it;
  const row: Item = {
    id, name, desc, kind: kind ?? 'misc', effect, from: e.from, anchor: e.anchor, at: e.at ?? new Date().toISOString(),
    ...(Number.isSafeInteger(e.price) ? { price: e.price } : {}),
    ...(e.walletId ? { walletId: e.walletId } : {}),
    ...(quote ? { quote } : {}),
  };
  return { ...it, list: [...it.list, row].slice(-200) };
}

/** 이름·설명·효과·종류 고치기 (직접) */
export function updateItem(it: Items, id: string, patch: { name?: string; desc?: string; effect?: string; kind?: unknown }): Items {
  const cur = it.list.find((x) => x.id === id);
  if (!cur) return it;
  const next: Item = {
    ...cur,
    ...(patch.name !== undefined && clean(patch.name, 30) ? { name: clean(patch.name, 30) } : {}),
    ...(patch.desc !== undefined ? { desc: clean(patch.desc, 80) } : {}),
    ...(patch.effect !== undefined ? { effect: clean(patch.effect, 60) } : {}),
    ...(patch.kind !== undefined ? { kind: itemKind(patch.kind) } : {}),
  };
  return { ...it, list: it.list.map((x) => (x.id === id ? next : x)) };
}

const logId = (what: string, anchor: string, name: string, n: number) => `l_${hash(`${what}|${anchor}|${normName(name)}|${n}`)}`;

/** 기록 한 줄 (살아 있는 기록만 — 기준 메시지가 사라지면 같이 빠지도록 anchor 를 둔다) */
export function addItemLog(it: Items, l: Omit<ItemLog, 'id' | 'at'> & { id?: string; at?: string }): Items {
  const id = l.id ?? logId(l.what, l.anchor, l.name, it.log.length);
  if (it.log.some((x) => x.id === id)) return it;
  const row: ItemLog = { ...l, id, name: clean(l.name, 30), at: l.at ?? new Date().toISOString(), ...(l.quote ? { quote: clean(l.quote, 120) } : {}), ...(l.note ? { note: clean(l.note, 60) } : {}) };
  return { ...it, log: [...it.log, row].slice(-400) };
}

/** 물건 빼기 → 기록에 한 줄. what: drop(버림)·gone(본문에서 없어짐)·use(다 씀) */
export function removeItem(it: Items, id: string, what: ItemLogWhat, by: ItemLogBy, anchor = '', extra: { quote?: string; note?: string } = {}): Items {
  const cur = it.list.find((x) => x.id === id);
  if (!cur) return it;
  return addItemLog({ ...it, list: it.list.filter((x) => x.id !== id) }, { name: cur.name, what, by, anchor, ...extra });
}

/** 두 줄을 하나로 (직접). keep 가 남고 other 는 빠진다. 설명은 「남는 설명 / 상대 설명」, 근거는 둘 다.
 * 이름이 달라도 된다 — 애초에 이름이 다른 두 칸을 하나로 만들려고 있는 기능 (사용자 06:41) */
export function mergeItems(it: Items, keepId: string, otherId: string, name?: string): Items {
  const keep = it.list.find((x) => x.id === keepId);
  const other = it.list.find((x) => x.id === otherId);
  if (!keep || !other || keepId === otherId) return it;
  const desc = clean([keep.desc, other.desc].filter(Boolean).join(' / '), 80);
  const merged: Item = {
    ...keep,
    name: clean(name ?? keep.name, 30) || keep.name,
    desc,
    effect: keep.effect || other.effect,
    ...(keep.quote || other.quote ? { quote: clean([keep.quote, other.quote].filter(Boolean).join(' / '), 120) } : {}),
    // 직접 넣은 줄과 합치면 늘 사는 쪽(anchor '')으로
    anchor: keep.anchor && other.anchor ? keep.anchor : '',
    from: keep.anchor && other.anchor ? keep.from : 'manual',
  };
  const list = it.list.filter((x) => x.id !== otherId).map((x) => (x.id === keepId ? merged : x));
  return addItemLog({ ...it, list }, { name: other.name, what: 'merge', by: 'manual', anchor: '', note: `${merged.name}와 합침` });
}

/** 칸 수 설정 (8~40, 기본 16) */
export function itemSlots(vars: Record<string, unknown> | undefined): number {
  const n = Number(vars?.[ITEM_SLOTS_VAR]);
  if (!Number.isSafeInteger(n)) return ITEM_SLOTS_DEFAULT;
  return Math.min(ITEM_SLOTS_MAX, Math.max(ITEM_SLOTS_MIN, n));
}
export const itemLimit = (vars: Record<string, unknown> | undefined): string => clean(vars?.[ITEM_LIMIT_VAR], 60) || ITEM_LIMIT_DEFAULT;
/** 본편에 넘기기 (기본 켬, '0' 이면 끔) */
export const itemPushOn = (vars: Record<string, unknown> | undefined) => vars?.[ITEM_PUSH_VAR] !== '0';
/** 보조 모델이 본문을 읽어 목록을 맞추기 (기본 켬, '0' 이면 끔) */
export const itemAutoOn = (vars: Record<string, unknown> | undefined) => vars?.[ITEM_AUTO_VAR] !== '0';

/** 「사용」 상자 읽기: 물건 이름 목록 */
export function readItemUse(vars: Record<string, unknown> | undefined): string[] {
  const raw = vars?.[ITEM_USE_VAR];
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string').map((x) => clean(x, 30)).filter(Boolean).slice(0, 8) : [];
  } catch {
    return [];
  }
}
export const itemUseVars = (names: string[]): Record<string, string> => ({ [ITEM_USE_VAR]: names.length ? JSON.stringify(names.slice(0, 8)) : '' });

/** 이번 턴에 새로 산 것 (장터): 마지막 응답 뒤에 들어온 store 줄 — 아직 본편이 모르는 것 */
export function newlyBought(list: Item[], lastAnchor: string): Item[] {
  return list.filter((e) => e.from === 'store' && e.anchor === lastAnchor);
}

/** 본편에 넘기는 글. 비면 빈 문자열 (붙이지 않는다). 전부 넘김 — 자르지 않는다 */
export function itemsBlock(list: Item[], opts: { slots: number; limit: string; use?: string[]; bought?: string[]; events?: string[]; always?: boolean }): string {
  const lines = list.map((e) => `- ${e.name}${e.desc ? ` — ${e.desc}` : ''}${e.effect ? ` (${e.effect})` : ''}`);
  const use = (opts.use ?? []).filter(Boolean);
  const bought = (opts.bought ?? []).filter(Boolean);
  const extra = (opts.events ?? []).filter(Boolean);
  if (!lines.length && !use.length && !bought.length && !extra.length && !opts.always) return '';
  const out = [`[Inventory] ${list.length}/${opts.slots}${list.length > opts.slots ? ' (over the limit)' : ''}`, ...(lines.length ? lines : ['- (nothing)'])];
  out.push(`Carry limit: ${opts.limit}`);
  const events: string[] = [];
  if (use.length) events.push(`uses ${use.join(', ')}`);
  if (bought.length) events.push(`just bought ${bought.join(', ')}`);
  events.push(...extra);
  if (list.length > opts.slots) events.push('carrying more than the limit');
  if (events.length) out.push(`This turn: ${events.join('; ')}`);
  return out.join('\n');
}

/** 물건·기록 찾기 (이름·설명·효과·근거·기록 글) */
export function searchItems(it: Items, alive: Set<string>, q: string): { items: Item[]; log: ItemLog[] } {
  const k = q.trim().toLowerCase();
  if (!k) return { items: liveItems(it, alive), log: it.log.slice().reverse() };
  const hit = (...s: (string | undefined)[]) => s.some((x) => (x ?? '').toLowerCase().includes(k));
  return {
    items: liveItems(it, alive).filter((e) => hit(e.name, e.desc, e.effect, e.quote, itemKindLabel(e.kind))),
    log: it.log.filter((l) => hit(l.name, l.note, l.quote)).reverse(),
  };
}

// ── 본편 요청·응답 (body.ts) ──

export const INVENTORY_HEAD = '[Inventory]';
const INVENTORY_NOTE =
  'What the protagonist carries right now (name — state (effect)); nothing else is on hand. Keep it in mind when you write what they do, and when "This turn" lists an event, handle it in this response: ' +
  'describe a used item taking effect (or failing), and if they carry more than the limit, let that show in the story — something is awkward to hold, dropped, left behind, or someone remarks on it. Never print this list back.';

/** 채팅의 마지막 유저 메시지 키 (없으면 '') */
export function lastUserKey(chat: Chat): string {
  const list = chat.message ?? [];
  for (let i = list.length - 1; i >= 0; i--) if (list[i].role === 'user') return messageKey(list[i], i);
  return '';
}
/** 채팅의 마지막 봇 응답 키 (없으면 '') */
export function lastBotKey(chat: Chat): string {
  const list = chat.message ?? [];
  for (let i = list.length - 1; i >= 0; i--) if (list[i].role === 'char') return messageKey(list[i], i);
  return '';
}

/** 이번 요청에 넘길 「사용」 목록: 아직 안 보냈거나(at 비어 있음), 보낸 턴을 다시 굴리는 중일 때(at = 지금 마지막 유저 키) */
export function pendingItemUse(vars: Record<string, unknown> | undefined, userKey: string): string[] {
  const at = typeof vars?.[ITEM_USE_AT_VAR] === 'string' ? (vars[ITEM_USE_AT_VAR] as string) : '';
  return !at || at === userKey ? readItemUse(vars) : [];
}

/** 이 채팅의 [Inventory] 글 (본편에 넘기기 설정이 꺼졌거나 넘길 게 없으면 '') */
export function inventoryText(chat: Chat): string {
  const vars = chat.scriptstate;
  if (!itemPushOn(vars)) return '';
  const live = liveItemsOf(readItems(vars), chat);
  // 상점(core/shop.ts): 켜져 있으면 물건이 없어도 블록을 보내 표식 지침을 넘기고, 이번 방문의 사건(주인과 나눈 말·쫓겨남)을 This turn 에 더한다
  const shop = shopOn(vars);
  const text = itemsBlock(live, {
    slots: itemSlots(vars),
    limit: itemLimit(vars),
    use: pendingItemUse(vars, lastUserKey(chat)).filter((n) => live.some((e) => sameItemName(e.name, n))),
    bought: newlyBought(live, lastBotKey(chat)).map((e) => e.name),
    events: shop ? shopEvents(chat) : [],
    always: shop,
  });
  return text ? `${text}\n${INVENTORY_NOTE}${shop ? `\n${SHOP_GUIDE}` : ''}` : '';
}

/** 요청: [Inventory] 글을 마지막 유저 메시지 앞에 system 으로 넣는다 (상태창 블록과 같은 자리). 이미 있으면 그대로 */
export function withInventory<M extends PromptMessage>(messages: M[], chat: Chat): M[] {
  if (messages.some((m) => typeof m?.content === 'string' && m.content.startsWith(INVENTORY_HEAD))) return messages;
  const text = inventoryText(chat);
  if (!text) return messages;
  const at = messages.map((m) => m?.role).lastIndexOf('user');
  const block = { role: 'system', content: text } as M;
  return at < 0 ? [...messages, block] : [...messages.slice(0, at), block, ...messages.slice(at)];
}

/**
 * 응답이 붙은 뒤: 「사용」 상자를 정리한다. 바뀔 게 없으면 null.
 * - 처음 보낸 턴: at 에 유저 키를 적고, 사용 기록을 이 응답에 묶어 남긴다 (응답이 지워지면 기록도 빠진다)
 * - 같은 턴 다시 굴리기: 기록만 새 응답에 다시 묶는다 (옛 응답의 기록은 그 응답과 함께 사라짐)
 * - 다음 턴: 상자를 비운다
 */
export function settleItemUse(chat: Chat, responseIndex: number): Record<string, string> | null {
  const vars = chat.scriptstate ?? {};
  const names = readItemUse(vars);
  const at = typeof vars[ITEM_USE_AT_VAR] === 'string' ? (vars[ITEM_USE_AT_VAR] as string) : '';
  if (!names.length && !at) return null;
  const userKey = lastUserKey(chat);
  if (at && at !== userKey) return { ...itemUseVars([]), [ITEM_USE_AT_VAR]: '' };
  if (!names.length) return { [ITEM_USE_AT_VAR]: '' };
  const m = chat.message?.[responseIndex];
  if (!m || m.role !== 'char') return null;
  const anchor = messageKey(m, responseIndex);
  const it0 = readItems(vars);
  let it = it0;
  const alive = aliveAnchors(chat);
  for (const n of names) {
    if (it.log.some((l) => l.what === 'use' && l.anchor === anchor && sameItemName(l.name, n))) continue;
    const item = liveItems(it, alive).find((e) => sameItemName(e.name, n));
    it = addItemLog(it, { name: item?.name ?? n, what: 'use', by: 'use', anchor });
  }
  if (it === it0 && at === userKey) return null;
  return { ...(it === it0 ? {} : itemsVars(it)), [ITEM_USE_AT_VAR]: userKey };
}
