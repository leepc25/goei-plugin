// 호출 진행 창 (11-09 사용자 설계): Risu 채팅 화면 오른쪽 위에, 한 턴의 라우터→디렉터→본편→갱신기→인터넷이 어디까지 돌았는지.
// 상태는 core/progress.ts 가 들고(호출 시작·진행·끝은 host/llm.ts, 턴은 host/trace.ts·body.ts), 여기서는 그리기만 한다.
// PC: 턴이 시작되면 카드(300px)가 저절로 펼쳐지고 끝나면 5초(실패 10초) 뒤 48px 단추(유령 단추와 같은 규격)로 접힌다. 머리글을 끌어 옮기고, 누르면 접고, 단추를 누르면 지난 턴을 다시 본다.
// 폰: 새 단추 없이 오른쪽 가장자리의 점 다섯 개짜리 막대(길이 고정) — 턴 중에 점이 켜지고, 누르면 PC 와 같은 카드. 본문은 가리지 않는다.
// 본 화면 DOM 은 SafeElement 로만 다룬다 (host/overlay.ts 와 같은 방식: 리스너는 좌표로 어느 것을 눌렀는지 판단).
import { body as rootBody, themeVars } from './overlay';
import { inside, type Rect } from '../core/fab';
import type { ThemeName } from '../ui/theme';
import { getPrefs } from '../core/settings';
import { PROGRESS_WATCHDOG, GROUPS, GROUP_LABEL, groupState, onProgress, progressTurn, running, runningStages, stageCount, stageState, turnSummary, type Stage, type StageState, type Turn } from '../core/progress';

type Safe = Awaited<ReturnType<RisuaiPluginAPI['getRootDocument']>>;
type SafeEl = Awaited<ReturnType<Safe['createElement']>>;
type PointerEv = { clientX?: number; clientY?: number; button?: number; buttons?: number };

const POS_KEY = 'goei-plugin:prog-pos';
const PHONE_MAX = 760;
const CARD_W = 300;
const BTN = 48;
const HIDE_AFTER_OK = 5000;
const HIDE_AFTER_FAIL = 10000;
const WATCHDOG = PROGRESS_WATCHDOG;

/** 파형(심전도 선) 아이콘 — 유령은 플로팅 단추가 쓰니 다른 모양 */
const PULSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12h4l2.5-6 4 12 2.5-6h6"/></svg>';

