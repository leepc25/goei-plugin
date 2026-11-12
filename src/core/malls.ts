// 인터넷 쇼핑몰 (2026-11-08 사용자): 우주 쇼핑몰(cos)·백일몽 포인트몰(bm).
// 진열·문의는 상점(core/shop.ts)의 요청문·해석을 그대로 쓰고, 지침만 사이트마다 따로(Cos·Bm), 설정 값도 사이트마다 따로($cos_sh_*, $bm_sh_*).
// 상점과 달리 본편 표식 없이 브라우저에서 언제든 연다. 우주몰은 운영자 문의 창이 있고, 포인트몰은 운영자가 없다(정가 구매만, 로그인해야 씀).
import type { Chat } from './types';
import { type TruthMode, emptyShop, readShop, reviveShop, SHOP_VAR, shopBlocked, shopSettings, type ShopSettings, type ShopState } from './shop';
import type { GuideName } from './guides';
import { lastBot, SHOP_SHARED_VARS } from './shop';
import { liveOrders, readyNotes } from './orders';
import { readDesk } from './bmdesk';
import { aliveAnchors } from './wallet';
import { capLines, shopMain, shopMainLines } from './shopctx';

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

/** 상점 설정 함수에 넘길 변수: 그 사이트 값($cos_sh_*)을 상점 이름($sh_*)으로 비춘다. 사이트에 없는 값은 상점 값을 쓰지 않고 기본값.
 *  상점 넷이 같이 쓰는 값(SHOP_SHARED_VARS)은 기본 상점 자리의 값 그대로 */
