// 조각 기반 층 생성 (스테이지 설계서 5·15장). 방을 손으로 만들지 않는다.
// 순서: 깊이 → 유형 → 조각 수 → 경로 조각 나열(막다른 벽은 끝에만) → 고정 방 삽입 → 예산으로 적 자리
//       → 규칙 장치·사건·승객 → 검증(끝까지 길, 정비 구역 입구, 열쇠가 문보다 앞, 수호자 방 도달) → 실패 시 3번 다시 → 고정 배치 A/B.
import { ALL_CHUNKS, CHUNK_BY_ID, flipTerrain } from '../data/chunks';
import { B12, FLOOR_TYPES, REPLICA_SUB_GUARDIAN, REPLICA_SUB_RULES, budgetFor, depthLabel, REPLICA_SUB_LABEL } from '../data/floortypes';
import { mix, pick, range, rng, shuffle, type Rng } from '../rng';
import {
  CHUNK_W,
  DEEP_TYPES,
  LANE_DEPTH,
  ROOM_W,
  type ChunkTemplate,
  type DeepType,
  type FixedRoomKind,
  type Floor,
  type FloorSegment,
  type FloorType,
  type Placed,
  type PlacedKind,
  type ReplicaSub,
  type SpawnHook,
  type Terrain,
  type TrialGoal,
} from '../types';

/** 생성에 필요한 바깥 정보 (출동·영구 기록에서 온다) */
export interface GenContext {
  seed: number;
  depth: number;
  type: FloorType;
  sub?: ReplicaSub | null;
  danger: number;
  growth: number;
  /** 이번 출동 변형 flag 목록 */
  flags: string[];
  /** EXIT 재편 횟수: 승객 진실/거짓·수호자 배치가 바뀐다 */
  epoch: number;
  /** 이 층 패널에 EXIT가 뜨는가 (로비 L1, 조건 충족) */
  exitOpen?: boolean;
  /** 거울 규칙을 어기고 탔다 → 위협 +30% */
  tired?: boolean;
}

export const MAX_PIT = 130;
const MID = LANE_DEPTH / 2;

let nextId = 1;
const place = (kind: PlacedKind, x: number, lane: number, w: number, label: string, data: Placed['data'] = {}): Placed => ({ id: nextId++, kind, x: Math.round(x), lane: Math.round(lane), w, label, data });

/** 승강기 버튼이 보여 줄 다음 층 유형 뽑기. 직전 3층과 다른 유형, 시험 층은 3층마다 한 번 이상. epoch가 바뀌면 배치가 섞인다. */
export function pickType(depth: number, last: FloorType[], seed: number, epoch: number, salt = 0): FloorType {
  if (depth <= 3) return 'lobby';
  if (depth === B12) return 'deep';
  const r = rng(mix(seed, depth, epoch, salt, 77));
  const recent = last.slice(-3);
  if (!recent.includes('trial') && last.length >= 2 && r() < 0.6) return 'trial';
  const pool = DEEP_TYPES.filter((t) => !recent.includes(t));
  const order = shuffle(rng(mix(epoch, 991)), [...DEEP_TYPES]);
  // epoch마다 유형별 가중치가 다르다 (재편 = 배치가 섞임)
  const weights = pool.map((t) => 1 + (order.indexOf(t as DeepType) < 3 ? 0.8 : 0));
  let roll = r() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) if ((roll -= weights[i]) <= 0) return pool[i];
  return pool[0] ?? 'chase';
}
export function pickSub(seed: number, depth: number, epoch: number): ReplicaSub {
  return pick(rng(mix(seed, depth, epoch, 404)), ['vacant', 'pretending', 'red'] as const);
}

function chunkPool(type: FloorType, depth: number): ChunkTemplate[] {
  const own = ALL_CHUNKS.filter((c) => c.set === type && (c.minDepth ?? 0) <= depth);
  const common = ALL_CHUNKS.filter((c) => c.set === 'common');
  return type === 'deep' ? common.filter((c) => !c.terrain.some((t) => t.kind === 'pit')) : [...own, ...own, ...common];
}

