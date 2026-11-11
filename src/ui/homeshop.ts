// 망상홈쇼핑 사이트 화면 (2026-11-11 사용자: 컷 A·B 두 장면으로 방송 화면 구현. 인터넷 즐겨찾기로도, 카드로 연 독립 창(인터넷 창만)으로도 같은 화면).
// 모양은 11-10 도트 시안(site_mock_dot: 도트 글꼴·2px 테두리·판 색)을 그대로. 방송 칸은 재생기(ui/hsplayer.ts)가 그린다.
// 편성 호출은 상점 요청문(core/shop.ts shelfPrompt)에 방송 절(지침 「망상홈쇼핑」 BROADCAST)을 붙여 한 번에: 상품·상품마다 큐시트·채팅.
// 설정은 우주몰·포인트몰과 같은 틀(설정 → 인터넷 → 망상홈쇼핑). 재생 규칙·효과·속도 모두 설정에서 고친다.
import { defGroups, type Wire } from './setrow';
import { HOMESHOP_SET } from '../core/setdef/homeshop';
import type { ChatContext } from '../host/risu';
import { updateChat } from '../host/risu';
import { generate, type LlmMessage } from '../host/llm';
import { genSettings } from '../core/advanced';
import { emptyShop, lastBot, shelfPrompt, turnKey, SHOP_SIZE_HI, SHOP_SIZE_LO, type ShopState } from '../core/shop';
import { aliveAnchors } from '../core/wallet';
import { addItem, addItemLog, itemId, liveItemsOf, readItems, itemsVars, removeItem, sellItem, type Item } from '../core/items';
import { userTurns } from '../core/request';
import { userInfo } from '../host/user';
import { fillGuide, guideSections } from '../core/guides';
import { applyShow, boxOrder, CLIP_GROUP_LABEL, CUE_CUT_WORD, CUE_EVENT_WORD, HS_AT_VAR, HS_AUD_VAR, HS_BOX, HS_TEL_DEFAULT, HS_HOST, HS_KEY, HS_NAME, HS_NUM, hsKey, hsSettings, hsVars, installments, liveOrders, moodMap, newOrder, orderOpened, ordersVars, paidOf, parseCue, parseShow, readAudience, readOrders, readShow, showVars, type HsCue, type HsOrder, type HsScale, type HsSettings, type HsShow } from '../core/homeshop';
import { homeshopArt, homeshopStatus, onHomeshopReady } from '../host/homeshop';
import { mountPlayer, playerCut, playerSay, playerState, setPlayerFeed, stopPlayer } from './hsplayer';
import { shopSource } from './shop';
import { itemPic } from './items';
import { isPhone } from './media';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface HsEnv {
  render(): void;
  refresh(): Promise<void>;
  current(): ChatContext | null;
}

interface View {
  loading: boolean;
  notice: string;
  failRaw: string;
  page: '' | 'sched' | 'orders';
  /** 자동 다시 연결을 몇 번 했나 (이번 실패 묶음) */
  retried: number;
  /** 떠 있는 창: 전화 주문 · 스티커 보기 · 방청 신청 */
  pop: '' | 'call' | 'peek' | 'aud';
  /** 전화 주문: 결제 방법 · 맞교환으로 낼 물건 · 끝난 뒤 상담원 말 */
  pay: 'inst' | 'barter';
  barter: string;
  done: string;
  /** 스티커를 들췄나 · 방청 규칙 동의 · 방금 접수한 번호 */
  lifted: boolean;
  agree: boolean;
  audNo: string;
  /** 채팅 칸 글 · 보내는 중 */
  input: string;
  saying: boolean;
  info: string;
}
const fresh = (): View => ({ loading: false, notice: '', failRaw: '', page: '', retried: 0, pop: '', pay: 'inst', barter: '', done: '', lifted: false, agree: false, audNo: '', input: '', saying: false, info: '' });
/** 채팅 칸에 치는 글 (app.ts 가 넘긴다) */
export function homeshopInput(text: string): void {
  ui.input = text;
}
let ui = fresh();
let uiChat = '';
let liveEnv: HsEnv | null = null;
const chatKey = (ctx: ChatContext) => `${ctx.charIndex}:${ctx.chatIndex}`;
function sync(ctx: ChatContext): void {
  const k = chatKey(ctx);
  if (k === uiChat) return;
  uiChat = k;
  ui = fresh();
}
export function resetHomeshop(): void {
  uiChat = '';
  ui = fresh();
  stopPlayer();
}
onHomeshopReady(() => liveEnv?.render());

/** 주문 전화번호 (화면 글, 설정에서 고친다) */
export const HS_TEL_KEY = '$hs_tel';

const telOf = (ctx: ChatContext) => String(ctx.chat.scriptstate?.[HS_TEL_KEY] ?? '').trim() || HS_TEL_DEFAULT;
/** 호출 실패 때 자동으로 다시 연결하는 횟수 (0~3, 기본 1) */
export const HS_RETRY_KEY = '$hs_retry';
const retryOf = (ctx: ChatContext) => { const n = Number(ctx.chat.scriptstate?.[HS_RETRY_KEY] ?? 1); return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 1; };

// ── 모델 ──

