// Risu 본 화면(getRootDocument)에 붙는 요소: 플로팅 버튼과 접속 효과.
// 본 화면 DOM은 SafeElement로만 다룰 수 있고, 스타일은 x- 속성 선택자로 범위를 좁힌다.
import { clampPos, DEFAULT_FAB_POS, dragTo, DRAG_THRESHOLD, inside, parsePos, type FabPos, type Rect } from '../core/fab';
import { GHOST_ICON } from '../ui/icons';
import { BRAND } from '../ui/brand';
import { PALETTES, type ThemeName } from '../ui/theme';

/** 창과 같은 배색을 x-goei-theme 속성별 CSS 변수로 (본 화면에서는 style 속성으로 변수를 못 넣을 수 있어 선택자로 나눈다) */
function themeVars(sel: string): string {
  return (Object.keys(PALETTES) as ThemeName[]).map((t) => {
    const p = PALETTES[t];
    return `${sel}${t === 'dark' ? '' : `[x-goei-theme="${t}"]`} { --g-void: ${p.void}; --g-panel: ${p.panel}; --g-line: ${p.line}; --g-text: ${p.text}; --g-sub: ${p.sub}; --g-signal: ${p.signal}; --g-acc: ${p.accentBg}; --g-acc-line: ${p.accentLine}; --g-scrim: ${p.scrim}; }`;
  }).join('\n');
}

const FAB_CSS = `
${themeVars('[x-goei-fab]')}
[x-goei-fab] {
  position: fixed; right: 16px; bottom: 96px; z-index: 100;
  display: none;
}
[x-goei-fab] button {
  position: relative; display: flex; align-items: center; justify-content: center;
  width: 48px; height: 48px; padding: 0; box-sizing: border-box;
  border: 1px solid var(--g-acc-line); border-radius: 14px; touch-action: none; user-select: none; -webkit-user-select: none;
  background: var(--g-acc); color: var(--g-signal); cursor: pointer;
  box-shadow: 0 6px 18px -6px rgba(0,0,0,.45);
  transition: transform .15s ease, box-shadow .2s ease, background-color .15s ease, color .15s ease;
}
[x-goei-fab] button:hover {
  transform: translateY(-3px) scale(1.08);
  background: var(--g-signal); color: var(--g-acc); border-color: var(--g-signal);
  box-shadow: 0 10px 24px -6px rgba(0,0,0,.5), 0 0 0 5px color-mix(in srgb, var(--g-signal) 28%, transparent), 0 0 22px 2px color-mix(in srgb, var(--g-signal) 45%, transparent);
}
[x-goei-fab] button:hover svg { transform: rotate(-8deg) scale(1.06); }
[x-goei-fab] button svg { transition: transform .15s ease; }
[x-goei-fab] button:active { transform: translateY(0) scale(.96); }
[x-goei-fab][x-goei-drag="true"] button { cursor: grabbing; transform: scale(1.06); box-shadow: 0 10px 26px -6px rgba(0,0,0,.55), 0 0 0 4px color-mix(in srgb, var(--g-signal) 24%, transparent); }
[x-goei-fab][x-goei-drag="true"] button::after { opacity: 0 !important; }
[x-goei-fab] button svg { width: 26px; height: 26px; pointer-events: none; }
[x-goei-fab] button::after {
  content: "${BRAND.fab}"; position: absolute; right: calc(100% + 10px); top: 50%;
  transform: translate(4px, -50%); padding: 4px 9px; border-radius: 8px;
  background: var(--g-panel); border: 1px solid var(--g-line); color: var(--g-sub);
  font: 12px/1.3 'IBM Plex Sans KR', system-ui, -apple-system, "Noto Sans KR", sans-serif; white-space: nowrap;
  opacity: 0; pointer-events: none; transition: opacity .12s ease, transform .12s ease;
}
[x-goei-fab] button:hover::after { opacity: 1; transform: translate(0, -50%); }
@keyframes goei-fab-glow {
  0%, 100% { box-shadow: 0 6px 18px -6px rgba(0,0,0,.45), 0 0 0 0 transparent; }
  50% { box-shadow: 0 6px 18px -6px rgba(0,0,0,.45), 0 0 0 7px color-mix(in srgb, var(--g-signal) 22%, transparent), 0 0 26px 6px color-mix(in srgb, var(--g-signal) 35%, transparent); }
}
[x-goei-fab][x-goei-glow="true"] button { animation: goei-fab-glow 1.3s ease-in-out 3; }
@media (prefers-reduced-motion: reduce) { [x-goei-fab][x-goei-glow="true"] button { animation: none; } }
`;

export const INTRO_MS = 1500;

