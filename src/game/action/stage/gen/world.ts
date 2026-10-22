// 층 = 방 격자 세상 (원작 「차원 승강기」: 주머니 차원, 층마다 다른 세상, 지하는 사람의 건축이 사라진 미궁).
// 승강기 문이 열리면 그 층 공간 전체를 씨앗 하나로 짠다. 같은 씨앗이면 같은 세상, 출동마다 씨앗이 다르다.
//  1. 격자 크기: 깊이에 따라 커진다 (L1 3×2 → 지하 7×5). 적 예산·잠금 수는 끝없이 오른다.
//  2. 정답 길: 도착 방(맨 윗줄)에서 무작위 걸음 — 옆으로 걷다 아래로 떨어지기 — 으로 맨 아랫줄 출구 방까지 (스펠렁키식). 그래서 늘 풀린다.
//  3. 잠금: 정답 길 위 연결 몇 개를 잠근다 (가지보다 먼저 정하므로 우회로가 없다).
//  4. 가지: 남은 칸을 정답 길에서 자라는 나무로 채운다 → 막다른 곳. 가지는 붙은 칸의 잠금 구역을 따른다.
//  5. 열쇠: 잠금 k의 열쇠는 그 잠금 앞 구역의 가장 먼 막다른 곳에. 구역 안끼리만 순환·숨은 연결을 더한다 (잠금을 건너뛰는 길이 생기지 않게).
//  6. 방 역할: 막다른 곳 = 보상·숨은 방, 정답 길 = 싸움·함정·장치, 출구 방 = 수호자(깊이 확률)·승강기 패널.
//  7. 비틀림: 깊은 층과 B-12는 같은 구역 안에서 줄 양 끝이 이어진다 (끝없는 복도).
//  8. 검증: 열쇠를 줍고 잠금을 여는 길찾기로 출구까지 닿는지 확인, 안 되면 씨앗을 바꿔 다시.
import { B12, FLOOR_TYPES, REPLICA_SUB_LABEL, depthLabel } from '../data/floortypes';
import { mix, pick, rng, shuffle, type Rng } from '../rng';
import type { Dir, Floor, FloorType, ReplicaSub, World, WorldRoom } from '../types';
import { makeRoomFloor, type GenContext } from './floor';
import { CHUNK_W, LANE_DEPTH, ROOM_W } from '../types';

export const DIRS: Dir[] = ['l', 'r', 'u', 'd'];
export const OPP: Record<Dir, Dir> = { l: 'r', r: 'l', u: 'd', d: 'u' };
export const STEP: Record<Dir, [number, number]> = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] };

/** 깊이 → 격자 크기 (끝없이 깊어져도 7×5에서 멈추고, 그 뒤로는 잠금·적 예산이 오른다) */
export function worldSize(depth: number, type: FloorType): [number, number] {
  if (type === 'deep') return [6, 5];
  if (depth <= 1) return [3, 2];
  if (depth === 2) return [4, 2];
  if (depth === 3) return [4, 3];
  return [Math.min(7, 4 + Math.floor((depth - 4) / 2)), Math.min(5, 3 + Math.floor((depth - 4) / 3))];
}

/** 잠금 수: L1 0, 로비 1, 지하는 4층마다 하나씩 (최대 3) */
export function lockCount(depth: number, type: FloorType): number {
  if (depth <= 1 || type === 'chase') return 0;
  if (depth <= 3) return 1;
  return Math.min(3, 1 + Math.floor((depth - 4) / 4));
}

