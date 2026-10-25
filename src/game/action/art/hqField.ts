// 관리국 층 배경 그림(확정 6장) 그리기: 배경 · 문 열림 · 오린 오브젝트(로비 데스크) · 시간대 조명 · 깜빡이는 등.
// 좌표 자료는 hq/painted.ts. 그림은 game-pack/hq-field (단독 시연판은 window.__GOEI_HQ_FIELD__).
// 문 열림은 배경에서 문짝 자리를 그대로 떠서 움직이고, 그 뒤는 코드로 칠한다(어두운 문 안·엘리베이터 칸·유리 너머).
import { PAINTED, type PaintedDoor, type PaintedScene } from '../hq/painted';

const FILES = ['lobby', 'f2', 'f3', 'b1', 'b2', 'b3', 'desk'];
let images: Record<string, HTMLImageElement> | null = null;
let revision = 0;
declare global { interface Window { __GOEI_HQ_FIELD__?: Record<string, string> } }

export function prepareHqField(urlOf?: (file: string) => Promise<string>): () => void {
  const own = ++revision;
  images = null;
  void Promise.all(FILES.map(async (key) => {
    const src = window.__GOEI_HQ_FIELD__?.[key] || (urlOf ? await urlOf(key + '.webp') : '');
    if (!src) throw new Error('HQ field art unavailable');
    const im = new Image(); im.src = src; await im.decode();
    return [key, im] as const;
  })).then((rows) => { if (revision === own) images = Object.fromEntries(rows); })
    .catch(() => { /* 그림이 없으면 기존 색 상자 장면 */ });
  const keys = (e: KeyboardEvent) => {
    // 시험용: T = 시간대 돌리기 (자동 → 새벽 → 낮 → 저녁 → 밤)
    const t = e.target as HTMLElement | null;
    if (e.code !== 'KeyT' || e.repeat || t?.closest?.('input, textarea, [contenteditable="true"]')) return;
    todIndex = (todIndex + 1) % TOD_CYCLE.length;
  };
  window.addEventListener('keydown', keys);
  return () => { window.removeEventListener('keydown', keys); if (revision === own) { revision++; images = null; } };
}

export const hasHqField = (scene: string) => !!images && !!PAINTED[scene];

/** 문 상태: open 0..1 (열린 정도), shake = 잠긴 문 덜컹 (px) */
export type DoorFx = (id: string) => { open: number; shake: number };

/** 배경과 문. 월드 좌표 (호출하는 쪽이 -camX 옮김) */
export function drawHqField(c: CanvasRenderingContext2D, scene: string, camX: number, fx: DoorFx): boolean {
  const p = PAINTED[scene];
  const im = images?.[p?.file ?? ''];
  if (!p || !im) return false;
  c.save();
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  const sx = Math.max(0, Math.floor(camX - 40)), sw = Math.min(p.w - sx, 1280 + 80);
  if (sw > 0) {
    c.drawImage(im, sx, 0, sw, 700, sx, 0, sw, 700);
    c.drawImage(im, sx, 696, sw, 4, sx, 700, sw, 24); // 화면 아래 20px: 맨 아래 바닥을 늘려 채움
  }
  for (const [id, d] of Object.entries(p.doors)) {
    const s = fx(id);
    if (s.open <= 0 && !s.shake) continue;
    if (d.x1 < camX - 40 || d.x0 > camX + 1320) continue;
    drawDoor(c, im, d, s.open, s.shake);
  }
  c.restore();
  return true;
}

function clipDoor(c: CanvasRenderingContext2D, d: PaintedDoor) {
  c.beginPath();
  if (d.quad) { c.moveTo(d.quad[0][0], d.quad[0][1]); for (const [x, y] of d.quad.slice(1)) c.lineTo(x, y); c.closePath(); }
  else c.rect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
  c.clip();
}

