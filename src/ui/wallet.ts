// 가계부 탭 (2026-10-27 사용자): 장부(core/wallet.ts, $st_wallet)를 장부 모양으로. 저장 형식·갱신기는 그대로, 화면만.
// 위: 잔고(✎ 고치기, 시작·거래 수) · 수입 · 지출 · 오늘. 그 아래 거르기·찾기. 목록은 상태창 날짜별 묶음,
// 줄마다 출처 아이콘(본문·필드·직접) · 메모 · 근거(필드는 장면·시각) · 금액 · 그 뒤 잔고. 지우기는 PC는 마우스를 올리면, 모바일은 줄을 누르면.
// PC는 왼쪽 메뉴, 모바일은 머리 잔고 단추·ID카드 잔고 칩으로 들어온다 (모바일 아래 바는 다섯 칸이 꽉 차 있음).
import type { ChatContext } from '../host/risu';
import { aliveAnchors, formatDelta, formatWon, liveWallet, readWallet, walletBalance, WALLET_START_DEFAULT, type WalletEntry } from '../core/wallet';
import { colConfig } from '../core/world/statuscols';
import { findStatusTags } from '../core/world/status';
import { getPrefs } from '../core/settings';
import { messageKey } from '../core/people/store';
import { ICONS } from './icons';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const walletUi: { filter: 'all' | 'in' | 'out'; q: string; open: string | null; edit: boolean; notice: string } = { filter: 'all', q: '', open: null, edit: false, notice: '' };

/** 이 채팅이 잔고 칸을 쓰나 (끄면 가계부 메뉴·잔고 단추도 숨김) */
export const walletOn = (ctx: ChatContext) => colConfig(ctx.chat.scriptstate).wallet !== 'off';

export const walletOf = (ctx: ChatContext) => readWallet(ctx.chat.scriptstate, getPrefs().walletStart ?? WALLET_START_DEFAULT);

export function balanceText(ctx: ChatContext): string {
  return formatWon(walletBalance(walletOf(ctx), aliveAnchors(ctx.chat)));
}

/** 모바일 머리 잔고 단추 → 가계부 탭 (가계부 탭 안에서는 숨김: 잔고가 탭에 크게 있고, 좁은 머리에서 제목이 밀림) */
export function walletHeadButton(ctx: ChatContext, here = false): string {
  if (!walletOn(ctx) || here) return '';
  return `<button class="gx-hwallet" data-action="tab" data-value="wallet" aria-label="가계부 · 잔고 ${esc(balanceText(ctx))}">${esc(balanceText(ctx))}</button>`;
}

const SRC_ICON: Record<WalletEntry['src'], string> = { story: ICONS.phone, field: ICONS.game, manual: ICONS.pen };
const SRC_NAME: Record<WalletEntry['src'], string> = { story: '본문', field: '필드', manual: '직접 수정' };
const WEEK = '일월화수목금토';

