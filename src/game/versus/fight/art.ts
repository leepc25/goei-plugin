// 대전 그림 도우미: 인물 팩(그림·장 측정값)과 공용 이펙트 시트만 읽는다. 필드 전투 엔진 코드는 쓰지 않는다.
// 좌표: 그림 1px = K 월드. 장 안 점 (px = 그림 가운데에서 앞으로, py = 캔버스 위에서 아래로) → 월드 (x, 높이 z)
import { charFx, groundOf, type CharArt, type LineMeta, type Vfx } from '../../action/art/charPacks';
import { K, LINE } from './rules';

export type { CharArt, LineMeta, Vfx };

export const vfxOf = (name: string): Vfx | undefined => charFx()?.VFX[name];
export const vfxDur = (v: Vfx) => v.frames.reduce((a, f) => a + f[4], 0) / 1000;
/** 시트에서 지난 시간(초)에 맞는 칸 [x, y, w, h] */
export function sheetFrame(v: Vfx, el: number): number[] {
  let ms = el * 1000, i = 0;
  while (i < v.frames.length - 1 && ms >= v.frames[i][4]) { ms -= v.frames[i][4]; i++; }
  return v.frames[i];
}

/** 장의 땅 기준선 (캔버스 px). 공중 몸(점프·뜬 채)은 그 장의 가장 낮은 점이 몸 높이 z 에 오게 */
export function baseOf(id: string, m: LineMeta, f: number, air: boolean): number {
  return air ? m.bot[f] : groundOf(id, m, f);
}

/** 그림 속 점 → 월드 (x, 화면 y) */
export function framePt(x: number, z: number, face: number, id: string, m: LineMeta, f: number, air: boolean, px: number, py: number) {
  const b = baseOf(id, m, f, air);
  return { x: x + face * px * K, y: LINE - z - (b - py) * K };
}

/** 총구·손끝: 그 장에 잰 총구(mz)가 있으면 총구, 없으면 가장 앞으로 뻗은 손발 높이(reachY) 또는 몸 절반 높이의 앞끝 */
export function muzzleOf(art: CharArt, id: string, f: number): [number, number] {
  const m = art.A[id];
  if (!m) return [40, 150];
  const mz = (m.mz as unknown as number[][] | undefined)?.[f];
  if (mz && mz.length >= 2 && mz[0] != null) return [mz[0] + 1, mz[1]];
  const ry = (art.cfg.reachY as Record<string, number[]> | undefined)?.[id]?.[f];
  return [m.reach[f], ry ?? m.h * 0.45];
}