function drawBehind(c: CanvasRenderingContext2D, im: HTMLImageElement, d: PaintedDoor) {
  const w = d.x1 - d.x0, h = d.y1 - d.y0;
  if (d.behind === 'see' || d.behind === 'lit') {
    // 유리 너머: 문틀이 겹쳐 보이지 않게 밝은 실내 빛으로 덮는다 (유리문은 살짝만 열려 틈만 보인다)
    c.drawImage(im, d.x0, d.y0, w, h, d.x0, d.y0, w, h);
    const g = c.createLinearGradient(0, d.y0, 0, d.y1);
    g.addColorStop(0, 'rgba(238,242,244,0.86)'); g.addColorStop(1, 'rgba(196,204,208,0.86)');
    c.fillStyle = g; c.fillRect(d.x0, d.y0, w, h);
    return;
  }
  if (d.behind === 'car') {
    // 엘리베이터 칸: 밝은 금속 벽, 천장 조명, 바닥
    const g = c.createLinearGradient(0, d.y0, 0, d.y1);
    g.addColorStop(0, '#f4ecd8'); g.addColorStop(0.12, '#cfc6b4'); g.addColorStop(0.8, '#9a9384'); g.addColorStop(1, '#5e594f');
    c.fillStyle = g; c.fillRect(d.x0, d.y0, w, h);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 1; i < 3; i++) c.fillRect(d.x0 + (w * i) / 3, d.y0 + h * 0.08, 2, h * 0.84);
    c.fillStyle = '#4a463f'; c.fillRect(d.x0, d.y1 - h * 0.1, w, h * 0.1);
    return;
  }
  // 문 안: 어두운 방, 위쪽만 희미한 빛
  const g = c.createLinearGradient(0, d.y0, 0, d.y1);
  g.addColorStop(0, '#2a3036'); g.addColorStop(0.5, '#15191d'); g.addColorStop(1, '#0c0e10');
  c.fillStyle = g; c.fillRect(d.x0, d.y0, w, h);
}

