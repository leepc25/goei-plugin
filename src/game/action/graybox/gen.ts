// 조각 기반 층 생성 (스테이지 설계서 5·15장). 방을 손으로 만들지 않고 조각 모양 + 얹는 것(소품·적·규칙 장치)으로 만든다.
import { budgetFor, ENEMIES, GUARDIANS, type EnemyDef, type FloorType } from './data';

export const CHUNK = 640,
  LANE_MIN = 480,
  LANE_MAX = 680;
export type ChunkKind =
  | 'hall_start'
  | 'hall_end'
  | 'flat'
  | 'step'
  | 'gap'
  | 'twodoor'
  | 'servicedoor'
  | 'hatch'
  | 'deadend'
  | 'bend'
  | 'widehall'
  | 'narrow'
  | 'guardian'
  | 'goal'
  | 'attic'
  | 'duct'
  | 'ledge';
export type PropKind =
  | 'sign'
  | 'door'
  | 'lockdoor'
  | 'key'
  | 'servicedoor'
  | 'hatch'
  | 'panel'
  | 'mirror'
  | 'rope'
  | 'phone'
  | 'pickup'
  | 'table'
  | 'checklist'
  | 'crate'
  | 'exit';
export interface Prop {
  id: number;
  kind: PropKind;
  x: number;
  y: number;
  w: number;
  h: number;
  used: boolean;
  /** sign: 규칙 id / door: 'left'|'right' 정답 여부 / pickup: 아이템 번호 / crate: 틈새 막기 */
  data: string;
}
export interface Chunk {
  kind: ChunkKind;
  x: number;
  w: number;
  laneMin: number;
  laneMax: number;
  /** 올라서는 단(step)·구멍(gap)의 가로 범위 */
  feature?: [number, number];
  /** duct: 천장 낮음(앉아서만 통과) */
  low?: boolean;
  wall?: boolean;
}
export interface Spawn {
  kind: string;
  x: number;
  y: number;
  elite: boolean;
  guardian: boolean;
  wave: number;
}
export interface Floor {
  depth: number;
  type: FloorType;
  seed: number;
  chunks: Chunk[];
  width: number;
  props: Prop[];
  spawns: Spawn[];
  budget: number;
  guardian: string | null;
  goal: { need: number; time: number } | null;
  chaser: boolean;
  variant: string;
  passenger: { x: number; honest: boolean; rescue: boolean } | null;
  fallback: boolean;
}

/** 작은 씨앗 난수 (mulberry32). 같은 씨앗이면 같은 층. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const COMMON: ChunkKind[] = ['flat', 'step', 'gap', 'twodoor', 'servicedoor', 'hatch', 'bend', 'widehall', 'narrow', 'flat'];
let propId = 1;
const prop = (kind: PropKind, x: number, y: number, w: number, h: number, data = ''): Prop => ({ id: propId++, kind, x, y, w, h, used: false, data });
/** 구멍 조각이면 소품 x를 구멍 밖으로 민다 */
const safeX = (c: Chunk, x: number) => (c.kind === 'gap' && c.feature && x > c.feature[0] - 60 && x < c.feature[1] + 20 ? c.feature[1] + 40 : x);

export function pickType(depth: number, last: FloorType[], r: () => number): FloorType {
  if (depth <= 3) return 'lobby';
  const n = depth - 3;
  if (n === 1) return 'chase';
  if (n === 2) return 'replica';
  if (n === 3) return 'trial';
  const pool: FloorType[] = ['chase', 'replica', 'trial', 'dark', 'silent', 'puzzle'];
  const ok = pool.filter((t) => !last.slice(-3).includes(t));
  return ok[Math.floor(r() * ok.length)];
}

/** 예산으로 적을 산다. 화면당 8 상한, 넘치는 예산은 정예(체력·속도)와 파도로. */
function buyEnemies(type: FloorType, budget: number, r: () => number, x0: number, x1: number, laneMin: number, laneMax: number): Spawn[] {
  const pool = ENEMIES.filter((e) => e.types.includes(type));
  if (!pool.length || budget < 8) return [];
  const out: Spawn[] = [];
  let left = budget,
    guardCount = 0;
  while (left >= 8 && guardCount < 40) {
    guardCount++;
    const affordable = pool.filter((e) => e.price <= left);
    if (!affordable.length) break;
    const def: EnemyDef = affordable[Math.floor(r() * affordable.length)];
    if (out.length >= 8) {
      // 수가 아니라 질: 남은 예산은 정예로 바꾼다
      const plain = out.filter((s) => !s.elite);
      if (!plain.length) break;
      plain[Math.floor(r() * plain.length)].elite = true;
      left -= 15;
      continue;
    }
    out.push({
      kind: def.kind,
      x: x0 + 80 + r() * (x1 - x0 - 160),
      y: laneMin + r() * (laneMax - laneMin),
      elite: false,
      guardian: false,
      wave: out.length >= 5 ? 1 : 0,
    });
    left -= def.price;
  }
  return out;
}

