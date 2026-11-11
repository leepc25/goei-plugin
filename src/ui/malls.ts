// 인터넷 쇼핑몰 화면 (2026-11-08 사용자, 시안 /mnt/project-files/작업_1108/브라우저_시안3/ pc_08_cos·pc_09_bm·pc_13_cos_ask).
// 우주 쇼핑몰: 1990년대 개인 홈페이지, 왈도체(반말, 1인칭 「우리」). 왈도체 = 조각마다는 멀쩡한 우리말인데 따로 옮긴 조각이 영어 순서로 붙고, 꾸밈말은 엉뚱한 사전 뜻 (2026-11-10 사용자 정의: 「안녕하신가! 힘세고 강한 아침, 만일 내게 물어보면 나는 왈도」). 화면 고정 문구도 이 결로. 우주인·외계를 드러내지 않는다(11-09 사용자: 이름과 UFO 간판이 전부, 로어북 노출 금지). 장바구니 → 주문하기 → 입금 창(계좌) → 이체(가계부에서 빠짐) → 소지품. 돌려주는 것 없음.
//   운영자에게 질문: 넷스케이프 팝업. 상품 화면에서 열면 그 물건이 붙고, 다른 곳은 [물건을 붙인다]. 운영자 답에 물건 이름이 있으면 링크로.
// 백일몽 포인트몰: 사내 쇼핑몰, 운영자 없음(문의·흥정 X), 로그인해야 씀, 정가로 포인트 구매.
// 진열·문의 요청문은 상점(core/shop.ts)과 같고, 지침·설정만 사이트 것(core/malls.ts).
import { setGroup, setRow } from './setrow';
import { needAttr } from './needfill';
import type { ChatContext } from '../host/risu';
import { updateChat } from '../host/risu';
import { generate, type LlmMessage } from '../host/llm';
import { genSettings } from '../core/advanced';
import { addWalletEntry, aliveAnchors, freshWalletId, formatWon, readWallet, walletBalance, walletVars, WALLET_START_DEFAULT } from '../core/wallet';
import { pointsVars, readPoints } from '../core/points';
import { addItem, dropUse, ITEM_USE_AT_VAR, itemLeft, itemUseVars, itemsVars, liveItemsOf, readItemUse, readItems, sellItem, type Item } from '../core/items';
import { refreshUseBox } from '../host/usebox';
import { getPrefs } from '../core/settings';
import { liveOrders, minuteText, orderDue, orderReady, ordersText, ordersVars, settleReady, worldMinute, type CosOrder } from '../core/orders';
import { turnKey, acceptQuote, appendItems, applyShelf, applyTalk, buyNote, cancelSell, closeSale, dropItemsNamed, lastBot, markSold, parseShelf, parseTalk, sayToOwner, shelfItems, shelfPrompt, stampLastLine, startSell, talkPrompt, type ShopItem, type ShopState } from '../core/shop';
import { winStyle, type PopSpec } from './popwin';
import { craftMessages } from '../core/craft';
import { DESK_AVOID_RANGE, DESK_AXES_DEFAULT, DESK_KEY, deskRawSafe, deskSettings, deskTag, newDeskNo, deskVars, endDesk, makePrompt, parseCard, parseSay, pickAgain, readDesk, rollDice, talkPrompt as deskTalkPrompt, type DeskAgent, type DeskSource, type DeskState } from '../core/bmdesk';
import { COS_ACCOUNT, COS_FIXED_MAX, COS_TRUTH_KEY, COS_READY_KEY, cosReadyMode, cosAssignment, cosDraw, cosFixed, cosFixedRoll, cosFixedVars, cosTruthMode, genresText, MALL_GUIDE, MALL_NAME, mallAutoKey, mallKey, mallNote, mallNoteKey, mallRoll, mallSettings, mallVars, mallVarsOf, newCosFixed, readMall, rollChanged, rollDefaults, rollKeys, tiersText, type CosFixed, type CosTier, type MallSite } from '../core/malls';
import { SHOP_SIZE_HI, SHOP_SIZE_LO } from '../core/shop';
import { onOffSwitch } from './controls';
import { shopSource } from './shop';
import { itemPic } from './items';
import { siteLogo } from './browser';
import { isPhone } from './media';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface MallEnv {
  render(): void;
  refresh(): Promise<void>;
  current(): ChatContext | null;
}

interface View {
  loading: '' | 'shelf' | 'talk';
  notice: string;
  failRaw: string;
  info: string;
  /** 우주몰 장바구니 (물건 id) */
  cart: string[];
  /** 화면: 첫 화면 · 장바구니 (우주몰) / 분류 (포인트몰: '' 전체 · rare · sale) */
  page: string;
  /** 입금 창 */
  pay: boolean;
  /** 운영자에게 질문 창 (포인트몰: 1:1 상담 창) */
  ask: boolean;
  /** 포인트몰 1:1 상담: 상담사 만드는 중 · 답 기다리는 중 */
  dl?: '' | 'make' | 'talk';
  /** 방금 받은 맞춤 주문 id (주문 조회에서 설명·효과가 보이는 카드) */
  took?: string;
  /** 질문에 붙인 물건 id */
  chip: string;
  /** 붙일 물건 고르기 */
  picking: boolean;
  /** 팔 내 물건 고르기 (상담원: 매입) */
  selling: boolean;
  input: string;
  /** 링크로 찾아간 물건 (테두리·스크롤) */
  focus: string;
  /** 질문 창을 끌어 옮기거나 크기를 바꾼 자리 (PC, 사이트 칸 기준 px). 없으면 CSS 기본 자리 (11-09 사용자: 진짜 팝업창처럼) */
  win: { x: number; y: number; w: number; h: number } | null;
}
const fresh = (): View => ({ loading: '', notice: '', failRaw: '', info: '', cart: [], page: '', pay: false, ask: false, chip: '', picking: false, selling: false, input: '', focus: '', win: null });
const ui: Record<MallSite, View> = { cos: fresh(), bm: fresh() };
let uiChat = '';
const chatKey = (ctx: ChatContext) => `${ctx.charIndex}:${ctx.chatIndex}`;
/** 채팅이 바뀌면 화면 상태를 비운다 */
function sync(ctx: ChatContext): void {
  const k = chatKey(ctx);
  if (k === uiChat) return;
  uiChat = k;
  ui.cos = fresh();
  ui.bm = fresh();
}
export function resetMalls(): void {
  uiChat = '';
  ui.cos = fresh();
  ui.bm = fresh();
}
export const mallBusy = (site: MallSite): boolean => !!ui[site].loading;

const won = (n: number) => `₩${Math.trunc(n).toLocaleString('en-US')}`;
const pts = (n: number) => `${Math.trunc(n).toLocaleString('en-US')} P`;
const balanceOf = (ctx: ChatContext, site: MallSite): number => {
  const alive = aliveAnchors(ctx.chat);
  return site === 'bm' ? walletBalance(readPoints(ctx.chat.scriptstate), alive) : walletBalance(readWallet(ctx.chat.scriptstate, getPrefs().walletStart ?? WALLET_START_DEFAULT), alive);
};
const loggedNick = (ctx: ChatContext): string => (String(ctx.chat.scriptstate?.['$br_login'] ?? '') === '1' ? String(ctx.chat.scriptstate?.['$br_nick'] ?? '').trim() : '');
/** 자동 호출 「창을 열 때」: 마지막으로 짠 응답 */
const atKey = (site: MallSite) => `$${site}_shop_at`;

// ── 모델 ──

const jobs = new Set<string>();

/** 진열대 짜기 / 운영자에게 묻기. 같은 채팅을 보고 있을 때만 저장 */
/** 시그니처 상품 → 진열 물건 (할인 전 값이 더 크면 ※할인!※ 딱지) */
const fixedItem = (f: CosFixed): Omit<ShopItem, 'id'> => ({ name: f.name.trim(), desc: f.desc, effect: f.effect, use: false, price: f.price, truth: f.truth.trim() || '?', ...(f.was && f.was > f.price ? { tag: 'sale' as const, was: f.was } : {}) });

/** 팔기 확정 (「판매」 단추와 운영자의 <deal/> 가 같이 쓴다): 가계부 수입 + 소지품에서 뺌 + 판 것 목록. 팔 수 없으면 null */
function saleDone<C extends ChatContext['chat']>(chat: C, site: MallSite, itemId: string): C | null {
  const now = readMall(chat.scriptstate, site, aliveAnchors(chat));
  const o = now.sell;
  if (!o || o.itemId !== itemId || typeof o.price !== 'number') return null;
  const it0 = readItems(chat.scriptstate);
  if (!liveItemsOf(it0, chat).some((x) => x.id === itemId)) return null;
  const anchor = lastBot(chat)?.key ?? '';
  const w0 = readWallet(chat.scriptstate, getPrefs().walletStart ?? WALLET_START_DEFAULT);
  const w = addWalletEntry(w0, { id: freshWalletId(w0, `${site}_sl_${itemId}_${now.sales.length}`, anchor), anchor, amount: o.price, memo: `${o.name} (${MALL_NAME[site]} 매입)`, src: 'store' });
  const items = sellItem(it0, itemId, anchor, `${MALL_NAME[site]}에 팖`);
  const nextShop = closeSale(now);
  if (!nextShop) return null;
  const q = chat.scriptstate?.[ITEM_USE_AT_VAR] ? null : readItemUse(chat.scriptstate);
  const use = q && q.some((u) => u.id === itemId) ? itemUseVars(dropUse(q, itemId)) : {};
  return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...walletVars(w), ...itemsVars(items), ...mallVarsOf(site, nextShop), ...use } };
}