/** 편성 요청문: 상점 진열 요청(다시 짜기 꼴)에 방송 절을 붙인다 */
function showPrompt(ctx: ChatContext, show: HsShow, s: HsSettings): LlmMessage[] {
  const st: ShopState = { ...emptyShop({ raw: '', shop: HS_NAME, owner: HS_HOST }, ''), loaded: true, identity: { sells: HS_NAME, never: '', prices: '무이자 N회' }, prev: show.prev.concat(show.parts.map((p) => p.item.name)).slice(-24) };
  const src = shopSource({ ...ctx, chat: { ...ctx.chat, scriptstate: hsVars(ctx.chat.scriptstate) as typeof ctx.chat.scriptstate } }, st, s.shop);
  const msgs = shelfPrompt(src, s.shop, 'Hs');
  const art = homeshopArt();
  const names = (cut: 'A' | 'B') => [...new Set((art?.pack.cuts[cut].clips ?? []).filter((c) => c.group !== 'off' && c.group !== 'base').map((c) => c.ko))];
  const a = names('A');
  const b = names('B').filter((x) => !a.includes(x));
  const range = (r: [number, number]) => (r[0] === r[1] ? `${r[0]}` : `${r[0]} to ${r[1]}`);
  const extra = fillGuide(guideSections('Hs').BROADCAST, {
    cue: range(s.cue), chat: range(s.chat), cuts: Object.values(CUE_CUT_WORD).join(', '),
    moods: a.join(', ') || '말하기', moods_b: b.join(', ') || '-', events: Object.values(CUE_EVENT_WORD).join(', '),
  });
  const i = msgs.findIndex((m) => m.role === 'system');
  return msgs.map((m, k) => (k === i ? { ...m, content: `${m.content}\n\n${extra}` } : m)) as LlmMessage[];
}

/** 호출 흐름 미리 계산용 (모델은 안 부름). 꺼져 있으면 null */
export function previewHomeshop(ctx: ChatContext): LlmMessage[] | null {
  const s = hsSettings(ctx.chat.scriptstate);
  return s.on ? showPrompt(ctx, readShow(ctx.chat.scriptstate), s) : null;
}

const jobs = new Set<string>();
async function ask(ctx: ChatContext, env: HsEnv): Promise<void> {
  const job = chatKey(ctx);
  if (jobs.has(job)) return;
  jobs.add(job);
  const s = hsSettings(ctx.chat.scriptstate);
  ui.loading = true;
  ui.notice = '';
  ui.failRaw = '';
  env.render();
  let failed = false;
  try {
    const show = readShow(ctx.chat.scriptstate);
    const g = genSettings(ctx.chat.scriptstate);
    const moods = moodMap(homeshopArt()?.pack ?? null);
    const { value } = await generate(showPrompt(ctx, show, s), s.shop.model, (raw) => parseShow(raw, moods), { retries: g.retries, retryModel: g.retryModel, concurrent: g.concurrent, state: ctx.chat.scriptstate, label: `${HS_NAME} 편성` });
    const cur = env.current();
    if (!cur || chatKey(cur) !== chatKey(ctx)) return;
    const key = lastBot(cur.chat)?.key ?? '';
    await updateChat(cur.charIndex, cur.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...showVars({ ...applyShow(readShow(chat.scriptstate), value, key), tk: turnKey(chat) }), [HS_AT_VAR]: turnKey(chat) } }));
    ui.retried = 0;
  } catch (error) {
    failed = true;
    ui.notice = error instanceof Error ? error.message : String(error);
    ui.failRaw = String((error as { raw?: string }).raw ?? '').slice(0, 4000);
  } finally {
    ui.loading = false;
    jobs.delete(job);
  }
  // 신호 없음: 설정한 횟수만큼 스스로 다시 연결 (11-09 사용자: 망상만)
  if (failed && ui.retried < retryOf(ctx)) {
    ui.retried++;
    const cur = env.current();
    if (cur && chatKey(cur) === chatKey(ctx)) return ask(cur, env);
  }
  await env.refresh();
}

/** 사이트를 열 때: 「창을 열 때」이고 마지막 응답 뒤로 아직 안 받았으면 한 번 (처음이면 늘) */
export function homeshopOpenCheck(ctx: ChatContext, env: HsEnv): void {
  liveEnv = env;
  sync(ctx);
  // 사이트에 들어오면 늘 방송 화면부터
  ui.page = '';
  const s = hsSettings(ctx.chat.scriptstate);
  if (!s.on || s.auto === 'manual' || ui.loading) return;
  const show = readShow(ctx.chat.scriptstate);
  // 턴 열쇠: 응답을 다시 굴린 것은 턴이 넘어간 것이 아니다 (11-11 사용자)
  const key = turnKey(ctx.chat);
  // 본편 턴이 넘어갔으면 편성 한 칸 (보던 부는 지나간다)
  if (s.turn && show.loaded && show.tk !== undefined && show.tk !== key && show.at < show.parts.length) {
    void updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      const cur = readShow(chat.scriptstate);
      if (!cur.loaded || cur.tk === turnKey(chat)) return null;
      return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...showVars({ ...cur, at: Math.min(cur.at + 1, cur.parts.length), tk: turnKey(chat) }) } };
    }).then(() => env.refresh()).then(() => { const c = env.current(); if (c) homeshopOpenCheck(c, env); });
    return;
  }
  if (show.loaded && String(ctx.chat.scriptstate?.[HS_AT_VAR] ?? '') === key) return;
  if (show.loaded && show.at < show.parts.length) return;
  void ask(ctx, env);
}

// ── 동작 ──

export async function homeshopAction(action: string, value: string | undefined, ctx: ChatContext, env: HsEnv): Promise<boolean> {
  if (!action.startsWith('hs-')) return false;
  liveEnv = env;
  sync(ctx);
  switch (action) {
    case 'hs-refresh':
      if (!hsSettings(ctx.chat.scriptstate).on || ui.loading) return true;
      ui.retried = 0;
      await ask(ctx, env);
      return true;
    case 'hs-page':
      ui.page = value === 'sched' || value === 'orders' ? value : '';
      ui.pop = '';
      env.render();
      return true;
    case 'hs-pop':
      ui.pop = value === 'call' || value === 'peek' || value === 'aud' ? value : '';
      ui.pay = 'inst';
      ui.barter = '';
      ui.done = '';
      ui.lifted = false;
      ui.agree = false;
      ui.audNo = '';
      env.render();
      return true;
    case 'hs-pay':
      ui.pay = value === 'barter' ? 'barter' : 'inst';
      env.render();
      return true;
    case 'hs-barter':
      ui.barter = value ?? '';
      env.render();
      return true;
    case 'hs-lift':
      ui.lifted = true;
      env.render();
      return true;
    case 'hs-agree':
      ui.agree = !ui.agree;
      env.render();
      return true;
    case 'hs-order':
      await order(ctx, env);
      return true;
    case 'hs-aud':
      await audience(ctx, env);
      return true;
    case 'hs-say':
      await say(ctx, env, (value ?? ui.input).trim());
      return true;
    case 'hs-box-open':
      await openBox(ctx, env, value ?? '');
      return true;
    case 'hs-raw':
      if (ui.failRaw) ui.notice = `${ui.notice.split('\n')[0]}\n${ui.failRaw.slice(0, 1500)}`;
      ui.failRaw = '';
      env.render();
      return true;
    default:
      return homeshopSettingsAction(action, value, ctx, env);
  }
}

