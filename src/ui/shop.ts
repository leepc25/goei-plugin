// 상점 팝업 (2026-11-07 사용자 설계, 초안 docs/인계/상점_1107/mock.mjs). 창 위에 뜨는 팝업 하나.
// 도구 줄 [가게 이름][잔고 … 새로고침·✕] → 진열대(PC 6열·폰 3열, 그림+이름 두 줄+값 숫자만) → PC는 아래 주인 칸(사진 128·대사 상자·입력창),
// 폰은 전체 화면·아래 [문의][닫기], 문의 → 2/3 높이 서랍(사진 56·이름·대사 상자·입력창). 물건을 누르면 상세 팝업 [구입][문의].
// 생성·대화는 core/shop.ts 의 요청문·해석을 쓰고 모델 호출은 host/llm.ts. 구입은 가계부 src:'store' + 소지품 from:'store'.
// 팔기(11-07): 도구 줄 「팔기」 → 진열대 자리에 내 소지품 → 하나 고르면 입력창에 「팔기: 이름」 칩(값을 부르거나 그냥 보냄) → 주인이 값을 부르면 상세 창(잔고 / +값 / 잔액) [팔기][흥정][그만].
import type { ChatContext } from '../host/risu';
import { updateChat } from '../host/risu';
import { refreshUseBox } from '../host/usebox';
import { generate, type LlmMessage } from '../host/llm';
import { facePic } from '../host/assets';
import { personaText } from '../host/user';
import { playerSource } from '../core/player';
import { genSettings } from '../core/advanced';
import { collectRefs, limitRefs, recentTurns, refText, storyText, type RefRow, type RefSource } from '../core/refs';
import { buildRegistry } from '../core/world/registry';
import { matchedBooks, shopGive, type ShopGive } from '../core/shopfn';
import { readDirectory } from '../core/world';
import { findStatusTags } from '../core/world/status';
import { rebuildStatusLine } from '../core/statusctx';
import { colConfig, usedCols } from '../core/world/statuscols';
import { findDoc, innerBody } from '../core/wiki';
import { peopleStore } from '../core/people/store';
import { peopleSettings } from '../core/people/settings';
import { identityText } from '../core/people/identity';
import { addWalletEntry, aliveAnchors, freshWalletId, formatWon, readWallet, walletBalance, walletVars, WALLET_START_DEFAULT, type Wallet } from '../core/wallet';
import { pointsVars, readPoints } from '../core/points';
import { addItem, dropUse, EQUIP_LABEL, gridItems, ITEM_USE_AT_VAR, itemLeft, itemUseVars, itemsVars, liveItemsOf, readItemUse, readItems, sellItem, type Item } from '../core/items';
import { getPrefs } from '../core/settings';
import {
  applyShelf, applyTalk, cancelSell, closeSale, currentShop, markSold, parseShelf, parseTalk, readShop, reviveShop, sayToOwner, shelfItems, shelfPrompt, shopOn, shopSettings, shopVars, shortWon, startSell, talkPrompt,
  type ShopItem, type ShopSource, type ShopState,
} from '../core/shop';
import { ICONS } from './icons';
import { imageUrl } from './images';
import { equipBox, itemPic } from './items';

/** 지금 방문 상태. 산 응답이 지워졌으면(다시 굴리기·삭제) 진열대의 「팔림」도 되살려 읽는다 (쇼핑몰 readMall 과 같게, 전수검사 11-13) */
const liveShop = (chat: ChatContext['chat']): ShopState | null => {
  const st = currentShop(chat);
  return st ? reviveShop(st, aliveAnchors(chat)) : null;
};
/** 상품 그림: 소지품과 같은 PixelLab 그림 팩에서 그림 낱말·이름으로 (ui/items.ts itemPic, 표시 전용) */
const pic = (name: string, icon?: string): string => itemPic({ name, icon });
/** 판정 글: 「무기 · 소모 3」 · 「사용」 (상점 물건·팔 물건) */
const traitsOf = (x: { use: boolean; uses?: number; equip?: 'weapon' | 'gear' }) => [x.equip ? EQUIP_LABEL[x.equip] : '', x.uses ? `소모 ${x.uses}` : x.use ? '사용' : ''].filter(Boolean).join(' · ');
import { isPhone } from './media';
import { toast } from './toast';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 팝업 상태 (채팅이 바뀌면 resetShop). detail = 상세 팝업의 물건 id, drawer = 폰 주인 서랍, chip = 문의 중인 물건 이름 */
export const shopUi = {
  open: false,
  /** 채팅 카드에서 열었을 때: 창의 탭·본문 없이 상점만 (2026-11-07 사용자: 상황판이 배경으로 뜨면 안 됨). 닫으면 창도 닫는다 */
  solo: false,
  loading: '' as '' | 'shelf' | 'talk',
  detail: '',
  drawer: false,
  chip: '',
  /** 칩 종류: 문의(물건 이름) / 팔기(내 물건 이름) */
  chipKind: '' as '' | 'ask' | 'sell',
  /** 진열대 자리에 내 소지품(팔 것 고르기) */
  pick: false,
  /** 팔기로 넘어갈 때 진열대 높이(px): 창이 늘었다 줄었다 하지 않게 팔기 화면에 그 높이를 준다 (2026-11-07 사용자) */
  lockH: 0,
  input: '',
  notice: '',
  info: '',
  /** 실패한 응답 원문 (다시 받기 안내) */
  failRaw: '',
};

export function resetShop(): void {
  Object.assign(shopUi, { open: false, solo: false, loading: '', detail: '', drawer: false, chip: '', chipKind: '', pick: false, lockH: 0, input: '', notice: '', info: '', failRaw: '' });
}

/** 지금 상점이 백일몽 포인트 상점인가 (2026-11-08 사용자: 포인트는 포인트 상점에서만). 그리기·동작 첫머리에서 맞춘다 */
let pts = false;
/** 값 짧은 표기: 원 상점은 원, 포인트 상점은 p */
const amt = (n: number): string => (pts ? `${n < 0 ? '−' : ''}${Math.abs(Math.trunc(n)).toLocaleString('en-US')}p` : shortWon(n));
/** 이 상점의 장부: 원 상점은 가계부, 포인트 상점은 포인트 장부 */
const ledgerOf = (vars: Record<string, unknown> | undefined, p: boolean) => (p ? readPoints(vars) : readWallet(vars, getPrefs().walletStart ?? WALLET_START_DEFAULT));
const ledgerVars = (w: Wallet, p: boolean) => (p ? pointsVars(w) : walletVars(w));
const balanceOf = (ctx: ChatContext) => walletBalance(ledgerOf(ctx.chat.scriptstate, pts), aliveAnchors(ctx.chat));

