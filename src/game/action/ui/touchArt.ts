// 모바일 터치 버튼 그리기 (사용자 2026-10-29: 흔한 모바일 액션 게임 버튼처럼 — 두툼한 금속 테두리, 유리 같은 어두운 안쪽, 윗면 반사광, 그림자,
// 큰 공격 버튼은 장식 테두리). 그림 파일을 줄여 쓰지 않고 기기 픽셀(devicePixelRatio) 해상도로 코드가 그린다. 아이콘만 PixelLab 시트에서
// 정수 배로 꺼내 얹는다(도트가 뭉개지지 않게). 같은 모양·크기는 한 번만 그려 캐시한다.
import { BTN_CELL, BTN_CELLS, BTN_INNER, BTN_SHEET } from './mobileButtons.gen';

export type FrameKind = 'main' | 'skill' | 'guard' | 'ult' | 'auto' | 'menu' | 'plain';

export interface ButtonArt {
  /** CSS 픽셀 지름 */
  size: number;
  kind: FrameKind;
  /** 시트 칸 (아이콘) */
  cell?: number | null;
  /** 글자 (아이콘 없을 때) */
  text?: string;
  /** 켜짐(자동전투) */
  on?: boolean;
}

const dpr = () => (typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? Math.min(4, devicePixelRatio) : 1);

/** 테두리 색: 종류마다 */
const RING: Record<FrameKind, { hi: string; mid: string; lo: string; edge: string }> = {
  main: { hi: '#ffe8a3', mid: '#d9a63c', lo: '#7a4c12', edge: '#3a230a' },
  ult: { hi: '#ffe8a3', mid: '#d9a63c', lo: '#7a4c12', edge: '#3a230a' },
  skill: { hi: '#e8edf2', mid: '#9aa5b1', lo: '#4a535c', edge: '#1b2026' },
  guard: { hi: '#dfe9ff', mid: '#8fa6c8', lo: '#3f5473', edge: '#17202e' },
  auto: { hi: '#c9fff5', mid: '#5ee0c8', lo: '#1f6e60', edge: '#0f2f2a' },
  menu: { hi: '#e8edf2', mid: '#9aa5b1', lo: '#4a535c', edge: '#1b2026' },
  plain: { hi: '#e8edf2', mid: '#9aa5b1', lo: '#4a535c', edge: '#1b2026' },
};

let sheet: HTMLImageElement | null = null;
let sheetReady = false;
const waiters = new Set<() => void>();
function loadSheet(): void {
  if (sheet || typeof Image === 'undefined') return;
  sheet = new Image();
  sheet.onload = () => {
    sheetReady = true;
    for (const f of waiters) f();
    waiters.clear();
  };
  sheet.src = BTN_SHEET;
}
/** 시트가 읽히면 다시 그리게 알린다 */
export function onSheetReady(f: () => void): void {
  if (sheetReady) return f();
  waiters.add(f);
  loadSheet();
}