/** 조각 순서를 고른다. 유형이 요구하는 장치는 반드시 한 번 이상. */
function pickSequence(ctx: GenContext, r: Rng, count: number): { t: ChunkTemplate; flip: boolean }[] {
  const pool = chunkPool(ctx.type, ctx.depth).filter((c) => !c.endOnly);
  const seq: ChunkTemplate[] = [];
  for (let i = 0; i < count; i++) {
    let t = pick(r, pool);
    // 같은 조각이 바로 이어지지 않게
    if (seq.length && seq[seq.length - 1].id === t.id) t = pick(r, pool);
    seq.push(t);
  }
  const need: string[] = [];
  if (ctx.type === 'puzzle') need.push('p_fork', 'p_switch');
  if (ctx.type === 'replica' && (ctx.sub ?? 'pretending') === 'pretending') need.push(r() < 0.5 ? 'r_living' : 'r_kitchen');
  if (ctx.type === 'replica' && ctx.sub === 'vacant') need.push('r_storage');
  if (ctx.type === 'chase') need.push('h_doors');
  if (ctx.type === 'trial') need.push('t_marks');
  const reserved = new Set<number>();
  const free = () => {
    const cands = seq.map((_, i) => i).filter((i) => !reserved.has(i) && !need.includes(seq[i].id));
    return cands.length ? cands[Math.floor(r() * cands.length)] : seq.length - 1;
  };
  for (const id of need) {
    const at = seq.findIndex((c, i) => c.id === id && !reserved.has(i));
    if (at >= 0) reserved.add(at);
    else {
      const i = free();
      seq[i] = CHUNK_BY_ID[id];
      reserved.add(i);
    }
  }
  // 정비 구역 입구 하나 이상
  const hasService = (c: ChunkTemplate) => c.slots.some((s) => s.kind === 'servicedoor' || s.kind === 'hatch');
  if (!seq.some(hasService)) seq[free()] = CHUNK_BY_ID[r() < 0.5 ? 'c_service' : 'c_hatch'];
  if (r() < 0.25) seq.push(CHUNK_BY_ID.c_deadend);
  return seq.map((t) => ({ t, flip: !t.device && r() < 0.4 }));
}

function roomTerrain(): Terrain[] {
  return [];
}

export function makeFloor(ctx: GenContext): Floor {
  for (let tries = 0; tries < 4; tries++) {
    const f = buildFloor(ctx, mix(ctx.seed, ctx.depth, ctx.epoch, tries * 7919), null);
    f.tries = tries;
    if (validateFloor(f).length === 0) return f;
  }
  const f = buildFloor(ctx, mix(ctx.seed, ctx.depth, 31337), ctx.seed % 2 ? 'A' : 'B');
  f.tries = 4;
  return f;
}

const FALLBACK: Record<'A' | 'B', string[]> = {
  A: ['c_flat', 'c_service', 'c_step', 'c_flat', 'c_wide', 'c_flat'],
  B: ['c_flat', 'c_pit', 'c_hatch', 'c_narrow', 'c_flat', 'c_flat'],
};

