// 도트 HUD (사용자 2026-10-25: 「실제 게임처럼」「모두 도트로」「단색으로 깔끔하게」).
// 틀(초상화·기술 칸·체력 막대·필살 게이지)은 PixelLab generate-ui-v2로 뽑은 그림(pixelHudArt.ts)을 1도트 = 1px로 그대로 찍는다.
// 글자는 도트 글꼴을 이진화(흐린 가장자리 없음)해 1도트 검은 테를 두른다. 아이콘은 12×12 단색 도트.
import { HUD_ART } from './pixelHudArt';
import { PIXEL_FONT } from './kit';

type Key = keyof typeof HUD_ART;
const imgs: Partial<Record<Key, HTMLImageElement>> = {};
function img(k: Key): HTMLImageElement | null {
  let im = imgs[k];
  if (!im) { im = new Image(); im.src = HUD_ART[k].src; imgs[k] = im; }
  return im.complete && im.naturalWidth ? im : null;
}
/** 틀 그림이 다 읽혔나 (아니면 옛 HUD로 그린다) */
export function pixelHudReady(): boolean {
  return (['slot', 'item', 'portrait', 'hp', 'gauge'] as Key[]).every((k) => img(k));
}

const INK = '#e6e4dc', DIM = '#5c6268', EDGE = '#07090b', HOLLOW = '#0f1216';

/* ───────── 글자 ───────── */
const textCache = new Map<string, HTMLCanvasElement>();
/** 도트 글자 그림: 이진화 + 1도트 테. size는 11의 배수에서 또렷하다 */
export function pixelText(s: string, color = INK, size = 11, edge: string | null = EDGE): HTMLCanvasElement {
  const key = `${s}|${color}|${size}|${edge}`;
  const hit = textCache.get(key);
  if (hit) return hit;
  const f = `700 ${size}px "${PIXEL_FONT}", monospace`;
  const cv = document.createElement('canvas');
  const g0 = cv.getContext('2d')!;
  g0.font = f;
  const tw = Math.ceil(g0.measureText(s).width);
  cv.width = Math.max(1, tw + 2); cv.height = size + 4;
  const g = cv.getContext('2d')!;
  g.font = f; g.textBaseline = 'top'; g.fillStyle = '#fff';
  g.fillText(s, 1, 1);
  const d = g.getImageData(0, 0, cv.width, cv.height), px = d.data;
  const [r, gg, b] = hex(color), [er, eg, eb] = edge ? hex(edge) : [0, 0, 0];
  const on = new Uint8Array(cv.width * cv.height);
  for (let i = 0; i < on.length; i++) on[i] = px[i * 4 + 3] > 110 ? 1 : 0;
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
    const i = y * cv.width + x, o = i * 4;
    if (on[i]) { px[o] = r; px[o + 1] = gg; px[o + 2] = b; px[o + 3] = 255; continue; }
    let near = false;
    if (edge) for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < cv.width && ny < cv.height && on[ny * cv.width + nx]) { near = true; break; }
    }
    if (near) { px[o] = er; px[o + 1] = eg; px[o + 2] = eb; px[o + 3] = 255; } else px[o + 3] = 0;
  }
  g.putImageData(d, 0, 0);
  // 글꼴이 아직 안 읽혔으면 다음에 다시 만든다
  if (document.fonts?.check?.(f) !== false) textCache.set(key, cv);
  return cv;
}
function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function put(c: CanvasRenderingContext2D, t: HTMLCanvasElement, x: number, y: number, align: 'left' | 'center' | 'right' = 'left') {
  const dx = align === 'center' ? Math.round(x - t.width / 2) : align === 'right' ? Math.round(x - t.width) : Math.round(x);
  c.drawImage(t, dx, Math.round(y));
}

/* ───────── 막대 채우기 (틀 그림의 홈 모양대로) ───────── */
function fillHollow(c: CanvasRenderingContext2D, k: 'hp' | 'gauge', x: number, y: number, r: number, color: (row: number, top: number, bottom: number) => string) {
  const a = HUD_ART[k], [ix0, iy0, ix1, iy1] = a.inner;
  const lim = ix0 + Math.round((ix1 - ix0) * Math.max(0, Math.min(1, r)));
  a.rows.forEach((runs, row) => {
    if (!runs.length) return;
    c.fillStyle = color(row, iy0, iy1 - 1);
    for (const [s, e] of runs as readonly (readonly number[])[]) {
      const ee = Math.min(e, lim);
      if (ee > s) c.fillRect(x + s, y + row, ee - s, 1);
    }
  });
}

