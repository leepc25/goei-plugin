// 화면 틀: 1280×720 내부 해상도를 상자 크기에 16:9 로 맞춘다(남는 곳은 검은 띠).
// 층: 게임 캔버스 → CRT 덮개 → 메뉴(1280×720 좌표) / 터치 버튼(상자 전체) / 세로 화면 안내
import css from './ui.css';

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
  /** 화면 좌표 → 게임 좌표 */
  toGame(clientX: number, clientY: number): { x: number; y: number };
  portrait: boolean;
  onResize(fn: () => void): void;
  setCrt(on: boolean): void;
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
  const root = document.createElement('div');
  root.className = 'gs';
  root.tabIndex = 0;
  root.innerHTML = `<div class="gs-stage"><canvas class="gs-canvas" width="${W}" height="${H}" aria-label="게임 화면"></canvas><div class="gs-crt"></div><div class="gs-ui"></div></div><div class="gs-touch"></div><div class="gs-rotate"><div class="gs-rot-ico"></div><b>가로로 돌려 주세요</b><span>세로에서도 할 수 있지만 화면이 작습니다</span><div class="gs-rot-row"><button type="button" data-rot="fs">전체 화면 · 가로</button><button type="button" data-rot="keep">세로로 계속</button></div></div>`;
  box.append(root);
  const stageEl = root.querySelector<HTMLElement>('.gs-stage')!;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const ui = root.querySelector<HTMLElement>('.gs-ui')!;
  const touch = root.querySelector<HTMLElement>('.gs-touch')!;
  const rotate = root.querySelector<HTMLElement>('.gs-rotate')!;
  const fns: (() => void)[] = [];
  let keepPortrait = false;
  const coarse = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const s: Stage = {
    root,
    stage: stageEl,
    canvas,
    ctx,
    ui,
    touch,
    scale: 1,
    portrait: false,
    toGame(cx, cy) {
      const r = stageEl.getBoundingClientRect();
      return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
    },
    onResize(fn) {
      fns.push(fn);
    },
    setCrt(on) {
      root.classList.toggle('crt', on);
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
      root.remove();
    },
  };
  const layout = () => {
    const bw = root.clientWidth,
      bh = root.clientHeight;
    if (!bw || !bh) return;
    const portrait = bh > bw * 1.05;
    s.portrait = portrait;
    root.classList.toggle('portrait', portrait);
    const scale = Math.min(bw / W, bh / H);
    s.scale = scale;
    const w = W * scale,
      h = H * scale;
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
    if (b.dataset.rot === 'fs') void s.fullscreen();
    layout();
  });
  const ro = new ResizeObserver(layout);
  ro.observe(root);
  layout();
  return s;
}
