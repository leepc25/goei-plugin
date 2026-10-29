// 필드 가게·필드 가방 (docs/게임_성장_경제_설계.md 4·5장). 엔진·화면을 모른다 (node 시험 가능).
// 돈은 본편 가계부(원, bridge.wallet)로 낸다. 가방·가게 재고는 채팅별 상태 하나(FieldState, 채팅 변수 $fd_state)에 둔다.
// 수치는 기본값 (설계 D7): 가게 배율·매입률·재고 회복 주기는 설정으로 뺄 자리.

export type FieldItemKind = 'food' | 'drink' | 'med' | 'gift' | 'misc';

export interface FieldItemDef {
  id: string;
  name: string;
  kind: FieldItemKind;
  /** 기준가 (원) */
  price: number;
  desc: string;
  /** 쓰면: 최대 체력 비율 회복 */
  heal?: number;
  /** 이야기용 한 줄 (장부 사건): 「삼각김밥을 먹었다」 */
  verb?: string;
  /** 출동 소모품 칸으로 가져갈 수 있는 아이템 id (items/data.ts) */
  run?: string;
}

export const FIELD_ITEMS: Record<string, FieldItemDef> = {
  onigiri: { id: 'onigiri', name: '삼각김밥', kind: 'food', price: 1200, desc: '체력 5% 회복', heal: 0.05, verb: '먹었다' },
  sandwich: { id: 'sandwich', name: '샌드위치', kind: 'food', price: 3500, desc: '체력 10% 회복', heal: 0.1, verb: '먹었다' },
  lunchbox: { id: 'lunchbox', name: '편의점 도시락', kind: 'food', price: 5500, desc: '체력 15% 회복', heal: 0.15, verb: '먹었다' },
  tteokbokki: { id: 'tteokbokki', name: '떡볶이', kind: 'food', price: 4000, desc: '체력 12% 회복', heal: 0.12, verb: '먹었다' },
  coffee: { id: 'coffee', name: '편의점 커피', kind: 'drink', price: 1500, desc: '체력 3% 회복', heal: 0.03, verb: '마셨다' },
  energy: { id: 'energy', name: '에너지 음료', kind: 'drink', price: 2500, desc: '체력 3% 회복. 출동에 가져가면 능력 자원 회복', heal: 0.03, verb: '마셨다', run: 'energy' },
  soju: { id: 'soju', name: '소주', kind: 'drink', price: 2000, desc: '한 병', verb: '마셨다' },
  bandage: { id: 'bandage', name: '붕대', kind: 'med', price: 3000, desc: '체력 10% 회복. 출동에 가져가면 출혈을 멎게 함', heal: 0.1, verb: '감았다', run: 'bandage' },
  firstaid: { id: 'firstaid', name: '구급상자', kind: 'med', price: 12000, desc: '체력 25% 회복', heal: 0.25, verb: '썼다' },
  painkiller: { id: 'painkiller', name: '진통제', kind: 'med', price: 4000, desc: '출동에 가져가면 두통을 멎게 함', verb: '먹었다', run: 'painkiller' },
  snack: { id: 'snack', name: '과자', kind: 'gift', price: 1800, desc: '선물하기 좋다', verb: '먹었다', heal: 0.02 },
  flowers: { id: 'flowers', name: '꽃다발', kind: 'gift', price: 25000, desc: '선물하기 좋다' },
  cigarettes: { id: 'cigarettes', name: '담배', kind: 'gift', price: 4500, desc: '한 갑' },
  umbrella: { id: 'umbrella', name: '우산', kind: 'misc', price: 7000, desc: '비 오는 날에' },
};