/** 주인 얼굴: 명부 인물(이름·별칭·영문명)이면 그 얼굴 사진, 아니면 빈 얼굴 칸 */
/** 주인 사진을 자를 세로/가로 비율 (칸 150 × 약 270 보다 조금 길게, 넘치는 아래는 칸이 가린다) */
const OWNER_TALL = 2;

function ownerFace(ctx: ChatContext, owner: string): string | null {
  const key = owner.trim().toLowerCase();
  if (!key) return null;
  const a = readDirectory(ctx.char.globalLore).agents.find((x) => [x.name, x.english, ...x.aliases].some((n) => n && n.trim().toLowerCase() === key));
  if (!a) return null;
  const pic = facePic(ctx.char, a, true);
  // 얼굴 틀에서 자른 사진이면 폭은 그대로 두고 아래로 길게 잘라 온다 (사용자 11-07: 확대 말고 밑으로 더 보이게)
  return pic ? imageUrl(ctx.char, pic.includes('#') ? `${pic}~${OWNER_TALL}` : pic) : null;
}

// ── 화면 ──

const shell = (inner: string, cls: string, action: string, keep: string, label: string) =>
  `<div class="gx-agpop ${cls}" data-action="${action}" role="dialog" aria-label="${esc(label)}"><div class="gx-agpop-card it-card ${cls}-card" data-action="${keep}">${inner}</div></div>`;

/** 값 표시: 원, 원이 아닌 대가, 또는 둘 다 (2026-11-08 사용자: 무엇이든 자판기 등 원으로 안 파는 가게) */
const costText = (it: { price: number; pay?: string }) => (it.pay ? `${it.pay}${it.price ? ` + ${amt(it.price)}` : ''}` : amt(it.price));

export function shopPopup(ctx: ChatContext): string {
  if (!shopUi.open) return '';
  const st = liveShop(ctx.chat);
  pts = !!st?.identity.points;
  const phone = isPhone();
  if (!st) {
    return shell(`<p class="sh-none">지금 열 수 있는 상점이 없어요. 가게 장면에서 응답 아래 「상점 열기」가 뜰 때 열 수 있어요.</p><div class="it-btns"><button class="gx-chip" data-action="shop-close">닫기</button></div>`, 'sh-wrap', 'shop-close', 'shop-keep', '상점');
  }
  const bal = balanceOf(ctx);
  const tools = `<div class="gx-rec-tools gx-wt-tools it-tools sh-tools">
    <span class="sh-name">${ICONS.bag}<b>${esc(st.shop)}</b></span>
    <span class="it-cnt sh-bal" title="${pts ? '포인트' : '잔고'}">${esc(pts ? amt(bal) : formatWon(bal))}</span>
    <span class="it-right">
      ${phone ? '' : `<button class="it-act" data-action="shop-pick" ${st.closed || !st.loaded ? 'disabled' : ''} aria-label="${shopUi.pick ? '구매' : '판매'}">${ICONS.swap}<span>${shopUi.pick ? '구매' : '판매'}</span></button>`}
      <button class="it-act" data-action="shop-refresh" ${shopUi.loading || st.closed ? 'disabled' : ''} aria-label="새로고침">${ICONS.refresh}<span>새로고침</span></button>
      ${phone ? '' : `<button class="it-act sh-x" data-action="shop-close" aria-label="닫기">${ICONS.close}</button>`}
    </span>
  </div>`;
  const lock = shopUi.pick && shopUi.lockH > 0 && !phone ? ` style="min-height:${Math.round(shopUi.lockH)}px"` : '';
  const body = `<div class="sh-body"${lock}>${bodyHtml(ctx, st, bal)}</div>`;
  const note = toast('shop', shopUi.info, (t) => {
    if (shopUi.info === t) shopUi.info = '';
  });
  const notice = shopUi.notice ? `<div class="gx-err sh-err" role="alert">${esc(shopUi.notice)}${shopUi.failRaw ? ' <button class="gx-chip sh-raw" data-action="shop-raw">원문 보기</button>' : ''}</div>` : '';
  let inner: string;
  if (phone) {
    const foot = `<div class="sh-foot">
      <button class="it-act" data-action="shop-pick" ${st.closed || !st.loaded ? 'disabled' : ''} aria-label="${shopUi.pick ? '구매' : '판매'}">${ICONS.swap}<span>${shopUi.pick ? '구매' : '판매'}</span></button>
      <button class="it-act${shopUi.drawer ? ' on' : ''}" data-action="shop-drawer" aria-pressed="${shopUi.drawer}" aria-label="주인에게 말하기">${ICONS.person}<span>문의</span></button>
      <button class="it-act sh-close" data-action="shop-close" aria-label="닫기">${ICONS.close}<span>닫기</span></button>
    </div>`;
    const drawer = shopUi.drawer ? `<div class="sh-dim" data-action="shop-drawer"></div><div class="sh-drawer" data-action="shop-keep"><button class="it-grip on" data-action="shop-drawer" aria-label="닫기"><i></i></button>${ownerHtml(ctx, st, true)}</div>` : '';
    inner = `${tools}${notice}${body}${note}${foot}${drawer}`;
  } else {
    inner = `${tools}${notice}${body}${note}<div class="sh-owner">${ownerHtml(ctx, st, false)}</div>`;
  }
  return shell(inner, 'sh-wrap', 'shop-close', 'shop-keep', st.shop) + detailHtml(ctx, st, bal);
}

