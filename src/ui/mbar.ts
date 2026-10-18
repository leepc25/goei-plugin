// 모바일 하단 바 (v0.16.23, 사용자 설계): 위키·임무·상황판·괴담톡·괴담넷, 가운데 상황판이 홈.
// 닫기는 양 끝 바깥에 숨어 있고, 바를 좌우로 당기면 고무줄처럼 끌려 나온다.
// 닫기 버튼 폭만큼 끌어낸 채 놓으면 창이 닫히고, 덜 끌었으면 제자리로 튕겨 돌아간다.

export function mbarHtml(items: string[]): string {
  const x = (side: string) => `<span class="gx-mclose ${side}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg><span>닫기</span></span>`;
  return `<div class="gx-mbar"><div class="gx-mtrack">${x('l')}${items.join('')}${x('r')}</div></div>`;
}

/** 당긴 거리 → 보이는 거리 (끌수록 무거워진다) */
const rubber = (dx: number, w: number) => Math.sign(dx) * (Math.abs(dx) / (1 + Math.abs(dx) / (4 * w)));

export function bindMbar(root: HTMLElement, onClose: () => void): void {
  const bar = root.querySelector<HTMLElement>('.gx-mbar');
  const track = bar?.querySelector<HTMLElement>('.gx-mtrack');
  if (!bar || !track) return;
  const closeW = () => track.querySelector<HTMLElement>('.gx-mclose')?.offsetWidth || 72;
  let x0 = 0;
  let y0 = 0;
  let id: number | null = null;
  let dragging = false;
  let shown = 0;
  let ready = false;
  const paint = () => {
    track.style.transform = shown ? `translateX(${shown}px)` : '';
    const was = ready;
    ready = Math.abs(shown) >= closeW();
    track.querySelectorAll('.gx-mclose').forEach((el) => el.classList.toggle('ready', ready));
    if (ready && !was) navigator.vibrate?.(8);
  };
  const end = () => {
    if (id === null) return;
    id = null;
    if (!dragging) return;
    const close = ready;
    track.classList.add('back');
    shown = 0;
    paint();
    setTimeout(() => track.classList.remove('back'), 260);
    if (close) onClose();
  };
  bar.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    id = e.pointerId;
    x0 = e.clientX;
    y0 = e.clientY;
    dragging = false;
    track.classList.remove('back');
  });
  bar.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - x0;
    if (!dragging) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - y0)) return;
      dragging = true;
      bar.setPointerCapture?.(e.pointerId);
    }
    shown = rubber(dx, closeW());
    paint();
  });
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);
  // 끌다가 놓은 손가락이 그 자리 버튼을 누른 걸로 치지 않게
  bar.addEventListener('click', (e) => {
    if (!dragging) return;
    dragging = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}
