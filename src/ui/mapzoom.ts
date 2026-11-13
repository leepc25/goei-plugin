// 지도 확대: 지도 칸(.gx-canvas)은 그대로 두고 안쪽 그림(.gx-mapzoom)만 키우고 옮긴다.
// 휴대폰은 두 손가락 벌리기·한 손가락 끌기, PC는 Ctrl+휠(트랙패드 오므리기)·끌기, 어디서나 +/− 버튼.
// 핀은 그림과 함께 자리를 옮기고, 크기는 조금만 커지도록 되돌려 줄인다(--pz).

const MAX = 4;
const MOVE = 6;

interface View { z: number; x: number; y: number }

/** 지역별 확대 상태. 다시 그려도 보던 자리를 지킨다 */
const views = new Map<string, View>();

/** nation: 지역 지도일 때 맨 아래 「전국」 (v0.16.17: 지도 위 줄에 있던 ← 전국을 확대 버튼 밑으로).
 *  원래 크기 버튼은 맨 위: 확대하면 생기는데 아래에 두면 +/− 가 한 칸씩 밀려 올라갔다 (v0.16.18) */
export function mapZoomControls(nation = false): string {
  return `<div class="gx-zoom" aria-label="지도 확대">
      <button class="gx-zbtn reset" data-zoom="reset" aria-label="원래 크기"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
      <button class="gx-zbtn" data-zoom="in" aria-label="확대">+</button>
      <button class="gx-zbtn" data-zoom="out" aria-label="축소">−</button>
      ${nation ? '<button class="gx-zbtn txt" data-action="map-region" data-value="01" aria-label="전국 지도">전국</button>' : ''}
    </div>`;
}

/** 보이는 칸(cw·ch) 안에서 그림(lw·lh × z)이 빈틈없이 덮게. 그림이 칸보다 작은 쪽은 가운데 */
function clamp(v: View, cw: number, ch: number, lw: number, lh: number): View {
  const z = Math.min(MAX, Math.max(1, v.z));
  const fit = (p: number, c: number, l: number) => (l * z <= c ? (c - l * z) / 2 : Math.min(0, Math.max(c - l * z, p)));
  return { z, x: fit(v.x, cw, lw), y: fit(v.y, ch, lh) };
}

type Box = { l: number; t: number; r: number; b: number };
const hit = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const box = (el: Element): Box => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
const rank = (el: Element) => (el.classList.contains('sel') ? 0 : /\bhot/.test(el.className) ? 1 : 2);

/** 이름표끼리 겹치거나 남의 점을 덮으면 그 이름표를 점 위·오른쪽·왼쪽·귀퉁이로 옮겨 보고, 어디에도 자리가 없을 때만 숨기고 점만 남긴다
 *  (11-09 점검 13: 서울 이름표를 인천이 덮어 안 눌림). 앞선 핀(고른 곳 → 사건 난 곳 → 원래 순서)이 먼저 자리를 잡는다.
 *  확대해 자리가 나면 제자리로 돌아온다. 점은 따로 그린 겹(gx-pdot)이라 이름표를 옮겨도 그대로. 숨긴 핀은 점 쪽이 대신 눌리고 읽힌다 */
function declutter(layer: HTMLElement, frame: HTMLElement, z: number): void {
  const labs = [...layer.querySelectorAll<HTMLElement>('.gx-pin.gx-plab')];
  const dots = [...layer.querySelectorAll<HTMLElement>('.gx-pin.gx-pdot')];
  if (!labs.length) return;
  for (const el of labs) el.style.removeProperty('--lx'), el.style.removeProperty('--ly');
  const F = box(frame);
  const inFrame = (r: Box) => r.l >= F.l && r.r <= F.r && r.t >= F.t && r.b <= F.b;
  const dotBox = dots.map((d) => { const dot = d.querySelector('.gx-dot'); return dot ? box(dot) : null; });
  const order = labs.map((el, i) => ({ el, i })).sort((a, b) => rank(a.el) - rank(b.el) || a.i - b.i);
  // 확대 단추 밑에도 이름표를 두지 않는다
  const placed: Box[] = [...frame.querySelectorAll('.gx-zbtn')].map(box);
  for (const { el, i } of order) {
    const name = el.querySelector('.gx-pname');
    const D = dotBox[i];
    if (!name || !D) continue;
    const N = box(name);
    const w = N.r - N.l, h = N.b - N.t, my = (D.t + D.b) / 2 - h / 2;
    // 아래(제자리) → 위 → 오른쪽 → 왼쪽 → 네 귀퉁이
    const up = D.t - 2 - h, dn = D.b + 2, rt = D.r + 1, lt = D.l - 1 - w;
    const spots: [number, number][] = [[N.l, N.t], [N.l, up], [D.r + 3, my], [D.l - 3 - w, my], [rt, up], [lt, up], [rt, dn], [lt, dn]];
    const free = (r: Box) => !placed.some((p) => hit(p, r)) && !dotBox.some((d, j) => j !== i && d && hit(d, r));
    let at = -1;
    spots.some(([l, t], k) => {
      const r = { l, t, r: l + w, b: t + h };
      if ((k === 0 || inFrame(r)) && (rank(el) === 0 && k === 0 || free(r))) return (at = k), placed.push(r), true;
      return false;
    });
    const blocked = at < 0;
    el.classList.toggle('lab-off', blocked);
    if (at > 0) {
      el.style.setProperty('--lx', `${(spots[at][0] - N.l) / z}px`);
      el.style.setProperty('--ly', `${(spots[at][1] - N.t) / z}px`);
    }
    const d = dots[i];
    d.toggleAttribute('title', blocked);
    if (blocked) d.title = el.getAttribute('aria-label') ?? '';
    d.tabIndex = blocked ? 0 : -1;
    d.setAttribute('aria-hidden', String(!blocked));
  }
}