function bodyHtml(ctx: ChatContext, st: ShopState, bal: number): string {
  if (shopUi.loading === 'shelf') return `<div class="sh-wait"><span class="sh-spin" aria-hidden="true"></span>${st.loaded ? '진열대를 다시 짜는 중…' : '가게를 둘러보는 중…'}</div>`;
  if (shopUi.pick && !st.closed) return pickHtml(ctx, st);
  const list = shelfItems(st);
  if (!list.length) {
    if (st.closed) return `<p class="gx-wt-empty">주인이 거래를 끊었어요.</p>`;
    return `<p class="gx-wt-empty">${st.loaded ? '진열대가 비었어요. 새로고침으로 다시 받아 보세요.' : '진열대를 아직 못 받았어요.'}${shopUi.notice ? '' : ' <button class="gx-chip" data-action="shop-refresh">받기</button>'}</p>`;
  }
  // 희귀(단 하나)·특가는 따로 구획 (2026-11-07 사용자: 한 칸에 늘어놓지 말고 구획을 나눠 화려하게). 설정에서 끄면 한 격자
  const feature = shopSettings(ctx.chat.scriptstate).feature;
  const rare = feature ? list.find((x) => x.tag === 'rare') : undefined;
  const sale = feature ? list.filter((x) => x.tag === 'sale' && x.was) : [];
  const rest = list.filter((x) => x !== rare && !sale.includes(x));
  const grid = (xs: ShopItem[]) => `<div class="it-grid sh-grid">${xs.map((it) => cell(it, bal, st.closed)).join('')}</div>`;
  if (!rare && !sale.length) return `<div class="sh-shelf">${grid(rest)}</div>`;
  const top = `<div class="sh-top">${rare ? rareHtml(rare, bal, st.closed) : ''}${sale.length ? `<section class="sh-zone sh-sale" style="--n:${sale.length}" aria-label="특가"><header class="sh-zh">${ICONS.tag}<b>특가</b><small>오늘만 내놓은 값</small></header>${grid(sale)}</section>` : ''}</div>`;
  const main = rest.length ? `<section class="sh-zone sh-main" aria-label="판매 중"><header class="sh-zh"><b>판매 중</b><small>${rest.length}</small></header>${grid(rest)}</section>` : '';
  return `<div class="sh-shelf">${top}${main}</div>`;
}

/** 희귀 진열장: 단 하나. 그림 2배(170px, 정수 확대)·이름·설명·효과·값을 다 펼쳐 보이고, 테두리에 빛이 돈다. 누르면 상세 */
function rareHtml(it: ShopItem, bal: number, closed: boolean): string {
  const poor = it.price > bal;
  return `<button class="sh-zone sh-rare${poor ? ' poor' : ''}${shopUi.detail === it.id ? ' sel' : ''}" data-action="shop-detail" data-value="${esc(it.id)}" aria-label="희귀 ${esc(it.name)} ${esc(costText(it))}${poor ? (pts ? ' (포인트 부족)' : ' (잔고 부족)') : ''}" ${closed ? 'disabled' : ''}>
    <span class="sh-rare-ring" aria-hidden="true"></span>
    <span class="sh-rare-pic"><span class="sh-rare-glow" aria-hidden="true"></span>${pic(it.name, it.icon)}</span>
    <span class="sh-rare-tx">
      <span class="sh-rare-lb">${ICONS.star}<b>희귀</b><small>단 하나</small></span>
      <b class="sh-rare-nm">${esc(it.name)}</b>
      ${it.desc ? `<span class="sh-rare-ds">${esc(it.desc)}</span>` : ''}
      ${it.effect ? `<span class="sh-rare-ef">효과 · ${esc(it.effect)}</span>` : ''}
      <span class="sh-rare-pr${it.pay ? ' pay' : ''}">${it.orig !== undefined ? '<i title="흥정으로 바꾼 값">▾</i>' : ''}${esc(costText(it))}</span>
    </span>
  </button>`;
}

function cell(it: ShopItem, bal: number, closed: boolean): string {
  const poor = it.price > bal;
  const sale = it.tag === 'sale' && !!it.was && it.was > it.price;
  const off = sale ? Math.max(1, Math.round((1 - it.price / it.was!) * 100)) : 0;
  const tip = `<span class="it-tip" aria-hidden="true"><b>${esc(it.name)}</b>${traitsOf(it) ? `<small>${esc(traitsOf(it))}</small>` : ''}${it.desc ? `<p>${esc(it.desc)}</p>` : ''}${it.effect ? `<p class="ef">효과: ${esc(it.effect)}</p>` : ''}<span class="sh-amt${it.pay ? ' pay' : ''}">${esc(costText(it))}</span></span>`;
  return `<button class="it-c sh-c${sale ? ' sale' : ''}${poor ? ' poor' : ''}${shopUi.detail === it.id ? ' sel' : ''}" data-action="shop-detail" data-value="${esc(it.id)}" aria-label="${esc(it.name)} ${esc(costText(it))}${poor ? (pts ? ' (포인트 부족)' : ' (잔고 부족)') : ''}" ${closed ? 'disabled' : ''}>
    ${sale ? `<span class="sh-off" aria-hidden="true">-${off}%</span>` : ''}<span class="it-ic">${pic(it.name, it.icon)}</span><span class="sh-nm"><b>${esc(it.name)}</b></span><span class="sh-band${it.pay ? ' pay' : ''}">${it.orig !== undefined ? '<i title="흥정으로 바꾼 값">▾</i>' : ''}${sale ? `<s>${esc(amt(it.was!))}</s>` : ''}${esc(costText(it))}</span>${tip}</button>`;
}

/** 팔 것 고르기: 진열대 자리에 「장착」 상자(장착한 것도 팔 수 있게, 2026-11-07 사용자) + 내 소지품 격자. 고르면 입력창에 「팔기: 이름」 칩 */
function pickHtml(ctx: ChatContext, st: ShopState): string {
  const all = liveItemsOf(readItems(ctx.chat.scriptstate), ctx.chat);
  const mine = gridItems(all);
  // 진열대와 같은 구획 상자 안에 (사용자 11-07: 배경에 늘어놓지 말고 상자 안에)
  const head = `<header class="sh-zh"><b>소지품</b><small>${all.length ? `${mine.length} · 팔 물건을 고르세요` : ''}</small></header>`;
  const inner = mine.length ? `<div class="it-grid sh-grid">${mine.map((it) => pickCell(it, st)).join('')}</div>` : `<p class="gx-wt-empty">${all.length ? '장착한 것 말고는 소지품이 없어요.' : '팔 만한 소지품이 없어요.'}</p>`;
  // 장착 띠와 소지품 구획은 서로 다른 상자 (2026-11-12 사용자: 장착 칸과 물건 칸이 한 격자처럼 붙어 구분이 안 됨).
  // 소지품 창과 같은 규격: 위에 테두리 친 장착 띠 [아바타 | 장착 8칸], 그 아래 제목 줄을 가진 소지품 구획. 칸 크기·열 수는 style.css 가 PC·폰을 가른다
  return `<div class="sh-shelf sh-pick"><div class="sh-eq">${equipBox(ctx, 'sell', st.sell?.itemId ?? '')}</div><section class="sh-zone sh-main sh-mine" aria-label="소지품">${head}${inner}</section></div>`;
}