/** 체력 색: 가득 = 초록, 반 = 노랑, 바닥 = 빨강 (10° 단위로 끊어 도트 색처럼) */
function hpHue(r: number) {
  return Math.round((120 * Math.max(0, Math.min(1, (r - 0.12) / 0.68))) / 10) * 10;
}

/* ───────── 초상화 칸 ───────── */
export interface PixelCard {
  name: string; face?: CanvasImageSource | null; hp: number; maxHp: number; trail: number; hurtT: number;
  gauge?: number; superKey?: string; armor?: number; t: number;
}
/** 왼쪽 위 주인공 칸 (판 없음). 돌려주는 값 = 칸 아래 끝 y */
export function drawPixelCard(c: CanvasRenderingContext2D, s: PixelCard, x: number, y: number): number {
  const P = HUD_ART.portrait, pim = img('portrait'), him = img('hp'), gim = img('gauge');
  if (!pim || !him || !gim) return y;
  c.save();
  c.imageSmoothingEnabled = false;
  x = Math.round(x); y = Math.round(y);
  // 얼굴: 틀 안쪽만 살짝 어둡게 (통짜 검은 상자 없이)
  const [fx0, fy0, fx1, fy1] = P.inner, fw = fx1 - fx0, fh = fy1 - fy0;
  c.fillStyle = 'rgba(12,15,19,0.6)';
  c.fillRect(x + fx0, y + fy0, fw, fh);
  if (s.face) c.drawImage(s.face, x + fx0, y + fy0, fw, fh);
  else put(c, pixelText(s.name.slice(0, 1) || '?', INK, 33), x + P.w / 2, y + P.h / 2 - 18, 'center');
  if (s.hurtT > 0) { c.fillStyle = `rgba(255,40,40,${Math.min(0.6, s.hurtT * 1.6)})`; c.fillRect(x + fx0, y + fy0, fw, fh); }
  c.drawImage(pim, x, y);
  // 이름 + 방어 표시
  const bx = x + P.w + 4;
  const nt = pixelText(s.name, INK, 22);
  put(c, nt, bx + 14, y + 6);
  if (s.armor) put(c, pixelText('◆'.repeat(s.armor), '#cfd3d6', 11), bx + 20 + nt.width, y + 14);
  // 체력 막대: 초록 → 노랑 → 빨강, 깎인 만큼 흰 띠가 늦게 따라온다
  const hy = y + 34, r = Math.max(0, s.hp) / s.maxHp, low = r < 0.25;
  c.drawImage(him, bx, hy);
  fillHollow(c, 'hp', bx, hy, s.trail / s.maxHp, () => '#d8d2c4');
  const hue = hpHue(r), blink = low && Math.sin(s.t * 10) > 0;
  fillHollow(c, 'hp', bx, hy, r, (row, top, bot) => (row === top ? `hsl(${hue},75%,${blink ? 80 : 68}%)` : row >= bot - 1 ? `hsl(${hue},70%,${blink ? 48 : 32}%)` : `hsl(${hue},68%,${blink ? 66 : 48}%)`));
  put(c, pixelText(`${Math.max(0, Math.ceil(s.hp))} / ${Math.ceil(s.maxHp)}`, INK, 11), bx + HUD_ART.hp.inner[2], y + 18, 'right');
  // 필살 게이지: 칸 다섯 개, 다 차면 숨쉬듯 빛나고 키를 띄운다
  let end = Math.max(y + P.h, hy + HUD_ART.hp.h + 14);
  if (s.gauge !== undefined) {
    // 글자 없이 게이지만 (사용자 2026-10-25)
    const gy = hy + HUD_ART.hp.h + 5, full = s.gauge >= 100;
    const pulse = full ? 0.5 + 0.5 * Math.sin(s.t * 7) : 0;
    const gx2 = bx + 16;
    c.drawImage(gim, gx2, gy);
    fillHollow(c, 'gauge', gx2, gy, s.gauge / 100, (row, top) => (full ? (row === top ? '#fff6d0' : `rgb(255,${205 + 30 * pulse},${90 + 60 * pulse})`) : row === top ? '#e8f4ff' : '#9fc6e0'));
    if (full && s.superKey) put(c, pixelText(s.superKey, '#ffe9a0', 11), gx2 + HUD_ART.gauge.w + 4, gy - 3);
    end = Math.max(end, gy + HUD_ART.gauge.h);
  }
  c.restore();
  return end;
}