async function ask(ctx: ChatContext, env: MallEnv, site: MallSite, kind: 'shelf' | 'talk', st0: ShopState): Promise<void> {
  const job = `${chatKey(ctx)}:${site}`;
  if (jobs.has(job)) return;
  jobs.add(job);
  const v = ui[site];
  const s = mallSettings(ctx.chat.scriptstate, site);
  v.loading = kind;
  v.notice = '';
  v.failRaw = '';
  // 말을 걸었으면 방금 저장한 내 말이 응답을 기다리는 동안 바로 보이게 채팅을 다시 읽어 그린다 (render 만 하면 옛 채팅으로 그려 응답이 올 때까지 내 말이 안 보였다, 11-11 사용자)
  if (kind === 'talk') await env.refresh();
  else env.render();
  try {
    const src = shopSource({ ...ctx, chat: { ...ctx.chat, scriptstate: mallVars(ctx.chat.scriptstate, site) as typeof ctx.chat.scriptstate } }, st0, s);
    // 우주몰 진열: 칸마다 장르·값 등급을 굴려 넣는다 (11-09 사용자: 새로고침해도 같은 물건)
    if (kind === 'shelf') src.assign = cosAssignment(s.size[0] + Math.floor(Math.random() * (s.size[1] - s.size[0] + 1)), s.context, mallRoll(ctx.chat.scriptstate, site), Math.random, site); // 포인트몰도 (11-09 사용자)
    if (site === 'cos') src.truthMode = cosTruthMode(ctx.chat.scriptstate);
    if (site === 'cos') { const od = ordersText(liveOrders(ctx.chat.scriptstate, aliveAnchors(ctx.chat)), worldMinute(ctx.chat), lastBot(ctx.chat)?.key ?? ''); if (od) src.orders = od; }
    const g = genSettings(ctx.chat.scriptstate);
    const opts = { retries: g.retries, retryModel: g.retryModel, concurrent: g.concurrent, state: ctx.chat.scriptstate, label: `${MALL_NAME[site]} ${kind === 'shelf' ? '진열' : '문의'}` };
    let next: ShopState;
    let note: string | null = null;
    let deal = '';
    if (kind === 'shelf') {
      const { value } = await generate(shelfPrompt(src, s, MALL_GUIDE[site]), s.model, (raw) => parseShelf(raw, st0.loaded ? st0.identity : null), opts);
      let applied = applyShelf(st0, value, s);
      if (site === 'cos') {
        // 시그니처 상품 (설정 「시그니처 상품」): 모델이 같은 이름을 냈으면 버리고, 확률대로 코드가 끼운다 (이미 진열돼 있거나 산 것은 건너뜀)
        const fixed = cosFixed(ctx.chat.scriptstate);
        applied = dropItemsNamed(applied, fixed.map((f) => f.name));
        applied = appendItems(applied, cosFixedRoll(fixed).map(fixedItem));
      }
      // 진열대와 같이 온 한마디는 문의 대화가 아니라 첫 화면 글로
      note = value.owner ?? '';
      next = { ...applied, talk: st0.talk };
    } else {
      const { value } = await generate(talkPrompt(src, s, MALL_GUIDE[site]), s.model, parseTalk, opts);
      next = stampLastLine(applyTalk(st0, value, false), lastBot(ctx.chat)?.key ?? '');
      // 말로 판 것: 운영자가 <deal/> 을 냈고 부른 값이 있으면 「판매」 단추와 같이 처리
      if (value.deal && next.sell && typeof next.sell.price === 'number') deal = next.sell.itemId;
    }
    if (site === 'bm') next = { ...next, identity: { ...next.identity, points: true } };
    const cur = env.current();
    if (!cur || chatKey(cur) !== chatKey(ctx)) return;
    const key = lastBot(cur.chat)?.key ?? '';
    const sale = deal ? next.sell : null;
    let sold = false;
    await updateChat(cur.charIndex, cur.chatIndex, (chat) => {
      const saved = { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...mallVarsOf(site, { ...next, key }), ...(note !== null ? { [mallNoteKey(site)]: note, [atKey(site)]: turnKey(chat) } : {}) } };
      const done = deal ? saleDone(saved, site, deal) : null;
      if (done) sold = true;
      return done ?? saved;
    });
    if (sold && sale) { v.info = `「${sale.name}」을 ${won(sale.price as number)}에 팔았다. 입금 완료, 너에게.`; void refreshUseBox(cur.charIndex, cur.chatIndex); }
    // 장바구니에서 진열대에 없는 물건은 뺀다
    v.cart = v.cart.filter((id) => shelfItems(next).some((x) => x.id === id));
  } catch (error) {
    v.notice = error instanceof Error ? error.message : String(error);
    v.failRaw = deskRawSafe(String((error as { raw?: string }).raw ?? ''));
    if (kind === 'talk') {
      // 내 말은 적어 뒀으니 답이 안 왔으면 되돌린다
      const cur = env.current();
      if (cur && chatKey(cur) === chatKey(ctx)) {
        await updateChat(cur.charIndex, cur.chatIndex, (chat) => {
          const now = readMall(chat.scriptstate, site, aliveAnchors(chat));
          const last = now.talk[now.talk.length - 1];
          if (!last || last.who !== 'me') return null;
          return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...mallVarsOf(site, { ...now, talk: now.talk.slice(0, -1) }) } };
        }).catch(() => null);
      }
    }
  } finally {
    v.loading = '';
    jobs.delete(job);
  }
  await env.refresh();
}

/** 사이트를 열 때: 「창을 열 때」이고 마지막 응답 뒤로 아직 안 짰으면 한 번 (처음이면 늘) */
let liveEnv: MallEnv | null = null;
export function mallOpenCheck(ctx: ChatContext, env: MallEnv, site: MallSite): void {
  liveEnv = env;
  sync(ctx);
  const s = mallSettings(ctx.chat.scriptstate, site);
  if (!s.on || s.auto === 'manual' || ui[site].loading) return;
  if (site === 'bm' && !loggedNick(ctx)) return;
  const st = readMall(ctx.chat.scriptstate, site, aliveAnchors(ctx.chat));
  if (st.loaded && String(ctx.chat.scriptstate?.[atKey(site)] ?? '') === turnKey(ctx.chat)) return;
  if (st.loaded && s.auto === 'turn') return;
  void ask(ctx, env, site, 'shelf', st);
}

/** 매 턴 자동 호출 (body.ts): 응답이 붙은 뒤 진열대를 새로 */
export async function autoRefreshMall(ctx: ChatContext, site: MallSite): Promise<void> {
  // 창이 이 채팅을 보고 있으면 그 화면을 다시 그리고, 아니면 조용히 저장만
  const live = liveEnv?.current();
  const env: MallEnv = live && chatKey(live) === chatKey(ctx) ? liveEnv! : { render() {}, refresh: async () => {}, current: () => ctx };
  const s = mallSettings(ctx.chat.scriptstate, site);
  if (!s.on || s.auto !== 'turn') return;
  if (String(ctx.chat.scriptstate?.[atKey(site)] ?? '') === turnKey(ctx.chat)) return;
  await ask(ctx, env, site, 'shelf', readMall(ctx.chat.scriptstate, site, aliveAnchors(ctx.chat)));
}

/** 호출 흐름 미리 계산 (editor/flow.ts): 지금 설정으로 이 쇼핑몰이 보낼 진열대 요청 (모델은 안 부름). 꺼져 있으면 null */
export function previewMallShelf(ctx: ChatContext, site: MallSite): LlmMessage[] | null {
  const s = mallSettings(ctx.chat.scriptstate, site);
  if (!s.on) return null;
  const st = readMall(ctx.chat.scriptstate, site, aliveAnchors(ctx.chat));
  const src = shopSource({ ...ctx, chat: { ...ctx.chat, scriptstate: mallVars(ctx.chat.scriptstate, site) as typeof ctx.chat.scriptstate } }, st, s);
  src.assign = cosAssignment(s.size[1], s.context, mallRoll(ctx.chat.scriptstate, site), Math.random, site);
  if (site === 'cos') src.truthMode = cosTruthMode(ctx.chat.scriptstate);
  return shelfPrompt(src, s, MALL_GUIDE[site]);
}

// ── 사기 ──

/** 물건들을 산다: 가계부(우주몰 원·포인트몰 포인트)에서 빼고 소지품에 넣고 진열대에서 뺀다. 모자라면 하나도 안 산다 */
async function buy(ctx: ChatContext, site: MallSite, ids: string[]): Promise<ShopItem[] | null> {
  const start = getPrefs().walletStart ?? WALLET_START_DEFAULT;
  let got: ShopItem[] | null = null;
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const now = readMall(chat.scriptstate, site, aliveAnchors(chat));
    const list = ids.map((id) => now.items.find((x) => x.id === id && !x.sold)).filter((x): x is ShopItem => !!x);
    if (!list.length || list.length !== ids.length) return null;
    const alive = aliveAnchors(chat);
    const p = site === 'bm';
    let w = p ? readPoints(chat.scriptstate) : readWallet(chat.scriptstate, start);
    const total = list.reduce((a, x) => a + x.price, 0);
    if (walletBalance(w, alive) < total) return null;
    const anchor = lastBot(chat)?.key ?? '';
    let items = readItems(chat.scriptstate);
    let st = now;
    for (const it of list) {
      const walletId = it.price > 0 ? freshWalletId(w, `${site}_${it.id}`, anchor) : '';
      if (walletId) w = addWalletEntry(w, { id: walletId, anchor, amount: -it.price, memo: `${it.name} (${MALL_NAME[site]})`, src: 'store' });
      // 흥정으로 붙은 다른 대가(it.pay)도 기록에 남긴다 (일반 상점 ui/shop.ts 와 같게, 릴리스 점검 11-09)
      const extra = it.pay ? ` + ${it.pay}` : '';
      const paid = p ? { paidWith: `${it.price.toLocaleString('en-US')} Baekilmong points at ${MALL_NAME[site]}${extra}` } : { price: it.price, ...(walletId ? { walletId } : {}), paidWith: `bank transfer to ${MALL_NAME[site]}${extra}` };
      items = addItem(items, alive, { name: it.name, desc: it.desc, effect: it.effect, truth: it.truth, use: it.use, uses: it.uses, equip: it.equip, icon: it.icon, weight: it.weight, from: 'store', anchor, ...paid });
      st = markSold(st, it.id, anchor);
    }
    got = list;
    return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...(p ? pointsVars(w) : walletVars(w)), ...itemsVars(items), ...mallVarsOf(site, st) } };
  });
  return got;
}