// 안쪽 표시는 class 가 아니라 data-p(무엇)·data-s(상태)·data-mono 로 한다: Risu 의 setInnerHTML 은 class·style 속성을 지워서
// v0.21.6~0.21.8 에서 진행 창 안쪽이 모양 없이 글만 줄줄이 나왔다 (2026-11-11 사용자). 다른 화면 조각(host/overlay.ts·usebox.ts)과 같은 방식
const CSS = `
${themeVars('[x-goei-prog]')}
[x-goei-prog] { --p-dim: #97A9A5; --p-danger: #FF7A6B; --p-void: #1A2226; }
[x-goei-prog][x-goei-theme="light"] { --p-dim: #5C6E6A; --p-danger: #C2412F; --p-void: #F4F6F5; }
[x-goei-prog][x-goei-theme="paper"] { --p-dim: #6E6046; --p-danger: #A8361F; --p-void: #EFE6D2; }
[x-goei-prog] {
  position: fixed; right: 12px; top: 12px; z-index: 60; /* 플러그인 창(49) 위: 상황판이 열려 있어도 보인다 (11-11 사용자) */
  display: none; width: 0; height: 0;
  font: 13px/1.4 'IBM Plex Sans KR', 'Pretendard', system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
  color: var(--g-text); word-break: keep-all; -webkit-font-smoothing: antialiased;
}
[x-goei-prog][x-goei-show="true"] { display: block; }
[x-goei-prog] * { box-sizing: border-box; }
[x-goei-prog] [data-mono] { font-family: 'JetBrains Mono', 'IBM Plex Sans KR', ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; }
/* 카드: 오른쪽 위 꼭짓점을 기준으로 자라고 줄어든다 */
[x-goei-prog] [data-card] {
  position: absolute; top: 0; right: 0; width: ${CARD_W}px;
  background: var(--g-panel); border: 1px solid var(--g-line); border-radius: 14px; padding: 12px 14px 10px;
  box-shadow: 0 18px 40px -20px rgba(0,0,0,.6);
  transform-origin: top right; transition: transform .2s ease, opacity .2s ease;
}
[x-goei-prog][x-goei-open="false"] [data-card] { transform: scale(.16); opacity: 0; pointer-events: none; }
[x-goei-prog] [data-grip] { display: flex; align-items: center; gap: 8px; color: var(--g-sub); font-size: 11.5px; font-weight: 600; letter-spacing: .04em; cursor: grab; user-select: none; -webkit-user-select: none; }
[x-goei-prog][x-goei-drag="true"] [data-grip] { cursor: grabbing; }
[x-goei-prog] [data-grip] svg { width: 14px; height: 14px; color: var(--g-signal); flex: 0 0 14px; }
[x-goei-prog] [data-grip] [data-p="n"] { margin-left: auto; font-size: 11.5px; font-weight: 600; color: var(--p-dim); }
[x-goei-prog] [data-p="t"] { margin-top: 6px; font-size: 15px; font-weight: 600; color: var(--g-text); }
[x-goei-prog] [data-p="m"] { margin-top: 2px; color: var(--p-dim); font-size: 12px; }
[x-goei-prog] [data-p="m"] b { font-weight: 600; color: var(--g-sub); }
[x-goei-prog] [data-p="cells"] { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 3px; margin-top: 9px; }
[x-goei-prog] [data-p="c"] { height: 18px; display: grid; place-items: center; padding: 0 3px; border-radius: 4px; border: 1px solid var(--g-line); background: var(--p-void); color: var(--p-dim); font-size: 9.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
[x-goei-prog] [data-p="c"][data-s="done"] { border-color: var(--g-acc-line); background: var(--g-acc); color: var(--g-signal); }
[x-goei-prog] [data-p="c"][data-s="run"] { border-color: var(--g-signal); background: var(--g-acc); color: var(--g-text); box-shadow: 0 0 7px color-mix(in srgb, var(--g-signal) 55%, transparent); }
[x-goei-prog] [data-p="c"][data-s="fail"] { border-color: var(--p-danger); color: var(--p-danger); }
[x-goei-prog] [data-p="c"][data-s="skip"] { opacity: .45; }
[x-goei-prog] [data-p="rows"] { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--g-line); }
[x-goei-prog] [data-p="r"] { display: grid; grid-template-columns: 16px 1fr auto; column-gap: 8px; align-items: center; padding: 5px 8px; margin: 0 -8px; border-radius: 8px; font-size: 12.5px; color: var(--p-dim); }
[x-goei-prog] [data-p="r"] [data-p="nm"] { color: var(--g-sub); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[x-goei-prog] [data-p="r"] [data-p="dt"] { color: var(--p-dim); font-size: 11px; margin-left: 6px; font-weight: 400; }
[x-goei-prog] [data-p="r"] [data-p="tm"] { font-size: 11.5px; color: var(--p-dim); text-align: right; white-space: nowrap; }
[x-goei-prog] [data-p="r"][data-s="run"] { background: var(--g-acc); }
[x-goei-prog] [data-p="r"][data-s="run"] [data-p="nm"] { color: var(--g-text); font-weight: 600; }
[x-goei-prog] [data-p="r"][data-s="run"] [data-p="tm"] { color: var(--g-signal); }
[x-goei-prog] [data-p="r"][data-s="wait"] [data-p="nm"], [x-goei-prog] [data-p="r"][data-s="skip"] [data-p="nm"] { color: var(--p-dim); }
[x-goei-prog] [data-p="r"][data-s="skip"] { opacity: .55; }
[x-goei-prog] [data-p="r"][data-s="fail"] [data-p="nm"], [x-goei-prog] [data-p="r"][data-s="fail"] [data-p="tm"], [x-goei-prog] [data-p="r"][data-s="fail"] [data-p="dt"] { color: var(--p-danger); }
[x-goei-prog] [data-p="ic"] { width: 16px; height: 16px; display: grid; place-items: center; }
[x-goei-prog] [data-p="ic"]::before { content: ""; width: 7px; height: 7px; border-radius: 50%; }
[x-goei-prog] [data-p="ic"][data-s="done"]::before { background: var(--g-signal); }
[x-goei-prog] [data-p="ic"][data-s="wait"]::before, [x-goei-prog] [data-p="ic"][data-s="skip"]::before { border: 1.5px solid var(--g-line); width: 7px; height: 7px; }
[x-goei-prog] [data-p="ic"][data-s="run"]::before { width: 10px; height: 10px; border: 2px solid var(--g-signal); border-right-color: transparent; animation: goei-prog-spin .8s linear infinite; }
[x-goei-prog] [data-p="ic"][data-s="fail"]::before { background: var(--p-danger); }
/* 접힌 단추 (PC): 유령 단추와 같은 규격 48px */
[x-goei-prog] [data-dot] {
  position: absolute; top: 0; right: 0; width: ${BTN}px; height: ${BTN}px; margin: 0; padding: 0;
  display: grid; place-items: center; border: 1px solid var(--g-acc-line); border-radius: 14px; background: var(--g-acc); color: var(--g-signal);
  box-shadow: 0 6px 18px -6px rgba(0,0,0,.45); cursor: pointer; transition: opacity .2s ease, transform .15s ease;
}
[x-goei-prog] [data-dot] svg { width: 26px; height: 26px; }
[x-goei-prog][x-goei-open="true"] [data-dot] { opacity: 0; pointer-events: none; }
[x-goei-prog][x-goei-run="true"] [data-dot] svg path { stroke-dasharray: 6 4; animation: goei-prog-flow 1s linear infinite; }
[x-goei-prog] [data-dot] [data-p="bad"] { display: none; position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; border-radius: 50%; background: var(--p-danger); border: 2px solid var(--g-panel); }
[x-goei-prog][x-goei-fail="true"] [data-dot] [data-p="bad"] { display: block; }
[x-goei-prog] [data-dot] [data-p="dots"] { display: none; }
/* 폰: 상단 바 아래 오른쪽 가장자리에 붙은 막대 (점 다섯 개, 길이 고정). 카드는 눌렀을 때만 */
[x-goei-prog][x-goei-phone="true"] { right: 0; top: 64px; }
/* 폰에서 상황판이 열려 있으면 주소줄·즐겨찾기 줄 아래로 (주소줄의 탭 수 단추를 가렸다, 전수검사 11-13 사용자 승인) */
[x-goei-prog][x-goei-phone="true"][x-goei-panel="true"] { top: 160px; }
[x-goei-prog][x-goei-phone="true"] [data-dot] {
  width: 28px; height: auto; padding: 8px 0 9px; border-right: 0; border-radius: 10px 0 0 10px;
  display: flex; flex-direction: column; align-items: center; gap: 7px; box-shadow: 0 8px 18px -10px rgba(0,0,0,.6);
}
[x-goei-prog][x-goei-phone="true"] [data-dot] svg { width: 14px; height: 14px; margin-bottom: 1px; color: var(--g-sub); }
[x-goei-prog][x-goei-phone="true"][x-goei-run="true"] [data-dot] svg { color: var(--g-signal); }
[x-goei-prog][x-goei-phone="true"] [data-dot] [data-p="dots"] { display: flex; flex-direction: column; align-items: center; gap: 7px; }
[x-goei-prog] [data-p="d"] { width: 7px; height: 7px; border-radius: 50%; background: var(--g-line); }
[x-goei-prog] [data-p="d"][data-s="done"] { background: var(--g-signal); }
[x-goei-prog] [data-p="d"][data-s="run"] { width: 9px; height: 9px; background: var(--g-signal); box-shadow: 0 0 7px var(--g-signal); animation: goei-prog-blink 1s ease-in-out infinite; }
[x-goei-prog] [data-p="d"][data-s="skip"] { background: transparent; border: 1.5px solid var(--g-line); width: 6px; height: 6px; }
[x-goei-prog] [data-p="d"][data-s="fail"] { background: var(--p-danger); }
[x-goei-prog][x-goei-phone="true"] [data-card] { right: 10px; top: 0; width: min(${CARD_W + 30}px, calc(100vw - 20px)); }
[x-goei-prog][x-goei-phone="true"] [data-grip] { cursor: pointer; }
@keyframes goei-prog-spin { to { transform: rotate(360deg); } }
@keyframes goei-prog-flow { to { stroke-dashoffset: -20; } }
@keyframes goei-prog-blink { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) { [x-goei-prog] * { animation: none !important; transition: none !important; } }
`;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const num = (n: number) => Math.max(0, Math.round(n)).toLocaleString('ko-KR');
const secs = (ms: number) => (ms >= 60_000 ? `${(ms / 60_000).toFixed(1)}분` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}초`);
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const modelName = (m: string) => (m === 'main' ? '메인' : m === 'aux' ? '보조' : m);

/** 지금 도는 단계를 설명하는 제목 (사용자: 제목 줄은 설명을 붙여도 된다) */
function titleOf(t: Turn, now: number): string {
  if (t.endAt) {
    const { failed } = turnSummary(t);
    return failed ? `끝 · ${failed}건 실패` : '끝';
  }
  const run = runningStages(t);
  if (t.aborted && !run.length) return '응답 없음';
  if (!run.length) return t.replyAt ? '응답 뒤 정리 중' : t.mainAt ? '메인 응답 대기' : now - t.at < WATCHDOG ? '요청 준비 중' : '응답 없음';
  if (run.some((s) => s.id === 'main')) return '메인 응답 대기';
  const net = run.filter((s) => s.group === 'net');
  if (net.length > 1) return `인터넷 자동 호출 · ${net.length}건`;
  const s = run[0];
  if (t.manual) return `${s.label} 처리 중`;
  switch (s.id) {
    case 'router': return '라우터 인물 고르는 중';
    case 'director': return '디렉터 판단 중';
    case 'update': return '갱신기 기록 중';
    case 'asset': return '이미지 태그 보충 중';
    case 'wiki': return '위키 쓰는 중';
    default: return s.group === 'net' ? `${s.label === '통합' ? `통합 요청 (${s.note ?? ''})` : s.label} 확인 중` : `${s.label} 처리 중`;
  }
}

/** 보냄·받음 한 가지 틀 (2026-11-11 사용자: 「숫자 → 숫자」는 알아보기 힘들다, 본편만 다른 말을 쓰지 않는다). 받는 중이면 got 없이 */
function sentGot(sent: number | undefined, got?: number): string {
  const a = sent === undefined ? '' : `보냄 ${num(sent)}`;
  const b = got === undefined ? '받는 중' : `받음 ${num(got)}`;
  return a ? `${a} · ${b}` : b;
}

/** 제목 아래 한 줄: 도는 호출의 모델·보낸 토큰·출력 글자·경과, 끝나면 합계 */
function metaOf(t: Turn, now: number): string {
  if (t.endAt) {
    const s = turnSummary(t);
    return `호출 <b data-mono>${num(s.calls)}</b>회 · 보냄 <b data-mono>${num(s.req)}</b> · 받음 <b data-mono>${num(s.resp)}</b> 토큰 · <b data-mono>${esc(secs(s.ms))}</b>`;
  }
  const run = running(t);
  const parts: string[] = [];
  if (run.length) {
    const models = [...new Set(run.map((c) => modelName(c.model)))].join('·');
    parts.push(run.length > 1 ? `${esc(models)} ${run.length}건 동시` : `${esc(models)} 모델`);
    parts.push(`보냄 <b data-mono>${num(run.reduce((n, c) => n + c.reqTokens, 0))}</b> 토큰`);
    const chars = run.reduce((n, c) => n + (c.chars ?? 0), 0);
    if (chars) parts.push(`받는 중 <b data-mono>~${num(chars)}</b>자`);
  } else if (t.mainAt && !t.replyAt) parts.push(`${esc(modelName('main'))} 모델${t.mainTokens === undefined ? '' : ` · 보냄 <b data-mono>${num(t.mainTokens)}</b> 토큰`}`);
  parts.push(`경과 <b data-mono>${clock(now - t.at)}</b>`);
  return parts.join(' · ');
}

/** 단계 한 줄의 작은 글씨·오른쪽 시간. 본편도 보조 호출과 같은 틀: 모델 · 보냄 · 받음 */
function rowDetail(t: Turn, s: Stage, st: StageState, now: number): { dt: string; tm: string } {
  if (s.id === 'main') {
    const who = modelName('main');
    if (st === 'done') return { dt: `${who} · ${sentGot(t.mainTokens, t.replyTokens ?? 0)}`, tm: secs((t.replyAt ?? now) - (t.mainAt ?? t.at)) };
    if (st === 'run') return { dt: `${who} · ${sentGot(t.mainTokens)}`, tm: `${Math.floor((now - (t.mainAt ?? t.at)) / 1000)}초` };
    return { dt: '', tm: '' };
  }
  const calls = t.calls.filter((c) => c.stage === s.id);
  if (!calls.length) return { dt: s.note ?? '', tm: st === 'skip' ? '없음' : '' };
  const c = calls[calls.length - 1];
  const more = calls.length > 1 ? ` · ${calls.length}회` : '';
  const head = `${s.note ? `${s.note} · ` : ''}${modelName(c.model)} · `;
  if (c.ms === undefined) return { dt: `${head}보냄 ${num(c.reqTokens)} · 받는 중${c.chars ? ` ~${num(c.chars)}자` : ''}${more}`, tm: `${Math.floor((now - c.at) / 1000)}초` };
  if (!c.ok) return { dt: (c.error ?? '실패').split('\n')[0].slice(0, 40) + more, tm: secs(c.ms) };
  return { dt: `${head}${sentGot(c.reqTokens, c.respTokens ?? 0)}${more}`, tm: secs(calls.reduce((n, x) => n + (x.ms ?? 0), 0)) };
}

export function cardHtml(t: Turn | null, now = Date.now()): string {
  if (!t) return `<div data-grip>${PULSE}호출 진행<span data-p="n" data-mono>—</span></div><div data-p="t">아직 호출이 없어요</div><div data-p="m">채팅을 보내면 여기에 단계가 보여요.</div>`;
  const { done, total } = stageCount(t);
  const cells = t.plan.map((s) => `<div data-p="c" data-s="${stageState(t, s)}" title="${esc(s.note ? `${s.label} (${s.note})` : s.label)}">${esc(s.label)}</div>`).join('');
  const rows = t.plan.map((s) => {
    const st = stageState(t, s);
    const { dt, tm } = rowDetail(t, s, st, now);
    return `<div data-p="r" data-s="${st}"><i data-p="ic" data-s="${st}"></i><span data-p="nm">${esc(s.label)}${dt ? `<span data-p="dt">${esc(dt)}</span>` : ''}</span><span data-p="tm" data-mono>${esc(tm)}</span></div>`;
  }).join('');
  return `<div data-grip>${PULSE}${t.manual ? '수동 호출' : '호출 진행'}<span data-p="n" data-mono>${done} / ${total}</span></div>`
    + `<div data-p="t">${esc(titleOf(t, now))}</div><div data-p="m">${metaOf(t, now)}</div>`
    + (total > 1 ? `<div data-p="cells">${cells}</div>` : '')
    + `<div data-p="rows">${rows}</div>`;
}

export function dotHtml(t: Turn | null): string {
  const dots = GROUPS.map((g) => `<i data-p="d" data-s="${t ? groupState(t, g) : 'skip'}" title="${GROUP_LABEL[g]}"></i>`).join('');
  return `${PULSE}<span data-p="dots">${dots}</span><i data-p="bad"></i>`;
}

export interface ProgWin {
  setVisible(visible: boolean): Promise<void>;
  /** 상황판이 떠 있나 (body.ts 가 매 초 appShown() 으로). PC 는 저절로 펴지 않고, 폰은 막대를 주소줄 아래로 */
  setPanel(open: boolean): Promise<void>;
  setTheme(theme: ThemeName): Promise<void>;
  remove(): Promise<void>;
}

interface Pos {
  right: number;
  top: number;
}
// 상황판 닫기 X (오른쪽 위 구석) 를 덮지 않게 한 칸 아래 (11-11). 옮긴 자리는 기억한다
const DEFAULT_POS: Pos = { right: 12, top: 76 };

export async function createProgWin(): Promise<ProgWin> {
  const root = await rootBody();
  if (!root) throw new Error('Risu 화면 접근 권한이 없어요.');
  const { doc } = root;
  try {
    for (const el of await risuai.unwarpSafeArray(await doc.querySelectorAll('[x-goei-prog]'))) await el.remove().catch(() => {});
  } catch {
    /* 옛 판이 남긴 것을 못 지워도 새로 만든다 */
  }
  const host = await doc.createElement('div');
  await host.setAttribute('x-goei-prog', 'true');
  await host.setAttribute('x-goei-open', 'false');
  await host.setAttribute('x-goei-show', 'false');
  await host.setInnerHTML(`<div data-card></div><button type="button" data-dot aria-label="호출 진행 보기"></button>`);
  // 스타일은 요소로 따로 붙인다 (host/overlay.ts 와 같게). setInnerHTML 맨 앞의 <style> 은 Risu 의 DOMPurify 가 지워서
  // v0.21.5 에서는 진행 창이 모양 없이 화면 밖에 놓여 아무것도 안 보였다 (2026-11-10 사용자)
  const style = await doc.createElement('style');
  await style.setTextContent(CSS);
  await host.appendChild(style);
  await root.body.appendChild(host);
  const card = await host.querySelector('[data-card]');
  const dot = await host.querySelector('[data-dot]');
  if (!card || !dot) throw new Error('진행 창을 만들지 못했어요.');

  let visible = false;
  let phone = false;
  let panelOpen = false;
  let open = false;
  let seen: Turn | null = null;
  let lastCard = '';
  let lastDot = '';
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let tick: ReturnType<typeof setInterval> | undefined;
  let pos: Pos = { ...DEFAULT_POS };
  try {
    const raw = await risuai.safeLocalStorage.getItem(POS_KEY);
    const p = raw ? (JSON.parse(raw) as Partial<Pos>) : null;
    if (p && Number.isFinite(p.right) && Number.isFinite(p.top)) pos = { right: Math.max(0, p.right!), top: Math.max(0, p.top!) };
  } catch {
    /* 기본 자리 */
  }

  const viewport = async () => {
    const r = (await root.body.getBoundingClientRect()) as Rect;
    return { vw: r.width, vh: r.height };
  };
  const applyPos = async () => {
    if (phone) {
      await host.setStyle('right', '');
      await host.setStyle('top', '');
      return;
    }
    const { vw, vh } = await viewport();
    const w = open ? CARD_W : BTN;
    pos = { right: Math.min(Math.max(0, pos.right), Math.max(0, vw - w)), top: Math.min(Math.max(0, pos.top), Math.max(0, vh - 40)) };
    await host.setStyle('right', `${pos.right}px`);
    await host.setStyle('top', `${pos.top}px`);
  };
  const setOpen = async (next: boolean) => {
    if (open === next) return;
    open = next;
    await host.setAttribute('x-goei-open', next ? 'true' : 'false');
    if (next) await applyPos();
  };
  const clearHide = () => {
    if (hideTimer !== undefined) clearTimeout(hideTimer);
    hideTimer = undefined;
  };

  const paint = async () => {
    const t = progressTurn();
    const now = Date.now();
    const run = !!t && !t.endAt && now - t.at < WATCHDOG;
    const fail = !!t && turnSummary(t).failed > 0;
    const c = cardHtml(t, now);
    if (c !== lastCard) {
      lastCard = c;
      await card.setInnerHTML(c);
    }
    const d = dotHtml(t);
    if (d !== lastDot) {
      lastDot = d;
      await dot.setInnerHTML(d);
    }
    await host.setAttribute('x-goei-run', run ? 'true' : 'false');
    await host.setAttribute('x-goei-fail', fail ? 'true' : 'false');
    // 도는 동안은 1초마다 경과 시간을 다시 쓴다
    if (run && tick === undefined) tick = setInterval(() => void schedule(), 1000);
    if (!run && tick !== undefined) {
      clearInterval(tick);
      tick = undefined;
    }
  };
  let painting: Promise<void> | null = null;
  let again = false;
  const schedule = async () => {
    if (painting) {
      again = true;
      return;
    }
    painting = (async () => {
      do {
        again = false;
        await paint().catch(() => {});
      } while (again);
    })().finally(() => {
      painting = null;
    });
    await painting;
  };

  /** 턴이 바뀌거나 끝났을 때 펼치기·접기 (PC 는 저절로 펼침, 폰은 막대만) */
  const onChange = () => {
    const t = progressTurn();
    if (t && t !== seen) {
      seen = t;
      clearHide();
      // 상황판이 떠 있으면 저절로 펴지 않는다: 펼친 카드가 상황판 닫기 X·잔고·사원증을 가렸다 (전수검사 11-13, 사용자 승인). 단추를 누르면 펴진다
      if (!phone && visible && !panelOpen) void setOpen(true);
    }
    if (t?.endAt && open && hideTimer === undefined) {
      hideTimer = setTimeout(() => {
        hideTimer = undefined;
        void setOpen(false);
      }, turnSummary(t).failed ? HIDE_AFTER_FAIL : HIDE_AFTER_OK);
    }
    void schedule();
  };
  const offProgress = onProgress(onChange);

  // ── 누르기·끌기 (좌표로 판단, host/overlay.ts 와 같은 까닭) ──
  const rectOf = async (el: SafeEl | null) => (el ? ((await el.getBoundingClientRect()) as Rect) : null);
  let drag: { x: number; y: number; start: Pos; hit: Promise<boolean> } | null = null;
  let moved = false;
  let pending: { x: number; y: number } | null = null;
  let loop: Promise<void> | null = null;
  const runDrag = async () => {
    try {
      while (pending && drag) {
        const d = drag;
        const p = pending;
        pending = null;
        if (!(await d.hit)) {
          drag = null;
          break;
        }
        if (drag !== d) continue;
        const dx = p.x - d.x;
        const dy = p.y - d.y;
        if (!moved && Math.hypot(dx, dy) < 6) continue;
        if (!moved) {
          moved = true;
          await host.setAttribute('x-goei-drag', 'true');
        }
        pos = { right: d.start.right - dx, top: d.start.top + dy };
        await applyPos();
      }
    } catch {
      drag = null;
    } finally {
      loop = null;
    }
  };
  const onDown = (ev: PointerEv) => {
    drag = null;
    pending = null;
    moved = false;
    if (!visible || phone || typeof ev.clientX !== 'number' || typeof ev.clientY !== 'number') return;
    if ((ev.buttons ?? 1) !== 1 && (ev.button ?? 0) !== 0) return;
    const x = ev.clientX;
    const y = ev.clientY;
    // 펼친 창은 머리줄을, 접힌 단추는 단추를 잡고 끈다 (11-11 사용자: 단추가 옮겨지지 않았다). 끌고 놓으면 뒤따르는 클릭은 무시된다 (moved)
    const grab = open;
    drag = { x, y, start: { ...pos }, hit: (async () => inside(await rectOf(grab ? await card.querySelector('[data-grip]') : dot), x, y))().catch(() => false) };
  };
  const onMove = (ev: PointerEv) => {
    if (!drag || typeof ev.clientX !== 'number' || typeof ev.clientY !== 'number') return;
    if (ev.buttons !== undefined && ev.buttons !== 1) {
      drag = null;
      return;
    }
    pending = { x: ev.clientX, y: ev.clientY };
    loop ??= runDrag();
  };
  const onUp = () => {
    const d = drag;
    void (loop ?? Promise.resolve()).then(async () => {
      if (drag === d) drag = null;
      if (moved) {
        await host.setAttribute('x-goei-drag', 'false');
        try {
          await risuai.safeLocalStorage.setItem(POS_KEY, JSON.stringify(pos));
        } catch {
          /* 자리 저장 실패는 무시 */
        }
      }
    });
  };
  const onClick = async (ev: PointerEv) => {
    if (!visible) return;
    await loop;
    if (moved) return; // 끌고 놓은 뒤 따라오는 클릭
    if (!open) {
      if (inside(await rectOf(dot), ev.clientX, ev.clientY)) {
        clearHide();
        await setOpen(true);
      }
      return;
    }
    if (inside(await rectOf(await card.querySelector('[data-grip]')), ev.clientX, ev.clientY)) {
      clearHide();
      await setOpen(false);
      return;
    }
    if (inside(await rectOf(card), ev.clientX, ev.clientY)) return;
    // 창 밖: 도는 중이 아닐 때만 접는다 (팝업창 규격과 같게, 11-09 사용자)
    const t = progressTurn();
    if (!t || t.endAt || Date.now() - t.at >= WATCHDOG) {
      clearHide();
      await setOpen(false);
    }
  };
  let ids: { target: SafeEl; type: string; id: string }[] = [];
  const unbind = async () => {
    const old = ids;
    ids = [];
    for (const { target, type, id } of old) await target.removeEventListener(type, id).catch(() => {});
  };
  const docTarget: SafeEl = typeof (doc as Partial<SafeEl> | null)?.addEventListener === 'function' ? (doc as unknown as SafeEl) : host;
  let binding: Promise<void> = Promise.resolve();
  const bind = () => (binding = binding.catch(() => {}).then(async () => {
    await unbind();
    for (const [target, type, fn] of [
      [host, 'pointerdown', onDown],
      [docTarget, 'pointermove', onMove],
      [docTarget, 'pointerup', onUp],
      [docTarget, 'pointercancel', onUp],
      [docTarget, 'click', onClick],
    ] as const) {
      ids.push({ target, type, id: await target.addEventListener(type, fn as (e: unknown) => void, { passive: true }) });
    }
  }));
  await bind();
  await schedule();

  return {
    async setVisible(next) {
      const { vw } = await viewport().catch(() => ({ vw: 1024 }));
      const ph = vw <= PHONE_MAX;
      if (ph !== phone) {
        phone = ph;
        await host.setAttribute('x-goei-phone', ph ? 'true' : 'false');
        if (ph) await setOpen(false);
      }
      if (next === visible && next) {
        await applyPos();
        return;
      }
      if (next && !visible) await bind().catch(() => {});
      visible = next;
      if (!next) {
        drag = null;
        pending = null;
        clearHide();
        await setOpen(false);
      } else await applyPos();
      await host.setAttribute('x-goei-show', next ? 'true' : 'false');
    },
    async setPanel(next) {
      if (next === panelOpen) return;
      panelOpen = next;
      await host.setAttribute('x-goei-panel', next ? 'true' : 'false');
    },
    async setTheme(theme) {
      await host.setAttribute('x-goei-theme', theme);
    },
    async remove() {
      offProgress();
      clearHide();
      if (tick !== undefined) clearInterval(tick);
      visible = false;
      await host.remove();
      await unbind();
    },
  };
}

/** 설정 「호출 진행 창」 (이 기기 공통, 기본 켬) */
export const progressOn = (): boolean => getPrefs().progress !== false;