/** 큐시트가 끝나 다음 부로: 저장하고 다시 그린다 */
function advance(at: number): void {
  const env = liveEnv;
  const ctx = env?.current();
  if (!env || !ctx) return;
  void updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const show = readShow(chat.scriptstate);
    if (!show.loaded || show.at >= at) return null;
    return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...showVars({ ...show, at: Math.min(at, show.parts.length) }) } };
  }).then(() => env.refresh());
}

// ── 주문·상자·방청·채팅 (설계 8-4 ~ 8-10) ──

/** 지금 방송 중인 부와, 이미 주문했는지 */
function nowPart(ctx: ChatContext): { show: HsShow; part: HsShow['parts'][number] | null; ordered: HsOrder | null } {
  const show = readShow(ctx.chat.scriptstate);
  const part = show.loaded ? show.parts[show.at] ?? null : null;
  const ordered = part ? liveOrders(ctx.chat.scriptstate, aliveAnchors(ctx.chat)).find((o) => o.id === `ho_${part.item.id}`) ?? null : null;
  return { show, part, ordered };
}
/** 맞교환으로 낼 수 있는 내 물건 (택배 상자는 뺀다) */
const barterItems = (ctx: ChatContext): Item[] => {
  const alive = aliveAnchors(ctx.chat);
  return liveItemsOf(readItems(ctx.chat.scriptstate), ctx.chat).filter((x) => !boxOrder(ctx.chat.scriptstate, x.id, alive));
};

/** 전화 주문 확정: 장부에 한 줄, 소지품에 택배 상자. 가계부는 건드리지 않는다. 맞교환이면 고른 물건만 빠지고 장부엔 안 올린다 */
async function order(ctx: ChatContext, env: HsEnv): Promise<void> {
  const s = hsSettings(ctx.chat.scriptstate);
  const barterId = ui.pay === 'barter' ? ui.barter : '';
  if (ui.pay === 'barter' && (!s.barter || !barterId)) return;
  let ok = false;
  let usedBarter = false;
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const show = readShow(chat.scriptstate);
    const part = show.loaded ? show.parts[show.at] : null;
    if (!part) return null;
    const alive = aliveAnchors(chat);
    if (liveOrders(chat.scriptstate, alive).some((o) => o.id === `ho_${part.item.id}`)) return null;
    let items = readItems(chat.scriptstate);
    const anchor = lastBot(chat)?.key ?? '';
    const gave = barterId ? liveItemsOf(items, chat).find((x) => x.id === barterId) : undefined;
    if (barterId && !gave) return null;
    const o = newOrder(chat, part.item, s, gave?.name ?? '');
    if (gave) items = anchor ? sellItem(items, gave.id, anchor, `${HS_NAME} 맞교환`) : removeItem(items, gave.id, 'sell', 'store', '', { note: `${HS_NAME} 맞교환` });
    // 같은 이름의 상자가 이미 있으면(같은 상품을 다시 주문) 한 줄로 합쳐져 못 열게 되므로 번호를 붙인다
    const mine = liveItemsOf(items, chat);
    let name = HS_BOX.name(part.item.name);
    for (let k = 2; k < 20 && mine.some((x) => x.id === itemId(anchor, name) || x.name === name); k++) name = `${HS_BOX.name(part.item.name).slice(0, 27)} ${k}`;
    const paidWith = gave ? `「${gave.name}」 맞교환 (${HS_NAME})` : o.n ? `무이자 할부 ${o.n}회 (${HS_NAME})` : `${part.item.pay || '방송 특가'} (${HS_NAME})`;
    items = addItem(items, alive, { name, desc: HS_BOX.desc, icon: HS_BOX.icon, weight: part.item.weight, from: 'store', anchor, paidWith });
    o.boxId = itemId(anchor, name);
    ok = true;
    usedBarter = !!gave;
    return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...itemsVars(items), ...ordersVars([...readOrders(chat.scriptstate).filter((x) => x.id !== o.id), o]) } };
  });
  if (ok) {
    const ops = readShow(ctx.chat.scriptstate).ops;
    ui.done = (usedBarter ? ops?.barter : ops?.done) || '주문이 접수되었습니다.';
    playerSay('안내', '주문 1건 접수', 'sys');
  }
  await env.refresh();
}

/** 소지품에서 택배 상자 열기: 상자가 빠지고 실제 물건이 들어간다 (모델 호출 없음) */
async function openBox(ctx: ChatContext, env: HsEnv, boxId: string): Promise<void> {
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const alive = aliveAnchors(chat);
    const o = boxOrder(chat.scriptstate, boxId, alive);
    if (!o) return null;
    let items = readItems(chat.scriptstate);
    const box = items.list.find((x) => x.id === boxId);
    if (!box) return null;
    const anchor = lastBot(chat)?.key ?? '';
    // 상자는 지우지 않고 연 응답에 묶어 숨긴다: 그 응답을 다시 굴리면 상자가 미개봉으로 돌아온다
    items = anchor
      ? addItemLog({ ...items, list: items.list.map((x) => (x.id === boxId ? { ...x, soldAt: anchor } : x)) }, { name: box.name, item: boxId, ...(box.icon ? { icon: box.icon } : {}), what: 'use', by: 'manual', anchor, note: '상자를 열었다' })
      : removeItem(items, boxId, 'use', 'manual', '', { note: '상자를 열었다' });
    const it = o.item;
    items = addItem(items, alive, { name: it.name, desc: it.desc, effect: it.effect, truth: it.truth, use: it.use, uses: it.uses, equip: it.equip, icon: it.icon, weight: it.weight, from: 'store', anchor, paidWith: box.paidWith ?? HS_NAME });
    const orders = readOrders(chat.scriptstate).map((x) => (x.id === o.id ? { ...x, openKey: anchor } : x));
    return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...itemsVars(items), ...ordersVars(orders) } };
  });
  await env.refresh();
}