/** data-action 처리. 처리했으면 true */
export async function mallAction(action: string, value: string | undefined, ctx: ChatContext, env: MallEnv, site: MallSite): Promise<boolean> {
  if (!action.startsWith('mall-')) return false;
  sync(ctx);
  // 돈이 오가는 동작은 처리 중 한 번만 (릴리스 점검 11-09: 두 번 누르면 두 번째 결과가 안내를 실패 문구로 덮었다)
  const MONEY = ['mall-pay', 'mall-buy', 'mall-note-buy', 'mall-quote-accept', 'mall-custom-take', 'mall-sell'];
  if (MONEY.includes(action)) {
    if (moneyBusy) return true;
    moneyBusy = true;
    try {
      return await mallMoney(action, value, ctx, env, site);
    } finally {
      moneyBusy = false;
    }
  }
  return mallMoney(action, value, ctx, env, site);
}
let moneyBusy = false;
/** mallAction 본체 (돈 동작은 잠금 안에서 불린다) */
async function mallMoney(action: string, value: string | undefined, ctx: ChatContext, env: MallEnv, site: MallSite): Promise<boolean> {
  const v = ui[site];
  const st = readMall(ctx.chat.scriptstate, site, aliveAnchors(ctx.chat));
  const s = mallSettings(ctx.chat.scriptstate, site);
  v.info = '';
  switch (action) {
    case 'mall-refresh':
      if (!s.on || v.loading) return true;
      if (site === 'bm' && !loggedNick(ctx)) return true;
      await ask(ctx, env, site, 'shelf', st);
      return true;
    case 'mall-page':
      v.page = value ?? '';
      v.pay = false;
      v.focus = '';
      v.took = '';
      break;
    case 'mall-cart': {
      const id = value ?? '';
      if (!st.items.some((x) => x.id === id && !x.sold)) return true;
      v.cart = v.cart.includes(id) ? v.cart.filter((x) => x !== id) : [...v.cart, id];
      break;
    }
    case 'mall-order':
      if (!v.cart.length) return true;
      v.pay = true;
      break;
    case 'mall-pay-close':
      v.pay = false;
      break;
    case 'mall-pay': {
      const names = v.cart.map((id) => st.items.find((x) => x.id === id)?.name ?? '').filter(Boolean);
      const got = await buy(ctx, site, v.cart);
      if (got) {
        v.cart = [];
        v.pay = false;
        v.page = '';
        v.info = `입금 확인!! ${names.map((n) => `「${n}」`).join(' ')} 갔다 너의 소지품으로, 즉시.`;
      } else v.info = '잔고 부족, 또는 상품 이미 팔렸다, 밖으로. 입금 아님 수행.';
      await env.refresh();
      return true;
    }
    case 'mall-buy': {
      // 포인트몰: 정가로 바로 구매 (로그인해야)
      if (site !== 'bm' || !loggedNick(ctx)) return true;
      const it = st.items.find((x) => x.id === value && !x.sold);
      if (!it) return true;
      const got = await buy(ctx, site, [it.id]);
      v.info = got ? `「${it.name}」 구매가 완료되었습니다. 소지품에 들어갔습니다.` : '포인트가 부족하거나 품절된 상품입니다.';
      await env.refresh();
      return true;
    }
    case 'mall-ask':
      if (site === 'bm') return deskOpen(ctx, env);
      // 상품에서 열면 그 물건을 붙인다
      if (site !== 'cos') return true;
      v.ask = true;
      v.picking = false;
      if (value) v.chip = value;
      break;
    case 'mall-ask-close':
      v.ask = false;
      v.picking = false;
      break;
    case 'mall-pick':
      v.picking = !v.picking;
      v.selling = false;
      break;
    case 'mall-sell-open':
      // 상담원: 내 물건 팔기 — 소지품을 골라 운영자에게 내민다 (값은 운영자가 헐값으로 부른다)
      if (site !== 'cos') return true;
      v.selling = !v.selling;
      v.picking = false;
      break;
    case 'mall-sell-pick': {
      if (site !== 'cos' || v.loading || !st.loaded) return true;
      const mine = liveItemsOf(readItems(ctx.chat.scriptstate), ctx.chat).find((x) => x.id === value);
      if (!mine) return true;
      const left = itemLeft(readItems(ctx.chat.scriptstate), mine, aliveAnchors(ctx.chat));
      const next = startSell(st, { itemId: mine.id, name: mine.name, desc: mine.desc, effect: mine.effect, ...(mine.truth ? { truth: mine.truth } : {}), use: mine.use, ...(left !== undefined ? { uses: left } : {}), ...(mine.equip ? { equip: mine.equip } : {}), ...(mine.icon ? { icon: mine.icon } : {}), ...(Number.isSafeInteger(mine.price) ? { paid: mine.price } : {}) });
      v.selling = false;
      v.chip = '';
      await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...mallVarsOf(site, next) } }));
      await env.refresh();
      return true;
    }
    case 'mall-note-buy': {
      // 정보 쪽지 구매: 가계부에서 빠지고 소지품에 「쪽지: 제목」(내용은 거기서만)
      const n = (st.notes ?? []).find((x) => x.id === value && !x.bought);
      if (site !== 'cos' || !n || v.loading) return true;
      let ok = false; let short = false;
      await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
        const now = readMall(chat.scriptstate, site, aliveAnchors(chat));
        const nextShop = buyNote(now, n.id, lastBot(chat)?.key ?? '');
        if (!nextShop) return null;
        const alive = aliveAnchors(chat);
        let w = readWallet(chat.scriptstate, getPrefs().walletStart ?? WALLET_START_DEFAULT);
        if (walletBalance(w, alive) < n.price) { short = true; return null; }
        const anchor = lastBot(chat)?.key ?? '';
        const walletId = freshWalletId(w, `${site}_note_${n.id}`, anchor);
        w = addWalletEntry(w, { id: walletId, anchor, amount: -n.price, memo: `쪽지: ${n.title} (${MALL_NAME[site]})`, src: 'store' });
        const items = addItem(readItems(chat.scriptstate), alive, { name: `쪽지: ${n.title}`, desc: `${MALL_NAME[site]} 운영자가 보낸 쪽지`, text: n.body, use: false, icon: 'note paper', weight: 0.01, from: 'store', anchor, price: n.price, walletId, paidWith: `bank transfer to ${MALL_NAME[site]}` });
        ok = true;
        return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...walletVars(w), ...itemsVars(items), ...mallVarsOf(site, nextShop) } };
      });
      v.info = ok ? `쪽지 「${n.title}」가 소지품에 도착 했다. 내용은 거기서 읽어라.` : short ? '잔고가 모자란다. 입금이 필요하다.' : '살 수 없는 상태다.';
      await env.refresh();
      return true;
    }
    case 'mall-quote-accept': {
      // 맞춤 주문: 견적을 선납하고 주문 목록에 넣는다. 완성품은 「주문 조회」에서 납기 뒤에 받는다
      const q = (st.quotes ?? []).find((x) => x.id === value && quoteOpen(x, liveOrders(ctx.chat.scriptstate, aliveAnchors(ctx.chat))));
      if (site !== 'cos' || !q || v.loading) return true;
      let ok = false; let short = false;
      await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
        const now = readMall(chat.scriptstate, site, aliveAnchors(chat));
        // 주문한 응답이 지워져 주문이 없어진 견적은 다시 주문할 수 있다 (accepted 를 되돌려 acceptQuote 를 그대로 쓴다)
        const nextShop = acceptQuote({ ...now, quotes: (now.quotes ?? []).map((x) => (x.id === q.id ? { ...x, accepted: false } : x)) }, q.id, lastBot(chat)?.key ?? '');
        if (!nextShop) return null;
        const alive = aliveAnchors(chat);
        let w = readWallet(chat.scriptstate, getPrefs().walletStart ?? WALLET_START_DEFAULT);
        if (walletBalance(w, alive) < q.price) { short = true; return null; }
        const anchor = lastBot(chat)?.key ?? '';
        const walletId = freshWalletId(w, `${site}_ord_${q.id}`, anchor);
        w = addWalletEntry(w, { id: walletId, anchor, amount: -q.price, memo: `맞춤 주문 선납: ${q.item.name} (${MALL_NAME[site]})`, src: 'store' });
        const { sold: _s, tag: _t, was: _w, orig: _o, pay: _p, ...item } = q.item;
        const order: CosOrder = { id: q.id, anchor, price: q.price, hours: q.hours, orderedAt: worldMinute(chat), orderedKey: anchor, walletId, item };
        ok = true;
        return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...walletVars(w), ...ordersVars([...liveOrders(chat.scriptstate, aliveAnchors(chat)), order]), ...mallVarsOf(site, nextShop) } };
      });
      v.info = ok ? `「${q.item.name}」 주문이 접수 되었다. 선납 완료. 완성되면 「주문 조회」에서 받아라.` : short ? '잔고가 모자란다. 입금이 필요하다.' : '주문할 수 없는 상태다.';
      await env.refresh();
      return true;
    }
    case 'mall-custom-take': {
      // 완성품 받기: 납기가 지났을 때만. 그제야 설명·효과가 보이고(진실은 숨긴 채) 소지품에 들어간다
      const o = liveOrders(ctx.chat.scriptstate, aliveAnchors(ctx.chat)).find((x) => x.id === value);
      if (site !== 'cos' || !o || !orderReady(o, worldMinute(ctx.chat), lastBot(ctx.chat)?.key ?? '')) return true;
      let ok = false;
      await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
        const list = liveOrders(chat.scriptstate, aliveAnchors(chat));
        const cur = list.find((x) => x.id === o.id);
        if (!cur || cur.taken) return null;
        const anchor = lastBot(chat)?.key ?? '';
        const it = cur.item;
        const items = addItem(readItems(chat.scriptstate), aliveAnchors(chat), { name: it.name, desc: it.desc, effect: it.effect, truth: it.truth, use: it.use, uses: it.uses, equip: it.equip, icon: it.icon, weight: it.weight, from: 'store', anchor, price: cur.price, walletId: cur.walletId ?? `${site}_ord_${cur.id}`, paidWith: `custom order from ${MALL_NAME[site]}, paid in advance` });
        ok = true;
        const next = { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...itemsVars(items), ...ordersVars(list.map((x) => (x.id === o.id ? { ...x, taken: true, takenKey: anchor } : x))) } };
        // 받았으니 채팅의 완성 알림 카드(표식)를 지운다
        const message = settleReady(next, cosReadyMode(next.scriptstate) !== 'off');
        return message ? { ...next, message } : next;
      });
      v.info = ok ? `「${o.item.name}」을 받았다. 소지품에 들어갔다.` : '받을 수 없는 상태다.';
      if (ok) v.took = o.id;
      await env.refresh();
      return true;
    }
    case 'mall-sell-cancel':
      if (st.sell) await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...mallVarsOf(site, cancelSell(readMall(chat.scriptstate, site, aliveAnchors(chat)))) } }));
      await env.refresh();
      return true;
    case 'mall-sell': {
      // 팔기 확정 (ui/shop.ts 'shop-sell' 과 같은 흐름): 가계부 수입 + 소지품에서 뺌 + 판 것 목록
      if (!st.sell || typeof st.sell.price !== 'number' || v.loading) return true;
      const o = st.sell;
      let sold = false;
      await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
        const done = saleDone(chat, site, o.itemId);
        if (done) sold = true;
        return done;
      });
      v.info = sold ? `「${o.name}」을 ${won(o.price as number)}에 팔았다. 입금 완료, 너에게.` : '팔 수 없음, 지금 (물건이 없거나 값이 바뀌었다).';
      if (sold) void refreshUseBox(ctx.charIndex, ctx.chatIndex);
      await env.refresh();
      return true;
    }
    case 'mall-chip':
      v.chip = value ?? '';
      v.picking = false;
      break;
    case 'mall-show':
      // 운영자가 보낸 물건 링크: 창을 닫고 그 물건으로
      v.ask = false;
      v.page = '';
      v.focus = value ?? '';
      env.render();
      document.querySelector(`.ms [data-item="${CSS.escape(v.focus)}"]`)?.scrollIntoView({ block: 'center' });
      return true;
    case 'mall-raw':
      if (v.failRaw) v.notice = `${v.notice.split('\n')[0]}\n${v.failRaw.slice(0, 1500)}`;
      v.failRaw = '';
      break;
    case 'mall-desk-end':
      // 상담 종료: 상담사를 지난 목록에 넣고 창을 닫는다 (다음에 열면 새 상담사)
      if (site !== 'bm' || v.dl) return true;
      await saveDesk(ctx, endDesk(readDesk(ctx.chat.scriptstate)));
      v.ask = false;
      v.input = '';
      await env.refresh();
      return true;
    case 'mall-desk-next': {
      if (site !== 'bm' || v.dl) return true;
      const saved = await saveDesk(ctx, endDesk(readDesk(ctx.chat.scriptstate)));
      v.input = '';
      if (saved) await deskRun({ ...ctx, chat: saved }, env, 'make', endDesk(readDesk(saved.scriptstate)));
      return true;
    }
    case 'mall-say': {
      const said = (value ?? v.input).trim();
      if (site === 'bm') {
        const d = readDesk(ctx.chat.scriptstate);
        if (!said || v.dl || !d.agent) return true;
        const next: DeskState = { ...d, talk: [...d.talk, { who: 'me', text: said.slice(0, 600) }] };
        v.input = '';
        const saved = await saveDesk(ctx, next);
        if (saved) await deskRun({ ...ctx, chat: saved }, env, 'talk', next);
        return true;
      }
      if (site !== 'cos' || !said || v.loading || !st.loaded) return true;
      const chip = st.items.find((x) => x.id === v.chip && !x.sold);
      const next = stampLastLine(sayToOwner(st, `${chip ? `[${chip.name}] ` : ''}${said}`), lastBot(ctx.chat)?.key ?? '');
      v.input = '';
      v.chip = '';
      v.picking = false;
      const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...mallVarsOf(site, next) } }));
      if (!saved) return true;
      await ask({ ...ctx, chat: saved }, env, site, 'talk', next);
      return true;
    }
    default:
      return false;
  }
  env.render();
  return true;
}


// ── 포인트몰 1:1 상담 (2026-11-09 사용자: 기능 없이 상담사와 대화하는 재미, 상담마다 다른 백일몽 직원) ──

/** 상담사 모델에 넘길 자료: 백일몽 로어북·위키(참고 로어북 수는 포인트몰 설정), 지금 진열, 남은 포인트, 사내 계정 */
function deskSource(ctx: ChatContext): DeskSource {
  const vars = ctx.chat.scriptstate;
  const s = mallSettings(vars, 'bm');
  const st = readMall(vars, 'bm', aliveAnchors(ctx.chat));
  const src = shopSource({ ...ctx, chat: { ...ctx.chat, scriptstate: mallVars(vars, 'bm') as typeof ctx.chat.scriptstate } }, { ...st, shop: '백일몽', owner: '' }, s);
  return { refs: src.refs, shelf: onShelf(st).map((x) => `${x.name}|${x.price}p|${x.desc}`).join('\n'), points: balanceOf(ctx, 'bm'), nick: loggedNick(ctx), language: src.language };
}

async function saveDesk(ctx: ChatContext, st: DeskState) {
  return updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...deskVars(st) } }));
}

