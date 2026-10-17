// 지도 확대: 지도 칸(.gx-canvas)은 그대로 두고 안쪽 그림(.gx-mapzoom)만 키우고 옮긴다.
// 휴대폰은 두 손가락 벌리기·한 손가락 끌기, PC는 Ctrl+휠(트랙패드 오므리기)·끌기, 어디서나 +/− 버튼.
// 핀은 그림과 함께 자리를 옮기고, 크기는 조금만 커지도록 되돌려 줄인다(--pz).

const MAX = 4;
const MOVE = 6;

interface View { z: number; x: number; y: number }

/** 지역별 확대 상태. 다시 그려도 보던 자리를 지킨다 */
const views = new Map<string, View>();

export function mapZoomControls(): string {
  return `<div class="gx-zoom" aria-label="지도 확대">
      <button class="gx-zbtn" data-zoom="in" aria-label="확대">+</button>
      <button class="gx-zbtn" data-zoom="out" aria-label="축소">−</button>
      <button class="gx-zbtn reset" data-zoom="reset" aria-label="원래 크기">⤢</button>
    </div>`;
}

function clamp(v: View, w: number, h: number): View {
  const z = Math.min(MAX, Math.max(1, v.z));
  return { z, x: Math.min(0, Math.max(w - w * z, v.x)), y: Math.min(0, Math.max(h - h * z, v.y)) };
}

/** render() 뒤에 부른다. 지도 칸이 없으면 아무것도 안 한다 */
export function bindMapZoom(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLElement>('.gx-canvas[data-map]');
  const layer = canvas?.querySelector<HTMLElement>('.gx-mapzoom');
  if (!canvas || !layer) return;
  const key = canvas.dataset.map ?? '';
  let v = views.get(key) ?? { z: 1, x: 0, y: 0 };

  const apply = () => {
    v = clamp(v, canvas.clientWidth, canvas.clientHeight);
    views.set(key, v);
    layer.style.transform = v.z === 1 ? '' : `translate(${v.x}px, ${v.y}px) scale(${v.z})`;
    layer.style.setProperty('--pz', String(Math.pow(v.z, 0.25) / v.z));
    canvas.classList.toggle('zoomed', v.z > 1);
  };
  /** 칸 안의 한 점(px)을 붙잡은 채 배율을 바꾼다 */
  const zoomAt = (z: number, cx: number, cy: number) => {
    const nz = Math.min(MAX, Math.max(1, z));
    v = { z: nz, x: cx - ((cx - v.x) / v.z) * nz, y: cy - ((cy - v.y) / v.z) * nz };
    apply();
  };
  const local = (px: number, py: number) => {
    const r = canvas.getBoundingClientRect();
    return [px - r.left, py - r.top] as const;
  };
  const img = canvas.querySelector<HTMLImageElement>('.gx-mapimg');
  if (img && !img.complete) img.addEventListener('load', apply, { once: true });
  apply();

  canvas.querySelector('.gx-zoom')?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-zoom]');
    if (!b) return;
    e.stopPropagation();
    const w = canvas.clientWidth / 2, h = canvas.clientHeight / 2;
    if (b.dataset.zoom === 'reset') (v = { z: 1, x: 0, y: 0 }), apply();
    else zoomAt(v.z * (b.dataset.zoom === 'in' ? 1.6 : 1 / 1.6), w, h);
  });

  // 끌고 나서 손을 떼면 그 자리 핀이 눌리지 않게
  let dragged = false;
  canvas.addEventListener('click', (e) => {
    if (dragged && !(e.target as HTMLElement).closest('.gx-zoom')) e.stopPropagation(), e.preventDefault();
    dragged = false;
  }, true);

  // 휴대폰: 터치
  let start: { d: number; mx: number; my: number; v: View; x: number; y: number } | null = null;
  const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches;
    dragged = false;
    if ((e.target as HTMLElement).closest('.gx-zoom')) return (start = null);
    if (t.length === 2) {
      const [mx, my] = local((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
      start = { d: dist(t), mx, my, v: { ...v }, x: t[0].clientX, y: t[0].clientY };
    } else if (t.length === 1) start = { d: 0, mx: 0, my: 0, v: { ...v }, x: t[0].clientX, y: t[0].clientY };
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    const t = e.touches;
    if (!start) return;
    if (t.length === 2 && start.d) {
      e.preventDefault();
      dragged = true;
      const [mx, my] = local((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
      const nz = Math.min(MAX, Math.max(1, (start.v.z * dist(t)) / start.d));
      // 두 손가락 가운데가 잡은 지점을 따라가게
      v = { z: nz, x: mx - ((start.mx - start.v.x) / start.v.z) * nz, y: my - ((start.my - start.v.y) / start.v.z) * nz };
      apply();
    } else if (t.length === 1 && v.z > 1 && !start.d) {
      // 확대했을 때만 한 손가락으로 지도를 옮긴다(아니면 화면 스크롤)
      e.preventDefault();
      const dx = t[0].clientX - start.x, dy = t[0].clientY - start.y;
      if (Math.hypot(dx, dy) > MOVE) dragged = true;
      v = { ...start.v, x: start.v.x + dx, y: start.v.y + dy };
      apply();
    }
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    // 두 손가락 중 하나를 떼면 남은 손가락으로 이어서 옮기기
    const t = e.touches;
    start = t.length === 1 ? { d: 0, mx: 0, my: 0, v: { ...v }, x: t[0].clientX, y: t[0].clientY } : null;
  }, { passive: true });

  // PC: Ctrl+휠·트랙패드 오므리기, 마우스 끌기
  canvas.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const [cx, cy] = local(e.clientX, e.clientY);
    zoomAt(v.z * Math.exp(-e.deltaY / 200), cx, cy);
  }, { passive: false });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || v.z === 1 || (e.target as HTMLElement).closest('.gx-zoom')) return;
    const sx = e.clientX, sy = e.clientY, sv = { ...v };
    dragged = false;
    const move = (m: PointerEvent) => {
      const dx = m.clientX - sx, dy = m.clientY - sy;
      if (Math.hypot(dx, dy) > MOVE) dragged = true;
      if (dragged) (v = { ...sv, x: sv.x + dx, y: sv.y + dy }), apply();
    };
    const up = () => (window.removeEventListener('pointermove', move), window.removeEventListener('pointerup', up));
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
}
