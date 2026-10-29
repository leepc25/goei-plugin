// 화면 틀: 1280×720 내부 해상도를 상자 크기에 맞춘다. 채우기(기본)는 가로로 긴 화면에서 캔버스를 옆으로 넓혀 검은 띠를 없앤다.
// 층: 게임 캔버스 → CRT 덮개 → 메뉴(1280×720 좌표) / 터치 버튼(상자 전체) / 세로 화면 안내
import css from './ui.css';
import { mountCrt, type Crt } from './crt';
import { ensureKit } from './kit';

export const W = 1280,
  H = 720;

export interface Stage {
  root: HTMLElement;
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** 메뉴·대화창이 들어가는 1280×720 층 */
  ui: HTMLElement;
  /** 터치 버튼 층 (상자 전체, 배율 없음) */
  touch: HTMLElement;
  scale: number;
  /** 캔버스 가로 (논리 px). 맞춤이면 1280, 채우기면 화면 비율만큼 넓어진다 (최대 1800). 세로는 늘 720 */
  vw: number;
  /** height: 필드용. 창 높이에 맞추고, 창이 16:9보다 좁으면 캔버스를 좁힌다(가로는 엔진이 주인공을 따라 자름) */
  setFit(mode: 'fill' | 'fit' | 'height'): void;
  /** 세로로 든 폰에서 게임 전체를 90도 돌려 크게 보여 주는 중 */
  turned: boolean;
  /** 화면 좌표 → 요소 기준 좌표 (돌려 보기 중에도 맞음) */
  toLocal(clientX: number, clientY: number, el: HTMLElement): { x: number; y: number };
  /** 화면 좌표 → 게임 좌표 */
  toGame(clientX: number, clientY: number): { x: number; y: number };
  portrait: boolean;
  onResize(fn: () => void): void;
  setCrt(mode: 'off' | 'screen' | 'curved'): void;
  setBright(v: number): void;
  setPixel(on: boolean): void;
  fullscreen(): Promise<void>;
  dispose(): void;
}

/** 세로 화면에서 게임 화면 위쪽 여백: 위쪽 1/3 쯤에 두고 아래는 터치 버튼 자리 */
export const portraitTop = (bh: number, h: number) => Math.max(8, Math.min((bh - h) * 0.35, bh - h));

