// 출동 지도 (기본기획서 6.2 「지도(Tab/M): 가 본 방, 본 문, 휴식방, 목표 방향. 미니맵은 화면 구석. 코드로 그린다」).
// 현재 깊이의 방 격자와 정비 구역. 상태를 변경하거나 경로를 생성하지 않는다.
import { mapViewport, setExplorationMap } from '../ui/mapLayout';
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
  /** 선택 연결: 통합 담당이 실제 점검문·패널 상태를 제공한다. */
  service?: boolean;
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
  panelReady?: boolean;
  seed: number;
}

const C = { bg: '#0c141e', text: '#ecf3fa', sub: '#b4c5d5', here: '#ffe18a', seen: '#64859e', clear: '#73dcad', locked: '#ff8582', key: '#ffe18a', panel: '#8ad7ff', service: '#e3b7ff' };
const DIRS: MapDir[] = ['u', 'r', 'd', 'l'];
const STEP: Record<MapDir, [number, number]> = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] };
const ARROW: Record<MapDir, string> = { l: '←', r: '→', u: '↑', d: '↓' };
const NUMBER = (n: number) => '①②③④'[n - 1] ?? String(n);
const LOCK_COLOR = { locked: C.locked, key: C.key, open: C.clear };

function text(c: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string = C.text, align: CanvasTextAlign = 'left') {
  c.font = `600 ${size}px "Pretendard", "Noto Sans KR", system-ui, sans-serif`;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillStyle = color;
  c.fillText(value, x, y);
}
function fit(c: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, width: number, color: string = C.text) {
  c.font = `600 ${size}px "Pretendard", "Noto Sans KR", system-ui, sans-serif`;
  let s = value;
  while (s.length && c.measureText(s).width > width) s = s.slice(0, -1);
  if (s !== value) s = s.slice(0, -1) + '…';
  text(c, s, x, y, size, color);
}
function lines(c: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, width: number) {
  c.font = `600 ${size}px "Pretendard", "Noto Sans KR", system-ui, sans-serif`;
  let line = '', row = 0;
  for (const char of value) {
    if (line && c.measureText(line + char).width > width) {
      text(c, line, x, y + row++ * size * 1.5, size, C.here);
      line = '';
    }
    line += char;
  }
  if (line) text(c, line, x, y + row++ * size * 1.5, size, C.here);
  return row * size * 1.5;
}
function frame(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.fillStyle = C.bg;
  c.fillRect(x, y, w, h);
  c.strokeStyle = '#3b536a';
  c.lineWidth = 2;
  c.strokeRect(x, y, w, h);
}
function check(c: CanvasRenderingContext2D, x: number, y: number, size: number, color = C.clear) {
  c.strokeStyle = color;
  c.lineWidth = Math.max(2, size / 5);
  c.beginPath(); c.moveTo(x - size / 2, y); c.lineTo(x - size / 8, y + size / 3); c.lineTo(x + size / 2, y - size / 3); c.stroke();
}
function marker(c: CanvasRenderingContext2D, x: number, y: number, size: number) {
  c.fillStyle = C.here;
  c.beginPath(); c.moveTo(x, y - size / 2); c.lineTo(x + size / 2, y); c.lineTo(x, y + size / 2); c.lineTo(x - size / 2, y); c.closePath(); c.fill();
}
function roomSymbols(r: MapRoom) {
  return [r.key ? `K${NUMBER(r.key)}` : '', r.panel ? 'P' : '', r.service ? 'S' : '', r.reward === 'full' ? '+' : r.reward === 'done' ? '−' : '', r.guardian ? '!' : '', r.role === 'secret' ? '◇' : '', r.role === 'arrival' ? '入' : ''].filter(Boolean).join(' ');
}
export function mapExits(m: RunMap): string {
  const r = m.worlds.find(w => w.depth === m.depth)?.rooms.find(r => r.col === m.room?.[0] && r.row === m.room?.[1]);
  if (m.where !== 'floor' || !r) return m.where === 'service' ? '사다리·덕트 앞에서 조사 · 낮은 통로는 앉아서 이동' : '승강기 버튼을 조사해 다음 층 선택';
  return DIRS.filter(d => r.open[d] || r.broken[d]).map(d => {
    const lock = r.lock[d];
    return `${ARROW[d]} ${lock ? `${NUMBER(lock.n)} ${lock.state === 'locked' ? '잠김' : lock.state === 'key' ? '해제 가능' : '열림'}` : r.broken[d] ? '숨은 길' : '연결'}${r.wrap[d] ? ' ↔ 순환' : ''}`;
  }).join('   ');
}

