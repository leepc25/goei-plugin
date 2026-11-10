// 망상홈쇼핑 사이트 화면 (2026-11-11 사용자: 컷 A·B 두 장면으로 방송 화면 구현. 인터넷 즐겨찾기로도, 카드로 연 독립 창(인터넷 창만)으로도 같은 화면).
// 모양은 11-10 도트 시안(site_mock_dot: 도트 글꼴·2px 테두리·판 색)을 그대로. 방송 칸은 재생기(ui/hsplayer.ts)가 그린다.
// 편성 호출은 상점 요청문(core/shop.ts shelfPrompt)에 방송 절(지침 「망상홈쇼핑」 BROADCAST)을 붙여 한 번에: 상품·상품마다 큐시트·채팅.
// 설정은 우주몰·포인트몰과 같은 틀(설정 → 인터넷 → 망상홈쇼핑). 재생 규칙·효과·속도 모두 설정에서 고친다.
import type { ChatContext } from '../host/risu';
import { updateChat } from '../host/risu';
import { generate, type LlmMessage } from '../host/llm';
import { genSettings } from '../core/advanced';
import { emptyShop, lastBot, shelfPrompt, SHOP_SIZE_HI, SHOP_SIZE_LO, type ShopState } from '../core/shop';
import { fillGuide, guideSections } from '../core/guides';
import { applyShow, CLIP_GROUP_LABEL, CUE_CUT_WORD, CUE_EVENT_WORD, HS_AT_VAR, HS_HOST, HS_KEY, HS_NAME, HS_NUM, hsKey, hsSettings, hsVars, installments, moodMap, parseShow, readShow, showVars, type HsScale, type HsSettings, type HsShow } from '../core/homeshop';
import { homeshopArt, homeshopStatus, onHomeshopReady } from '../host/homeshop';
import { mountPlayer, setPlayerFeed, stopPlayer } from './hsplayer';
import { shopSource } from './shop';
import { itemPic } from './items';
import { onOffSwitch } from './controls';
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
  page: '' | 'sched';
  /** 자동 다시 연결을 몇 번 했나 (이번 실패 묶음) */
  retried: number;
}
const fresh = (): View => ({ loading: false, notice: '', failRaw: '', page: '', retried: 0 });
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
export const HS_TEL_DEFAULT = '080-404-0000';
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
    await updateChat(cur.charIndex, cur.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...showVars(applyShow(readShow(chat.scriptstate), value, key)), [HS_AT_VAR]: key } }));
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
  const key = lastBot(ctx.chat)?.key ?? '';
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
      ui.page = value === 'sched' ? 'sched' : '';
      env.render();
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

// ── 화면 ──

function scaleOf(s: HsSettings, phone: boolean): number {
  const v: HsScale = phone ? s.scalePhone : s.scalePc;
  if (v !== 'auto') return Number(v);
  const w = typeof window === 'undefined' ? 0 : window.innerWidth;
  return phone ? (w >= 560 ? 1 : 0.5) : w >= 1500 ? 2 : 1;
}

const failBox = () => (ui.notice ? `<div class="hs-err" role="alert">${esc(ui.notice).replace(/\n/g, '<br>')}${ui.failRaw ? ' <button data-action="hs-raw">받은 글 보기</button>' : ''} <button data-action="hs-refresh">다시 연결</button></div>` : '');

function schedule(show: HsShow, s: HsSettings): string {
  if (!show.loaded) return '';
  return show.parts.map((p, i) => {
    const past = i < show.at;
    const now = i === show.at;
    // 아직 방송 안 한 부는 가린다 (11-09 사용자: 다음 상품은 방송에서 공개)
    const name = past || now ? esc(p.item.name) : '???';
    return `<div class="hs-sl${past ? (s.lock ? ' past' : ' gone') : now ? ' now' : ' q'}"><div class="b">${i + 1}부${now ? ' · 방송 중' : ''}</div>${name}</div>`;
  }).join('');
}