export function mallVars(vars: Vars, site: MallSite): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(vars ?? {})) if (!k.startsWith('$sh_') || SHOP_SHARED_VARS.includes(k)) out[k] = v;
  const pre = `$${site}_sh_`;
  for (const [k, v] of Object.entries(vars ?? {})) if (k.startsWith(pre) && !SHOP_SHARED_VARS.includes(`$sh_${k.slice(pre.length)}`)) out[`$sh_${k.slice(pre.length)}`] = v;
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
export function readMall(vars: Vars, site: MallSite, alive?: Set<string>): ShopState {
  const st0 = readShop({ [SHOP_VAR]: vars?.[MALL_VAR[site]] });
  const st = st0 && alive ? reviveShop(st0, alive) : st0;
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

// ── 우주몰 진열 배정 (구버전 Lua cosBuildRefreshPrompt 방식, 11-09 사용자: 새로고침해도 같은 물건) ──
// 칸마다 장르(겹치지 않게 섞음)×값 등급(₩구간)을 코드가 굴려 요청에 박는다. 같은 입력이 반복돼도 모델이 같은 진열을 내지 못하게.
// 11-09 사용자: 하드코딩 금지 — 사용 여부·장르 목록·값 등급·상황용 칸 수를 전부 설정에서 고친다 ($cos_roll_*). 기본값만 여기.
export const COS_GENRES_DEFAULT = [
  'classical martial arts', 'sci-fi', 'fantasy', 'cyberpunk', 'steampunk',
  'ancient', 'occult', 'cosmic horror', 'creature', 'mythology',
  'religious/sacred', 'post-apocalyptic', 'alien', 'folktale', 'fairy tale',
  'alchemy', 'military', 'fiction', 'SCP', 'Cthulhu mythos',
];
export interface CosTier { name: string; desc: string; lo: number; hi: number; /** 뽑힐 가중치 (기본 1) */ w: number }
/** 값 등급 기본: 이름 · 등급 설명 · 하한 · 상한 (구간 연속). 물건은 등급에 맞춰 만들고 값은 그 가치를 따른다 */
export const COS_TIERS_DEFAULT: CosTier[] = [
  { name: '최저가', desc: 'mundane, trivial — a curiosity or minor utility', lo: 999_999, hi: 2_499_999, w: 1 },
  { name: '저가', desc: 'common — modestly useful, low stakes', lo: 2_500_000, hi: 4_999_999, w: 1 },
  { name: '중가', desc: 'notable, uncommon — genuinely useful or potent', lo: 5_000_000, hi: 9_999_999, w: 1 },
  { name: '고가', desc: 'potent, rare — strong effect, sought-after', lo: 10_000_000, hi: 19_999_999, w: 1 },
  { name: '최고가', desc: 'powerful, coveted — a high-value artifact', lo: 20_000_000, hi: 49_999_999, w: 1 },
];
export type CosUseful = 'auto' | '0' | '1' | '2';
/** 장르 뽑기: uniq = 칸마다 다르게(목록을 섞어 앞에서부터) · any = 칸마다 따로 무작위(겹쳐도 됨) · one = 이번 판은 한 장르로 통일 */
export type CosGenreMode = 'uniq' | 'any' | 'one';
/** 등급 뽑기: weight = 칸마다 가중치대로 무작위 · even = 등급을 칸에 골고루 나눈 뒤 섞음 · same = 이번 판은 한 등급으로 통일(가중치대로 하나 뽑음) */
export type CosTierMode = 'weight' | 'even' | 'same';
export interface CosRoll { on: boolean; genres: string[]; tiers: CosTier[]; useful: CosUseful; gmode: CosGenreMode; tmode: CosTierMode }
export const COS_ROLL_KEY = { on: '$cos_roll_on', genres: '$cos_roll_genres', tiers: '$cos_roll_tiers', useful: '$cos_roll_useful', gmode: '$cos_roll_gmode', tmode: '$cos_roll_tmode' } as const;
/** 몰별 진열 배정 변수 (2026-11-09 사용자 「1번은 해」: 포인트몰에도 같은 진열 배정, 켜고 끄기 따로). bm: $bm_roll_* */
export const rollKeys = (site: MallSite): typeof COS_ROLL_KEY => (site === 'cos' ? COS_ROLL_KEY : ({ on: '$bm_roll_on', genres: '$bm_roll_genres', tiers: '$bm_roll_tiers', useful: '$bm_roll_useful', gmode: '$bm_roll_gmode', tmode: '$bm_roll_tmode' } as unknown as typeof COS_ROLL_KEY));
/** 포인트몰 기본 분류 (복지몰답게 일상 물건부터 현장 장비까지; 설정에서 고친다) */
export const BM_GENRES_DEFAULT = ['생활용품', '가전', '건강·의약품', '식품·음료', '의류·보호구', '현장 탐사 장비', '괴담 대응 소모품', '사무·문구', '취미·여가', '사내 서비스·이용권'];
/** 포인트몰 기본 값 등급 (포인트). 위키: 괴담 등급별 클리어 보상 수백~수천 포인트 → 생활용품 수십 p 부터 최상급 수천 p 까지 */
export const BM_TIERS_DEFAULT: CosTier[] = [
  { name: '저가', desc: 'everyday welfare goods — small, cheap, practical', lo: 30, hi: 149, w: 3 },
  { name: '중저가', desc: 'common supplies and basic field items', lo: 150, hi: 399, w: 3 },
  { name: '중가', desc: 'solid equipment or medicine with a clear use', lo: 400, hi: 999, w: 2 },
  { name: '고가', desc: 'rare company product — strong, regulated, limited', lo: 1000, hi: 2999, w: 1 },
  { name: '최고가', desc: 'top-grade company asset — life-saving or coveted', lo: 3000, hi: 9999, w: 1 },
];
export const rollDefaults = (site: MallSite): { genres: string[]; tiers: CosTier[] } => (site === 'cos' ? { genres: COS_GENRES_DEFAULT, tiers: COS_TIERS_DEFAULT } : { genres: BM_GENRES_DEFAULT, tiers: BM_TIERS_DEFAULT });

/** 값 등급 ↔ 글 (한 줄에 「이름|설명|하한|상한」). 설정 칸에서 그대로 고친다 */
export const tiersText = (t: CosTier[]): string => t.map((x) => `${x.name}|${x.desc}|${x.lo}|${x.hi}|${x.w}`).join('\n');
export function parseTiers(text: string): CosTier[] {
  const out: CosTier[] = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const [name = '', desc = '', lo = '', hi = '', w = ''] = line.split('|').map((x) => x.trim());
    const a = Number(lo.replace(/[^\d]/g, '')); const b = Number(hi.replace(/[^\d]/g, ''));
    if (!name || !Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b < a) continue;
    const wn = Number(w); // 비우면 1, 0 이면 안 뽑힘
    out.push({ name: name.slice(0, 20), desc: desc.slice(0, 120), lo: a, hi: b, w: w === '' || !Number.isFinite(wn) || wn < 0 ? 1 : Math.min(99, wn) });
  }
  return out;
}
export const genresText = (g: string[]): string => g.join(', ');
export const parseGenres = (text: string): string[] => [...new Set(String(text ?? '').split(/[,\n]/).map((x) => x.trim().slice(0, 40)).filter(Boolean))];