export function makeFloor(depth: number, type: FloorType, seed: number, danger: number, growth: number, opts: { rescue?: boolean } = {}): Floor {
  const r = rng(seed * 7919 + depth * 131 + 17);
  propId = 1;
  const variants = ['', '', '존댓말', '거짓 승객', '빠른 포식자', '깊이 점프'];
  const variant = depth >= 4 ? variants[Math.floor(r() * variants.length)] : '';
  const count = type === 'lobby' ? 4 + Math.floor(r() * 3) : 6 + Math.floor(r() * 7);
  const chunks: Chunk[] = [];
  const props: Prop[] = [];
  const spawns: Spawn[] = [];
  let x = 0;
  const push = (kind: ChunkKind, w = CHUNK, extra: Partial<Chunk> = {}) => {
    const c: Chunk = { kind, x, w, laneMin: LANE_MIN, laneMax: LANE_MAX, ...extra };
    chunks.push(c);
    x += w;
    return c;
  };
  push('hall_start');
  props.push(prop('panel', 80, LANE_MIN - 40, 60, 120, 'start'), prop('mirror', 300, LANE_MIN - 60, 50, 110));
  const typeRule: Record<string, string> = { lobby: 'lobby', chase: 'c_door', replica: 'r_greet', trial: 'trial', dark: 'dark', silent: 'silent', puzzle: 'p_sign' };
  const extraRule: Record<string, string[]> = { replica: ['r_quiet', 'r_meal'], common: ['greet', 'close', 'mirror', 'passenger', 'noreturn'] };
  let ruleUsed = false,
    serviceUsed = false,
    doorsUsed = 0;
  for (let i = 0; i < count; i++) {
    let kind = COMMON[Math.floor(r() * COMMON.length)];
    if ((kind === 'servicedoor' || kind === 'hatch') && serviceUsed) kind = 'flat';
    if (kind === 'twodoor' && doorsUsed >= 2) kind = 'flat';
    if (i === count - 1 && !serviceUsed) kind = 'servicedoor';
    const c = push(kind);
    const base = c.x;
    if (kind === 'step') c.feature = [base + 200, base + 440];
    if (kind === 'gap') c.feature = [base + 240, base + 400];
    if (kind === 'widehall') (c.laneMin = LANE_MIN - 60), (c.laneMax = LANE_MAX + 20);
    if (kind === 'narrow') (c.laneMin = 560), (c.laneMax = 600);
    if (kind === 'twodoor') {
      doorsUsed++;
      const answer = r() < 0.5 ? 'left' : 'right';
      props.push(prop('door', base + 180, LANE_MIN - 160, 70, 180, answer === 'left' ? 'ok' : 'trap'), prop('door', base + 400, LANE_MIN - 160, 70, 180, answer === 'right' ? 'ok' : 'trap'));
      props.push(prop('sign', base + 300, LANE_MIN - 130, 40, 50, `p_sign:${answer}`));
    }
    if (kind === 'servicedoor') (serviceUsed = true), props.push(prop('servicedoor', base + 520, LANE_MIN - 150, 60, 170));
    if (kind === 'hatch') (serviceUsed = true), props.push(prop('hatch', base + 320, LANE_MIN - 330, 80, 30));
    // 규칙 장치: 그 유형 규칙 1개는 반드시 경로 위
    if (!ruleUsed && i >= 1 && typeRule[type]) {
      ruleUsed = true;
      props.push(prop('sign', safeX(c, base + 60), LANE_MIN - 120, 40, 50, typeRule[type]));
    } else if (r() < 0.35) {
      const list = (extraRule[type] ?? []).concat(extraRule.common);
      props.push(prop('sign', safeX(c, base + 60 + r() * 300), LANE_MIN - 120, 40, 50, list[Math.floor(r() * list.length)]));
    }
    if (type === 'replica' && r() < 0.5) props.push(prop('table', safeX(c, base + 100 + r() * 300), LANE_MIN + 60, 90, 40));
    if (r() < 0.4) props.push(prop('pickup', safeX(c, base + 100 + r() * 400), LANE_MIN + 20 + r() * 160, 28, 28, String(Math.floor(r() * 4))));
    if (type === 'chase' && r() < 0.6) props.push(prop('door', base + 560, LANE_MIN - 160, 40, 180, 'chase'));
    if (type === 'chase' && r() < 0.5) props.push(prop('crate', safeX(c, base + 300 + r() * 200), LANE_MIN + 100, 50, 50, 'crate'));
    // 적: 예산
    const budget = budgetFor(depth, i, danger, variant ? 4 : 0, growth);
    if (!(type === 'lobby' && depth === 1 && i === 0)) spawns.push(...buyEnemies(type, budget, r, c.x, c.x + c.w, c.laneMin, c.laneMax));
  }
  // 시험 층 목표 방
  let goal: Floor['goal'] = null;
  if (type === 'trial') {
    const c = push('goal');
    goal = { need: 3 + Math.min(5, depth - 3), time: 45 };
    props.push(prop('sign', c.x + 60, LANE_MIN - 120, 40, 50, 'trial'));
    spawns.push(...buyEnemies(type, budgetFor(depth, count, danger, 10, growth), r, c.x, c.x + c.w, LANE_MIN, LANE_MAX));
  }
  // 수호자 방: L3와 지하는 전부
  let guardian: string | null = null;
  if (depth === 3 || depth >= 4) {
    const def = GUARDIANS.find((g) => g.type === type) ?? GUARDIANS[0];
    guardian = def.kind;
    const c = push('guardian', 900);
    spawns.push({ kind: def.kind, x: c.x + 600, y: 580, elite: depth >= 9, guardian: true, wave: 0 });
    if (def.special === 'ceiling') for (let k = 0; k < 3; k++) props.push(prop('crate', c.x + 150 + k * 250, LANE_MIN + 110, 50, 50, 'gapcover'));
    if (def.special === 'elder') props.push(prop('table', c.x + 420, LANE_MIN + 70, 120, 50, 'meal'));
  }
  const end = push('hall_end');
  props.push(prop('panel', end.x + 520, LANE_MIN - 40, 60, 120, 'end'));
  const passenger =
    depth >= 2 && r() < 0.55
      ? { x: chunks[1 + Math.floor(r() * Math.max(1, count - 1))].x + 300, honest: variant === '거짓 승객' ? false : r() < 0.5, rescue: !!opts.rescue }
      : null;
  const floor: Floor = { depth, type, seed, chunks, width: x, props, spawns, budget: budgetFor(depth, 0, danger, 0, growth), guardian, goal, chaser: type === 'chase', variant, passenger, fallback: false };
  if (!validate(floor)) {
    // 같은 씨앗으로 3번 다시, 그래도 안 되면 고정 배치
    for (let k = 1; k <= 3; k++) {
      const again = makeFloor(depth, type, seed + k * 1000003, danger, growth, opts);
      if (validate(again)) return again;
    }
    return fallbackFloor(depth, type, seed);
  }
  return floor;
}