function onAir(ctx: ChatContext, show: HsShow, s: HsSettings, mobile: boolean): string {
  const part = show.loaded ? show.parts[show.at] : null;
  const n = part ? installments(part.item) : 0;
  const info = part
    ? `<div class="hs-oa hs-px"><div class="hs-icon">${itemPic(part.item)}</div><div class="t"><div class="k">지금 방송 중 · ${show.at + 1}부</div><div class="nm2">${esc(part.item.name)}</div><div class="d">${esc([n ? `무이자 할부 ${n}회` : part.item.pay ?? '', part.item.desc].filter(Boolean).join(' · '))}</div></div></div>`
    : '';
  const sched = show.loaded ? `<div class="hs-sch"><span>오늘 편성${show.title ? ` · ${esc(show.title)}` : ''}</span><span class="dim">지난 부는 다시 못 삽니다 · 다음 상품은 방송에서 공개</span></div><div class="hs-sc">${schedule(show, s)}</div>` : '';
  const tv = `<div class="hs-tv"><div class="hs-mount" data-hs-mount="stage"></div></div>`;
  const chat = `<div class="hs-chat hs-px"><div class="ch-h"><span>실시간 채팅</span></div><div class="hs-mount ch-b" data-hs-mount="chat"></div></div>`;
  void ctx;
  return mobile ? `${tv}${info}${chat}${sched}` : `<div class="hs-row">${tv}${chat}</div>${info}${sched}`;
}

function schedPage(show: HsShow, s: HsSettings): string {
  if (!show.loaded) return '<div class="hs-oa hs-px"><div class="t"><div class="d">아직 받은 편성이 없습니다.</div></div></div>';
  return `<div class="hs-sch"><span>오늘 편성${show.title ? ` · ${esc(show.title)}` : ''}</span></div><div class="hs-sc col">${schedule(show, s)}</div>`;
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
  const menu = `<nav class="hs-menu"><button class="${ui.page === '' ? 'on' : ''}" data-action="hs-page" data-value="">ON AIR</button><button class="${ui.page === 'sched' ? 'on' : ''}" data-action="hs-page" data-value="sched">편성표</button></nav>`;
  const head = `<div class="hs-hd hs-px"><span class="hs-logo">망상홈쇼핑</span>${menu}${mobile ? '' : `<span class="hs-tel">☎ ${esc(telOf(ctx))}</span>`}</div>`;
  const err = `${failBox()}${stt.failed ? `<div class="hs-err" role="alert">방송 그림을 받지 못했어요. ${esc(stt.failed)}</div>` : ''}`;
  return `<div class="hs${mobile ? ' hs-m' : ''}"><div class="hs-win">${head}${err}${ui.page === 'sched' ? schedPage(show, s) : onAir(ctx, show, s, mobile)}</div></div>`;
}

/** 화면을 그린 뒤 (app render 끝): 방송 칸에 캔버스·채팅을 꽂는다. 사이트가 안 보이면 멈춘다 */
export function homeshopMounted(root: HTMLElement): void {
  if (root.querySelector('[data-hs-mount="stage"]')) mountPlayer(root);
  else stopPlayer();
}

// ── 설정 페이지 (우주몰·포인트몰과 같은 틀. 하드코딩 금지: 재생 규칙·효과·속도·줄 수 전부 여기서) ──

const row = (label: string, control: string, hint = '') =>
  `<div class="ps-row"><div class="ps-label"><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</div><div class="ps-ctl">${control}</div></div>`;
