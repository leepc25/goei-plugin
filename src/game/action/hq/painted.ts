// 관리국 층 배경 그림(game-src/art/field/hq/, 확정 6장)의 좌표 자료. 그림 px = 월드 px (세로 700, 벽·바닥 선 y420).
// 문: 열리는 그림은 배경에서 문짝 자리를 그대로 떠서 움직인다 (art/hqField.ts). 좌표는 눈으로 잰 값(±3px).
//  slide2 = 두 짝 미닫이(엘리베이터·자동문), swing = 여닫이 한 짝(hinge 쪽으로 접힌다), swing2 = 양여닫이, shutter = 위로 말린다,
//  glow = 문짝은 그대로 두고 유리에 바깥 빛만 번진다(비스듬한 문).
//  quad = 옆벽 문(원근 사다리꼴: 왼위·오위·오아래·왼아래). behind: dark = 문 안이 어둡다, car = 엘리베이터 칸,
//  see = 투명 유리(살짝만 열린다), lit = 젖빛 유리 너머 밝은 방(다 열린다).
// 조명: down = 천장 다운라이트, sign = 비상구 등, lamp = 작은 등. blink가 있으면 깜빡인다(주기 ms, 켜진 비율, 어긋남).
// 창: 바깥이 보이는 곳(비워 둠: 상자로 덮으면 창 모양과 안 맞아 어색하다는 사용자 지적, 2026-10-25).
export type DoorAnim = 'slide2' | 'swing' | 'swing2' | 'shutter' | 'glow' | 'none';
export interface PaintedDoor {
  x0: number; x1: number; y0: number; y1: number;
  anim: DoorAnim;
  seam?: number;
  hinge?: 'L' | 'R';
  quad?: [number, number][];
  behind?: 'dark' | 'car' | 'see' | 'lit';
}
export interface PaintedLamp {
  x: number; y: number;
  kind: 'down' | 'sign' | 'lamp';
  color?: string;
  r?: number;
  blink?: { period: number; duty: number; phase?: number; pulse?: boolean };
}
export interface PaintedObject {
  id: string;
  file: string;
  x: number; y: number; w: number; h: number;
  /** 깊이 순서 기준 (발 y와 비교) */
  sortY: number;
  /** 막는 바닥 상자 (여럿이면 모두). h = 윗면 높이(px): 이보다 높이 뛰면 넘고, 위에 설 수 있다 */
  solid?: { x0: number; x1: number; y0: number; y1: number; h?: number }[];
}
export interface PaintedScene {
  file: string;
  w: number;
  under: boolean;
  /** 걷는 띠 [맨 뒤, 맨 앞]. 맨 뒤는 벽선(y420)보다 조금 앞이라 발이 벽·문 그림을 뚫지 않는다 */
  lane?: [number, number];
  /** 엘리베이터 호출 단추(그림 속 붉게 켜진 단추 가운데). 층을 고르면 초록으로 바뀐다 */
  call?: [number, number];
  /** 그림 속 화분·벤치 같은 막는 물건 (오브젝트로 오리지 않고 바닥 상자만): x0, x1, 앞 모서리 y, 윗면 높이 */
  blocks?: [number, number, number, number?][];
  /** 걷는 바닥 다각형(발 위치): 양 끝 옆벽 바닥선·튀어나온 벽·문턱 안쪽. 몸 폭만큼 들여 잡았다 */
  floor?: [number, number][];
  doors: Record<string, PaintedDoor>;
  lamps: PaintedLamp[];
  windows: [number, number, number, number][];
  objects: PaintedObject[];
}

const downs = (xs: number[], y = 18): PaintedLamp[] => xs.map((x) => ({ x, y, kind: 'down' as const }));
const sign = (x: number, y: number): PaintedLamp => ({ x, y, kind: 'sign', color: '#3cff8a', r: 34 });
const elev = (x0: number, x1: number, y0: number, y1: number, seam: number): PaintedDoor => ({ x0, x1, y0, y1, seam, anim: 'slide2', behind: 'car' });