const INTRO_CSS = `
[x-goei-intro] { --g-void: #061216; --g-text: #e8fffa; --g-sub: #a7c9be; --g-signal: #7fe3d0; --g-scrim: rgba(2,6,8,.94); }
[x-goei-intro] {
  position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; overflow: hidden;
  font-family: 'IBM Plex Sans KR', system-ui, -apple-system, "Noto Sans KR", sans-serif;
  animation: goei-in-veil ${INTRO_MS}ms ease forwards;
  background: radial-gradient(ellipse at center, color-mix(in srgb, var(--g-void) 82%, transparent) 0%, var(--g-scrim) 70%);
}
[x-goei-intro] [data-gi="scan"] {
  position: absolute; left: 0; right: 0; height: 2px; top: -4%;
  background: linear-gradient(90deg, transparent, var(--g-signal) 20%, var(--g-text) 50%, var(--g-signal) 80%, transparent);
  box-shadow: 0 0 18px 4px color-mix(in srgb, var(--g-signal) 55%, transparent);
  animation: goei-scan 682ms cubic-bezier(.4,0,.2,1) 74ms forwards;
}
[x-goei-intro] [data-gi="lines"] {
  position: absolute; inset: 0; opacity: .18;
  background: repeating-linear-gradient(0deg, color-mix(in srgb, var(--g-signal) 22%, transparent) 0 1px, transparent 1px 4px);
  animation: goei-flicker 558ms steps(6) 2;
}
[x-goei-intro] [data-gi="core"] {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  width: min(86vw, 520px); padding: 26px 20px 22px;
  border-top: 1px solid color-mix(in srgb, var(--g-signal) 50%, transparent); border-bottom: 1px solid color-mix(in srgb, var(--g-signal) 50%, transparent);
  animation: goei-open 372ms cubic-bezier(.2,.8,.2,1) 186ms both;
}
[x-goei-intro] [data-gi="core"]::before, [x-goei-intro] [data-gi="core"]::after {
  content: ""; position: absolute; top: -5px; width: 10px; height: 10px; border: 1px solid var(--g-signal); transform: rotate(45deg); background: var(--g-void);
}
[x-goei-intro] [data-gi="core"]::before { left: -5px; }
[x-goei-intro] [data-gi="core"]::after { right: -5px; }
[x-goei-intro] [data-gi="ghost"] { color: var(--g-signal); filter: drop-shadow(0 0 10px color-mix(in srgb, var(--g-signal) 60%, transparent)); animation: goei-pulse 558ms ease-in-out 310ms 2; }
[x-goei-intro] [data-gi="ghost"] svg { width: 44px; height: 44px; }
[x-goei-intro] [data-gi="label"] { color: var(--g-sub); font-size: 11px; letter-spacing: .42em; }
[x-goei-intro] [data-gi="title"] {
  position: relative; color: var(--g-text); font-size: clamp(20px, 5.4vw, 30px); font-weight: 700; letter-spacing: .12em; white-space: nowrap;
  text-shadow: 0 0 14px color-mix(in srgb, var(--g-signal) 55%, transparent);
  animation: goei-glitch 868ms steps(1) 248ms 1;
}
[x-goei-intro] [data-gi="sub"] { color: var(--g-sub); font-size: 13px; letter-spacing: .08em; }
[x-goei-intro] [data-gi="bar"] { width: 160px; height: 2px; background: color-mix(in srgb, var(--g-signal) 18%, transparent); overflow: hidden; }
[x-goei-intro] [data-gi="bar"] i { display: block; height: 100%; width: 0; background: var(--g-signal); box-shadow: 0 0 8px var(--g-signal); animation: goei-load 806ms ease-out 279ms forwards; }
@keyframes goei-in-veil { 0% { opacity: 0; } 10% { opacity: 1; } 78% { opacity: 1; } 100% { opacity: 0; } }
@keyframes goei-scan { to { top: 104%; } }
@keyframes goei-flicker { 0%,100% { opacity: .18; } 33% { opacity: .05; } 66% { opacity: .3; } }
@keyframes goei-open { from { opacity: 0; clip-path: inset(48% 0 48% 0); } to { opacity: 1; clip-path: inset(0 0 0 0); } }
@keyframes goei-pulse { 50% { transform: scale(1.08); filter: drop-shadow(0 0 18px color-mix(in srgb, var(--g-signal) 90%, transparent)); } }
@keyframes goei-load { to { width: 100%; } }
@keyframes goei-glitch {
  0% { transform: translate(0); text-shadow: 2px 0 #ff5a7a, -2px 0 #4fe0ff; }
  8% { transform: translate(-2px, 1px); clip-path: inset(10% 0 55% 0); }
  14% { transform: translate(2px, -1px); clip-path: inset(60% 0 8% 0); }
  20% { transform: translate(0); clip-path: none; text-shadow: -1px 0 #ff5a7a, 1px 0 #4fe0ff; }
  46% { text-shadow: 0 0 14px color-mix(in srgb, var(--g-signal) 55%, transparent); }
  52% { transform: translate(1px, 0); text-shadow: 2px 0 #ff5a7a, -2px 0 #4fe0ff; }
  56% { transform: translate(0); text-shadow: 0 0 14px color-mix(in srgb, var(--g-signal) 55%, transparent); }
  100% { transform: translate(0); }
}
@media (prefers-reduced-motion: reduce) {
  [x-goei-intro] *, [x-goei-intro] { animation-duration: 1ms !important; animation-delay: 0ms !important; }
  [x-goei-intro] { animation: goei-in-veil ${INTRO_MS}ms linear forwards !important; }
  [x-goei-intro] [data-gi="bar"] i { width: 100%; }
}
`;