/* ───────── 기술 칸 줄 ───────── */
export type SkillIcon = 'punch' | 'kick' | 'gun' | 'wave' | 'bolt' | 'star' | 'dash' | 'shield';
export interface PixelSlot { key: string; icon: SkillIcon; name: string; cd: number; cdText?: string; off?: boolean; active?: boolean; full?: boolean; bar?: number; hot?: boolean; badge?: string }

/** 12×12 단색 아이콘 (# = 칠함, o = 홈 색으로 파냄) */
const ICONS: Record<SkillIcon, string[]> = {
  punch: [
    '............',
    '..##.##.##..',
    '.##########.',
    '.#o##o##o##.',
    '.##########.',
    '###########.',
    '#oo########.',
    '###########.',
    '.##########.',
    '..########..',
    '...######...',
    '............',
  ],
  kick: [
    '............',
    '......###...',
    '......###...',
    '......###...',
    '......###...',
    '##....####..',
    '......######',
    '###...######',
    '......######',
    '##....######',
    '............',
    '............',
  ],
  gun: [
    '............',
    '............',
    '.##########.',
    '.###########',
    '.##########.',
    '.####o......',
    '.###oo#.....',
    '.###.##.....',
    '.###........',
    '####........',
    '###.........',
    '............',
  ],
  wave: [
    '............',
    '.#...#...#..',
    '..#...#...#.',
    '..##..##..##',
    '..##..##..##',
    '..##..##..##',
    '..##..##..##',
    '..##..##..##',
    '..#...#...#.',
    '.#...#...#..',
    '............',
    '............',
  ],
  bolt: [
    '.......####.',
    '......####..',
    '.....####...',
    '....####....',
    '...########.',
    '.......###..',
    '......###...',
    '.....###....',
    '....###.....',
    '...##.......',
    '..#.........',
    '............',
  ],
  star: [
    '.....##.....',
    '.....##.....',
    '....####....',
    '############',
    '.##########.',
    '..########..',
    '...######...',
    '...######...',
    '..###..###..',
    '..##....##..',
    '.##......##.',
    '............',
  ],
  dash: [
    '............',
    '......#.....',
    '......##....',
    '......###...',
    '##..#######.',
    '....########',
    '##..#######.',
    '......###...',
    '......##....',
    '......#.....',
    '............',
    '............',
  ],
  shield: [
    '............',
    '.##########.',
    '.#o#######o.',
    '.##########.',
    '.##########.',
    '.##########.',
    '..########..',
    '..########..',
    '...######...',
    '....####....',
    '.....##.....',
    '............',
  ],
};
function icon(c: CanvasRenderingContext2D, id: SkillIcon, cx: number, cy: number, u: number, col: string) {
  const rows = ICONS[id];
  const x0 = Math.round(cx - 6 * u), y0 = Math.round(cy - 6 * u);
  c.fillStyle = '#000';
  rows.forEach((r, j) => { for (let i = 0; i < 12; i++) if (r[i] === '#') c.fillRect(x0 + i * u + u, y0 + j * u + u, u, u); });
  rows.forEach((r, j) => { for (let i = 0; i < 12; i++) if (r[i] !== '.') { c.fillStyle = r[i] === 'o' ? HOLLOW : col; c.fillRect(x0 + i * u, y0 + j * u, u, u); } });
}