export interface ShopDef {
  id: string;
  name: string;
  /** 가게 주인 원형 (근무형 몹, src/game/world/hq.ts posts) */
  keeper: string;
  /** 영업 시간 [열기, 닫기] (시). 닫기 < 열기면 밤을 넘김 */
  hours: [number, number];
  /** 파는 값 배율 */
  mult: number;
  /** 사들이는 값 = 기준가 × 매입률 */
  buyRate: number;
  /** 사들이는 종류 (없으면 안 삼) */
  buys?: FieldItemKind[];
  /** 진열: 아이템 → 최대 재고 */
  stock: Record<string, number>;
  /** 재고가 다 차는 데 걸리는 필드 시간(분) */
  restock: number;
  /** 흥정 가능 (시장) */
  haggle?: boolean;
  /** 저녁 떨이: 이 시 이후 food 값 배율 */
  lateSale?: { from: number; mult: number };
  greet: string;
}

export const SHOPS: Record<string, ShopDef> = {
  cvs: {
    id: 'cvs', name: '편의점', keeper: '편의점 점원', hours: [0, 24], mult: 1, buyRate: 0, restock: 360,
    stock: { onigiri: 8, sandwich: 5, lunchbox: 4, coffee: 10, energy: 6, soju: 6, bandage: 4, painkiller: 4, snack: 8, cigarettes: 6, umbrella: 3 },
    greet: '어서 오세요.',
  },
  market: {
    id: 'market', name: '시장 노점', keeper: '상인', hours: [6, 19], mult: 0.85, buyRate: 0.4, buys: ['food', 'gift', 'misc'], restock: 1440, haggle: true,
    lateSale: { from: 17, mult: 0.7 },
    stock: { tteokbokki: 6, onigiri: 6, snack: 10, flowers: 3, umbrella: 4, firstaid: 2 },
    greet: '골라 봐요, 싸게 줄게.',
  },
};

/** 채팅별 필드 상태 (가방·가게 재고·흥정 기록) */
export interface FieldState {
  bag: Record<string, number>;
  /** 이름 인물에게 마지막으로 선물한 필드 날짜 (하루 한 번만 호감에 셈) */
  gifts?: Record<string, number>;
  shops: Record<string, { stock: Record<string, number>; at: number | null; haggleFail?: number; haggleDay?: number }>;
}
export const BAG_SLOTS = 8;
export const emptyState = (): FieldState => ({ bag: {}, shops: {} });

export function parseState(text: string | null | undefined): FieldState {
  if (!text) return emptyState();
  try {
    const o = JSON.parse(text) as Partial<FieldState>;
    const bag: Record<string, number> = {};
    for (const [k, v] of Object.entries(o.bag ?? {})) if (FIELD_ITEMS[k] && Number.isInteger(v) && v > 0) bag[k] = Math.min(99, v);
    const shops: FieldState['shops'] = {};
    for (const [k, v] of Object.entries(o.shops ?? {})) if (SHOPS[k] && v && typeof v === 'object') shops[k] = { stock: { ...(v.stock ?? {}) }, at: typeof v.at === 'number' ? v.at : null, haggleFail: v.haggleFail, haggleDay: v.haggleDay };
    const gifts: Record<string, number> = {};
    for (const [k, v] of Object.entries(o.gifts ?? {})) if (typeof v === 'number') gifts[k] = v;
    return { bag, shops, ...(Object.keys(gifts).length ? { gifts } : {}) };
  } catch {
    return emptyState();
  }
}

export const bagUsed = (s: FieldState) => Object.keys(s.bag).length;
/** 가방에 넣을 수 있나 (같은 물건은 한 칸에 겹침) */
export const canAdd = (s: FieldState, id: string) => !!s.bag[id] || bagUsed(s) < BAG_SLOTS;
export function addBag(s: FieldState, id: string, n = 1): boolean {
  if (!FIELD_ITEMS[id] || n <= 0 || !canAdd(s, id)) return false;
  s.bag[id] = Math.min(99, (s.bag[id] ?? 0) + n);
  return true;
}
export function takeBag(s: FieldState, id: string, n = 1): boolean {
  if ((s.bag[id] ?? 0) < n) return false;
  s.bag[id] -= n;
  if (s.bag[id] <= 0) delete s.bag[id];
  return true;
}