// 11-09 사용자: 상담원 신분(실명·직급·부서)은 손님에게 드러나지 않는다 — 화면엔 번호 호칭만
const deskHello = (a: DeskAgent, again = false) => `${deskTag(a)} 님이 상담에 ${again ? '다시 ' : ''}연결되었습니다.`;

/** 상담사 만들기(make) 또는 답 받기(talk). 같은 채팅을 보고 있을 때만 저장 */
async function deskRun(ctx: ChatContext, env: MallEnv, kind: 'make' | 'talk', st0: DeskState): Promise<void> {
  const v = ui.bm;
  const job = `${chatKey(ctx)}:bm-desk`;
  if (jobs.has(job)) return;
  jobs.add(job);
  const vars = ctx.chat.scriptstate;
  const s = mallSettings(vars, 'bm');
  const ds = deskSettings(vars);
  v.dl = kind;
  v.notice = '';
  v.failRaw = '';
  // 말을 걸었으면 방금 저장한 내 말이 응답을 기다리는 동안 바로 보이게 채팅을 다시 읽어 그린다 (render 만 하면 옛 채팅으로 그려 응답이 올 때까지 내 말이 안 보였다, 11-11 사용자)
  if (kind === 'talk') await env.refresh();
  else env.render();
  try {
    const src = deskSource(ctx);
    const g = genSettings(vars);
    const opts = { retries: g.retries, retryModel: g.retryModel, concurrent: g.concurrent, state: vars, label: `${MALL_NAME.bm} 1:1 상담${kind === 'make' ? ' 연결' : ''}` };
    let next: DeskState;
    const key = lastBot(ctx.chat)?.key ?? '';
    if (kind === 'make') {
      const dice = rollDice(ds.axes);
      const no = newDeskNo();
      const p = makePrompt(src, dice, st0.past.slice(0, ds.avoid), no);
      const { value } = await generate(craftMessages(p.messages, { thoughts: s.thoughts, memo: false, reiterate: 0 }, { thoughts: p.thoughts }), s.model, (raw) => parseCard(raw, dice, no), opts);
      next = { ...st0, agent: value.agent, anchor: key, talk: [{ who: 'sys', text: deskHello(value.agent) }, ...value.say.map((t) => ({ who: 'op' as const, text: t }))] };
    } else {
      const p = deskTalkPrompt(src, st0);
      const { value } = await generate(craftMessages(p.messages, { thoughts: s.thoughts, memo: false, reiterate: 0 }, { thoughts: p.thoughts }), s.model, parseSay, opts);
      next = { ...st0, talk: [...st0.talk, ...value.map((t) => ({ who: 'op' as const, text: t }))] };
    }
    const cur = env.current();
    if (!cur || chatKey(cur) !== chatKey(ctx)) return;
    await saveDesk(cur, next);
  } catch (error) {
    v.notice = error instanceof Error ? error.message : String(error);
    v.failRaw = deskRawSafe(String((error as { raw?: string }).raw ?? ''));
    if (kind === 'talk') {
      // 내 말은 적어 뒀으니 답이 안 왔으면 되돌리고 입력칸에 돌려준다
      const cur = env.current();
      if (cur && chatKey(cur) === chatKey(ctx)) {
        const last = st0.talk[st0.talk.length - 1];
        if (last?.who === 'me') {
          v.input = last.text;
          await saveDesk(cur, { ...st0, talk: st0.talk.slice(0, -1) }).catch(() => null);
        }
      }
    }
  } finally {
    v.dl = '';
    jobs.delete(job);
  }
  await env.refresh();
}

/** 1:1 상담 열기: 이어 가던 상담이 있으면 그대로(본편이 넘어갔으면 끝내고 새로), 없으면 새 상담사 연결 */
async function deskOpen(ctx: ChatContext, env: MallEnv): Promise<boolean> {
  const v = ui.bm;
  const ds = deskSettings(ctx.chat.scriptstate);
  if (!ds.on || !loggedNick(ctx)) return true;
  v.ask = true;
  v.notice = '';
  if (v.dl) return env.render(), true;
  let st = readDesk(ctx.chat.scriptstate);
  const key = lastBot(ctx.chat)?.key ?? '';
  if (st.agent && st.anchor === key) return env.render(), true;
  if (st.agent) st = endDesk(st);
  const again = pickAgain(st, ds);
  if (again) {
    st = { ...st, agent: again, anchor: key, past: st.past.filter((p) => p.id !== again.id), talk: [{ who: 'sys', text: deskHello(again, true) }] };
    await saveDesk(ctx, st);
    await env.refresh();
    return true;
  }
  const saved = await saveDesk(ctx, st);
  if (saved) await deskRun({ ...ctx, chat: saved }, env, 'make', st);
  return true;
}

/** 입력칸 글만 기억한다 (다시 그리지 않음) */
export function mallInput(site: MallSite, text: string): void {
  ui[site].input = text;
}

// ── 화면 ──

const pic = (it: ShopItem) => itemPic({ name: it.name, icon: it.icon });
const onShelf = (st: ShopState) => shelfItems(st);

/** 실패 안내 */
const failBox = (v: View, cls: string) => (v.notice ? `<div class="${cls}" role="alert">${esc(v.notice).replace(/\n/g, '<br>')}${v.failRaw ? ' <button data-action="mall-raw">받은 글 보기</button>' : ''}</div>` : '');

/* 우주 쇼핑몰 */

/** 운영자 말: 진열대 물건 이름은 링크로 (2026-11-08 사용자: 운영자도 상품 링크 보냄) */
/** 정보 쪽지 카드: 제목·값만. 사면 내용은 소지품의 쪽지에서만 읽는다 (11-09 사용자: 같은 자리에 풀리면 재미없다) */
function noteCard(st: ShopState, id: string | undefined, v: View): string {
  const n = id ? (st.notes ?? []).find((x) => x.id === id) : null;
  if (!n) return '';
  return `<div class="q-note${n.bought ? ' done' : ''}"><span>📄 쪽지</span><b>${esc(n.title)}</b><em>${won(n.price)}</em>${n.bought ? '<small>구매 완료 — 소지품에서 읽어라</small>' : `<button class="cs-btn" data-action="mall-note-buy" data-value="${esc(n.id)}"${v.loading ? ' disabled' : ''}>구매</button>`}</div>`;
}

/** 맞춤 주문 견적 카드: 이름·값·납기만 (설명·효과는 받을 때 본다). 선납하면 주문 */
/** 견적을 (다시) 주문할 수 있나: 아직 안 했거나, 했는데 그 주문이 지운·다시 굴린 응답과 함께 없어졌을 때 */
const quoteOpen = (q: { id: string; accepted?: boolean }, orders: CosOrder[]): boolean => !q.accepted || !orders.some((o) => o.id === q.id);
function quoteCard(st: ShopState, id: string | undefined, v: View, orders: CosOrder[] = []): string {
  const q0 = id ? (st.quotes ?? []).find((x) => x.id === id) : null;
  if (!q0) return '';
  const q = { ...q0, accepted: !quoteOpen(q0, orders) };
  const h = q.hours >= 24 ? `${Math.round((q.hours / 24) * 10) / 10}일` : `${q.hours}시간`;
  return `<div class="q-note q-quote${q.accepted ? ' done' : ''}"><span>🛠 맞춤 주문 견적</span><b>${esc(q.item.name)}</b><em>${won(q.price)}</em><small>납기 ${h}</small>${q.accepted ? '<small class="ok">선납 완료 — 주문 조회에서 받아라</small>' : `<button class="cs-btn" data-action="mall-quote-accept" data-value="${esc(q.id)}"${v.loading ? ' disabled' : ''}>선납하고 주문</button>`}</div>`;
}

/** 「주문 조회」: 진행 중·받을 수 있음·받음 (11-09 사용자: 맞춤 상품이 진열되는 건 이상하다 → 따로 받는 창) */
function cosOrders(ctx: ChatContext, v: View): string {
  const list = liveOrders(ctx.chat.scriptstate, aliveAnchors(ctx.chat));
  const nowMin = worldMinute(ctx.chat);
  const lastKey = lastBot(ctx.chat)?.key ?? '';
  if (!list.length) return '<div class="cs-box"><b class="cs-h">◈ 주문 조회 ◈</b><p>주문의 존재는 없다. 운영자에게 질문에서 맞춤 주문을 말해라.</p></div>';
  const rows = [...list].reverse().map((o) => {
    const ready = orderReady(o, nowMin, lastKey);
    const due = orderDue(o);
    const when = o.taken ? '받음' : ready ? '<b class="cs-red">완성 — 위 카드에서 받아라</b>' : due !== null ? `제작 중 · 납기 ${esc(minuteText(due))}${nowMin !== null ? ` (${Math.max(1, Math.ceil((due - nowMin) / 60))}시간 남음)` : ''}` : `제작 중 · 납기 ${o.hours}시간 (다음 응답 뒤)`;
    return `<tr class="${o.taken ? 'done' : ''}"><td>${esc(o.item.name)}</td><td>${won(o.price)}</td><td>${when}</td></tr>`;
  }).join('');
  // 완성된 물건은 그림 카드로 (11-09 사용자: 완성되면 이미지와 함께 받기가 나와야). 받기 전엔 그림·이름만, 받은 직후 카드엔 설명·효과(광고 문구)까지
  const cards = [...list].reverse().filter((o) => (!o.taken && orderReady(o, nowMin, lastKey)) || o.id === v.took).map((o) => {
    const got = o.taken;
    return `<div class="cs-it cs-got"><span class="cs-bd">${got ? '받음' : '★완성★'}</span><span class="cs-pic">${itemPic({ name: o.item.name, icon: o.item.icon })}</span>
    <b class="cs-nm">${esc(o.item.name)}</b><p>${got ? `${esc(o.item.desc)}${o.item.effect ? `<br><i>※ ${esc(o.item.effect)}</i>` : ''}` : '우리는 만들었다. 받아라.'}</p>
    <div class="cs-pr"><b>${won(o.price)}</b> <small>선납 완료</small></div>
    <div class="cs-bt">${got ? '<small>소지품에 들어갔다</small>' : `<button class="cs-btn" data-action="mall-custom-take" data-value="${esc(o.id)}">받기</button>`}</div></div>`;
  }).join('');
  return `<div class="cs-box"><b class="cs-h">◈ 주문 조회 ◈</b>${cards ? `<div class="cs-gotgrid">${cards}</div>` : ''}<table class="cs-tb cs-ord"><tr><th>주문</th><th>선납</th><th>상태</th></tr>${rows}</table><p class="cs-bal">납기는 작중 시각 기준이다. 환불의 존재는 없다.</p></div>`;
}

function opText(text: string, st: ShopState): string {
  let html = esc(text);
  for (const it of onShelf(st).slice().sort((a, b) => b.name.length - a.name.length)) {
    const n = esc(it.name);
    if (!n || !html.includes(n)) continue;
    html = html.split(n).join(`<button class="cs-ln" data-action="mall-show" data-value="${esc(it.id)}">${n} <b>${won(it.price)}</b></button>`);
  }
  return html;
}

function cosCard(it: ShopItem, v: View): string {
  const sale = it.tag === 'sale' && !!it.was && it.was > it.price;
  const inCart = v.cart.includes(it.id);
  const badge = it.tag === 'rare' ? '<span class="cs-bd">★굉장한 상품★</span>' : sale ? '<span class="cs-bd cs-bds">※세일※</span>' : '';
  return `<div class="cs-it${v.focus === it.id ? ' on' : ''}" data-item="${esc(it.id)}">${badge}<span class="cs-pic">${pic(it)}</span>
    <b class="cs-nm">${esc(it.name)}</b><p>${esc(it.desc)}${it.effect ? `<br><i>※ ${esc(it.effect)}</i>` : ''}</p>
    <div class="cs-pr">${sale ? `<s>${won(it.was!)}</s> ` : ''}<b>${won(it.price)}</b>${it.pay ? ` <small>+ ${esc(it.pay)}</small>` : ''}</div>
    <div class="cs-bt"><button class="cs-btn${inCart ? ' in' : ''}" data-action="mall-cart" data-value="${esc(it.id)}" aria-pressed="${inCart}">${inCart ? '장바구니에서 제거' : '장바구니에 담기'}</button><button class="cs-ln" data-action="mall-ask" data-value="${esc(it.id)}">질문 하기</button></div></div>`;
}