/** 기술 칸 한 줄 (왼쪽 아래). x,y = 왼쪽 위. 돌려주는 값 = 오른쪽 끝 x */
export function drawPixelHotbar(c: CanvasRenderingContext2D, slots: PixelSlot[], x: number, y: number, t: number): number {
  const S = HUD_ART.slot, sim = img('slot');
  if (!sim) return x;
  const gap = 4, [ix0, iy0, ix1, iy1] = S.inner;
  c.save();
  c.imageSmoothingEnabled = false;
  x = Math.round(x); y = Math.round(y);
  slots.forEach((sl, i) => {
    const sx = x + i * (S.w + gap), sy = y;
    const ready = sl.cd <= 0 && !sl.off;
    c.drawImage(sim, sx, sy);
    const iw = ix1 - ix0, ih = iy1 - iy0;
    // 쓰는 중이면 안쪽이 밝아진다
    if (sl.active) { c.fillStyle = '#3a4249'; c.fillRect(sx + ix0, sy + iy0, iw, ih); }
    icon(c, sl.icon, sx + ix0 + iw / 2, sy + iy0 + ih / 2 - (sl.bar !== undefined ? 1 : 0), 2, ready ? (sl.full ? '#ffe9a0' : INK) : DIM);
    // 쿨다운: 위에서 내려오는 어두운 막 + 남은 초
    if (sl.cd > 0) {
      c.fillStyle = 'rgba(4,6,8,0.7)';
      c.fillRect(sx + ix0, sy + iy0, iw, Math.round(ih * Math.min(1, sl.cd)));
      if (sl.cdText) put(c, pixelText(sl.cdText, INK, 11), sx + ix0 + iw / 2, sy + iy0 + ih / 2 - 7, 'center');
    }
    // 안쪽 아래 얇은 막대 (총열 열·충전·필살)
    if (sl.bar !== undefined) {
      const bw = iw - 4, v = Math.max(0, Math.min(1, sl.bar));
      c.fillStyle = '#000'; c.fillRect(sx + ix0 + 2, sy + iy1 - 4, bw, 2);
      c.fillStyle = sl.hot ? '#e8553a' : sl.full ? '#ffe9a0' : INK;
      c.fillRect(sx + ix0 + 2, sy + iy1 - 4, Math.round(bw * v), 2);
    }
    // 다 찬 필살: 안쪽 테가 숨쉰다
    if (sl.full && Math.sin(t * 7) > 0) { c.strokeStyle = '#ffe9a0'; c.lineWidth = 1; c.strokeRect(sx + ix0 + 0.5, sy + iy0 + 0.5, iw - 1, ih - 1); }
    // 키 (왼쪽 위 모서리)
    const kt = pixelText(sl.key, '#101317', 11, null);
    const kw = Math.max(11, kt.width + 2), kh = 13;
    c.fillStyle = EDGE; c.fillRect(sx + 1, sy + 1, kw + 2, kh + 2);
    c.fillStyle = ready ? INK : '#8a9096'; c.fillRect(sx + 2, sy + 2, kw, kh);
    put(c, kt, sx + 2 + kw / 2, sy + 2, 'center');
    // 단계·% (오른쪽 아래 안쪽)
    if (sl.badge) put(c, pixelText(sl.badge, sl.full ? '#ffe9a0' : INK, 11), sx + ix1 - 1, sy + iy1 - 17, 'right');
    // 이름 (칸 아래)
    // 이름: 22px (11px는 안 읽힌다, 사용자)
    put(c, pixelText(sl.name, ready ? INK : '#8a9096', 22), sx + S.w / 2, sy + S.h, 'center');
  });
  c.restore();
  return x + slots.length * (S.w + gap) - gap;
}
/** 기술 칸 줄 크기 (이름 줄 포함) */
export const hotbarSize = (n: number) => ({ w: n * (HUD_ART.slot.w + 4) - 4, h: HUD_ART.slot.h + 24 });