/** 선물이 되는 물건 */
export const giftable = (it: FieldItemDef) => it.kind === 'gift' || it.kind === 'food' || it.kind === 'drink';
/** 선물: 가방에서 빼고, 오늘 이 사람에게 처음이면 true (호감 계기로 넘길지) */
export function give(s: FieldState, id: string, who: string, day: number): { ok: boolean; counts: boolean } {
  if (!FIELD_ITEMS[id] || !giftable(FIELD_ITEMS[id]) || !takeBag(s, id)) return { ok: false, counts: false };
  const g = s.gifts ?? (s.gifts = {});
  const counts = g[who] !== day;
  g[who] = day;
  return { ok: true, counts };
}

export const isOpen = (shop: ShopDef, hour: number | null) => {
  if (hour === null) return true;
  const [a, b] = shop.hours;
  const h = ((hour % 24) + 24) % 24;
  return a <= b ? h >= a && h < b : h >= a || h < b;
};

/** 가게 재고: 시간이 흐른 만큼 다시 찬다 (필드 분 기준, 시계를 모르면 그대로) */
export function stockOf(s: FieldState, shop: ShopDef, minute: number | null): Record<string, number> {
  const cur = s.shops[shop.id] ?? (s.shops[shop.id] = { stock: { ...shop.stock }, at: minute });
  if (minute !== null && cur.at !== null && minute > cur.at) {
    const frac = Math.min(1, (minute - cur.at) / shop.restock);
    for (const [id, max] of Object.entries(shop.stock)) {
      const have = cur.stock[id] ?? 0;
      cur.stock[id] = frac >= 1 ? max : Math.min(max, have + Math.floor((max - have) * frac));
    }
    cur.at = minute;
  } else if (cur.at === null) cur.at = minute;
  for (const id of Object.keys(shop.stock)) if (cur.stock[id] === undefined) cur.stock[id] = shop.stock[id];
  return cur.stock;
}

export interface PriceCtx {
  hour: number | null;
  /** 그 가게 쪽 세력 평판 구간 (없으면 중립) */
  rep?: 'friendly' | 'warm' | 'neutral' | 'wary' | 'hostile' | null;
}
const REP_MULT = { friendly: 0.85, warm: 0.95, neutral: 1, wary: 1.2, hostile: Infinity } as const;

/** 파는 값 (가게 → 플레이어). 거래 거부면 null */
export function priceOf(item: FieldItemDef, shop: ShopDef, c: PriceCtx): number | null {
  const rep = REP_MULT[c.rep ?? 'neutral'];
  if (!Number.isFinite(rep)) return null;
  const late = shop.lateSale && c.hour !== null && c.hour >= shop.lateSale.from && item.kind === 'food' ? shop.lateSale.mult : 1;
  return Math.max(100, Math.round((item.price * shop.mult * rep * late) / 100) * 100);
}
/** 사들이는 값 (플레이어 → 가게). 안 사면 null */
export function sellPriceOf(item: FieldItemDef, shop: ShopDef, c: PriceCtx): number | null {
  if (!shop.buyRate || !shop.buys?.includes(item.kind)) return null;
  const rep = REP_MULT[c.rep ?? 'neutral'];
  if (!Number.isFinite(rep)) return null;
  return Math.max(100, Math.round((item.price * shop.buyRate) / rep / 100) * 100);
}

/** 흥정: 성공하면 할인율(0.05~0.2), 실패면 0. 하루 두 번 실패하면 그날은 안 깎아 줌. rng 0~1 */
export function haggle(s: FieldState, shop: ShopDef, day: number, rng: () => number, social = 0.5): number {
  if (!shop.haggle) return 0;
  const st = s.shops[shop.id] ?? (s.shops[shop.id] = { stock: { ...shop.stock }, at: null });
  if (st.haggleDay !== day) (st.haggleDay = day), (st.haggleFail = 0);
  if ((st.haggleFail ?? 0) >= 2) return 0;
  if (rng() < 0.35 + social * 0.4) return Math.round((0.05 + rng() * 0.15) * 100) / 100;
  st.haggleFail = (st.haggleFail ?? 0) + 1;
  return 0;
}