const INTRO_HTML = `
<div data-gi="lines"></div>
<div data-gi="scan"></div>
<section data-gi="core" aria-hidden="true">
  <div data-gi="ghost">${GHOST_ICON}</div>
  <div data-gi="label">SYSTEM //</div>
  <div data-gi="title">ANOMALY SIMULATION</div>
  <div data-gi="bar"><i></i></div>
</section>`;

type Safe = Awaited<ReturnType<RisuaiPluginAPI['getRootDocument']>>;
type SafeEl = Awaited<ReturnType<Safe['createElement']>>;

async function body(): Promise<{ doc: Safe; body: SafeEl } | null> {
  // 본 화면 접근 권한을 거부하면 null이 온다.
  const doc = (await risuai.getRootDocument()) as Safe | null;
  if (!doc) return null;
  const b = await doc.querySelector('body');
  return b ? { doc, body: b } : null;
}

export interface Fab {
  setVisible(visible: boolean, glow?: boolean): Promise<void>;
  setTheme(theme: ThemeName): Promise<void>;
  /** 채팅 화면이 떠 있는지 (본 화면 DOM으로 확인) */
  chatScreenVisible(): Promise<boolean>;
  remove(): Promise<void>;
}

const POS_KEY = 'goei-plugin:fab-pos';

interface DragState {
  x: number;
  y: number;
  start: FabPos;
  /** 누른 자리가 버튼 안이면 버튼 영역, 아니면 null (비동기로 확인) */
  hit: Promise<{ rect: Rect; vw: number; vh: number } | null>;
}

type PointerEv = { clientX?: number; clientY?: number; button?: number; buttons?: number };

async function loadPos(): Promise<FabPos> {
  try {
    return parsePos(await risuai.safeLocalStorage.getItem(POS_KEY));
  } catch {
    return { ...DEFAULT_FAB_POS };
  }
}

async function removeLeftovers(doc: Safe): Promise<void> {
  try {
    const list = await risuai.unwarpSafeArray(await doc!.querySelectorAll('[x-goei-fab], [x-goei-intro]'));
    for (const el of list) await el.remove().catch(() => {});
  } catch {
    /* 못 지워도 새 버튼은 만든다 */
  }
}

/**
 * 주의: Risu의 SafeElement.addEventListener는 요소가 아니라 문서 전체에 리스너를 건다.
 * 그래서 모든 클릭·포인터 이벤트에서 좌표가 버튼 안인지 직접 확인해야 한다.
 */