/** Links draw once so a reverse endpoint cannot erase the lock number. */
function rooms(c: CanvasRenderingContext2D, m: RunMap, w: MapWorld, x: number, y: number, cw: number, ch: number, gap: number, scale: number, c0 = 0, r0 = 0, mini = false) {
  const at = (r: MapRoom) => [x + (r.col - c0) * (cw + gap), y + (r.row - r0) * (ch + gap)];
  const drawn = new Set<string>();
  for (const r of w.rooms.filter(r => r.seen)) {
    const [rx, ry] = at(r);
    for (const d of DIRS) {
      if (!r.open[d] && !r.broken[d]) continue;
      const [dx, dy] = STEP[d];
      const a = `${r.col},${r.row}`, b = `${r.col + dx},${r.row + dy}`;
      const id = [a, b].sort().join(':');
      if (drawn.has(id)) continue;
      drawn.add(id);
      const lock = r.lock[d];
      const color = lock ? LOCK_COLOR[lock.state] : r.broken[d] ? C.service : C.seen;
      const sx = rx + cw / 2 + dx * cw / 2, sy = ry + ch / 2 + dy * ch / 2;
      c.strokeStyle = color; c.lineWidth = Math.max(3, 2 * scale);
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + dx * gap, sy + dy * gap); c.stroke();
      if (lock && lock.state !== 'open') {
        const mx = sx + dx * gap / 2, my = sy + dy * gap / 2;
        c.fillStyle = C.bg; c.fillRect(mx - 7 * scale, my - 7 * scale, 14 * scale, 14 * scale);
        text(c, NUMBER(lock.n), mx, my, 14 * scale, color, 'center');
      } else if (lock) check(c, sx + dx * gap / 2, sy + dy * gap / 2, 8 * scale);
      else if (r.wrap[d]) text(c, ARROW[d], sx + dx * gap / 2, sy, 15 * scale, C.sub, 'center');
    }
  }
  for (const r of w.rooms) {
    const [rx, ry] = at(r);
    const current = m.where === 'floor' && w.depth === m.depth && r.col === m.room?.[0] && r.row === m.room?.[1];
    c.fillStyle = r.seen ? r.clear ? '#193c37' : '#273d51' : '#111e2b';
    c.fillRect(rx, ry, cw, ch);
    c.strokeStyle = current ? C.here : r.seen ? r.clear ? C.clear : C.seen : '#8296a8';
    c.lineWidth = current ? 3 * scale : 1.5 * scale;
    c.setLineDash(r.seen ? [] : [5 * scale, 3 * scale]); c.strokeRect(rx, ry, cw, ch); c.setLineDash([]);
    if (!r.seen) { text(c, '?', rx + cw / 2, ry + ch / 2, 16 * scale, C.sub, 'center'); continue; }
    const statusSize = Math.min(8 * scale, ch / 4);
    if (r.clear) check(c, rx + cw - statusSize, ry + statusSize * .65, statusSize);
    else if (r.role !== 'secret') text(c, '·', rx + cw - statusSize, ry + statusSize * .65, 18 * scale, C.locked, 'center');
    if (mini) {
      if (current) marker(c, rx + cw / 2, ry + ch / 2, Math.min(ch * .5, 14 * scale));
      continue;
    }
    // Leave the status corner and current-position diamond clear of room contents.
    const named = ch >= 44 * scale && cw >= 95 * scale;
    fit(c, roomSymbols(r), rx + 5, ry + ch * (named ? .4 : .65), 13 * scale, cw - 10, r.panel ? C.panel : C.here);
    if (named) fit(c, r.name, rx + 20 * scale, ry + ch - 13 * scale, 12 * scale, cw - 24 * scale, C.sub);
    if (current) marker(c, rx + 9 * scale, ry + ch - 9 * scale, 9 * scale);
  }
}