function cosCart(st: ShopState, v: View, bal: number): string {
  const list = v.cart.map((id) => st.items.find((x) => x.id === id)).filter((x): x is ShopItem => !!x);
  if (!list.length) return `<div class="cs-box"><b class="cs-h">◈ 장바구니 ◈</b><p>장바구니 비었다. 담아라 상품, 먼저.</p><button class="cs-btn" data-action="mall-page" data-value="">상품 목록으로</button></div>`;
  const total = list.reduce((a, x) => a + x.price, 0);
  return `<div class="cs-box"><b class="cs-h">◈ 장바구니 ◈</b><table class="cs-tb"><tr><th>상품</th><th>가격</th><th></th></tr>${list.map((x) => `<tr><td>${esc(x.name)}</td><td>${won(x.price)}</td><td><button class="cs-ln" data-action="mall-cart" data-value="${esc(x.id)}">제거</button></td></tr>`).join('')}
    <tr class="cs-sum"><td>합계</td><td colspan="2"><b>${won(total)}</b></td></tr></table>
    <p class="cs-bal">당신의 잔고 : ${formatWon(bal)}</p><button class="cs-btn cs-go" data-action="mall-order">주문 하기</button></div>`;
}

function cosPay(st: ShopState, v: View, bal: number): string {
  const list = v.cart.map((id) => st.items.find((x) => x.id === id)).filter((x): x is ShopItem => !!x);
  const total = list.reduce((a, x) => a + x.price, 0);
  const poor = bal < total;
  return `<div class="cs-dim"><div class="cs-win cs-paywin" role="dialog" aria-label="입금 안내"><div class="cs-wt"><b>★ 입금 안내 ★ - Netscape</b><button data-action="mall-pay-close" aria-label="닫기">×</button></div>
    <div class="cs-wb"><p>아래 계좌로 입금해라. 우리는 입금을 확인한다.</p><p class="cs-acc">${esc(COS_ACCOUNT)}</p>
    <table class="cs-tb"><tr><td>입금 금액</td><td><b>${won(total)}</b></td></tr><tr><td>현재 잔고</td><td>${formatWon(bal)}</td></tr><tr><td>입금 후</td><td>${formatWon(bal - total)}</td></tr></table>
    <p class="cs-warn">※ 환불의 존재는 없다. 반품 또한 그렇다.</p>
    <div class="cs-wbt"><button class="cs-btn cs-go" data-action="mall-pay" ${poor ? 'disabled' : ''}>${poor ? '잔고 부족' : '입금 한다'}</button><button class="cs-btn" data-action="mall-pay-close">취소</button></div></div></div></div>`;
}

function cosAsk(ctx: ChatContext, st: ShopState, v: View, mobile: boolean): string {
  const at = mobile ? '' : winStyle(v.win);
  const ufo = siteLogo('cos', 'cs-ufo');
  const chip = st.items.find((x) => x.id === v.chip && !x.sold);
  const orders = liveOrders(ctx.chat.scriptstate, aliveAnchors(ctx.chat));
  const log = st.talk.length
    ? st.talk.map((l) => (l.who === 'me' ? `<div class="q-m q-me"><b>나</b><p>${esc(l.text)}</p></div>` : `<div class="q-m q-op"><b>운영자</b><p>${opText(l.text, st)}</p>${noteCard(st, l.note, v)}${quoteCard(st, l.quote, v, orders)}</div>`)).join('')
    : '<div class="q-m q-op"><b>운영자</b><p>안녕하신가! 무엇을 도울까, 만일 상품을 물어보면 붙여라 그것을 여기에.</p></div>';
  const wait = v.loading === 'talk' ? '<div class="q-m q-op q-wait"><b>운영자</b><p>운영자가 입력하는 중…</p></div>' : '';
  const pickList = v.picking ? `<div class="q-pick">${onShelf(st).map((x) => `<button data-action="mall-chip" data-value="${esc(x.id)}">${esc(x.name)} <b>${won(x.price)}</b></button>`).join('') || '<p>없다 붙일 상품.</p>'}</div>` : '';
  // 상담원: 내 물건 팔기 — 소지품 목록(장착한 것 포함)에서 고른다
  const mine: Item[] = v.selling ? liveItemsOf(readItems(ctx.chat.scriptstate), ctx.chat) : [];
  const sellList = v.selling ? `<div class="q-pick">${mine.map((x) => `<button data-action="mall-sell-pick" data-value="${esc(x.id)}">${esc(x.name)}${Number.isSafeInteger(x.price) ? ` <small>산 값 ${won(x.price!)}</small>` : ''}</button>`).join('') || '<p>팔 만한 소지품이 없다.</p>'}</div>` : '';
  const o = st.sell;
  const offered = !!o && typeof o.price === 'number';
  const sellCard = o ? `<div class="q-card q-sell"><i class="q-th">${itemPic({ name: o.name, icon: o.icon })}</i><span>파는 물건</span><b>${esc(o.name)}</b>${o.paid !== undefined ? `<small>산 값 ${won(o.paid)}</small>` : ''}<em>${offered ? `우리의 값 ${o.first !== undefined ? `<s>${won(o.first)}</s> ` : ''}${won(o.price as number)}` : o.price === null ? '우리는 사지 않는다' : '값을 아직 말하지 않았다'}</em>${offered ? `<button class="cs-btn" data-action="mall-sell"${v.loading ? ' disabled' : ''}>판매</button>` : ''}<button class="q-x" data-action="mall-sell-cancel" aria-label="그만">×</button></div>` : '';
  return `<div class="cs-win cs-askwin" role="dialog" aria-label="운영자에게 질문"${at}><div class="cs-wt"><b>★ 운영자에게 질문 ★ - Netscape</b><button data-action="mall-ask-close" aria-label="닫기">×</button></div>
    <div class="q-hd">${ufo}<div><b>운영자</b><small>● 운영자 여기에 있음, 지금</small></div></div>
    <div class="q-lg" data-chatlog="cos">${log}${wait}</div>${failBox(v, 'q-fail')}${pickList}${sellList}${sellCard}${chip ? `<div class="q-card"><i class="q-th">${pic(chip)}</i><span>붙인 상품</span><button class="cs-ln" data-action="mall-show" data-value="${esc(chip.id)}">${esc(chip.name)} <b>${won(chip.price)}</b></button><button class="q-x" data-action="mall-chip" data-value="" aria-label="상품 떼기">×</button></div>` : ''}
    <div class="q-in"><button class="cs-btn" data-action="mall-pick" aria-pressed="${v.picking}">상품 붙이기</button><button class="cs-btn" data-action="mall-sell-open" aria-pressed="${v.selling}">내 물건 팔기</button><input name="mall-say" data-input="mall-say" data-enter="mall-say" value="${esc(v.input)}" placeholder="${o ? (offered ? '값을 다시 불러 보거나 그냥 팔아라' : '값을 부르거나 그냥 보내라') : '넣어라 질문, 여기에'}" aria-label="질문"${v.loading ? ' disabled' : ''}><button class="cs-btn" data-action="mall-say" data-take="mall-say"${needAttr('mall-say', v.input, !!v.loading || !st.loaded)}>전송</button></div><i class="cs-rs" aria-hidden="true"></i></div>`;
}

function cosHtml(ctx: ChatContext, mobile: boolean): string {
  const site: MallSite = 'cos';
  const v = ui[site];
  const st = readMall(ctx.chat.scriptstate, site, aliveAnchors(ctx.chat));
  const s = mallSettings(ctx.chat.scriptstate, site);
  const bal = balanceOf(ctx, site);
  const list = onShelf(st);
  const rare = s.feature ? list.filter((x) => x.tag === 'rare') : [];
  const sale = s.feature ? list.filter((x) => x.tag === 'sale' && x.was) : [];
  const rest = list.filter((x) => !rare.includes(x) && !sale.includes(x));
  const ufo = siteLogo('cos', 'cs-ufo');
  const pending = liveOrders(ctx.chat.scriptstate, aliveAnchors(ctx.chat)).filter((o) => !o.taken).length;
  const menu = [['', '처음 화면'], ['cart', `장바구니 (${v.cart.length})`], ['orders', `주문 조회${pending ? ` (${pending})` : ''}`]].map(([k, l]) => `<button class="${v.page === k ? 'on' : ''}" data-action="mall-page" data-value="${k}">◈ ${l}</button>`).join('')
    + '<button data-action="mall-ask" data-value="">◈ 운영자에게 질문</button>';
  const note = mallNote(ctx.chat.scriptstate, site);
  const grid = (xs: ShopItem[]) => `<div class="cs-grid">${xs.map((x) => cosCard(x, v)).join('')}</div>`;
  let main: string;
  if (!s.on) main = '<div class="cs-box"><p>지금 영업 아님. (소지품·가계부가 꺼져 있어요)</p></div>';
  else if (v.page === 'cart') main = cosCart(st, v, bal);
  else if (v.page === 'orders') main = cosOrders(ctx, v);
  else if (v.loading === 'shelf' && !list.length) main = '<div class="cs-box cs-wait"><p>우리는 상품을 진열하는 중… <span class="blink">★</span></p></div>';
  else if (!list.length) main = `<div class="cs-box"><p>${st.loaded ? '모든 상품 팔렸다, 밖으로.' : '아직 없다 상품, 진열대에.'}</p><button class="cs-btn" data-action="mall-refresh" ${v.loading ? 'disabled' : ''}>상품 가져오기</button></div>`;
  // 추천·할인·일반 모두 한 격자, 같은 배열 (2026-11-08 사용자: 구획으로 흐트러뜨리지 말 것). 추천·할인은 칸 안 딱지로만
  else main = `<b class="cs-h">◈ 상품 목록 ◈</b>${grid([...rare, ...sale, ...rest])}${v.loading === 'shelf' ? '<p class="cs-wait">새로운 상품을 진열하는 중…</p>' : ''}`;
  const how = `<div class="cs-how"><b>◈ 구매의 방법 ◈</b><br>1. 상품을 장바구니에 담는다 &nbsp; 2. 아래 계좌로 입금한다 &nbsp; 3. 입금이 확인되면 상품은 즉시 간다<br>입금 계좌 : <b>${esc(COS_ACCOUNT)}</b><br><span class="cs-red">※ 환불의 존재는 없다. 반품 또한 그렇다.</span><br>질문이 있으면 <button class="cs-ln" data-action="mall-ask" data-value="">운영자에게 질문</button> 해라.</div>`;
  const head = `<div class="cs-title">${mobile ? '' : ufo} Cosmic Shopping Mall ${mobile ? '' : ufo.replace('cs-ufo', 'cs-ufo cs-flip')}</div><div class="cs-subt">※우주에서 온 굉장한 상품※</div><hr class="cs-rb">
    <div class="cs-mq"><span>☆ 어서 와라 ☆★ 물건을 보겠습니다 ★☆ 입금 확인되면 상품 간다, 즉시 ★☆ 환불 다음 기회 ☆</span></div>
    <div class="cs-wel"><p><span>안녕하신가! 굉장하고 강한 상품, 만일 우리에게 물어보면 우리는 <b>우주 쇼핑몰</b>.</span> <span>모든 상품 <b>진짜</b>, 그러나 사용의 결과 우리의 <b>책임 아님</b>.</span>${note ? '' : ' <span class="blink">NEW!!</span>'}</p>${note ? `<p><span class="cs-op">운영자 :</span> ${opText(note, st)} <span class="blink">NEW!!</span></p>` : ''}</div>`;
  const info = v.info ? `<div class="cs-info" role="status">${esc(v.info)}</div>` : '';
  const side = mobile
    ? `<nav class="cs-top">${menu}</nav>`
    : `<nav class="cs-lf"><div class="cs-lt">★우주 쇼핑몰★</div>${ufo.replace('cs-ufo', 'cs-ufo cs-big')}${menu}<hr class="cs-rb"><div class="cs-cnt">TOTAL <span>${String(st.items.length + st.talk.length + 700).padStart(6, '0')}</span></div><small>800×600 해상도를<br>권장 합니다</small></nav>`;
  return `<main class="ms ms-cos${mobile ? ' ms-m' : ''}"><div class="cs-fr">${side}<div class="cs-mn">${head}${info}${failBox(v, 'cs-fail')}${main}${how}<div class="cs-ft">Copyright ⓒ 1997 Cosmic Shopping Mall. All rights reserved.<br>이 페이지는 <span>Netscape Now!</span> 에서 가장 좋게 보입니다 · 웹 관리자 : 운영자</div></div></div>${v.ask ? cosAsk(ctx, st, v, mobile) : ''}${v.pay ? cosPay(st, v, bal) : ''}</main>`;
}