function pickCell(it: Item, st: ShopState): string {
  const sel = st.sell?.itemId === it.id;
  const tr = traitsOf(it);
  const tip = `<span class="it-tip" aria-hidden="true"><b>${esc(it.name)}</b>${tr ? `<small>${esc(tr)}</small>` : ''}${it.desc ? `<p>${esc(it.desc)}</p>` : ''}${it.effect ? `<p class="ef">효과: ${esc(it.effect)}</p>` : ''}${Number.isSafeInteger(it.price) ? `<span class="sh-amt">산 값 ${esc(amt(it.price!))}</span>` : ''}</span>`;
  return `<button class="it-c sh-c${sel ? ' sel' : ''}" data-action="shop-sell-pick" data-value="${esc(it.id)}" aria-label="${esc(it.name)} 판매" ${shopUi.loading ? 'disabled' : ''}>
    <span class="it-ic">${pic(it.name, it.icon)}</span><span class="sh-nm"><b>${esc(it.name)}</b></span><span class="sh-band dim">${sel && typeof st.sell?.price === 'number' ? `<i>▴</i>${esc(amt(st.sell.price))}` : Number.isSafeInteger(it.price) ? esc(amt(it.price!)) : '&nbsp;'}</span>${tip}</button>`;
}

/** 주인 사진이 없을 때 기본 얼굴: 어둠 속 역광 그림자 (사용자 11-07, 후보 C). 성별·옷·얼굴을 알 수 없는 형체만 */
const SHADOW_FACE = '<svg class="sh-shadow" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><radialGradient id="shg" cx="50%" cy="100%" r="90%"><stop offset="0" stop-color="#232329"/><stop offset="1" stop-color="#070709"/></radialGradient><filter id="shf" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter></defs><rect width="100" height="100" fill="url(#shg)"/><g filter="url(#shf)" fill="#040405" opacity=".95"><ellipse cx="50" cy="40" rx="16" ry="18"/><path d="M10 100 C12 72 30 62 50 62 C70 62 88 72 90 100Z"/></g></svg>';

/** 주인 칸: PC = 사진 128 + 이름·대사·입력창 / 폰 서랍 = 사진 56 + 이름 머리 → 대사 상자(꽉 차면 안에서 스크롤, 새 대사가 아래) → 입력창 */
function ownerHtml(ctx: ChatContext, st: ShopState, drawer: boolean): string {
  const url = ownerFace(ctx, st.owner);
  const face = `<span class="sh-face${url ? '' : ' none'}">${url ? `<img src="${esc(url)}" alt="">` : SHADOW_FACE}</span>`;
  const name = `<div class="sh-dlg-name">${esc(st.owner || '주인')}<small>${esc(st.shop)}</small></div>`;
  const lines = st.talk.length
    ? st.talk.map((l) => (l.who === 'me' ? `<p class="me">${esc(l.text)}</p>` : `<p>「${esc(l.text)}」</p>`)).join('')
    : `<p class="dim">${shopUi.loading === 'shelf' ? '…' : st.loaded ? '' : '진열대를 받으면 주인이 말을 걸어요.'}</p>`;
  const box = `<div class="sh-dlg-box" data-sh-log>${lines}${shopUi.loading === 'talk' ? '<p class="dim">…</p>' : ''}</div>`;
  const talk = talkbox(st);
  if (drawer) return `<div class="sh-ov-head">${face}${name}</div>${box}${talk}`;
  return `${face}<div class="sh-dlg">${name}${box}${talk}</div>`;
}

function talkbox(st: ShopState): string {
  const off = st.closed || !!shopUi.loading || !st.loaded;
  const sell = shopUi.chipKind === 'sell';
  const chip = shopUi.chip ? `<button type="button" class="sh-ref${sell ? ' sell' : ''}" data-action="shop-chip-x" aria-label="${esc(shopUi.chip)} 빼기">${sell ? '판매: ' : ''}${esc(shopUi.chip)} ×</button>` : '';
  const ph = st.closed ? '거래가 끊겼어요' : sell ? (typeof st.sell?.price === 'number' ? '값을 다시 불러 보기' : '값을 부르거나 그냥 보내기') : shopUi.chip ? '이 물건에 대해 묻기' : '주인에게 말하기';
  // 폼 제출은 플러그인 iframe(allow-forms 없음)에서 안 오므로 Enter(data-enter)·단추(data-action+data-take)로 보낸다
  return `<div class="sh-talk" data-sh-talk="1">
    <label class="sh-talk-in">${chip}<input type="text" name="shop-say" data-input="shop-say" data-enter="shop-say" value="${esc(shopUi.input)}" maxlength="300" placeholder="${ph}" aria-label="주인에게 말하기" ${off ? 'disabled' : ''}></label>
    <button type="button" class="sh-go" data-action="shop-say" data-take="shop-say" aria-label="보내기" ${off ? 'disabled' : ''}>↵</button>
  </div>`;
}