/** 진열 배정 설정 (몰별). 변수가 없으면 기본값, 빈 글이면 그 항목은 기본값으로 */
export function mallRoll(vars: Vars, site: MallSite): CosRoll {
  const K = rollKeys(site);
  const D = rollDefaults(site);
  const on = String(vars?.[K.on] ?? '') !== '0';
  const g = parseGenres(String(vars?.[K.genres] ?? ''));
  const t = parseTiers(String(vars?.[K.tiers] ?? ''));
  const u = String(vars?.[K.useful] ?? '');
  const gm = String(vars?.[K.gmode] ?? ''); const tm = String(vars?.[K.tmode] ?? '');
  const tiers = t.length ? t : D.tiers;
  return {
    on, genres: g.length ? g : D.genres, tiers: tiers.some((x) => x.w > 0) ? tiers : tiers.map((x) => ({ ...x, w: 1 })),
    useful: u === '0' || u === '1' || u === '2' ? u : 'auto', gmode: gm === 'any' || gm === 'one' ? gm : 'uniq', tmode: tm === 'even' || tm === 'same' ? tm : 'weight',
  };
}
export const cosRoll = (vars: Vars): CosRoll => mallRoll(vars, 'cos');
/** 변수가 기본값에서 벗어났나 (설정 「기본값으로」 단추 표시용) */
export const rollChanged = (vars: Vars, site: MallSite): boolean => Object.values(rollKeys(site)).some((k) => String(vars?.[k] ?? '') !== '');
export const cosRollChanged = (vars: Vars): boolean => rollChanged(vars, 'cos');
/** 값 구간 표기 (요청문·설정 예): 우주몰 ₩, 포인트몰 p */
export const rollPrice = (site: MallSite, lo: number, hi: number): string => (site === 'bm' ? `${lo.toLocaleString('en-US')}-${hi.toLocaleString('en-US')} p` : `₩${lo.toLocaleString('en-US')}-${hi.toLocaleString('en-US')}`);

/** 한 칸의 배정 */
export interface CosSlot { genre: string; tier: CosTier; useful: boolean }
/** 가중치대로 하나 뽑기 */
const pickTier = (tiers: CosTier[], rnd: () => number): CosTier => {
  const total = tiers.reduce((a, t) => a + t.w, 0);
  let x = rnd() * total;
  for (const t of tiers) { x -= t.w; if (x < 0) return t; }
  return tiers[tiers.length - 1];
};
const shuffle = <T>(xs: T[], rnd: () => number): T[] => { const g = [...xs]; for (let i = g.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [g[i], g[j]] = [g[j], g[i]]; } return g; };

/** 이번 진열 배정 (칸마다 장르·등급·상황용). 설정의 뽑기 방식대로. 끄면 빈 목록 */
export function cosDraw(count: number, context: boolean, roll: CosRoll, rnd: () => number = Math.random): CosSlot[] {
  if (!roll.on) return [];
  const n = Math.max(1, Math.trunc(count));
  // 장르
  let genres: string[];
  if (roll.gmode === 'one') { const g = roll.genres[Math.floor(rnd() * roll.genres.length)]; genres = Array.from({ length: n }, () => g); }
  else if (roll.gmode === 'any') genres = Array.from({ length: n }, () => roll.genres[Math.floor(rnd() * roll.genres.length)]);
  else { const g = shuffle(roll.genres, rnd); genres = Array.from({ length: n }, (_, i) => g[i % g.length]); }
  // 등급
  const live = roll.tiers.filter((t) => t.w > 0);
  let tiers: CosTier[];
  if (roll.tmode === 'same') { const t = pickTier(live, rnd); tiers = Array.from({ length: n }, () => t); }
  else if (roll.tmode === 'even') tiers = shuffle(Array.from({ length: n }, (_, i) => live[i % live.length]), rnd);
  else tiers = Array.from({ length: n }, () => pickTier(live, rnd));
  // 상황용 칸
  const useful = new Set<number>();
  const want = roll.useful === 'auto' ? (context && n >= 3 ? (n >= 6 ? 2 : 1) : 0) : Math.min(n, Number(roll.useful));
  while (useful.size < want) useful.add(Math.floor(rnd() * n));
  return genres.map((genre, i) => ({ genre, tier: tiers[i], useful: useful.has(i) }));
}