/* 백일몽 포인트몰 */

function bmCard(it: ShopItem, bal: number, v: View, busy: boolean): string {
  const sale = it.tag === 'sale' && !!it.was && it.was > it.price;
  const poor = it.price > bal;
  const lab = it.tag === 'rare' ? '<span class="bp-lim">이달의 한정</span>' : sale ? '<span class="bp-sale">특가</span>' : '';
  const off = sale ? Math.round((1 - it.price / it.was!) * 100) : 0;
  return `<div class="bp-it${it.tag === 'rare' ? ' bp-rare' : sale ? ' bp-cut' : ''}${v.focus === it.id ? ' on' : ''}" data-item="${esc(it.id)}"><span class="bp-pic">${pic(it)}</span>${lab}
    <b class="bp-nm">${esc(it.name)}</b><p class="bp-ds">${esc(it.desc)}${it.effect ? `<br><i>${esc(it.effect)}</i>` : ''}</p>
    <div class="bp-pr">${sale ? `<s>${pts(it.was!)}</s> ` : ''}${off > 0 ? `<em>${off}%</em> ` : ''}<b>${Math.trunc(it.price).toLocaleString('en-US')}</b> P</div>
    <button class="bp-buy" data-action="mall-buy" data-value="${esc(it.id)}" ${poor || busy ? 'disabled' : ''}>${poor ? '포인트 부족' : '포인트로 구매'}</button></div>`;
}

function bmHtml(ctx: ChatContext, mobile: boolean): string {
  const site: MallSite = 'bm';
  const v = ui[site];
  const st = readMall(ctx.chat.scriptstate, site, aliveAnchors(ctx.chat));
  const s = mallSettings(ctx.chat.scriptstate, site);
  const nick = loggedNick(ctx);
  const bal = balanceOf(ctx, site);
  const list = onShelf(st);
  const gnb = `<div class="bp-gnb"><b>백일몽 사내망</b><span>공지</span><span>포인트몰</span>${mobile ? '' : '<span class="r">보안 등급 C · 외부 반출 금지</span>'}</div>`;
  const me = nick ? `<div class="bp-me"><b>${esc(nick)}</b><div class="bp-pt"><small>보유 포인트</small>${pts(bal)}</div></div>` : '<button class="bp-login" data-action="br-login">로그인</button>';
  const hd = `<div class="bp-hd"><span class="bp-lg">${siteLogo('bm', 'bp-logo')}백일몽 포인트몰<small>임직원 복지</small></span>${me}</div>`;
  let body: string;
  if (!s.on) body = '<div class="bp-box">소지품·가계부가 꺼져 있어 이용할 수 없습니다.</div>';
  else if (!nick) body = '<div class="bp-box bp-need"><b>로그인이 필요합니다</b><p>포인트몰은 임직원 계정으로 로그인한 뒤 이용할 수 있습니다.</p><button class="bp-buy" data-action="br-login">로그인</button></div>';
  else {
    const cats: [string, string][] = [['', '전체'], ...(s.feature ? [['rare', '이달의 한정'], ['sale', '특가']] as [string, string][] : [])];
    const shown = v.page === 'rare' ? list.filter((x) => x.tag === 'rare') : v.page === 'sale' ? list.filter((x) => x.tag === 'sale' && x.was) : list;
    const desk = deskSettings(ctx.chat.scriptstate).on ? `<button class="bp-desk${v.ask ? ' on' : ''}" data-action="mall-ask" data-value="" aria-pressed="${v.ask}">1:1 상담</button>` : '';
    const side = `<nav class="bp-side${mobile ? ' m' : ''}">${cats.map(([k, l]) => `<button class="${v.page === k ? 'on' : ''}" data-action="mall-page" data-value="${k}" aria-pressed="${v.page === k}">${l}</button>`).join('')}${desk}</nav>`;
    const note = mallNote(ctx.chat.scriptstate, site);
    const banner = `<div class="bp-ban">포인트는 현금으로 바꿀 수 없으며, 이 몰에서만 쓸 수 있습니다.${note ? `<br>${esc(note)}` : ''}</div>`;
    const info = v.info ? `<div class="bp-info" role="status">${esc(v.info)}</div>` : '';
    const grid = v.loading === 'shelf' && !list.length ? '<div class="bp-box">상품을 불러오는 중입니다…</div>'
      : !list.length ? `<div class="bp-box"><p>${st.loaded ? '모든 상품이 품절되었습니다.' : '등록된 상품이 없습니다.'}</p><button class="bp-buy" data-action="mall-refresh" ${v.loading ? 'disabled' : ''}>상품 불러오기</button></div>`
      : `<div class="bp-grid">${shown.map((x) => bmCard(x, bal, v, !!v.loading)).join('') || '<p class="bp-none">이 분류에는 상품이 없습니다.</p>'}</div>`;
    body = `<div class="bp-wrap">${side}<div class="bp-main">${banner}${info}${failBox(v, 'bp-fail')}<h2>${v.page === 'rare' ? '이달의 한정' : v.page === 'sale' ? '특가' : '전체 상품'}${v.loading === 'shelf' && list.length ? ' <small>새 상품을 불러오는 중…</small>' : ''}</h2>${grid}</div></div>`;
  }
  const deskWin = v.ask && s.on && nick && deskSettings(ctx.chat.scriptstate).on ? bmDesk(ctx, v, mobile) : '';
  return `<main class="ms ms-bm${mobile ? ' ms-m' : ''}">${gnb}${hd}${body}${deskWin}</main>`;
}

/** 1:1 상담 창: 포인트몰 톤(남색·금색·흰 바탕)의 사내 메신저. 위에 사원증 이름표, 연결 안내는 회색 줄, 내 말 남색·상담사 말 연회색 */
function bmDesk(ctx: ChatContext, v: View, mobile: boolean): string {
  const d = readDesk(ctx.chat.scriptstate);
  const a = d.agent;
  const at = mobile ? '' : winStyle(v.win);
  const busy = !!v.dl;
  const badge = a
    ? `<div class="bd-badge"><i aria-hidden="true">${esc(deskTag(a).slice(-2))}</i><div><small>백일몽 포인트몰</small><b>${esc(deskTag(a))}</b><span>임직원 복지 상담</span></div></div>`
    : `<div class="bd-badge bd-wait"><i aria-hidden="true">…</i><div><small>백일몽 주식회사</small><b>${v.dl === 'make' ? '상담원 연결 중…' : '연결된 상담원 없음'}</b></div></div>`;
  const line = (l: { who: string; text: string }) => (l.who === 'sys'
    ? `<div class="bd-sys">${esc(l.text)}</div>`
    : l.who === 'me' ? `<div class="bd-m bd-me"><p>${esc(l.text)}</p></div>` : `<div class="bd-m bd-op"><small>${esc(a ? deskTag(a) : '상담원')}</small><p>${esc(l.text)}</p></div>`);
  const wait = v.dl === 'make' ? '<div class="bd-sys">상담원을 연결하고 있습니다…</div>' : v.dl === 'talk' ? `<div class="bd-m bd-op bd-typing"><small>${esc(a ? deskTag(a) : '상담원')}</small><p>입력 중…</p></div>` : '';
  const log = `${d.talk.map(line).join('')}${wait}`;
  const tools = `<div class="bd-tools"><button data-action="mall-desk-next"${busy ? ' disabled' : ''}>다른 상담사 연결</button><button data-action="mall-desk-end"${busy || !a ? ' disabled' : ''}>상담 종료</button></div>`;
  return `<div class="bd-win" role="dialog" aria-label="1:1 상담"${at}><div class="bd-wt"><b>1:1 상담</b><span>백일몽 포인트몰</span><button data-action="mall-ask-close" aria-label="닫기">×</button></div>
    <div class="bd-hd">${badge}${tools}</div>
    <div class="bd-lg"><div>${log}</div></div>${failBox(v, 'bp-fail bd-fail')}
    <div class="bd-in"><input name="mall-say" data-input="mall-say" data-enter="mall-say" value="${esc(v.input)}" placeholder="${a ? '메시지를 입력하세요' : '상담사가 연결되면 입력할 수 있습니다'}" aria-label="메시지"${busy || !a ? ' disabled' : ''}><button class="bp-buy" data-action="mall-say" data-take="mall-say"${needAttr('mall-say', v.input, busy || !a)}>전송</button></div>${mobile ? '' : '<i class="bd-rs" aria-hidden="true"></i>'}</div>`;
}

/** 브라우저 탭 화면 */
export function mallTab(ctx: ChatContext, env: MallEnv, site: MallSite): string {
  sync(ctx);
  void env;
  const mobile = isPhone();
  return site === 'cos' ? cosHtml(ctx, mobile) : bmHtml(ctx, mobile);
}

// ── 설정 페이지 (2026-11-08 사용자: 사이트마다 값 따로. 상점 설정 쪽 항목, 우주몰만 문의) ──

const row = setRow;
const group = (title: string, rows: string) => setGroup(title, rows);
function mseg(site: MallSite, key: string, cur: string, items: [string, string][]): string {
  const sw = onOffSwitch(items, cur, 'ms-cfg', (v) => `${site}:${key}=${v}`);
  if (sw) return sw;
  return `<div class="gx-segs gx-segs-sm">${items.map(([v, l]) => `<button class="gx-seg${cur === v ? ' on' : ''}" data-action="ms-cfg" data-value="${site}:${key}=${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
}
/** 상점 설정 이름 (사이트 앞붙이 없이) */
const MS_KEY: Record<string, string> = { model: '$sh_model', ctx: '$sh_ctx', feature: '$sh_feature', price: '$sh_price', diverse: '$sh_diverse', thoughts: '$sh_thoughts', prev: '$sh_prev', min: '$sh_min', max: '$sh_max', turns: '$sh_turns', refs: '$sh_refs' };
const MS_RANGE: Record<string, [number, number]> = { min: [SHOP_SIZE_LO, SHOP_SIZE_HI], max: [SHOP_SIZE_LO, SHOP_SIZE_HI], turns: [1, 8], refs: [0, 12] };

export function mallSettingsPane(ctx: ChatContext, site: MallSite): string {
  const s = mallSettings(ctx.chat.scriptstate, site);
  const name = MALL_NAME[site];
  const blocked = s.on ? '' : `<p class="gx-hint">소지품이나 가계부가 꺼져 있어 ${name}을 쓸 수 없어요. 산 물건은 소지품에, 돈은 가계부로 오가서 둘 다 켜져 있어야 해요.</p>`;
  // 자동 호출·모델·상품 수·구획·값 기준과 상점 넷이 같이 쓰는 값은 설정 → 상점에 있다 (ui/famtable.ts shopTable)
  const rows = `${blocked}${cosRollGroup(ctx, site)}${site === 'cos' ? cosReadyGroup(ctx) + cosTruthGroup(ctx) + cosFixedGroup(ctx) : deskGroup(ctx)}`;
  return `<div class="ph-form"><header class="ph-room-head"><div class="ph-room-title"><b>${name} 설정</b></div></header><div class="ph-form-body ps">${rows}</div></div>`;
}

