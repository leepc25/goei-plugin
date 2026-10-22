// 출동 지도 (기본기획서 6.2 「지도(Tab/M): 가 본 방, 본 문, 휴식방, 목표 방향. 미니맵은 화면 구석. 코드로 그린다」).
// 층은 가로 막대(가 본 만큼 밝게), 그 아래에 정비 구역 칸 격자, 곁가지 방은 막대 위 작은 칸. 아래로 깊이 순.
// module.ts의 mapView()가 자료를 만들고, 여기는 그리기만 한다(화면 1280×720 논리 px).

export interface MapMark {
  x: number;
  kind: 'service' | 'up' | 'gate' | 'side' | 'secret' | 'elevator' | 'boss' | 'start';
  state: string;
}
export interface MapFloor {
  depth: number;
  label: string;
  type: string;
  width: number;
  explored: [number, number];
  marks: MapMark[];
}
export interface MapCell {
  col: number;
  row: number;
  open: { u: boolean; r: boolean; d: boolean; l: boolean };
  seen: boolean;
  kind: string;
  key: boolean;
}
export interface MapService {
  depth: number;
  cols: number;
  rows: number;
  cells: MapCell[];
  /** 위층에서 들어간 해치 x (막대와 잇는 선) */
  hatchX: number;
  /** 아래층으로 이어진 지름길이 열렸나 */
  shortcut: boolean;
}
export interface RunMap {
  where: 'floor' | 'service' | 'side' | 'car' | 'ending';
  depth: number;
  cell: [number, number] | null;
  /** 곁가지 방 안이면 그 문 x */
  sideX: number | null;
  floors: MapFloor[];
  services: MapService[];
  keys: number[];
  upgrades: string[];
  goal: string;
  seed: number;
}

const C = {
  bg: 'rgba(10,12,16,0.94)',
  frame: '#c8a24a',
  dim: '#2b3138',
  floor: '#56616b',
  seen: '#a9b7bf',
  text: '#e9e4d4',
  sub: '#8f9aa1',
  here: '#ffffff',
  svc: '#8a6a3c',
  svcSeen: '#c79a55',
  gateLocked: '#e0503c',
  gateOpen: '#5fe08a',
  key: '#f2c14e',
  side: '#ffb840',
  boss: '#d0406a',
  elev: '#7fc3ff',
};

function txt(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left') {
  c.font = `700 ${size}px "Galmuri11", "DungGeunMo", system-ui, sans-serif`;
  c.textAlign = align;
  c.textBaseline = 'alphabetic';
  c.lineWidth = 4;
  c.strokeStyle = 'rgba(0,0,0,0.8)';
  c.strokeText(s, x, y);
  c.fillStyle = color;
  c.fillText(s, x, y);
}

/** 표식 하나 (도트 아이콘) */
function glyph(c: CanvasRenderingContext2D, m: MapMark, x: number, y: number, s: number) {
  const R = (dx: number, dy: number, w: number, h: number, col: string) => {
    c.fillStyle = col;
    c.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), Math.ceil(w * s), Math.ceil(h * s));
  };
  switch (m.kind) {
    case 'service': // 아래 화살표 (정비 구역 입구)
      R(-3, -4, 6, 2, C.svcSeen);
      R(-2, -2, 4, 2, C.svcSeen);
      R(-1, 0, 2, 2, C.svcSeen);
      break;
    case 'up': // 위 화살표 (열림 초록 / 잠김 빨강)
      R(-1, -4, 2, 2, m.state === 'open' ? C.gateOpen : C.gateLocked);
      R(-2, -2, 4, 2, m.state === 'open' ? C.gateOpen : C.gateLocked);
      R(-3, 0, 6, 2, m.state === 'open' ? C.gateOpen : C.gateLocked);
      break;
    case 'gate': // 셔터 막대 + 열쇠 구멍
      R(-1.5, -6, 3, 12, m.state === 'open' ? C.gateOpen : C.gateLocked);
      if (m.state !== 'open') R(-0.5, -1, 1, 2, '#000');
      if (m.state === 'key') R(-4, -8, 8, 2, C.key);
      break;
    case 'side': // 문 (보상 남음 호박 / 비었음 회색)
      R(-2.5, -5, 5, 7, m.state === 'done' ? '#555' : C.side);
      R(-1.5, -4, 3, 5, '#1a1a1a');
      break;
    case 'secret':
      R(-3, -3, 6, 6, m.state === 'done' ? '#555' : '#d9a6ff');
      R(-1, -1, 2, 2, '#1a1a1a');
      break;
    case 'elevator':
      R(-3, -5, 6, 8, C.elev);
      R(-0.5, -5, 1, 8, '#123');
      break;
    case 'boss':
      R(-3, -4, 6, 5, C.boss);
      R(-2, -3, 1, 1, '#000');
      R(1, -3, 1, 1, '#000');
      R(-2, 1, 4, 1, C.boss);
      break;
    case 'start':
      R(-2, -4, 4, 6, '#9aa');
      break;
  }
}

