import { drawItemArt } from '../art/items';
/**
 * 그레이박스 아이콘. 코드로만 그린다(그림 파일 없음). 칸 배경은 그리지 않고 물건만.
 * 종류별 색: 회복 초록, 해제 청록, 투척 주황, 특수 보라, 무기 회색, 회수물 금색, 현금 노랑.
 */
const C = {
  heal: '#5fbf6a',
  cure: '#4fb3b3',
  throw: '#e08a3c',
  special: '#9a7fd1',
  metal: '#9aa4ab',
  dark: '#4a5258',
  wood: '#a07850',
  gold: '#d6b64a',
  cash: '#e6d36a',
  red: '#d65a5a',
  white: '#e8ecee',
  shard: '#c77dff',
};
type Draw = (g: CanvasRenderingContext2D) => void;
const rect = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};
const circ = (g: CanvasRenderingContext2D, c: string, x: number, y: number, r: number) => {
  g.fillStyle = c;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
};
const poly = (g: CanvasRenderingContext2D, c: string, pts: number[]) => {
  g.fillStyle = c;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fill();
};
const line = (g: CanvasRenderingContext2D, c: string, w: number, pts: number[]) => {
  g.strokeStyle = c;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
};
const bottle = (c: string, mark: string): Draw => g => {
  rect(g, C.dark, 13, 3, 6, 4);
  rect(g, c, 9, 7, 14, 21);
  rect(g, C.white, 11, 13, 10, 8);
  rect(g, mark, 15, 14, 2, 6);
  rect(g, mark, 13, 16, 6, 2);
};
/** 32×32 단위로 그린다 */
const ICONS: Record<string, Draw> = {
  medkit: g => {
    rect(g, C.heal, 4, 9, 24, 18);
    rect(g, C.dark, 12, 5, 8, 4);
    rect(g, C.white, 14, 12, 4, 12);
    rect(g, C.white, 10, 16, 12, 4);
  },
  bandage: g => {
    circ(g, C.white, 16, 16, 11);
    circ(g, C.cure, 16, 16, 5);
    rect(g, C.white, 16, 22, 12, 5);
  },
  antidote: bottle(C.cure, C.cure),
  salt: g => {
    poly(g, C.white, [8, 28, 10, 8, 22, 8, 24, 28]);
    rect(g, C.special, 9, 5, 14, 4);
    circ(g, C.dark, 13, 6, 1);
    circ(g, C.dark, 19, 6, 1);
    rect(g, C.special, 11, 15, 10, 6);
  },
  flash: g => {
    rect(g, C.throw, 10, 10, 12, 18);
    rect(g, C.dark, 12, 5, 8, 5);
    line(g, C.metal, 2, [20, 7, 26, 4]);
    poly(g, C.white, [16, 13, 18, 18, 14, 18, 17, 25, 13, 19, 16, 19]);
  },
  smoke: g => {
    rect(g, C.metal, 10, 11, 12, 17);
    rect(g, C.dark, 12, 6, 8, 5);
    circ(g, '#c8cdd0', 22, 8, 4);
    circ(g, '#c8cdd0', 26, 5, 3);
  },
  charm: g => {
    rect(g, '#e9d77a', 9, 3, 14, 26);
    line(g, C.red, 2, [12, 8, 20, 8, 12, 14, 20, 14, 16, 22, 16, 26]);
  },
  energy: g => {
    rect(g, C.special, 10, 6, 12, 22);
    rect(g, C.metal, 10, 4, 12, 3);
    poly(g, C.cash, [17, 9, 12, 18, 16, 18, 14, 25, 20, 15, 16, 15]);
  },
  adrenaline: g => {
    rect(g, C.white, 6, 14, 18, 5);
    rect(g, C.red, 9, 15, 10, 3);
    rect(g, C.metal, 24, 15, 6, 2);
    rect(g, C.dark, 3, 12, 3, 9);
  },
  // 임시 무기: 한 손 근접 묶음
  pipe: g => line(g, C.metal, 5, [6, 26, 26, 6]),
  chairleg: g => {
    line(g, C.wood, 6, [8, 26, 24, 8]);
    rect(g, C.dark, 21, 4, 7, 7);
  },
  kitchenknife: g => {
    poly(g, C.white, [6, 26, 22, 8, 26, 6, 24, 12, 10, 28]);
    line(g, C.dark, 4, [6, 26, 2, 30]);
  },
  katana: g => {
    line(g, '#2a2f33', 3, [5, 27, 28, 4]);
    line(g, C.white, 1, [9, 22, 27, 5]);
    rect(g, C.gold, 7, 22, 6, 3);
  },
  // 총 묶음
  smg: g => {
    rect(g, C.dark, 4, 11, 22, 7);
    rect(g, C.dark, 10, 18, 5, 9);
    rect(g, C.metal, 17, 18, 3, 7);
    rect(g, C.metal, 26, 13, 4, 3);
  },
  servicepistol: g => {
    rect(g, C.dark, 7, 10, 18, 6);
    poly(g, C.dark, [9, 16, 15, 16, 13, 26, 7, 26]);
    rect(g, C.metal, 25, 11, 3, 3);
  },
  shotgun: g => {
    rect(g, C.metal, 8, 12, 22, 4);
    rect(g, C.wood, 2, 13, 10, 6);
    rect(g, C.dark, 14, 16, 8, 4);
  },
  // 바닥에 떨어지는 것
  cash: g => {
    rect(g, '#7aa35a', 4, 10, 20, 12);
    circ(g, C.cash, 22, 20, 7);
    circ(g, '#b9a23c', 22, 20, 4);
  },
  shard: g => poly(g, C.shard, [16, 3, 24, 14, 18, 29, 9, 17]),
  heal: g => {
    circ(g, C.heal, 16, 16, 10);
    rect(g, C.white, 14, 10, 4, 12);
    rect(g, C.white, 10, 14, 12, 4);
  },
  'ammo-pistol': g => {
    for (const x of [8, 14, 20]) {
      rect(g, C.gold, x, 12, 4, 14);
      rect(g, C.metal, x, 8, 4, 4);
    }
  },
  'ammo-rifle': g => {
    rect(g, C.dark, 10, 6, 12, 22);
    rect(g, C.gold, 12, 3, 8, 4);
  },
  // 회수물
  scrap: g => {
    poly(g, C.metal, [6, 22, 12, 8, 22, 10, 26, 24, 14, 27]);
    circ(g, C.dark, 15, 17, 3);
  },
  oddcoin: g => {
    circ(g, C.gold, 16, 16, 11);
    circ(g, '#a38a2c', 16, 16, 7);
    rect(g, C.gold, 14, 11, 4, 10);
  },
  rustkey: g => {
    circ(g, '#a0603a', 10, 12, 6);
    circ(g, '#2b2f33', 10, 12, 2);
    rect(g, '#a0603a', 14, 11, 14, 3);
    rect(g, '#a0603a', 22, 14, 3, 5);
  },
  photo: g => {
    rect(g, C.white, 6, 5, 20, 22);
    rect(g, '#6b7378', 8, 7, 16, 14);
    circ(g, '#d0d4d6', 16, 13, 4);
  },
  tooth: g => poly(g, C.white, [9, 6, 23, 6, 24, 14, 20, 28, 17, 18, 15, 18, 12, 28, 8, 14]),
  dreamcatcher: g => {
    line(g, C.shard, 2, [16, 4, 16, 4]);
    g.strokeStyle = C.shard;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(16, 14, 9, 0, Math.PI * 2);
    g.stroke();
    line(g, C.white, 1, [9, 9, 23, 19]);
    line(g, C.white, 1, [9, 19, 23, 9]);
    line(g, C.shard, 2, [12, 23, 11, 30]);
    line(g, C.shard, 2, [20, 23, 21, 30]);
  },
  blackbox: g => {
    rect(g, '#25292c', 5, 8, 22, 18);
    rect(g, C.throw, 5, 8, 22, 4);
    circ(g, C.red, 22, 20, 2);
  },
  // 환경 물건
  chair: g => {
    rect(g, C.wood, 9, 4, 4, 22);
    rect(g, C.wood, 9, 15, 15, 4);
    rect(g, C.wood, 21, 15, 3, 13);
    rect(g, C.wood, 9, 26, 3, 3);
  },
  pot: g => {
    poly(g, '#b0653d', [9, 16, 23, 16, 21, 29, 11, 29]);
    circ(g, C.heal, 16, 11, 6);
  },
  extinguisher: g => {
    rect(g, C.red, 11, 9, 10, 20);
    rect(g, C.dark, 13, 5, 6, 4);
    line(g, C.dark, 2, [19, 6, 25, 10, 25, 18]);
  },
  tv: g => {
    rect(g, '#55595d', 4, 7, 24, 18);
    rect(g, '#7fa0a8', 7, 10, 18, 12);
    line(g, C.dark, 2, [12, 7, 9, 2]);
    line(g, C.dark, 2, [20, 7, 23, 2]);
  },
  table: g => {
    rect(g, C.wood, 3, 13, 26, 5);
    rect(g, C.wood, 6, 18, 3, 8);
    rect(g, C.wood, 23, 18, 3, 8);
  },
  bin: g => {
    poly(g, C.metal, [8, 9, 24, 9, 22, 29, 10, 29]);
    rect(g, C.dark, 7, 6, 18, 3);
  },
  crate: g => {
    rect(g, C.wood, 5, 6, 22, 22);
    line(g, '#7a5a3a', 2, [5, 6, 27, 28]);
    line(g, '#7a5a3a', 2, [27, 6, 5, 28]);
  },
  drawer: g => {
    rect(g, C.wood, 6, 4, 20, 25);
    for (const y of [7, 15, 23]) rect(g, '#7a5a3a', 8, y, 16, 5);
  },
  mailbox: g => {
    rect(g, C.metal, 5, 5, 22, 22);
    for (const x of [7, 17]) for (const y of [7, 16]) rect(g, C.dark, x, y, 8, 3);
  },
  barrel: g => {
    rect(g, C.red, 9, 5, 14, 23);
    rect(g, C.dark, 9, 10, 14, 2);
    rect(g, C.dark, 9, 21, 14, 2);
    poly(g, C.cash, [16, 13, 19, 19, 13, 19]);
  },
  locker: g => {
    rect(g, '#5d7a6b', 8, 3, 16, 26);
    rect(g, C.white, 12, 7, 8, 4);
    rect(g, C.dark, 20, 15, 2, 5);
  },
  crackedwall: g => {
    rect(g, '#6e6a64', 3, 3, 26, 26);
    line(g, '#2b2a28', 2, [16, 3, 13, 12, 18, 17, 14, 29]);
    line(g, '#2b2a28', 1, [13, 12, 7, 15]);
  },
  // 상인
  madeokhee: g => {
    rect(g, C.cash, 6, 12, 20, 14);
    circ(g, C.dark, 16, 19, 3);
    rect(g, C.dark, 12, 7, 8, 5);
  },
  backalley: g => {
    rect(g, C.white, 6, 6, 20, 20);
    rect(g, C.red, 14, 9, 4, 14);
    rect(g, C.red, 9, 14, 14, 4);
  },
  shinyuri: g => {
    rect(g, '#7aa35a', 5, 9, 22, 14);
    rect(g, '#5b8040', 5, 13, 22, 3);
    circ(g, C.white, 16, 16, 3);
  },
  vending: g => {
    rect(g, '#4b6c8f', 7, 3, 18, 26);
    rect(g, '#9fc1df', 9, 6, 10, 14);
    rect(g, C.dark, 21, 8, 2, 6);
    rect(g, C.dark, 10, 23, 12, 3);
  },
};
export const hasIcon = (id: string) => id in ICONS;
/** (x, y) 왼쪽 위, size 크기 정사각에 물건 하나. 모르는 id는 물음표 상자. */
export function drawItemIcon(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, size: number): void {
  // GPT 그림을 도트화한 것이 있으면 그것 (art/items). 없으면 아래 코드 아이콘.
  if (drawItemArt(ctx, id, x, y, size)) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  const d = ICONS[id];
  if (d) d(ctx);
  else {
    rect(ctx, C.dark, 6, 6, 20, 20);
    ctx.fillStyle = C.white;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('?', 16, 22);
  }
  ctx.restore();
}
