// 인터넷 쇼핑몰 (2026-11-08 사용자): 우주 쇼핑몰(cos)·백일몽 포인트몰(bm).
// 진열·문의는 상점(core/shop.ts)의 요청문·해석을 그대로 쓰고, 지침만 사이트마다 따로(Cos·Bm), 설정 값도 사이트마다 따로($cos_sh_*, $bm_sh_*).
// 상점과 달리 본편 표식 없이 브라우저에서 언제든 연다. 우주몰은 운영자 문의 창이 있고, 포인트몰은 운영자가 없다(정가 구매만, 로그인해야 씀).
import type { Chat } from './types';
import { emptyShop, readShop, SHOP_VAR, shopBlocked, shopSettings, type ShopSettings, type ShopState } from './shop';
import type { GuideName } from './guides';

export type MallSite = 'cos' | 'bm';
export const MALL_SITES: MallSite[] = ['cos', 'bm'];
export const isMallSite = (v: unknown): v is MallSite => v === 'cos' || v === 'bm';
export const MALL_NAME: Record<MallSite, string> = { cos: '우주 쇼핑몰', bm: '백일몽 포인트몰' };
/** 진열·문의에서 「주인」 자리 (포인트몰은 운영자 없음) */
export const MALL_OWNER: Record<MallSite, string> = { cos: '운영자', bm: '' };
export const MALL_GUIDE: Record<MallSite, GuideName> = { cos: 'Cos', bm: 'Bm' };
/** 사이트 상태 (진열대·문의 대화). 상점 상태와 같은 꼴 */
export const MALL_VAR: Record<MallSite, string> = { cos: '$cos_shop', bm: '$bm_shop' };

/** 쇼핑몰 설정 변수: 상점 설정 이름($sh_*)을 사이트 이름($cos_sh_*)으로 */
export const mallKey = (shKey: string, site: MallSite): string => `$${site}_${shKey.slice(1)}`;
/** 자동 호출: 수동 · 창을 열 때(기본) · 매 턴 */
export type MallAuto = 'manual' | 'open' | 'turn';
export const mallAutoKey = (site: MallSite) => `$${site}_sh_auto`;

type Vars = Record<string, unknown> | undefined;

/** 상점 설정 함수에 넘길 변수: 그 사이트 값($cos_sh_*)을 상점 이름($sh_*)으로 비춘다. 사이트에 없는 값은 상점 값을 쓰지 않고 기본값 */
export function mallVars(vars: Vars, site: MallSite): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(vars ?? {})) if (!k.startsWith('$sh_')) out[k] = v;
  const pre = `$${site}_sh_`;
  for (const [k, v] of Object.entries(vars ?? {})) if (k.startsWith(pre)) out[`$sh_${k.slice(pre.length)}`] = v;
  return out;
}

export interface MallSettings extends ShopSettings {
  auto: MallAuto;
}

/** 쇼핑몰 설정. on: 소지품·가계부가 켜져 있을 때만 (포인트몰은 포인트 기능도) */
export function mallSettings(vars: Vars, site: MallSite): MallSettings {
  const s = shopSettings(mallVars(vars, site));
  const a = String(vars?.[mallAutoKey(site)] ?? '');
  return { ...s, on: shopBlocked(vars) === '', kick: false, auto: a === 'manual' || a === 'turn' ? a : 'open' };
}

/** 저장된 쇼핑몰 상태 (없으면 빈 상태) */
export function readMall(vars: Vars, site: MallSite): ShopState {
  const st = readShop({ [SHOP_VAR]: vars?.[MALL_VAR[site]] });
  const base = st ?? emptyShop({ raw: '', shop: MALL_NAME[site], owner: MALL_OWNER[site] }, '');
  // 포인트몰은 늘 포인트 (모델이 정체를 어떻게 적든)
  return site === 'bm' ? { ...base, identity: { ...base.identity, points: true } } : { ...base, identity: { ...base.identity, points: false } };
}
export const mallVarsOf = (site: MallSite, st: ShopState): Record<string, string> => ({ [MALL_VAR[site]]: JSON.stringify(st) });
/** 진열대와 함께 온 운영자 한마디·몰 공지 (문의 대화와 따로, 첫 화면에 보인다) */
export const mallNoteKey = (site: MallSite) => `${MALL_VAR[site]}_note`;
export const mallNote = (vars: Vars, site: MallSite): string => String(vars?.[mallNoteKey(site)] ?? '');

/** 이번 턴에 쇼핑몰을 새로 짤지 (자동 호출 「매 턴」) */
export const mallTurnRefresh = (chat: Chat, site: MallSite): boolean => mallSettings(chat.scriptstate, site).on && mallSettings(chat.scriptstate, site).auto === 'turn' && readMall(chat.scriptstate, site).loaded;

/** 우주몰 입금 계좌 (사이트 글) */
export const COS_ACCOUNT = '농협 352-1849-2706-13 (예금주 : 어서오세요)';