/** 아이콘 칸: 칸 가운데 원 안(아이콘 + 남색 바탕)을 원으로 오려 낸 작은 캔버스. 칸마다 한 번 */
const iconCache = new Map<number, HTMLCanvasElement>();
function iconOf(cell: number): HTMLCanvasElement | null {
  if (!sheet || !sheetReady) return null;
  const hit = iconCache.get(cell);
  if (hit) return hit;
  const r = Math.min(BTN_INNER.rx, BTN_INNER.ry) - 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = r * 2;
  const g = cv.getContext('2d');
  if (!g) return null;
  const [sx, sy] = BTN_CELLS[cell];
  g.imageSmoothingEnabled = false;
  g.beginPath();
  g.arc(r, r, r, 0, Math.PI * 2);
  g.clip();
  g.drawImage(sheet, sx + BTN_CELL / 2 - r, sy + BTN_CELL / 2 - r, r * 2, r * 2, 0, 0, r * 2, r * 2);
  // 남색 바탕은 지운다 (우리가 그린 유리 안쪽이 비치게)
  const img = g.getImageData(0, 0, r * 2, r * 2);
  const d = img.data;
  const [br, bg, bb] = [0x29, 0x2c, 0x3b];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] && Math.abs(d[i] - br) < 10 && Math.abs(d[i + 1] - bg) < 10 && Math.abs(d[i + 2] - bb) < 10) d[i + 3] = 0;
  }
  g.putImageData(img, 0, 0);
  // 아이콘이 차지하는 네모만 남긴다 (바탕을 뺀 픽셀의 경계 + 여백 2px, 정사각) — 틀 안에 정수 배로 크게 들어가게
  let x0 = r * 2, y0 = r * 2, x1 = -1, y1 = -1;
  for (let y = 0; y < r * 2; y++) for (let x = 0; x < r * 2; x++) if (d[(y * r * 2 + x) * 4 + 3] > 0) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y));
  if (x1 < 0) return cv;
  const side = Math.max(x1 - x0, y1 - y0) + 1 + 4;
  const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;
  const tight = document.createElement('canvas');
  tight.width = tight.height = side;
  tight.getContext('2d')!.drawImage(cv, Math.round(cx - side / 2), Math.round(cy - side / 2), side, side, 0, 0, side, side);
  iconCache.set(cell, tight);
  return tight;
}

const cache = new Map<string, HTMLCanvasElement>();