const group = (title: string, rows: string) => `<section class="ps-group"><h3>${title}</h3><div class="ps-rows">${rows}</div></section>`;
function seg(key: string, cur: string, items: [string, string][]): string {
  const sw = onOffSwitch(items, cur, 'hs-cfg', (v) => `${key}=${v}`);
  if (sw) return sw;
  return `<div class="gx-segs gx-segs-sm">${items.map(([v, l]) => `<button class="gx-seg${cur === v ? ' on' : ''}" data-action="hs-cfg" data-value="${key}=${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
}
const ONOFF: [string, string][] = [['1', 'ON'], ['0', 'OFF']];
const num = (vars: Record<string, unknown> | undefined, k: keyof typeof HS_NUM, label: string) => {
  const d = HS_NUM[k];
  const raw = vars?.[d.key];
  const cur = raw === undefined || raw === '' ? d.def : Number(raw);
  return `<input class="gx-search ph-pct" type="number" min="${d.lo}" max="${d.hi}" data-change="hs-num" data-key="${k}" value="${cur}" aria-label="${esc(label)}"><span>${d.unit}</span>`;
};
const pairBox = (vars: Record<string, unknown> | undefined, a: keyof typeof HS_NUM, b: keyof typeof HS_NUM, label: string) =>
  `<span class="ph-inline"><span>최소</span>${num(vars, a, `${label} 최소`)}<span>최대</span>${num(vars, b, `${label} 최대`)}</span>`;
/** 상점 설정 이름 (사이트 앞붙이 없이) → 설정 화면 키 */
const SH: Record<string, string> = { model: '$sh_model', ctx: '$sh_ctx', price: '$sh_price', diverse: '$sh_diverse', thoughts: '$sh_thoughts', prev: '$sh_prev', min: '$sh_min', max: '$sh_max', turns: '$sh_turns', refs: '$sh_refs' };
const SH_RANGE: Record<string, [number, number]> = { min: [SHOP_SIZE_LO, SHOP_SIZE_HI], max: [SHOP_SIZE_LO, SHOP_SIZE_HI], turns: [1, 8], refs: [0, 12] };
const shNum = (key: string, cur: number, unit: string, label: string) =>
  `<input class="gx-search ph-pct" type="number" min="${SH_RANGE[key][0]}" max="${SH_RANGE[key][1]}" data-change="hs-shnum" data-key="${key}" value="${cur}" aria-label="${esc(label)}"><span>${unit}</span>`;
/** 켬/끔 칸: 설정 키 → 변수 이름 */
const FLAG: Record<string, string> = { on: HS_KEY.on, net: HS_KEY.net, cut: HS_KEY.cut, bulb: HS_KEY.bulb, tear: HS_KEY.tear, scan: HS_KEY.scan, turn: HS_KEY.turn, lock: HS_KEY.lock };

