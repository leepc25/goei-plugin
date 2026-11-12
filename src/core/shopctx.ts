// 상점 「컨텍스트 포함」 (2026-11-12 사용자: 「각 기능들 컨텍 포함 선택이 어디있지? 상점 관련된거 없는거 같은데」).
// 방향: 상점 → 메인 요청. (「맥락 반영」「챗로그 포함」「참조 로어북」은 반대 방향: 본문 → 상점 모델. 여기서 다루지 않는다)
// 상점에서 한 일(산 것·판 것·주인/운영자와 나눈 말·맞춤 주문·1:1 상담)은 전에는 설정 없이 늘 다음 턴 메인 요청에 붙었다.
// 이제 가게마다 전체 켬/끔(「컨텍스트 포함」) + 붙일 것(종류)마다 켬/끔으로 거른다. 기본값은 전부 켬(전과 같은 동작).
// 가게마다 생기는 것이 달라서(사용자: 「이게 메뉴마다 다른데」) 종류는 가게마다 따로 둔다 — 없는 종류는 그 가게에 칸이 없다.
// 망상홈쇼핑은 여기 없다(그쪽 설정이 따로 다룬다). 줄을 더하려면 SHOP_MAIN_KINDS 에 가게와 종류를 더하면 된다.

export type ShopPlace = 'shop' | 'cos' | 'bm';
export const SHOP_PLACES: ShopPlace[] = ['shop', 'cos', 'bm'];
export const isShopPlace = (v: unknown): v is ShopPlace => v === 'shop' || v === 'cos' || v === 'bm';

/** 붙일 것: 구매 · 팔기 · 문의(주인·운영자와 나눈 말, 거래 끊김) · 맞춤 주문(선납·완성) · 1:1 상담 */
export type ShopMainKind = 'buy' | 'sell' | 'ask' | 'order' | 'desk';
export const SHOP_MAIN_ALL: ShopMainKind[] = ['buy', 'sell', 'ask', 'order', 'desk'];
/** 화면 이름 (그 화면들에 이미 있는 말) */
export const SHOP_MAIN_LABEL: Record<ShopMainKind, string> = { buy: '구매', sell: '팔기', ask: '문의', order: '맞춤 주문', desk: '1:1 상담' };
/** 가게마다 실제로 생기는 것 (core/shop.ts shopEvents · core/malls.ts mallEvents · core/items.ts newlyBought·soldNow) */
export const SHOP_MAIN_KINDS: Record<ShopPlace, ShopMainKind[]> = {
  shop: ['buy', 'sell', 'ask'],
  cos: ['buy', 'ask', 'order'],
  bm: ['buy', 'desk'],
};

/** 변수: 기본 상점 `$sh_main`·`$sh_main_buy` …, 쇼핑몰 `$cos_sh_main`·`$bm_sh_main_desk` … (쇼핑몰 설정 이름 규칙 mallKey 와 같은 꼴) */
const pre = (p: ShopPlace) => (p === 'shop' ? '$sh_main' : `$${p}_sh_main`);
export const shopMainKey = (p: ShopPlace, k?: ShopMainKind): string => (k ? `${pre(p)}_${k}` : pre(p));
/** 최대 양: 「문의」「1:1 상담」으로 붙이는 대화 줄 수. 세 곳이 값 하나를 같이 쓴다. 0 = 제한 없음 (2026-11-07 사용자: 「6줄이 아니라 전부」가 기본) */
export const SHOP_MAIN_LINES_VAR = '$sh_main_lines';
export const SHOP_MAIN_LINES = { def: 0, min: 0, max: 200 } as const;

type Vars = Record<string, unknown> | undefined;

export interface ShopMain {
  /** 「컨텍스트 포함」: 이 가게에서 한 일을 메인 요청에 붙이나 */
  on: boolean;
  /** 종류마다 켜 둔 값 (가게에 없는 종류는 false). on 이 꺼져 있어도 저장된 값 그대로 */
  kinds: Record<ShopMainKind, boolean>;
  /** 실제로 붙나: on 이고 그 가게에 있는 종류이고 켜져 있을 때 */
  has(k: ShopMainKind): boolean;
}

export function shopMain(vars: Vars, p: ShopPlace): ShopMain {
  const on = vars?.[shopMainKey(p)] !== '0';
  const kinds = Object.fromEntries(SHOP_MAIN_ALL.map((k) => [k, SHOP_MAIN_KINDS[p].includes(k) && vars?.[shopMainKey(p, k)] !== '0'])) as Record<ShopMainKind, boolean>;
  return { on, kinds, has: (k) => on && kinds[k] };
}

export function shopMainLines(vars: Vars): number {
  const raw = vars?.[SHOP_MAIN_LINES_VAR];
  const n = Number(raw);
  return raw === undefined || raw === '' || !Number.isFinite(n) ? SHOP_MAIN_LINES.def : Math.max(SHOP_MAIN_LINES.min, Math.min(SHOP_MAIN_LINES.max, Math.round(n)));
}
/** 대화 줄을 최대 양에 맞춘다: 넘으면 최근 줄만. 0 이면 전부 */
export const capLines = <T>(lines: T[], max: number): T[] => (max > 0 && lines.length > max ? lines.slice(-max) : lines);

/** 물건에 적어 두는 산 곳 (core/items.ts Item.store): 가게 이름 그대로, 우주 쇼핑몰 맞춤 주문을 받은 것은 'cos-order' */
export type ItemStore = ShopPlace | 'cos-order';
/** 새로 산 물건을 메인 요청에 「방금 삼」으로 붙이나. 산 곳이 안 적힌 것(망상홈쇼핑 등)은 거르지 않는다 */
export function boughtPasses(vars: Vars, store: unknown): boolean {
  if (store === 'cos-order') return shopMain(vars, 'cos').has('order');
  return isShopPlace(store) ? shopMain(vars, store).has('buy') : true;
}