function buildFloor(ctx: GenContext, seed: number, fallback: 'A' | 'B' | null): Floor {
  nextId = 1;
  const r = rng(seed);
  const { depth, type } = ctx;
  const def = FLOOR_TYPES[type];
  const sub: ReplicaSub | null = type === 'replica' ? ctx.sub ?? 'pretending' : null;
  const count = type === 'lobby' ? range(r, 4, 6) : type === 'deep' ? 8 : Math.min(12, range(r, 6, 9) + Math.floor((depth - 4) / 4));
  let seq = fallback ? FALLBACK[fallback].map((id) => ({ t: CHUNK_BY_ID[id], flip: false })) : pickSequence(ctx, r, count);
  if (fallback && type === 'puzzle') seq.splice(2, 0, { t: CHUNK_BY_ID.p_fork, flip: false }, { t: CHUNK_BY_ID.p_switch, flip: false });
  if (fallback && type === 'trial') seq.splice(2, 0, { t: CHUNK_BY_ID.t_marks, flip: false });
  if (fallback && type === 'replica') seq.splice(2, 0, { t: CHUNK_BY_ID.r_living, flip: false }, { t: CHUNK_BY_ID.r_storage, flip: false });
  if (fallback && type === 'chase') seq.splice(1, 0, { t: CHUNK_BY_ID.h_doors, flip: false });
  // 로비 L1 튜토리얼: 구덩이·낮은 천장 없는 쉬운 조각만 앞에
  if (type === 'lobby' && depth === 1) seq = seq.map((c, i) => (i < 2 && c.t.terrain.some((t) => t.kind === 'pit' || t.kind === 'low') ? { t: CHUNK_BY_ID.c_flat, flip: false } : c));
  // 로비 L1에는 낮은 단(바닥을 가로지르는 판)을 두지 않는다: 매끈한 통로 판처럼 보인다 (검수 12-1). 조각의 소품은 그대로
  if (type === 'lobby' && depth === 1) seq = seq.map((c) => (c.t.terrain.some((t) => t.kind === 'block') ? { ...c, t: { ...c.t, terrain: c.t.terrain.filter((t) => t.kind !== 'block') } } : c));

  const segments: FloorSegment[] = [];
  const placed: Placed[] = [];
  const spawns: SpawnHook[] = [];
  let x = 0;
  const addRoom = (kind: FixedRoomKind, w = ROOM_W) => {
    segments.push({ ref: `room:${kind}`, x, w, flip: false, terrain: roomTerrain() });
    const x0 = x;
    x += w;
    return x0;
  };
  const addChunk = (t: ChunkTemplate, flip: boolean) => {
    const terrain = t.terrain.map((tr) => (flip ? flipTerrain(tr) : tr)).map((tr) => ({ ...tr, x0: tr.x0 + x, x1: tr.x1 + x }) as Terrain);
    segments.push({ ref: `chunk:${t.id}`, x, w: CHUNK_W, flip, terrain });
    const x0 = x;
    x += CHUNK_W;
    return x0;
  };

  // ── 시작 홀 (고정 방): 타고 온 엘리베이터 + 거울 + 점검표
  const hall = addRoom('elevator_hall');
  placed.push(place('elevator', hall + 200, 0, 160, '타고 온 엘리베이터', { noreturn: true }));
  placed.push(place('mirror', hall + 470, 0, 60, '거울'));
  if (depth === 1) placed.push(place('checklist', hall + 640, 0, 50, '정기 점검표', { rule: 'entry' }));
  if (depth === 1) placed.push(place('sign', hall + 860, 0, 50, '안내문', { rule: 'noreturn' }));
  if (depth === 2) placed.push(place('sign', hall + 860, 0, 50, '안내판 (글자가 섞임)', { rule: 'lobby' }));
  if (type === 'deep') placed.push(place('sign', hall + 860, 0, 50, '긁힌 글씨', { rule: 'b12' }));

  // 시험 층 목표 방: 들어가자마자 (변형 trial_mid면 한가운데)
  const goalBox: { g: TrialGoal | null } = { g: null };
  const goalMid = ctx.flags.includes('trial_mid');
  const goalRoom = () => {
    const gx = addRoom('trial_goal', CHUNK_W);
    const goal = (goalBox.g = makeGoal(r, depth));
    placed.push(place('goalwall', gx + 320, 0, 240, '목표', { text: goal.text }));
    placed.push(place('sign', gx + 80, 0, 50, '시험 안내', { rule: 'trial' }));
  };
  if (type === 'trial' && !goalMid) goalRoom();

  // ── 조각들
  let ruleSigns = [...(type === 'replica' && sub ? REPLICA_SUB_RULES[sub] : def.rules)];
  if (type === 'lobby' && depth !== 2) ruleSigns = depth === 3 ? ['l_clock'] : ['greet'];
  let forkN = 0;
  const chunkBase: { x: number; t: ChunkTemplate; flip: boolean; index: number }[] = [];
  seq.forEach((c, i) => {
    if (type === 'trial' && goalMid && i === Math.floor(seq.length / 2)) goalRoom();
    const bx = addChunk(c.t, c.flip);
    chunkBase.push({ x: bx, t: c.t, flip: c.flip, index: i });
  });

  // 얹기: 조각 자리(slot)에 유형별로
  const markXs: number[] = [];
  const bellXs: number[] = [];
  let serviceCount = 0;
  for (const cb of chunkBase) {
    const sx = (v: number) => cb.x + (cb.flip ? CHUNK_W - v : v);
    const t = cb.t;
    // 장치 조각
    if (t.device === 'fork') {
      forkN++;
      const doors = t.slots.filter((s) => s.kind === 'door');
      const correct = r() < 0.5 ? 0 : 1;
      const shown = ctx.flags.includes('puzzle_mirror') ? 1 - correct : correct;
      const signSlot = t.slots.find((s) => s.kind === 'sign')!;
      placed.push(place('sign', sx(signSlot.x), 0, 50, '표지 (읽어야 보임)', { rule: 'p_sign', arrow: shown === 0 ? '왼쪽 문' : '오른쪽 문', fork: forkN }));
      doors.forEach((d, k) => placed.push(place('door', sx(d.x), 0, 90, k === 0 ? '왼쪽 문' : '오른쪽 문', { correct: k === correct, fork: forkN })));
      placed.push(place('shutter', cb.x + CHUNK_W - 30, MID, 40, '닫힌 셔터', { fork: forkN, open: false }));
      continue;
    }
    if (t.device === 'switches') {
      const sw = t.slots.filter((s) => s.kind === 'switch');
      const order = shuffle(r, sw.map((_, k) => k + 1));
      const signSlot = t.slots.find((s) => s.kind === 'sign')!;
      placed.push(place('sign', sx(signSlot.x), 0, 50, '순서 표지', { rule: 'p_order', order: order.join('-') }));
      sw.forEach((s, k) => placed.push(place('switch', sx(s.x), s.lane ?? 20, 40, `스위치 ${'①②③④'[k]}`, { n: k + 1, group: cb.index })));
      placed.push(place('shutter', cb.x + CHUNK_W - 30, MID, 40, '닫힌 셔터', { group: cb.index, order: order.join('-'), open: false }));
      continue;
    }
    if (t.device === 'meal' && sub === 'pretending') placed.push(place('table', cb.x + 320, 40, 140, '차려진 밥상', { rule: 'r_meal' }));
    for (const s of t.slots) {
      const px = sx(s.x),
        lane = s.lane ?? MID;
      switch (s.kind) {
        case 'servicedoor':
          serviceCount++;
          placed.push(place('servicedoor', px, 0, 70, '점검문'));
          break;
        case 'hatch':
          if (serviceCount < 2 || r() < 0.4) serviceCount++, placed.push(place('hatch', px, lane, 80, '천장 해치'));
          break;
        case 'door':
          if (type === 'chase') placed.push(place('chasedoor', px, 0, 60, '방화문', { closed: false }));
          else if (r() < 0.5) placed.push(place('prop', px, 0, 70, '잠긴 문'));
          break;
        case 'sign':
          if (ruleSigns.length) {
            const id = ruleSigns.shift()!;
            placed.push(place('sign', px, 0, 50, '규칙 표지', { rule: id }));
          } else if (r() < 0.25) placed.push(place('symbol', px, 0, 40, '벽 기호', { danger: r() < 0.5 ? 1 : 0 }));
          else if (type === 'lobby' && r() < 0.5) placed.push(place('prop', px, 0, 50, '거꾸로 가는 시계'));
          break;
        case 'prop':
          placed.push(place('prop', px, lane, 60, propLabel(type, sub, r)));
          break;
        case 'item':
          if (type === 'trial') markXs.push(px), placed.push(place('mark', px, lane, 30, '표식', { found: false }));
          else if (type === 'replica' && sub === 'vacant') placed.push(place('belonging', px, lane, 30, pick(r, ['남의 지갑', '아이 신발', '가족 사진', '열쇠 꾸러미']), { rule: 'r_things' }));
          else if (r() < 0.5) placed.push(place('item', px, lane, 28, '보급품', { item: pick(r, ['heal', 'heal', 'light', 'guard', 'ammo']) }));
          break;
        case 'switch':
          if (type === 'trial') bellXs.push(px), placed.push(place('switch', px, lane, 40, '종', { bell: true, n: bellXs.length }));
          break;
        case 'npc':
          if (type === 'replica' && sub !== 'vacant') spawns.push(hook('resident', 'resident', px, lane, 0, false, { greeted: false, asleep: true }));
          else if (type === 'lobby') spawns.push(hook('enemy', 'lurker', px, lane, 0, false, { harmless: true }));
          break;
        case 'enemy':
          break; // 아래 예산 단계에서
      }
    }
    // 재현 붉은 벽: 붉은 바닥을 얹는다
    if (type === 'replica' && sub === 'red' && r() < 0.6) {
      const a = cb.x + 120 + Math.floor(r() * 240);
      const lane0 = r() < 0.5 ? 0 : 80;
      segments.find((s) => s.x === cb.x)!.terrain.push({ kind: 'redfloor', x0: a, x1: a + 160, lane0, lane1: lane0 + 80 });
    }
  }

  // ── 적 자리: 예산으로 산다 (실제 행동은 적 작업이 kind로 만든다). 화면(조각 2개)당 8 상한, 넘치면 정예.
  const tired = ctx.tired ? 1.3 : 1;
  const pool = def.enemies;
  let total = 0;
  if (pool.length) {
    for (const cb of chunkBase) {
      if (type === 'lobby' && depth === 1 && cb.index < 2) continue;
      const slots = cb.t.slots.filter((s) => s.kind === 'enemy');
      if (!slots.length) continue;
      let left = Math.round(budgetFor(depth, cb.index, ctx.danger, ctx.flags.length * 2, ctx.growth) * tired);
      total += left;
      let n = 0;
      while (left >= 8 && n < 8) {
        const ok = pool.filter((e) => e.price <= left);
        if (!ok.length) break;
        const e = pick(r, ok);
        const s = slots[n % slots.length];
        const px = cb.x + (cb.flip ? CHUNK_W - s.x : s.x) + (n >= slots.length ? (r() - 0.5) * 160 : 0);
        spawns.push(hook('enemy', e.kind, px, n % 2 ? (s.lane ?? MID) : r() * LANE_DEPTH, n >= 4 ? 1 : 0, false, {}));
        left -= e.price;
        n++;
      }
      // 남은 예산은 정예로
      const mine = spawns.filter((h) => h.role === 'enemy' && h.x >= cb.x && h.x < cb.x + CHUNK_W);
      while (left >= 15 && mine.some((m) => !m.elite)) {
        mine.find((m) => !m.elite)!.elite = true;
        left -= 15;
      }
    }
  }
  // 어둠: 멈추면 다가오는 '체온을 재는 것' 자리 / B-12: 만지는 것들
  if (type === 'dark') spawns.push(hook('stalker', 'warmth', 0, MID, 0, false, { follows: true }));
  if (type === 'deep') for (let k = 0; k < 6; k++) spawns.push(hook('stalker', 'toucher', chunkBase[1 + (k % (chunkBase.length - 1))].x + 320, r() * LANE_DEPTH, 0, false, {}));

  // ── B-12 낙서 (원문 여담 반전: 수호자 확률 2배)
  const b12mark = depth > 4 && type !== 'deep' && r() < 0.15;
  if (b12mark) placed.push(place('b12', chunkBase[0].x + 300, 0, 80, 'B-12', { rule: 'b12' }));

  // ── 수호자 방: L3는 반드시, 지하는 깊이에 따른 확률(B-12 낙서면 2배). 시험 층은 실패하면 나온다.
  let guardian: string | null = null;
  const guardianP = type === 'deep' ? 1 : depth === 3 ? 1 : depth < 3 ? 0 : Math.min(1, (0.35 + (depth - 4) * 0.05) * (b12mark ? 2 : 1));
  if (r() < guardianP || type === 'trial') {
    const gx = addRoom('guardian_room');
    const cands = def.guardians;
    const g = type === 'replica' && sub ? cands.find((c) => c.kind === REPLICA_SUB_GUARDIAN[sub])! : cands[mix(ctx.epoch, depth) % cands.length];
    guardian = g.kind;
    if (type === 'deep') {
      // 버티고 지나가기: 수호자는 몸이 아니라 방 전체
      spawns.push(hook('guardian', g.kind, gx + 640, MID, 0, false, { label: g.label, weakness: g.weakness, survive: true }));
    } else {
      spawns.push(hook('guardian', g.kind, gx + 900, MID, 0, depth >= 9, { label: g.label, weakness: g.weakness, onFail: type === 'trial' }));
      if (g.kind === 'elder') placed.push(place('table', gx + 520, 40, 160, '405호 밥상', { rule: 'r_meal', guardian: true }));
      if (g.kind === 'legs') for (let k = 0; k < 3; k++) placed.push(place('prop', gx + 200 + k * 300, 120, 60, '틈새 (밀어 막기)', { gap: k }));
      if (g.kind === 'guard' || g.kind === 'conductor') placed.push(place('prop', gx + 120, 0, 40, '순찰 경로 표시'));
    }
  }

  // ── 끝 홀: 승강기 패널 (L1에 EXIT 조건 충족이면 출구 홀)
  const end = addRoom(ctx.exitOpen ? 'exit_hall' : 'elevator_hall');
  placed.push(place('panel', end + 900, 0, 80, ctx.exitOpen ? '승강기 패널 (EXIT 불이 켜짐)' : '승강기 패널', { exit: !!ctx.exitOpen }));
  placed.push(place('elevator', end + 1080, 0, 160, '열린 엘리베이터'));

  // ── 떠도는 승객 (로비 L2부터, 층마다 p=0.5). 정직/거짓 50:50, epoch마다 다시 섞임. 사연 길이가 단서(규칙 8).
  if (depth >= 2 && type !== 'deep' && r() < 0.5) {
    const kinds = ['three_years', 'markers', 'supply', 'nothuman', 'missing'] as const;
    const kind = pick(r, depth < 5 ? kinds.slice(0, 3) : kinds);
    const honest = rng(mix(ctx.seed, depth, ctx.epoch, 5150))() < 0.5;
    const cb = chunkBase[1 + Math.floor(r() * Math.max(1, chunkBase.length - 2))];
    const flip = ctx.flags.includes('passenger_flip');
    const storyLong = flip ? honest : !honest;
    spawns.push(hook('passenger', kind, cb.x + 420, 30, 0, false, { honest, long: storyLong, fork: forkN > 0 ? 1 : 0 }));
  }

  // E는 가장 가까운 것 하나만 잡는다: 줍는 것·기호가 길(문·패널·표지 등)과 60px 안에 겹치면 뺀다
  const minor = new Set<PlacedKind>(['item', 'symbol', 'belonging', 'mark', 'prop']);
  const ways = placed.filter((p) => !minor.has(p.kind));
  for (let i = placed.length - 1; i >= 0; i--) {
    const p = placed[i];
    if (minor.has(p.kind) && p.kind !== 'prop' && (ways.some((w) => Math.abs(w.x - p.x) < 60) || placed.some((q, j) => j < i && minor.has(q.kind) && q.kind !== 'prop' && Math.abs(q.x - p.x) < 60))) {
      if (p.kind === 'mark') markXs.splice(markXs.indexOf(p.x), 1);
      placed.splice(i, 1);
    }
  }
  const palette = def.palette;
  const label = `${depthLabel(depth)} · ${def.label}${sub ? ` (${REPLICA_SUB_LABEL[sub]})` : ''}`;
  const tuning: Record<string, number> = {
    chaseSpeed: (150 + depth * 6) * (ctx.flags.includes('chase_fast') ? 1.4 : 1),
    noiseMul: ctx.flags.includes('silent_fast') ? 2 : 1,
    lightFade: ctx.flags.includes('dark_fast') ? 2 : 1,
    squeeze: 70 + seq.length * 12,
    b12: b12mark ? 1 : 0,
  };
  return {
    depth,
    label,
    type,
    sub,
    seed,
    width: x,
    segments,
    placed,
    spawns,
    budget: total,
    guardian,
    goal: goalBox.g ? { ...goalBox.g, need: Math.min(goalBox.g.need, goalBox.g.kind === 'marks' ? Math.max(1, markXs.length) : 99) } : null,
    rules: type === 'replica' && sub ? REPLICA_SUB_RULES[sub] : def.rules,
    tuning,
    palette,
    fallback: fallback ?? '',
    tries: 0,
  };
}

