// 우주 쇼핑몰 맞춤 주문 (11-09 사용자): 상담 창에서 운영자가 견적(이름·값·납기)을 내면 선납하고 주문한다.
// 완성품은 진열대가 아니라 왼쪽 「주문 조회」에서 받는다. 납기는 상태창 [▣] 의 작중 시각으로 판정한다 — 모델 호출 없이, 매 턴 시각만 비교.
// 완성품(설명·효과·숨긴 진실)은 견적 때 모델이 이미 정해 두고 받을 때까지 숨긴다 (사용자 13:35: 납기 때 모델을 다시 굴리지 않는다).
import type { Chat } from './types';
import { findStatusTags, statusMinute } from './world/status';
import type { ShopItem } from './shop';
import { messageKey } from './people/store';

type Vars = Record<string, unknown> | undefined;

export const COS_ORDERS_KEY = '$cos_orders';
export const COS_ORDERS_MAX = 12;

/** 견적 → 주문. item 은 받을 때 소지품에 들어갈 물건 (진실 포함, 화면엔 이름만) */
export interface CosOrder {
  id: string;
  /** 주문한 응답 키 (가계부 거래 기준) */
  anchor: string;
  price: number;
  /** 납기 (시간) */
  hours: number;
  /** 주문 때 작중 시각 (분, statusMinute). 상태창이 없으면 null → 다음 응답부터 받을 수 있다 */
  orderedAt: number | null;
  /** 주문 때 마지막 응답 키 (orderedAt 이 null 일 때 「다음 응답」 판정용) */
  orderedKey: string;
  item: Omit<ShopItem, 'id' | 'price' | 'sold' | 'tag' | 'was' | 'orig' | 'pay'>;
  /** 선납 거래 id (받을 때 소지품에 같은 id 로 남긴다) */
  walletId?: string;
  /** 받은 뒤 (받은 응답 키 — 그 응답이 지워지면 물건이 죽으니 다시 받을 수 있게 되살린다, 11-09 전수점검) */
  taken?: boolean;
  takenKey?: string;
}

export function readOrders(vars: Vars): CosOrder[] {
  const raw = String(vars?.[COS_ORDERS_KEY] ?? '');
  if (!raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((o): o is CosOrder => !!o && typeof o === 'object' && typeof (o as CosOrder).id === 'string' && !!(o as CosOrder).item && typeof (o as CosOrder).item.name === 'string');
  } catch {
    return [];
  }
}
/** 살아 있는 주문 (릴리스 점검 11-09): 주문한 응답을 지우거나 다시 굴리면 선납 거래(같은 anchor)가 가계부에서 빠져 돈이 돌아온다.
 *  주문도 없던 것으로 본다 — 안 그러면 죽은 orderedKey 때문에 곧바로 「받기」가 떠 공짜로 받았다. 받은 것은 소지품 쪽이 따로 다룬다 */
export const liveOrders = (vars: Vars, alive: Set<string>): CosOrder[] =>
  readOrders(vars)
    .map((o) => (o.taken && o.takenKey && !alive.has(o.takenKey) ? { ...o, taken: false, takenKey: undefined } : o))
    .filter((o) => o.taken || !o.anchor || alive.has(o.anchor));
/** 넘치면 받은 것(taken)부터 오래된 순으로 버린다. 선납하고 아직 안 받은 주문은 버리지 않는다 (릴리스 점검 11-09: 돈만 나가고 주문이 사라졌다) */
export function pruneOrders(list: CosOrder[]): CosOrder[] {
  const out = [...list];
  while (out.length > COS_ORDERS_MAX) {
    const i = out.findIndex((o) => o.taken);
    if (i < 0) break;
    out.splice(i, 1);
  }
  return out;
}
export const ordersVars = (list: CosOrder[]): Record<string, string> => ({ [COS_ORDERS_KEY]: list.length ? JSON.stringify(pruneOrders(list)) : '' });

/** 지금 작중 시각 (분): 채팅 끝에서부터 상태창 [▣] 줄을 찾는다. 없으면 null */
export function worldMinute(chat: Chat): number | null {
  const list = chat.message ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (m.role !== 'char' || typeof m.data !== 'string') continue;
    const tags = findStatusTags(m.data);
    if (!tags.length) continue;
    const t = tags[tags.length - 1];
    const min = statusMinute(t.date, t.time);
    if (min !== null) return min;
  }
  return null;
}

/** 납기 시각 (분). 주문 때 시각을 모르면 null */
export const orderDue = (o: CosOrder): number | null => (o.orderedAt === null ? null : o.orderedAt + Math.round(o.hours * 60));

/** 받을 수 있나: 작중 시각이 납기를 지났거나, 시각을 모르면 주문 뒤 새 응답이 하나라도 나왔을 때 */
export function orderReady(o: CosOrder, nowMin: number | null, lastKey: string): boolean {
  if (o.taken) return false;
  const due = orderDue(o);
  if (due !== null && nowMin !== null) return nowMin >= due;
  return lastKey !== '' && lastKey !== o.orderedKey;
}