/** 상세 팝업: 그림 88 → 이름·종류·값 → 설명·효과 → 영수증(잔고 / 값 / 잔액) → [구입][문의] */
function detailHtml(ctx: ChatContext, st: ShopState, bal: number): string {
  if (!shopUi.detail) return '';
  if (shopUi.detail === 'sell') return sellHtml(st, bal);
  const it = st.items.find((x) => x.id === shopUi.detail);
  if (!it) return '';
  const left = bal - it.price;
  const poor = left < 0;
  const money = `<div class="sh-money">
    <div><i>${pts ? '포인트' : '잔고'}</i><span class="sh-amt">${esc(amt(bal))}</span></div>
    ${it.pay && !it.price ? '' : `<div><i>값</i><span class="sh-amt">${it.orig !== undefined && !it.pay ? `<s>${esc(amt(it.orig))}</s> ` : ''}−${esc(amt(it.price))}</span></div>`}
    ${it.pay ? `<div class="pay"><i>대가</i><span class="sh-amt">${esc(it.pay)}</span></div>` : ''}
    <div class="sum${poor ? ' bad' : ''}"><i>${poor ? '부족' : '잔액'}</i><span class="sh-amt">${esc(amt(poor ? -left : left))}</span></div>
  </div>`;
  const inner = `<button class="gx-agpop-x" data-action="shop-detail-close" aria-label="닫기">${ICONS.close}</button>
    <div class="it-ph sh-ph"><span class="it-ic">${pic(it.name, it.icon)}</span><div class="sh-phtx"><b>${esc(it.name)}</b><span class="sh-meta">${it.tag === 'rare' ? `<span class="sh-tag rare">${ICONS.star}희귀</span>` : ''}${it.tag === 'sale' && it.was ? '<span class="sh-tag sale">특가</span>' : ''}${traitsOf(it) ? `<span class="sh-tag">${esc(traitsOf(it))}</span>` : ''}${it.sold ? '<span>산 물건</span>' : ''}</span><span class="sh-amt big${it.pay ? ' pay' : ''}">${it.tag === 'sale' && it.was ? `<s>${esc(amt(it.was))}</s> ` : ''}${esc(costText(it))}</span></div></div>
    ${it.desc ? `<p>${esc(it.desc)}</p>` : '<p class="dim">설명 없음</p>'}
    ${it.effect ? `<p class="ef">효과: ${esc(it.effect)}</p>` : ''}
    ${it.sold ? '' : money}
    <div class="it-btns">
      ${it.sold ? '' : `<button class="gx-chip on" data-action="shop-buy" data-value="${esc(it.id)}" ${poor || st.closed || shopUi.loading ? 'disabled' : ''}>구입</button>`}
      <button class="gx-chip" data-action="shop-ask" data-value="${esc(it.id)}" ${st.closed ? 'disabled' : ''}>문의</button>
    </div>`;
  return shell(inner, 'sh-det', 'shop-detail-close', 'shop-keep', it.name);
}

/** 팔기 상세: 내 물건 → 주인이 부른 값(처음 값은 취소선) → 영수증(잔고 / +값 / 잔액) → [팔기][흥정][그만]. 안 사면 그 말만 */
function sellHtml(st: ShopState, bal: number): string {
  const o = st.sell;
  if (!o) return '';
  const offered = typeof o.price === 'number';
  const refused = o.price === null;
  const money = offered
    ? `<div class="sh-money">
    <div><i>${pts ? '포인트' : '잔고'}</i><span class="sh-amt">${esc(amt(bal))}</span></div>
    <div><i>주인이 부른 값</i><span class="sh-amt">${o.first !== undefined ? `<s>${esc(amt(o.first))}</s> ` : ''}+${esc(amt(o.price as number))}</span></div>
    <div class="sum"><i>잔액</i><span class="sh-amt">${esc(amt(bal + (o.price as number)))}</span></div>
  </div>`
    : refused ? '<p class="dim">주인이 이 물건은 사지 않겠대요.</p>' : '<p class="dim">아직 값을 묻지 않았어요.</p>';
  const inner = `<button class="gx-agpop-x" data-action="shop-detail-close" aria-label="닫기">${ICONS.close}</button>
    <div class="it-ph sh-ph"><span class="it-ic">${pic(o.name, o.icon)}</span><div class="sh-phtx"><b>${esc(o.name)}</b><span class="sh-meta">${traitsOf(o) ? `<span class="sh-tag">${esc(traitsOf(o))}</span>` : ''}<span>내 물건</span>${o.paid !== undefined ? `<span>산 값 ${esc(amt(o.paid))}</span>` : ''}</span>${offered ? `<span class="sh-amt big">+${esc(amt(o.price as number))}</span>` : ''}</div></div>
    ${o.desc ? `<p>${esc(o.desc)}</p>` : '<p class="dim">설명 없음</p>'}
    ${o.effect ? `<p class="ef">효과: ${esc(o.effect)}</p>` : ''}
    ${money}
    <div class="it-btns">
      ${offered ? `<button class="gx-chip on" data-action="shop-sell" ${st.closed || shopUi.loading ? 'disabled' : ''}>판매</button>` : ''}
      ${refused ? '' : `<button class="gx-chip" data-action="shop-sell-haggle" ${st.closed ? 'disabled' : ''}>${offered ? '흥정' : '값 묻기'}</button>`}
      <button class="gx-chip" data-action="shop-sell-cancel">그만</button>
    </div>`;
  return shell(inner, 'sh-det', 'shop-detail-close', 'shop-keep', `${o.name} 판매`);
}

// ── 동작 ──

export interface ShopEnv {
  render(): void;
  refresh(): Promise<void>;
  /** 지금 보고 있는 채팅 (응답이 돌아왔을 때 다른 채팅이면 버린다) */
  current(): ChatContext | null;
  /** 상점만 열었을 때(solo) 닫으면 창도 닫는다 */
  closeApp?(): Promise<void>;
}

const chatKey = (ctx: ChatContext) => `${ctx.charIndex}:${ctx.chatIndex}`;

/** 상점·쇼핑몰 요청 자료. sh: 쓸 설정 (쇼핑몰은 사이트 설정).
 *  give: 가게 표·기능 표·양 표로 정한 「넘길 것」 (core/shopfn.ts shopGive, 기본 상점·쇼핑몰 둘). 안 주면 예전 고정 값 그대로 (망상홈쇼핑) */