/** 방청 신청: 접수 번호를 주고, 다음 턴 본편에 한 줄만 넘긴다 (그 뒤는 저절로 풀린다) */
async function audience(ctx: ChatContext, env: HsEnv): Promise<void> {
  if (!ui.agree || !hsSettings(ctx.chat.scriptstate).aud) return;
  const no = String(1000 + Math.floor(Math.random() * 9000));
  const name = userInfo().name || '';
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [HS_AUD_VAR]: JSON.stringify({ anchor: lastBot(chat)?.key ?? '', no, name }) } }));
  ui.audNo = no;
  playerSay('안내', `방청 신청 접수 · ${no}번`, 'sys');
  await env.refresh();
}

/** 내가 채팅을 썼을 때만 한 번 더 부른다: 진행자 큐 1~3줄 + 다른 시청자 반응 몇 줄 */
async function say(ctx: ChatContext, env: HsEnv, text: string): Promise<void> {
  const s = hsSettings(ctx.chat.scriptstate);
  const { show, part } = nowPart(ctx);
  if (!text || ui.saying || !s.say || !part) return;
  const nick = userInfo().name || '나';
  ui.input = '';
  ui.saying = true;
  playerSay(nick, text.slice(0, 80), 'me');
  env.render();
  try {
    const art = homeshopArt();
    const names = (cut: 'A' | 'B') => [...new Set((art?.pack.cuts[cut].clips ?? []).filter((c) => c.group !== 'off' && c.group !== 'base').map((c) => c.ko))];
    const g = guideSections('Hs');
    const system = [fillGuide(g.COMMON ?? '', {}), fillGuide(g.SAY ?? '', { say_cue: '1 to 3', say_chat: '2 to 5', cuts: Object.values(CUE_CUT_WORD).join(', '), moods: [...new Set([...names('A'), ...names('B')])].join(', ') || '말하기', events: Object.values(CUE_EVENT_WORD).join(', ') })].filter(Boolean).join('\n\n');
    const st = playerState();
    const recent = part.cues.slice(Math.max(0, (st?.cue ?? 0) - 3), (st?.cue ?? 0) + 1).map((c) => `진행자: ${c.text}`).join('\n');
    const user = `[지금 방송]\n${show.title ? `${show.title} · ` : ''}${show.at + 1}부 「${part.item.name}」 (${part.item.pay ?? ''})\n${part.item.desc}\n\n[방금 진행자]\n${recent || '-'}\n\n[시청자 채팅]\n${nick}: ${text.slice(0, 200)}`;
    const gs = genSettings(ctx.chat.scriptstate);
    const moods = moodMap(art?.pack ?? null);
    const { value } = await generate([{ role: 'system', content: system }, { role: 'user', content: user }] as LlmMessage[], s.shop.model, (raw) => {
      const cueText = /<cue[^>]*>([\s\S]*?)<\/cue\s*>/i.exec(raw)?.[1] ?? '';
      const cues = cueText.split('\n').map((l) => parseCue(l, moods)).filter((c): c is HsCue => !!c).slice(0, 3);
      const chat = (/<chat[^>]*>([\s\S]*?)<\/chat\s*>/i.exec(raw)?.[1] ?? '').split('\n').map((l) => { const k = l.indexOf('|'); return k > 0 ? { nick: l.slice(0, k).trim().slice(0, 16), text: l.slice(k + 1).trim().slice(0, 80) } : null; }).filter((c): c is { nick: string; text: string } => !!c && !!c.text).slice(0, 6);
      if (!cues.length && !chat.length) throw new Error('응답에 <cue>·<chat> 블록이 없어요.');
      return { cues, chat };
    }, { retries: gs.retries, retryModel: gs.retryModel, concurrent: gs.concurrent, state: ctx.chat.scriptstate, label: `${HS_NAME} 채팅` });
    playerCut(value.cues, value.chat);
  } catch (error) {
    ui.info = `채팅이 전달되지 않았어요. ${error instanceof Error ? error.message.split('\n')[0] : ''}`;
  } finally {
    ui.saying = false;
  }
  env.render();
}

// ── 화면 (목업 기획 C안 바탕: 빨간 머리띠 · 방송 칸 + 채팅 · 상품 칸 · 주문 단추 줄 · 그림 든 편성 카드) ──

function scaleOf(s: HsSettings, phone: boolean): number {
  const v: HsScale = phone ? s.scalePhone : s.scalePc;
  // 0 = 칸 폭에 맞춤 (재생기가 꽂힌 칸의 폭으로 잰다)
  if (v === 'fit') return 0;
  if (v !== 'auto') return Number(v);
  const w = typeof window === 'undefined' ? 0 : window.innerWidth;
  return phone ? 0 : w >= 1700 ? 2 : 1;
}

const failBox = () => (ui.notice ? `<div class="hs-err" role="alert"><span>${esc(ui.notice).replace(/\n/g, '<br>')}</span>${ui.failRaw ? '<button data-action="hs-raw">받은 글 보기</button>' : ''}<button data-action="hs-refresh">다시 연결</button></div>` : '');
const payText = (it: { pay?: string }) => { const n = installments(it); return n ? `무이자 ${n}회` : it.pay ?? ''; };