function hook(role: SpawnHook['role'], kind: string, x: number, lane: number, wave: number, elite: boolean, data: SpawnHook['data']): SpawnHook {
  return { id: nextId++, role, kind, x: Math.round(x), lane: Math.round(lane), wave, elite, data };
}

function makeGoal(r: Rng, depth: number): TrialGoal {
  const n = depth - 3;
  const opts: TrialGoal[] = [
    { kind: 'marks', need: Math.min(4, 2 + Math.floor(n / 3)), time: 60, text: '' },
    { kind: 'nostop', need: 1, time: 50, text: '' },
    { kind: 'clear', need: 1, time: 75, text: '' },
  ];
  const g = pick(r, opts);
  g.text = g.kind === 'marks' ? `${g.time}초 안에 표식 ${g.need}개를 찾아라` : g.kind === 'nostop' ? `${g.time}초 안에 끝까지 가라. 멈추지 마라` : `${g.time}초 안에 이 층의 것들을 쓰러뜨려라`;
  return g;
}

function propLabel(type: FloorType, sub: ReplicaSub | null, r: Rng): string {
  const sets: Record<string, string[]> = {
    lobby: ['화분', '소파', '정수기', '게시판', '자판기', '우산꽂이'],
    silent: ['책장', '그릇 선반', '멈춘 괘종시계', '카펫 말이'],
    dark: ['꺼진 형광등', '쓰러진 의자', '배관'],
    chase: ['쓰러진 캐비닛', '찢긴 블라인드', '부서진 문짝'],
    puzzle: ['같은 액자', '같은 화분', '거꾸로 걸린 표지'],
    replica: sub === 'red' ? ['붉은 벽지', '문틀', '붉은 손자국'] : sub === 'vacant' ? ['먼지 쌓인 신발장', '덮인 가구', '멈춘 냉장고'] : ['신발장', '텔레비전', '가족 사진', '냉장고'],
    trial: ['점수판', '사물함', '번호표'],
    deep: ['…'],
  };
  return pick(r, sets[type] ?? ['상자']);
}