export const PAINTED: Record<string, PaintedScene> = {
  lobby: {
    // 왼쪽 유리 현관 문턱 앞, 오른쪽 옆벽(계단 문) 바닥선 안쪽
    // 데스크 뒤(왼쪽 빈 곳으로 들어감)는 y428까지 걸을 수 있다
    file: 'lobby', w: 2223, under: false, lane: [428, 669], call: [1800, 280],
    blocks: [[350, 440, 470, 70], [1158, 1230, 462, 70], [1250, 1498, 458, 46], [1900, 1980, 470, 70]],
    floor: [[0, 478], [330, 452], [470, 452], [470, 428], [1150, 428], [1150, 446], [2010, 446], [2190, 510], [2223, 520], [2223, 669], [0, 669]],
    doors: {
      // 비스듬한 유리벽이라 문짝을 움직이면 선이 안 맞는다: 바깥 빛만 번진다
      main: { x0: 91, x1: 307, y0: 38, y1: 457, seam: 198, anim: 'glow', behind: 'see' },
      elev: elev(1580, 1765, 117, 415, 1674),
      stairs: { x0: 2088, x1: 2195, y0: 98, y1: 485, anim: 'swing', hinge: 'L', quad: [[2088, 112], [2195, 98], [2195, 485], [2088, 460]] },
    },
    lamps: [...downs([861, 1095, 1356, 1671]), sign(2133, 67)],
    windows: [],
    objects: [{ id: 'desk', file: 'desk', x: 494, y: 205, w: 644, h: 262, sortY: 463, solid: [{ x0: 494, x1: 1137, y0: 442, y1: 466, h: 140 }, { x0: 1096, x1: 1137, y0: 428, y1: 466, h: 140 }] }],
  },
  f2: {
    file: 'f2', w: 2064, under: false, call: [1132, 284],
    blocks: [[196, 286, 476, 70], [1776, 1858, 476, 70]],
    floor: [[0, 480], [92, 446], [1950, 446], [2064, 482], [2064, 669], [0, 669]],
    doors: {
      wc: { x0: 30, x1: 118, y0: 112, y1: 470, anim: 'swing', hinge: 'R', quad: [[30, 112], [118, 128], [118, 446], [30, 470]] },
      swat: { x0: 335, x1: 770, y0: 90, y1: 432, seam: 554, anim: 'swing2', behind: 'see' },
      elev: elev(886, 1091, 114, 431, 988),
      meeting: { x0: 1232, x1: 1398, y0: 98, y1: 425, anim: 'swing', hinge: 'R' },
      interview: { x0: 1538, x1: 1705, y0: 98, y1: 425, anim: 'swing', hinge: 'R' },
      stairs: { x0: 1948, x1: 2047, y0: 104, y1: 484, anim: 'swing', hinge: 'L', quad: [[1948, 125], [2047, 104], [2047, 484], [1948, 455]] },
    },
    lamps: [...downs([389, 710, 975, 1275, 1581]), sign(1986, 62)],
    windows: [],
    objects: [],
  },
  f3: {
    file: 'f3', w: 1915, under: false, call: [1051, 291],
    blocks: [[180, 266, 472, 70], [1648, 1726, 472, 70]],
    floor: [[0, 478], [80, 446], [1832, 446], [1915, 478], [1915, 669], [0, 669]],
    doors: {
      wc: { x0: 30, x1: 112, y0: 128, y1: 470, anim: 'swing', hinge: 'R', quad: [[30, 128], [112, 142], [112, 450], [30, 470]] },
      pantry: { x0: 315, x1: 470, y0: 118, y1: 425, anim: 'swing', hinge: 'R' },
      lounge: { x0: 562, x1: 715, y0: 118, y1: 425, anim: 'swing', hinge: 'R' },
      elev: elev(820, 1014, 133, 430, 916),
      office: { x0: 1148, x1: 1578, y0: 142, y1: 422, seam: 1366, anim: 'slide2', behind: 'see' },
      stairs: { x0: 1805, x1: 1893, y0: 122, y1: 480, anim: 'swing', hinge: 'L', quad: [[1805, 138], [1893, 122], [1893, 480], [1805, 458]] },
    },
    lamps: [...downs([362, 656, 907, 1184, 1469]), sign(1842, 86)],
    windows: [],
    objects: [],
  },
  b1: {
    file: 'b1', w: 1940, under: true, call: [1065, 292],
    blocks: [[186, 272, 472, 70], [1670, 1750, 472, 70]],
    floor: [[0, 478], [80, 446], [1852, 446], [1940, 478], [1940, 669], [0, 669]],
    doors: {
      edu: { x0: 30, x1: 112, y0: 125, y1: 470, anim: 'swing', hinge: 'R', quad: [[30, 125], [112, 140], [112, 450], [30, 470]] },
      training: { x0: 345, x1: 692, y0: 132, y1: 432, seam: 518, anim: 'swing2' },
      elev: elev(829, 1028, 132, 432, 929),
      shower_m: { x0: 1160, x1: 1318, y0: 128, y1: 422, anim: 'swing', hinge: 'R' },
      shower_f: { x0: 1438, x1: 1595, y0: 128, y1: 422, anim: 'swing', hinge: 'R' },
      stairs: { x0: 1828, x1: 1918, y0: 125, y1: 480, anim: 'swing', hinge: 'L', quad: [[1828, 140], [1918, 125], [1918, 480], [1828, 458]] },
    },
    lamps: [...downs([367, 665, 919, 1201, 1488]), sign(1866, 86)],
    windows: [],
    objects: [],
  },
  b2: {
    file: 'b2', w: 2003, under: true, call: [1130, 287],
    floor: [[0, 486], [100, 446], [1906, 446], [2003, 484], [2003, 669], [0, 669]],
    doors: {
      interrogation: { x0: 33, x1: 119, y0: 119, y1: 465, anim: 'swing', hinge: 'R', quad: [[33, 119], [119, 135], [119, 444], [33, 465]] },
      isolation: { x0: 385, x1: 725, y0: 122, y1: 410, anim: 'shutter' },
      elev: elev(886, 1091, 126, 432, 990),
      clinic: { x0: 1230, x1: 1640, y0: 122, y1: 420, seam: 1435, anim: 'slide2', behind: 'lit' },
      archive: { x0: 1882, x1: 1966, y0: 118, y1: 472, anim: 'swing', hinge: 'L', quad: [[1882, 130], [1966, 118], [1966, 472], [1882, 452]] },
    },
    lamps: [
      ...downs([388, 704, 983, 1294, 1588]),
      // 격리 구역 붉은 등: 셔터 위 경광등은 천천히 맥박, 문 옆 표시등은 번갈아 깜빡
      { x: 552, y: 92, kind: 'lamp', color: '#ff3a2a', r: 70, blink: { period: 1600, duty: 0.5, pulse: true } },
      { x: 793, y: 258, kind: 'lamp', color: '#ff3a2a', r: 34, blink: { period: 1000, duty: 0.5 } },
      { x: 143, y: 267, kind: 'lamp', color: '#ff3a2a', r: 30, blink: { period: 1000, duty: 0.5, phase: 0.5 } },
      { x: 1986, y: 288, kind: 'lamp', color: '#ff3a2a', r: 30, blink: { period: 1300, duty: 0.35, phase: 0.2 } },
      { x: 1435, y: 106, kind: 'lamp', color: '#ff3a2a', r: 22, blink: { period: 2200, duty: 0.15, phase: 0.6 } },
    ],
    windows: [],
    objects: [],
  },
  b3: {
    // 주차장: 차 앞 주차선(y448) 앞, 경비실(보급실) 앞벽(y485) 앞, 엘리베이터 옆벽 바닥선 왼쪽
    file: 'b3', w: 1906, under: true, lane: [458, 669], call: [1883, 413],
    floor: [[0, 460], [995, 460], [995, 496], [1690, 496], [1906, 604], [1906, 669], [0, 669]],
    doors: {
      supply: { x0: 1405, x1: 1597, y0: 190, y1: 470, anim: 'swing', hinge: 'L' },
      elev: { x0: 1724, x1: 1849, y0: 130, y1: 552, seam: 1784, anim: 'slide2', behind: 'car', quad: [[1724, 165], [1849, 130], [1849, 552], [1724, 510]] },
    },
    lamps: [
      { x: 426, y: 80, kind: 'down', r: 150 }, { x: 914, y: 76, kind: 'down', r: 150 },
      { x: 1500, y: 95, kind: 'lamp', color: '#ffb84a', r: 50 },
      { x: 1772, y: 40, kind: 'sign', color: '#3cffd0', r: 30 },
    ],
    windows: [],
    objects: [],
  },
};