/** 진열 배정 (11-09 사용자: 하드코딩 말고 전부 설정에서 · 추첨 방식도 보이고 고치게 · 포인트몰에도 같은 틀, 켜고 끄기 따로) */
function cosRollGroup(ctx: ChatContext, site: MallSite): string {
  const vars = ctx.chat.scriptstate;
  const r = mallRoll(vars, site);
  const s = mallSettings(vars, site);
  const K = rollKeys(site);
  const D = rollDefaults(site);
  const bm = site === 'bm';
  const reset = rollChanged(vars, site) ? `<div class="ps-row gw-rel-foot"><button class="gx-mini" data-action="ms-roll-reset" data-value="${site}">기본값으로</button></div>` : '';
  const gSet = String(vars?.[K.genres] ?? '') !== '';
  const tSet = String(vars?.[K.tiers] ?? '') !== '';
  // 지금 설정으로 한 번 뽑아 본 예 (열 때마다 달라짐)
  const n = Math.round((s.size[0] + s.size[1]) / 2);
  const money = (x: CosTier) => (bm ? `${x.lo.toLocaleString('ko-KR')}~${x.hi.toLocaleString('ko-KR')}p` : `₩${x.lo.toLocaleString('ko-KR')}~${x.hi.toLocaleString('ko-KR')}`);
  const sample = r.on ? cosDraw(n, s.context, r).map((x, i) => `<li><b>${i + 1}칸</b> ${esc(x.genre)} · ${esc(x.tier.name)} ${money(x.tier)}${x.useful ? ' · <i>상황용</i>' : ''}</li>`).join('') : '';
  const word = bm ? '분류' : '장르';
  const how = `<p class="ps-note">새로 받을 때마다 코드가 ① 칸 수만큼 ${word}를 뽑고 ② 칸마다 값 등급을 뽑고 ③ 상황용 칸을 정한 뒤, 요청문에 「Item n — ${bm ? 'CATEGORY' : 'GENRE'} · VALUE TIER · ROLE」로 적어요. 모델은 그 칸에 맞는 물건만 짓고, ${word}·등급을 바꾸지 못해요.${bm ? ' 로어북의 가격 예시 물건을 그대로 되풀이하기 어렵게 하는 장치예요.' : ''}</p>`;
  const tierHelp = bm ? `한 줄에 「이름|설명(영어)|하한|상한|가중치」(포인트). 가중치는 뽑힐 비율(비우면 1, 0이면 안 뽑혀요). 비우면 기본 5단계(30~9,999p, 싼 쪽에 가중치).` : '한 줄에 「이름|설명(영어)|하한|상한|가중치」. 가중치는 뽑힐 비율(비우면 1, 0이면 안 뽑혀요). 비우면 기본 5단계(₩999,999~49,999,999, 모두 1).';
  return group('진열 배정', how + [
    row('사용', mseg(site, 'roll_on', r.on ? '1' : '0', [['1', 'ON'], ['0', 'OFF']]), '끄면 배정 없이 모델이 알아서 골라요(같은 물건이 되풀이될 수 있어요).'),
    row(`${word} 목록`, `<textarea class="gx-search ms-area" rows="3" data-change="ms-roll" data-key="${site}:genres" placeholder="${esc(genresText(D.genres))}">${esc(gSet ? genresText(r.genres) : '')}</textarea>`, `쉼표로 나눠요. 비우면 기본 ${D.genres.length}종(회색 글).`),
    row(`${word} 뽑기`, mseg(site, 'roll_gmode', r.gmode, [['uniq', '칸마다 다르게'], ['any', '겹쳐도 됨'], ['one', `한 ${word}로`]]), r.gmode === 'uniq' ? '목록을 섞어 앞에서부터 한 칸에 하나씩. 칸이 목록보다 많으면 처음부터 다시.' : r.gmode === 'any' ? `칸마다 따로 무작위. 같은 ${word}가 여러 칸에 나올 수 있어요.` : `한 판에 ${word} 하나를 뽑아 모든 칸에 같이 써요(기획전처럼).`),
    row('값 등급', `<textarea class="gx-search ms-area" rows="5" data-change="ms-roll" data-key="${site}:tiers" placeholder="${esc(tiersText(D.tiers))}">${esc(tSet ? tiersText(r.tiers) : '')}</textarea>`, tierHelp),
    row('등급 뽑기', mseg(site, 'roll_tmode', r.tmode, [['weight', '가중치대로'], ['even', '골고루'], ['same', '한 등급으로']]), r.tmode === 'weight' ? '칸마다 따로, 가중치 비율대로 뽑아요. 같은 등급이 몰릴 수 있어요.' : r.tmode === 'even' ? '등급을 칸에 순서대로 고르게 나눈 뒤 자리를 섞어요. 가중치는 안 봐요.' : '한 판에 등급 하나를 가중치대로 뽑아 모든 칸에 같이 써요.'),
    row('상황용 칸', mseg(site, 'roll_useful', r.useful, [['auto', '자동'], ['0', '없음'], ['1', '1칸'], ['2', '2칸']]), '「지금 상황에 쓸모 있는 것」으로 배정할 칸 수. 자동 = 컨텍스트에 포함이 켜져 있고 3칸 이상이면 1~2칸(6칸 이상). 어느 칸인지는 무작위.'),
    r.on ? row('뽑기 예', `<ul class="ms-sample">${sample}</ul>`, `지금 설정으로 ${n}칸을 한 번 뽑아 본 거예요. 열 때마다 달라져요.`) : '',
  ].join('') + reset);
}

/** 포인트몰 1:1 상담 (11-09 사용자: 상담마다 다른 백일몽 직원. 주사위 칸·다시 만나기·겹치지 않기는 설정에서, 말투·업무 지침은 지침 「포인트몰 1:1 상담」에서) */
function deskGroup(ctx: ChatContext): string {
  const d = deskSettings(ctx.chat.scriptstate);
  const how = '<p class="ps-note">상담을 열 때마다 코드가 아래 칸마다 값을 하나씩 뽑고, 모델이 그 값으로 상담사(이름·직급·부서·소개·말투)를 한 번 만들어 둬요. 대화하는 동안은 그 카드를 매번 같이 보내서 사람이 바뀌지 않아요. 본편이 넘어가거나 「상담 종료」·「다른 상담사 연결」을 누르면 다음엔 새 상담사예요. 업무 지침과 말 규칙은 설정 → 지침 → 포인트몰 1:1 상담에서 고쳐요.</p>';
  const reset = d.axesText ? `<div class="ps-row gw-rel-foot"><button class="gx-mini" data-action="ms-desk-reset">기본값으로</button></div>` : '';
  return group('1:1 상담', how + [
    row('사용', mseg('bm', 'desk_on', d.on ? '1' : '0', [['1', 'ON'], ['0', 'OFF']]), '끄면 왼쪽 메뉴에 「1:1 상담」이 안 보여요.'),
    row('상담사 주사위 칸', `<textarea class="gx-search ms-area" rows="7" data-change="ms-desk" data-key="axes" placeholder="${esc(DESK_AXES_DEFAULT)}">${esc(d.axesText)}</textarea>`, '한 줄에 「칸 이름: 값, 값, …」. 칸마다 하나씩 뽑아요. 같은 값을 여러 번 적으면 그만큼 잘 뽑혀요. 비우면 기본 칸(회색 글).'),
    row('지난 상담사 다시 만나기', mseg('bm', 'desk_again', d.again ? '1' : '0', [['1', 'ON'], ['0', 'OFF']]), '켜면 가끔(4번에 1번꼴) 전에 만났던 상담사가 다시 연결돼요.'),
    row('겹치지 않게 넘길 수', `<div class="st-step"><button class="gx-step" data-action="ms-desk-step" data-value="-" ${d.avoid > DESK_AVOID_RANGE[0] ? '' : 'disabled'} aria-label="줄이기">−</button><b>${d.avoid}명</b><button class="gx-step" data-action="ms-desk-step" data-value="+" ${d.avoid < DESK_AVOID_RANGE[1] ? '' : 'disabled'} aria-label="늘리기">+</button></div>`, '새 상담사를 만들 때 최근 상담사 몇 명의 요약을 같이 넘겨 「이들과 겹치지 마라」고 해요(0~12).'),
  ].join('') + reset);
}

/** 맞춤 주문 완성 알림 (11-11 사용자) */
function cosReadyGroup(ctx: ChatContext): string {
  const m = cosReadyMode(ctx.chat.scriptstate);
  return group('맞춤 주문', row('완성 알림', mseg('cos', 'ready', m, [['both', '카드 + 본편'], ['card', '카드만'], ['off', '사용 안 함']]),
    m === 'both' ? '완성된 턴의 상태창 아래에 「받으러 가기」 카드가 뜨고, 다음 턴 본편에 완성 사실을 한 번 넘겨요.' : m === 'card' ? '채팅에 카드만 떠요. 본편 모델은 완성된 줄 몰라요.' : '알리지 않아요. 사이트의 「주문 조회」에서만 보여요.'));
}

/** 진짜 효과 (11-09 사용자: 보이는 효과는 광고 문구, 진짜는 숨김 · 미리 정한 것과 「아무도 모름」을 섞음) */
function cosTruthGroup(ctx: ChatContext): string {
  const m = cosTruthMode(ctx.chat.scriptstate);
  return group('진짜 효과', `<p class="ps-note">우주몰 물건의 「효과」는 화면에 보이는 광고 문구예요(모호·검열·거짓·뚱딴지·가끔 진실). 진짜 효과는 어디에도 안 보이고 본편 모델만 받아요. 쓸 때 실제로 일어나는 일은 진짜 쪽이에요.</p>` + row('진실 미리 정하기', mseg('cos', 'truth', m, [['all', '전부'], ['mix', '섞음'], ['none', '안 함']]),
    m === 'all' ? '우주몰 모델이 물건마다 진짜 효과를 미리 정해 숨겨 둬요. 쓸 때마다 같은 결과.' : m === 'mix' ? '절반쯤은 미리 정해 숨기고, 나머지는 「아무도 모름」으로 둬서 처음 쓸 때 본편 모델이 정해요.' : '전부 「아무도 모름」. 처음 쓸 때 본편 모델이 그 자리에서 정해요.'));
}