/** 메시지마다 그때까지의 마지막 상태창 날짜 (거래를 날짜별로 묶는 데 쓴다. 장부에는 날짜가 없다) */
function datesOf(ctx: ChatContext): { at: Map<string, string>; today: string } {
  const at = new Map<string, string>();
  let cur = '';
  (ctx.chat.message ?? []).forEach((m, i) => {
    const tags = findStatusTags(String((m as { data?: unknown }).data ?? ''));
    if (tags.length) cur = tags[tags.length - 1].date.trim() || cur;
    at.set(messageKey(m, i), cur);
  });
  return { at, today: cur };
}
function dayLabel(date: string): string {
  const m = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(date);
  if (!m) return date || '날짜 없음';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${m[1]}.${m[2].padStart(2, '0')}.${m[3].padStart(2, '0')} (${WEEK[d.getUTCDay()]})`;
}
const shortDay = (date: string) => /\d{4}\D+(\d{1,2})\D+(\d{1,2})/.exec(date)?.slice(1).map((x) => x.padStart(2, '0')).join('.') ?? '';

interface Row { e: WalletEntry; after: number; date: string }

function rowsOf(ctx: ChatContext): { rows: Row[]; today: string; start: number } {
  const w = walletOf(ctx);
  const live = liveWallet(w, aliveAnchors(ctx.chat));
  const { at, today } = datesOf(ctx);
  let bal = w.start;
  let last = '';
  const rows = live.map((e) => {
    bal += e.amount;
    // 기준 메시지가 없는 수동 수정은 앞 거래 날짜에 붙인다
    const date = e.anchor ? at.get(e.anchor) ?? '' : last;
    last = date;
    return { e, after: bal, date };
  });
  return { rows, today, start: w.start };
}

/** 줄 둘째 칸: 본문 = 근거 인용, 필드 = 장면·시각, 직접 = 「직접 수정」 */
function subOf(e: WalletEntry): string {
  if (e.src === 'field') return [e.place, e.time].filter(Boolean).join(' ') || '필드';
  if (e.src === 'manual') return '직접 수정';
  return e.quote ? `「${e.quote}」` : '';
}

/** 목록만 (찾기 칸을 칠 때 이 부분만 다시 그린다) */
export function walletList(ctx: ChatContext): string {
  const { rows } = rowsOf(ctx);
  const q = walletUi.q.trim().toLowerCase();
  const shown = rows
    .filter(({ e }) => (walletUi.filter === 'in' ? e.amount > 0 : walletUi.filter === 'out' ? e.amount < 0 : true))
    .filter(({ e }) => !q || `${e.memo} ${e.quote ?? ''} ${e.place ?? ''}`.toLowerCase().includes(q))
    .reverse();
  if (!shown.length) return `<p class="gx-wt-empty">${rows.length ? '맞는 거래가 없어요.' : '아직 거래가 없어요. 본문에 금액이 적힌 거래나 필드에서 사고판 것이 여기에 쌓여요.'}</p>`;
  const groups: { date: string; rows: Row[] }[] = [];
  for (const r of shown) {
    const g = groups[groups.length - 1];
    if (g && g.date === r.date) g.rows.push(r);
    else groups.push({ date: r.date, rows: [r] });
  }
  return groups.map((g) => `<section class="gx-wt-day">
    <h3><span>${esc(dayLabel(g.date))}</span><em>${esc(formatDelta(g.rows.filter((r) => r.e.src !== 'manual').reduce((n, r) => n + r.e.amount, 0)))}</em></h3>
    <ul>${g.rows.map(({ e, after }) => {
      const open = walletUi.open === e.id;
      const sub = subOf(e);
      return `<li class="gx-wt-row${open ? ' open' : ''}">
        <button class="gx-wt-main" data-action="wallet-open" data-value="${esc(e.id)}" aria-expanded="${open}" aria-label="${esc(`${SRC_NAME[e.src]} · ${e.memo} ${formatDelta(e.amount)}`)}">
          <span class="gx-wt-ic ${e.src}" title="${SRC_NAME[e.src]}">${SRC_ICON[e.src]}</span>
          <span class="gx-wt-memo"><b>${esc(e.memo || '(메모 없음)')}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>
          <span class="gx-wt-amt"><b class="${e.amount < 0 ? 'out' : 'in'}">${esc(formatDelta(e.amount))}</b><small>${esc(after.toLocaleString('en-US'))}</small></span>
        </button>
        <button class="gx-wt-del" data-action="wallet-del" data-value="${esc(e.id)}" aria-label="이 거래 지우기">✕</button>
      </li>`;
    }).join('')}</ul>
  </section>`).join('');
}

export function walletTab(ctx: ChatContext): string {
  if (!walletOn(ctx)) {
    return `<main class="gx-body gx-wallettab"><div class="gx-empty">이 채팅은 상태창 「잔고」 칸을 쓰지 않아요. 설정 → 상황판 → 상태창 칸에서 켜면 가계부가 생겨요.</div></main>`;
  }
  const { rows, today, start } = rowsOf(ctx);
  const sum = (f: (r: Row) => boolean) => rows.filter(f).reduce((n, r) => n + r.e.amount, 0);
  // 「직접 수정」은 수입·지출에 넣지 않는다 (잔고를 맞춘 값이라)
  const real = (r: Row) => r.e.src !== 'manual';
  const income = sum((r) => real(r) && r.e.amount > 0);
  const spend = -sum((r) => real(r) && r.e.amount < 0);
  const inN = rows.filter((r) => real(r) && r.e.amount > 0).length;
  const outN = rows.filter((r) => real(r) && r.e.amount < 0).length;
  const todayRows = rows.filter((r) => real(r) && today && r.date === today);
  const todayNet = todayRows.reduce((n, r) => n + r.e.amount, 0);
  const balance = rows.length ? rows[rows.length - 1].after : start;
  const chip = (v: typeof walletUi.filter, label: string) => `<button class="gx-wt-chip${walletUi.filter === v ? ' on' : ''}" data-action="wallet-filter" data-value="${v}" aria-pressed="${walletUi.filter === v}">${label}</button>`;
  const edit = walletUi.edit
    ? `<div class="gx-wt-edit"><input type="text" name="wt-adj" inputmode="numeric" placeholder="예: 1,200,000 또는 120만" aria-label="잔고를 이 값으로" data-enter="wallet-adj"><button class="gx-mini" data-action="wallet-adj" data-take="wt-adj">저장</button><button class="gx-mini" data-action="wallet-edit">취소</button></div>`
    : '';
  return `<main class="gx-body gx-wallettab">
    <section class="gx-wt-tiles">
      <div class="gx-wt-tile bal">
        <small>잔고</small>
        <div class="gx-wt-balrow"><b>${esc(formatWon(balance))}</b><button class="gx-wt-pen" data-action="wallet-edit" aria-label="잔고 고치기" title="잔고 고치기">${ICONS.pen}</button></div>
        ${edit}
        <span class="gx-wt-sub">시작 ${esc(formatWon(start))} · 거래 ${rows.length}건</span>
      </div>
      <div class="gx-wt-tile"><small>수입</small><b class="in">+${esc(income.toLocaleString('en-US'))}</b><span class="gx-wt-sub">${inN}건</span></div>
      <div class="gx-wt-tile"><small>지출</small><b class="out">−${esc(spend.toLocaleString('en-US'))}</b><span class="gx-wt-sub">${outN}건</span></div>
      <div class="gx-wt-tile"><small>오늘${today ? ` · ${esc(shortDay(today))}` : ''}</small><b class="${todayNet < 0 ? 'out' : todayNet > 0 ? 'in' : ''}">${esc(formatDelta(todayNet) || '0')}</b><span class="gx-wt-sub">${todayRows.length}건</span></div>
    </section>
    ${walletUi.notice ? `<div class="gx-err" role="alert">${esc(walletUi.notice)}</div>` : ''}
    <div class="gx-wt-tools">
      <div class="gx-wt-chips">${chip('all', '전체')}${chip('in', '수입')}${chip('out', '지출')}</div>
      <input class="gx-wt-q" type="search" data-input="wallet-q" value="${esc(walletUi.q)}" placeholder="찾기: 메모·근거" aria-label="거래 찾기">
    </div>
    <div class="gx-wt-list">${walletList(ctx)}</div>
  </main>`;
}