/** 편성 카드 줄. 아직 방송 안 한 부는 가린다 (11-09 사용자: 다음 상품은 방송에서 공개) */
function lineup(show: HsShow, s: HsSettings, col = false): string {
  return `<div class="hs-lu${col ? ' col' : ''}">${show.parts.map((p, i) => {
    const past = i < show.at;
    const now = i === show.at;
    const open = past || now;
    const state = now ? '<span class="st on">방송 중</span>' : past ? `<span class="st off">${s.lock ? '매진' : '방송 종료'}</span>` : '<span class="st">곧 방송</span>';
    const pic = open ? itemPic(p.item) : '<span class="q">?</span>';
    const body = `<span class="pic">${pic}</span><span class="tx"><small>${i + 1}부</small><b>${open ? esc(p.item.name) : '방송에서 공개'}</b>${open ? `<em>${esc(payText(p.item))}</em>` : ''}${col && past ? `<i>${esc(p.item.desc)}</i>` : ''}</span>${state}`;
    return now && col ? `<button class="hs-lc now" data-action="hs-page" data-value="">${body}</button>` : `<div class="hs-lc${now ? ' now' : past ? ' past' : ' soon'}">${body}</div>`;
  }).join('')}</div>`;
}

function onAir(ctx: ChatContext, show: HsShow, s: HsSettings, mobile: boolean): string {
  const { part, ordered } = nowPart(ctx);
  const ended = show.loaded && show.at >= show.parts.length;
  const bar = `<div class="hs-bar"><span class="hs-on${show.loaded && !ended ? '' : ' off'}">${show.loaded && !ended ? 'LIVE' : 'OFF'}</span><b>${esc(show.title || HS_NAME)}</b>${part ? `<span class="hs-pt">${show.at + 1}부 <i>/ ${show.parts.length}부</i></span>` : ''}</div>`;
  const tv = `<div class="hs-tv">${bar}<div class="hs-mount" data-hs-mount="stage"></div></div>`;
  const prod = part
    ? `<div class="hs-prod"><button class="hs-icon" data-action="hs-pop" data-value="peek" aria-label="상품 스티커 보기">${itemPic(part.item)}<span class="hs-stk" aria-hidden="true"></span></button>
<div class="tx"><small>지금 방송 중 · ${show.at + 1}부</small><b>${esc(part.item.name)}</b><p>${esc(part.item.desc)}</p></div>
<div class="pr"><small>오늘 방송에서만</small><b>${esc(payText(part.item)) || '방송 특가'}</b></div></div>`
    : `<div class="hs-prod none"><div class="tx"><b>${ended ? '오늘 방송은 끝났습니다' : '방송 준비 중입니다'}</b><p>${ended ? '새 편성은 새로 고침으로 받아요.' : '잠시만 기다려 주세요.'}</p></div></div>`;
  const ord = `<div class="hs-ord"><button class="call" data-action="hs-pop" data-value="call" ${part && !ordered ? '' : 'disabled'}>☎ ${ordered ? '주문 완료' : '전화 주문'}</button><button data-action="hs-pop" data-value="peek" ${part ? '' : 'disabled'}>상품 스티커 보기</button>${s.aud ? '<button class="aud" data-action="hs-pop" data-value="aud">★ 방청 신청</button>' : ''}</div>`;
  const chatIn = s.say ? `<div class="hs-in"><input name="hs-say" data-input="hs-say" data-enter="hs-say" value="${esc(ui.input)}" maxlength="80" placeholder="${ui.saying ? '보내는 중…' : '채팅 보내기'}" aria-label="채팅 보내기"${ui.saying || !part ? ' disabled' : ''}><button data-action="hs-say"${ui.saying || !part ? ' disabled' : ''}>보내기</button></div>` : '';
  const chat = `<aside class="hs-chat"><h5>실시간 채팅</h5><div class="hs-mount ch-b" data-hs-mount="chat"></div>${chatIn}</aside>`;
  const sched = show.loaded ? `<section class="hs-sec"><h4>오늘 편성<small>지난 상품은 다시 주문할 수 없습니다 · 다음 상품은 방송에서 공개</small></h4>${lineup(show, s)}</section>` : '';
  const info = ui.info ? `<div class="hs-info" role="status">${esc(ui.info)}</div>` : '';
  return mobile
    ? `<div class="hs-main">${tv}${prod}${ord}</div>${info}${chat}${sched}`
    : `<div class="hs-bd"><div class="hs-main">${tv}${prod}${ord}</div>${chat}</div>${info}${sched}`;
}

function schedPage(show: HsShow, s: HsSettings): string {
  if (!show.loaded) return '<section class="hs-sec"><h4>편성표</h4><p class="hs-none">아직 받은 편성이 없습니다.</p></section>';
  return `<section class="hs-sec"><h4>편성표<small>${esc(show.title)}</small></h4>${lineup(show, s, true)}</section>`;
}

