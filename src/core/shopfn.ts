// 상점 셋(기본 상점·우주 쇼핑몰·백일몽 포인트몰)의 「넘길 내용」과 양 (2026-11-12 사용자: 가게 표·기능 표·양 표).
//  - 가게 표: 줄 = 가게, 칸 = 넘길 내용 여섯 칩(core/reffn.ts REF_CHIP_KEYS) + 맥락 반영. 가게마다 제 값 ($sh_* · $cos_sh_* · $bm_sh_*).
//  - 기능 표: 줄 = 진열·문의·1:1 상담, 같은 일곱 칸. 세 가게가 한 값을 같이 쓴다 ($sh_fn_*). 가게 표와 기능 표 둘 다 켜진 것만 넘긴다.
//  - 양 표: 줄 = 기능, 칸 = 챗로그(턴)·참조 로어북(개). 따로 정하지 않은 기능은 $sh_turns·$sh_refs 를 그대로 쓴다.
// 망상홈쇼핑도 같은 표를 쓴다 (2026-11-13): 가게 표에 제 줄($hs_sh_give_* · $hs_sh_ctx), 기능 표에서 편성은 「진열」 줄, 보낸 채팅의 반응은 「채팅 반응」 줄.
import type { RefToggles } from './advanced';
import { mallKey, mallSettings, type MallSite } from './malls';
import { REF_CHIP_KEYS, type RefChip } from './reffn';
import { referenceEntries, type Registry } from './world/registry';
import { SHOP_CTX_VAR, shopSettings } from './shop';

type Vars = Record<string, unknown> | undefined;

export type GiveShop = 'shop' | MallSite | 'hs';
export const GIVE_SHOPS: GiveShop[] = ['shop', 'cos', 'bm', 'hs'];
export const isGiveShop = (v: string): v is GiveShop => (GIVE_SHOPS as string[]).includes(v);

/** 기능 (요청 종류). label 은 화면 줄 이름 */
export type ShopFn = 'shelf' | 'talk' | 'desk' | 'say';
export const SHOP_FNS: { key: ShopFn; label: string }[] = [
  { key: 'shelf', label: '진열' },
  { key: 'talk', label: '문의' },
  { key: 'desk', label: '1:1 상담' },
  /** 망상홈쇼핑에서 내가 보낸 채팅에 진행자·시청자가 답하는 요청 (ui/homeshop.ts say) */
  { key: 'say', label: '채팅 반응' },
];
export const isShopFn = (v: string): v is ShopFn => SHOP_FNS.some((f) => f.key === v);

/** 표의 칸: 넘길 내용 여섯 칩 + 맥락 반영 */
export const SHOP_GIVE_KEYS = [...REF_CHIP_KEYS, 'ctx'] as const;
export type GiveKey = (typeof SHOP_GIVE_KEYS)[number];
export const isGiveKey = (v: string): v is GiveKey => (SHOP_GIVE_KEYS as readonly string[]).includes(v);

/** 가게 표 기본값 = 표가 생기기 전의 고정 값 (봇 설명·상시 로어북·관련 로어북만) */
const SHOP_DEF: Record<RefChip, boolean> = { desc: true, authors: false, persona: false, active: true, related: true, secondary: false };
/** 기능 표 기본값 (core/reffn.ts 기능 표와 같다) */
const FN_DEF: Record<RefChip, boolean> = { desc: true, authors: true, persona: true, active: true, related: true, secondary: false };

/** 가게 표 한 칸의 변수 */
export function shopGiveVar(shop: GiveShop, key: GiveKey): string {
  const sh = key === 'ctx' ? SHOP_CTX_VAR : `$sh_give_${key}`;
  return shop === 'shop' ? sh : shop === 'hs' ? `$hs_${sh.slice(1)}` : mallKey(sh, shop);
}
/** 가게 표 한 칸이 켜져 있나. 쇼핑몰의 맥락 반영은 따로 정한 적이 없으면 기본 상점 값 (core/malls.ts mallVars) */
export function shopGiveOn(vars: Vars, shop: GiveShop, key: GiveKey): boolean {
  if (key === 'ctx') {
    if (shop === 'hs') { const h = vars?.[shopGiveVar('hs', 'ctx')]; return h === '1' || h === '0' ? h === '1' : shopSettings(vars).context; }
    return shop === 'shop' ? shopSettings(vars).context : mallSettings(vars, shop).context;
  }
  const v = vars?.[shopGiveVar(shop, key)];
  return v === '1' || v === '0' ? v === '1' : SHOP_DEF[key];
}

