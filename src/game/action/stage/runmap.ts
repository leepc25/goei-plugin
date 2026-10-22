// 출동 지도 (기본기획서 6.2 「지도(Tab/M): 가 본 방, 본 문, 휴식방, 목표 방향. 미니맵은 화면 구석. 코드로 그린다」).
// 층은 가로 막대(가 본 만큼 밝게), 그 아래에 정비 구역 칸 격자, 곁가지 방은 막대 위 작은 칸. 아래로 깊이 순.
// module.ts의 mapView()가 자료를 만들고, 여기는 그리기만 한다(화면 1280×720 논리 px).

export type MapDir = 'l' | 'r' | 'u' | 'd';
/** 방 격자 한 칸 (가 본 방, 또는 가 본 방의 문 너머로 보이는 방) */
export interface MapRoom {
  col: number;
  row: number;
  /** 들어가 봤다 */
  seen: boolean;
  open: Record<MapDir, boolean>;
  wrap: Partial<Record<MapDir, boolean>>;
  /** 잠긴 연결: 번호와 상태 (잠김·열쇠 있음·열림) */
  lock: Partial<Record<MapDir, { n: number; state: 'locked' | 'key' | 'open' }>>;
  /** 부순·뜯은 숨은 연결 */
  broken: Partial<Record<MapDir, boolean>>;
  role: string;
  /** 아직 안 주운 열쇠 번호 */
  key: number | null;
  panel: boolean;
  guardian: boolean;
  /** 들어가 봤고 싸움을 다 이겼다 (층 클리어 조건) */
  clear: boolean;
  /** 보상 배낭: 남음·받음 */
  reward: 'full' | 'done' | null;
  name: string;
}
export interface MapWorld {
  depth: number;
  label: string;
  cols: number;
  rows: number;
  rooms: MapRoom[];
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
  /** 지금 방 (층 안일 때) */
  room: [number, number] | null;
  /** 지금 방 안에서 요원 위치 비율을 내려고 쓰는 방 폭 */
  roomW: number;
  cell: [number, number] | null;
  worlds: MapWorld[];
  services: MapService[];
  keys: string[];
  upgrades: string[];
  goal: string;
  seed: number;
}

const C = {
  bg: '#0a0c10',
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

/** 한 줄에 맞춘 글: 넘치면 글자를 0.75배까지 줄이고, 그래도 넘치면 말줄임 (검수 e8c97af-3: 폰에서 두 줄로 넘쳐 위치 배너를 침범) */
function fitTxt(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, maxW: number) {
  let n = size;
  const font = (z: number) => `700 ${z}px "Galmuri11", "DungGeunMo", system-ui, sans-serif`;
  c.font = font(n);
  while (c.measureText(s).width > maxW && n > size * 0.75) c.font = font(--n);
  let t = s;
  while (t.length > 2 && c.measureText(t).width > maxW) t = t.slice(0, -2) + '…';
  txt(c, t, x, y, n, color);
}

/** 표식 하나 (도트 아이콘) */
type Glyph = { kind: 'service' | 'up' | 'gate' | 'side' | 'secret' | 'elevator' | 'boss' | 'start' | 'key'; state: string };
function glyph(c: CanvasRenderingContext2D, m: Glyph, x: number, y: number, s: number) {
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
    case 'key': // 열쇠 (머리 + 몸통 + 이)
      R(-4, -3, 4, 4, C.key);
      R(-3, -2, 2, 2, '#000');
      R(0, -2, 5, 2, C.key);
      R(3, 0, 1, 2, C.key);
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

const LOCK_COL = { locked: C.gateLocked, key: C.key, open: C.gateOpen };
const STEP_D: Record<MapDir, [number, number]> = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] };

