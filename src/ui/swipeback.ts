// 모바일 앞뒤로 쓸기 (v0.16.24, 2026-10-19 브라우저 ←·→ 처럼): 화면 아무 데서나 오른쪽으로 쓸면 뒤로, 왼쪽으로 쓸면 앞으로.
// 갈 곳은 app.ts가 정한다(step: -1 뒤로, 1 앞으로). 같은 방향 쓸기를 이미 쓰는 곳(지도, 위키 세로바·목록, 하단 바, 도구 서랍,
// 가로로 넘기는 줄, 입력칸)에서 시작한 쓸기는 건드리지 않는다.

const SKIP = 'input, textarea, select, [contenteditable], .gx-canvas, .gx-mbar, .gx-nav, .nw-rail, .nw-panel, .nw-scrim, .ph-drawer';
const FIRE = 72;
const bound = new WeakSet<HTMLElement>();

/** 가로로 스크롤되는 칸 안에서 시작했는지 (탭 칩 줄, 세력 사진 줄 등) */
function inSideScroller(el: Element | null, root: HTMLElement): boolean {
  for (let n = el; n && n !== root; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 2) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}

export function bindSwipeBack(root: HTMLElement, step: (dir: -1 | 1) => (() => void) | null): void {
  if (bound.has(root)) return;
  bound.add(root);
  let x0 = 0;
  let y0 = 0;
  let mode: 'wait' | 'back' | 'off' = 'off';
  let act: (() => void) | null = null;
  let sign = 1;
  let box: HTMLElement | null = null;
  const reset = (animate: boolean) => {
    if (!box) return;
    const el = box;
    el.style.transition = animate ? 'transform .2s ease, opacity .2s ease' : '';
    el.style.transform = '';
    el.style.opacity = '';
    if (animate) setTimeout(() => (el.style.transition = ''), 220);
    box = null;
  };
  root.addEventListener('touchstart', (e) => {
    mode = 'off';
    if (e.touches.length !== 1 || !matchMedia('(max-width: 760px)').matches) return;
    const t = e.target as Element;
    if (t.closest(SKIP) || inSideScroller(t, root)) return;
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
    mode = 'wait';
  }, { passive: true });
  root.addEventListener('touchmove', (e) => {
    if (mode === 'off') return;
    const dx = e.touches[0].clientX - x0;
    const dy = e.touches[0].clientY - y0;
    if (mode === 'wait') {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      act = Math.abs(dx) > Math.abs(dy) * 1.4 ? step(dx > 0 ? -1 : 1) : null;
      sign = dx > 0 ? 1 : -1;
      if (!act) return void (mode = 'off');
      mode = 'back';
      box = root.querySelector<HTMLElement>('.gx-content');
    }
    if (box) {
      const d = Math.max(0, Math.min(dx * sign * 0.6, 120));
      box.style.transform = `translateX(${d * sign}px)`;
      box.style.opacity = String(1 - d / 400);
    }
  }, { passive: true });
  const end = (e: TouchEvent) => {
    if (mode !== 'back') return void (mode = 'off');
    mode = 'off';
    const dx = (e.changedTouches[0]?.clientX ?? x0) - x0;
    const run = dx * sign >= FIRE ? act : null;
    act = null;
    reset(!run);
    run?.();
  };
  root.addEventListener('touchend', end, { passive: true });
  root.addEventListener('touchcancel', () => {
    mode = 'off';
    reset(true);
  }, { passive: true });
}