/** 주문 조회: 위 할부 장부, 아래 배송. 방청 접수가 있으면 맨 위 한 줄. 누르는 것 없음 */
function ordersPage(ctx: ChatContext): string {
  const alive = aliveAnchors(ctx.chat);
  const list = liveOrders(ctx.chat.scriptstate, alive).slice().reverse();
  const turn = userTurns(ctx.chat);
  const aud = readAudience(ctx.chat.scriptstate);
  const audRow = aud && (!aud.anchor || alive.has(aud.anchor)) ? `<div class="hs-audrow">★ 방청 신청 접수 · 접수번호 <b>${esc(aud.no)}</b></div>` : '';
  const debts = list.filter((o) => o.n > 0);
  const debtRows = debts.map((o) => {
    const paid = Math.min(o.n, paidOf(o, turn));
    const left = o.n - paid;
    return `<li class="${left ? '' : 'done'}"><span class="pic">${itemPic(o.item)}</span><span class="tx"><b>${esc(o.item.name)}</b><small>무이자 ${o.n}회 · 납부 ${paid}회</small></span><span class="bar"><i style="width:${Math.round((paid / o.n) * 100)}%"></i></span><span class="st${left ? ' on' : ''}">${left ? `${left}회 남음` : '완납'}</span></li>`;
  }).join('');
  const shipRows = list.map((o) => {
    const opened = orderOpened(o, alive);
    return `<li><span class="pic">${itemPic(o.item)}</span><span class="tx"><b>${esc(o.item.name)}</b><small>${o.barter ? `현물 결제 · 「${esc(o.barter)}」` : o.n ? `무이자 ${o.n}회` : esc(o.item.pay ?? '')}</small></span><span class="st${opened ? '' : ' on'}">${opened ? '수령 확인' : '배송 완료 · 미개봉'}</span></li>`;
  }).join('');
  return `<section class="hs-sec"><h4>주문 조회</h4>${audRow}
<h5>할부 내역</h5>${debtRows ? `<ul class="hs-ol">${debtRows}</ul>` : '<p class="hs-none">할부 내역이 없습니다.</p>'}
<h5>배송</h5>${shipRows ? `<ul class="hs-ol">${shipRows}</ul><p class="hs-tip">택배 상자는 소지품에서 「열기」로 엽니다.</p>` : '<p class="hs-none">주문 내역이 없습니다.</p>'}</section>`;
}

// ── 창 (전화 주문 · 스티커 보기 · 방청 신청: 같은 틀) ──

const popShell = (title: string, body: string, foot = '') =>
  `<div class="hs-dim"><button class="hs-dimx" data-action="hs-pop" data-value="" aria-label="닫기"></button><div class="hs-pop" role="dialog" aria-label="${esc(title)}"><header><b>${esc(title)}</b><button data-action="hs-pop" data-value="" aria-label="닫기">✕</button></header><div class="pb">${body}</div>${foot ? `<footer>${foot}</footer>` : ''}</div></div>`;

function callPop(ctx: ChatContext, s: HsSettings): string {
  const { show, part, ordered } = nowPart(ctx);
  if (!part) return '';
  const n = installments(part.item);
  const head = `<div class="hs-pi"><span class="pic">${itemPic(part.item)}</span><span class="tx"><b>${esc(part.item.name)}</b><small>${esc(payText(part.item))}</small></span></div>`;
  const op = (t: string) => (t ? `<p class="hs-op"><i>상담원</i>${esc(t)}</p>` : '');
  if (ui.done || ordered) {
    return popShell('☎ 전화 주문', `${head}${op(ui.done || '주문이 접수되었습니다.')}<p class="hs-ok">택배 상자가 소지품에 도착했습니다.</p>`, '<button class="pri" data-action="hs-pop" data-value="">확인</button><button data-action="hs-page" data-value="orders">주문 조회</button>');
  }
  const mine = ui.pay === 'barter' ? barterItems(ctx) : [];
  const pays = `<div class="hs-pays"><button class="${ui.pay === 'inst' ? 'on' : ''}" data-action="hs-pay" data-value="inst" aria-pressed="${ui.pay === 'inst'}"><b>${n ? `무이자 할부 ${n}회` : esc(part.item.pay || '방송 특가')}</b><small>지금 내는 돈 없음</small></button>${s.barter ? `<button class="${ui.pay === 'barter' ? 'on' : ''}" data-action="hs-pay" data-value="barter" aria-pressed="${ui.pay === 'barter'}"><b>물건 맞교환</b><small>가진 물건 하나로 결제</small></button>` : ''}</div>`;
  const pick = ui.pay === 'barter' ? (mine.length ? `<div class="hs-pick">${mine.map((x) => `<button class="${ui.barter === x.id ? 'on' : ''}" data-action="hs-barter" data-value="${esc(x.id)}" aria-pressed="${ui.barter === x.id}"><span class="pic">${itemPic(x)}</span>${esc(x.name)}</button>`).join('')}</div>` : '<p class="hs-none">맞교환할 물건이 없습니다.</p>') : '';
  const can = ui.pay === 'inst' || !!ui.barter;
  return popShell('☎ 전화 주문', `${head}${op(show.ops?.hello ?? '')}${pays}${pick}`, `<button class="pri" data-action="hs-order" ${can ? '' : 'disabled'}>주문 확정</button><button data-action="hs-pop" data-value="">끊기</button>`);
}

function peekPop(ctx: ChatContext, s: HsSettings): string {
  const { part } = nowPart(ctx);
  if (!part) return '';
  const it = part.item;
  const under = part.peek && s.peek ? (ui.lifted ? `<p class="hs-under">${esc(part.peek)}</p>` : '<button class="hs-lift" data-action="hs-lift">스티커 모서리 들추기</button>') : '';
  return popShell('상품 스티커', `<div class="hs-sticker"><span class="pic">${itemPic(it)}</span><b>${esc(it.name)}</b><p>${esc(it.desc)}</p>${it.effect ? `<p class="ef">${esc(it.effect)}</p>` : ''}${under}</div>`);
}

function audPop(): string {
  if (ui.audNo) return popShell('★ 방청 신청', `<p class="hs-ok">접수되었습니다.</p><p class="hs-no">접수번호 <b>${esc(ui.audNo)}</b></p>`, '<button class="pri" data-action="hs-pop" data-value="">확인</button>');
  return popShell('★ 방청 신청', `<label class="hs-f"><span>이름</span><input value="${esc(userInfo().name || '')}" readonly></label>
<button class="hs-chk${ui.agree ? ' on' : ''}" data-action="hs-agree" aria-pressed="${ui.agree}"><i></i>객석 규칙에 동의합니다</button>`, `<button class="pri" data-action="hs-aud" ${ui.agree ? '' : 'disabled'}>신청</button><button data-action="hs-pop" data-value="">취소</button>`);
}

