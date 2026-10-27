// Risu 본 화면(getRootDocument)에 붙는 요소: 플로팅 버튼과 접속 효과.
// 본 화면 DOM은 SafeElement로만 다룰 수 있고, 스타일은 x- 속성 선택자로 범위를 좁힌다.
import { clampPos, DEFAULT_FAB_POS, dragTo, DRAG_THRESHOLD, FAB_SIZE, inside, parsePos, type FabPos, type Rect } from '../core/fab';
import { GHOST_ICON } from '../ui/icons';
import { BRAND } from '../ui/brand';
import { LANDING_CSS } from '../ui/landing';
import { cardVarsCss, PALETTES, type ThemeName } from '../ui/theme';
import { statusCss } from '../ui/status';
import { getPrefs } from '../core/settings';
import { imgCss, imgHidden } from '../core/imgtag';

/** 시작 메시지 안내(host/openinghint.ts): 대화가 시작되면(메시지가 하나라도 생기면) 숨긴다. 첫 장면은 .chat-message-container 밖에 있다 */
const OPENING_CSS = '.default-chat-screen:has(.chat-message-container) [data-goei-card="opening"]{display:none!important}';

/** 채팅 속 카드·상태창 배색 (상태창은 설정 「상태창」을, 캐릭터 이미지 칸은 「이미지 크기」·「접는 정도」·에셋 출력을 따른다) */
const chatCss = (t: ThemeName) => cardVarsCss(t) + LANDING_CSS + OPENING_CSS + statusCss(getPrefs().status ?? 'auto', t)
  + imgCss(getPrefs().imgSize, getPrefs().imgFoldOn === false ? 100 : getPrefs().imgFold, imgHidden());

/** 창과 같은 배색을 x-goei-theme 속성별 CSS 변수로 (본 화면에서는 style 속성으로 변수를 못 넣을 수 있어 선택자로 나눈다) */
function themeVars(sel: string): string {
  return (Object.keys(PALETTES) as ThemeName[]).map((t) => {
    const p = PALETTES[t];
    return `${sel}${t === 'dark' ? '' : `[x-goei-theme="${t}"]`} { --g-void: ${p.void}; --g-panel: ${p.panel}; --g-line: ${p.line}; --g-text: ${p.text}; --g-sub: ${p.sub}; --g-signal: ${p.signal}; --g-acc: ${p.accentBg}; --g-acc-line: ${p.accentLine}; --g-scrim: ${p.scrim}; }`;
  }).join('\n');
}

/** 접속 효과 길이 (표가 펼쳐졌다 사라지는 시간) */
export const INTRO_MS = 2000;