const ROOM_NAMES: Record<string, string[]> = {
  lobby: ['안내 데스크', '휴게실', '사무실', '복도', '탕비실', '회의실', '문서 창고', '숙직실', '흡연실', '우편실'],
  silent: ['열람실', '서고', '낭독실', '복도', '자료실', '정숙 구역', '빈 강의실'],
  dark: ['어두운 복도', '배전실', '불 꺼진 사무실', '창고', '기계실', '빈 홀'],
  puzzle: ['같은 방', '거꾸로 된 방', '시험실', '두 갈래 방', '반복되는 방', '비틀린 방'],
  trial: ['대기실', '시험장', '심판석', '채점실', '복도'],
  chase: ['비상 통로', '계단참', '복도', '방화문 앞', '하역장'],
  deep: ['어둠', '끝없는 어둠', '만져지는 곳', '바닥 없는 곳'],
  'replica:pretending': ['거실', '부엌', '안방', '베란다', '계단실', '복도', '작은방', '현관'],
  'replica:vacant': ['빈 거실', '빈 부엌', '창고', '계단실', '복도', '빈 안방'],
  'replica:red': ['붉은 복도', '붉은 거실', '계단실', '베란다', '붉은 방'],
};

interface Ctx {
  seed: number;
  depth: number;
  type: FloorType;
  sub: ReplicaSub | null;
  epoch: number;
  /** 장치 조각을 꼭 넣을 방 수 (유형 규칙) */
  guardianP?: number;
}

const key = (c: number, r: number) => `${c},${r}`;

export function makeWorld(ctx: Ctx): World {
  for (let tries = 0; tries < 8; tries++) {
    const w = buildWorld(ctx, rng(mix(ctx.seed, ctx.depth, ctx.epoch, 9001, tries)));
    if (!validateWorld(w).length) return w;
  }
  // 끝내 안 되면 잠금 없이 (길만은 보장)
  return buildWorld({ ...ctx }, rng(mix(ctx.seed, ctx.depth, 4444)), true);
}

