// 샤워 물줄기·김 (코드 이펙트). tools/bg_fix/bath_f_water_preview.py v17(사용자 2026-11-01 17:34 「됐어」)을 그대로 옮긴 것.
// - 물은 샤워기 헤드 아랫면(head 선) 전체에서 선에 수직(아래쪽)으로 ±SPREAD° 퍼져 곧게 나가며 중력으로만 완만히 휜다(꺾임 없음).
// - 사람 몸(발 x ±10도트, 머리 위부터)에 닿으면 가닥은 거기서 끝나고 물방울 3개만. 몸을 타고 흘러내리는 효과 없음.
// - 1도트 점선(7칠하고 2비움), 가닥마다 어긋남. 김은 큰 덩어리 6개가 천천히 뭉게뭉게(16장 한 바퀴).
// 좌표는 월드 px(배경 2배 그림이라 1도트 = 2px). 미리보기의 1x 수치에 DOT 를 곱해 쓴다.
export interface ShowerHead { id: string; head: [[number, number], [number, number]]; foot: [number, number]; face: 1 | -1 }

const DOT = 2;                              // 1x 그림 도트 → 월드 px
const STREAMS = 7, SPREAD_DEG = 26, SPEED = 3.6 * DOT, G = 0.035 * DOT;
const NF = 16;                              // 김 한 바퀴 장 수. 물 점선도 이 장 번호로 흐른다
const FPS = 8;                              // 미리보기 GIF 120ms/장
const C_DEEP = 'rgba(120,180,230,0.96)', C_HI = 'rgba(235,250,255,1)', C_MID = 'rgba(160,212,245,0.96)';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const dot = (c: CanvasRenderingContext2D, x: number, y: number, col: string) => { c.fillStyle = col; c.fillRect(Math.round(x / DOT) * DOT, Math.round(y / DOT) * DOT, DOT, DOT); };

/** 헤드 면에 수직인 아래쪽 단위 벡터 */
function faceDir(h: ShowerHead): [number, number] {
  const [[x0, y0], [x1, y1]] = h.head; const ex = x1 - x0, ey = y1 - y0, L = Math.hypot(ex, ey) || 1;
  let nx = -ey / L, ny = ex / L;
  if (ny < 0) { nx = -nx; ny = -ny; }
  return [nx, ny];
}

/** 김: 사람 머리·어깨 둘레 6덩어리, 지름 10→22도트, 위로 34도트 */
function drawSteam(c: CanvasRenderingContext2D, h: ShowerHead, headTop: number, headX: number, frame: number) {
  const r = rng(h.id.length * 7 + h.foot[0]);
  for (let k = 0; k < 6; k++) {
    const bx = headX + (r() * 32 - 16) * DOT, by = headTop + r() * 40 * DOT;
    const t = ((frame + (k * NF) / 6) % NF) / NF;
    const y = by - t * 34 * DOT, x = bx + Math.sin(t * 6.28 + k) * 5 * DOT;
    const alpha = 150 * Math.pow(1 - t, 1.2) * Math.min(1, t * 4 + 0.3) / 255, rad = (5 + Math.floor(t * 6)) * DOT;
    c.fillStyle = `rgba(250,253,255,${alpha.toFixed(3)})`;
    for (const [ox, oy, rr] of [[0, 0, rad], [-rad * 0.6, rad * 0.3, rad * 0.7], [rad * 0.6, rad * 0.2, rad * 0.75], [0, -rad * 0.5, rad * 0.6]]) {
      c.beginPath(); c.arc(x + ox, y + oy, rr, 0, Math.PI * 2); c.fill();
    }
  }
}

/** 샤워기 하나의 물·김을 그린다. headTop = 그 자리에 선 사람 머리 꼭대기 y(월드), 없으면 몸에 안 닿고 바닥까지. now = ms */
export function drawShowerWater(c: CanvasRenderingContext2D, h: ShowerHead, headTop: number | null, now: number) {
  const frame = Math.floor((now / 1000) * FPS) % NF;
  const [fx, fy] = h.foot, headX = fx;
  if (headTop !== null) drawSteam(c, h, headTop, headX, frame);
  const [[x0, y0], [x1, y1]] = h.head, [dx, dy] = faceDir(h), base = Math.atan2(dy, dx);
  const r = rng(h.foot[0] * 100 + h.foot[1]);
  for (let s = 0; s < STREAMS; s++) {
    const u = s / (STREAMS - 1);
    let x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
    const th = base + ((u - 0.5) * 2 * SPREAD_DEG * Math.PI) / 180;
    let vx = SPEED * Math.cos(th), vy = SPEED * Math.sin(th);
    for (let i = 0; i < 400; i++) {
      if (headTop !== null && Math.abs(x - headX) < 10 * DOT && y >= headTop) {   // 몸에 닿음: 가닥 끝, 물방울 3개
        for (let k = 0; k < 3; k++) { const a = r() * Math.PI, rr = (3 + r() * 6) * DOT; dot(c, x + Math.cos(a) * rr, y - Math.abs(Math.sin(a)) * rr * 0.6 + ((frame + k) % 3) * DOT, C_HI); }
        break;
      }
      if (y >= fy - 2 * DOT) break;
      if ((i + frame * 2 + s * 3) % 9 < 7) dot(c, x, y, i % 11 < 2 ? C_HI : C_DEEP);
      x += vx; y += vy; vy += G; void vx;
    }
  }
  if (headTop !== null) for (let k = 0; k < 14; k++) {      // 머리·어깨 물방울
    const a = r() * Math.PI, rr = (5 + r() * 14 + ((frame + k) % 4)) * DOT;
    dot(c, headX + Math.cos(a) * rr, headTop + 4 * DOT - Math.abs(Math.sin(a)) * rr * 0.5, k % 3 === 0 ? C_HI : C_MID);
  }
  for (let k = 0; k < 16; k++) {                             // 발밑 물튀김
    const a = r() * Math.PI * 2, rr = (6 + r() * 16) * DOT, ph = (k + frame) % 4;
    dot(c, fx + Math.cos(a) * rr, fy + Math.sin(a) * rr * 0.3 - ph * DOT, ph === 0 ? C_HI : C_MID);
  }
}