function drawDoor(c: CanvasRenderingContext2D, im: HTMLImageElement, d: PaintedDoor, open: number, shake: number) {
  const w = d.x1 - d.x0, h = d.y1 - d.y0;
  c.save();
  clipDoor(c, d);
  if (d.anim === 'glow') {
    // 문짝은 움직이지 않고 바깥 빛이 유리에 번진다
    const e = open * open * (3 - 2 * open);
    if (shake) { c.fillStyle = '#0c0e10'; c.fillRect(d.x0, d.y0, w, h); c.drawImage(im, d.x0, d.y0, w, h, d.x0 + shake, d.y0, w, h); }
    if (e > 0) { c.fillStyle = `rgba(255,250,232,${0.4 * e})`; c.fillRect(d.x0, d.y0, w, h); }
    c.restore();
    return;
  }
  if (shake && open <= 0) {
    // 잠긴 문 덜컹: 문짝이 몇 px 흔들린다
    c.fillStyle = '#0c0e10'; c.fillRect(d.x0, d.y0, w, h);
    c.drawImage(im, d.x0, d.y0, w, h, d.x0 + shake, d.y0, w, h);
    c.restore();
    return;
  }
  drawBehind(c, im, d);
  /** edge = 움직이는 쪽 끝(-1 왼쪽, 1 오른쪽): 문짝 두께 선을 그어 열리는 게 보이게 */
  const leaf = (sx: number, sw: number, dx: number, dw: number, shade: number, edge: -1 | 0 | 1 = 0) => {
    if (dw < 1) return;
    c.drawImage(im, sx, d.y0, sw, h, dx, d.y0, dw, h);
    if (shade > 0) { c.fillStyle = `rgba(10,12,16,${shade})`; c.fillRect(dx, d.y0, dw, h); }
    if (edge && e > 0.02) {
      const ex = edge > 0 ? dx + dw : dx;
      const t = Math.max(2, Math.round(7 * e));
      c.fillStyle = 'rgba(20,22,26,0.9)'; c.fillRect(edge > 0 ? ex : ex - t, d.y0, t, h);
      c.fillStyle = 'rgba(220,226,232,0.55)'; c.fillRect(edge > 0 ? ex + t - 1 : ex - t, d.y0, 1, h);
    }
  };
  const e = open * open * (3 - 2 * open); // 부드럽게
  // 엘리베이터 말고는 모두 아주 살짝만 연다 (여닫이 11°, 미닫이 7%, 셔터 10%)
  // (사용자 2026-10-25: 투명 유리는 뒤가 들통나고, 다른 문도 살짝 열리는 느낌만)
  const glass = d.behind !== 'car';
  /** 여닫이 한 짝: 경첩(hx)을 축으로 안쪽으로 돈다. 폭은 cos로 줄고, 먼 끝은 원근으로 짧아지며 어두워진다.
   *  dir = 경첩에서 문짝이 뻗는 쪽 (1 오른쪽, -1 왼쪽) */
  const swingLeaf = (sx: number, sw: number, hx: number, dir: 1 | -1, maxDeg: number) => {
    const th = (e * maxDeg * Math.PI) / 180;
    const vw = sw * Math.cos(th), shrink = 0.2 * Math.sin(th), dark = 0.55 * Math.sin(th);
    const N = Math.max(1, Math.ceil(vw / 2));
    for (let i = 0; i < N; i++) {
      const u0 = i / N, u1 = (i + 1) / N, hf = 1 - shrink * (u0 + u1) / 2, dh = h * hf, dy = d.y0 + (h - dh) / 2;
      const srcX = dir > 0 ? sx + u0 * sw : sx + sw - u1 * sw;
      const dstX = dir > 0 ? hx + u0 * vw : hx - u1 * vw;
      c.drawImage(im, srcX, d.y0, sw / N, h, dstX, dy, vw / N + 0.6, dh);
      if (dark > 0.01) { c.fillStyle = `rgba(8,10,14,${dark * (0.6 + 0.4 * (u0 + u1) / 2)})`; c.fillRect(dstX, dy, vw / N + 0.6, dh); }
    }
    // 문짝 두께 (먼 끝)
    if (e > 0.02) {
      const fx = hx + dir * vw, dh = h * (1 - shrink), dy = d.y0 + (h - dh) / 2, t = Math.max(2, Math.round(8 * Math.sin(th)));
      c.fillStyle = 'rgba(24,26,30,0.92)'; c.fillRect(dir > 0 ? fx : fx - t, dy, t, dh);
    }
  };
  switch (d.anim) {
    case 'slide2': {
      const s = d.seam ?? (d.x0 + d.x1) / 2, lw = s - d.x0, rw = d.x1 - s, k = glass ? 0.07 : 1;
      leaf(d.x0, lw, d.x0 - lw * e * k, lw, 0, 1);
      leaf(s, rw, s + rw * e * k, rw, 0, -1);
      break;
    }
    case 'swing': {
      if (d.hinge === 'L') swingLeaf(d.x0, w, d.x0, 1, glass ? 11 : 78);
      else swingLeaf(d.x0, w, d.x1, -1, glass ? 11 : 78);
      break;
    }
    case 'swing2': {
      const s = d.seam ?? (d.x0 + d.x1) / 2, lw = s - d.x0, rw = d.x1 - s;
      swingLeaf(d.x0, lw, d.x0, 1, glass ? 11 : 78);
      swingLeaf(s, rw, d.x1, -1, glass ? 11 : 78);
      break;
    }
    case 'shutter': {
      // 셔터: 위로 말려 올라간다
      c.drawImage(im, d.x0, d.y0, w, h, d.x0, d.y0 - h * e * (glass ? 0.1 : 1), w, h);
      break;
    }
    default:
      leaf(d.x0, w, d.x0, w, 0);
  }
  c.restore();
}

/** 오린 오브젝트 (깊이 순서 층에서 부른다) */
export function drawHqFieldObject(c: CanvasRenderingContext2D, scene: string, id: string): void {
  const o = PAINTED[scene]?.objects.find((q) => q.id === id);
  const im = o && images?.[o.file];
  if (!o || !im) return;
  c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(im, o.x, o.y, o.w, o.h);
  c.restore();
}

/* ───────── 시간대 조명 ───────── */

type Key = { h: number; tint: [number, number, number, number]; win: [number, number, number, number]; lamp: number };
// tint = 곱하기 색과 세기, win = 창 바깥 덮는 색, lamp = 등 빛 세기
const NIGHT: Key = { h: 0, tint: [40, 52, 110, 0.62], win: [10, 14, 40, 0.92], lamp: 1 };
const KEYS: Key[] = [
  NIGHT,
  { ...NIGHT, h: 4.5 },
  { h: 6, tint: [120, 112, 190, 0.45], win: [120, 100, 175, 0.7], lamp: 0.75 }, // 새벽
  { h: 7.5, tint: [255, 255, 255, 0], win: [0, 0, 0, 0], lamp: 0 },
  { h: 16.5, tint: [255, 255, 255, 0], win: [0, 0, 0, 0], lamp: 0 },
  { h: 18, tint: [255, 150, 95, 0.3], win: [255, 115, 55, 0.5], lamp: 0.45 }, // 저녁 노을
  { h: 19.5, tint: [62, 62, 120, 0.55], win: [24, 22, 56, 0.86], lamp: 0.95 },
  { ...NIGHT, h: 24 },
];
const TOD_CYCLE: (number | null)[] = [null, 5.8, 12, 18, 23];
let todIndex = 0;
const TOD_NAME = (h: number) => (h >= 4.5 && h < 7.5 ? '새벽' : h >= 7.5 && h < 16.5 ? '낮' : h >= 16.5 && h < 19.5 ? '저녁' : '밤');