function buildWorld(ctx: Ctx, r: Rng, noLocks = false): World {
  const { depth, type } = ctx;
  const [cols, rows] = worldSize(depth, type);
  const rooms: WorldRoom[] = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++)
      rooms.push({ col, row, open: { l: false, r: false, u: false, d: false }, wrap: {}, lock: {}, hidden: {}, role: 'branch', dist: 0, region: 0, onPath: false, key: null, panel: false, guardian: false, passenger: false, need: [], chunks: 2, name: '' });
  const at = (c: number, rw: number) => rooms[rw * cols + c];
  const link = (a: WorldRoom, d: Dir) => {
    const [dx, dy] = STEP[d];
    const b = at(a.col + dx, a.row + dy);
    a.open[d] = true;
    b.open[OPP[d]] = true;
    return b;
  };

  // ── 2. 정답 길: 줄마다 옆으로 몇 칸 걷고 아래로. 맨 아랫줄에서 몇 칸 더 걷고 끝
  const path: WorldRoom[] = [];
  let c = Math.floor(r() * cols);
  let row = 0;
  path.push(at(c, 0));
  for (;;) {
    const last = row === rows - 1;
    let dir: -1 | 1 = r() < 0.5 ? -1 : 1;
    if ((dir > 0 ? cols - 1 - c : c) === 0) dir = (-dir) as -1 | 1;
    const left = dir > 0 ? cols - 1 - c : c; // 그 방향으로 남은 칸
    // 줄마다 옆으로 0~남은 칸, 맨 아랫줄은 적어도 한 칸 (출구가 떨어진 자리 바로 아래가 아니게)
    const steps = Math.min(left, last ? Math.max(1, Math.ceil(r() * left)) : Math.floor(r() * (left + 1)));
    for (let k = 0; k < steps; k++) {
      path.push(link(path[path.length - 1], dir > 0 ? 'r' : 'l'));
      c += dir;
    }
    if (last) break;
    path.push(link(path[path.length - 1], 'd'));
    row++;
  }
  for (const p of path) p.onPath = true;
  const arrival = path[0];
  const exit = path[path.length - 1];

  // ── 3. 잠금: 정답 길 연결(i-1 → i)을 길 뒤쪽 절반에 고르게
  const locks = noLocks ? 0 : Math.min(lockCount(depth, type), Math.max(0, Math.floor((path.length - 2) / 2)));
  const lockAt: number[] = [];
  for (let k = 1; k <= locks; k++) {
    const lo = Math.max(2, Math.floor((path.length * (k + 0.3)) / (locks + 1.3)));
    const i = Math.min(path.length - 1, lo + Math.floor(r() * 2));
    if (!lockAt.includes(i) && i > (lockAt[lockAt.length - 1] ?? 1)) lockAt.push(i);
  }
  lockAt.forEach((i, k) => {
    const a = path[i - 1],
      b = path[i];
    const d = DIRS.find((d) => a.col + STEP[d][0] === b.col && a.row + STEP[d][1] === b.row)!;
    a.lock[d] = k + 1;
    b.lock[OPP[d]] = k + 1;
  });
  // 정답 길 구역 번호
  let reg = 0;
  path.forEach((p, i) => {
    if (lockAt.includes(i)) reg++;
    p.region = reg;
  });

  // ── 4. 가지: 남은 칸을 나무로. 최근에 붙은 칸에서 더 자라기 쉽게 (긴 막다른 가지)
  const inTree = new Set(path.map((p) => key(p.col, p.row)));
  const grow: WorldRoom[] = [...path];
  while (inTree.size < rooms.length) {
    // 정답 길에서 자주 뻗고(막다른 곳이 많게), 가끔 가지 끝에서 더 자란다(긴 가지)
    const from = r() < 0.3 ? grow[grow.length - 1] : grow[Math.floor(r() * grow.length)];
    const ds = shuffle(r, [...DIRS]).filter((d) => {
      const [dx, dy] = STEP[d];
      const nc = from.col + dx,
        nr = from.row + dy;
      return nc >= 0 && nr >= 0 && nc < cols && nr < rows && !inTree.has(key(nc, nr));
    });
    if (!ds.length) {
      // 더 자랄 데 없는 칸은 후보에서 뺀다
      grow.splice(grow.indexOf(from), 1);
      if (!grow.length) break;
      continue;
    }
    const b = link(from, ds[0]);
    b.region = from.region;
    inTree.add(key(b.col, b.row));
    grow.push(b);
  }
  // 출구 방은 정답 길로만 (가지가 출구 방에서 자라면 출구 너머 가지가 잠금 뒤로 넘어가니 괜찮지만, 출구 방은 마지막이 되게)

  // ── 거리 (잠금 무시)
  const dist = new Map<string, number>([[key(arrival.col, arrival.row), 0]]);
  const q: WorldRoom[] = [arrival];
  while (q.length) {
    const a = q.shift()!;
    for (const d of DIRS) {
      if (!a.open[d]) continue;
      const [dx, dy] = STEP[d];
      const b = at(a.col + dx, a.row + dy);
      if (dist.has(key(b.col, b.row))) continue;
      dist.set(key(b.col, b.row), dist.get(key(a.col, a.row))! + 1);
      q.push(b);
    }
  }
  for (const rm of rooms) rm.dist = dist.get(key(rm.col, rm.row)) ?? 0;
  const deg = (rm: WorldRoom) => DIRS.filter((d) => rm.open[d]).length;
  const leaves = () => rooms.filter((rm) => deg(rm) === 1 && rm !== arrival && rm !== exit && !rm.onPath);

  // ── 5. 열쇠: 잠금 k → 구역 k-1 (없으면 그 앞 구역)의 가장 먼 막다른 곳
  for (let k = 1; k <= lockAt.length; k++) {
    const cand = (regs: number[]) => rooms.filter((rm) => regs.includes(rm.region) && rm.key === null && rm !== arrival && rm !== exit);
    let pool = cand([k - 1]).filter((rm) => deg(rm) === 1 && !rm.onPath);
    if (!pool.length) pool = cand([k - 1]).filter((rm) => !rm.onPath);
    if (!pool.length) pool = cand(Array.from({ length: k }, (_, i) => i)).filter((rm) => !rm.onPath);
    if (!pool.length) pool = cand(Array.from({ length: k }, (_, i) => i));
    if (!pool.length) pool = [arrival];
    pool.sort((a, b) => b.dist - a.dist);
    const at0 = pool[Math.floor(r() * Math.min(2, pool.length))];
    at0.key = k;
    at0.role = 'key';
  }

  // 순환: 같은 구역 안 이웃끼리 (칸 수 / 6개쯤)
  const loops = Math.round(rooms.length / 8);
  for (let n = 0, tries = 0; n < loops && tries < 200; tries++) {
    const a = rooms[Math.floor(r() * rooms.length)];
    const d = pick(r, DIRS);
    const [dx, dy] = STEP[d];
    const nc = a.col + dx,
      nr = a.row + dy;
    if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || a.open[d]) continue;
    const b = at(nc, nr);
    // 막다른 곳(보상·열쇠·숨은 방 자리)은 막다른 채로 둔다
    if (b.region !== a.region || a === exit || b === exit || deg(a) === 1 || deg(b) === 1) continue;
    link(a, d);
    n++;
  }
  // 숨은 방: 막다른 곳 하나를 금 간 벽(옆)·막힌 덕트(아래)로만 이어지게 (출입은 바깥쪽에서만 숨김)
  if (depth >= 2 && r() < 0.75) {
    for (const s of shuffle(r, leaves().filter((rm) => rm.key === null))) {
      const d = DIRS.find((d) => s.open[d])!;
      const [dx, dy] = STEP[d];
      const outer = at(s.col + dx, s.row + dy);
      // 바깥 방에서 보면 OPP[d] 쪽이 숨은 연결. 위로 올라가는 숨은 길은 없다(덕트는 아래로만)
      const od = OPP[d];
      if (od === 'u') continue;
      outer.hidden[od] = od === 'd' ? 'vent' : 'crack';
      s.role = 'secret';
      break;
    }
  }
  // 끝없는 복도: 깊은 층·B-12는 같은 구역 안에서 줄 양 끝을 잇는다
  if (type === 'deep' || depth >= 12) {
    for (let rw = 0; rw < rows; rw++) {
      const a = at(cols - 1, rw),
        b = at(0, rw);
      if (a.region !== b.region || a === exit || b === exit || a.open.r) continue;
      if (r() < (type === 'deep' ? 1 : 0.5)) (a.open.r = b.open.l = true), (a.wrap.r = b.wrap.l = true);
    }
  }

  // ── 6. 방 역할
  arrival.role = 'arrival';
  exit.role = 'exit';
  exit.panel = true;
  const gp = type === 'deep' ? 1 : depth === 3 ? 1 : depth < 3 ? 0 : Math.min(1, 0.35 + (depth - 4) * 0.05);
  exit.guardian = r() < gp;
  let rewards = 0;
  for (const rm of shuffle(r, leaves())) {
    if (rm.role !== 'branch') continue;
    if (rewards < 2 + Math.floor(depth / 6)) (rm.role = 'reward'), rewards++;
  }
  for (const rm of path.slice(1, -1)) rm.role = rm.key !== null ? 'key' : pick(r, ['fight', 'fight', 'trap', 'path'] as const);
  // 승강기 문이 하나 더 (지하): 마지막 구역의 막다른 곳
  if (depth >= 4) {
    const extra = rooms.filter((rm) => rm.region === lockAt.length && rm.role === 'branch' && deg(rm) === 1);
    if (extra.length && r() < 0.5) extra[Math.floor(r() * extra.length)].panel = true;
  }
  // 유형 장치는 정답 길의 방에 하나씩 (도착·출구 방 빼고, 모자라면 도착 방)
  const need: string[] = [];
  if (type === 'puzzle') need.push('p_fork', 'p_switch');
  if (type === 'replica' && (ctx.sub ?? 'pretending') === 'pretending') need.push(r() < 0.5 ? 'r_living' : 'r_kitchen');
  if (type === 'replica' && ctx.sub === 'vacant') need.push('r_storage');
  if (type === 'chase') need.push('h_doors');
  if (type === 'trial') arrival.need.push('t_marks');
  const devRooms = shuffle(r, path.slice(1, -1).filter((rm) => rm.key === null));
  need.forEach((id, i) => {
    const rm = devRooms[i] ?? arrival;
    rm.need.push(id);
    if (rm !== arrival) rm.role = 'device';
  });
  // 승객: 지하·로비 L2부터 반에 한 번, 아무 방
  if (depth >= 2 && type !== 'deep' && r() < 0.5) {
    const c2 = rooms.filter((rm) => rm !== arrival && rm.role !== 'secret');
    c2[Math.floor(r() * c2.length)].passenger = true;
  }
  // 조각 수: 역할마다
  for (const rm of rooms) {
    rm.chunks =
      rm.role === 'arrival' ? (type === 'trial' ? 3 : 2) : rm.role === 'exit' ? 1 + Math.floor(r() * 2) : rm.role === 'reward' || rm.role === 'secret' || rm.role === 'key' ? 2 : rm.role === 'fight' ? 3 : rm.role === 'device' ? Math.max(2, rm.need.length + 1) : 2 + Math.floor(r() * 2);
    // 위·아래로 이어진 방은 계단 자리 둘이 들어가게 조금 넉넉히
    if (rm.open.u && rm.open.d) rm.chunks = Math.max(rm.chunks, 3);
    if (type === 'lobby' && depth === 1) rm.chunks = Math.min(rm.chunks, 3);
  }
  // 이름
  const names = ROOM_NAMES[type === 'replica' ? `replica:${ctx.sub ?? 'pretending'}` : type] ?? ROOM_NAMES.lobby;
  const nameR = shuffle(r, [...names]);
  rooms.forEach((rm, i) => {
    rm.name = rm.role === 'arrival' ? '엘리베이터 홀' : rm.role === 'exit' ? '승강기 홀' : rm.role === 'secret' ? '숨은 방' : nameR[i % nameR.length];
  });

  const def = FLOOR_TYPES[type];
  return {
    depth,
    type,
    sub: ctx.sub,
    seed: ctx.seed,
    cols,
    rows,
    rooms,
    arrival: [arrival.col, arrival.row],
    exit: [exit.col, exit.row],
    locks: lockAt.length,
    path: path.map((p) => [p.col, p.row]),
    label: `${depthLabel(depth)} · ${def.label}${ctx.sub ? ` (${REPLICA_SUB_LABEL[ctx.sub]})` : ''}`,
  };
}