const FAB_CSS = `
${themeVars('[x-goei-fab]')}
[x-goei-fab] {
  position: fixed; right: 16px; bottom: 96px; z-index: 45; /* 플러그인 창(49)·Risu 경고(50) 아래 */
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
[x-goei-fab] button svg { width: 26px; height: 26px; pointer-events: none; }
@keyframes goei-fab-glow {
  0%, 100% { box-shadow: 0 6px 18px -6px rgba(0,0,0,.45), 0 0 0 0 transparent; }
  50% { box-shadow: 0 6px 18px -6px rgba(0,0,0,.45), 0 0 0 7px color-mix(in srgb, var(--g-signal) 22%, transparent), 0 0 26px 6px color-mix(in srgb, var(--g-signal) 35%, transparent); }
}
@media (prefers-reduced-motion: reduce) { [x-goei-fab][x-goei-intro="true"] * { animation: none !important; } }

/* 접속 효과 (v0.16.22, 사용자 설계): 위쪽 띠 대신 유령 버튼 자리에서. 버튼이 튀어나오며 고리가 퍼지고,
   버튼 옆으로 「ANOMALY SIMULATION」 표가 잠깐 펼쳐졌다 사라진다.
   v0.16.28 (사용자 요청): 표도 테마를 따른다. 다크는 네온 빛줄기와 글리치, 라이트는 맑은 빛줄기만, 페이퍼는 도장 찍듯 눌리는 잉크 */
[x-goei-fab] [data-gr], [x-goei-fab] [data-gl] { display: none; }
[x-goei-fab][x-goei-intro="true"] button { animation: goei-fab-pop 560ms cubic-bezier(.2,1.5,.4,1) both, goei-fab-glow 1.2s ease-in-out 560ms 1; }
[x-goei-fab][x-goei-intro="true"] [data-gr] {
  display: block; position: absolute; inset: 0; border-radius: 14px; pointer-events: none;
  border: 2px solid var(--g-signal); opacity: 0; animation: goei-ring 1100ms ease-out 120ms both;
}
[x-goei-fab][x-goei-intro="true"] [data-gr] + [data-gr] { animation-delay: 480ms; }
[x-goei-fab][x-goei-intro="true"] [data-gl] {
  --gl-dx: 12px;
  display: flex; align-items: center; gap: 8px; position: absolute; top: 50%; right: calc(100% + 12px);
  height: 36px; padding: 0 16px; box-sizing: border-box; border-radius: 10px; overflow: hidden; white-space: nowrap; pointer-events: none;
  background: color-mix(in srgb, var(--g-void) 94%, transparent); border: 1px solid color-mix(in srgb, var(--g-signal) 45%, transparent); box-shadow: 0 10px 26px -10px rgba(0,0,0,.65);
  color: var(--g-text); font: 700 12.5px/1 'IBM Plex Sans KR', system-ui, -apple-system, "Noto Sans KR", sans-serif; letter-spacing: .2em;
  transform-origin: right center; opacity: 0; animation: goei-label ${INTRO_MS}ms cubic-bezier(.2,.8,.2,1) 260ms both;
}
[x-goei-fab][x-goei-side="left"][x-goei-intro="true"] [data-gl] { --gl-dx: -12px; right: auto; left: calc(100% + 12px); transform-origin: left center; }
[x-goei-fab] [data-gs] {
  position: absolute; top: 0; bottom: 0; left: 0; width: 45%;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--g-signal) 28%, transparent), transparent);
  animation: goei-in-sweep 800ms ease-out 420ms both;
}
[x-goei-fab] [data-gt] { position: relative; animation: goei-in-glitch 520ms steps(1) 480ms 1; }
/* 라이트: 밝은 판, 글리치 없이 빛줄기만 */
[x-goei-fab][x-goei-theme="light"][x-goei-intro="true"] [data-gl] { background: color-mix(in srgb, var(--g-panel) 96%, transparent); box-shadow: 0 10px 24px -12px rgba(15, 60, 52, .35); }
[x-goei-fab][x-goei-theme="light"] [data-gt] { color: var(--g-signal); animation: none; }
/* 페이퍼: 종이 판에 잉크 도장. 빛줄기·글리치 대신 한 번 눌렸다 번지듯 */
[x-goei-fab][x-goei-theme="paper"][x-goei-intro="true"] [data-gl] {
  background: var(--g-panel); border-color: color-mix(in srgb, var(--g-signal) 70%, transparent); box-shadow: 0 8px 20px -12px rgba(60, 40, 10, .45);
}
[x-goei-fab][x-goei-theme="paper"] [data-gs] { display: none; }
[x-goei-fab][x-goei-theme="paper"] [data-gt] { color: var(--g-signal); animation: goei-in-stamp 620ms cubic-bezier(.3,1.4,.5,1) 380ms both; }
@keyframes goei-in-stamp {
  0% { opacity: 0; transform: scale(1.35); letter-spacing: .32em; filter: blur(1.5px); }
  55% { opacity: 1; transform: scale(.96); filter: blur(0); }
  100% { opacity: 1; transform: scale(1); letter-spacing: .2em; }
}
@keyframes goei-fab-pop {
  0% { opacity: 0; transform: scale(.2) rotate(-25deg); }
  60% { opacity: 1; transform: scale(1.18) rotate(6deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}
@keyframes goei-ring { 0% { opacity: .9; transform: scale(.7); } 100% { opacity: 0; transform: scale(2.6); } }
@keyframes goei-label {
  0% { opacity: 0; transform: translate(var(--gl-dx), -50%) scaleX(.5); }
  16% { opacity: 1; transform: translate(0, -50%) scaleX(1); }
  82% { opacity: 1; transform: translate(0, -50%) scaleX(1); }
  100% { opacity: 0; transform: translate(0, -50%) scaleX(1); }
}
@keyframes goei-in-sweep { from { transform: translateX(-100%); } to { transform: translateX(260%); } }
@keyframes goei-in-glitch {
  0% { transform: translate(0); text-shadow: 2px 0 #ff5a7a, -2px 0 #4fe0ff; }
  20% { transform: translate(-1px, 0); }
  40% { transform: translate(1px, 0); text-shadow: -1px 0 #ff5a7a, 1px 0 #4fe0ff; }
  60% { transform: translate(0); text-shadow: none; }
  100% { transform: translate(0); }
}
`;