/** 시그니처 상품 (11-09 사용자: 구버전 「우리가 도움!」·「착한 친구」를 직접 넣고 고치게) */
function cosFixedGroup(ctx: ChatContext): string {
  const vars = ctx.chat.scriptstate;
  const list = cosFixed(vars);
  const num = (id: string, key: string, v: number | undefined, ph: string, label: string, max = 1_000_000_000_000) =>
    `<input class="gx-search ms-num" type="number" min="0" max="${max}" data-change="ms-fx" data-key="${id}:${key}" value="${v ?? ''}" placeholder="${ph}" aria-label="${esc(label)}">`;
  const text = (id: string, key: string, v: string, ph: string, label: string, len: number) =>
    `<input class="gx-search" data-change="ms-fx" data-key="${id}:${key}" value="${esc(v)}" maxlength="${len}" placeholder="${ph}" aria-label="${esc(label)}">`;
  const items = list.map((f) => `<div class="ms-fx${f.on ? '' : ' off'}">
      <div class="ms-fx-head">${text(f.id, 'name', f.name, '상품 이름', '이름', 40)}<span class="ph-inline"><span>확률</span>${num(f.id, 'pct', f.pct, '25', '확률', 100)}<span>%</span></span>${mseg('cos', `fx_on:${f.id}`, f.on ? '1' : '0', [['1', 'ON'], ['0', 'OFF']])}<button class="gx-mini danger" data-action="ms-fx-del" data-value="${esc(f.id)}" aria-label="지우기">×</button></div>
      <div class="ms-fx-row"><span class="ph-inline"><span>값</span>${num(f.id, 'price', f.price, '999999', '값')}<span>원</span></span><span class="ph-inline"><span>할인 전</span>${num(f.id, 'was', f.was, '비우면 할인 없음', '할인 전 값')}<span>원</span></span></div>
      <div class="ms-fx-row"><span class="ph-inline ms-fx-wide"><span>설명</span>${text(f.id, 'desc', f.desc, '겉보기 설명 (???·검열됨처럼 숨겨도 돼요)', '설명', 200)}</span></div>
      <div class="ms-fx-row"><span class="ph-inline ms-fx-wide"><span>효과</span>${text(f.id, 'effect', f.effect, '화면에 보이는 광고 문구 (모호·검열·거짓·뚱딴지…)', '보이는 효과', 200)}</span></div>
      <div class="ms-fx-row"><span class="ph-inline ms-fx-wide"><span>진실</span>${text(f.id, 'truth', f.truth, '숨긴 진짜 효과 — 본편 모델만 봐요. 비우면 「아무도 모름」', '진짜 효과', 200)}</span></div>
    </div>`).join('');
  const foot = `<div class="ps-row gw-rel-foot"><button class="gx-mini primary" data-action="ms-fx-add" ${list.length >= COS_FIXED_MAX ? 'disabled' : ''}>상품 추가</button></div>`;
  return group('시그니처 상품', `<p class="ps-note">모델이 아니라 코드가 새로고침마다 확률대로 끼워 넣는 상품이에요. 모델에게는 이름을 알리지 않고, 모델이 같은 이름을 내면 버려요. 이미 진열돼 있거나 산 것은 다시 안 넣어요. 다 지우면 안 써요. 「효과」는 화면에 보이는 광고 문구이고 「진실」은 숨긴 진짜 효과예요.</p>${items || '<p class="ps-note">없음.</p>'}${foot}`);
}

/** 설정 값 바꾸기: ms-cfg 「사이트:키=값」 · ms-step 「사이트:키:±」 · ms-num 「사이트:키=숫자」(상품 수) · ms-text (값 기준) */
export async function mallSettingsAction(action: string, value: string | undefined, ctx: ChatContext, env: MallEnv): Promise<boolean> {
  if (await deskSettingsAction(action, value, ctx, env)) return true;
  if (await cosExtraAction(action, value, ctx, env)) return true;
  if (action !== 'ms-cfg' && action !== 'ms-step' && action !== 'ms-text' && action !== 'ms-num') return false;
  let site = '';
  let k = '';
  let v = '';
  if (action === 'ms-cfg' || action === 'ms-text') [, site, k, v] = /^(\w+):(\w+)=([\s\S]*)$/.exec(value ?? '') ?? [];
  if (action === 'ms-text') v = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  else if (action === 'ms-num') {
    [, site, k, v] = /^(\w+):(\w+)=(.*)$/.exec(value ?? '') ?? [];
    const n = Math.floor(Number(v));
    const r = MS_RANGE[k];
    if (!r || !Number.isFinite(n) || String(v).trim() === '') return env.render(), true;
    v = String(Math.max(r[0], Math.min(r[1], n)));
  }
  else if (action === 'ms-step') {
    const m = /^(\w+):(\w+):([+-])$/.exec(value ?? '');
    if (!m) return true;
    [, site, k] = m;
    const s = mallSettings(ctx.chat.scriptstate, site as MallSite);
    const cur = k === 'min' ? s.size[0] : k === 'max' ? s.size[1] : k === 'turns' ? s.turns : s.refs;
    const [lo, hi] = MS_RANGE[k] ?? [0, 0];
    v = String(Math.max(lo, Math.min(hi, cur + (m[3] === '+' ? 1 : -1))));
  }
  if (site !== 'cos' && site !== 'bm') return true;
  const varName = k === 'auto' ? mallAutoKey(site) : MS_KEY[k] ? mallKey(MS_KEY[k], site) : '';
  if (!varName) return true;
  const extra: Record<string, string> = {};
  // 최소가 최대를 넘으면 같이 맞춘다
  if ((action === 'ms-step' || action === 'ms-num') && (k === 'min' || k === 'max')) {
    const s = mallSettings(ctx.chat.scriptstate, site);
    const n = Number(v);
    if (k === 'min' && n > s.size[1]) extra[mallKey('$sh_max', site)] = v;
    if (k === 'max' && n < s.size[0]) extra[mallKey('$sh_min', site)] = v;
  }
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => (String(chat.scriptstate?.[varName] ?? '') === v && !Object.keys(extra).length ? null : { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [varName]: v, ...extra } }));
  await env.refresh();
  return true;
}

/** 1:1 상담 설정: ms-cfg 「bm:desk_on=1」·「bm:desk_again=1」 · ms-desk 「axes=글」 · ms-desk-step ± · ms-desk-reset */
async function deskSettingsAction(action: string, value: string | undefined, ctx: ChatContext, env: MallEnv): Promise<boolean> {
  const set = async (vars: Record<string, string>) => {
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...vars } }));
    await env.refresh();
    return true;
  };
  if (action === 'ms-cfg') {
    const m = /^bm:(desk_on|desk_again)=([01])$/.exec(value ?? '');
    if (!m) return false;
    return m[1] === 'desk_on' ? set({ [DESK_KEY.on]: m[2] === '0' ? '0' : '' }) : set({ [DESK_KEY.again]: m[2] === '1' ? '1' : '' });
  }
  if (action === 'ms-desk') {
    const m = /^axes=([\s\S]*)$/.exec(value ?? '');
    return m ? set({ [DESK_KEY.axes]: m[1].trim().slice(0, 4000) }) : true;
  }
  if (action === 'ms-desk-step') {
    const d = deskSettings(ctx.chat.scriptstate);
    const n = Math.max(DESK_AVOID_RANGE[0], Math.min(DESK_AVOID_RANGE[1], d.avoid + (value === '+' ? 1 : -1)));
    return set({ [DESK_KEY.avoid]: String(n) });
  }
  if (action === 'ms-desk-reset') return set({ [DESK_KEY.axes]: '' });
  return false;
}

/** 질문 창이 떠 있나 (Esc 처리용) */
/** 지금 보는 몰의 질문·상담 창이 떠 있나 (릴리스 점검 11-09: 다른 탭으로 옮긴 몰의 창이 남아 Esc 를 먹었다) */
export const mallAskOpen = (site?: string): boolean => (site === 'cos' || site === 'bm' ? ui[site].ask : false);

/** 우주 쇼핑몰 질문 창을 진짜 팝업창처럼 (11-09 사용자): 제목줄 끌어 옮기기, 오른쪽 아래 모서리로 크기 조절, 창 밖을 누르면 닫힘 (ui/popwin.ts 공통) */
export const mallWinSpec: PopSpec = {
  host: '.ms-cos',
  skip: 'ms-m',
  win: '.cs-askwin',
  grip: '.cs-wt',
  size: '.cs-rs',
  keep: '[data-action="mall-ask"], .cs-dim',
  min: [300, 240],
  isOpen: () => ui.cos.ask,
  close: () => {
    ui.cos.ask = false;
    ui.cos.picking = false;
  },
  save: (b) => {
    ui.cos.win = b;
  },
};

/** 포인트몰 1:1 상담 창도 같은 팝업 (11-09 사용자: 우주몰처럼 끌어 옮기고 닫을 수 있게) */
export const bmDeskWinSpec: PopSpec = {
  host: '.ms-bm',
  skip: 'ms-m',
  win: '.bd-win',
  grip: '.bd-wt',
  size: '.bd-rs',
  keep: '[data-action="mall-ask"]',
  min: [300, 260],
  isOpen: () => ui.bm.ask,
  close: () => {
    ui.bm.ask = false;
  },
  save: (b) => {
    ui.bm.win = b;
  },
};

/** 진열 배정·시그니처 상품 설정 (우주몰만). ms-cfg 「cos:roll_on=1」·「cos:roll_useful=auto」·「cos:fx_on:ID=1」 · ms-roll 「genres=글」 · ms-fx 「ID:키=값」 · ms-fx-add/del · ms-roll-reset */
async function cosExtraAction(action: string, value: string | undefined, ctx: ChatContext, env: MallEnv): Promise<boolean> {
  const set = async (vars: Record<string, string>) => {
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...vars } }));
    await env.refresh();
    return true;
  };
  const list = () => cosFixed(ctx.chat.scriptstate);
  if (action === 'ms-cfg') {
    const m = /^(cos|bm):(roll_on|roll_useful|roll_gmode|roll_tmode|truth|ready|fx_on:\w+)=([\s\S]*)$/.exec(value ?? '');
    if (!m) return false;
    const K = rollKeys(m[1] as MallSite);
    if (m[2] === 'roll_on') return set({ [K.on]: m[3] === '0' ? '0' : '' });
    if (m[2] === 'roll_useful') return set({ [K.useful]: m[3] === 'auto' ? '' : m[3] });
    if (m[2] === 'roll_gmode') return set({ [K.gmode]: m[3] === 'uniq' ? '' : m[3] });
    if (m[2] === 'roll_tmode') return set({ [K.tmode]: m[3] === 'weight' ? '' : m[3] });
    m.splice(1, 1); // 아래는 우주몰 전용 (truth·fx_on)
    if (m[1] === 'ready') {
      // 설정을 바꾸면 채팅의 완성 표식도 바로 맞춘다 (끄면 카드가 사라지고 켜면 다시 붙는다)
      await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
        const next = { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [COS_READY_KEY]: m[2] === 'both' ? '' : m[2] } };
        const message = settleReady(next, cosReadyMode(next.scriptstate) !== 'off');
        return message ? { ...next, message } : next;
      });
      await env.refresh();
      return true;
    }
    if (m[1] === 'truth') return set({ [COS_TRUTH_KEY]: m[2] === 'mix' ? '' : m[2] });
    const id = m[1].slice(6);
    return set(cosFixedVars(list().map((f) => (f.id === id ? { ...f, on: m[2] === '1' } : f))));
  }
  if (action === 'ms-roll') {
    const m = /^(?:(cos|bm):)?(genres|tiers)=([\s\S]*)$/.exec(value ?? '');
    if (!m) return true;
    const K = rollKeys((m[1] ?? 'cos') as MallSite);
    return set({ [m[2] === 'genres' ? K.genres : K.tiers]: m[3].trim().slice(0, 4000) });
  }
  if (action === 'ms-roll-reset') return set(Object.fromEntries(Object.values(rollKeys(value === 'bm' ? 'bm' : 'cos')).map((k) => [k, ''])));
  if (action === 'ms-fx') {
    const m = /^(\w+):(name|pct|price|was|desc|effect|truth)=([\s\S]*)$/.exec(value ?? '');
    if (!m) return true;
    const [, id, k, v] = m;
    return set(cosFixedVars(list().map((f) => {
      if (f.id !== id) return f;
      if (k === 'name' || k === 'desc' || k === 'effect' || k === 'truth') return { ...f, [k]: v.replace(/\s+/g, ' ').trim() };
      const n = Math.trunc(Number(v));
      if (k === 'was') { const { was: _w, ...rest } = f; return Number.isFinite(n) && n > 0 ? { ...rest, was: n } : rest; }
      if (!Number.isFinite(n) || v.trim() === '') return f;
      return { ...f, [k]: k === 'pct' ? Math.max(0, Math.min(100, n)) : Math.max(0, n) };
    })));
  }
  if (action === 'ms-fx-add') { const cur = list(); return cur.length >= COS_FIXED_MAX ? true : set(cosFixedVars([...cur, newCosFixed()])); }
  if (action === 'ms-fx-del') return set(cosFixedVars(list().filter((f) => f.id !== value)));
  return false;
}