/** 문 가운데 x */
export const doorX = (scene: string, id: string) => {
  const d = PAINTED[scene].doors[id];
  return Math.round((d.x0 + d.x1) / 2);
};

/** 그림 층 기본 걷는 띠 */
export const PAINTED_LANE: [number, number] = [440, 669];

/** 옆벽·튀어나온 벽 바깥으로 나간 발을 바닥 안으로 되돌린다 */
export function clampPainted(scene: string, x: number, y: number): { x: number; y: number } {
  const p = PAINTED[scene];
  if (!p) return { x, y };
  if (p.floor) return inPolygon(p.floor, x, y) ? { x, y } : nearestInside(p.floor, x, y);
  return { x, y };
}

function inPolygon(poly: [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** 다각형 밖의 점 → 가장 가까운 변 위의 점을 안쪽으로 2px 들여서 */
function nearestInside(poly: [number, number][], x: number, y: number): { x: number; y: number } {
  let best = { x, y, d: Infinity };
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
    const qx = ax + dx * t, qy = ay + dy * t, d = (qx - x) ** 2 + (qy - y) ** 2;
    if (d < best.d) best = { x: qx, y: qy, d };
  }
  // 안쪽으로 조금
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const k = 2 / (Math.hypot(cx - best.x, cy - best.y) || 1);
  return { x: best.x + (cx - best.x) * k, y: best.y + (cy - best.y) * k };
}

/** 문 앞에서 E가 닿는 깊이 한계(발 y): 문 그림 아래 끝 + 75 (옆벽 문은 사다리꼴 아래 끝) */
export function doorReachY(scene: string, id: string): number | null {
  const d = PAINTED[scene]?.doors[id];
  if (!d) return null;
  return (d.quad ? Math.max(...d.quad.map((q) => q[1])) : d.y1) + 80;
}