function hereDot(c: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const on = Math.floor(t * 3) % 2 === 0;
  c.fillStyle = on ? C.here : '#ffd76a';
  c.fillRect(Math.round(x) - 4, Math.round(y) - 4, 8, 8);
  c.strokeStyle = '#000';
  c.lineWidth = 2;
  c.strokeRect(Math.round(x) - 5, Math.round(y) - 5, 10, 10);
}

/** 전체 지도. px = 지금 장소에서 요원 x */
export function drawRunMap(c: CanvasRenderingContext2D, m: RunMap, px: number, t: number, W = 1280, H = 720) {
  c.save();
  c.fillStyle = C.bg;
  c.fillRect(0, 0, W, H);
  c.strokeStyle = C.frame;
  c.lineWidth = 4;
  c.strokeRect(24, 20, W - 48, H - 40);
  txt(c, '출동 지도', 48, 60, 26, C.text);
  txt(c, `열쇠 ${m.keys.length ? m.keys.map((d) => (d <= 3 ? `L${d}` : `B-${d - 3}`)).join(' ') : '없음'}  ·  강화 ${m.upgrades.length}`, W - 48, 60, 16, C.sub, 'right');
  txt(c, m.goal, 48, 90, 17, '#ffd76a');

  const x0 = 140,
    x1 = W - 60;
  const maxW = Math.max(6000, ...m.floors.map((f) => f.width));
  const k = (x1 - x0) / maxW;
  // 한 깊이 = 층 막대 + 그 아래 정비 구역. 깊이가 많으면 지금 깊이가 가운데 오게 위로 민다
  const pitch = 132;
  const top = 128;
  const idx = Math.max(0, m.floors.findIndex((f) => f.depth === m.depth));
  const visible = Math.floor((H - top - 60) / pitch);
  const first = Math.max(0, Math.min(idx - Math.floor(visible / 2), m.floors.length - visible));
  const rowY = new Map<number, number>();
  m.floors.slice(first, first + visible + 1).forEach((f, i) => rowY.set(f.depth, top + i * pitch));

  for (const f of m.floors) {
    const y = rowY.get(f.depth);
    if (y === undefined || y > H - 50) continue;
    const label = f.depth <= 3 ? `L${f.depth}` : `B-${f.depth - 3}`;
    txt(c, label, x0 - 16, y + 18, 20, f.depth === m.depth ? '#fff' : C.sub, 'right');
    txt(c, f.label.replace(/^[^·]*· /, ''), x0 - 16, y + 36, 11, C.sub, 'right');
    const w = f.width * k;
    // 막대: 안 가 본 곳은 어둡게
    c.fillStyle = C.dim;
    c.fillRect(x0, y, w, 22);
    c.fillStyle = f.depth === m.depth && m.where === 'floor' ? C.seen : C.floor;
    const ea = Math.max(0, f.explored[0]) * k,
      eb = Math.min(f.width, f.explored[1]) * k;
    if (eb > ea) c.fillRect(x0 + ea, y, eb - ea, 22);
    c.strokeStyle = '#000';
    c.lineWidth = 2;
    c.strokeRect(x0, y, w, 22);
    for (const mk of f.marks) {
      const gx = x0 + mk.x * k;
      if (mk.kind === 'side' || mk.kind === 'secret') {
        // 곁가지 방: 막대 위 작은 칸
        c.fillStyle = mk.state === 'done' ? '#3b3b3b' : '#5b4520';
        c.fillRect(gx - 9, y - 22, 18, 16);
        c.strokeStyle = '#000';
        c.strokeRect(gx - 9, y - 22, 18, 16);
        c.fillStyle = '#000';
        c.fillRect(gx - 1, y - 6, 2, 6);
        glyph(c, mk, gx, y - 13, 1.6);
      } else glyph(c, mk, gx, y + 11, 2);
    }
    if (f.depth === m.depth && m.where === 'floor') hereDot(c, x0 + px * k, y + 11, t);
    if (f.depth === m.depth && m.where === 'side' && m.sideX !== null) hereDot(c, x0 + m.sideX * k, y - 14, t);
  }
  // 정비 구역: 층 막대 아래, 들어간 해치 x 근처에 칸 격자
  for (const s of m.services) {
    const y = rowY.get(s.depth);
    if (y === undefined) continue;
    const cw = 30,
      ch = 16,
      gap = 6;
    const gw = s.cols * (cw + gap) - gap;
    const gx = Math.max(x0, Math.min(x1 - gw, x0 + s.hatchX * k - gw / 2));
    const gy = y + 34;
    c.strokeStyle = C.svc;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x0 + s.hatchX * k, y + 22);
    c.lineTo(x0 + s.hatchX * k, gy);
    c.stroke();
    for (const cell of s.cells) {
      const cx = gx + cell.col * (cw + gap),
        cy = gy + cell.row * (ch + gap);
      if (cell.row * (ch + gap) + gy > y + pitch - 8) continue;
      if (!cell.seen && !cell.key && cell.kind !== 'attic') continue;
      c.fillStyle = cell.seen ? C.svcSeen : '#3a2e1c';
      c.fillRect(cx, cy, cw, ch);
      c.strokeStyle = '#000';
      c.strokeRect(cx, cy, cw, ch);
      c.fillStyle = C.svcSeen;
      if (cell.seen) {
        if (cell.open.r) c.fillRect(cx + cw, cy + ch / 2 - 2, gap, 4);
        if (cell.open.d) c.fillRect(cx + cw / 2 - 2, cy + ch, 4, gap);
      }
      if (cell.kind === 'attic') {
        // 다락방: 별
        c.fillStyle = '#fff3a0';
        c.fillRect(cx + cw / 2 - 1, cy + 3, 3, 10);
        c.fillRect(cx + cw / 2 - 5, cy + 7, 11, 3);
      }
      if (cell.kind === 'down') glyph(c, { x: 0, kind: 'service', state: '' }, cx + cw / 2, cy + ch / 2, 1.5);
      if (cell.key) {
        c.fillStyle = C.key;
        c.fillRect(cx + 4, cy + 5, 6, 6);
        c.fillRect(cx + 10, cy + 7, 12, 2);
      }
      if (m.where === 'service' && m.depth === s.depth && m.cell && m.cell[0] === cell.col && m.cell[1] === cell.row) hereDot(c, cx + 6 + (px / 1280) * (cw - 12), cy + ch / 2, t);
    }
    if (s.shortcut) {
      const ny = rowY.get(s.depth + 1);
      if (ny !== undefined) {
        c.strokeStyle = C.gateOpen;
        c.setLineDash([4, 4]);
        c.beginPath();
        c.moveTo(gx + gw / 2, gy + s.rows * (ch + gap));
        c.lineTo(x0 + 1100 * k, ny);
        c.stroke();
        c.setLineDash([]);
      }
    }
  }
  // 범례
  const ly = H - 34;
  let lx = 48;
  const legend: [MapMark, string][] = [
    [{ x: 0, kind: 'service', state: '' }, '정비 구역 입구'],
    [{ x: 0, kind: 'up', state: 'open' }, '위층 점검문'],
    [{ x: 0, kind: 'gate', state: 'locked' }, '잠긴 셔터'],
    [{ x: 0, kind: 'side', state: '' }, '곁가지 방'],
    [{ x: 0, kind: 'secret', state: '' }, '숨은 방'],
    [{ x: 0, kind: 'elevator', state: '' }, '승강기 패널'],
    [{ x: 0, kind: 'boss', state: '' }, '수호자'],
  ];
  for (const [mk, s] of legend) {
    glyph(c, mk, lx + 8, ly - 4, 2);
    txt(c, s, lx + 22, ly + 2, 13, C.sub);
    c.font = '700 13px system-ui';
    lx += 40 + c.measureText(s).width;
  }
  txt(c, 'Z · Tab · M 닫기', W - 48, ly + 2, 13, C.sub, 'right');
  c.restore();
}