/** 이번 진열 배정 글 (요청문에 붙는 꼴). 끄면 빈 글 */
export function cosAssignment(count: number, context: boolean, roll: CosRoll, rnd: () => number = Math.random, site: MallSite = 'cos'): string {
  const slots = cosDraw(count, context, roll, rnd);
  if (!slots.length) return '';
  const want = slots.some((s) => s.useful);
  const G = site === 'bm' ? 'CATEGORY' : 'GENRE'; // 포인트몰은 장르가 아니라 상품 분류
  const lines = slots.map((s, i) => {
    const role = s.useful ? " | ROLE: useful for the protagonist's current situation (a fitting tool, remedy or edge; describe the item only, never the protagonist)" : want ? ' | ROLE: broad stock, unrelated to the current scene' : '';
    return `Item ${i + 1} — ${G}: ${s.genre} | VALUE TIER: ${s.tier.name} (${s.tier.desc}), price ${rollPrice(site, s.tier.lo, s.tier.hi)}${role}`;
  });
  return `${lines.join('\n')}\nBuild each item to its assigned ${G} and VALUE TIER: its worth, power and rarity match the tier, and its price follows from that worth inside the tier's range. ${G === 'GENRE' ? 'Genres' : 'Categories'} differ by design — do not re-pick. Every listing is new: nothing from previous shelves, from the reference material, or from earlier pages.`;
}

// ── 우주몰 시그니처 상품 (구버전 Lua: 「우리가 도움!」·「착한 친구」를 코드가 확률로 끼움, 모델 생성 아님) ──
// 11-09 사용자: 박아 두지 말고 설정에서 직접 넣고 고치게 ($cos_fixed, JSON). 기본값은 구버전 둘. 모델에게는 이름을 알리지 않고, 응답에 같은 이름이 오면 버린다.
export interface CosFixed {
  id: string;
  on: boolean;
  /** 새로고침마다 끼울 확률 % (0~100) */
  pct: number;
  name: string;
  price: number;
  /** 할인 전 값 (값보다 클 때만 ※할인!※) */
  was?: number;
  desc: string;
  /** 보이는 효과 = 광고 문구 */
  effect: string;
  /** 숨긴 진짜 효과 (비우면 본편 모델이 그 자리에서 정함) */
  truth: string;
}
/** 진실 미리 정하기 (11-09 사용자: 섞는 게 낫다 → 기본 mix) */
/** 맞춤 주문 완성 알림 (11-11 사용자): 채팅 카드 + 다음 턴 본편에 한 줄(기본) / 카드만 / 끔 */
export const COS_READY_KEY = '$cos_ready';
export type ReadyMode = 'both' | 'card' | 'off';
export const cosReadyMode = (vars: Vars): ReadyMode => { const v = String(vars?.[COS_READY_KEY] ?? ''); return v === 'card' || v === 'off' ? v : 'both'; };
export const COS_TRUTH_KEY = '$cos_truth';
export const cosTruthMode = (vars: Vars): TruthMode => { const v = String(vars?.[COS_TRUTH_KEY] ?? ''); return v === 'all' || v === 'none' ? v : 'mix'; };
export const COS_FIXED_KEY = '$cos_fixed';
export const COS_FIXED_MAX = 12;
export const COS_FIXED_DEFAULT: CosFixed[] = [
  { id: 'f_wehelp', on: true, pct: 25, name: '우리가 도움!', price: 66_666_666, desc: '???', effect: '???', truth: '' },
  { id: 'f_friend', on: true, pct: 25, name: '착한 친구', price: 44_444, was: 44_444_444, desc: '아주 귀여운 짐승 모양의 인형 열쇠고리이다. 친구를 부르는 종이가 함께 온다. 동봉된 종이의 지시를 그대로 따르라.', effect: '인형을 통해 말하는 존재가 너의 단짝이 된다. 다만 누가 응답할지는 부른 자도 미리 알 수 없다. 주의사항: 검열됨', truth: '' },
];
/** 저장된 목록. 변수가 없으면 기본값, 「[]」이면 없음 */
export function cosFixed(vars: Vars): CosFixed[] {
  const raw = String(vars?.[COS_FIXED_KEY] ?? '');
  if (!raw) return COS_FIXED_DEFAULT;
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return COS_FIXED_DEFAULT;
    return arr.map((o): CosFixed | null => {
      if (!o || typeof o !== 'object') return null;
      const x = o as Record<string, unknown>;
      const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : 0);
      const was = num(x.was);
      return { id: String(x.id ?? '').slice(0, 24) || `f${Math.random().toString(36).slice(2, 8)}`, on: x.on !== false, pct: Math.max(0, Math.min(100, num(x.pct))), name: String(x.name ?? '').slice(0, 40), price: num(x.price), ...(was ? { was } : {}), desc: String(x.desc ?? '').slice(0, 200), effect: String(x.effect ?? '').slice(0, 200), truth: String(x.truth ?? '').slice(0, 200) };
    }).filter((x): x is CosFixed => !!x).slice(0, COS_FIXED_MAX);
  } catch {
    return COS_FIXED_DEFAULT;
  }
}
export const cosFixedVars = (list: CosFixed[]): Record<string, string> => ({ [COS_FIXED_KEY]: JSON.stringify(list) });
export const newCosFixed = (): CosFixed => ({ id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, on: true, pct: 25, name: '', price: 999_999, desc: '', effect: '', truth: '' });
/** 이번 새로고침에 끼울 것 (켜진 것만, 이름 있는 것만, 확률 굴림) */
export const cosFixedRoll = (list: CosFixed[], rnd: () => number = Math.random): CosFixed[] => list.filter((x) => x.on && x.name.trim() && x.price > 0 && rnd() * 100 < x.pct);