/** 방 격자 그리기. (c0,r0)부터 cols×rows 칸을 (x,y)에 cw×ch 크기로. 밖은 잘린다 */
function drawRooms(c: CanvasRenderingContext2D, m: RunMap, wd: MapWorld, x: number, y: number, cw: number, ch: number, gap: number, c0: number, r0: number, px: number, t: number, U: number) {
  const at = (rm: MapRoom): [number, number] => [x + (rm.col - c0) * (cw + gap), y + (rm.row - r0) * (ch + gap)];
  const here = m.where === 'floor' && m.depth === wd.depth && m.room;
  const gs = Math.max(1, Math.min(cw / 34, ch / 18, 2.4 * U));
  // 연결 먼저 (방 사이 틈)
  for (const rm of wd.rooms) {
    if (!rm.seen) continue;
    const [rx, ry] = at(rm);
    for (const d of ['l', 'r', 'u', 'd'] as MapDir[]) {
      if (!rm.open[d] && !rm.broken[d]) continue;
      const lk = rm.lock[d];
      c.fillStyle = rm.broken[d] ? '#d9a6ff' : lk ? LOCK_COL[lk.state] : C.seen;
      const th = Math.max(3, Math.round(gap * 0.6));
      if (rm.wrap[d]) {
        // 끝없는 복도: 바깥으로 화살표
        const ax = d === 'r' ? rx + cw + 2 : rx - 2;
        c.fillRect(d === 'r' ? ax : ax - gap, ry + ch / 2 - th / 2, gap, th);
        c.fillRect(d === 'r' ? ax + gap - 2 : ax - gap - 2, ry + ch / 2 - th, 4, th * 2);
        continue;
      }
      if (d === 'l') c.fillRect(rx - gap, ry + ch / 2 - th / 2, gap, th);
      if (d === 'r') c.fillRect(rx + cw, ry + ch / 2 - th / 2, gap, th);
      if (d === 'u') c.fillRect(rx + cw / 2 - th / 2, ry - gap, th, gap);
      if (d === 'd') c.fillRect(rx + cw / 2 - th / 2, ry + ch, th, gap);
      if (lk && lk.state !== 'open' && gap >= 10) {
        const [dx, dy] = STEP_D[d];
        txt(c, '①②③④'[lk.n - 1] ?? '', rx + cw / 2 + dx * (cw / 2 + gap / 2) + (dy ? th + 4 : -6), ry + ch / 2 + dy * (ch / 2 + gap / 2) + (dx ? -th - 2 : 5), Math.round(11 * U), LOCK_COL[lk.state]);
      }
    }
  }
  for (const rm of wd.rooms) {
    const [rx, ry] = at(rm);
    const cur = here && here[0] === rm.col && here[1] === rm.row;
    c.fillStyle = rm.seen ? (cur ? '#56636d' : '#3a454e') : '#161a1f';
    c.fillRect(rx, ry, cw, ch);
    c.lineWidth = cur ? 3 : 2;
    c.strokeStyle = cur ? '#ffd76a' : rm.seen ? '#000' : '#3a454e';
    if (!rm.seen) c.setLineDash([4, 3]);
    c.strokeRect(rx, ry, cw, ch);
    c.setLineDash([]);
    if (!rm.seen) {
      if (ch >= 16) txt(c, '?', rx + cw / 2, ry + ch / 2 + 5 * gs, Math.round(8 * gs), '#4b5660', 'center');
      continue;
    }
    // 표식: 방 위쪽 가운데에 나란히
    const icons: Glyph[] = [];
    if (rm.role === 'arrival') icons.push({ kind: 'start', state: '' });
    if (rm.panel) icons.push({ kind: 'elevator', state: '' });
    if (rm.guardian) icons.push({ kind: 'boss', state: '' });
    if (rm.reward) icons.push({ kind: rm.role === 'secret' ? 'secret' : 'side', state: rm.reward === 'done' ? 'done' : '' });
    if (rm.key) icons.push({ kind: 'key', state: '' });
    const step = 12 * gs;
    icons.forEach((g, i) => glyph(c, g, rx + cw / 2 + (i - (icons.length - 1) / 2) * step, ry + ch * (cw >= 90 && ch >= 44 ? 0.38 : 0.5), gs));
    if (cw >= 90 && ch >= 44) {
      c.save();
      c.beginPath();
      c.rect(rx + 2, ry, cw - 4, ch);
      c.clip();
      txt(c, rm.name, rx + cw / 2, ry + ch - 7, Math.round(Math.min(12 * U, ch / 3.6)), C.sub, 'center');
      c.restore();
    }
    // 아직 정리 안 된 방: 오른쪽 위 붉은 점
    if (!rm.clear && rm.role !== 'secret') (c.fillStyle = C.gateLocked), c.fillRect(rx + cw - 4 - 3 * gs, ry + 4, 3 * gs, 3 * gs);
    if (cur) hereDot(c, rx + 6 + Math.max(0, Math.min(1, px / Math.max(1, m.roomW))) * (cw - 12), ry + ch * 0.72, t);
  }
}