function hourNow(clockHour: number | null): number {
  const forced = TOD_CYCLE[todIndex];
  if (forced !== null) return forced;
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('hour') : null;
  if (q !== null && q !== '' && Number.isFinite(Number(q))) return ((Number(q) % 24) + 24) % 24;
  if (clockHour !== null) return clockHour;
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}
function keyAt(h: number): Key {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (h >= a.h && h <= b.h) {
      const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
      const m = (x: number, y: number) => x + (y - x) * t;
      return { h, tint: a.tint.map((v, k) => m(v, b.tint[k])) as Key['tint'], win: a.win.map((v, k) => m(v, b.win[k])) as Key['win'], lamp: m(a.lamp, b.lamp) };
    }
  }
  return NIGHT;
}
/** 지금 시간대 이름 (시험 화면 표시용) */
export const hqFieldTimeName = (clockHour: number | null) => TOD_NAME(hourNow(clockHour));

/** 사람·집기까지 그린 뒤 위에 덮는다. 월드 좌표 */
export function drawHqFieldLight(c: CanvasRenderingContext2D, scene: string, camX: number, clockHour: number | null, now: number): void {
  const p = PAINTED[scene];
  if (!p || !images) return;
  const k = keyAt(hourNow(clockHour));
  const x0 = camX - 40, W = 1280 + 80, H = 720;
  // 실내는 조명이 있어 바깥보다 덜 어둡다 (사용자 2026-10-25): 실내는 약하게 곱하고, 바깥 풍경(outside)·유리문 너머만 세게
  // 지하는 바깥 빛이 없다: 밤에만 절전으로 조금 어둡게
  const sc = p.under ? 0.35 : 0.5;
  c.save();
  const a = k.tint[3] * sc;
  if (a > 0.005) {
    const mix = (v: number) => Math.round(255 + (v - 255) * a);
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = `rgb(${mix(k.tint[0])},${mix(k.tint[1])},${mix(k.tint[2])})`;
    c.fillRect(x0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
    if (!p.under && k.win[3] > 0.005) {
      // 창 바깥: 한 번 더 곱해 하늘색을 바꾼다 (틀·건물 윤곽은 남는다)
      const wm = (v: number) => Math.round(255 + (v - 255) * k.win[3]);
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = `rgb(${wm(k.win[0])},${wm(k.win[1])},${wm(k.win[2])})`;
      for (const [wx0, wy0, wx1, wy1] of p.windows) c.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
      // 바깥 풍경: 실내를 덜 어둡게 한 만큼 더해서 곱한다 (하늘·나무·먼 건물이 밤빛으로)
      const ow = Math.min(0.97, k.win[3] + k.tint[3] * 0.5);
      const om = (v: number) => Math.round(255 + (v - 255) * ow);
      c.fillStyle = `rgb(${om(k.win[0])},${om(k.win[1])},${om(k.win[2])})`;
      (p.outside ?? []).forEach((poly, i) => {
        const m = outsideMask(scene, i, poly);
        if (!m) return;
        // 하늘·먼 건물 픽셀만 (밝고 차가운 색) 골라 밤색을 곱한다: 사각 상자처럼 보이지 않게
        const t = tinted(m, `rgb(${om(k.win[0])},${om(k.win[1])},${om(k.win[2])})`);
        c.drawImage(t, m.x, m.y);
      });
      // 유리문 너머 사무실: 불은 켜져 있지만 복도보다 어둡게
      const gm = (v: number) => Math.round(255 + (v - 255) * k.win[3] * 0.4);
      c.fillStyle = `rgb(${gm(k.win[0])},${gm(k.win[1])},${gm(k.win[2])})`;
      for (const d of Object.values(p.doors)) if (d.behind === 'see' && d.anim !== 'glow') c.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
      c.globalCompositeOperation = 'source-over';
      // 어두우면 바깥 건물 창에 불이 켜진다 (자리 고정, 몇 개는 천천히 깜빡)
      const lit = Math.max(0, (k.win[3] - 0.5) / 0.4);
      if (lit > 0) {
        const boxes: [number, number, number, number][] = [...p.windows, ...(p.outside ?? []).map((q) => [Math.min(...q.map((v) => v[0])), Math.min(...q.map((v) => v[1])), Math.max(...q.map((v) => v[0])), Math.min(...q.map((v) => v[1])) + (Math.max(...q.map((v) => v[1])) - Math.min(...q.map((v) => v[1]))) * 0.55] as [number, number, number, number])]; // 바깥은 위쪽(먼 건물)에만
        for (const [wx0, wy0, wx1, wy1] of boxes) {
          for (let i = 0; i < (wx1 - wx0) / 9; i++) {
            const r = Math.sin(i * 127.1 + wx0 * 3.7) * 43758.5453, f = r - Math.floor(r);
            if (f > 0.42) continue;
            const x = wx0 + Math.floor(f * 997) % (wx1 - wx0 - 4), y = wy0 + 8 + Math.floor(f * 7919) % Math.max(1, wy1 - wy0 - 16);
            const on = f < 0.05 ? 0.5 + 0.5 * Math.sin(now / 1700 + i) : 1;
            c.fillStyle = `rgba(255,${200 + Math.floor(f * 100)},120,${0.75 * lit * on})`;
            c.fillRect(x, y, 3, 3);
          }
        }
      }
    }
  }
  // 등 빛: 어두울수록 또렷하게 (낮에도 깜빡이는 등은 늘)
  c.globalCompositeOperation = 'lighter';
  const lampK = Math.max(k.lamp * (p.under ? 0.5 : 1), 0);
  for (const l of p.lamps) {
    if (l.x < camX - 200 || l.x > camX + 1480) continue;
    if (l.blink) { drawBlink(c, l, now, images?.[p.file]); continue; }
    if (lampK <= 0.01) continue;
    if (l.kind === 'down') glow(c, l.x, l.y + 50, l.r ?? 150, 2.1, `rgba(255,210,140,${0.42 * lampK})`);
    else glow(c, l.x, l.y, l.r ?? 34, 1, hexA(l.color ?? '#ffd27a', 0.5 * lampK));
  }
  c.restore();
}

/** 바깥 풍경 가림판: 다각형 안에서 밝고 차가운(하늘·건물·먼 나무) 픽셀만 불투명. 틀·실내 물건(어둡거나 따뜻한 색)은 거의 그대로 */
const maskCache = new Map<string, { cv: HTMLCanvasElement; x: number; y: number } | null>();
function outsideMask(scene: string, i: number, poly: [number, number][]) {
  const key = `${scene}:${i}`;
  if (maskCache.has(key)) return maskCache.get(key)!;
  const p = PAINTED[scene], im = images?.[p?.file ?? ''];
  if (!im) return null;
  const x = Math.min(...poly.map((v) => v[0])), y = Math.min(...poly.map((v) => v[1]));
  const w = Math.max(...poly.map((v) => v[0])) - x, h = Math.max(...poly.map((v) => v[1])) - y;
  let out: { cv: HTMLCanvasElement; x: number; y: number } | null = null;
  try {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d')!;
    g.beginPath(); poly.forEach(([px, py], j) => (j ? g.lineTo(px - x, py - y) : g.moveTo(px - x, py - y))); g.closePath(); g.clip();
    g.drawImage(im, x, y, w, h, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h), px = d.data;
    const ramp = (v: number, a: number, b: number) => Math.max(0, Math.min(1, (v - a) / (b - a)));
    for (let j = 0; j < px.length; j += 4) {
      const r = px[j], gg = px[j + 1], b = px[j + 2], lum = 0.3 * r + 0.59 * gg + 0.11 * b;
      // 밝을수록, 따뜻하지 않을수록(빨강이 파랑보다 많이 크지 않을수록) 바깥으로 본다
      const v = ramp(lum, 70, 150) * (1 - ramp(r - b, 18, 45));
      px[j] = px[j + 1] = px[j + 2] = 255; px[j + 3] = Math.round(255 * v * (px[j + 3] / 255));
    }
    g.putImageData(d, 0, 0);
    out = { cv, x, y };
  } catch { out = null; }
  maskCache.set(key, out);
  return out;
}
/** 가림판 모양대로 색칠한 판 (곱하기로 그린다). 색이 바뀔 때만 다시 */
const tintCache = new WeakMap<HTMLCanvasElement, { col: string; cv: HTMLCanvasElement }>();
function tinted(m: { cv: HTMLCanvasElement }, col: string): HTMLCanvasElement {
  const hit = tintCache.get(m.cv);
  if (hit && hit.col === col) return hit.cv;
  const cv = hit?.cv ?? document.createElement('canvas');
  cv.width = m.cv.width; cv.height = m.cv.height;
  const g = cv.getContext('2d')!;
  g.clearRect(0, 0, cv.width, cv.height);
  // 흰 바탕(곱하면 그대로) 위에 가림판 모양으로 밤색
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  const t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height;
  const tg = t.getContext('2d')!;
  tg.drawImage(m.cv, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = col; tg.fillRect(0, 0, t.width, t.height);
  g.drawImage(t, 0, 0);
  tintCache.set(m.cv, { col, cv });
  return cv;
}

function glow(c: CanvasRenderingContext2D, x: number, y: number, r: number, sy: number, col: string) {
  c.save();
  c.translate(x, y); c.scale(1, sy);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(-r, -r, r * 2, r * 2);
  c.restore();
}
function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
/** 깜빡이는 등의 「꺼진 그림」: 그림 속 붉게 켜진 픽셀만 골라 어두운 붉은색으로 바꾼 작은 판 (둘레는 건드리지 않는다) */
const offCache = new Map<string, { cv: HTMLCanvasElement; x: number; y: number } | null>();
function lampOff(im: HTMLImageElement, l: PaintedScene['lamps'][number]) {
  const key = `${im.src.length}:${l.x}:${l.y}`;
  if (offCache.has(key)) return offCache.get(key)!;
  const R = Math.max(10, Math.round((l.r ?? 30) * 0.45));
  const x = l.x - R, y = l.y - R, w = R * 2, h = R * 2;
  let out: { cv: HTMLCanvasElement; x: number; y: number } | null = null;
  try {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d')!;
    g.drawImage(im, x, y, w, h, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h), px = d.data;
    let n = 0;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], gg = px[i + 1], b = px[i + 2];
      // 붉게 켜진 픽셀(빨강이 강하고 초록·파랑이 낮음, 또는 흰 심)
      const lit = (r > 150 && r > gg * 1.5 && r > b * 1.5) || (r > 235 && gg > 190 && b > 170 && r - b < 70);
      if (lit) { const k = 0.32; px[i] = Math.round(r * k + 30); px[i + 1] = Math.round(gg * k * 0.5 + 8); px[i + 2] = Math.round(b * k * 0.5 + 8); n++; }
      else px[i + 3] = 0;
    }
    g.putImageData(d, 0, 0);
    out = n ? { cv, x, y } : null;
  } catch { out = null; }
  offCache.set(key, out);
  return out;
}
function drawBlink(c: CanvasRenderingContext2D, l: PaintedScene['lamps'][number], now: number, im?: HTMLImageElement) {
  const b = l.blink!;
  const ph = ((now / b.period + (b.phase ?? 0)) % 1 + 1) % 1;
  const on = b.pulse ? 0.5 - 0.5 * Math.cos(ph * Math.PI * 2) : ph < b.duty ? 1 : 0;
  const r = (l.r ?? 30) * 0.7;
  if (on < 0.98 && im) {
    // 꺼진 동안: 켜진 픽셀만 어두운 붉은색으로
    const o = lampOff(im, l);
    if (o) { c.save(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1 - on; c.drawImage(o.cv, o.x, o.y); c.restore(); }
  }
  if (on > 0.02) glow(c, l.x, l.y, r, 1, hexA(l.color ?? '#ff3a2a', 0.45 * on));
}

/* ───────── 표찰·엘리베이터 앞 안내 (도트 글씨) ───────── */

type Labeled = { id: string; x: number; label?: string; kind: string };
const pxFont = (n: number) => `700 ${n}px "GoeiPixel", "Galmuri11", monospace`;
/** 그림에 이미 그려진 표지(화장실 그림 표지·계단 표지)가 있는 문은 표찰을 달지 않는다 */
const PAINTED_SIGN = new Set(['화장실', '계단', '현관']);

/** 벽걸이 표찰: 어두운 아크릴 판 + 윗면 빛 한 줄 + 벽에 지는 그림자, 글씨는 도트 글꼴 (사용자 2026-10-25: 촌스럽지 않게) */
function plate(c: CanvasRenderingContext2D, cx: number, bottom: number, text: string, n = 22) {
  c.font = pxFont(n);
  const w = Math.ceil(c.measureText(text).width) + 28, h = n + 10;
  const x = Math.round(cx - w / 2), y = Math.round(bottom - h);
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(x + 3, y + 3, w, h); // 벽 그림자
  c.fillStyle = '#23272c'; c.fillRect(x, y, w, h);
  c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(x, y, w, 2); // 윗면 빛
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x, y + h - 2, w, 2);
  c.fillStyle = '#7c848c'; c.fillRect(x + 6, y + h / 2 - 1, 2, 2); c.fillRect(x + w - 8, y + h / 2 - 1, 2, 2); // 고정 나사
  c.fillStyle = '#ece6d6'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, Math.round(cx), y + Math.round(h / 2) + 1);
}