export async function createFab(onOpen: () => void): Promise<Fab> {
  const root = await body();
  if (!root) throw new Error('Risu 화면 접근 권한이 없어요.');
  const { doc } = root;
  // 플러그인을 업데이트하면 이전 판이 미처 못 지운 버튼·접속 효과가 남을 수 있다 (죽은 버튼이 새 버튼을 가리지 않게)
  await removeLeftovers(doc);
  const host = await doc.createElement('div');
  await host.setAttribute('x-goei-fab', 'true');
  await host.setInnerHTML(`<button type="button" aria-label="${BRAND.fab} 열기 (끌어서 옮기기)">${GHOST_ICON}</button>`);
  const style = await doc.createElement('style');
  await style.setTextContent(FAB_CSS);
  await host.appendChild(style);
  await root.body.appendChild(host);
  const button = await host.querySelector('button');
  if (!button) throw new Error('여는 버튼을 만들지 못했어요.');

  let pos = await loadPos();
  const applyPos = async () => {
    await host.setStyle('right', `${pos.right}px`);
    await host.setStyle('bottom', `${pos.bottom}px`);
  };
  await applyPos();

  let visible = false;
  let shown: boolean | null = null;
  // 선택지 용사와 같은 방식: 리스너는 처음에 한 번만 걸고, 상태는 await 없이 바로 바꾼다.
  // Risu는 이벤트를 비동기로 넘겨주므로, 끌기마다 리스너를 새로 걸면 손을 떼는 이벤트를 놓쳐
  // 버튼이 굳어 버린다. 누를 때마다 이전 끌기 상태는 버린다.
  let drag: DragState | null = null;
  let moved = false;
  let pending: { x: number; y: number } | null = null;
  let loop: Promise<void> | null = null;
  const rect = async () => (visible ? ((await button.getBoundingClientRect()) as Rect) : null);
  const viewport = async () => {
    const r = (await root.body.getBoundingClientRect()) as Rect;
    return { vw: r.width, vh: r.height };
  };
  const savePos = async () => {
    try {
      await risuai.safeLocalStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {
      /* 위치 저장 실패는 무시 */
    }
  };

  const runDrag = async () => {
    try {
      while (pending && drag) {
        const d = drag;
        const p = pending;
        pending = null;
        const hit = await d.hit;
        if (drag !== d) continue;
        if (!hit) {
          drag = null;
          break;
        }
        const dx = p.x - d.x;
        const dy = p.y - d.y;
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) continue;
        if (!moved) {
          moved = true;
          await host.setAttribute('x-goei-drag', 'true');
        }
        pos = dragTo(d.start, dx, dy, hit.vw, hit.vh);
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
    if (!visible || typeof ev.clientX !== 'number' || typeof ev.clientY !== 'number') return;
    if ((ev.buttons ?? 1) !== 1 && (ev.button ?? 0) !== 0) return;
    const x = ev.clientX;
    const y = ev.clientY;
    drag = {
      x,
      y,
      start: { ...pos },
      hit: (async () => {
        const r = await rect();
        if (!inside(r, x, y)) return null;
        return { rect: r!, ...(await viewport()) };
      })().catch(() => null),
    };
  };
  const onMove = (ev: PointerEv) => {
    if (!drag || typeof ev.clientX !== 'number' || typeof ev.clientY !== 'number') return;
    if (ev.buttons !== undefined && ev.buttons !== 1) {
      drag = null; // 손을 뗀 이벤트를 놓쳤으면 여기서 끝낸다
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
        await savePos();
      }
    });
  };
  const onClick = async (ev: PointerEv) => {
    if (!visible) return;
    if (!inside(await rect(), ev.clientX, ev.clientY)) return;
    await loop;
    if (moved) return; // 끌고 놓은 뒤 따라오는 클릭
    onOpen();
  };

  // 리스너는 선택지용사처럼 버튼 상자(host)에 건다. 웹 Risu에서 플러그인을 업데이트하면 리스너가 지워져
  // 버튼이 모양만 남는 일이 있었다(껐다 켜면 살아남). 그래서 버튼이 다시 보일 때마다 새로 건다.
  let ids: { type: string; id: string }[] = [];
  const unbind = async () => {
    const old = ids;
    ids = [];
    for (const { type, id } of old) await host.removeEventListener(type, id).catch(() => {});
  };
  const bind = async () => {
    await unbind();
    for (const [type, fn] of [
      ['pointerdown', onDown],
      ['pointermove', onMove],
      ['pointerup', onUp],
      ['pointercancel', onUp],
      ['click', onClick],
    ] as const) {
      ids.push({ type, id: await host.addEventListener(type, fn as (e: unknown) => void, { passive: true }) });
    }
  };
  await bind();

  return {
    async setVisible(next, glow = false) {
      if (shown === next && !glow) return;
      const reappear = next && !shown;
      shown = next;
      if (reappear) await bind().catch(() => {});
      visible = next;
      if (!next) {
        drag = null;
        pending = null;
      } else {
        const { vw, vh } = await viewport();
        pos = clampPos(pos, vw, vh);
        await applyPos();
      }
      await host.setAttribute('x-goei-glow', String(next && glow));
      await host.setStyle('display', next ? 'block' : 'none');
    },
    async setTheme(theme) {
      await host.setAttribute('x-goei-theme', theme);
    },
    async chatScreenVisible() {
      return !!(await doc.querySelector('.default-chat-screen'));
    },
    async remove() {
      visible = false;
      drag = null;
      pending = null;
      // Risu는 정리를 1초만 기다리고 플러그인을 끝낸다. 눈에 보이는 버튼부터 지운다
      await host.remove();
      await unbind();
    },
  };
}

/** 접속 효과는 테마와 상관없이 늘 어두운 원래 배색 (밝은 테마에서 너무 눈부셔서) */
export async function playIntro(): Promise<void> {
  const root = await body();
  if (!root) return;
  const host = await root.doc.createElement('div');
  await host.setAttribute('x-goei-intro', 'true');
  await host.setInnerHTML(INTRO_HTML);
  const style = await root.doc.createElement('style');
  await style.setTextContent(INTRO_CSS);
  await host.appendChild(style);
  await root.body.appendChild(host);
  await new Promise((r) => setTimeout(r, INTRO_MS));
  await host.remove();
}