const FAB_HTML = (label: string) => `<span data-gr></span><span data-gr></span>
<span data-gl aria-hidden="true"><span data-gs></span><span data-gt>ANOMALY SIMULATION</span></span>
<button type="button" aria-label="${label}">${GHOST_ICON}</button>`;

type Safe = Awaited<ReturnType<RisuaiPluginAPI['getRootDocument']>>;
type SafeEl = Awaited<ReturnType<Safe['createElement']>>;

export async function body(): Promise<{ doc: Safe; body: SafeEl } | null> {
  // 본 화면 접근 권한을 거부하면 null이 온다.
  const doc = (await risuai.getRootDocument()) as Safe | null;
  if (!doc) return null;
  const b = await doc.querySelector('body');
  return b ? { doc, body: b } : null;
}

export interface Fab {
  /** intro: 이 봇 채팅 화면에 막 들어왔을 때 버튼 자리에서 접속 효과 */
  setVisible(visible: boolean, intro?: boolean): Promise<void>;
  /** 창을 열면 효과를 바로 끝낸다 */
  endIntro(): void;
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
  await host.setInnerHTML(FAB_HTML(`${BRAND.fab} 열기 (끌어서 옮기기)`));
  const style = await doc.createElement('style');
  await style.setTextContent(FAB_CSS);
  await host.appendChild(style);
  // 채팅 속 카드 배색 (테마를 바꾸면 이 내용만 바꾼다)
  const cardStyle = await doc.createElement('style');
  await cardStyle.setTextContent(chatCss('dark'));
  await host.appendChild(cardStyle);
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
  let introTimer: ReturnType<typeof setTimeout> | undefined;
  const endIntro = () => {
    if (introTimer === undefined) return;
    clearTimeout(introTimer);
    introTimer = undefined;
    void host.setAttribute('x-goei-intro', 'false').catch(() => {});
  };
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
    async setVisible(next, intro = false) {
      if (shown === next && !intro) return;
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
      endIntro();
      if (next && intro) {
        // 버튼이 화면 왼쪽 절반에 있으면 표를 오른쪽으로 펼친다
        const { vw } = await viewport();
        await host.setAttribute('x-goei-side', pos.right + FAB_SIZE / 2 > vw / 2 ? 'left' : 'right');
        await host.setAttribute('x-goei-intro', 'true');
        introTimer = setTimeout(endIntro, INTRO_MS + 400);
      }
      await host.setStyle('display', next ? 'block' : 'none');
    },
    endIntro,
    async setTheme(theme) {
      await host.setAttribute('x-goei-theme', theme);
      await cardStyle.setTextContent(chatCss(theme));
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