/** 지상 층 방문 위 표찰 (배경 다음, 사람 앞). 월드 좌표 */
export function drawHqSigns(c: CanvasRenderingContext2D, scene: string, doors: Labeled[]): void {
  const p = PAINTED[scene];
  if (!p || !images) return;
  c.save();
  for (const d of doors) {
    const pd = p.doors[d.id];
    if (!pd || !d.label || PAINTED_SIGN.has(d.label) || d.kind === 'elevator') continue;
    // 문틀(문짝 바깥 테) 위 벽에 단다
    plate(c, (pd.x0 + pd.x1) / 2, pd.y0 - 18, d.label);
  }
  c.restore();
}

/** 엘리베이터 앞에 서면 양쪽 방향 안내 (← 이쪽 · 이쪽 →). near 0..1 = 나타난 정도 */
export function drawHqGuide(c: CanvasRenderingContext2D, scene: string, doors: Labeled[], px: number, now: number): void {
  const p = PAINTED[scene];
  const elev = doors.find((d) => d.kind === 'elevator');
  if (!p || !images || !elev) return;
  const dist = Math.abs(px - elev.x);
  const near = Math.max(0, Math.min(1, (300 - dist) / 120));
  if (near <= 0) return;
  const named = doors.filter((d) => d.label && d.kind !== 'elevator');
  const west = named.filter((d) => d.x < elev.x).sort((a, b) => b.x - a.x).map((d) => d.label!);
  const east = named.filter((d) => d.x > elev.x).sort((a, b) => a.x - b.x).map((d) => d.label!);
  // 엘리베이터 앞 바닥 위 (벽선 바로 아래)
  const y = 446;
  const bob = Math.round(Math.sin(now / 260) * 2);
  c.save();
  c.globalAlpha = near;
  c.font = pxFont(22);
  const U = 3; // 화살표 도트 한 칸
  const arrow = (tip: number, yy: number, dir: -1 | 1) => {
    // 도트 화살표: 계단 모양 머리 + 몸통 (tip = 뾰족한 끝 x)
    c.fillStyle = '#ffd36a';
    for (let i = 0; i < 5; i++) c.fillRect(tip - dir * i * U - (dir > 0 ? U : 0), yy - i * U, U, (i * 2 + 1) * U);
    c.fillRect(dir < 0 ? tip + 4 * U : tip - 10 * U, yy - U, 6 * U, 3 * U);
  };
  const row = (items: string[], dir: -1 | 1) => {
    if (!items.length) return;
    const text = items.join(' · ');
    const tw = Math.ceil(c.measureText(text).width), w = tw + 70, h = 40;
    const cx = elev.x + dir * (w / 2 + 70) + dir * bob;
    const x = Math.round(cx - w / 2);
    c.fillStyle = 'rgba(12,14,18,0.86)'; c.fillRect(x - 3, y - 3, w + 6, h + 6);
    c.fillStyle = '#ffd36a'; c.fillRect(x, y, w, 3); c.fillRect(x, y + h - 3, w, 3);
    c.fillStyle = '#f2ecdc'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, Math.round(cx - dir * 22), y + h / 2 + 1);
    arrow(dir < 0 ? x + 10 : x + w - 10, y + h / 2, dir);
  };
  row(west, -1);
  row(east, 1);
  c.restore();
}