/** 정비 구역 칸 격자 */
function drawService(c: CanvasRenderingContext2D, m: RunMap, s: MapService, gx: number, gy: number, cw: number, ch: number, gap: number, px: number, t: number) {
  for (const cell of s.cells) {
    if (!cell.seen && !cell.key && cell.kind !== 'attic') continue;
    const cx = gx + cell.col * (cw + gap),
      cy = gy + cell.row * (ch + gap);
    c.fillStyle = cell.seen ? C.svcSeen : '#3a2e1c';
    c.fillRect(cx, cy, cw, ch);
    c.strokeStyle = '#000';
    c.lineWidth = 2;
    c.strokeRect(cx, cy, cw, ch);
    c.fillStyle = C.svcSeen;
    if (cell.seen) {
      if (cell.open.r) c.fillRect(cx + cw, cy + ch / 2 - 2, gap, 4);
      if (cell.open.d) c.fillRect(cx + cw / 2 - 2, cy + ch, 4, gap);
    }
    if (cell.kind === 'attic') (c.fillStyle = '#fff3a0'), c.fillRect(cx + cw / 2 - 1, cy + 3, 3, Math.max(2, ch - 6)), c.fillRect(cx + cw / 2 - 5, cy + ch / 2 - 1, 11, 3);
    if (cell.kind === 'down' && ch >= 14) glyph(c, { kind: 'service', state: '' }, cx + cw / 2, cy + ch / 2, Math.min(2, ch / 10));
    if (cell.key) (c.fillStyle = C.key), c.fillRect(cx + 4, cy + 3, 8, Math.max(2, ch - 6));
    if (m.where === 'service' && m.depth === s.depth && m.cell && m.cell[0] === cell.col && m.cell[1] === cell.row) hereDot(c, cx + 6 + (px / 1280) * (cw - 12), cy + ch / 2, t);
  }
}

/** 전체 지도. px = 지금 방에서 요원 x
 * U = 글자·표식 배율 (폰에서 화면이 작게 줄어드니 크게, 검수 e8c97af-4) */
export function drawRunMap(c: CanvasRenderingContext2D, m: RunMap, px: number, t: number, U = 1, W = 1280, H = 720) {
  c.save();
  c.fillStyle = C.bg;
  c.fillRect(0, 0, W, H);
  c.strokeStyle = C.frame;
  c.lineWidth = 4;
  c.strokeRect(24, 20, W - 48, H - 40);
  txt(c, '출동 지도', 48, 40 + 20 * U, 26 * U, C.text);
  txt(c, `열쇠 ${m.keys.length ? m.keys.join(' ') : '없음'}  ·  강화 ${m.upgrades.length}`, W - 48, 40 + 20 * U, 16 * U, C.sub, 'right');
  fitTxt(c, m.goal, 48, 52 + 38 * U, 17 * U, '#ffd76a', W - 96);

  const top = Math.round(78 + 58 * U);
  const legendH = U > 1.3 ? 84 : 46;
  const bottom = H - legendH - 12;
  // 왼쪽: 깊이 목록 (내려온 층들). 지금 깊이 강조
  const listW = Math.round(150 * U);
  const lh = Math.round(22 * U);
  const shown = m.worlds.slice(-Math.max(1, Math.floor((bottom - top) / lh)));
  shown.forEach((wd, i) => {
    const cur = wd.depth === m.depth;
    fitTxt(c, `${cur ? '▶ ' : '  '}${wd.label}`, 48, top + 14 * U + i * lh, 14 * U, cur ? '#fff' : C.sub, listW - 10);
  });
  const ax = 48 + listW + 16,
    aw = W - 60 - ax,
    ah = bottom - top;
  if (m.where === 'service') {
    const s = m.services.find((q) => q.depth === m.depth);
    if (s) {
      const gap = 8;
      const cw = Math.min(120 * U, Math.floor((aw - (s.cols - 1) * gap) / s.cols)),
        ch = Math.min(60 * U, Math.floor((ah - 30 * U - (s.rows - 1) * gap) / s.rows));
      const gx = ax + (aw - (s.cols * (cw + gap) - gap)) / 2;
      txt(c, `정비 구역 · 층과 층 사이 틈`, gx, top + 16 * U, 16 * U, C.svcSeen);
      drawService(c, m, s, gx, top + 30 * U, cw, ch, gap, px, t);
    }
  } else {
    const wd = m.worlds.find((q) => q.depth === m.depth);
    if (wd) {
      const gap = Math.round(14 * U);
      const cw = Math.min(170 * U, Math.floor((aw - (wd.cols - 1) * gap) / wd.cols)),
        ch = Math.min(Math.round(cw * 0.56), Math.floor((ah - (wd.rows - 1) * gap) / wd.rows));
      const gw = wd.cols * (cw + gap) - gap,
        gh = wd.rows * (ch + gap) - gap;
      drawRooms(c, m, wd, ax + (aw - gw) / 2, top + (ah - gh) / 2, cw, ch, gap, 0, 0, px, t, U);
    }
  }
  // 범례
  let ly = H - (U > 1.3 ? 72 : 40);
  let lx = 48;
  const legend: [Glyph | string, string][] = [
    [{ kind: 'start', state: '' }, '도착한 방'],
    [{ kind: 'elevator', state: '' }, '승강기 패널'],
    [{ kind: 'key', state: '' }, '열쇠'],
    [C.gateLocked, '잠긴 길'],
    [C.gateOpen, '연 길'],
    [{ kind: 'side', state: '' }, '보상 배낭'],
    [{ kind: 'secret', state: '' }, '숨은 방'],
    [{ kind: 'boss', state: '' }, '수호자'],
    ['#e0503c', '안 정리된 방 (점)'],
  ];
  const ls = Math.round(13 * U);
  for (const [g, s] of legend) {
    c.font = `700 ${ls}px "Galmuri11", "DungGeunMo", system-ui, sans-serif`;
    const iw = 30 * U + c.measureText(s).width;
    if (lx + iw > W - 48) (lx = 48), (ly += ls + 14);
    if (typeof g === 'string') (c.fillStyle = g), c.fillRect(lx, ly - 7 * U, 16 * U, 5 * U);
    else glyph(c, g, lx + 8 * U, ly - 4 * U, 2 * U);
    txt(c, s, lx + 22 * U, ly + 2, ls, C.sub);
    lx += iw + 22;
  }
  txt(c, 'Z · Tab · M 닫기', W - 48, 40 + 20 * U + 22 * U, 12 * U, C.sub, 'right');
  c.restore();
}