export function validate(f: Floor): boolean {
  if (f.chunks[0].kind !== 'hall_start' || f.chunks[f.chunks.length - 1].kind !== 'hall_end') return false;
  // 끝까지 길: 구멍 폭이 점프 거리(240)보다 짧아야 한다
  for (const c of f.chunks) if (c.kind === 'gap' && c.feature && c.feature[1] - c.feature[0] > 240) return false;
  if (!f.props.some((p) => p.kind === 'servicedoor' || p.kind === 'hatch')) return false;
  if (f.guardian && !f.spawns.some((s) => s.guardian)) return false;
  // 문 정답 표지가 문보다 앞(왼쪽)이거나 같은 조각에
  for (const d of f.props.filter((p) => p.kind === 'door' && p.data !== 'chase'))
    if (!f.props.some((s) => s.kind === 'sign' && s.data.startsWith('p_sign') && Math.abs(s.x - d.x) < CHUNK)) return false;
  return true;
}

function fallbackFloor(depth: number, type: FloorType, seed: number): Floor {
  const f = makeFloor(depth, type, 424242, 0, 0);
  f.fallback = true;
  f.seed = seed;
  return f;
}

/** 정비 구역: 층 사이 세로 미로를 회색 상자에서는 낮은 천장(앉기)·턱(점프)·다락방으로 만든다. */
export function makeService(depth: number, seed: number, variant: string): Floor {
  const r = rng(seed * 31 + depth * 7 + 99);
  propId = 5000;
  const chunks: Chunk[] = [];
  const props: Prop[] = [];
  let x = 0;
  const push = (kind: ChunkKind, w = CHUNK, extra: Partial<Chunk> = {}) => {
    const c: Chunk = { kind, x, w, laneMin: 560, laneMax: 640, ...extra };
    chunks.push(c);
    x += w;
    return c;
  };
  push('hall_start', 400);
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const kind: ChunkKind = r() < 0.5 ? 'duct' : r() < 0.5 ? 'ledge' : 'gap';
    const c = push(kind, 480);
    if (kind === 'duct') (c.low = true), (c.feature = [c.x + 60, c.x + 420]);
    if (kind === 'ledge') c.feature = [c.x + 120, c.x + 360];
    if (kind === 'gap') c.feature = [c.x + 180, c.x + 320];
    if (r() < 0.5) props.push(prop('pickup', safeX(c, c.x + 100 + r() * 250), 600, 28, 28, String(Math.floor(r() * 4))));
  }
  const attic = push('attic', 800);
  props.push(prop('rope', attic.x + 120, 380, 40, 260, 'rope'), prop('phone', attic.x + 320, 440, 50, 100, 'phone'), prop('sign', attic.x + 520, 440, 40, 50, 'attic'));
  if (r() < 0.5) props.push(prop('checklist', attic.x + 650, 600, 40, 40, 'checklist'));
  props.push(prop('sign', attic.x + 200, 440, 40, 50, 'map'));
  const end = push('hall_end', 400);
  props.push(prop('hatch', end.x + 200, 300, 80, 30, 'back'));
  return { depth, type: 'service', seed, chunks, width: x, props, spawns: [], budget: 0, guardian: null, goal: null, chaser: false, variant, passenger: null, fallback: false };
}