/* ───────── 출동 안내 화살표 (B3 승합차 위) ───────── */

/** 도트 화살표 (아래를 가리킴, 한 칸 U px). 테두리 상자 없이 그림자와 함께 떠 있다 */
function pixelArrow(c: CanvasRenderingContext2D, x: number, y: number, U: number, rot: number) {
  // 7칸 폭 화살표: 몸통 3칸 × 4줄 + 머리 7·5·3·1칸
  const rows: [number, number][] = [[-1, 3], [-1, 3], [-1, 3], [-1, 3], [-3, 7], [-2, 5], [-1, 3], [0, 1]];
  const draw = (col: string, dx: number, dy: number) => {
    c.fillStyle = col;
    rows.forEach(([x0, w], i) => c.fillRect(dx + x0 * U, dy + i * U, w * U, U));
  };
  c.save();
  c.translate(Math.round(x), Math.round(y));
  c.rotate(rot);
  const ox = 0, oy = -rows.length * U; // 끝(뾰족한 곳)이 (x, y)
  draw('rgba(0,0,0,0.35)', ox + U, oy + U); // 그림자
  draw('#c98a1c', ox, oy); // 어두운 바탕 = 외곽
  c.fillStyle = '#ffd25a';
  rows.forEach(([x0, w], i) => { if (w > 1) c.fillRect(ox + (x0 + 0.0) * U + U * 0.0, oy + i * U, (w - 1) * U, U); });
  c.fillStyle = '#fff3c4';
  c.fillRect(ox - U, oy, U, U * 3); // 밝은 면
  c.restore();
}