export const roomAt = (w: World, c: number, r: number): WorldRoom | undefined => (c >= 0 && r >= 0 && c < w.cols && r < w.rows ? w.rooms[r * w.cols + c] : undefined);

/** 연결 너머 방 (끝없는 복도면 반대편 끝) */
export function across(w: World, rm: WorldRoom, d: Dir): WorldRoom | undefined {
  if (rm.wrap[d]) return roomAt(w, d === 'r' ? 0 : w.cols - 1, rm.row);
  const [dx, dy] = STEP[d];
  return roomAt(w, rm.col + dx, rm.row + dy);
}

/** 연결 하나의 이름 (양쪽 방이 같은 값): 연 잠금·부순 벽 기억에 쓴다 */
export function edgeId(w: World, rm: WorldRoom, d: Dir): string {
  const b = across(w, rm, d)!;
  const a1 = `${rm.col},${rm.row},${d}`,
    a2 = `${b.col},${b.row},${OPP[d]}`;
  return `${w.depth}:${a1 < a2 ? a1 : a2}`;
}

/** 풀림 검사: 열쇠를 주워 가며 잠금을 열고 출구까지 닿는가. 숨은 연결은 쓰지 않는다 */
export function validateWorld(w: World): string[] {
  const bad: string[] = [];
  const keys = new Set<number>();
  let seen = new Set<string>();
  for (let round = 0; round <= w.locks + 1; round++) {
    seen = new Set([key(...w.arrival)]);
    const q = [roomAt(w, ...w.arrival)!];
    while (q.length) {
      const a = q.shift()!;
      if (a.key !== null) keys.add(a.key);
      for (const d of DIRS) {
        if (!a.open[d]) continue;
        const l = a.lock[d];
        if (l && !keys.has(l)) continue;
        const b = across(w, a, d);
        if (!b || seen.has(key(b.col, b.row))) continue;
        // 숨은 방은 바깥에서 숨김 연결로만 들어간다 (풀이에는 필요 없어야 한다)
        if (a.hidden[d]) continue;
        seen.add(key(b.col, b.row));
        q.push(b);
      }
    }
  }
  if (!seen.has(key(...w.exit))) bad.push('출구에 못 닿음');
  for (let k = 1; k <= w.locks; k++) if (!keys.has(k)) bad.push(`열쇠 ${k} 못 주움`);
  if (w.rooms.some((rm) => rm.key !== null && rm.role === 'secret')) bad.push('열쇠가 숨은 방에');
  // 잠금이 실제로 막는가 (열쇠 없이 출구에 닿으면 잠금이 무의미)
  if (w.locks) {
    const s2 = new Set([key(...w.arrival)]);
    const q = [roomAt(w, ...w.arrival)!];
    while (q.length) {
      const a = q.shift()!;
      for (const d of DIRS) {
        if (!a.open[d] || a.lock[d] || a.hidden[d]) continue;
        const b = across(w, a, d)!;
        if (s2.has(key(b.col, b.row))) continue;
        s2.add(key(b.col, b.row));
        q.push(b);
      }
    }
    if (s2.has(key(...w.exit))) bad.push('잠금을 돌아가는 길');
  }
  return bad;
}

