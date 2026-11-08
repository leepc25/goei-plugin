// 인터넷 쇼핑몰 화면 (2026-11-08 사용자, 시안 /mnt/project-files/작업_1108/브라우저_시안3/ pc_08_cos·pc_09_bm·pc_13_cos_ask).
// 우주 쇼핑몰: 1990년대 개인 홈페이지, 왈도체. 장바구니 → 주문하기 → 입금 창(계좌) → 이체(가계부에서 빠짐) → 소지품. 돌려주는 것 없음.
//   운영자에게 질문: 넷스케이프 팝업. 상품 화면에서 열면 그 물건이 붙고, 다른 곳은 [물건을 붙인다]. 운영자 답에 물건 이름이 있으면 링크로.
// 백일몽 포인트몰: 사내 쇼핑몰, 운영자 없음(문의·흥정 X), 로그인해야 씀, 정가로 포인트 구매.
// 진열·문의 요청문은 상점(core/shop.ts)과 같고, 지침·설정만 사이트 것(core/malls.ts).
import type { ChatContext } from '../host/risu';
import { updateChat } from '../host/risu';
import { generate } from '../host/llm';
import { genSettings } from '../core/advanced';
import { addWalletEntry, aliveAnchors, formatWon, readWallet, walletBalance, walletVars, WALLET_START_DEFAULT } from '../core/wallet';
import { pointsVars, readPoints } from '../core/points';
import { addItem, itemsVars, readItems } from '../core/items';
import { getPrefs } from '../core/settings';
import { applyShelf, applyTalk, lastBot, markSold, parseShelf, parseTalk, sayToOwner, shelfItems, shelfPrompt, talkPrompt, type ShopItem, type ShopState } from '../core/shop';
import { COS_ACCOUNT, MALL_GUIDE, MALL_NAME, mallAutoKey, mallKey, mallNote, mallNoteKey, mallSettings, mallVars, mallVarsOf, readMall, type MallSite } from '../core/malls';
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
  /** 운영자에게 질문 창 */
  ask: boolean;
  /** 질문에 붙인 물건 id */
  chip: string;
  /** 붙일 물건 고르기 */
  picking: boolean;
  input: string;
  /** 링크로 찾아간 물건 (테두리·스크롤) */
  focus: string;
}
const fresh = (): View => ({ loading: '', notice: '', failRaw: '', info: '', cart: [], page: '', pay: false, ask: false, chip: '', picking: false, input: '', focus: '' });
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
async function ask(ctx: ChatContext, env: MallEnv, site: MallSite, kind: 'shelf' | 'talk', st0: ShopState): Promise<void> {
  const job = `${chatKey(ctx)}:${site}`;
  if (jobs.has(job)) return;
  jobs.add(job);
  const v = ui[site];
  const s = mallSettings(ctx.chat.scriptstate, site);
  v.loading = kind;
  v.notice = '';
  v.failRaw = '';
  env.render();
  try {
    const src = shopSource({ ...ctx, chat: { ...ctx.chat, scriptstate: mallVars(ctx.chat.scriptstate, site) as typeof ctx.chat.scriptstate } }, st0, s);
    const g = genSettings(ctx.chat.scriptstate);
    const opts = { retries: g.retries, retryModel: g.retryModel, concurrent: g.concurrent, state: ctx.chat.scriptstate, label: `${MALL_NAME[site]} ${kind === 'shelf' ? '진열' : '문의'}` };
    let next: ShopState;
    let note: string | null = null;
    if (kind === 'shelf') {
      const { value } = await generate(shelfPrompt(src, s, MALL_GUIDE[site]), s.model, (raw) => parseShelf(raw, st0.loaded ? st0.identity : null), opts);
      const applied = applyShelf(st0, value, s);
      // 진열대와 같이 온 한마디는 문의 대화가 아니라 첫 화면 글로
      note = value.owner ?? '';
      next = { ...applied, talk: st0.talk };
    } else {
      const { value } = await generate(talkPrompt(src, s, MALL_GUIDE[site]), s.model, parseTalk, opts);
      next = applyTalk(st0, value, false);
    }
    if (site === 'bm') next = { ...next, identity: { ...next.identity, points: true } };
    const cur = env.current();
    if (!cur || chatKey(cur) !== chatKey(ctx)) return;
    const key = lastBot(cur.chat)?.key ?? '';
    await updateChat(cur.charIndex, cur.chatIndex, (chat) => ({
      ...chat,
      scriptstate: { ...(chat.scriptstate ?? {}), ...mallVarsOf(site, { ...next, key }), ...(note !== null ? { [mallNoteKey(site)]: note, [atKey(site)]: key } : {}) },
    }));
    // 장바구니에서 진열대에 없는 물건은 뺀다
    v.cart = v.cart.filter((id) => shelfItems(next).some((x) => x.id === id));
  } catch (error) {
    v.notice = error instanceof Error ? error.message : String(error);
    v.failRaw = String((error as { raw?: string }).raw ?? '');
    if (kind === 'talk') {
      // 내 말은 적어 뒀으니 답이 안 왔으면 되돌린다
      const cur = env.current();
      if (cur && chatKey(cur) === chatKey(ctx)) {
        await updateChat(cur.charIndex, cur.chatIndex, (chat) => {
          const now = readMall(chat.scriptstate, site);
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
  const st = readMall(ctx.chat.scriptstate, site);
  const key = lastBot(ctx.chat)?.key ?? '';
  if (st.loaded && String(ctx.chat.scriptstate?.[atKey(site)] ?? '') === key) return;
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
  const key = lastBot(ctx.chat)?.key ?? '';
  if (String(ctx.chat.scriptstate?.[atKey(site)] ?? '') === key) return;
  await ask(ctx, env, site, 'shelf', readMall(ctx.chat.scriptstate, site));
}

// ── 사기 ──

/** 물건들을 산다: 가계부(우주몰 원·포인트몰 포인트)에서 빼고 소지품에 넣고 진열대에서 뺀다. 모자라면 하나도 안 산다 */
async function buy(ctx: ChatContext, site: MallSite, ids: string[]): Promise<ShopItem[] | null> {
  const start = getPrefs().walletStart ?? WALLET_START_DEFAULT;
  let got: ShopItem[] | null = null;
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const now = readMall(chat.scriptstate, site);
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
      const walletId = it.price > 0 ? `${site}_${it.id}` : '';
      if (walletId) w = addWalletEntry(w, { id: walletId, anchor, amount: -it.price, memo: `${it.name} (${MALL_NAME[site]})`, src: 'store' });
      const paid = p ? { paidWith: `${it.price.toLocaleString('en-US')} Baekilmong points at ${MALL_NAME[site]}` } : { price: it.price, ...(walletId ? { walletId } : {}), paidWith: `bank transfer to ${MALL_NAME[site]}` };
      items = addItem(items, alive, { name: it.name, desc: it.desc, effect: it.effect, use: it.use, uses: it.uses, equip: it.equip, icon: it.icon, weight: it.weight, from: 'store', anchor, ...paid });
      st = markSold(st, it.id);
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
  const v = ui[site];
  const st = readMall(ctx.chat.scriptstate, site);
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
        v.info = `돈이 들어온 것을 확인 하였다!! ${names.map((n) => `「${n}」`).join(' ')}을 지구인 손님의 소지품에 즉시 보내 준 것이다.`;
      } else v.info = '돈이 모자라는 것이다. 또는 이미 팔린 물건이다. 돈을 넣지 않은 것이다.';
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
      break;
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
    case 'mall-say': {
      const said = (value ?? v.input).trim();
      if (site !== 'cos' || !said || v.loading || !st.loaded) return true;
      const chip = st.items.find((x) => x.id === v.chip && !x.sold);
      const next = sayToOwner(st, `${chip ? `[${chip.name}] ` : ''}${said}`);
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
  const badge = it.tag === 'rare' ? '<span class="cs-bd">★강하게 추천★</span>' : sale ? '<span class="cs-bd cs-bds">※할인!※</span>' : '';
  return `<div class="cs-it${v.focus === it.id ? ' on' : ''}" data-item="${esc(it.id)}">${badge}<span class="cs-pic">${pic(it)}</span>
    <b class="cs-nm">${esc(it.name)}</b><p>${esc(it.desc)}${it.effect ? `<br><i>※ ${esc(it.effect)}</i>` : ''}</p>
    <div class="cs-pr">${sale ? `<s>${won(it.was!)}</s> ` : ''}<b>${won(it.price)}</b>${it.pay ? ` <small>+ ${esc(it.pay)}</small>` : ''}</div>
    <div class="cs-bt"><button class="cs-btn${inCart ? ' in' : ''}" data-action="mall-cart" data-value="${esc(it.id)}" aria-pressed="${inCart}">${inCart ? '장바구니에서 뺀다' : '장바구니에 넣는다'}</button><button class="cs-ln" data-action="mall-ask" data-value="${esc(it.id)}">질문 한다</button></div></div>`;
}

function cosCart(st: ShopState, v: View, bal: number): string {
  const list = v.cart.map((id) => st.items.find((x) => x.id === id)).filter((x): x is ShopItem => !!x);
  if (!list.length) return `<div class="cs-box"><b class="cs-h">◈ 장바구니 ◈</b><p>장바구니는 비어 있는 것이다. 물건을 넣는 것을 하라.</p><button class="cs-btn" data-action="mall-page" data-value="">물건의 목록으로</button></div>`;
  const total = list.reduce((a, x) => a + x.price, 0);
  return `<div class="cs-box"><b class="cs-h">◈ 장바구니 ◈</b><table class="cs-tb"><tr><th>물건</th><th>값</th><th></th></tr>${list.map((x) => `<tr><td>${esc(x.name)}</td><td>${won(x.price)}</td><td><button class="cs-ln" data-action="mall-cart" data-value="${esc(x.id)}">뺀다</button></td></tr>`).join('')}
    <tr class="cs-sum"><td>모두 합하여</td><td colspan="2"><b>${won(total)}</b></td></tr></table>
    <p class="cs-bal">지구인 손님의 잔고 : ${formatWon(bal)}</p><button class="cs-btn cs-go" data-action="mall-order">주문 하기</button></div>`;
}

function cosPay(st: ShopState, v: View, bal: number): string {
  const list = v.cart.map((id) => st.items.find((x) => x.id === id)).filter((x): x is ShopItem => !!x);
  const total = list.reduce((a, x) => a + x.price, 0);
  const poor = bal < total;
  return `<div class="cs-dim"><div class="cs-win cs-paywin" role="dialog" aria-label="돈을 넣는 창"><div class="cs-wt"><b>★ 돈을 넣는 창 ★ - Netscape</b><button data-action="mall-pay-close" aria-label="닫기">×</button></div>
    <div class="cs-wb"><p>아래의 계좌에 돈을 넣는 것을 하라.</p><p class="cs-acc">${esc(COS_ACCOUNT)}</p>
    <table class="cs-tb"><tr><td>보내는 돈</td><td><b>${won(total)}</b></td></tr><tr><td>지금 잔고</td><td>${formatWon(bal)}</td></tr><tr><td>보낸 뒤</td><td>${formatWon(bal - total)}</td></tr></table>
    <p class="cs-warn">※ 돈을 돌려주는 것은 절대로 없다. 물건을 돌려받는 것도 없다.</p>
    <div class="cs-wbt"><button class="cs-btn cs-go" data-action="mall-pay" ${poor ? 'disabled' : ''}>${poor ? '잔고가 모자라다' : '이체 한다'}</button><button class="cs-btn" data-action="mall-pay-close">그만 둔다</button></div></div></div></div>`;
}

function cosAsk(st: ShopState, v: View): string {
  const ufo = siteLogo('cos', 'cs-ufo');
  const chip = st.items.find((x) => x.id === v.chip && !x.sold);
  const log = st.talk.length
    ? st.talk.map((l) => (l.who === 'me' ? `<div class="q-m q-me"><b>나</b><p>${esc(l.text)}</p></div>` : `<div class="q-m q-op"><b>운영자 우주인</b><p>${opText(l.text, st)}</p></div>`)).join('')
    : '<div class="q-m q-op"><b>운영자 우주인</b><p>무엇이 궁금한 것이냐 지구인 손님이여!! 물건에 대하여 묻는 것이면 물건을 붙이는 것을 하라.</p></div>';
  const wait = v.loading === 'talk' ? '<div class="q-m q-op q-wait"><b>운영자 우주인</b><p>답을 쓰는 중 인 것이다…</p></div>' : '';
  const pickList = v.picking ? `<div class="q-pick">${onShelf(st).map((x) => `<button data-action="mall-chip" data-value="${esc(x.id)}">${esc(x.name)} <b>${won(x.price)}</b></button>`).join('') || '<p>붙일 물건이 없는 것이다.</p>'}</div>` : '';
  return `<div class="cs-win cs-askwin" role="dialog" aria-label="운영자에게 질문 하는 창"><div class="cs-wt"><b>★ 운영자에게 질문 하는 창 ★ - Netscape</b><button data-action="mall-ask-close" aria-label="닫기">×</button></div>
    <div class="q-hd">${ufo}<div><b>운영자 우주인</b><small>● 지금 깨어 있는 것이다</small></div></div>
    ${chip ? `<div class="q-card"><span>붙인 물건</span><button class="cs-ln" data-action="mall-show" data-value="${esc(chip.id)}">${esc(chip.name)} <b>${won(chip.price)}</b></button><button class="q-x" data-action="mall-chip" data-value="" aria-label="물건 떼기">×</button></div>` : ''}
    <div class="q-lg">${log}${wait}</div>${failBox(v, 'q-fail')}${pickList}
    <div class="q-in"><button class="cs-btn" data-action="mall-pick" aria-pressed="${v.picking}">물건을 붙인다</button><input data-input="mall-say" data-enter="mall-say" value="${esc(v.input)}" placeholder="질문을 쓰는 것이다" aria-label="질문"${v.loading ? ' disabled' : ''}><button class="cs-btn" data-action="mall-say" data-take="mall-say" ${v.loading || !st.loaded ? 'disabled' : ''}>보낸다</button></div></div>`;
}

function cosHtml(ctx: ChatContext, mobile: boolean): string {
  const site: MallSite = 'cos';
  const v = ui[site];
  const st = readMall(ctx.chat.scriptstate, site);
  const s = mallSettings(ctx.chat.scriptstate, site);
  const bal = balanceOf(ctx, site);
  const list = onShelf(st);
  const rare = s.feature ? list.filter((x) => x.tag === 'rare') : [];
  const sale = s.feature ? list.filter((x) => x.tag === 'sale' && x.was) : [];
  const rest = list.filter((x) => !rare.includes(x) && !sale.includes(x));
  const ufo = siteLogo('cos', 'cs-ufo');
  const menu = [['', '처음의 곳'], ['cart', `장바구니 (${v.cart.length})`]].map(([k, l]) => `<button class="${v.page === k ? 'on' : ''}" data-action="mall-page" data-value="${k}">◈ ${l}</button>`).join('')
    + '<button data-action="mall-ask" data-value="">◈ 운영자에게 질문</button>';
  const note = mallNote(ctx.chat.scriptstate, site);
  const grid = (xs: ShopItem[]) => `<div class="cs-grid">${xs.map((x) => cosCard(x, v)).join('')}</div>`;
  let main: string;
  if (!s.on) main = '<div class="cs-box"><p>지금은 문을 닫은 것이다. (소지품·가계부가 꺼져 있어요)</p></div>';
  else if (v.page === 'cart') main = cosCart(st, v, bal);
  else if (v.loading === 'shelf' && !list.length) main = '<div class="cs-box cs-wait"><p>먼 별에서 물건을 가져오는 중 인 것이다… <span class="blink">★</span></p></div>';
  else if (!list.length) main = `<div class="cs-box"><p>${st.loaded ? '물건이 모두 팔린 것이다.' : '아직 물건을 진열 하지 않은 것이다.'}</p><button class="cs-btn" data-action="mall-refresh" ${v.loading ? 'disabled' : ''}>물건을 가져온다</button></div>`;
  // 추천·할인·일반 모두 한 격자, 같은 배열 (2026-11-08 사용자: 구획으로 흐트러뜨리지 말 것). 추천·할인은 칸 안 딱지로만
  else main = `<b class="cs-h">◈ 물건의 목록 ◈</b>${grid([...rare, ...sale, ...rest])}${v.loading === 'shelf' ? '<p class="cs-wait">새 물건을 가져오는 중 인 것이다…</p>' : ''}`;
  const how = `<div class="cs-how"><b>◈ 사는 방법 ◈</b><br>1. 장바구니에 넣는다 &nbsp; 2. 아래의 계좌에 돈을 넣는다 &nbsp; 3. 돈을 확인 하면 즉시 보내 주는 것이다<br>돈을 넣는 계좌 : <b>${esc(COS_ACCOUNT)}</b><br><span class="cs-red">※ 돈을 돌려주는 것은 절대로 없다. 물건을 돌려받는 것도 없다.</span><br>궁금한 것은 <button class="cs-ln" data-action="mall-ask" data-value="">운영자에게 질문</button> 하는 것이다.</div>`;
  const head = `<div class="cs-title">${mobile ? '' : ufo} Cosmic Shopping Mall ${mobile ? '' : ufo.replace('cs-ufo', 'cs-ufo cs-flip')}</div><div class="cs-subt">※외계에서 온 멋진 물건※~!!</div><hr class="cs-rb">
    <div class="cs-mq"><span>☆ 지구인 손님 당신을 환영한다 ☆★ 돈이 들어오는 즉시 공간을 찢어 물건을 던져 준다 ★☆ 돌려주는 돈은 존재 하지 않는다 ☆</span></div>
    <div class="cs-wel">반가운 것이다 지구인 여러분들이여!! 우리들 <b>우주 쇼핑몰</b>은 매우 먼 별에서 온 귀중한 물건을 지구인 손님 당신에게 판매 해 주는 것이다. 모든 물건은 <b>진짜의 물건</b> 이다 그러나 효과는 <b>우리가 책임을 지는 것이 아니다</b>.${note ? `<br><br><span class="cs-op">운영자 우주인 :</span> ${opText(note, st)}` : ''} <span class="blink">NEW!!</span></div>`;
  const info = v.info ? `<div class="cs-info" role="status">${esc(v.info)}</div>` : '';
  const side = mobile
    ? `<nav class="cs-top">${menu}</nav>`
    : `<nav class="cs-lf"><div class="cs-lt">★우주 쇼핑몰★</div>${ufo.replace('cs-ufo', 'cs-ufo cs-big')}${menu}<hr class="cs-rb"><div class="cs-cnt">TOTAL <span>${String(st.items.length + st.talk.length + 700).padStart(6, '0')}</span></div><small>800×600 해상도를<br>가장 좋아함 하였다</small></nav>`;
  return `<main class="ms ms-cos${mobile ? ' ms-m' : ''}"><div class="cs-fr">${side}<div class="cs-mn">${head}${info}${failBox(v, 'cs-fail')}${main}${how}<div class="cs-ft">Copyright ⓒ 1997 Cosmic Shopping Mall. All rights reserved.<br>이 집의 페이지는 <span>Netscape Now!</span> 에서 가장 좋게 보이는 것이다 · 거미줄의 주인 : 우주인</div></div></div>${v.ask ? cosAsk(st, v) : ''}${v.pay ? cosPay(st, v, bal) : ''}</main>`;
}

/* 백일몽 포인트몰 */

function bmCard(it: ShopItem, bal: number, v: View, busy: boolean): string {
  const sale = it.tag === 'sale' && !!it.was && it.was > it.price;
  const poor = it.price > bal;
  const lab = it.tag === 'rare' ? '<span class="bp-lim">이달의 한정</span>' : sale ? '<span class="bp-sale">특가</span>' : '';
  return `<div class="bp-it${v.focus === it.id ? ' on' : ''}" data-item="${esc(it.id)}"><span class="bp-pic">${pic(it)}</span>${lab}
    <b class="bp-nm">${esc(it.name)}</b><p class="bp-ds">${esc(it.desc)}${it.effect ? `<br><i>${esc(it.effect)}</i>` : ''}</p>
    <div class="bp-pr">${sale ? `<s>${pts(it.was!)}</s> ` : ''}<b>${Math.trunc(it.price).toLocaleString('en-US')}</b> P</div>
    <button class="bp-buy" data-action="mall-buy" data-value="${esc(it.id)}" ${poor || busy ? 'disabled' : ''}>${poor ? '포인트 부족' : '포인트로 구매'}</button></div>`;
}

function bmHtml(ctx: ChatContext, mobile: boolean): string {
  const site: MallSite = 'bm';
  const v = ui[site];
  const st = readMall(ctx.chat.scriptstate, site);
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
    const side = `<nav class="bp-side${mobile ? ' m' : ''}">${cats.map(([k, l]) => `<button class="${v.page === k ? 'on' : ''}" data-action="mall-page" data-value="${k}" aria-pressed="${v.page === k}">${l}</button>`).join('')}</nav>`;
    const note = mallNote(ctx.chat.scriptstate, site);
    const banner = `<div class="bp-ban">포인트는 현금으로 바꿀 수 없으며, 이 몰에서만 쓸 수 있습니다.${note ? `<br>${esc(note)}` : ''}</div>`;
    const info = v.info ? `<div class="bp-info" role="status">${esc(v.info)}</div>` : '';
    const grid = v.loading === 'shelf' && !list.length ? '<div class="bp-box">상품을 불러오는 중입니다…</div>'
      : !list.length ? `<div class="bp-box"><p>${st.loaded ? '모든 상품이 품절되었습니다.' : '등록된 상품이 없습니다.'}</p><button class="bp-buy" data-action="mall-refresh" ${v.loading ? 'disabled' : ''}>상품 불러오기</button></div>`
      : `<div class="bp-grid">${shown.map((x) => bmCard(x, bal, v, !!v.loading)).join('') || '<p class="bp-none">이 분류에는 상품이 없습니다.</p>'}</div>`;
    body = `<div class="bp-wrap">${side}<div class="bp-main">${banner}${info}${failBox(v, 'bp-fail')}<h2>${v.page === 'rare' ? '이달의 한정' : v.page === 'sale' ? '특가' : '전체 상품'}${v.loading === 'shelf' && list.length ? ' <small>새 상품을 불러오는 중…</small>' : ''}</h2>${grid}</div></div>`;
  }
  return `<main class="ms ms-bm${mobile ? ' ms-m' : ''}">${gnb}${hd}${body}</main>`;
}

/** 브라우저 탭 화면 */
export function mallTab(ctx: ChatContext, env: MallEnv, site: MallSite): string {
  sync(ctx);
  void env;
  const mobile = isPhone();
  return site === 'cos' ? cosHtml(ctx, mobile) : bmHtml(ctx, mobile);
}

// ── 설정 페이지 (2026-11-08 사용자: 사이트마다 값 따로. 상점 설정 쪽 항목, 우주몰만 문의) ──

const row = (label: string, control: string, hint = '') =>
  `<div class="ps-row"><div class="ps-label"><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</div><div class="ps-ctl">${control}</div></div>`;
const group = (title: string, rows: string) => `<section class="ps-group"><h3>${title}</h3><div class="ps-rows">${rows}</div></section>`;
function mseg(site: MallSite, key: string, cur: string, items: [string, string][]): string {
  const sw = onOffSwitch(items, cur, 'ms-cfg', (v) => `${site}:${key}=${v}`);
  if (sw) return sw;
  return `<div class="gx-segs gx-segs-sm">${items.map(([v, l]) => `<button class="gx-seg${cur === v ? ' on' : ''}" data-action="ms-cfg" data-value="${site}:${key}=${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
}
const step = (site: MallSite, key: string, shown: string, down: boolean, up: boolean, label: string) =>
  `<div class="st-step"><button class="gx-step" data-action="ms-step" data-value="${site}:${key}:-" ${down ? '' : 'disabled'} aria-label="${esc(label)} 줄이기">−</button><b>${esc(shown)}</b><button class="gx-step" data-action="ms-step" data-value="${site}:${key}:+" ${up ? '' : 'disabled'} aria-label="${esc(label)} 늘리기">+</button></div>`;

/** 상점 설정 이름 (사이트 앞붙이 없이) */
const MS_KEY: Record<string, string> = { model: '$sh_model', ctx: '$sh_ctx', feature: '$sh_feature', price: '$sh_price', diverse: '$sh_diverse', thoughts: '$sh_thoughts', prev: '$sh_prev', min: '$sh_min', max: '$sh_max', turns: '$sh_turns', refs: '$sh_refs' };
const MS_RANGE: Record<string, [number, number]> = { min: [SHOP_SIZE_LO, SHOP_SIZE_HI], max: [SHOP_SIZE_LO, SHOP_SIZE_HI], turns: [1, 8], refs: [0, 12] };

export function mallSettingsPane(ctx: ChatContext, site: MallSite): string {
  const s = mallSettings(ctx.chat.scriptstate, site);
  const name = MALL_NAME[site];
  const blocked = s.on ? '' : `<p class="gx-hint">소지품이나 가계부가 꺼져 있어 ${name}을 쓸 수 없어요. 산 물건은 소지품에, 돈은 가계부로 오가서 둘 다 켜져 있어야 해요.</p>`;
  const rows = `${blocked}${group(name, [
    row('자동 호출', mseg(site, 'auto', s.auto, [['manual', '수동'], ['open', '창을 열 때'], ['turn', '매 턴']]), s.auto === 'manual' ? '새로 고침을 눌렀을 때만 물건 목록을 새로 받아요.' : s.auto === 'open' ? '사이트를 열 때, 지난번에 받은 뒤로 본편이 진행됐으면 한 번 새로 받아요.' : '본편 응답마다 물건 목록을 새로 받아요(모델 호출 +1).'),
    row('모델', mseg(site, 'model', s.model, [['main', '메인 모델'], ['aux', '보조 모델']]), `물건 목록${site === 'cos' ? '과 운영자 답' : ''}을 지을 모델이에요.`),
    row('컨텍스트에 포함', mseg(site, 'ctx', s.context ? '1' : '0', [['1', 'ON'], ['0', 'OFF']]), '켜면 최근 본문·상태창·진행 중 괴이·신분을 같이 넘겨 지금 상황에 맞는 물건이 나와요.'),
    row('상품 수', `<div class="st-range"><span>최소</span>${step(site, 'min', `${s.size[0]}개`, s.size[0] > SHOP_SIZE_LO, s.size[0] < SHOP_SIZE_HI, '최소')}<span>최대</span>${step(site, 'max', `${s.size[1]}개`, s.size[1] > SHOP_SIZE_LO, s.size[1] < SHOP_SIZE_HI, '최대')}</div>`, `한 번에 받을 물건 수예요(${SHOP_SIZE_LO}~${SHOP_SIZE_HI}).`),
    row(site === 'cos' ? '추천·할인 구획' : '한정·특가 구획', mseg(site, 'feature', s.feature ? '1' : '0', [['1', 'ON'], ['0', 'OFF']]), site === 'cos' ? '켜면 「강하게 추천」 물건 하나와 ※할인!※ 물건을 받아 같은 목록 칸에 딱지로 표시해요.' : '켜면 「이달의 한정」 하나와 특가 상품을 따로 받아 분류에 보여 줘요.'),
    row('값 기준', `<input class="gx-search ps-text" data-change="ms-text" data-key="${site}:price" value="${esc(s.price)}" maxlength="80" placeholder="비우면 사이트에 어울리는 값">`),
    row('다양성 강화', mseg(site, 'diverse', s.diverse ? '1' : '0', [['1', 'ON'], ['0', 'OFF']]), '켜면 싼 것·비싼 것·흔한 것·특이한 것을 섞어요.'),
    row('지난 목록 피하기', mseg(site, 'prev', s.avoidPrev ? '1' : '0', [['1', 'ON'], ['0', 'OFF']]), '새로 받을 때 이미 보였던 물건을 피해요.'),
    row('생각 단계', mseg(site, 'thoughts', s.thoughts, [['off', '사용 안 함'], ['inner', '속으로만'], ['note', '적고 지움']])),
    row('최근 본문 턴 수', step(site, 'turns', `${s.turns}턴`, s.turns > 1, s.turns < 8, '최근 본문 턴 수'), '컨텍스트에 포함일 때 넘기는 최근 본문 턴 수예요(1~8).'),
    row('참고 로어북 수', step(site, 'refs', `${s.refs}개`, s.refs > 0, s.refs < 12, '참고 로어북 수'), '봇 설명·켜진 로어북·사이트 이름이 걸리는 로어북 가운데 최대 몇 개를 넘길지예요(0~12).'),
  ].join(''))}`;
  return `<div class="ph-form"><header class="ph-room-head"><div class="ph-room-title"><b>${name} 설정</b></div></header><div class="ph-form-body ps">${rows}</div></div>`;
}

/** 설정 값 바꾸기: ms-cfg 「사이트:키=값」 · ms-step 「사이트:키:±」 · ms-text (값 기준) */
export async function mallSettingsAction(action: string, value: string | undefined, ctx: ChatContext, env: MallEnv): Promise<boolean> {
  if (action !== 'ms-cfg' && action !== 'ms-step' && action !== 'ms-text') return false;
  let site = '';
  let k = '';
  let v = '';
  if (action === 'ms-cfg' || action === 'ms-text') [, site, k, v] = /^(\w+):(\w+)=([\s\S]*)$/.exec(value ?? '') ?? [];
  if (action === 'ms-text') v = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
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
  if (action === 'ms-step' && (k === 'min' || k === 'max')) {
    const s = mallSettings(ctx.chat.scriptstate, site);
    const n = Number(v);
    if (k === 'min' && n > s.size[1]) extra[mallKey('$sh_max', site)] = v;
    if (k === 'max' && n < s.size[0]) extra[mallKey('$sh_min', site)] = v;
  }
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => (String(chat.scriptstate?.[varName] ?? '') === v && !Object.keys(extra).length ? null : { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [varName]: v, ...extra } }));
  await env.refresh();
  return true;
}