/** 출동 준비가 됐을 때: 승합차 위에 떠 있는 화살표. 차가 화면 왼쪽 밖이면 화면 왼쪽 끝 허공에 떠서 왼쪽을 가리킨다 */
export function drawDepartArrow(c: CanvasRenderingContext2D, camX: number, now: number): void {
  const VAN = { x: 370, y: 128 };
  const left = camX + 46;
  const pinned = VAN.x < left;
  const bob = Math.sin(now / 280) * 5;
  const glow = 0.5 + 0.5 * Math.sin(now / 280);
  const x = pinned ? left : VAN.x, y = VAN.y + bob;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y - 20, 0, x, y - 20, 46);
  g.addColorStop(0, `rgba(255,200,80,${0.25 + 0.15 * glow})`); g.addColorStop(1, 'rgba(255,200,80,0)');
  c.fillStyle = g; c.fillRect(x - 46, y - 66, 92, 92);
  c.restore();
  pixelArrow(c, x, y, 6, pinned ? Math.PI / 2 : 0);
}

/* ───────── 엘리베이터 호출 단추: 층을 고르면 초록 ───────── */
const greenCache = new Map<string, { cv: HTMLCanvasElement; x: number; y: number } | null>();
export function drawCallLit(c: CanvasRenderingContext2D, scene: string, now: number): void {
  const p = PAINTED[scene], im = images?.[p?.file ?? ''];
  if (!p?.call || !im) return;
  const [cx, cy] = p.call, key = scene;
  if (!greenCache.has(key)) {
    const R = 10, x = cx - R, y = cy - R, w = R * 2, h = R * 2;
    let out: { cv: HTMLCanvasElement; x: number; y: number } | null = null;
    try {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d')!;
      g.drawImage(im, x, y, w, h, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h), px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], gg = px[i + 1], b = px[i + 2];
        // 붉게·주황으로 켜진 픽셀만 같은 밝기의 초록으로
        if (r > 170 && r > b * 1.4 && r > gg + 25) { const v = (r + gg) / 2; px[i] = Math.round(v * 0.35); px[i + 1] = Math.min(255, Math.round(v * 1.05 + 20)); px[i + 2] = Math.round(v * 0.45); }
        else px[i + 3] = 0;
      }
      g.putImageData(d, 0, 0);
      out = { cv, x, y };
    } catch { out = null; }
    greenCache.set(key, out);
  }
  const o = greenCache.get(key);
  c.save();
  c.imageSmoothingEnabled = false;
  if (o) c.drawImage(o.cv, o.x, o.y);
  c.globalCompositeOperation = 'lighter';
  glow(c, cx, cy, 16, 1, `rgba(90,255,130,${0.35 + 0.1 * Math.sin(now / 90)})`);
  c.restore();
}