/** 버튼 한 장을 기기 픽셀 크기로 그린다 (캐시) */
export function renderButton(a: ButtonArt): HTMLCanvasElement {
  const k = dpr();
  const key = `${a.kind}|${a.size}|${a.cell ?? ''}|${a.text ?? ''}|${a.on ? 1 : 0}|${k}|${sheetReady ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = Math.round(a.size * k);
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const c = S / 2;
  const main = a.kind === 'main';
  const ring = RING[a.kind];
  // 바깥 여백(장식·그림자 자리): 큰 버튼은 뾰족 장식만큼 더
  const pad = main ? S * 0.085 : S * 0.045;
  const R = c - pad;
  const rw = main ? R * 0.17 : R * 0.12; // 테두리 두께
  g.clearRect(0, 0, S, S);

  // 그림자
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = S * 0.06;
  g.shadowOffsetY = S * 0.02;
  g.fillStyle = ring.edge;
  g.beginPath();
  g.arc(c, c, R, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // 큰 공격 버튼: 테두리 바깥 8개 뾰족 장식 (참고: 히트·블레이드의 메인 공격 버튼)
  if (main) {
    g.fillStyle = ring.mid;
    g.strokeStyle = ring.edge;
    g.lineWidth = Math.max(1, S * 0.006);
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const len = i % 2 === 0 ? S * 0.085 : S * 0.05;
      const w = S * 0.035;
      g.save();
      g.translate(c + Math.cos(t) * (R - rw * 0.3), c + Math.sin(t) * (R - rw * 0.3));
      g.rotate(t);
      g.beginPath();
      g.moveTo(0, -w);
      g.lineTo(len + rw * 0.3, 0);
      g.lineTo(0, w);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    }
  }

  // 금속 테두리: 비스듬한 빛 (위-왼쪽 밝고 아래-오른쪽 어둡게) + 각진 광택
  const lg = g.createLinearGradient(c - R, c - R, c + R, c + R);
  lg.addColorStop(0, ring.hi);
  lg.addColorStop(0.35, ring.mid);
  lg.addColorStop(0.65, ring.lo);
  lg.addColorStop(1, ring.mid);
  g.fillStyle = lg;
  g.beginPath();
  g.arc(c, c, R, 0, Math.PI * 2);
  g.arc(c, c, R - rw, 0, Math.PI * 2, true);
  g.fill();
  // 테두리 안팎 가는 선
  g.strokeStyle = ring.edge;
  g.lineWidth = Math.max(1, S * 0.008);
  g.beginPath();
  g.arc(c, c, R, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(c, c, R - rw, 0, Math.PI * 2);
  g.stroke();
  // 테두리 윗면 하이라이트 선
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = Math.max(1, S * 0.006);
  g.beginPath();
  g.arc(c, c, R - rw * 0.35, Math.PI * 1.05, Math.PI * 1.75);
  g.stroke();
  // 큰 버튼: 테두리에 작은 리벳 4개
  if (main || a.kind === 'ult') {
    for (let i = 0; i < 4; i++) {
      const t = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = c + Math.cos(t) * (R - rw / 2), y = c + Math.sin(t) * (R - rw / 2);
      const rg = g.createRadialGradient(x - rw * 0.1, y - rw * 0.1, 0, x, y, rw * 0.28);
      rg.addColorStop(0, ring.hi);
      rg.addColorStop(1, ring.lo);
      g.fillStyle = rg;
      g.beginPath();
      g.arc(x, y, rw * 0.28, 0, Math.PI * 2);
      g.fill();
    }
  }

  // 안쪽: 어두운 유리 구슬 (가운데 위가 조금 밝고 가장자리로 어두워짐)
  const ir = R - rw;
  const inner = g.createRadialGradient(c, c - ir * 0.35, ir * 0.1, c, c, ir);
  if (a.kind === 'auto' && a.on) {
    inner.addColorStop(0, '#7df5e0');
    inner.addColorStop(0.6, '#1f8f7d');
    inner.addColorStop(1, '#0c3d36');
  } else {
    inner.addColorStop(0, '#3a4252');
    inner.addColorStop(0.55, '#171c25');
    inner.addColorStop(1, '#070a0f');
  }
  g.fillStyle = inner;
  g.beginPath();
  g.arc(c, c, ir, 0, Math.PI * 2);
  g.fill();
  // 아래쪽 테두리 빛 (구슬 밑면 반사)
  const rim = g.createRadialGradient(c, c + ir * 0.9, ir * 0.2, c, c + ir * 0.5, ir * 1.1);
  rim.addColorStop(0, 'rgba(120,150,190,0.22)');
  rim.addColorStop(1, 'rgba(120,150,190,0)');
  g.fillStyle = rim;
  g.beginPath();
  g.arc(c, c, ir, 0, Math.PI * 2);
  g.fill();

  // 아이콘 (정수 배로 — 도트가 안 뭉개지게)
  const icon = a.cell !== null && a.cell !== undefined ? iconOf(a.cell) : null;
  if (icon) {
    // 안쪽 지름의 72% 안에 들어가는 가장 큰 정수 배 (작은 화면이면 1/2)
    const avail = ir * 2 * 0.72;
    let s = Math.floor(avail / icon.width);
    if (s < 1) s = avail / icon.width >= 0.5 ? 0.5 : avail / icon.width;
    const w = icon.width * s;
    g.save();
    g.imageSmoothingEnabled = false;
    g.shadowColor = 'rgba(0,0,0,0.7)';
    g.shadowBlur = S * 0.02;
    g.shadowOffsetY = Math.max(1, S * 0.012);
    g.drawImage(icon, Math.round(c - w / 2), Math.round(c - w / 2), w, w);
    g.restore();
  } else if (a.kind === 'menu') {
    // ≡
    g.fillStyle = '#f2ead6';
    const bw = ir * 0.9, bh = Math.max(2, ir * 0.16);
    for (let i = -1; i <= 1; i++) g.fillRect(c - bw / 2, c + i * ir * 0.42 - bh / 2, bw, bh);
  } else if (a.text) {
    const lines = a.text.split('\n');
    const fs = Math.round(ir * (lines.length > 1 ? 0.62 : a.text.length > 2 ? 0.55 : 0.8));
    g.font = `700 ${fs}px "Galmuri11", "Galmuri", "Pretendard", "Noto Sans KR", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((ln, i) => {
      const y = c + (i - (lines.length - 1) / 2) * fs * 1.05;
      g.fillStyle = 'rgba(0,0,0,0.85)';
      g.fillText(ln, c + Math.max(1, S * 0.012), y + Math.max(1, S * 0.012));
      g.fillStyle = a.kind === 'auto' && a.on ? '#06201c' : '#fbecc9';
      g.fillText(ln, c, y);
    });
  }

  // 윗면 반사광 (유리 느낌)
  g.save();
  g.beginPath();
  g.arc(c, c, ir, 0, Math.PI * 2);
  g.clip();
  const gl = g.createLinearGradient(0, c - ir, 0, c);
  gl.addColorStop(0, 'rgba(255,255,255,0.38)');
  gl.addColorStop(1, 'rgba(255,255,255,0.0)');
  g.fillStyle = gl;
  g.beginPath();
  g.ellipse(c, c - ir * 0.45, ir * 0.82, ir * 0.5, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  cache.set(key, cv);
  return cv;
}

