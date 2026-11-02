// 능력 뱃지 그림 (game-pack/ui-badges/sheet1~6.png = 은색 확정판 game-src/art/ui/badges/sheetN_완성.png).
// 동·금은 tools/badges/tint.py 와 같은 밝기 그라디언트 맵을 코드로 입힌다(팩에는 은색만).
import { CW_BADGE } from './charWindowTable.gen';

type Tone = '일반' | '희귀' | '특급';
const RAMP: Record<Tone, number[][] | null> = {
  희귀: null, // 은 = 그대로
  일반: [[40, 22, 12], [150, 84, 40], [236, 176, 120]],
  특급: [[56, 38, 6], [196, 146, 30], [255, 236, 150]],
};
let sheets: (HTMLImageElement | null)[] = [];
const cache = new Map<string, HTMLCanvasElement>();

export function loadBadges(urlOf: (file: string) => Promise<string>) {
  sheets = [];
  cache.clear();
  for (let k = 1; k <= 6; k++) {
    const i = k - 1;
    void urlOf(`sheet${k}.png`).then((src) => {
      const im = new Image();
      im.onload = () => { sheets[i] = im; };
      im.src = src;
    }).catch(() => { /* 그림 없으면 빈 칸 */ });
  }
}

/** 능력 이름·등급 → 64×64 뱃지 (그림이 아직 없으면 null) */
export function badgeOf(name: string, grade: Tone = '희귀'): HTMLCanvasElement | null {
  const n = CW_BADGE[name];
  if (n === undefined) return null;
  const key = `${n}|${grade}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sh = sheets[Math.floor(n / 32)];
  if (!sh) return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(sh, (n % 8) * 64, Math.floor((n % 32) / 8) * 64, 64, 64, 0, 0, 64, 64);
  const ramp = RAMP[grade];
  if (ramp) {
    const d = g.getImageData(0, 0, 64, 64), px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      const t = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
      const [a, b, u] = t < 0.5 ? [ramp[0], ramp[1], t * 2] : [ramp[1], ramp[2], (t - 0.5) * 2];
      for (let c = 0; c < 3; c++) px[i + c] = Math.round(a[c] + (b[c] - a[c]) * u);
    }
    g.putImageData(d, 0, 0);
  }
  cache.set(key, cv);
  return cv;
}