// ── 방 하나 → Floor (벨트스크롤 한 판) + 출입·열쇠·잠금·숨은 벽·보상
const MID = LANE_DEPTH / 2;
let xid = 1000;
const put = (f: Floor, kind: Floor['placed'][number]['kind'], x: number, lane: number, w: number, label: string, data: Floor['placed'][number]['data'] = {}) => {
  const p = { id: xid++, kind, x: Math.round(x), lane: Math.round(lane), w, label, data };
  f.placed.push(p);
  return p;
};
export const KEY_MARK = ['', '①', '②', '③', '④'];

export function roomFloor(w: World, rm: WorldRoom, g: Omit<GenContext, 'room' | 'depth' | 'type' | 'sub'>): Floor {
  xid = 1000;
  const f = makeRoomFloor({
    ...g,
    depth: w.depth,
    type: w.type,
    sub: w.sub,
    exitOpen: rm.role === 'exit' && g.exitOpen,
    room: {
      col: rm.col,
      row: rm.row,
      name: rm.name,
      chunks: rm.chunks,
      need: rm.need,
      arrival: rm.role === 'arrival',
      exit: rm.role === 'exit',
      guardian: rm.guardian,
      passenger: rm.passenger,
      rules: rm.role === 'arrival' || rm.role === 'device' || (w.depth >= 4 && rm.dist === 1),
      goal: rm.role === 'arrival' && w.type === 'trial',
      enemies: !(rm.role === 'arrival' && w.depth <= 1) && rm.role !== 'secret',
      index0: rm.dist,
    },
  });
  const r = rng(mix(w.seed, w.depth, rm.col, rm.row, 777));
  const W = f.width;
  const terr = f.segments.flatMap((s) => s.terrain);
  const decor = (p: Floor['placed'][number]) => p.kind === 'prop' && !Object.keys(p.data).length;
  const free = (x: number, d: number, soft = false) =>
    x > 80 && x < W - 80 && !terr.some((t) => x > t.x0 - 110 && x < t.x1 + 110) && !f.placed.some((p) => (!soft || !decor(p)) && Math.abs(p.x - x) < d);
  /** 자리 찾기: 원하는 x 가까이부터. 빈 곳이 없으면 꾸밈 소품을 치우고 */
  const spot = (want: number, d: number, lo = 120, hi = W - 120): number => {
    const xs: number[] = [];
    for (let k = 0; k < 200; k++) {
      const x = want + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 20;
      if (x >= lo && x <= hi) xs.push(x);
    }
    for (const soft of [false, true])
      for (const x of xs)
        if (free(x, d, soft)) {
          f.placed = f.placed.filter((p) => !(decor(p) && Math.abs(p.x - x) < d));
          return x;
        }
    return Math.max(lo, Math.min(hi, want));
  };
  const nb = (d: Dir) => across(w, rm, d);
  const label = (d: Dir) => {
    const b = nb(d)!;
    const arrow = { l: '←', r: '→', u: '↑', d: '↓' }[d];
    return d === 'l' ? `${arrow} ${b.name}` : `${b.name} ${arrow}`;
  };
  // 좌·우: 방 양 끝 문. 잠겼으면 문 앞에 방화셔터 (몸을 막는다)
  for (const d of ['l', 'r'] as const) {
    if (!rm.open[d]) continue;
    const x = d === 'l' ? 70 : W - 70;
    const hidden = rm.hidden[d];
    if (hidden) {
      put(f, 'crack', d === 'l' ? spot(240, 120, 160, 420) : spot(W - 240, 120, W - 420, W - 160), 0, 90, '금 간 벽', { dir: d, hp: 3 });
      continue;
    }
    // 문 바로 앞의 꾸밈 소품·표지는 비킨다
    f.placed = f.placed.filter((p) => !(decor(p) && Math.abs(p.x - x) < 140));
    put(f, 'wdoor', x, 0, 90, rm.wrap[d] ? `${label(d)} (끝이 이어진다)` : label(d), { dir: d });
    const l = rm.lock[d];
    if (l) put(f, 'locked', d === 'l' ? 190 : W - 190, MID, 40, `잠긴 방화셔터 ${KEY_MARK[l]}`, { dir: d, lock: l });
  }
  // 위·아래: 계단 (지하 깊은 곳은 무너진 바닥 구멍·매달린 줄). 위는 앞쪽, 아래는 뒤쪽 절반에서 자리 찾기
  for (const d of ['u', 'd'] as const) {
    if (!rm.open[d]) continue;
    const hidden = rm.hidden[d];
    const want = d === 'u' ? W * 0.35 : W * 0.65;
    const x = spot(want, 150, 260, W - 260);
    if (hidden) {
      put(f, 'vent', x, MID, 60, '막힌 덕트', { dir: d });
      continue;
    }
    const l = rm.lock[d];
    const name = w.type === 'deep' ? (d === 'u' ? '매달린 줄' : '무너진 바닥') : w.type === 'replica' ? (d === 'u' ? '계단실 (위층)' : '계단실 (아래층)') : d === 'u' ? '올라가는 계단' : '내려가는 계단';
    put(f, d === 'u' ? 'wup' : 'wdown', x, 0, 110, l ? `잠긴 ${name} ${KEY_MARK[l]}` : `${name} · ${nb(d)!.name}`, { dir: d, ...(l ? { lock: l } : {}) });
  }
  // 열쇠: 방 가운데 뒤쪽
  if (rm.key !== null) put(f, 'key', spot(W * 0.6, 120), 80, 40, `열쇠 ${KEY_MARK[rm.key]}`, { key: rm.key });
  // 보상: 막다른 방 끝 (싸움이 있으면 이긴 뒤에)
  if (rm.role === 'reward' || rm.role === 'secret') put(f, 'reward', spot(W - 300, 120), 90, 60, rm.role === 'secret' ? '숨겨 둔 배낭 (강화)' : '선배가 남긴 배낭 (강화)', {});
  if (rm.role === 'secret') {
    put(f, 'item', spot(W * 0.4, 100), 120, 28, '보급품', { item: pick(r, ['heal', 'guard', 'light']) });
  }
  // 출구 방 말고 승강기 문이 하나 더 있는 방
  if (rm.panel && rm.role !== 'exit') {
    const x = spot(W - 420, 200, 300, W - 200);
    put(f, 'elevator', x, 0, 160, '열린 엘리베이터');
    put(f, 'panel', x + 170 < W - 80 ? x + 170 : x - 170, 0, 80, '승강기 패널');
  }
  // 정비 구역 입구: 조각에 점검문·해치가 없으면 도착 방과 가끔 다른 방에 하나
  if (rm.role === 'arrival' && w.type !== 'deep' && !f.placed.some((p) => p.kind === 'hatch' || p.kind === 'servicedoor')) put(f, 'servicedoor', spot(Math.min(W - 300, ROOM_W + 400), 140), 0, 70, '점검문');
  void CHUNK_W;
  void B12;
  return f;
}