/** 미니맵 (화면 위, 아이템 칸과 깊이 표시 사이). 층이면 요원 주변 막대, 정비 구역이면 칸 격자 */
export function drawMiniMap(c: CanvasRenderingContext2D, m: RunMap, px: number, t: number, x = 740, y = 16, w = 400, h = 62) {
  c.save();
  c.fillStyle = 'rgba(10,12,16,0.72)';
  c.fillRect(x, y, w, h);
  c.strokeStyle = 'rgba(200,162,74,0.85)';
  c.lineWidth = 2;
  c.strokeRect(x, y, w, h);
  const f = m.floors.find((q) => q.depth === m.depth);
  if ((m.where === 'floor' || m.where === 'side') && f) {
    const span = 7000;
    const k = (w - 16) / span;
    const cx = m.where === 'side' && m.sideX !== null ? m.sideX : px;
    const a = Math.max(0, Math.min(f.width - span, cx - span / 2));
    const bx = x + 8 - a * k,
      by = y + 30;
    c.save();
    c.beginPath();
    c.rect(x + 4, y + 4, w - 8, h - 8);
    c.clip();
    c.fillStyle = C.dim;
    c.fillRect(bx, by, f.width * k, 12);
    c.fillStyle = C.seen;
    c.fillRect(bx + Math.max(0, f.explored[0]) * k, by, (Math.min(f.width, f.explored[1]) - Math.max(0, f.explored[0])) * k, 12);
    for (const mk of f.marks) {
      if (mk.kind === 'side' || mk.kind === 'secret') glyph(c, mk, bx + mk.x * k, by - 9, 1.3);
      else glyph(c, mk, bx + mk.x * k, by + 6, 1.4);
    }
    hereDot(c, bx + cx * k, by + 6, t);
    c.restore();
    txt(c, m.goal, x + 8, y + 20, 12, '#ffd76a');
  } else if (m.where === 'service') {
    const s = m.services.find((q) => q.depth === m.depth);
    if (s) {
      // 글 한 줄 아래에 칸 지도 (줄 수에 맞춰 칸 높이를 줄인다)
      const rows = Math.max(1, s.rows);
      const gap = 2,
        ch = Math.max(3, Math.min(10, Math.floor((h - 32) / rows) - gap)),
        cw = Math.min(26, Math.floor((w - 20) / s.cols) - gap);
      const gx = x + w - 10 - s.cols * (cw + gap),
        gy = y + 28;
      for (const cell of s.cells) {
        if (!cell.seen && !cell.key && cell.kind !== 'attic') continue;
        const cx = gx + cell.col * (cw + gap),
          cy = gy + cell.row * (ch + gap);
        if (cy + ch > y + h - 2) continue;
        c.fillStyle = cell.seen ? C.svcSeen : '#3a2e1c';
        c.fillRect(cx, cy, cw, ch);
        if (cell.kind === 'attic') (c.fillStyle = '#fff3a0'), c.fillRect(cx + cw / 2 - 2, cy + 1, 4, Math.max(2, ch - 2));
        if (cell.key) (c.fillStyle = C.key), c.fillRect(cx + 3, cy + 1, 8, Math.max(2, ch - 2));
        if (m.cell && m.cell[0] === cell.col && m.cell[1] === cell.row) hereDot(c, cx + cw / 2, cy + ch / 2, t);
      }
      txt(c, m.goal, x + 8, y + 20, 12, '#ffd76a');
    }
  } else txt(c, m.where === 'car' ? '승강기 안' : '', x + 8, y + 36, 14, C.text);
  c.restore();
}
