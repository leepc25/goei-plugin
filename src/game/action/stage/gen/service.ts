// 정비 구역 (스테이지 설계서 4장): 층과 층 사이의 세로 미로.
// - 칸 격자(가로 2~3 × 세로 3~5)를 무작위 깊이 우선으로 이은 나무 + 고리 1~2개.
// - 칸 하나 = 정비 구역 조각 2개(화면 하나). 가로 이웃은 칸 끝 통로(덕트면 앉아서), 세로 이웃은 사다리(지지대).
// - 다락방(휴식·송신·거래·귀환 로프)·입구·아래 점검문 위치는 고정, 나갔다 들어오면 나머지가 다시 짜인다(reroll).
import { CHUNK_BY_ID, SERVICE_CHUNKS, flipTerrain } from '../data/chunks';
import { mix, pick, range, rng, shuffle } from '../rng';
import { CHUNK_W, LANE_DEPTH, ROOM_W, type ServiceCell, type ServiceThing, type ServiceZone, type Terrain } from '../types';

let tid = 1;
const thing = (kind: ServiceThing['kind'], x: number, lane: number, label: string, data: ServiceThing['data'] = {}): ServiceThing => ({ id: tid++, kind, x, lane, label, data });

export interface ServiceContext {
  seed: number;
  /** 위층 깊이 */
  depth: number;
  reroll: number;
  flags: string[];
  epoch: number;
}