/** 조이스틱 받침: 장식 테두리(4방향 눈금) + 어두운 안쪽. 손잡이는 작은 유리 구슬 */
export function renderStickBase(size: number): HTMLCanvasElement {
  const k = dpr();
  const key = `stick|${size}|${k}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = Math.round(size * k);
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const c = S / 2, R = c - S * 0.03, rw = R * 0.09;
  g.fillStyle = 'rgba(8,12,16,0.55)';
  g.beginPath();
  g.arc(c, c, R - rw, 0, Math.PI * 2);
  g.fill();
  const lg = g.createLinearGradient(c - R, c - R, c + R, c + R);
  lg.addColorStop(0, 'rgba(232,237,242,0.9)');
  lg.addColorStop(0.5, 'rgba(120,130,140,0.9)');
  lg.addColorStop(1, 'rgba(60,68,76,0.9)');
  g.fillStyle = lg;
  g.beginPath();
  g.arc(c, c, R, 0, Math.PI * 2);
  g.arc(c, c, R - rw, 0, Math.PI * 2, true);
  g.fill();
  g.strokeStyle = 'rgba(20,24,30,0.9)';
  g.lineWidth = Math.max(1, S * 0.006);
  g.beginPath();
  g.arc(c, c, R, 0, Math.PI * 2);
  g.stroke();
  // 4방향 눈금 + 작은 삼각 화살
  g.fillStyle = 'rgba(236,230,212,0.85)';
  for (let i = 0; i < 4; i++) {
    const t = (i / 4) * Math.PI * 2;
    g.save();
    g.translate(c + Math.cos(t) * (R - rw * 2.2), c + Math.sin(t) * (R - rw * 2.2));
    g.rotate(t);
    g.beginPath();
    g.moveTo(rw * 0.9, 0);
    g.lineTo(-rw * 0.3, -rw * 0.7);
    g.lineTo(-rw * 0.3, rw * 0.7);
    g.closePath();
    g.fill();
    g.restore();
  }
  // 가운데 얇은 십자
  g.strokeStyle = 'rgba(236,230,212,0.25)';
  g.lineWidth = Math.max(1, S * 0.005);
  g.beginPath();
  g.moveTo(c - R * 0.5, c);
  g.lineTo(c + R * 0.5, c);
  g.moveTo(c, c - R * 0.5);
  g.lineTo(c, c + R * 0.5);
  g.stroke();
  cache.set(key, cv);
  return cv;
}

export function renderKnob(size: number): HTMLCanvasElement {
  const k = dpr();
  const key = `knob|${size}|${k}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = Math.round(size * k);
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const c = S / 2, R = c - S * 0.04;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = S * 0.08;
  g.shadowOffsetY = S * 0.03;
  const rg = g.createRadialGradient(c - R * 0.3, c - R * 0.35, R * 0.1, c, c, R);
  rg.addColorStop(0, '#f4f1e6');
  rg.addColorStop(0.5, '#a9b1b8');
  rg.addColorStop(1, '#4a535c');
  g.fillStyle = rg;
  g.beginPath();
  g.arc(c, c, R, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.strokeStyle = 'rgba(20,24,30,0.8)';
  g.lineWidth = Math.max(1, S * 0.015);
  g.beginPath();
  g.arc(c, c, R, 0, Math.PI * 2);
  g.stroke();
  cache.set(key, cv);
  return cv;
}

/** 화면 배율이 바뀌면(창 이동) 캐시를 비운다 */
export function clearArtCache(): void {
  cache.clear();
}