/** render() 뒤에 부른다. 지도 칸이 없으면 아무것도 안 한다 */
export function bindMapZoom(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLElement>('.gx-canvas[data-map]');
  const layer = canvas?.querySelector<HTMLElement>('.gx-mapzoom');
  if (!canvas || !layer) return;
  const key = canvas.dataset.map ?? '';
  // 처음엔 가운데 (PC 임무 탭은 칸이 그림보다 낮아 위아래가 잘린다. 2026-10-21 사용자: 끌어서 본다)
  let v = views.get(key) ?? { z: 1, x: 0, y: Number.NaN };
  const canPan = () => layer.offsetWidth * v.z > canvas.clientWidth + 1 || layer.offsetHeight * v.z > canvas.clientHeight + 1;

  const img = canvas.querySelector<HTMLImageElement>('.gx-mapimg');
  const apply = () => {
    // 그림이 불리기 전엔 크기가 0이라 가운데를 못 잰다. 저장하지 않고 load 뒤에 맞춘다 (전수검사 11-13)
    if (Number.isNaN(v.y) && img && !img.complete) {
      layer.style.transform = '';
      return;
    }
    if (Number.isNaN(v.y)) v = { ...v, y: (canvas.clientHeight - layer.offsetHeight) / 2 };
    v = clamp(v, canvas.clientWidth, canvas.clientHeight, layer.offsetWidth, layer.offsetHeight);
    views.set(key, v);
    layer.style.transform = v.z === 1 && !v.x && !v.y ? '' : `translate(${v.x}px, ${v.y}px) scale(${v.z})`;
    layer.style.setProperty('--pz', String(Math.pow(v.z, 0.25) / v.z));
    canvas.classList.toggle('zoomed', v.z > 1);
    canvas.classList.toggle('pan', canPan());
    declutter(layer, canvas, v.z);
  };
  /** 칸 안의 한 점(px)을 붙잡은 채 배율을 바꾼다 */
  const zoomAt = (z: number, cx: number, cy: number) => {
    const nz = Math.min(MAX, Math.max(1, z));
    v = { z: nz, x: cx - ((cx - v.x) / v.z) * nz, y: cy - ((cy - v.y) / v.z) * nz };
    apply();
  };
  const local = (px: number, py: number) => {
    const r = canvas.getBoundingClientRect();
    return [px - r.left - canvas.clientLeft, py - r.top - canvas.clientTop] as const;
  };
  if (img && !img.complete) img.addEventListener('load', apply, { once: true });
  apply();

  canvas.querySelector('.gx-zoom')?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-zoom]');
    if (!b) return;
    e.stopPropagation();
    const w = canvas.clientWidth / 2, h = canvas.clientHeight / 2;
    if (b.dataset.zoom === 'reset') (v = { z: 1, x: 0, y: Number.NaN }), apply();
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
    } else if (t.length === 1 && canPan() && !start.d) {
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

  // PC: Ctrl+휠(트랙패드 오므리기)로만 확대·축소, 마우스 끌기.
  // 그냥 휠은 창 스크롤 (v0.16.18: v0.16.17에서 그냥 휠로 확대하게 했더니 불편했다)
  canvas.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const [cx, cy] = local(e.clientX, e.clientY);
    zoomAt(v.z * Math.exp(-e.deltaY / 200), cx, cy);
  }, { passive: false });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !canPan() || (e.target as HTMLElement).closest('.gx-zoom')) return;
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