/** 아이템 칸 넷 (필살 게이지 아래, PixelLab 슬롯14). icon = 칸 안쪽에 아이템 그림을 그리는 함수. 돌려주는 값 = 아래 끝 y */
export function drawPixelItems(c: CanvasRenderingContext2D, items: { id?: string; label: string; count: number; cd?: number }[], x: number, y: number,
  keys: string[], flash: number[], icon: (it: { id?: string; label: string }, x: number, y: number, size: number) => void): number {
  const S = HUD_ART.item, im = img('item');
  if (!im) return y;
  const [ix0, iy0, ix1, iy1] = S.inner, iw = ix1 - ix0, ih = iy1 - iy0, gap = 4;
  c.save();
  c.imageSmoothingEnabled = false;
  x = Math.round(x); y = Math.round(y);
  for (let i = 0; i < 4; i++) {
    const it = items[i] ?? { label: '', count: 0 }, sx = x + i * (S.w + gap), dim = it.count <= 0;
    c.drawImage(im, sx, y);
    if ((flash[i] ?? 0) > 0) { c.fillStyle = `rgba(255,240,180,${flash[i]})`; c.fillRect(sx + ix0, y + iy0, iw, ih); }
    if (it.label || it.id) {
      c.save(); c.globalAlpha = dim ? 0.3 : 1;
      icon(it, sx + ix0 + 1, y + iy0 + 1, Math.min(iw, ih) - 2);
      c.restore();
      put(c, pixelText(`${it.count}`, dim ? '#6a7276' : INK, 11), sx + ix1 - 1, y + iy1 - 13, 'right');
    }
    if (it.cd && it.cd > 0) { c.fillStyle = 'rgba(4,6,8,0.6)'; c.fillRect(sx + ix0, y + iy0, iw, Math.round(ih * Math.min(1, it.cd))); }
    // 키 표시 (사용자 2026-10-25: 칸 위 숫자는 빼기로. keys가 비면 안 그린다)
    if (keys[i]) {
      const kt = pixelText(keys[i], '#101317', 11, null), kw = Math.max(11, kt.width + 2), kh = 13;
      c.fillStyle = EDGE; c.fillRect(sx + 1, y + 1, kw + 2, kh + 2);
      c.fillStyle = INK; c.fillRect(sx + 2, y + 2, kw, kh);
      put(c, kt, sx + 2 + kw / 2, y + 2, 'center');
    }
  }
  c.restore();
  return y + S.h;
}

/** 방어 게이지 (캐릭터 머리 위 작은 도트 막대): 막는 중이거나 회복 중일 때만 뜨고, 가득 차면 사라진다.
 * x,y = 막대 가운데 위 (캔버스 px), a = 불투명도, broken = 깨져서 회복 중 (빨갛게 깜빡) */
export function drawGuardBar(c: CanvasRenderingContext2D, x: number, y: number, v: number, broken: boolean, a: number, t: number) {
  if (a <= 0.01) return;
  const W = 56, H = 8;
  const x0 = Math.round(x - W / 2), y0 = Math.round(y);
  c.save();
  c.globalAlpha = Math.min(1, a);
  // 방패 표시 + 테
  const sh = ['#####', '#####', '#####', '.###.', '..#..'];
  const col = broken ? (Math.sin(t * 14) > 0 ? '#ff5a44' : '#7a2a22') : INK;
  c.fillStyle = EDGE;
  c.fillRect(x0 - 10, y0 - 1, 9, 9);
  sh.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') { c.fillStyle = col; c.fillRect(x0 - 8 + i, y0 + 1 + j, 1, 1); } });
  c.fillStyle = EDGE; c.fillRect(x0 - 1, y0 - 1, W + 2, H + 2);
  c.fillStyle = '#2e353c'; c.fillRect(x0, y0, W, H);
  c.fillStyle = '#151a1f'; c.fillRect(x0 + 1, y0 + 1, W - 2, H - 2);
  const fw = Math.round((W - 2) * Math.max(0, Math.min(1, v)));
  if (fw > 0) {
    c.fillStyle = broken ? '#c8483a' : v < 0.3 ? '#e8b04a' : '#cfe4f2';
    c.fillRect(x0 + 1, y0 + 1, fw, H - 2);
    c.fillStyle = broken ? '#ff8a76' : '#ffffff';
    c.fillRect(x0 + 1, y0 + 1, fw, 1);
  }
  // 깨진 뒤 다시 막을 수 있는 선 (40%)
  if (broken) { c.fillStyle = INK; c.fillRect(x0 + 1 + Math.round((W - 2) * 0.4), y0, 1, H); }
  c.restore();
}