export function shopSource(ctx: ChatContext, st: ShopState, sh = shopSettings(ctx.chat.scriptstate), give?: ShopGive): ShopSource {
  const src = playerSource({ char: ctx.char as RefSource['char'], chat: ctx.chat, persona: personaText() } as RefSource);
  const vars = ctx.chat.scriptstate ?? {};
  // 최근 챗로그는 맥락 반영이 꺼져 있어도 관련 로어북을 고를 때는 읽는다
  const story = storyText(recentTurns(ctx.chat, give ? give.turns : sh.turns, genSettings(vars).userMessages));
  const doc = findDoc(ctx.chat, st.shop, ctx.char.globalLore);
  const extra = doc ? [{ source: `위키: ${st.shop}`, content: innerBody(doc.body).slice(0, 3000) }] : [];
  const text = `${st.shop}\n${st.owner}\n${story}`;
  let rows: RefRow[];
  if (give) {
    // 「참조 로어북」 수: 관련 로어북·2차 참조를 실제로 이 수까지만. 가게 이름·주인 이름에 걸린 것을 끝까지 남긴다
    const registry = buildRegistry(src.char.globalLore);
    const named = matchedBooks(registry, `${st.shop}\n${st.owner}`);
    // 가게 이름과 같은 위키 문서는 「관련 로어북」 칸을 켰을 때만 (전수검사 11-13)
    rows = limitRefs(collectRefs(src, { scope: 'gnet', text, ...give.toggles, registry, extra: give.toggles.related ? extra : [] }), give.refs, { hard: true, first: (r) => r.sources.some((x) => named.has(x.trim().toLowerCase())) });
  } else {
    // 참고: 봇 설명·활성 로어북·가게 이름과 주인 이름이 걸리는 로어북(주인 인물 포함)·위키의 가게 문서. 페르소나·작가 노트는 넘기지 않는다
    rows = limitRefs(collectRefs(src, { scope: 'gnet', text, authors: false, persona: false, related: true, extra }), sh.refs);
  }
  let status = '';
  const msgs = ctx.chat.message ?? [];
  for (let i = msgs.length - 1; i >= 0 && !status; i--) {
    if (msgs[i].role === 'user') continue;
    const tags = findStatusTags(String(msgs[i].data ?? ''));
    if (tags.length) status = tags[tags.length - 1].raw.trim();
  }
  // 잔고는 상점 모델에 넘기지 않는다 (설정 「넘기는 것·남는 것」): 상태창 줄에서 잔고 칸을 빼고 다시 만든다 (11-08 전수점검: 잔고 칸이 그대로 갔다)
  if (status) status = rebuildStatusLine(status, usedCols(colConfig(vars)).filter((c) => c !== 'wallet' && c !== 'points'));
  const situation = ['$an_report', '$in_report'].map((k) => String(vars[k] ?? '').trim()).filter(Boolean).join('\n').slice(0, 1500);
  const identity = peopleSettings(vars).on ? identityText(peopleStore(ctx.chat).identity) : '';
  // 가게 표와 기능 표 가운데 하나라도 맥락 반영이 꺼져 있으면 신분·상태창·괴이·챗로그를 넘기지 않는다
  if (give && !give.context) return { st, refs: refText(rows), story: '', status: '', situation: '', identity: '', language: genSettings(vars).language };
  return { st, refs: refText(rows), story, status, situation, identity, language: genSettings(vars).language };
}

/** 팔기 확정 (「판매」 단추와 주인의 <deal/> 가 같이 쓴다): 가계부 수입(src store) + 소지품에서 뺌(기록 sell) + 판 것 목록. 팔 수 없으면 null */
function saleDone<C extends ChatContext['chat']>(chat: C, shop: string, itemId: string): C | null {
  const now = readShop(chat.scriptstate);
  const o = now?.sell;
  if (!now || now.shop !== shop || !o || o.itemId !== itemId || typeof o.price !== 'number') return null;
  const it0 = readItems(chat.scriptstate);
  if (!liveItemsOf(it0, chat).some((x) => x.id === itemId)) return null;
  const p = !!now.identity.points;
  const l0 = ledgerOf(chat.scriptstate, p);
  // 살아 있는 응답을 넘겨 장부가 400줄을 넘으면 줄인다 (전수검사 11-13)
  const w = addWalletEntry(l0, { id: freshWalletId(l0, `sl_${itemId}_${now.sales.length}`, now.key), anchor: now.key, amount: o.price, memo: o.name, src: 'store' }, aliveAnchors(chat));
  // 판 물건은 판 돈과 같은 응답에 묶여 숨는다(응답을 다시 굴리면 같이 돌아옴, core/items.ts sellItem). 장착 칸에서도 빠지고, 「사용」 자리에 놓여 있었으면 거기서도 뺀다
  const items = sellItem(it0, itemId, now.key, `${now.shop}에 팖`);
  const nextShop = closeSale(now, now.key);
  if (!nextShop) return null;
  const q = chat.scriptstate?.[ITEM_USE_AT_VAR] ? null : readItemUse(chat.scriptstate);
  const use = q && q.some((u) => u.id === itemId) ? itemUseVars(dropUse(q, itemId)) : {};
  return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...ledgerVars(w, p), ...itemsVars(items), ...shopVars(nextShop), ...use } };
}

/** 모델에 묻고 상태를 저장한다. 같은 채팅을 보고 있을 때만 */
async function ask(ctx: ChatContext, env: ShopEnv, kind: 'shelf' | 'talk', st0: ShopState): Promise<void> {
  const key = chatKey(ctx);
  const s = shopSettings(ctx.chat.scriptstate);
  shopUi.loading = kind;
  shopUi.notice = '';
  shopUi.failRaw = '';
  // 말을 걸었으면 방금 저장한 내 말이 응답을 기다리는 동안 바로 보이게 채팅을 다시 읽어 그린다 (ui/malls.ts ask 와 같음, 11-11 사용자)
  if (kind === 'talk') await env.refresh();
  else env.render();
  try {
    const src = shopSource(ctx, st0, s, shopGive(ctx.chat.scriptstate, 'shop', kind));
    const g = genSettings(ctx.chat.scriptstate);
    const opts = { retries: g.retries, retryModel: g.retryModel, concurrent: g.concurrent, state: ctx.chat.scriptstate, label: kind === 'shelf' ? '상점 진열' : '상점 대화' };
    let deal = '';
    let next: ShopState;
    if (kind === 'shelf') {
      const { value } = await generate(shelfPrompt(src, s), s.model, (raw) => parseShelf(raw, st0.loaded ? st0.identity : null), opts);
      next = applyShelf(st0, value, s);
    } else {
      const { value } = await generate(talkPrompt(src, s), s.model, parseTalk, opts);
      next = applyTalk(st0, value, s.kick);
      // 말로 판 것: 주인이 <deal/> 을 냈고 부른 값이 있으면 「판매」 단추와 같이 처리
      if (value.deal && next.sell && typeof next.sell.price === 'number') deal = next.sell.itemId;
    }
    const cur = env.current();
    if (!cur || chatKey(cur) !== key) return;
    let sold = false;
    await updateChat(cur.charIndex, cur.chatIndex, (chat) => {
      const now = readShop(chat.scriptstate);
      // 그사이 응답이 와서 다른 가게가 됐으면 버린다
      if (!now || now.shop !== next.shop) return null;
      const saved = { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...shopVars({ ...next, key: now.key }) } };
      const done = deal ? saleDone(saved, next.shop, deal) : null;
      if (done) sold = true;
      return done ?? saved;
    });
    if (sold && next.sell) {
      shopUi.detail = '';
      if (shopUi.chipKind === 'sell') { shopUi.chip = ''; shopUi.chipKind = ''; }
      shopUi.info = `「${next.sell.name}」을 ${next.identity.points ? `${next.sell.price}P` : `${next.sell.price}원`}에 팔았어요.`;
      void refreshUseBox(cur.charIndex, cur.chatIndex);
    } else if (kind === 'talk' && next.closed && !st0.closed) shopUi.info = '주인이 거래를 끊었어요.';
    else if (kind === 'talk' && next.sell && next.sell.price !== undefined) {
      shopUi.detail = 'sell';
      if (next.sell.price !== null && shopUi.chipKind !== 'sell') { shopUi.chip = next.sell.name; shopUi.chipKind = 'sell'; }
    }
  } catch (error) {
    const cur = env.current();
    if (!cur || chatKey(cur) !== key) return;
    shopUi.notice = error instanceof Error ? error.message : String(error);
    shopUi.failRaw = String((error as { raw?: string }).raw ?? '');
    if (kind === 'talk') {
      // 내 말은 적어 뒀으니 답이 안 왔으면 되돌린다
      await updateChat(cur.charIndex, cur.chatIndex, (chat) => {
        const now = readShop(chat.scriptstate);
        if (!now || now.shop !== st0.shop) return null;
        return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...shopVars({ ...now, talk: now.talk.filter((l, i) => !(i === now.talk.length - 1 && l.who === 'me')) }) } };
      }).catch(() => null);
    }
  } finally {
    shopUi.loading = '';
  }
  await env.refresh();
}