/** 양 표의 칸 */
export const SHOP_AMOUNTS = {
  turns: { label: '챗로그', min: 1, max: 8, unit: '턴' },
  refs: { label: '참조 로어북', min: 0, max: 12, unit: '개' },
} as const;
export type ShopAmount = keyof typeof SHOP_AMOUNTS;
export const isShopAmount = (v: string): v is ShopAmount => v === 'turns' || v === 'refs';

/** 기능 표·양 표 한 칸의 변수 (세 가게가 같이 쓴다) */
export const shopFnVar = (fn: ShopFn, key: GiveKey | ShopAmount): string => `$sh_fn_${fn}_${key}`;
/** 그 기능에 없는 칸 (「–」): 1:1 상담은 맥락(신분·상태창·괴이·챗로그)을 요청문에 넣는 자리가 없다 */
export const shopFnNone = (fn: ShopFn, key: GiveKey): boolean => fn === 'desk' && key === 'ctx';
/** 기능 표 한 칸이 켜져 있나 */
export function shopFnOn(vars: Vars, fn: ShopFn, key: GiveKey): boolean {
  if (shopFnNone(fn, key)) return false;
  const v = vars?.[shopFnVar(fn, key)];
  return v === '1' || v === '0' ? v === '1' : key === 'ctx' ? true : FN_DEF[key];
}
/** 이 기능의 양. 따로 정하지 않았으면 $sh_turns · $sh_refs */
export function shopFnNum(vars: Vars, fn: ShopFn, key: ShopAmount): number {
  const raw = vars?.[shopFnVar(fn, key)];
  const n = Number(raw);
  const a = SHOP_AMOUNTS[key];
  if (raw !== undefined && raw !== null && String(raw).trim() !== '' && Number.isInteger(n) && n >= a.min && n <= a.max) return n;
  return shopSettings(vars)[key];
}

const TOGGLE: Record<RefChip, keyof RefToggles> = { desc: 'description', authors: 'authors', persona: 'persona', active: 'active', related: 'related', secondary: 'secondary' };

/** 한 요청에 넘길 것 */
export interface ShopGive {
  toggles: RefToggles;
  /** 맥락 반영 (신분·상태창·진행 중 괴이·최근 챗로그) */
  context: boolean;
  turns: number;
  refs: number;
}
/** 이 가게의 이 기능 요청에 넘길 것: 가게 표와 기능 표가 둘 다 켜진 것만. vars = 채팅의 변수 그대로 (mallVars 를 거치지 않은 것) */
export function shopGive(vars: Vars, shop: GiveShop, fn: ShopFn): ShopGive {
  const toggles = {} as RefToggles;
  for (const chip of REF_CHIP_KEYS) toggles[TOGGLE[chip]] = shopGiveOn(vars, shop, chip) && shopFnOn(vars, fn, chip);
  return { toggles, context: shopGiveOn(vars, shop, 'ctx') && shopFnOn(vars, fn, 'ctx'), turns: shopFnNum(vars, fn, 'turns'), refs: shopFnNum(vars, fn, 'refs') };
}

/** 글(가게 이름·주인 이름)에 이름이 걸린 로어북 이름들 (소문자). 「참조 로어북」 수를 넘을 때 끝까지 남길 것 */
export function matchedBooks(registry: Registry, text: string): Set<string> {
  const out = new Set<string>();
  for (const e of referenceEntries(registry, text)) if (e.lore) out.add(e.lore.trim().toLowerCase());
  return out;
}