export function homeshopSettingsPane(ctx: ChatContext): string {
  const vars = ctx.chat.scriptstate;
  const s = hsSettings(vars);
  const art = homeshopArt();
  const clipHelp = art
    ? (['A', 'B'] as const).map((c) => `${c === 'A' ? '와이드' : '바스트'}: ${[...new Map(art.pack.cuts[c].clips.map((k) => [k.name, `${k.ko}(${CLIP_GROUP_LABEL[k.group]})`])).values()].join(', ')}`).join('<br>')
    : '방송 그림을 받으면 동작 목록이 보여요.';
  const scales: [string, string][] = [['auto', '자동'], ['0.5', '0.5배'], ['1', '1배'], ['2', '2배']];
  const body = [
    group(HS_NAME, [
      row('사용', seg('on', s.on ? '1' : '0', ONOFF), '끄면 방송이 나오지 않고 즐겨찾기에서도 빠져요.'),
      row('인터넷에 상시 노출', seg('net', s.net ? '1' : '0', ONOFF), '켜면 인터넷 즐겨찾기에 늘 보여요. 꺼도 본편에서 카드로 접속하면 열려요(설정 → 소지품 → 고유 상점).'),
      row('자동 호출', seg('auto', s.auto, [['manual', '수동'], ['open', '창을 열 때']]), s.auto === 'manual' ? '새로 고침을 눌렀을 때만 새 편성을 받아요.' : '사이트를 열 때, 지난 편성이 끝났거나 본편이 진행됐으면 한 번 새로 받아요.'),
      row('자동 다시 연결', `<input class="gx-search ph-pct" type="number" min="0" max="3" data-change="hs-retry" value="${retryOf(ctx)}" aria-label="자동 다시 연결"><span>회</span>`, '편성을 받지 못하면 「신호 없음」 화면에서 스스로 다시 연결하는 횟수예요(0~3).'),
      row('주문 전화번호', `<input class="gx-search ps-text" data-change="hs-text" data-key="tel" value="${esc(String(vars?.[HS_TEL_KEY] ?? ''))}" maxlength="20" placeholder="${HS_TEL_DEFAULT}">`, '방송 화면과 머리에 보이는 번호예요.'),
    ].join('')),
    group('편성', [
      row('모델', seg('sh:model', s.shop.model, [['main', '메인 모델'], ['aux', '보조 모델']]), '상품·큐시트·채팅을 지을 모델이에요. 한 번 호출로 다 받아요.'),
      row('컨텍스트에 포함', seg('sh:ctx', s.shop.context ? '1' : '0', ONOFF), '켜면 최근 본문·상태창·진행 중 괴이·신분을 같이 넘겨요.'),
      row('상품 수', `<span class="ph-inline"><span>최소</span>${shNum('min', s.shop.size[0], '개', '상품 수 최소')}<span>최대</span>${shNum('max', s.shop.size[1], '개', '상품 수 최대')}</span>`, `한 편성의 상품(부) 수예요(${SHOP_SIZE_LO}~${SHOP_SIZE_HI}).`),
      row('상품마다 큐 줄 수', pairBox(vars, 'cueMin', 'cueMax', '큐 줄 수'), '상품 하나에 진행자가 말하는 장면 수예요.'),
      row('채팅 줄 수', pairBox(vars, 'chatMin', 'chatMax', '채팅 줄 수'), '한 번에 받아 두고 방송 동안 흘리는 시청자 채팅 줄 수예요.'),
      row('값 기준', `<input class="gx-search ps-text" data-change="hs-text" data-key="sh:price" value="${esc(s.shop.price)}" maxlength="80" placeholder="비우면 방송에 어울리는 회차">`),
      row('다양성 강화', seg('sh:diverse', s.shop.diverse ? '1' : '0', ONOFF)),
      row('지난 목록 피하기', seg('sh:prev', s.shop.avoidPrev ? '1' : '0', ONOFF), '새 편성을 받을 때 지난 편성의 상품을 피해요.'),
      row('생각 단계', seg('sh:thoughts', s.shop.thoughts, [['off', '사용 안 함'], ['inner', '속으로만'], ['note', '적고 지움']])),
      row('최근 본문 턴 수', shNum('turns', s.shop.turns, '턴', '최근 본문 턴 수'), '컨텍스트에 포함일 때 넘기는 턴 수예요(1~8).'),
      row('참고 로어북 수', shNum('refs', s.shop.refs, '개', '참고 로어북 수'), '0~12.'),
    ].join('')),
    group('방송 흐름', [
      row('자막 속도', num(vars, 'speed', '자막 속도'), '진행자 대사가 찍히는 빠르기예요. 대사 길이가 장면 길이를 정해요.'),
      row('대사 뒤 쉼', num(vars, 'hold', '대사 뒤 쉼'), '대사가 다 찍힌 뒤 다음 장면으로 넘어가기까지예요(12 = 1.2초).'),
      row('동작 한 장 길이', num(vars, 'frame', '동작 한 장 길이'), '진행자 동작이 한 장 넘어가는 시간이에요. 작을수록 빨라요.'),
      row('채팅 간격', num(vars, 'chatGap', '채팅 간격'), '채팅 한 줄이 올라오는 평균 간격이에요(22 = 2.2초).'),
      row('다음 부까지', num(vars, 'next', '다음 부까지'), '큐시트가 끝난 뒤 다음 상품으로 넘어가기까지예요. 0이면 스스로 넘어가지 않아요.'),
      row('남은 수량 시작 값', num(vars, 'left', '남은 수량 시작 값')),
      row('지난 부 잠그기', seg('lock', s.lock ? '1' : '0', ONOFF), '켜면 지난 부에 「매진」 딱지가 붙어요.'),
    ].join('')),
    group('진행자 동작', `<p class="ps-note">아무 일 없을 때는 「기본」 동작을 되풀이하다가, 정해진 횟수마다 「가끔」 동작을 하나 끼워요. 그 자리에서 확률로 「드물게」 동작이 대신 나와요. 「대사·사건」 동작은 큐시트의 표정에 맞춰서만 나와요. 같은 동작의 1·2판은 번갈아 써요.</p>` + [
      row('「가끔」 동작 간격', pairBox(vars, 'fillLo', 'fillHi', '가끔 동작 간격'), '기본 동작을 이만큼 되풀이한 뒤 하나 끼워요.'),
      row('「가끔」 다시 나오기까지', num(vars, 'fillCool', '가끔 다시 나오기까지'), '같은 동작이 다시 나오기까지 기본 동작 되풀이 수예요.'),
      row('「드물게」 확률', num(vars, 'rareP', '드물게 확률'), '「가끔」 자리마다 이 확률로 섬뜩한 동작이 나와요.'),
      row('「드물게」 다시 나오기까지', num(vars, 'rareCool', '드물게 다시 나오기까지')),
      row('동작 분류 고치기', `<textarea class="gx-search ms-area" rows="4" data-change="hs-text" data-key="clips" placeholder="B:찢어지는 미소=안씀&#10;B:웃음=드물게">${esc(s.clipsText)}</textarea>`, `한 줄에 「컷:동작=분류」. 컷은 A(와이드)·B(바스트), 분류는 기본·가끔·대사·드물게·안씀. 비우면 아래 기본값.<br>${clipHelp}`),
    ].join('')),
    group('화면 효과', [
      row('컷 전환', seg('cut', s.fx.cut ? '1' : '0', ONOFF), '끄면 진행자 정면(바스트) 한 장면만 써요.'),
      row('전구 반짝임', seg('bulb', s.fx.bulb ? '1' : '0', ONOFF)),
      row('신호 찢김', seg('tear', s.fx.tear ? '1' : '0', ONOFF), '0.2~0.4초 동안 화면이 찢기고 다른 얼굴이 끼어들어요.'),
      row('찢김 확률', num(vars, 'tearP', '찢김 확률'), '장면이 바뀔 때마다 저절로 찢길 확률이에요. 큐시트의 「신호 찢김」은 늘 나와요.'),
      row('주사선', seg('scan', s.fx.scan ? '1' : '0', ONOFF)),
      row('PC 표시 배율', seg('scalePc', s.scalePc, scales), '자동 = 창이 넓으면 2배, 아니면 1배.'),
      row('폰 표시 배율', seg('scalePh', s.scalePhone, scales), '자동 = 좁은 화면은 0.5배.'),
    ].join('')),
  ].join('');
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
    const n = Math.round(Number(value));
    return Number.isFinite(n) && String(value).trim() !== '' ? set({ [HS_RETRY_KEY]: String(Math.max(0, Math.min(3, n))) }) : (env.render(), true);
  }
  const m = /^([\w:]+)=([\s\S]*)$/.exec(value ?? '');
  if (!m) return true;
  const [, k, v] = m;
  if (action === 'hs-cfg') {
    if (FLAG[k]) return set({ [FLAG[k]]: v === '0' ? '0' : '' });
    if (k === 'auto') return set({ [HS_KEY.auto]: v === 'manual' ? 'manual' : '' });
    if (k === 'scalePc' || k === 'scalePh') return ['auto', '0.5', '1', '2'].includes(v) ? set({ [k === 'scalePc' ? HS_KEY.scalePc : HS_KEY.scalePhone]: v }) : true;
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
  if (k === 'sh:price') return set({ [hsKey('$sh_price')]: v.replace(/\s+/g, ' ').trim().slice(0, 80) });
  return true;
}