/** 사이트 화면. 그린 뒤 homeshopMounted(root) 로 방송 칸을 꽂는다 */
export function homeshopTab(ctx: ChatContext, env: HsEnv): string {
  liveEnv = env;
  sync(ctx);
  const mobile = isPhone();
  const s = hsSettings(ctx.chat.scriptstate);
  const show = readShow(ctx.chat.scriptstate);
  const stt = homeshopStatus();
  const art = homeshopArt();
  const note = !s.on ? '방송 없음' : stt.failed ? '신호 없음' : !art ? stt.progress || '방송 준비 중' : ui.loading ? '방송 연결 중' : ui.notice ? '신호 없음' : show.loaded ? '' : '신호 없음';
  setPlayerFeed({ art, show: s.on && !ui.loading ? show : { ...show, loaded: false }, s, note, scale: scaleOf(s, mobile), tel: telOf(ctx) }, { advance, redraw: () => liveEnv?.render() });
  const pending = liveOrders(ctx.chat.scriptstate, aliveAnchors(ctx.chat)).length;
  const tabs: [View['page'], string][] = [['', 'ON AIR'], ['sched', '편성표'], ['orders', `주문 조회${pending ? ` ${pending}` : ''}`]];
  const menu = `<nav class="hs-menu">${tabs.map(([k, l]) => `<button class="${ui.page === k ? 'on' : ''}" data-action="hs-page" data-value="${k}" aria-pressed="${ui.page === k}">${l}</button>`).join('')}${s.aud ? '<button data-action="hs-pop" data-value="aud">방청 신청</button>' : ''}</nav>`;
  const head = `<header class="hs-gnb"><span class="hs-logo">망상<i>홈쇼핑</i></span>${menu}<span class="hs-tel"><small>주문 전화</small>☎ ${esc(telOf(ctx))}</span></header>`;
  const err = `${failBox()}${stt.failed ? `<div class="hs-err" role="alert"><span>방송 그림을 받지 못했어요. ${esc(stt.failed)}</span></div>` : ''}`;
  const page = ui.page === 'sched' ? schedPage(show, s) : ui.page === 'orders' ? ordersPage(ctx) : onAir(ctx, show, s, mobile);
  const pop = ui.pop === 'call' ? callPop(ctx, s) : ui.pop === 'peek' ? peekPop(ctx, s) : ui.pop === 'aud' && s.aud ? audPop() : '';
  return `<div class="hs${mobile ? ' hs-m' : ''}">${head}<div class="hs-wrap">${err}${page}</div>${pop}</div>`;
}

/** 화면을 그린 뒤 (app render 끝): 방송 칸에 캔버스·채팅을 꽂는다. 사이트가 안 보이면 멈춘다 */
export function homeshopMounted(root: HTMLElement): void {
  if (root.querySelector('[data-hs-mount="stage"]')) mountPlayer(root);
  else stopPlayer();
}

/** 소지품 상세의 「열기」 단추: 이 물건이 안 연 택배 상자일 때만 (ui/items.ts 가 부른다) */
export function boxButton(ctx: ChatContext, itemIdOf: string): string {
  return boxOrder(ctx.chat.scriptstate, itemIdOf, aliveAnchors(ctx.chat)) ? `<button class="gx-chip" data-action="hs-box-open" data-value="${esc(itemIdOf)}">열기</button>` : '';
}

// ── 설정 페이지 (우주몰·포인트몰과 같은 틀. 하드코딩 금지: 재생 규칙·효과·속도·줄 수 전부 여기서) ──

/** 상점 설정 이름 (사이트 앞붙이 없이) → 설정 화면 키 */
const SH: Record<string, string> = { model: '$sh_model', ctx: '$sh_ctx', price: '$sh_price', diverse: '$sh_diverse', thoughts: '$sh_thoughts', prev: '$sh_prev', min: '$sh_min', max: '$sh_max', turns: '$sh_turns', refs: '$sh_refs' };
const SH_RANGE: Record<string, [number, number]> = { min: [SHOP_SIZE_LO, SHOP_SIZE_HI], max: [SHOP_SIZE_LO, SHOP_SIZE_HI], turns: [1, 8], refs: [0, 12] };
/** 켬/끔 칸: 설정 키 → 변수 이름 */
const FLAG: Record<string, string> = { on: HS_KEY.on, net: HS_KEY.net, cut: HS_KEY.cut, bulb: HS_KEY.bulb, tear: HS_KEY.tear, scan: HS_KEY.scan, turn: HS_KEY.turn, lock: HS_KEY.lock, aud: HS_KEY.aud, peek: HS_KEY.peek, say: HS_KEY.say, barter: HS_KEY.barter };