/** 검증. 문제 목록을 돌려준다(빈 배열 = 통과). */
export function validateFloor(f: Floor): string[] {
  const bad: string[] = [];
  if (!f.segments[0]?.ref.startsWith('room:elevator_hall')) bad.push('시작 홀 없음');
  const last = f.segments[f.segments.length - 1];
  if (!last || !(last.ref === 'room:elevator_hall' || last.ref === 'room:exit_hall')) bad.push('끝 홀 없음');
  const terr = f.segments.flatMap((s) => s.terrain);
  for (const t of terr) if (t.kind === 'pit' && t.x1 - t.x0 > MAX_PIT) bad.push(`구덩이 너무 넓음 ${t.x0}`);
  // 구덩이와 낮은 천장이 겹치면(앉은 채 점프 불가) 길이 없다
  for (const p of terr.filter((t) => t.kind === 'pit')) for (const l of terr.filter((t) => t.kind === 'low')) if (p.x0 < l.x1 + 60 && l.x0 < p.x1 + 60) bad.push('구덩이·낮은 천장 겹침');
  // 구덩이 끼리 붙어 있으면 착지 자리 없음
  const pits = terr.filter((t) => t.kind === 'pit').sort((a, b) => a.x0 - b.x0);
  for (let i = 1; i < pits.length; i++) if (pits[i].x0 - pits[i - 1].x1 < 80) bad.push('구덩이 사이 착지 자리 없음');
  if (f.type !== 'deep' && !f.placed.some((p) => p.kind === 'servicedoor' || p.kind === 'hatch')) bad.push('정비 구역 입구 없음');
  // 열쇠가 문보다 앞: 갈림길 표지 → 문 → 셔터 순서
  for (const sh of f.placed.filter((p) => p.kind === 'shutter')) {
    if (sh.data.fork !== undefined) {
      const sign = f.placed.find((p) => p.kind === 'sign' && p.data.fork === sh.data.fork);
      const doors = f.placed.filter((p) => p.kind === 'door' && p.data.fork === sh.data.fork);
      if (!sign || doors.length !== 2 || sign.x > Math.min(...doors.map((d) => d.x)) || doors.some((d) => d.x > sh.x)) bad.push('갈림길 순서');
      if (doors.filter((d) => d.data.correct).length !== 1) bad.push('정답 문 수');
    }
    if (sh.data.group !== undefined) {
      const sw = f.placed.filter((p) => p.kind === 'switch' && p.data.group === sh.data.group);
      if (sw.length < 2 || sw.some((s) => s.x > sh.x)) bad.push('스위치 순서');
    }
  }
  if (f.type === 'puzzle' && !f.placed.some((p) => p.kind === 'shutter')) bad.push('퍼즐 장치 없음');
  if (f.type === 'replica' && f.sub === 'pretending' && !f.placed.some((p) => p.kind === 'table')) bad.push('밥상 없음');
  if (f.goal) {
    if (f.goal.kind === 'marks' && f.placed.filter((p) => p.kind === 'mark').length < f.goal.need) bad.push('표식 모자람');
    if (!f.placed.some((p) => p.kind === 'goalwall')) bad.push('목표 벽 없음');
  }
  if (f.guardian) {
    const g = f.spawns.find((s) => s.role === 'guardian');
    const panel = f.placed.find((p) => p.kind === 'panel');
    if (!g || !panel || g.x > panel.x) bad.push('수호자 방 도달');
  }
  if (!f.placed.some((p) => p.kind === 'panel')) bad.push('패널 없음');
  if (f.depth >= 4 && f.type !== 'deep' && !f.placed.some((p) => p.kind === 'sign' && p.data.rule)) bad.push('규칙 장치 없음');
  return bad;
}