function service(c: CanvasRenderingContext2D, m: RunMap, s: MapService, x: number, y: number, cw: number, ch: number, gap: number, scale: number, c0 = 0, r0 = 0, mini = false) {
  const known = new Set(s.cells.filter(q => q.seen || q.key || q.kind === 'attic').map(q => `${q.col},${q.row}`));
  for (const q of s.cells.filter(q => q.seen)) for (const d of DIRS) {
    if (!q.open[d]) continue;
    const [dx, dy] = STEP[d]; known.add(`${q.col + dx},${q.row + dy}`);
    const x0 = x + (q.col - c0) * (cw + gap) + cw / 2, y0 = y + (q.row - r0) * (ch + gap) + ch / 2;
    c.strokeStyle = C.service; c.lineWidth = 3 * scale; c.beginPath();
    c.moveTo(x0, y0); c.lineTo(x0 + dx * (cw / 2 + gap), y0 + dy * (ch / 2 + gap)); c.stroke();
  }
  for (const q of s.cells) {
    if (!known.has(`${q.col},${q.row}`)) continue;
    const rx = x + (q.col - c0) * (cw + gap), ry = y + (q.row - r0) * (ch + gap);
    const current = q.col === m.cell?.[0] && q.row === m.cell?.[1];
    c.fillStyle = q.seen ? '#39304d' : '#191c2b'; c.fillRect(rx, ry, cw, ch);
    c.strokeStyle = current ? C.here : C.service; c.lineWidth = (current ? 3 : 1) * scale;
    c.setLineDash(q.seen ? [] : [5, 4]); c.strokeRect(rx, ry, cw, ch); c.setLineDash([]);
    const symbol = !q.seen && q.kind !== 'attic' && !q.key ? '?' : q.kind === 'attic' ? 'R' : q.key ? 'K' : q.kind === 'down' ? (m.panelReady === false ? '×' : '↓') : q.kind === 'entry' ? '↑' : '';
    text(c, symbol, rx + cw / 2, ry + ch / 2, (mini ? 12 : 16) * scale, C.text, 'center');
    if (current) marker(c, rx + 8 * scale, ry + ch - 8 * scale, 9 * scale);
  }
}

/** Whole map uses measured canvas dimensions, including wide landscape displays. */
export function drawRunMap(c: CanvasRenderingContext2D, m: RunMap, _px: number, _t: number, U = 1, W = c.canvas.width, H = c.canvas.height) {
  setExplorationMap(c.canvas, true);
  const v = mapViewport(c.canvas, U, W, H), S = v.scale, left = v.margin, right = W - left;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = C.bg; c.fillRect(0, 0, W, H);
  const world = m.worlds.find(w => w.depth === m.depth);
  const here = world?.rooms.find(r => r.col === m.room?.[0] && r.row === m.room?.[1]);
  fit(c, `출동 지도 · ${world?.label ?? `깊이 ${m.depth}`}`, left, 35 * S, 21 * S, right - left - 190 * S);
  text(c, v.touch ? '「지도」로 닫기' : 'Z / Tab / M 닫기', right, 35 * S, 13 * S, C.sub, 'right');
  text(c, `보유 열쇠 ${m.keys.join(' ') || '없음'}   ·   강화 ${m.upgrades.length}`, left, 65 * S, 14 * S, C.key);
  const goal = m.goal.replaceAll('(★)', ' R').replaceAll('(▮)', ' P');
  const goalHeight = lines(c, goal, left, 94 * S, 14 * S, right - left);
  const top = 94 * S + goalHeight + 20 * S, bottom = H - 48 * S;
  const sideW = 240 * S, mapRight = right - sideW - 24 * S;
  const mapW = mapRight - left, mapH = bottom - top - 28 * S;
  fit(c, m.where === 'service' ? '정비 구역 · R 다락방 / 귀환 로프' : `◆ 현재 ${here?.name ?? (m.where === 'car' ? '승강기 안' : '이동 중')}`, left, top - 3 * S, 14 * S, mapW, C.here);
  const sx = mapRight + 24 * S;
  const legend = m.where === 'service' ? [
    ['◆', '현재 칸', C.here], ['?', '점선 · 미탐색', C.sub], ['R', '다락방 · 휴식 / 귀환 로프', C.service], ['↑', '위층 점검문', C.sub], [m.panelReady === false ? '×' : '↓', `아래 점검문 · ${m.panelReady === undefined ? '목표 확인' : m.panelReady ? '하강 가능' : '층 정리 전 잠김'}`, C.sub], ['K', '열쇠', C.key], ['─', '발견한 연결', C.service],
  ] : [
    ['◆', '현재 방 · 노란 테두리', C.here], ['?', '점선 · 미탐색 방', C.sub], ['✓ / ·', '정리 완료 / 미정리', C.clear], ['①', '잠김 · 같은 번호 열쇠 필요', C.locked], ['①', '열쇠 보유 · 문에서 조사', C.key], ['✓', '초록 연결 · 열린 길', C.clear], ['K / P', '열쇠 / 승강기 패널', C.panel], ['+ / −', '보상 남음 / 수령 완료', C.here], ['S / 入', '정비 입구 / 도착 방', C.service], ['! / ◇', '수호자 / 숨은 방(선택)', C.sub],
  ];
  legend.forEach(([mark, label, color], i) => {
    text(c, mark, sx, top + i * 19 * S, 14 * S, color);
    text(c, label, sx + 47 * S, top + i * 19 * S, 12.5 * S, C.sub);
  });
  const hintY = top + legend.length * 19 * S + 8 * S;
  if (m.where === 'floor') {
    const panel = m.panelReady === undefined ? '패널: 위 목표 안내 확인' : m.panelReady ? '패널 켜짐 · 조사해서 하강' : '패널 꺼짐 · 층 목표 해결';
    text(c, panel, sx, hintY, 13 * S, C.panel);
    text(c, '귀환: 점검문 → 정비 → R 로프', sx, hintY + 23 * S, 12.5 * S, C.service);
  } else if (m.where === 'service') {
    text(c, 'R 로프 조사 → 안전 귀환', sx, hintY, 13 * S, C.service);
    text(c, '메뉴의 긴급 철수는 보상 감소', sx, hintY + 23 * S, 12.5 * S, C.sub);
  }
  const zone = m.where === 'service' ? m.services.find(s => s.depth === m.depth) : world;
  if (zone && mapW > 0 && mapH > 0) {
    const gap = 12 * S;
    const cw = Math.min(150 * S, (mapW - gap * (zone.cols - 1)) / zone.cols);
    const ch = Math.min(68 * S, (mapH - gap * (zone.rows - 1)) / zone.rows);
    const gx = left + (mapW - (cw + gap) * zone.cols + gap) / 2, gy = top + 24 * S + (mapH - (ch + gap) * zone.rows + gap) / 2;
    c.save(); c.beginPath(); c.rect(left - 6, top + 18 * S, mapW + 12, mapH + 12); c.clip();
    if (m.where === 'service') service(c, m, zone as MapService, gx, gy, cw, ch, gap, S);
    else rooms(c, m, zone as MapWorld, gx, gy, cw, ch, gap, S);
    c.restore();
  }
  fit(c, mapExits(m), left, H - 23 * S, 13 * S, right - left, C.sub);
  c.restore();
}