/** 분 → 「2025.01.01 02:47 AM」 (상태창과 같은 꼴) */
export function minuteText(min: number): string {
  const d = new Date(min * 60000);
  const h24 = d.getUTCHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')} ${String(h).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** 운영자 요청문에 넘길 진행 중 주문 (다시 견적 내지 말게·물어보면 답하게) */
export function ordersText(list: CosOrder[], nowMin: number | null, lastKey: string): string {
  return list.filter((o) => !o.taken).map((o) => {
    const due = orderDue(o);
    const state = orderReady(o, nowMin, lastKey) ? 'ready for pickup' : due !== null ? `due ${minuteText(due)}` : `due in ${o.hours}h`;
    return `${o.item.name} (${o.price} won, ${state})`;
  }).join(', ');
}

// ── 완성 알림 표식 `[shop-ready: 사이트|이름;;이름]` (11-11 사용자: 상점 카드처럼 응답 끝 표식으로, 상태창과 상관없이) ──
// 플러그인이 완성된 응답 끝에 적고(settleReady), 화면이 표식을 지우고 카드를 붙인다 (host/shopcard.ts renderReadyCard). 모델에는 보내지 않는다 (core/sanitize.ts).

const READY_TAG = /\[\s*shop-ready\s*[:：]\s*([^\]|｜]*?)\s*[|｜]\s*([^\]]*?)\s*\]/giu;
const READY_SEP = ';;';

export const hasReadyTag = (text: unknown): text is string => typeof text === 'string' && /\[\s*shop-ready\s*[:：]/iu.test(text);

/** 글 속 마지막 완성 표식 */
export function findReadyTag(text: string): { raw: string; site: string; names: string[] } | null {
  if (!hasReadyTag(text)) return null;
  let out: { raw: string; site: string; names: string[] } | null = null;
  for (const m of text.matchAll(READY_TAG)) {
    const names = m[2].split(READY_SEP).map((n) => n.trim()).filter(Boolean);
    if (m[1] && names.length) out = { raw: m[0], site: m[1], names };
  }
  return out;
}

/** 완성 표식을 지운 글 (표식만 있던 줄은 줄째) */
export function stripReadyTags(text: string): string {
  if (!hasReadyTag(text)) return text;
  return text.replace(new RegExp(`^[ \\t]*${READY_TAG.source}[ \\t]*\\r?\\n?`, 'gimu'), '').replace(READY_TAG, '').replace(/\n{3,}/g, '\n\n').trimEnd();
}

const tagName = (s: string) => s.replace(/[\[\]|｜\r\n]/g, ' ').replace(/;;+/g, ';').replace(/\s+/g, ' ').trim();
export const readyTag = (site: string, orders: CosOrder[]): string => `[shop-ready: ${site}|${orders.map((o) => tagName(o.item.name)).filter(Boolean).join(READY_SEP)}]`;

/**
 * 완성 알림을 붙일 자리: 아직 안 받은 주문마다, 주문 뒤 **처음으로 받을 수 있게 된 응답** 번호 → 그 주문들.
 * 저장하지 않고 채팅에서 매번 다시 센다 (응답을 지우거나 다시 굴리면 저절로 맞는다). 받으면 빠진다.
 */
export function readyNotes(chat: Chat): Map<number, CosOrder[]> {
  const out = new Map<number, CosOrder[]>();
  const list = chat.message ?? [];
  const keys = list.map((m, i) => messageKey(m, i));
  const pending = liveOrders(chat.scriptstate, new Set(keys)).filter((o) => !o.taken);
  if (!pending.length) return out;
  // 응답마다: 그 응답까지의 작중 시각
  let now: number | null = null;
  const rows = list.map((m, i) => {
    if (m.role !== 'char' || typeof m.data !== 'string') return null;
    const tags = findStatusTags(m.data);
    const t = tags[tags.length - 1];
    if (t) now = statusMinute(t.date, t.time) ?? now;
    return { i, key: keys[i], now };
  });
  for (const o of pending) {
    const from = Math.max(keys.indexOf(o.anchor), keys.indexOf(o.orderedKey));
    const hit = rows.find((r) => r && r.i > from && orderReady(o, r.now, r.key));
    if (!hit) continue;
    const cur = out.get(hit.i);
    if (cur) cur.push(o);
    else out.set(hit.i, [o]);
  }
  return out;
}

/**
 * 응답마다 완성 표식을 지금 상태에 맞춘다: 붙일 자리(readyNotes)에는 응답 끝에 적고, 아닌 곳의 표식은 지운다.
 * on 이 false(설정 「사용 안 함」)면 전부 지운다. 바뀐 것이 없으면 null.
 */
export function settleReady(chat: Chat, on: boolean, site = 'cos'): Chat['message'] | null {
  const list = chat.message ?? [];
  const notes = on ? readyNotes(chat) : new Map<number, CosOrder[]>();
  let message: Chat['message'] | null = null;
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if (m.role !== 'char' || typeof m.data !== 'string') continue;
    const want = notes.get(i);
    const tag = want ? readyTag(site, want) : '';
    if (!tag && !hasReadyTag(m.data)) continue;
    const body = stripReadyTags(m.data);
    const next = tag ? `${body}\n${tag}` : body;
    if (next === m.data) continue;
    message ??= [...list];
    message[i] = { ...m, data: next };
  }
  return message;
}
