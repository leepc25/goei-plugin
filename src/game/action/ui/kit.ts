// 도트 게임 틀과 도트 글꼴: 메뉴·대화창·HUD 가 같이 쓴다. 그림은 kit.gen.ts (tools/ui_pixelize.py).
// DOM 에서 쓰는 법 (본부 대화창 등): ensureKit() 한 번 부르고 클래스만 붙인다.
//   .gk-font  도트 글꼴 (22px 배수로 쓰면 가장 또렷하다)
//   .gk-panel 금속 테두리 창 (안쪽 어두운 판 포함, 안쪽 여백 따로 줄 필요 없음)
//   .gk-btn   오락실 글씨 단추. 고른 것(.on 또는 마우스 올림·초점)은 금색 판 + 왼쪽 마름모
//   .gk-face  얼굴 칸 테두리 (안에 img 를 넣으면 그 위에 테두리를 씌운다)
//   .gk-slot  작은 칸 테두리 (아이템 칸)
import { FACE_JYALDI, KIT_IMG, KIT_META, PIXEL_FONT_URL } from './kit.gen';

export const PIXEL_FONT = 'GoeiPixel';

const img = (k: keyof typeof KIT_META) => `url("${KIT_IMG[k]}")`;
const sl = (k: keyof typeof KIT_META) => (KIT_META[k] as { slice: readonly number[] }).slice;
const px2 = (a: readonly number[]) => a.map((v) => `${v * 2}px`).join(' ');

export function kitCss(): string {
  return `
@font-face { font-family: '${PIXEL_FONT}'; src: url('${PIXEL_FONT_URL}') format('woff2'); font-display: swap; }
.gk-font { font-family: '${PIXEL_FONT}', 'Galmuri11', monospace; -webkit-font-smoothing: none; font-smooth: never; }
.gk-panel { border-style: solid; border-width: ${px2(sl('panel'))}; border-image: ${img('panel')} ${sl('panel').join(' ')} fill / ${px2(sl('panel'))} stretch; image-rendering: pixelated; background: none !important; border-radius: 0 !important; box-shadow: 0 10px 0 rgba(0,0,0,0.45) !important; }
.gk-btn { font-family: '${PIXEL_FONT}', monospace; -webkit-font-smoothing: none; font-size: 22px; font-weight: 700; color: #b8ae96; background: none; border: 0; border-style: solid; border-width: ${px2(sl('row'))}; border-color: transparent; border-image: none; border-radius: 0; text-shadow: 2px 2px 0 #000; cursor: pointer; image-rendering: pixelated; }
.gk-btn.on, .gk-btn.f, .gk-btn:focus-visible, .gk-btn:hover { color: #ffe27a; border-image: ${img('row')} ${sl('row').join(' ')} fill / ${px2(sl('row'))} stretch; }
.gk-face { position: relative; image-rendering: pixelated; }
.gk-face > img { width: 100%; height: 100%; image-rendering: pixelated; display: block; }
.gk-face::after { content: ''; position: absolute; inset: -8px; border-style: solid; border-width: ${px2(sl('portrait'))}; border-image: ${img('portrait')} ${sl('portrait').join(' ')} / ${px2(sl('portrait'))} stretch; pointer-events: none; image-rendering: pixelated; }
.gk-slot { border-style: solid; border-width: ${px2(sl('slot'))}; border-image: ${img('slot')} ${sl('slot').join(' ')} fill / ${px2(sl('slot'))} stretch; image-rendering: pixelated; }
`;
}

let added = false;
/** 글꼴과 틀 CSS 를 문서에 한 번 넣는다 (껍데기가 있으면 이미 들어가 있다) */
export function ensureKit() {
  if (typeof document === 'undefined') return;
  if (added && document.getElementById('goei-kit-css')) return;
  added = true;
  const st = document.createElement('style');
  st.id = 'goei-kit-css';
  st.textContent = kitCss();
  document.head.append(st);
  // 캔버스(HUD)도 이 글꼴을 쓰므로 미리 읽어 둔다
  try {
    const ff = new FontFace(PIXEL_FONT, `url(${PIXEL_FONT_URL})`);
    void ff.load().then((f) => document.fonts.add(f));
  } catch {
    /* 글꼴을 못 읽으면 기본 글꼴 */
  }
}

/** 캔버스용 그림 (HUD 테두리·얼굴) */
const cache = new Map<string, HTMLImageElement>();
export function kitImage(src: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let im = cache.get(src);
  if (!im) {
    im = new Image();
    im.src = src;
    cache.set(src, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}
export const kitPiece = (k: keyof typeof KIT_META) => kitImage(KIT_IMG[k]);
export const kitSlice = sl;
/** 요원 이름 → 얼굴 4장 (0 평소, 1 맞음, 2 위급, 3 필살 준비). 없으면 null */
export function agentFaces(name: string): string[] | null {
  return /쟈알디|jyaldi/i.test(name) ? FACE_JYALDI : null;
}

/** 캔버스 9칸 자르기 (도트 1칸 = k 화면 px) */
export function nine(c: CanvasRenderingContext2D, im: HTMLImageElement, s: readonly number[], x: number, y: number, w: number, h: number, k = 2) {
  const [t, r, b, l] = s;
  const iw = im.naturalWidth,
    ih = im.naturalHeight;
  const T = t * k,
    R = r * k,
    B = b * k,
    L = l * k;
  const sx = [0, l, iw - r, iw],
    sy = [0, t, ih - b, ih];
  const dx = [x, x + L, x + w - R, x + w],
    dy = [y, y + T, y + h - B, y + h];
  c.save();
  c.imageSmoothingEnabled = false;
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 3; i++) {
      const sw = sx[i + 1] - sx[i],
        sh = sy[j + 1] - sy[j],
        dw = dx[i + 1] - dx[i],
        dh = dy[j + 1] - dy[j];
      if (sw > 0 && sh > 0 && dw > 0 && dh > 0) c.drawImage(im, sx[i], sy[j], sw, sh, dx[i], dy[j], dw, dh);
    }
  c.restore();
}
