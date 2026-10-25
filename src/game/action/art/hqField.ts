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
  if (d.behind === 'see') {
    // 유리 너머: 같은 자리 그림을 조금 밝게 (문짝 틀만 비켜난 것처럼)
    c.drawImage(im, d.x0, d.y0, w, h, d.x0, d.y0, w, h);
    c.fillStyle = 'rgba(255,250,235,0.12)'; c.fillRect(d.x0, d.y0, w, h);
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
  switch (d.anim) {
    case 'slide2': {
      const s = d.seam ?? (d.x0 + d.x1) / 2, lw = s - d.x0, rw = d.x1 - s;
      leaf(d.x0, lw, d.x0 - lw * e, lw, 0, 1);
      leaf(s, rw, s + rw * e, rw, 0, -1);
      break;
    }
    case 'swing': {
      // 여닫이: 경첩 쪽으로 접히며(폭이 줄며) 어두워진다
      const vw = w * (1 - 0.86 * e);
      leaf(d.x0, w, d.hinge === 'L' ? d.x0 : d.x1 - vw, vw, 0.45 * e, d.hinge === 'L' ? 1 : -1);
      break;
    }
    case 'swing2': {
      const s = d.seam ?? (d.x0 + d.x1) / 2, lw = s - d.x0, rw = d.x1 - s;
      leaf(d.x0, lw, d.x0, lw * (1 - 0.86 * e), 0.45 * e, 1);
      leaf(s, rw, d.x1 - rw * (1 - 0.86 * e), rw * (1 - 0.86 * e), 0.45 * e, -1);
      break;
    }
    case 'shutter': {
      // 셔터: 위로 말려 올라간다
      c.drawImage(im, d.x0, d.y0, w, h, d.x0, d.y0 - h * e, w, h);
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
  // 지하는 바깥 빛이 없다: 밤에만 절전으로 조금 어둡게
  const sc = p.under ? 0.35 : 1;
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
      c.globalCompositeOperation = 'source-over';
      // 어두우면 바깥 건물 창에 불이 켜진다 (자리 고정, 몇 개는 천천히 깜빡)
      const lit = Math.max(0, (k.win[3] - 0.5) / 0.4);
      if (lit > 0) {
        for (const [wx0, wy0, wx1, wy1] of p.windows) {
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
    if (l.blink) { drawBlink(c, l, now); continue; }
    if (lampK <= 0.01) continue;
    if (l.kind === 'down') glow(c, l.x, l.y + 50, l.r ?? 150, 2.1, `rgba(255,210,140,${0.42 * lampK})`);
    else glow(c, l.x, l.y, l.r ?? 34, 1, hexA(l.color ?? '#ffd27a', 0.5 * lampK));
  }
  c.restore();
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
function drawBlink(c: CanvasRenderingContext2D, l: PaintedScene['lamps'][number], now: number) {
  const b = l.blink!;
  const ph = ((now / b.period + (b.phase ?? 0)) % 1 + 1) % 1;
  const on = b.pulse ? 0.5 - 0.5 * Math.cos(ph * Math.PI * 2) : ph < b.duty ? 1 : 0;
  const r = l.r ?? 30;
  if (on > 0.02) {
    glow(c, l.x, l.y, r, 1, hexA(l.color ?? '#ff3a2a', 0.75 * on));
    glow(c, l.x, l.y, r * 0.3, 1, `rgba(255,235,220,${0.6 * on})`);
  }
  if (on < 0.98) {
    // 꺼진 동안: 그림에 켜져 그려진 등을 어둡게
    c.globalCompositeOperation = 'multiply';
    const d = Math.round(255 - 150 * (1 - on));
    c.fillStyle = `rgb(${d},${Math.round(d * 0.8)},${Math.round(d * 0.8)})`;
    const s = Math.max(10, r * 0.4);
    c.beginPath(); c.ellipse(l.x, l.y, s, s * 0.8, 0, 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = 'lighter';
  }
}

/* ───────── 표찰·엘리베이터 앞 안내 (도트 글씨) ───────── */

type Labeled = { id: string; x: number; label?: string; kind: string };
const pxFont = (n: number) => `700 ${n}px "GoeiPixel", "Galmuri11", monospace`;
/** 그림에 이미 그려진 표지(화장실 그림 표지·계단 표지)가 있는 문은 표찰을 달지 않는다 */
const PAINTED_SIGN = new Set(['화장실', '계단', '현관']);

function plate(c: CanvasRenderingContext2D, cx: number, y: number, text: string, n = 22) {
  c.font = pxFont(n);
  const w = Math.ceil(c.measureText(text).width) + 20, h = n + 12;
  const x = Math.round(cx - w / 2), yy = Math.round(y);
  c.fillStyle = '#1b1f24'; c.fillRect(x - 2, yy - 2, w + 4, h + 4);
  c.fillStyle = '#c9c3b4'; c.fillRect(x, yy, w, h);
  c.fillStyle = '#2d333b'; c.fillRect(x + 2, yy + 2, w - 4, h - 4);
  c.fillStyle = '#efe9da'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, Math.round(cx), yy + Math.round(h / 2) + 1);
}

/** 지상 층 방문 위 표찰 (배경 다음, 사람 앞). 월드 좌표 */
export function drawHqSigns(c: CanvasRenderingContext2D, scene: string, doors: Labeled[]): void {
  const p = PAINTED[scene];
  if (!p || !images) return;
  c.save();
  for (const d of doors) {
    const pd = p.doors[d.id];
    if (!pd || !d.label || PAINTED_SIGN.has(d.label) || d.kind === 'elevator') continue;
    // 화면 위 목표 띠(약 y90까지)에 가리지 않게 문 윗부분에 단다
    plate(c, (pd.x0 + pd.x1) / 2, pd.y0 + 14, d.label);
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
