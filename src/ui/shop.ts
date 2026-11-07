// 상점 팝업 (2026-11-07 사용자 설계, 초안 docs/인계/상점_1107/mock.mjs). 창 위에 뜨는 팝업 하나.
// 도구 줄 [가게 이름][잔고 … 새로고침·✕] → 진열대(PC 6열·폰 3열, 그림+이름 두 줄+값 숫자만) → PC는 아래 주인 칸(사진 128·대사 상자·입력창),
// 폰은 전체 화면·아래 [문의][닫기], 문의 → 2/3 높이 서랍(사진 56·이름·대사 상자·입력창). 물건을 누르면 상세 팝업 [구입][문의].
// 생성·대화는 core/shop.ts 의 요청문·해석을 쓰고 모델 호출은 host/llm.ts. 구입은 가계부 src:'store' + 소지품 from:'store'.
// 팔기(11-07): 도구 줄 「팔기」 → 진열대 자리에 내 소지품 → 하나 고르면 입력창에 「팔기: 이름」 칩(값을 부르거나 그냥 보냄) → 주인이 값을 부르면 상세 창(잔고 / +값 / 잔액) [팔기][흥정][그만].
import type { ChatContext } from '../host/risu';
import { updateChat } from '../host/risu';
import { generate } from '../host/llm';
import { facePic } from '../host/assets';
import { personaText } from '../host/user';
import { playerSource } from '../core/player';
import { genSettings } from '../core/advanced';
import { collectRefs, limitRefs, recentTurns, refText, storyText, type RefSource } from '../core/refs';
import { readDirectory } from '../core/world';
import { findStatusTags } from '../core/world/status';
import { findDoc, innerBody } from '../core/wiki';
import { peopleStore } from '../core/people/store';
import { peopleSettings } from '../core/people/settings';
import { identityText } from '../core/people/identity';
import { addWalletEntry, aliveAnchors, formatWon, readWallet, walletBalance, walletVars, WALLET_START_DEFAULT } from '../core/wallet';
import { addItem, itemKindLabel, itemsVars, liveItemsOf, readItems, removeItem, type Item, type ItemKind } from '../core/items';
import { getPrefs } from '../core/settings';
import {
  applyShelf, applyTalk, cancelSell, closeSale, currentShop, markSold, parseShelf, parseTalk, readShop, sayToOwner, shelfItems, shelfPrompt, shopSettings, shopVars, shortWon, startSell, talkPrompt,
  type ShopItem, type ShopSource, type ShopState,
} from '../core/shop';
import { ICONS } from './icons';
import { imageUrl } from './images';
import { ITEM_ICONS } from './itemIcons';
import { itemIconUrl } from '../host/itemicons';

/** 상품 그림: 소지품과 같은 PixelLab 그림 팩(host/itemicons.ts)에서 이름으로 찾고, 없거나 아직 못 받았으면 종류 선 아이콘 (표시 전용, 모델에는 안 넘김) */
const pic = (name: string, kind: ItemKind): string => {
  const u = itemIconUrl(name, kind);
  return u ? `<img src="${u}" alt="" draggable="false">` : ITEM_ICONS[kind];
};
import { isPhone } from './media';
import { toast } from './toast';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 팝업 상태 (채팅이 바뀌면 resetShop). detail = 상세 팝업의 물건 id, drawer = 폰 주인 서랍, chip = 문의 중인 물건 이름 */
export const shopUi = {
  open: false,
  loading: '' as '' | 'shelf' | 'talk',
  detail: '',
  drawer: false,
  chip: '',
  /** 칩 종류: 문의(물건 이름) / 팔기(내 물건 이름) */
  chipKind: '' as '' | 'ask' | 'sell',
  /** 진열대 자리에 내 소지품(팔 것 고르기) */
  pick: false,
  input: '',
  notice: '',
  info: '',
  /** 실패한 응답 원문 (다시 받기 안내) */
  failRaw: '',
};

export function resetShop(): void {
  Object.assign(shopUi, { open: false, loading: '', detail: '', drawer: false, chip: '', chipKind: '', pick: false, input: '', notice: '', info: '', failRaw: '' });
}

const balanceOf = (ctx: ChatContext) => walletBalance(readWallet(ctx.chat.scriptstate, getPrefs().walletStart ?? WALLET_START_DEFAULT), aliveAnchors(ctx.chat));