/** Three-by-three local map with a separate, readable action summary. */
export function drawMiniMap(c: CanvasRenderingContext2D, m: RunMap, _px: number, _t: number, U = 1) {
  setExplorationMap(c.canvas, false);
  if (m.where !== 'floor' && m.where !== 'service') return;
  const v = mapViewport(c.canvas, U), S = v.scale;
  const x = v.touch ? 560 : 740, y = 12, width = v.width - x - (v.touch ? 155 : 130);
  const h = 100 * S;
  if (width < 230) return;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); frame(c, x, y, width, h);
  const mapW = Math.min(width * .42, 150 * S), tx = x + 10 * S, tw = width - mapW - 24 * S;
  text(c, m.where === 'service' ? '정비 · R 로프 귀환' : `열쇠 ${m.keys.join(' ') || '없음'}`, tx, y + 16 * S, 13 * S, C.key);
  const shortGoal = m.where === 'service' ? '다락방을 찾아 조사' : m.goal.startsWith('층 정리 끝') ? '패널로 하강 / 로프로 귀환' : m.goal.includes('노랗게') ? '노란 잠금 앞에서 조사' : m.goal.includes('잠긴 길') ? '열린 방에서 열쇠 찾기' : m.goal.match(/남은 방 \d+/)?.[0] ? `${m.goal.match(/남은 방 \d+/)![0]} · 목표 해결` : '방의 목표를 확인';
  fit(c, shortGoal, tx, y + 44 * S, 14 * S, tw, C.text);
  fit(c, v.touch ? '「지도」 전체 / 범례' : 'Z · Tab · M 전체 지도', tx, y + 77 * S, 12.5 * S, tw, C.sub);
  const gap = 5 * S, cw = (mapW - 2 * gap - 16) / 3, ch = (h - 20 - 2 * gap) / 3;
  const gx = x + width - mapW + 4, gy = y + 10;
  c.save(); c.beginPath(); c.rect(gx - 3, gy - 3, mapW - 2, h - 14); c.clip();
  if (m.where === 'floor' && m.room) {
    const w = m.worlds.find(w => w.depth === m.depth);
    if (w) rooms(c, m, w, gx, gy, cw, ch, gap, S, m.room[0] - 1, m.room[1] - 1, true);
  } else if (m.cell) {
    const s = m.services.find(s => s.depth === m.depth);
    if (s) service(c, m, s, gx, gy, cw, ch, gap, S, m.cell[0] - 1, m.cell[1] - 1, true);
  }
  c.restore(); c.restore();
}