export function makeService(ctx: ServiceContext): ServiceZone {
  tid = 1;
  // 고정 부분: 크기·입구·다락방·아래 점검문은 reroll과 무관
  const fixed = rng(mix(ctx.seed, ctx.depth, 6060));
  const cols = ctx.depth <= 3 ? 2 : range(fixed, 2, 3);
  const rows = Math.min(5, 3 + Math.floor(Math.max(0, ctx.depth - 3) / 4));
  const entryCell: [number, number] = [Math.floor(fixed() * cols), 0];
  let atticCell: [number, number] = [Math.floor(fixed() * cols), 1 + Math.floor(fixed() * (rows - 1))];
  if (atticCell[0] === entryCell[0] && atticCell[1] === 1 && rows > 2) atticCell = [atticCell[0], 2];
  let downCell: [number, number] = [Math.floor(fixed() * cols), rows - 1];
  if (downCell[0] === atticCell[0] && downCell[1] === atticCell[1]) downCell = [(downCell[0] + 1) % cols, rows - 1];

  const r = rng(mix(ctx.seed, ctx.depth, ctx.reroll, 7070));
  const idx = (c: number, rw: number) => rw * cols + c;
  const cells: ServiceCell[] = [];
  for (let rw = 0; rw < rows; rw++)
    for (let c = 0; c < cols; c++)
      cells.push({ col: c, row: rw, kind: 'plain', open: { u: false, r: false, d: false, l: false }, duct: { r: false, l: false }, width: ROOM_W, segments: [], things: [], label: '' });
  // 미로: 무작위 깊이 우선
  const seen = new Set<number>([idx(...entryCell)]);
  const stack: [number, number][] = [entryCell];
  const link = (a: [number, number], b: [number, number], duct = false) => {
    const A = cells[idx(...a)],
      B = cells[idx(...b)];
    if (b[0] > a[0]) (A.open.r = B.open.l = true), (A.duct.r = B.duct.l = duct);
    else if (b[0] < a[0]) (A.open.l = B.open.r = true), (A.duct.l = B.duct.r = duct);
    else if (b[1] > a[1]) A.open.d = B.open.u = true;
    else A.open.u = B.open.d = true;
  };
  while (stack.length) {
    const [c, rw] = stack[stack.length - 1];
    const nb = shuffle(r, [
      [c + 1, rw],
      [c - 1, rw],
      [c, rw + 1],
      [c, rw - 1],
    ] as [number, number][]).filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows && !seen.has(idx(x, y)));
    if (!nb.length) {
      stack.pop();
      continue;
    }
    const n = nb[0];
    seen.add(idx(...n));
    link([c, rw], n, n[1] === rw && r() < 0.4);
    stack.push(n);
  }
  // 고리 1~2개 (되돌아가기·지름길)
  for (let k = 0; k < 1 + Math.floor(r() * 2); k++) {
    const c = Math.floor(r() * cols),
      rw = Math.floor(r() * rows);
    if (c + 1 < cols && r() < 0.5) link([c, rw], [c + 1, rw], r() < 0.4);
    else if (rw + 1 < rows) link([c, rw], [c, rw + 1]);
  }

  // 칸 채우기
  const shaftCands = cells.filter((x) => !(x.col === atticCell[0] && x.row === atticCell[1]) && !(x.col === downCell[0] && x.row === downCell[1]) && !(x.col === entryCell[0] && x.row === entryCell[1]));
  const shaft = ctx.depth >= 4 && r() < 0.6 && shaftCands.length ? pick(r, shaftCands) : null;
  for (const cell of cells) {
    const at = (a: [number, number]) => cell.col === a[0] && cell.row === a[1];
    cell.kind = at(atticCell) ? 'attic' : at(entryCell) ? 'entry' : at(downCell) ? 'down' : cell === shaft ? 'shaft' : pick(r, ['duct', 'support', 'slope', 'plain'] as const);
    const terrain: Terrain[] = [];
    const segs = [] as ServiceCell['segments'];
    if (cell.kind === 'attic') {
      segs.push({ ref: 'room:attic', x: 0, w: ROOM_W, flip: false, terrain: [] });
    } else {
      for (let k = 0; k < 2; k++) {
        const kindPool = cell.kind === 'duct' ? ['v_duct', 'v_duct2', 'v_plain'] : cell.kind === 'support' ? ['v_support', 'v_plain'] : cell.kind === 'slope' ? ['v_slope', 'v_plain'] : cell.kind === 'shaft' ? ['v_gapline', 'v_plain'] : ['v_plain', 'v_gapline', 'v_support'];
        const t = CHUNK_BY_ID[pick(r, kindPool)] ?? SERVICE_CHUNKS[0];
        const flip = r() < 0.5;
        const tr = t.terrain.map((x) => (flip ? flipTerrain(x) : x)).map((x) => ({ ...x, x0: x.x0 + k * CHUNK_W, x1: x.x1 + k * CHUNK_W }) as Terrain);
        segs.push({ ref: `chunk:${t.id}`, x: k * CHUNK_W, w: CHUNK_W, flip, terrain: tr });
        terrain.push(...tr);
        if (r() < 0.45) cell.things.push(thing('item', k * CHUNK_W + 200 + Math.floor(r() * 240), 40 + Math.floor(r() * 80), '버려진 보급품', { item: pick(r, ['heal', 'light', 'ammo', 'guard']) }));
      }
    }
    // 덕트 통로: 칸 끝 120px은 천장이 낮다 (앉아서)
    // (앉은 채로는 점프 못 하므로 덕트 입구 근처의 단·구덩이는 치운다)
    if (cell.duct.l) (segs[0].terrain = segs[0].terrain.filter((t) => t.kind === 'low' || t.x0 > 320)), segs[0].terrain.push({ kind: 'low', x0: 0, x1: 140 });
    if (cell.duct.r) {
      const sg = segs[segs.length - 1];
      sg.terrain = sg.terrain.filter((t) => t.kind === 'low' || t.x1 < ROOM_W - 320);
      sg.terrain.push({ kind: 'low', x0: ROOM_W - 140, x1: ROOM_W });
    }
    cell.segments = segs;
    // 출입: 왼쪽·오른쪽 칸 통로, 위·아래 사다리
    if (cell.open.l) cell.things.push(thing('left', 40, LANE_DEPTH / 2, cell.duct.l ? '← 덕트 (앉아서)' : '← 옆 칸'));
    if (cell.open.r) cell.things.push(thing('right', ROOM_W - 40, LANE_DEPTH / 2, cell.duct.r ? '덕트 (앉아서) →' : '옆 칸 →'));
    if (cell.open.u) cell.things.push(thing('ladder_up', 560, 0, '지지대 ↑'));
    if (cell.open.d) cell.things.push(thing('ladder_down', 720, 0, '지지대 ↓'));
    if (cell.kind === 'entry') cell.things.push(thing('up', 400, 0, '해치 (위층으로)'));
    if (cell.kind === 'down') cell.things.push(thing('down', 880, 0, '아래 점검문 (다음 층)'));
    if (cell.kind === 'shaft') cell.things.push(thing('fall', 920, LANE_DEPTH, '승강로 틈새 (아래가 끝없이 보인다)'));
    if (r() < 0.2 && cell.kind !== 'attic') cell.things.push(thing('symbol', 1000, 0, '벽 기호', { attic: `${atticCell[0]},${atticCell[1]}` }));
    if (cell.kind === 'attic') {
      const ar = rng(mix(ctx.seed, ctx.depth, 8080)); // 다락방 내용은 고정
      cell.things.push(thing('rope', 120, 0, '귀환 로프'));
      cell.things.push(thing('bed', 300, 100, '낡은 매트 (휴식)'));
      cell.things.push(thing('intercom', 480, 0, '인터폰 (송신·거래)'));
      cell.things.push(thing('memo', 820, 0, '벽 메모: 「여기 오래 있지 마」', { rule: 'attic', writer: ar() < 0.5 }));
      cell.things.push(thing('map', 960, 0, '대충 그린 지도'));
      if (ar() < 0.7) cell.things.push(thing('pack', 1080, 120, '버려진 배낭', { item: pick(ar, ['heal', 'heal', 'light', 'guard']) }));
      if (ar() < 0.5) cell.things.push(thing('gear', 660, 140, '용도 모를 장비'));
      if (ar() < 0.5) cell.things.push(thing('checklist', 1180, 140, '서명란이 빈 점검표', { rule: 'entry' }));
      if (ar() < 0.3) cell.things.push(thing('merchant', 1180, 40, '중림 상인'));
    }
    // 구덩이 위에 놓인 것은 옆으로 민다
    const pits = cell.segments.flatMap((s) => s.terrain).filter((t) => t.kind === 'pit' || t.kind === 'block');
    for (const t of cell.things) for (const p of pits) if (t.x > p.x0 - 50 && t.x < p.x1 + 50) t.x = p.x1 + 60 > ROOM_W - 80 ? p.x0 - 60 : p.x1 + 60;
    // E는 가장 가까운 것 하나만 잡으므로 70px 안에 둘이 겹치지 않게: 줍는 것은 빼고, 길(사다리·출입)은 옆으로 민다
    const isWay = (t: ServiceThing) => !['item', 'symbol', 'pack', 'gear', 'checklist', 'merchant'].includes(t.kind);
    cell.things.sort((a, b) => Number(isWay(b)) - Number(isWay(a)));
    const kept: ServiceThing[] = [];
    for (const t of cell.things) {
      let tries = 0;
      while (kept.some((k) => Math.abs(k.x - t.x) < 70) && tries++ < 12) {
        if (!isWay(t)) break;
        t.x += t.x > ROOM_W / 2 ? -75 : 75;
      }
      if (kept.some((k) => Math.abs(k.x - t.x) < 70)) continue;
      kept.push(t);
    }
    cell.things = kept;
    cell.label = labelOf(cell.kind);
  }
  const predatorAfter = ctx.flags.includes('attic_short') ? 60 : 90;
  return { depth: ctx.depth, seed: ctx.seed, reroll: ctx.reroll, cols, rows, cells, atticCell, entryCell, downCell, shaftCell: shaft ? [shaft.col, shaft.row] : null, predatorAfter };
}