let cssAdded = false;
export function mountStage(box: HTMLElement): Stage {
  if (!cssAdded || !document.getElementById('goei-ui-css')) {
    const st = document.createElement('style');
    st.id = 'goei-ui-css';
    st.textContent = css;
    document.head.append(st);
    cssAdded = true;
  }
  ensureKit();
  const root = document.createElement('div');
  root.className = 'gs';
  root.tabIndex = 0;
  root.innerHTML = `<div class="gs-stage"><canvas class="gs-canvas" width="${W}" height="${H}" aria-label="게임 화면"></canvas><div class="gs-crt"></div><div class="gs-ui"></div></div><div class="gs-touch"></div><div class="gs-rotate"><div class="gs-rot-ico"></div><b>폰을 가로로 돌려 주세요</b><span>세로 그대로면 화면이 아주 작습니다</span><div class="gs-rot-row"><button type="button" data-rot="turn">화면 돌려서 크게</button><button type="button" data-rot="keep">세로로 작게</button></div></div>`;
  box.append(root);
  const stageEl = root.querySelector<HTMLElement>('.gs-stage')!;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const ui = root.querySelector<HTMLElement>('.gs-ui')!;
  const touch = root.querySelector<HTMLElement>('.gs-touch')!;
  const rotate = root.querySelector<HTMLElement>('.gs-rotate')!;
  const fns: (() => void)[] = [];
  let crt: Crt | null | undefined;
  let keepPortrait = false;
  // 채우기는 엔진이 넓은 캔버스를 그릴 수 있을 때만 켠다 (setFit('fill'))
  let fill = false,
    byHeight = false;
  const coarse = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  // 세로로 든 폰은 처음부터 90도 돌려 꽉 채운다 (통합 규격 3장: 세로에 작게 넣지 않는다)
  let turn = coarse();
  const s: Stage = {
    root,
    stage: stageEl,
    canvas,
    ctx,
    ui,
    touch,
    scale: 1,
    vw: W,
    setFit(mode) {
      fill = mode === 'fill';
      byHeight = mode === 'height';
      layout();
    },
    portrait: false,
    turned: false,
    toLocal(cx, cy, el) {
      if (!s.turned) {
        const r = el.getBoundingClientRect();
        return { x: cx - r.left, y: cy - r.top };
      }
      // 시계 방향 90도: 화면 (x, y) → 돌린 상자 안 (y, 상자폭 − x)
      const b = box.getBoundingClientRect();
      let x = cy - b.top,
        y = b.width - (cx - b.left);
      for (let n: HTMLElement | null = el; n && n !== root; n = n.offsetParent as HTMLElement | null) (x -= n.offsetLeft), (y -= n.offsetTop);
      return { x, y };
    },
    toGame(cx, cy) {
      const p = s.toLocal(cx, cy, root);
      const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(stageEl.style.transform);
      return { x: (p.x - (m ? +m[1] : 0)) / s.scale, y: (p.y - (m ? +m[2] : 0)) / s.scale };
    },
    onResize(fn) {
      fns.push(fn);
    },
    setCrt(mode) {
      // WebGL 브라운관(ui/crt.ts). 안 되면 옛 CSS 줄무늬
      const on = mode !== 'off';
      crt ??= mountCrt(stageEl, canvas);
      if (crt) crt.setOn(on, mode === 'curved');
      root.classList.toggle('crt', on && !crt);
      // 켜짐 표식(WebGL·CSS 어느 쪽이든): 시험·스타일이 읽는다
      root.dataset.crt = on ? mode : 'off';
    },
    setBright(v) {
      canvas.style.filter = Math.abs(v - 1) < 0.01 ? '' : `brightness(${v})`;
    },
    setPixel(on) {
      root.classList.toggle('pixel', on);
    },
    async fullscreen() {
      try {
        if (!document.fullscreenElement) await (root.requestFullscreen?.({ navigationUI: 'hide' }) ?? Promise.resolve());
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
      } catch {
        /* iOS·플러그인 창에서는 안 될 수 있다 */
      }
      layout();
    },
    dispose() {
      ro.disconnect();
      crt?.dispose(); // WebGL 브라운관의 rAF·캔버스도 거둔다 (닫은 뒤 계속 돌던 누수)
      crt = null;
      root.remove();
    },
  };
  const layout = () => {
    // 돌려 보기: 상자가 세로인 동안만. 폰을 실제로 가로로 돌리면 저절로 풀린다
    const ow = box.clientWidth,
      oh = box.clientHeight;
    const turnNow = turn && oh > ow * 1.05;
    if (turnNow !== s.turned || turnNow) {
      s.turned = turnNow;
      root.classList.toggle('turned', turnNow);
      Object.assign(root.style, turnNow ? { position: 'absolute', left: '0', top: '0', width: `${oh}px`, height: `${ow}px`, transformOrigin: '0 0', transform: `translate(${ow}px, 0) rotate(90deg)` } : { position: '', left: '', top: '', width: '', height: '', transformOrigin: '', transform: '' });
    }
    const bw = root.clientWidth,
      bh = root.clientHeight;
    if (!bw || !bh) return;
    const portrait = bh > bw * 1.05;
    s.portrait = portrait;
    root.classList.toggle('portrait', portrait);
    // 필드(PC): 캔버스가 상자를 위아래·좌우 꽉 채운다. 캔버스 1px = 화면 픽셀 정수배(도트가 고르게), 엔진은 세로 720 월드를 canvas.height/720 배로 그린다.
    // 상자가 낮으면(폰) 예전처럼 720 화면을 높이에 맞춘다
    const dpr = window.devicePixelRatio || 1;
    const fieldFill = byHeight && !portrait && bh >= 600;
    const k = fieldFill ? Math.max(1, Math.floor(dpr)) / dpr : 1;
    const vh = fieldFill ? Math.round(bh / k) : H;
    // 필드가 16:9 보다 긴 낮은 화면(가로 폰)이면 캔버스를 옆으로 넓혀 좌우 검은 띠 없이 꽉 채운다 (모바일 조작 설계: 가로 전체화면으로 꽉 차게)
    const vw = fieldFill ? Math.round(bw / k) : (fill || byHeight) && !portrait && bw / bh > W / H ? Math.min(byHeight ? 2000 : 1800, Math.round((H * bw) / bh)) : byHeight && !portrait && bw / bh < W / H ? Math.max(640, Math.round((H * bw) / bh)) : W;
    if (vw !== s.vw || canvas.width !== vw || canvas.height !== vh) {
      s.vw = vw;
      canvas.width = vw;
      canvas.height = vh;
      canvas.style.width = stageEl.style.width = `${vw}px`;
      canvas.style.height = stageEl.style.height = `${vh}px`;
    }
    const scale = fieldFill ? k : Math.min(bw / vw, bh / H);
    s.scale = scale;
    const w = s.vw * scale,
      h = vh * scale;
    // 세로 화면: 게임을 위에 붙이고 아래 빈 곳은 터치 버튼 자리
    const top = portrait ? portraitTop(bh, h) : (bh - h) / 2;
    stageEl.style.transform = `translate(${Math.round((bw - w) / 2)}px, ${Math.round(top)}px) scale(${scale})`;
    root.style.setProperty('--gs-scale', String(scale));
    root.style.setProperty('--gs-top', `${top}px`);
    root.style.setProperty('--gs-bottom', `${top + h}px`);
    rotate.classList.toggle('on', portrait && coarse() && !keepPortrait);
    for (const f of fns) f();
  };
  rotate.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-rot]');
    if (!b) return;
    keepPortrait = true;
    if (b.dataset.rot === 'turn') turn = true;
    layout();
  });
  const ro = new ResizeObserver(layout);
  ro.observe(root);
  ro.observe(box);
  layout();
  return s;
}