/** 미니맵 (화면 위, 아이템 칸과 깊이 표시 사이). 층이면 지금 방 둘레 5×3 칸, 정비 구역이면 칸 격자.
 * 승강기 안에서는 그리지 않는다: 위치 태그와 같은 말이 겹쳤다 (검수 e8c97af-3). 폰(U>1.3)은 아이템 칸이 옆 단추로 빠지므로 가운데에 크게 */
export function drawMiniMap(c: CanvasRenderingContext2D, m: RunMap, px: number, t: number, U = 1) {
  if (m.where !== 'floor' && m.where !== 'service') return;
  const phone = U > 1.3;
  const x = phone ? 300 : 740,
    y = phone ? 8 : 16,
    w = phone ? 560 : 400,
    h = phone ? 124 : 72;
  const fs = phone ? 22 : 12;
  c.save();
  c.fillStyle = 'rgba(10,12,16,0.82)';
  c.fillRect(x, y, w, h);
  c.strokeStyle = 'rgba(200,162,74,0.85)';
  c.lineWidth = 2;
  c.strokeRect(x, y, w, h);
  fitTxt(c, m.goal, x + 8, y + fs + 4, fs, '#ffd76a', w - 16);
  const top = y + fs + 10;
  c.beginPath();
  c.rect(x + 3, top - 2, w - 6, y + h - top);
  c.clip();
  if (m.where === 'floor') {
    const wd = m.worlds.find((q) => q.depth === m.depth);
    if (wd && m.room) {
      const cols = 5,
        rows = 3,
        gap = phone ? 8 : 5;
      const ch = Math.floor((y + h - top - 4 - (rows - 1) * gap) / rows),
        cw = Math.min(Math.floor((w - 16 - (cols - 1) * gap) / cols), ch * 3);
      const gw = cols * (cw + gap) - gap;
      drawRooms(c, m, wd, x + (w - gw) / 2, top, cw, ch, gap, m.room[0] - 2, m.room[1] - 1, px, t, phone ? 1.4 : 0.8);
    }
  } else {
    const s = m.services.find((q) => q.depth === m.depth);
    if (s) {
      const gap = 2,
        ch = Math.max(3, Math.min(phone ? 18 : 10, Math.floor((y + h - top - 4) / Math.max(1, s.rows)) - gap)),
        cw = Math.min(phone ? 44 : 26, Math.floor((w - 20) / s.cols) - gap);
      const gx = x + w - 10 - s.cols * (cw + gap);
      txt(c, '정비 구역', gx - 10, top + ch + 4, phone ? 18 : 11, C.svcSeen, 'right');
      drawService(c, m, s, gx, top, cw, ch, gap, px, t);
    }
  }
  c.restore();
}