function labelOf(k: ServiceCell['kind']): string {
  return { entry: '해치 밑', duct: '덕트', support: '지지대 사이', slope: '기울어진 바닥', shaft: '승강로 틈새', attic: '선배들의 다락방', down: '아래 점검문 앞', plain: '배관 통로' }[k];
}

export const cellAt = (z: ServiceZone, col: number, row: number) => z.cells[row * z.cols + col];

/** 검증: 입구에서 다락방·아래 점검문까지 길이 있는가 */
export function validateService(z: ServiceZone): string[] {
  const bad: string[] = [];
  const reach = new Set<string>();
  const q: [number, number][] = [z.entryCell];
  while (q.length) {
    const [c, r] = q.pop()!;
    const k = `${c},${r}`;
    if (reach.has(k)) continue;
    reach.add(k);
    const cell = cellAt(z, c, r);
    if (cell.open.r) q.push([c + 1, r]);
    if (cell.open.l) q.push([c - 1, r]);
    if (cell.open.d) q.push([c, r + 1]);
    if (cell.open.u) q.push([c, r - 1]);
  }
  if (!reach.has(z.atticCell.join(','))) bad.push('다락방에 못 감');
  if (!reach.has(z.downCell.join(','))) bad.push('아래 점검문에 못 감');
  if (reach.size !== z.cells.length) bad.push('닿지 않는 칸');
  const attic = cellAt(z, ...z.atticCell);
  if (!attic.things.some((t) => t.kind === 'rope')) bad.push('로프 없음');
  if (z.cells.filter((c) => c.kind === 'attic').length !== 1) bad.push('다락방 수');
  for (const c of z.cells) {
    const terr = c.segments.flatMap((s) => s.terrain);
    for (const l of terr.filter((t) => t.kind === 'low')) for (const b of terr.filter((t) => t.kind === 'pit' || t.kind === 'block')) if (b.x0 < l.x1 + 60 && l.x0 < b.x1 + 60) bad.push('낮은 천장·단 겹침');
    const pits = c.segments.flatMap((s) => s.terrain).filter((t) => t.kind === 'pit');
    for (const t of c.things) {
      if (pits.some((p) => t.x > p.x0 - 20 && t.x < p.x1 + 20)) bad.push(`구덩이 위 ${t.kind}`);
      if (c.things.some((u) => u !== t && Math.abs(u.x - t.x) < 70)) bad.push(`겹침 ${t.kind}`);
      if (t.x < 30 || t.x > ROOM_W - 30) bad.push(`칸 밖 ${t.kind}`);
    }
    const need = (['l', 'r', 'u', 'd'] as const).filter((k) => c.open[k]).length;
    const ways = c.things.filter((t) => ['left', 'right', 'ladder_up', 'ladder_down'].includes(t.kind)).length;
    if (need !== ways) bad.push(`출입 수 ${c.col},${c.row}`);
  }
  return bad;
}