/** 다음 턴 본편에 넘길 쇼핑몰 일 (core/items.ts 의 This turn; 2026-11-10 사용자: 쇼핑몰에서 한 일이 본편에 하나도 안 넘어갔다 — 일반 상점 shopEvents 와 같게).
 *  마지막 응답 뒤에 한 것만: 우주몰 운영자와 나눈 말, 맞춤 주문 선납, 포인트몰 1:1 상담. 산 것·판 것은 소지품 쪽(newlyBought·soldNow)이 넘긴다 */
export function mallEvents(chat: Chat): string[] {
  const key = lastBot(chat)?.key ?? '';
  if (!key) return [];
  const vars = chat.scriptstate;
  const out: string[] = [];
  // 설정 「메인 요청에 붙이는 것」(core/shopctx.ts): 문의 · 맞춤 주문 · 1:1 상담을 가게마다 따로 거른다. 대화는 「최대 양」 줄까지 (0 = 전부)
  const cosMain = shopMain(vars, 'cos');
  const lines = shopMainLines(vars);
  const cos = readMall(vars, 'cos').talk.filter((l) => l.k === key);
  if (cosMain.has('ask') && cos.some((l) => l.who === 'me')) out.push(`chatted by text with the operator on the ${MALL_NAME.cos} website — ${capLines(cos, lines).map((l) => `${l.who === 'me' ? 'protagonist' : 'operator'}: "${l.text}"`).join(' / ')}`);
  if (cosMain.has('order')) {
    for (const o of liveOrders(vars, aliveAnchors(chat))) {
      if (o.anchor === key && !o.taken) out.push(`placed a custom order with ${MALL_NAME.cos} for 「${o.item.name}」, paid ${o.price.toLocaleString('en-US')} won in advance; it will be ready in about ${o.hours} hours and has not arrived yet`);
    }
    // 맞춤 주문이 바로 앞 응답에서 완성됐으면 한 번만 (그 뒤 턴에는 다시 넘기지 않는다). 「완성 알림」이 「카드 + 메인 요청」일 때만
    if (cosReadyMode(vars) === 'both') {
      const at = lastBot(chat)!.index;
      for (const o of readyNotes(chat).get(at) ?? []) out.push(`the custom order 「${o.item.name}」 from ${MALL_NAME.cos} is now finished and waiting; the protagonist was notified but has not collected it yet (it is collected on the website, not delivered into the scene by itself)`);
    }
  }
  const desk = readDesk(vars);
  if (shopMain(vars, 'bm').has('desk') && desk.anchor === key && desk.talk.some((l) => l.who === 'me')) out.push(`chatted by text with a counselor on the ${MALL_NAME.bm} 1:1 상담 — ${capLines(desk.talk.filter((l) => l.who !== 'sys'), lines).map((l) => `${l.who === 'me' ? 'protagonist' : 'counselor'}: "${l.text}"`).join(' / ')}`);
  return out;
}

/** 판 것(core/items.ts soldNow 의 「…에 팖」 자리 이름)을 메인 요청에 붙이나: 우주 쇼핑몰에 판 것은 문의 창에서 운영자와 흥정해 파는 것이라 「문의」를 따르고,
 *  포인트몰에 판 것은 그 줄의 「컨텍스트 포함」만 따른다(팔기 칸이 없다). 그 밖의 이름은 기본 상점의 「팔기」. 「…에 팖」이 아닌 기록(망상홈쇼핑 맞교환 등)은 거르지 않는다 */
export function soldPasses(vars: Vars, place: string, plain: boolean): boolean {
  if (!plain) return true;
  if (place === MALL_NAME.cos) return shopMain(vars, 'cos').has('ask');
  if (place === MALL_NAME.bm) return shopMain(vars, 'bm').on;
  return shopMain(vars, 'shop').has('sell');
}