/** 흰 공용 이펙트에 색 입히기 (밝은 곳은 그 색, 어두운 곳은 어둡게) */
const TINT = new Map<string, HTMLCanvasElement>();
export function tinted(name: string, v: Vfx, c: string): CanvasImageSource {
  const key = name + c;
  const hit = TINT.get(key);
  if (hit) return hit;
  if (!v.img.complete || !v.img.naturalWidth) return v.img;
  const cv = document.createElement('canvas');
  cv.width = v.img.naturalWidth; cv.height = v.img.naturalHeight;
  const g = cv.getContext('2d')!;
  g.drawImage(v.img, 0, 0);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = c; g.fillRect(0, 0, cv.width, cv.height);
  g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.35; g.drawImage(v.img, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(v.img, 0, 0);
  TINT.set(key, cv);
  return cv;
}

/** 실루엣 (한 색으로 칠한 장): 테두리 빛·번쩍임 */
const SIL = new Map<string, HTMLCanvasElement>();
function silhouette(art: CharArt, id: string, f: number, col: string): HTMLCanvasElement | null {
  const m = art.A[id], im = art.IMG[id];
  if (!m || !im || !im.complete) return null;
  const key = `${art.key}|${id}|${f}|${col}`;
  let s = SIL.get(key);
  if (!s) {
    s = document.createElement('canvas');
    s.width = m.w; s.height = m.h;
    const g = s.getContext('2d')!;
    g.drawImage(im, f * m.cw, 0, m.cw, m.ch, m.ox, m.oy, m.cw, m.ch);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = col; g.fillRect(0, 0, m.w, m.h);
    if (SIL.size > 600) SIL.clear();
    SIL.set(key, s);
  }
  return s;
}

export interface SpriteLook {
  /** 덮어 칠할 색과 세기 (번쩍임·K.O. 붉게) */
  over?: { c: string; a: number };
  /** 둘레 빛 */
  edge?: { c: string; a: number };
  alpha?: number;
  /** 그림자 생략 */
  noShadow?: boolean;
}

/** 캐릭터 한 장 + 그림자 (그림자는 필드 식: 장마다 잰 발 foot = [x, 폭, 닿는 높이, 두께]) */
export function drawSprite(c: CanvasRenderingContext2D, art: CharArt, id: string, f: number, x: number, z: number, face: number, air: boolean, look: SpriteLook = {}, k = K, y = LINE) {
  const m = art.A[id], im = art.IMG[id];
  if (!m || !im || !im.complete || !im.naturalWidth) return;
  f = Math.max(0, Math.min(m.n - 1, f));
  const flip = face < 0;
  const base = baseOf(id, m, f, air);
  if (!look.noShadow) {
    const ft = m.foot[f] ?? [0, 40, 0, 0];
    const lift = air ? z : z + Math.max(0, Math.min(m.h - 4, m.floor) - m.bot[f] - 6) * k;
    const up = air ? 0 : base - (m.bot[f] - (ft[2] || 0));
    const sk = Math.max(0.3, 1 - lift / 380) * k;
    c.fillStyle = `rgba(0,0,0,${(0.42 * Math.min(1, sk / k) * (look.alpha ?? 1)).toFixed(3)})`;
    c.beginPath();
    c.ellipse(x + (flip ? -ft[0] : ft[0]) * k, y - up * k - 2 * sk, Math.max(16, Math.min(80, ft[1])) * 0.58 * sk, (5 + Math.min(10, ft[3] || 0)) * sk, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.save();
  c.imageSmoothingEnabled = false;
  c.globalAlpha = look.alpha ?? 1;
  c.translate(Math.round(x), Math.round(y - z));
  c.scale(flip ? -k : k, k);
  const dx = -Math.round(m.w / 2), dy = -base;
  if (look.edge && look.edge.a > 0) {
    const s = silhouette(art, id, f, look.edge.c);
    if (s) {
      c.globalAlpha = (look.alpha ?? 1) * look.edge.a;
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2]]) c.drawImage(s, dx + ox, dy + oy);
      c.globalAlpha = look.alpha ?? 1;
    }
  }
  c.drawImage(im, f * m.cw, 0, m.cw, m.ch, dx + m.ox, dy + m.oy, m.cw, m.ch);
  if (look.over && look.over.a > 0) {
    const s = silhouette(art, id, f, look.over.c);
    if (s) { c.globalAlpha = (look.alpha ?? 1) * look.over.a; c.drawImage(s, dx, dy); }
  }
  c.restore();
}

/** 이펙트 시트 한 칸 그리기. anchor: center(가운데) | bottom(밑동) | pivot(시트 기준점) */
export function drawVfx(c: CanvasRenderingContext2D, name: string, el: number, x: number, y: number, s: number, o: { flip?: boolean; anchor?: 'center' | 'bottom' | 'pivot'; tint?: string; rot?: number; alpha?: number; loop?: boolean } = {}): boolean {
  const v = vfxOf(name);
  if (!v || !v.img.complete || !v.img.naturalWidth) return false;
  const d = vfxDur(v);
  const [fx0, fy0, fw, fh] = sheetFrame(v, o.loop ? el % d : Math.min(el, d - 0.001));
  const img = o.tint ? tinted(name, v, o.tint) : v.img;
  c.save();
  c.imageSmoothingEnabled = false;
  if (o.alpha != null) c.globalAlpha = o.alpha;
  c.translate(Math.round(x), Math.round(y));
  if (o.rot) c.rotate(o.rot);
  c.scale(o.flip ? -s : s, s);
  const anc = o.anchor ?? 'pivot';
  const bpad = (v as Vfx & { bpad?: number }).bpad ?? 0;
  if (anc === 'bottom') c.drawImage(img, fx0, fy0, fw, fh, -fw / 2, -fh + bpad, fw, fh);
  else if (anc === 'center') c.drawImage(img, fx0, fy0, fw, fh, -fw / 2, -fh / 2, fw, fh);
  else c.drawImage(img, fx0, fy0, fw, fh, -fw * v.pivot[0], -fh * v.pivot[1], fw, fh);
  c.restore();
  return true;
}