export function homeshopSettingsPane(ctx: ChatContext): string {
  const vars = ctx.chat.scriptstate;
  const s = hsSettings(vars);
  const art = homeshopArt();
  const clipHelp = art
    ? (['A', 'B'] as const).map((c) => `${c === 'A' ? '와이드' : '바스트'}: ${[...new Map(art.pack.cuts[c].clips.map((k) => [k.name, `${k.ko}(${CLIP_GROUP_LABEL[k.group]})`])).values()].join(', ')}`).join('<br>')
    : '방송 그림을 받으면 동작 목록이 보여요.';
  // 줄은 정의표(core/setdef/homeshop.ts)에서 온다. 여기는 값을 읽어 주는 선만 잇는다
  const b = (x: boolean) => (x ? '1' : '0');
  const n = (k: string) => { const raw = vars?.[HS_NUM[k].key]; return raw === undefined || raw === '' ? HS_NUM[k].def : Number(raw); };
  const vals: Record<string, string> = {
    on: b(s.on), net: b(s.net), auto: s.auto, retry: String(retryOf(ctx)), tel: String(vars?.[HS_TEL_KEY] ?? ''),
    'sh:model': s.shop.model, 'sh:ctx': b(s.shop.context), 'sh:price': s.shop.price, 'sh:diverse': b(s.shop.diverse), 'sh:prev': b(s.shop.avoidPrev), 'sh:thoughts': s.shop.thoughts,
    turns: String(s.shop.turns), refs: String(s.shop.refs), turn: b(s.turn), lock: b(s.lock), say: b(s.say), barter: b(s.barter), peek: b(s.peek), aud: b(s.aud),
    forms: String(vars?.[HS_KEY.forms] ?? ''), clips: s.clipsText, cut: b(s.fx.cut), bulb: b(s.fx.bulb), tear: b(s.fx.tear), scan: b(s.fx.scan), scalePc: s.scalePc, scalePh: s.scalePhone,
  };
  const pairs: Record<string, [string, string]> = { cue: ['cueMin', 'cueMax'], chat: ['chatMin', 'chatMax'], call: ['callLo', 'callHi'], fill: ['fillLo', 'fillHi'] };
  const wire: Wire = {
    cur: (k) => vals[k] ?? String(n(k)),
    minmax: (k) => (k === 'size' ? s.shop.size : [n(pairs[k][0]), n(pairs[k][1])]),
    help: { clips: () => `한 줄에 「컷:동작=분류」. 컷은 A(와이드)·B(바스트), 분류는 기본·가끔·대사·드물게·안씀. 비우면 아래 기본값.<br>${clipHelp}` },
  };
  // 4단계: 상점 표로 올라간 줄을 빼고 남은 줄을 하는 일대로 다시 묶는다
  const all = HOMESHOP_SET.groups.flatMap((g) => g.rows);
  const pick = (title: string, keys: string[], note?: string) => ({ title, note, rows: keys.map((k) => all.find((r) => r.key === k)!).filter(Boolean) });
  const page: typeof HOMESHOP_SET = { ...HOMESHOP_SET, groups: [
    pick('', ['net', 'retry', 'say']),
    pick('편성', ['cue', 'chat']),
    pick('방송 흐름', ['speed', 'hold', 'frame', 'chatGap', 'next', 'left', 'turn', 'lock']),
    pick('주문', ['barter', 'peek']),
    pick('컨텍스트 포함', ['call', 'forms', 'aud']),
    pick('진행자 동작', ['fill', 'fillCool', 'rareP', 'rareCool', 'clips'], HOMESHOP_SET.groups.find((g) => g.title === '진행자 동작')?.note),
    pick('방송 화면', ['tel', 'cut', 'bulb', 'tear', 'tearP', 'scan', 'scalePc', 'scalePh']),
  ] };
  const body = defGroups(page, wire);
  return `<div class="ph-form"><header class="ph-room-head"><div class="ph-room-title"><b>${HS_NAME} 설정</b></div></header><div class="ph-form-body ps">${body}</div></div>`;
}

/** hs-cfg 「키=값」 · hs-num 「키=숫자」 · hs-shnum · hs-text 「키=글」 · hs-retry */
async function homeshopSettingsAction(action: string, value: string | undefined, ctx: ChatContext, env: HsEnv): Promise<boolean> {
  if (!['hs-cfg', 'hs-num', 'hs-shnum', 'hs-text', 'hs-retry'].includes(action)) return false;
  const set = async (vars: Record<string, string>) => {
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => (Object.entries(vars).every(([k, v]) => String(chat.scriptstate?.[k] ?? '') === v) ? null : { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...vars } }));
    await env.refresh();
    return true;
  };
  if (action === 'hs-retry') {
    const n = retryOf(ctx) + (String(value).endsWith('+') ? 1 : -1);
    return set({ [HS_RETRY_KEY]: String(Math.max(0, Math.min(3, n))) });
  }
  const m = /^([\w:]+)=([\s\S]*)$/.exec(value ?? '');
  if (!m) return true;
  const [, k, v] = m;
  if (action === 'hs-cfg') {
    if (FLAG[k]) return set({ [FLAG[k]]: v === '0' ? '0' : '' });
    if (k === 'auto') return set({ [HS_KEY.auto]: v === 'manual' ? 'manual' : '' });
    if (k === 'scalePc' || k === 'scalePh') return ['auto', 'fit', '0.5', '1', '2'].includes(v) ? set({ [k === 'scalePc' ? HS_KEY.scalePc : HS_KEY.scalePhone]: v }) : true;
    if (k.startsWith('sh:') && SH[k.slice(3)]) return set({ [hsKey(SH[k.slice(3)])]: v });
    return true;
  }
  if (action === 'hs-num') {
    const d = HS_NUM[k];
    const n = Math.round(Number(v));
    if (!d || !Number.isFinite(n) || v.trim() === '') return env.render(), true;
    return set({ [d.key]: String(Math.max(d.lo, Math.min(d.hi, n))) });
  }
  if (action === 'hs-shnum') {
    const r = SH_RANGE[k];
    const n = Math.floor(Number(v));
    if (!r || !Number.isFinite(n) || v.trim() === '') return env.render(), true;
    const val = String(Math.max(r[0], Math.min(r[1], n)));
    const s = hsSettings(ctx.chat.scriptstate).shop;
    const extra: Record<string, string> = {};
    // 최소·최대는 늘 둘 다 적는다 (기본 3~5 를 한쪽만 고쳐도 다른 쪽이 상점 기본으로 튀지 않게)
    if (k === 'min') extra[hsKey('$sh_max')] = String(Math.max(Number(val), s.size[1]));
    if (k === 'max') extra[hsKey('$sh_min')] = String(Math.min(Number(val), s.size[0]));
    return set({ [hsKey(SH[k])]: val, ...extra });
  }
  // hs-text
  if (k === 'tel') return set({ [HS_TEL_KEY]: v.replace(/\s+/g, ' ').trim().slice(0, 20) });
  if (k === 'clips') return set({ [HS_KEY.clips]: v.trim().slice(0, 2000) });
  if (k === 'forms') return set({ [HS_KEY.forms]: v.replace(/\s+/g, ' ').trim().slice(0, 200) });
  if (k === 'sh:price') return set({ [hsKey('$sh_price')]: v.replace(/\s+/g, ' ').trim().slice(0, 80) });
  return true;
}