/** 주인 얼굴: 명부 인물(이름·별칭·영문명)이면 그 얼굴 사진, 아니면 빈 얼굴 칸 */
function ownerFace(ctx: ChatContext, owner: string): string | null {
  const key = owner.trim().toLowerCase();
  if (!key) return null;
  const a = readDirectory(ctx.char.globalLore).agents.find((x) => [x.name, x.english, ...x.aliases].some((n) => n && n.trim().toLowerCase() === key));
  if (!a) return null;
  const pic = facePic(ctx.char, a, true);
  return pic ? imageUrl(ctx.char, pic) : null;
}

// ── 화면 ──

const shell = (inner: string, cls: string, action: string, keep: string, label: string) =>
  `<div class="gx-agpop ${cls}" data-action="${action}" role="dialog" aria-label="${esc(label)}"><div class="gx-agpop-card it-card ${cls}-card" data-action="${keep}">${inner}</div></div>`;

export function shopPopup(ctx: ChatContext): string {
  if (!shopUi.open) return '';
  const st = currentShop(ctx.chat);
  const phone = isPhone();
  if (!st) {
    return shell(`<p class="sh-none">지금 열 수 있는 상점이 없어요. 가게 장면에서 응답 아래 「상점 열기」가 뜰 때 열 수 있어요.</p><div class="it-btns"><button class="gx-chip" data-action="shop-close">닫기</button></div>`, 'sh-wrap', 'shop-close', 'shop-keep', '상점');
  }
  const bal = balanceOf(ctx);
  const tools = `<div class="gx-rec-tools gx-wt-tools it-tools sh-tools">
    <span class="sh-name">${ICONS.bag}<b>${esc(st.shop)}</b></span>
    <span class="it-cnt sh-bal" title="잔고">${esc(formatWon(bal))}</span>
    <span class="it-right">
      ${phone ? '' : `<button class="it-act${shopUi.pick ? ' on' : ''}" data-action="shop-pick" aria-pressed="${shopUi.pick}" ${st.closed || !st.loaded ? 'disabled' : ''} aria-label="팔기">${ICONS.swap}<span>팔기</span></button>`}
      <button class="it-act" data-action="shop-refresh" ${shopUi.loading || st.closed ? 'disabled' : ''} aria-label="새로고침">${ICONS.refresh}<span>새로고침</span></button>
      ${phone ? '' : `<button class="it-act sh-x" data-action="shop-close" aria-label="닫기">${ICONS.close}</button>`}
    </span>
  </div>`;
  const body = `<div class="sh-body">${bodyHtml(ctx, st, bal)}</div>`;
  const note = toast('shop', shopUi.info, (t) => {
    if (shopUi.info === t) shopUi.info = '';
  });
  const notice = shopUi.notice ? `<div class="gx-err sh-err" role="alert">${esc(shopUi.notice)}${shopUi.failRaw ? ' <button class="gx-chip sh-raw" data-action="shop-raw">원문 보기</button>' : ''}</div>` : '';
  let inner: string;
  if (phone) {
    const foot = `<div class="sh-foot">
      <button class="it-act${shopUi.pick ? ' on' : ''}" data-action="shop-pick" aria-pressed="${shopUi.pick}" ${st.closed || !st.loaded ? 'disabled' : ''} aria-label="팔기">${ICONS.swap}<span>팔기</span></button>
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
  return `<div class="it-grid sh-grid">${list.map((it) => cell(it, bal, st.closed)).join('')}</div>`;
}

function cell(it: ShopItem, bal: number, closed: boolean): string {
  const poor = it.price > bal;
  const tip = `<span class="it-tip" aria-hidden="true"><b>${esc(it.name)}</b><small>${esc(itemKindLabel(it.kind))}</small>${it.desc ? `<p>${esc(it.desc)}</p>` : ''}${it.effect ? `<p class="ef">효과: ${esc(it.effect)}</p>` : ''}<span class="sh-amt">${esc(shortWon(it.price))}</span></span>`;
  return `<button class="it-c sh-c${poor ? ' poor' : ''}${shopUi.detail === it.id ? ' sel' : ''}" data-action="shop-detail" data-value="${esc(it.id)}" aria-label="${esc(it.name)} ${esc(shortWon(it.price))}${poor ? ' (잔고 부족)' : ''}" ${closed ? 'disabled' : ''}>
    <span class="it-ic">${pic(it.name, it.kind)}</span><span class="sh-nm"><b>${esc(it.name)}</b></span><span class="sh-band">${it.orig !== undefined ? '<i title="흥정으로 깎은 값">▾</i>' : ''}${esc(shortWon(it.price))}</span>${tip}</button>`;
}

/** 팔 것 고르기: 진열대 자리에 내 소지품 (같은 격자). 고르면 입력창에 「팔기: 이름」 칩 */
function pickHtml(ctx: ChatContext, st: ShopState): string {
  const mine = liveItemsOf(readItems(ctx.chat.scriptstate), ctx.chat);
  const head = `<div class="sh-pick-head"><span>팔 물건을 고르세요</span><button class="gx-chip" data-action="shop-pick">진열대로</button></div>`;
  if (!mine.length) return `${head}<p class="gx-wt-empty">팔 만한 소지품이 없어요.</p>`;
  return `${head}<div class="it-grid sh-grid">${mine.map((it) => pickCell(it, st)).join('')}</div>`;
}

function pickCell(it: Item, st: ShopState): string {
  const sel = st.sell?.itemId === it.id;
  const tip = `<span class="it-tip" aria-hidden="true"><b>${esc(it.name)}</b><small>${esc(itemKindLabel(it.kind))}</small>${it.desc ? `<p>${esc(it.desc)}</p>` : ''}${it.effect ? `<p class="ef">효과: ${esc(it.effect)}</p>` : ''}${Number.isSafeInteger(it.price) ? `<span class="sh-amt">산 값 ${esc(shortWon(it.price!))}</span>` : ''}</span>`;
  return `<button class="it-c sh-c${sel ? ' sel' : ''}" data-action="shop-sell-pick" data-value="${esc(it.id)}" aria-label="${esc(it.name)} 팔기" ${shopUi.loading ? 'disabled' : ''}>
    <span class="it-ic">${pic(it.name, it.kind)}</span><span class="sh-nm"><b>${esc(it.name)}</b></span><span class="sh-band dim">${sel && typeof st.sell?.price === 'number' ? `<i>▴</i>${esc(shortWon(st.sell.price))}` : Number.isSafeInteger(it.price) ? esc(shortWon(it.price!)) : '&nbsp;'}</span>${tip}</button>`;
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
  const chip = shopUi.chip ? `<button type="button" class="sh-ref${sell ? ' sell' : ''}" data-action="shop-chip-x" aria-label="${esc(shopUi.chip)} 빼기">${sell ? '팔기: ' : ''}${esc(shopUi.chip)} ×</button>` : '';
  const ph = st.closed ? '거래가 끊겼어요' : sell ? (typeof st.sell?.price === 'number' ? '값을 다시 불러 보기' : '값을 부르거나 그냥 보내기') : shopUi.chip ? '이 물건에 대해 묻기' : '주인에게 말하기';
  return `<form class="sh-talk" data-submit="shop-say">
    <label class="sh-talk-in">${chip}<input type="text" data-input="shop-say" value="${esc(shopUi.input)}" maxlength="300" placeholder="${ph}" aria-label="주인에게 말하기" ${off ? 'disabled' : ''}></label>
    <button type="submit" class="sh-go" aria-label="보내기" ${off ? 'disabled' : ''}>↵</button>
  </form>`;
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
    <div><i>잔고</i><span class="sh-amt">${esc(shortWon(bal))}</span></div>
    <div><i>값</i><span class="sh-amt">${it.orig !== undefined ? `<s>${esc(shortWon(it.orig))}</s> ` : ''}−${esc(shortWon(it.price))}</span></div>
    <div class="sum${poor ? ' bad' : ''}"><i>${poor ? '부족' : '잔액'}</i><span class="sh-amt">${esc(shortWon(poor ? -left : left))}</span></div>
  </div>`;
  const inner = `<button class="gx-agpop-x" data-action="shop-detail-close" aria-label="닫기">${ICONS.close}</button>
    <div class="it-ph sh-ph"><span class="it-ic">${pic(it.name, it.kind)}</span><div class="sh-phtx"><b>${esc(it.name)}</b><span class="sh-meta"><span class="sh-tag">${esc(itemKindLabel(it.kind))}</span>${it.sold ? '<span>산 물건</span>' : ''}</span><span class="sh-amt big">${esc(shortWon(it.price))}</span></div></div>
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
    <div><i>잔고</i><span class="sh-amt">${esc(shortWon(bal))}</span></div>
    <div><i>주인이 부른 값</i><span class="sh-amt">${o.first !== undefined ? `<s>${esc(shortWon(o.first))}</s> ` : ''}+${esc(shortWon(o.price as number))}</span></div>
    <div class="sum"><i>잔액</i><span class="sh-amt">${esc(shortWon(bal + (o.price as number)))}</span></div>
  </div>`
    : refused ? '<p class="dim">주인이 이 물건은 사지 않겠대요.</p>' : '<p class="dim">아직 값을 묻지 않았어요.</p>';
  const inner = `<button class="gx-agpop-x" data-action="shop-detail-close" aria-label="닫기">${ICONS.close}</button>
    <div class="it-ph sh-ph"><span class="it-ic">${pic(o.name, o.kind)}</span><div class="sh-phtx"><b>${esc(o.name)}</b><span class="sh-meta"><span class="sh-tag">${esc(itemKindLabel(o.kind))}</span><span>내 물건</span>${o.paid !== undefined ? `<span>산 값 ${esc(shortWon(o.paid))}</span>` : ''}</span>${offered ? `<span class="sh-amt big">+${esc(shortWon(o.price as number))}</span>` : ''}</div></div>
    ${o.desc ? `<p>${esc(o.desc)}</p>` : '<p class="dim">설명 없음</p>'}
    ${o.effect ? `<p class="ef">효과: ${esc(o.effect)}</p>` : ''}
    ${money}
    <div class="it-btns">
      ${offered ? `<button class="gx-chip on" data-action="shop-sell" ${st.closed || shopUi.loading ? 'disabled' : ''}>팔기</button>` : ''}
      ${refused ? '' : `<button class="gx-chip" data-action="shop-sell-haggle" ${st.closed ? 'disabled' : ''}>${offered ? '흥정' : '값 묻기'}</button>`}
      <button class="gx-chip" data-action="shop-sell-cancel">그만</button>
    </div>`;
  return shell(inner, 'sh-det', 'shop-detail-close', 'shop-keep', `${o.name} 팔기`);
}

// ── 동작 ──

export interface ShopEnv {
  render(): void;
  refresh(): Promise<void>;
  /** 지금 보고 있는 채팅 (응답이 돌아왔을 때 다른 채팅이면 버린다) */
  current(): ChatContext | null;
}

const chatKey = (ctx: ChatContext) => `${ctx.charIndex}:${ctx.chatIndex}`;

function source(ctx: ChatContext, st: ShopState): ShopSource {
  const src = playerSource({ char: ctx.char as RefSource['char'], chat: ctx.chat, persona: personaText() } as RefSource);
  const vars = ctx.chat.scriptstate ?? {};
  const story = storyText(recentTurns(ctx.chat, 3, genSettings(vars).userMessages));
  // 참고: 봇 설명·활성 로어북·가게 이름과 주인 이름이 걸리는 로어북(주인 인물 포함)·위키의 가게 문서. 페르소나·작가 노트는 넘기지 않는다
  const doc = findDoc(ctx.chat, st.shop, ctx.char.globalLore);
  const rows = limitRefs(
    collectRefs(src, { scope: 'gnet', text: `${st.shop}\n${st.owner}\n${story}`, authors: false, persona: false, related: true, extra: doc ? [{ source: `위키: ${st.shop}`, content: innerBody(doc.body).slice(0, 3000) }] : [] }),
    6,
  );
  let status = '';
  const msgs = ctx.chat.message ?? [];
  for (let i = msgs.length - 1; i >= 0 && !status; i--) {
    if (msgs[i].role === 'user') continue;
    const tags = findStatusTags(String(msgs[i].data ?? ''));
    if (tags.length) status = tags[tags.length - 1].raw.trim();
  }
  const situation = ['$an_report', '$in_report'].map((k) => String(vars[k] ?? '').trim()).filter(Boolean).join('\n').slice(0, 1500);
  const identity = peopleSettings(vars).on ? identityText(peopleStore(ctx.chat).identity) : '';
  return { st, refs: refText(rows), story, status, situation, identity, language: genSettings(vars).language };
}

/** 모델에 묻고 상태를 저장한다. 같은 채팅을 보고 있을 때만 */
async function ask(ctx: ChatContext, env: ShopEnv, kind: 'shelf' | 'talk', st0: ShopState): Promise<void> {
  const key = chatKey(ctx);
  const s = shopSettings(ctx.chat.scriptstate);
  shopUi.loading = kind;
  shopUi.notice = '';
  shopUi.failRaw = '';
  env.render();
  try {
    const src = source(ctx, st0);
    const g = genSettings(ctx.chat.scriptstate);
    const opts = { retries: g.retries, retryModel: g.retryModel, concurrent: g.concurrent, state: ctx.chat.scriptstate };
    let next: ShopState;
    if (kind === 'shelf') {
      const { value } = await generate(shelfPrompt(src, s), s.model, (raw) => parseShelf(raw, st0.loaded ? st0.identity : null), opts);
      next = applyShelf(st0, value, s);
    } else {
      const { value } = await generate(talkPrompt(src, s), s.model, parseTalk, opts);
      next = applyTalk(st0, value, s.kick);
    }
    const cur = env.current();
    if (!cur || chatKey(cur) !== key) return;
    await updateChat(cur.charIndex, cur.chatIndex, (chat) => {
      const now = readShop(chat.scriptstate);
      // 그사이 응답이 와서 다른 가게가 됐으면 버린다
      if (!now || now.shop !== next.shop) return null;
      return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...shopVars({ ...next, key: now.key }) } };
    });
    if (kind === 'talk' && next.closed && !st0.closed) shopUi.info = '주인이 거래를 끊었어요.';
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
  const st = currentShop(ctx.chat);
  switch (action) {
    case 'shop-open': {
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
      const next = startSell(st, { itemId: mine.id, name: mine.name, desc: mine.desc, kind: mine.kind, effect: mine.effect, ...(Number.isSafeInteger(mine.price) ? { paid: mine.price } : {}) });
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
        const now = readShop(chat.scriptstate);
        if (!now || now.shop !== st.shop || now.sell?.itemId !== o.itemId || typeof now.sell.price !== 'number') return null;
        const it0 = readItems(chat.scriptstate);
        if (!it0.list.some((x) => x.id === o.itemId)) return null;
        const w = addWalletEntry(readWallet(chat.scriptstate, getPrefs().walletStart ?? WALLET_START_DEFAULT), { id: `sl_${o.itemId}_${now.sales.length}`, anchor: now.key, amount: now.sell.price, memo: o.name, src: 'store' });
        const items = removeItem(it0, o.itemId, 'sell', 'manual', now.key, { note: `${now.shop}에 팖` });
        const nextShop = closeSale(now);
        if (!nextShop) return null;
        sold = true;
        return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...walletVars(w), ...itemsVars(items), ...shopVars(nextShop) } };
      });
      shopUi.detail = '';
      if (shopUi.chipKind === 'sell') { shopUi.chip = ''; shopUi.chipKind = ''; }
      shopUi.info = sold ? `「${o.name}」을 ${shortWon(o.price as number)}에 팔았어요.` : '팔 수 없는 상태예요 (물건이 없거나 값이 바뀌었어요).';
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
      const text = sell ? `[팔기: ${st!.sell!.name}]${said ? ` ${said}` : ''}` : `${shopUi.chip ? `[${shopUi.chip}] ` : ''}${said}`.trim();
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
        const now = readShop(chat.scriptstate);
        const target = now?.items.find((x) => x.id === it.id && !x.sold);
        if (!now || !target) return null;
        const alive = aliveAnchors(chat);
        const w0 = readWallet(chat.scriptstate, start);
        if (walletBalance(w0, alive) < target.price) return null;
        const walletId = `st_${target.id}`;
        const w = addWalletEntry(w0, { id: walletId, anchor: now.key, amount: -target.price, memo: target.name, src: 'store' });
        const items = addItem(readItems(chat.scriptstate), alive, { name: target.name, desc: target.desc, kind: target.kind, effect: target.effect, from: 'store', anchor: now.key, price: target.price, walletId });
        bought = true;
        return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...walletVars(w), ...itemsVars(items), ...shopVars(markSold(now, target.id)) } };
      });
      shopUi.detail = '';
      shopUi.info = bought ? `「${it.name}」을 샀어요. 소지품에 들어갔어요.` : '잔고가 모자라거나 이미 팔린 물건이에요.';
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
