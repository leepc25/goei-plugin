// 가계부 탭 (2026-10-27 사용자): 장부(core/wallet.ts, $st_wallet)를 크게 보여 준다. 저장 형식·갱신기는 그대로, 화면만.
// PC는 왼쪽 메뉴, 모바일은 머리의 잔고 단추·ID카드 잔고 칩으로 들어온다 (모바일 아래 바는 다섯 칸이 꽉 차 있음).
import type { ChatContext } from '../host/risu';
import { aliveAnchors, formatDelta, formatWon, liveWallet, readWallet, walletBalance, WALLET_START_DEFAULT, type WalletEntry } from '../core/wallet';
import { colConfig } from '../core/world/statuscols';
import { getPrefs } from '../core/settings';
import { messageKey } from '../core/people/store';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const walletUi: { filter: 'all' | 'in' | 'out'; notice: string; open: string | null } = { filter: 'all', notice: '', open: null };

/** 이 채팅이 잔고 칸을 쓰나 (끄면 가계부 메뉴·잔고 단추도 숨김) */
export const walletOn = (ctx: ChatContext) => colConfig(ctx.chat.scriptstate).wallet !== 'off';

export const walletOf = (ctx: ChatContext) => readWallet(ctx.chat.scriptstate, getPrefs().walletStart ?? WALLET_START_DEFAULT);

export function balanceText(ctx: ChatContext): string {
  return formatWon(walletBalance(walletOf(ctx), aliveAnchors(ctx.chat)));
}

/** 모바일 머리 잔고 단추 → 가계부 탭 */
export function walletHeadButton(ctx: ChatContext, here = false): string {
  // 가계부 탭 안에서는 숨김 (잔고가 탭에 크게 있고, 좁은 머리에서 제목이 밀림)
  if (!walletOn(ctx) || here) return '';
  return `<button class="gx-hwallet" data-action="tab" data-value="wallet" aria-label="가계부 · 잔고 ${esc(balanceText(ctx))}">${esc(balanceText(ctx))}</button>`;
}

const SRC: Record<WalletEntry['src'], string> = { story: '본문', field: '필드', manual: '직접' };

export function walletTab(ctx: ChatContext): string {
  if (!walletOn(ctx)) {
    return `<main class="gx-body gx-wallettab"><div class="gx-empty">이 채팅은 상태창 「잔고」 칸을 쓰지 않아요. 설정 → 상황판 → 상태창 칸에서 켜면 가계부가 생겨요.</div></main>`;
  }
  const w = walletOf(ctx);
  const alive = aliveAnchors(ctx.chat);
  const live = liveWallet(w, alive);
  // 기준 메시지 → 몇 번째 메시지 (#번호)
  const order = new Map((ctx.chat.message ?? []).map((m, i) => [messageKey(m, i), i + 1]));
  // 「잔고 수정」(core adjustWallet, id m_) 은 수입·지출이 아니라 따로 센다. 직접 추가한 거래(a_)는 수입·지출
  const adj = (e: WalletEntry) => e.src === 'manual' && e.id.startsWith('m_');
  const income = live.filter((e) => e.amount > 0 && !adj(e)).reduce((n, e) => n + e.amount, 0);
  const spend = live.filter((e) => e.amount < 0 && !adj(e)).reduce((n, e) => n - e.amount, 0);
  const fixed = live.filter(adj).reduce((n, e) => n + e.amount, 0);
  const shown = live.filter((e) => (walletUi.filter === 'in' ? e.amount > 0 : walletUi.filter === 'out' ? e.amount < 0 : true)).slice().reverse();
  const chip = (v: typeof walletUi.filter, label: string) => `<button class="gx-seg${walletUi.filter === v ? ' on' : ''}" data-action="wallet-filter" data-value="${v}" aria-pressed="${walletUi.filter === v}">${label}</button>`;
  const rows = shown.map((e) => {
    const at = e.anchor ? order.get(e.anchor) : undefined;
    const open = walletUi.open === e.id;
    const meta = [adj(e) ? '잔고 수정' : SRC[e.src], at ? `#${at}` : ''].filter(Boolean).join(' · ');
    return `<li class="${open ? 'open' : ''}">
      <button class="gx-wt-main" data-action="wallet-open" data-value="${esc(e.id)}" aria-expanded="${open}">
        <span class="gx-wt-memo">${esc(e.memo || '(메모 없음)')}<small>${esc(meta)}</small></span>
        <b class="${e.amount < 0 ? 'out' : 'in'}">${esc(formatDelta(e.amount))}</b>
      </button>
      <button class="gx-wl-x" data-action="wallet-del" data-value="${esc(e.id)}" aria-label="이 거래 지우기">✕</button>
      ${open ? `<p class="gx-wt-quote">${e.quote ? `「${esc(e.quote)}」` : '근거 문장 없음'}${e.at ? `<small>${esc(new Date(e.at).toLocaleString())}</small>` : ''}</p>` : ''}
    </li>`;
  }).join('');
  return `<main class="gx-body gx-wallettab">
    <section class="gx-wt-sum">
      <div class="gx-wt-bal"><small>지금 잔고</small><b>${esc(formatWon(walletBalance(w, alive)))}</b></div>
      <div class="gx-wt-nums">
        <span><small>시작</small>${esc(formatWon(w.start))}</span>
        <span class="in"><small>수입</small>+${esc(income.toLocaleString('en-US'))}</span>
        <span class="out"><small>지출</small>−${esc(spend.toLocaleString('en-US'))}</span>
        ${fixed ? `<span><small>수정</small>${esc(formatDelta(fixed))}</span>` : ''}
      </div>
    </section>
    ${walletUi.notice ? `<div class="gx-err" role="alert">${esc(walletUi.notice)}</div>` : ''}
    <div class="gx-segs gx-segs-sm gx-wt-filter">${chip('all', `전체 ${live.length}`)}${chip('in', '수입')}${chip('out', '지출')}</div>
    <ul class="gx-wt-list">${rows || '<li class="gx-wl-empty">거래가 없어요.</li>'}</ul>
    <p class="gx-muted gx-wt-note">본문에 금액이 적힌 거래는 인물 기록 갱신기가, 필드에서 사고판 것은 게임이 적어요. 지우거나 다시 굴린 메시지의 거래는 자동으로 빠져요.</p>
    <div class="gx-wt-form">
      <input type="text" name="wt-amount" placeholder="금액 (예: -12000, +3만)" aria-label="금액">
      <input type="text" name="wt-memo" placeholder="메모 (예: 점심)" aria-label="메모" maxlength="30">
      <button class="gx-mini" data-action="wallet-add" data-take="wt-amount,wt-memo">거래 추가</button>
    </div>
    <div class="gx-wt-form">
      <input type="text" name="wt-adj" inputmode="numeric" placeholder="잔고를 이 값으로 (예: 1,200,000 또는 120만)" aria-label="잔고 수정" data-enter="wallet-adj">
      <button class="gx-mini" data-action="wallet-adj" data-take="wt-adj">잔고 수정</button>
    </div>
  </main>`;
}