/** 상점 팝업의 data-action. 처리했으면 true. 'shop-say' 의 value 는 입력칸 글 */
export async function shopAction(action: string, value: string | undefined, ctx: ChatContext, env: ShopEnv): Promise<boolean> {
  const st = liveShop(ctx.chat);
  pts = !!st?.identity.points;
  switch (action) {
    case 'shop-open': {
      // 꺼져 있거나(설정에서 끔) 방문이 없으면 열지 않는다
      if (!st || !shopOn(ctx.chat.scriptstate)) {
        shopUi.open = false;
        shopUi.solo = false;
        shopUi.info = '';
        env.render();
        return true;
      }
      shopUi.open = true;
      shopUi.detail = '';
      shopUi.drawer = false;
      shopUi.pick = false;
      shopUi.notice = '';
      // 팔던 물건이 남아 있으면 칩을 되살린다
      if (st?.sell) { shopUi.chip = st.sell.name; shopUi.chipKind = 'sell'; } else if (shopUi.chipKind === 'sell') { shopUi.chip = ''; shopUi.chipKind = ''; }
      env.render();
      // 처음 열면(진열대 없음) 바로 받는다
      if (st && !st.loaded && !st.closed && !shopUi.loading) await ask(ctx, env, 'shelf', st);
      return true;
    }
    case 'shop-keep':
      return true;
    case 'shop-close':
      shopUi.open = false;
      shopUi.detail = '';
      shopUi.drawer = false;
      if (shopUi.solo) {
        shopUi.solo = false;
        await env.closeApp?.();
        return true;
      }
      env.render();
      return true;
    case 'shop-refresh':
      if (!st || st.closed || shopUi.loading) return true;
      shopUi.detail = '';
      shopUi.pick = false;
      await ask(ctx, env, 'shelf', st);
      return true;
    case 'shop-pick':
      if (!st || st.closed || !st.loaded) return true;
      if (!shopUi.pick) shopUi.lockH = document.querySelector('.sh-body')?.getBoundingClientRect().height ?? 0;
      shopUi.pick = !shopUi.pick;
      shopUi.detail = '';
      env.render();
      return true;
    case 'shop-sell-pick': {
      // 팔 것 고름: 상태에 들고, 입력창에 「팔기: 이름」 칩. 값은 보낼 때 묻는다
      const mine = st ? liveItemsOf(readItems(ctx.chat.scriptstate), ctx.chat).find((x) => x.id === value) : null;
      if (!st || !mine || st.closed || shopUi.loading) return true;
      if (st.sell?.itemId === mine.id) {
        shopUi.detail = 'sell';
        env.render();
        return true;
      }
      // 소모성은 지금 남은 횟수를 넘긴다 (주인이 값을 정할 때 보게)
      const left = itemLeft(readItems(ctx.chat.scriptstate), mine, aliveAnchors(ctx.chat));
      const next = startSell(st, { itemId: mine.id, name: mine.name, desc: mine.desc, effect: mine.effect, ...(mine.truth ? { truth: mine.truth } : {}), use: mine.use, ...(left !== undefined ? { uses: left } : {}), ...(mine.equip ? { equip: mine.equip } : {}), ...(mine.icon ? { icon: mine.icon } : {}), ...(Number.isSafeInteger(mine.price) ? { paid: mine.price } : {}) });
      await saveShop(ctx, st, next);
      shopUi.chip = mine.name;
      shopUi.chipKind = 'sell';
      shopUi.detail = '';
      if (isPhone()) shopUi.drawer = true;
      await env.refresh();
      (document.querySelector('[data-input="shop-say"]') as HTMLInputElement | null)?.focus();
      return true;
    }
    case 'shop-sell-haggle':
      if (!st?.sell) return true;
      shopUi.chip = st.sell.name;
      shopUi.chipKind = 'sell';
      shopUi.detail = '';
      if (isPhone()) shopUi.drawer = true;
      env.render();
      (document.querySelector('[data-input="shop-say"]') as HTMLInputElement | null)?.focus();
      return true;
    case 'shop-sell-cancel':
      if (st?.sell) await saveShop(ctx, st, cancelSell(st));
      if (shopUi.chipKind === 'sell') { shopUi.chip = ''; shopUi.chipKind = ''; }
      shopUi.detail = '';
      await env.refresh();
      return true;
    case 'shop-sell': {
      // 팔기 확정: 가계부 수입(src store) + 소지품에서 뺌(기록 sell) + 판 것 목록
      if (!st?.sell || typeof st.sell.price !== 'number' || st.closed || shopUi.loading) return true;
      const o = st.sell;
      let sold = false;
      await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
        const done = saleDone(chat, st.shop, o.itemId);
        if (done) sold = true;
        return done;
      });
      shopUi.detail = '';
      if (shopUi.chipKind === 'sell') { shopUi.chip = ''; shopUi.chipKind = ''; }
      shopUi.info = sold ? `「${o.name}」을 ${amt(o.price as number)}에 팔았어요.` : '팔 수 없는 상태예요 (물건이 없거나 값이 바뀌었어요).';
      // 「사용」 자리에서 뺐으면 본 화면 상자도 다시 그린다 (소지품 버리기와 같이)
      if (sold) void refreshUseBox(ctx.charIndex, ctx.chatIndex);
      await env.refresh();
      return true;
    }
    case 'shop-detail':
      shopUi.detail = value ?? '';
      env.render();
      return true;
    case 'shop-detail-close':
      shopUi.detail = '';
      env.render();
      return true;
    case 'shop-drawer':
      shopUi.drawer = !shopUi.drawer;
      env.render();
      return true;
    case 'shop-ask': {
      // 문의: 입력창에 물건 이름 칩. 폰은 서랍을 연다
      const it = st?.items.find((x) => x.id === value);
      if (!it) return true;
      shopUi.chip = it.name;
      shopUi.chipKind = 'ask';
      shopUi.detail = '';
      if (isPhone()) shopUi.drawer = true;
      env.render();
      (document.querySelector('[data-input="shop-say"]') as HTMLInputElement | null)?.focus();
      return true;
    }
    case 'shop-chip-x':
      // 팔기 칩을 빼면 팔기도 그만 (값을 아직 안 물었을 때만; 제안이 온 뒤엔 상세 창의 「그만」으로)
      if (shopUi.chipKind === 'sell' && st?.sell && st.sell.price === undefined) await saveShop(ctx, st, cancelSell(st));
      shopUi.chip = '';
      shopUi.chipKind = '';
      await env.refresh();
      return true;
    case 'shop-raw':
      if (shopUi.failRaw) shopUi.notice = `${shopUi.notice.split('\n')[0]}\n${shopUi.failRaw.slice(0, 1500)}`;
      shopUi.failRaw = '';
      env.render();
      return true;
    case 'shop-say': {
      const sell = shopUi.chipKind === 'sell' && !!st?.sell;
      const said = (value ?? shopUi.input).trim();
      // 팔기 칩은 글이 없어도 보낼 수 있다 (물건만 내민다)
      const text = sell ? `[판매: ${st!.sell!.name}]${said ? ` ${said}` : ''}` : `${shopUi.chip ? `[${shopUi.chip}] ` : ''}${said}`.trim();
      if (!st || !text || (!sell && !said) || st.closed || shopUi.loading || !st.loaded) return true;
      shopUi.input = '';
      shopUi.chip = '';
      shopUi.chipKind = '';
      shopUi.pick = false;
      const next = sayToOwner(st, text);
      const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
        const now = readShop(chat.scriptstate);
        if (!now || now.shop !== st.shop) return null;
        return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...shopVars({ ...next, key: now.key }) } };
      });
      if (!saved) return true;
      await ask({ ...ctx, chat: saved }, env, 'talk', next);
      return true;
    }
    case 'shop-buy': {
      const it = st?.items.find((x) => x.id === value && !x.sold);
      if (!st || !it || st.closed || shopUi.loading) return true;
      const start = getPrefs().walletStart ?? WALLET_START_DEFAULT;
      let bought = false;
      await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
        const alive = aliveAnchors(chat);
        const now0 = readShop(chat.scriptstate);
        const now = now0 ? reviveShop(now0, alive) : null;
        const target = now?.items.find((x) => x.id === it.id && !x.sold);
        if (!now || !target) return null;
        // 포인트 상점은 포인트 장부에서 (원 가계부는 건드리지 않음)
        const p = !!now.identity.points;
        const w0 = p ? readPoints(chat.scriptstate) : readWallet(chat.scriptstate, start);
        if (walletBalance(w0, alive) < target.price) return null;
        // 원 몫이 있을 때만 가계부에. 원이 아닌 대가는 물건에 적어 다음 턴 본편에 「무엇으로 치르고 샀다」로 넘긴다 (core/items.ts boughtLine)
        const walletId = target.price > 0 ? freshWalletId(w0, `${p ? 'sp' : 'st'}_${target.id}`, now.key) : '';
        const w = walletId ? addWalletEntry(w0, { id: walletId, anchor: now.key, amount: -target.price, memo: target.name, src: 'store' }, alive) : w0; // 살아 있는 응답을 넘겨 장부가 400줄을 넘으면 줄인다 (전수검사 11-13)
        // 포인트로 산 것은 원 값 없이 「N 포인트」 대가로 적는다 (본편에 「paid with N points」)
        const paid = p ? { paidWith: `${target.price.toLocaleString('en-US')} Baekilmong points${target.pay ? ` + ${target.pay}` : ''}` } : { price: target.price, ...(walletId ? { walletId } : {}), ...(target.pay ? { paidWith: target.pay } : {}) };
        const items = addItem(readItems(chat.scriptstate), alive, { name: target.name, desc: target.desc, effect: target.effect, truth: target.truth, use: target.use, uses: target.uses, equip: target.equip, icon: target.icon, weight: target.weight, from: 'store', store: 'shop', anchor: now.key, ...paid });
        bought = true;
        return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...(p ? pointsVars(w) : walletVars(w)), ...itemsVars(items), ...shopVars(markSold(now, target.id, now.key)) } }; // 산 응답 키를 적어 다시 굴리면 되살게 (전수검사 11-13)
      });
      shopUi.detail = '';
      shopUi.info = bought ? `「${it.name}」을 샀어요. 소지품에 들어갔어요.` : pts ? '포인트가 모자라거나 이미 팔린 물건이에요.' : '잔고가 모자라거나 이미 팔린 물건이에요.';
      await env.refresh();
      return true;
    }
    default:
      return false;
  }
}

/** 상점 상태 저장 (같은 가게일 때만, 기준 키는 지금 것) */
async function saveShop(ctx: ChatContext, st: ShopState, next: ShopState): Promise<boolean> {
  const r = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const now = readShop(chat.scriptstate);
    if (!now || now.shop !== st.shop) return null;
    return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...shopVars({ ...next, key: now.key }) } };
  });
  return !!r;
}

/** 입력칸: 글만 기억한다 (다시 그리지 않는다 — 커서 유지) */
export function shopInput(v: string): void {
  shopUi.input = v;
}

/** 호출 흐름 미리 계산: 지금 열 수 있는 상점의 진열대 요청 (없으면 null) */
export function previewShopShelf(ctx: ChatContext): LlmMessage[] | null {
  const st = liveShop(ctx.chat);
  if (!st) return null;
  const s = shopSettings(ctx.chat.scriptstate);
  return shelfPrompt(shopSource(ctx, st, s, shopGive(ctx.chat.scriptstate, 'shop', 'shelf')), s);
}
