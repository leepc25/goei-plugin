// 우주 쇼핑몰 맞춤 주문 (11-09 사용자): 상담 창에서 운영자가 견적(이름·값·납기)을 내면 선납하고 주문한다.
// 완성품은 진열대가 아니라 왼쪽 「주문 조회」에서 받는다. 납기는 상태창 [▣] 의 작중 시각으로 판정한다 — 모델 호출 없이, 매 턴 시각만 비교.
// 완성품(설명·효과·숨긴 진실)은 견적 때 모델이 이미 정해 두고 받을 때까지 숨긴다 (사용자 13:35: 납기 때 모델을 다시 굴리지 않는다).
import type { Chat } from './types';
import { findStatusTags, statusMinute } from './world/status';
import type { ShopItem } from './shop';

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
  /** 받은 뒤 */
  taken?: boolean;
}

export function readOrders(vars: Vars): CosOrder[] {
  const raw = String(vars?.[COS_ORDERS_KEY] ?? '');
  if (!raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((o): o is CosOrder => !!o && typeof o === 'object' && typeof (o as CosOrder).id === 'string' && !!(o as CosOrder).item && typeof (o as CosOrder).item.name === 'string').slice(-COS_ORDERS_MAX);
  } catch {
    return [];
  }
}
export const ordersVars = (list: CosOrder[]): Record<string, string> => ({ [COS_ORDERS_KEY]: list.length ? JSON.stringify(list.slice(-COS_ORDERS_MAX)) : '' });

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
