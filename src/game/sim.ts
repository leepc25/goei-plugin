// 순찰 시뮬레이션: 화면과 상관없는 순수 상태 계산. 고정 간격 step()으로만 바뀐다.
import { AF, AGENTS, ENEMIES, EF, ROOMS, TUNE, type AgentDef, type AgentId, type EnemyDef, type EnemyId } from './data';

export const SAVE_VERSION = 1;

export interface Unit {
  uid: number;
  side: 'a' | 'e';
  kind: AgentId | EnemyId;
  x: number;
  /** 앞뒤 줄 (0 뒤 · 1 앞). 그리는 순서와 발 높이 */
  lane: 0 | 1;
  hp: number;
  max: number;
  act: 'walk' | 'idle' | 'attack' | 'skill' | 'hurt' | 'down' | 'dead' | 'rest' | 'rise';
  /** 지금 동작을 시작한 뒤 지난 시간 */
  t: number;
  /** 다음 공격까지 남은 시간 */
  cd: number;
  /** 기술 충전 0–1 (요원), 우두머리는 기술까지 남은 초 */
  gauge: number;
  /** 걷기 그림을 넘기는 데 쓰는 누적 이동 거리 */
  stride: number;
  /** 묶여서 못 움직이는 남은 초 */
  bound: number;
  /** 대형 순서 (요원) */
  slot: number;
  /** 기술이 다 찬 뒤 지난 시간 (탭할 틈을 준 뒤 알아서 쓴다) */
  ready: number;
  /** 이번 공격·기술의 타격을 이미 넣었는가 */
  hit: boolean;
  /** 맞았을 때 잠깐 하얗게 */
  flash: number;
  /** 쓰러진 뒤 사라지기까지 (적) */
  gone: number;
}

export interface Fx {
  kind: 'num' | 'heal' | 'boom' | 'ring' | 'bind';
  x: number;
  y: number;
  t: number;
  life: number;
  text?: string;
  big?: boolean;
}

export type Phase = 'patrol' | 'fade' | 'camp' | 'retreat';

export interface Run {
  phase: Phase;
  /** 지금 단계에 들어온 뒤 지난 시간 */
  pt: number;
  /** 몇 번째 순찰인가 (1부터). 깊을수록 적이 세다 */
  depth: number;
  /** 이번 순찰의 방 세 곳 (ROOMS 번호) */
  rooms: number[];
  /** 지금 방 (0–2) */
  room: number;
  /** 대형의 기준점 (선두 위치) */
  x: number;
  /** 다음에 나올 적 무리의 위치 */
  waves: number[];
  units: Unit[];
  fx: Fx[];
  seq: number;
  seed: number;
  /** 분대 피해 감소 남은 초 / 공격력 강화 남은 초 */
  guard: number;
  rally: number;
  /** 지금 화면 카메라 왼쪽 끝 (렌더러가 정하고 시뮬은 적이 나오는 위치에만 쓴다) */
  cam: number;
}

export interface Meta {
  version: number;
  squad: AgentId[];
  patrols: number;
  best: number;
  wipes: number;
  kills: Partial<Record<EnemyId, number>>;
  depth: number;
}

export const DEFAULT_SQUAD: AgentId[] = ['gorgo', 'jyaldi', 'eileen', 'deadfall'];

export function newMeta(): Meta {
  return { version: SAVE_VERSION, squad: [...DEFAULT_SQUAD], patrols: 0, best: 0, wipes: 0, kills: {}, depth: 1 };
}

/** 저장 문자열을 읽는다. 모양이 이상하면 처음부터 */
export function readMeta(raw: string | null): Meta {
  const m = newMeta();
  if (!raw) return m;
  try {
    const o = JSON.parse(raw) as Partial<Meta>;
    if (!o || typeof o !== 'object') return m;
    const ids = new Set(AGENTS.map((a) => a.id));
    if (Array.isArray(o.squad)) {
      const s = [...new Set(o.squad.filter((id): id is AgentId => ids.has(id as AgentId)))];
      if (s.length === 4) m.squad = s;
    }
    const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
    m.patrols = n(o.patrols, 0);
    m.best = n(o.best, 0);
    m.wipes = n(o.wipes, 0);
    m.depth = Math.max(1, n(o.depth, 1));
    if (o.kills && typeof o.kills === 'object') {
      for (const k of Object.keys(ENEMIES) as EnemyId[]) m.kills[k] = n((o.kills as Record<string, unknown>)[k], 0);
    }
  } catch {
    /* 깨진 저장은 버린다 */
  }
  return m;
}

export const agentDef = (id: AgentId): AgentDef => AGENTS.find((a) => a.id === id)!;
const isAgent = (u: Unit) => u.side === 'a';
export const alive = (u: Unit) => u.act !== 'down' && u.act !== 'dead' && u.act !== 'rise';

function rand(run: Run): number {
  // mulberry32
  let t = (run.seed = (run.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** 대형: 근접은 앞, 원거리는 뒤. 슬롯마다 기준점에서 뒤로 물러난 거리와 줄 */
const SLOT_BACK = [0, 38, 76, 114];
const SLOT_LANE: (0 | 1)[] = [1, 0, 1, 0];

function makeAgent(run: Run, id: AgentId, slot: number, x: number): Unit {
  const d = agentDef(id);
  return {
    uid: ++run.seq, side: 'a', kind: id, x: x - SLOT_BACK[slot], lane: SLOT_LANE[slot], hp: d.hp, max: d.hp,
    act: 'walk', t: 0, cd: 0.4 * slot, gauge: 0.35 + 0.15 * slot, stride: slot * 17, bound: 0, slot, ready: 0, hit: false, flash: 0, gone: 0,
  };
}

function scaled(run: Run, base: number): number {
  return Math.round(base * (1 + (run.depth - 1) * TUNE.depthScale));
}

function makeEnemy(run: Run, id: EnemyId, x: number, lane: 0 | 1): Unit {
  const d = ENEMIES[id];
  const hp = scaled(run, d.hp);
  return {
    uid: ++run.seq, side: 'e', kind: id, x, lane, hp, max: hp, act: 'walk', t: 0, cd: 0.6 + rand(run), gauge: 6,
    stride: rand(run) * 30, bound: 0, slot: 0, ready: 0, hit: false, flash: 0, gone: 0,
  };
}

function pickRooms(run: Run): number[] {
  const order = ROOMS.map((_, i) => i).sort(() => rand(run) - 0.5);
  // 첫 방은 늘 본관 복도
  return [0, ...order.filter((i) => i !== 0).slice(0, 2)];
}

function wavesFor(run: Run): number[] {
  const n = run.room === 2 ? 3 : 2 + (rand(run) < 0.5 ? 1 : 0);
  const len = TUNE.roomLen;
  return Array.from({ length: n }, (_, i) => Math.round(((i + 1) / (n + 1)) * len * 0.9 + rand(run) * 60));
}

export function newRun(meta: Meta, seed = Date.now() | 0): Run {
  const run: Run = {
    phase: 'patrol', pt: 0, depth: meta.depth, rooms: [], room: 0, x: 180, waves: [], units: [], fx: [], seq: 0, seed,
    guard: 0, rally: 0, cam: 0,
  };
  run.rooms = pickRooms(run);
  run.waves = wavesFor(run);
  formSquad(run, meta.squad, 'walk');
  return run;
}

/** 분대를 새로 세운다 (편성 바꿈, 은신처 출발) */
export function formSquad(run: Run, squad: AgentId[], act: Unit['act']): void {
  const order = [...squad].sort((a, b) => agentDef(a).range - agentDef(b).range);
  const keep = new Map(run.units.filter(isAgent).map((u) => [u.kind, u]));
  run.units = run.units.filter((u) => !isAgent(u));
  order.forEach((id, slot) => {
    const u = makeAgent(run, id, slot, run.x);
    const old = keep.get(id);
    if (old) (u.hp = Math.max(1, old.hp)), (u.gauge = old.gauge);
    u.act = act;
    run.units.push(u);
  });
}

/** 은신처에서는 의자를 놓을 만큼 넓게 앉힌다 */
function campLayout(run: Run): void {
  for (const a of agents(run)) a.x = 70 + a.slot * 74;
}

/** 편성을 바꾸면 은신처로 돌아가 새 분대로 다시 출발한다 */
export function applySquad(run: Run, meta: Meta, squad: AgentId[]): void {
  meta.squad = [...squad];
  run.phase = 'camp';
  run.pt = 0;
  run.units = [];
  run.fx = [];
  run.x = 220;
  formSquad(run, meta.squad, 'rest');
  campLayout(run);
}

export function agents(run: Run): Unit[] {
  return run.units.filter(isAgent);
}

export function enemies(run: Run): Unit[] {
  return run.units.filter((u) => u.side === 'e');
}

function spawnWave(run: Run, viewW: number): void {
  const edge = Math.max(run.x + 160, run.cam + viewW + 30);
  const last = run.room === 2 && run.waves.length === 0;
  const regular: EnemyId[] = ['corner', 'watchman'];
  if (last) {
    const boss: EnemyId = run.depth % 2 === 1 ? 'statue' : 'master';
    run.units.push(makeEnemy(run, boss, edge + 60, 1));
    run.units.push(makeEnemy(run, regular[Math.floor(rand(run) * 2)], edge + 10, 0));
    return;
  }
  const n = Math.min(5, 2 + Math.floor(rand(run) * 2) + Math.floor((run.depth - 1) / 2));
  for (let i = 0; i < n; i++) {
    run.units.push(makeEnemy(run, regular[Math.floor(rand(run) * 2)], edge + i * 46 + rand(run) * 20, (i % 2) as 0 | 1));
  }
}

function addNum(run: Run, u: Unit, amount: number, heal = false, big = false): void {
  const h = u.side === 'e' && ENEMIES[u.kind as EnemyId].scale === 2 ? 170 : 96;
  // 막 뜬 숫자와 겹치면 한 줄 위로
  let y = footY(u) - h;
  while (run.fx.some((f) => (f.kind === 'num' || f.kind === 'heal') && f.t < 0.35 && Math.abs(f.x - u.x) < 20 && Math.abs(f.y - y) < 12)) y -= 13;
  run.fx.push({ kind: heal ? 'heal' : 'num', x: u.x + (rand(run) * 10 - 5), y, t: 0, life: 0.8, text: String(Math.round(amount)), big });
}

/** 발이 닿는 높이 (논리 좌표) */
export function footY(u: Unit): number {
  return u.lane === 1 ? 336 : 318;
}

function damage(run: Run, from: Unit, to: Unit, amount: number, big = false): void {
  if (!alive(to)) return;
  let v = amount * (0.9 + rand(run) * 0.2);
  if (to.side === 'a' && run.guard > 0) v *= 0.5;
  if (from.side === 'a' && run.rally > 0) v *= 1.4;
  to.hp = Math.max(0, to.hp - v);
  to.flash = 0.12;
  addNum(run, to, v, false, big);
  if (to.hp <= 0) {
    to.act = to.side === 'a' ? 'down' : 'dead';
    to.t = 0;
  } else if (to.act === 'idle' || to.act === 'walk') {
    to.act = 'hurt';
    to.t = 0;
  }
}

function nearest(from: Unit, pool: Unit[]): Unit | undefined {
  let best: Unit | undefined;
  for (const u of pool) if (alive(u) && (!best || Math.abs(u.x - from.x) < Math.abs(best.x - from.x))) best = u;
  return best;
}

const ATTACK_TIME = 0.5;
const SKILL_TIME = 0.9;
const HURT_TIME = 0.22;
const DOWN_TIME = 0.6;
const DIE_TIME = 0.8;

/** 동작 시간을 그림 번호로 */
export function frameOf(u: Unit): number {
  if (u.side === 'a') {
    switch (u.act) {
      case 'walk': return AF.walk[Math.floor(u.stride / TUNE.strideStep) % AF.walk.length];
      case 'attack': return AF.attack[Math.min(AF.attack.length - 1, Math.floor((u.t / ATTACK_TIME) * AF.attack.length))];
      case 'skill': return AF.skill[Math.min(AF.skill.length - 1, Math.floor((u.t / SKILL_TIME) * AF.skill.length))];
      case 'hurt': return AF.hurt;
      case 'down': return AF.down[Math.min(AF.down.length - 1, Math.floor((u.t / DOWN_TIME) * AF.down.length))];
      case 'rise': return AF.rise[Math.min(AF.rise.length - 1, Math.floor((u.t / 0.4) * AF.rise.length))];
      case 'rest': return AF.rest[(Math.floor(u.t / 2.2) + u.slot) % AF.rest.length];
      default: return AF.idle;
    }
  }
  switch (u.act) {
    case 'walk': return EF.move[Math.floor(u.stride / 7) % EF.move.length];
    case 'attack': return EF.attack[Math.min(EF.attack.length - 1, Math.floor((u.t / enemyAttackTime(u)) * EF.attack.length))];
    case 'skill': return EF.skill[Math.min(EF.skill.length - 1, Math.floor((u.t / SKILL_TIME) * EF.skill.length))];
    case 'hurt': return EF.hurt;
    case 'dead': return EF.die[Math.min(EF.die.length - 1, Math.floor((u.t / DIE_TIME) * EF.die.length))];
    default: return EF.move[Math.floor(u.t * 4) % 2];
  }
}

const enemyAttackTime = (u: Unit) => (ENEMIES[u.kind as EnemyId].boss ? 0.8 : 0.6);

/** 탭으로 기술을 바로 쓴다. 충전이 덜 됐으면 아무 일 없음 */
export function trigger(run: Run, uid: number): boolean {
  const u = run.units.find((x) => x.uid === uid);
  if (!u || !alive(u) || u.gauge < 1 || run.phase !== 'patrol') return false;
  if (!enemies(run).some(alive)) return false;
  startSkill(u);
  return true;
}

function startSkill(u: Unit): void {
  u.act = 'skill';
  u.t = 0;
  u.hit = false;
  u.gauge = 0;
  u.ready = 0;
}

function applySkill(run: Run, u: Unit, foes: Unit[], team: Unit[]): void {
  const d = agentDef(u.kind as AgentId);
  const target = nearest(u, foes);
  switch (d.skill) {
    case 'blast': {
      if (!target) return;
      run.fx.push({ kind: 'boom', x: target.x, y: footY(target) - 40, t: 0, life: 0.5 });
      for (const f of foes) if (alive(f) && Math.abs(f.x - target.x) < 110) damage(run, u, f, d.atk * d.power, true);
      return;
    }
    case 'heal':
      for (const a of team) {
        if (!alive(a)) continue;
        const v = Math.min(a.max - a.hp, a.max * d.power);
        a.hp += v;
        if (v > 0) addNum(run, a, v, true);
      }
      run.fx.push({ kind: 'ring', x: u.x, y: footY(u) - 40, t: 0, life: 0.7 });
      return;
    case 'guard':
      run.guard = d.power;
      run.fx.push({ kind: 'ring', x: u.x, y: footY(u) - 44, t: 0, life: 0.6 });
      return;
    case 'rally':
      run.rally = d.power;
      run.fx.push({ kind: 'ring', x: u.x, y: footY(u) - 44, t: 0, life: 0.6 });
      return;
    case 'bind':
      if (!target) return;
      for (const f of foes) {
        if (!alive(f) || Math.abs(f.x - target.x) > 70) continue;
        f.bound = ENEMIES[f.kind as EnemyId].boss ? d.power / 2 : d.power;
        damage(run, u, f, d.atk * 1.5);
        run.fx.push({ kind: 'bind', x: f.x, y: footY(f) - 30, t: 0, life: f.bound });
      }
      return;
  }
}

function stepAgent(run: Run, u: Unit, dt: number, foes: Unit[], team: Unit[]): void {
  const d = agentDef(u.kind as AgentId);
  u.t += dt;
  u.flash = Math.max(0, u.flash - dt);
  if (u.act === 'down' || u.act === 'rest') return;
  if (u.act === 'rise') {
    if (u.t > 0.4) (u.act = 'idle'), (u.t = 0);
    return;
  }
  u.cd -= dt;
  if (foes.some(alive)) u.gauge = Math.min(1, u.gauge + dt / d.charge);
  if (u.act === 'hurt') {
    if (u.t > HURT_TIME) (u.act = 'idle'), (u.t = 0);
    return;
  }
  if (u.act === 'attack') {
    const target = nearest(u, foes);
    if (!u.hit && u.t >= (ATTACK_TIME * AF.attackHit) / AF.attack.length) {
      u.hit = true;
      if (target && Math.abs(target.x - u.x) <= d.range + 12) damage(run, u, target, d.atk);
    }
    if (u.t >= ATTACK_TIME) (u.act = 'idle'), (u.t = 0);
    return;
  }
  if (u.act === 'skill') {
    if (!u.hit && u.t >= (SKILL_TIME * AF.skillHit) / AF.skill.length) {
      u.hit = true;
      applySkill(run, u, foes, team);
    }
    if (u.t >= SKILL_TIME) (u.act = 'idle'), (u.t = 0);
    return;
  }
  const target = nearest(u, foes);
  // 충전이 다 차면 잠깐 기다렸다가(탭할 틈) 알아서 쓴다
  if (u.gauge >= 1) {
    u.ready += dt;
    if (target && u.ready > 1.8 && target.x - u.x < d.range + 40) return startSkill(u);
  }
  const home = run.x - SLOT_BACK[u.slot];
  let goal = home;
  if (target && target.x - u.x < d.range + 140) {
    // 사거리 안까지만 다가간다
    goal = Math.min(Math.max(home, target.x - d.range + 8), target.x - 18);
  }
  const dx = goal - u.x;
  if (Math.abs(dx) > 0.5) {
    const step = Math.sign(dx) * Math.min(Math.abs(dx), TUNE.walkSpeed * 1.25 * dt);
    u.x += step;
    u.stride += Math.abs(step);
    if (u.act !== 'walk') (u.act = 'walk'), (u.t = 0);
    return;
  }
  if (target && Math.abs(target.x - u.x) <= d.range + 4 && u.cd <= 0) {
    u.act = 'attack';
    u.t = 0;
    u.hit = false;
    u.cd = d.rate;
    return;
  }
  if (u.act !== 'idle') (u.act = 'idle'), (u.t = 0);
}

function stepEnemy(run: Run, u: Unit, dt: number, team: Unit[]): void {
  const d: EnemyDef = ENEMIES[u.kind as EnemyId];
  u.t += dt;
  u.flash = Math.max(0, u.flash - dt);
  if (u.act === 'dead') {
    u.gone += dt;
    return;
  }
  if (u.bound > 0) {
    u.bound = Math.max(0, u.bound - dt);
    if (u.act === 'walk' || u.act === 'attack') (u.act = 'idle'), (u.t = 0);
    return;
  }
  u.cd -= dt;
  if (u.act === 'hurt') {
    if (u.t > HURT_TIME) (u.act = 'idle'), (u.t = 0);
    return;
  }
  const guardian = run.guard > 0 ? team.find((a) => a.kind === 'gorgo' && alive(a)) : undefined;
  const target = guardian ?? nearest(u, team);
  if (u.act === 'attack') {
    const at = enemyAttackTime(u);
    if (!u.hit && u.t >= (at * EF.attackHit) / EF.attack.length) {
      u.hit = true;
      if (target && Math.abs(target.x - u.x) <= d.range + 14) damage(run, u, target, scaled(run, d.atk));
    }
    if (u.t >= at) (u.act = 'idle'), (u.t = 0);
    return;
  }
  if (u.act === 'skill') {
    if (!u.hit && u.t >= (SKILL_TIME * EF.skillHit) / EF.skill.length) {
      u.hit = true;
      run.fx.push({ kind: 'boom', x: u.x - 70, y: footY(u) - 30, t: 0, life: 0.5 });
      for (const a of team) if (alive(a) && u.x - a.x < 170) damage(run, u, a, scaled(run, d.atk) * 1.3, true);
    }
    if (u.t >= SKILL_TIME) (u.act = 'idle'), (u.t = 0);
    return;
  }
  if (!target) {
    if (u.act !== 'idle') (u.act = 'idle'), (u.t = 0);
    return;
  }
  if (d.boss) {
    u.gauge -= dt;
    if (u.gauge <= 0 && u.x - target.x < 190) {
      u.gauge = 7 + rand(run) * 3;
      u.act = 'skill';
      u.t = 0;
      u.hit = false;
      return;
    }
  }
  const gap = u.x - target.x;
  if (gap > d.range) {
    const step = Math.min(gap - d.range, d.speed * dt);
    u.x -= step;
    u.stride += step;
    if (u.act !== 'walk') (u.act = 'walk'), (u.t = 0);
    return;
  }
  if (u.cd <= 0) {
    u.act = 'attack';
    u.t = 0;
    u.hit = false;
    u.cd = d.rate;
    return;
  }
  if (u.act !== 'idle') (u.act = 'idle'), (u.t = 0);
}

export interface StepResult {
  /** 저장할 만한 변화 (처치·순찰 완료·전멸) */
  changed: boolean;
}

/** dt초 진행. viewW는 지금 화면 폭(논리 픽셀) */
export function step(run: Run, meta: Meta, dt: number, viewW: number): StepResult {
  const res: StepResult = { changed: false };
  run.pt += dt;
  run.guard = Math.max(0, run.guard - dt);
  run.rally = Math.max(0, run.rally - dt);
  for (const f of run.fx) f.t += dt;
  run.fx = run.fx.filter((f) => f.t < f.life);
  const team = agents(run);
  const foes = enemies(run);

  if (run.phase === 'camp') {
    for (const a of team) {
      a.t += dt;
      a.hp = Math.min(a.max, a.hp + a.max * 0.25 * dt);
      if (a.act !== 'rest') (a.act = 'rest'), (a.t = 0);
    }
    if (run.pt >= TUNE.campTime) {
      run.phase = 'fade';
      run.pt = 0;
      run.depth = meta.depth;
      run.rooms = pickRooms(run);
      run.room = 0;
      run.x = 180;
      run.units = [];
      formSquad(run, meta.squad, 'walk');
      run.waves = wavesFor(run);
      run.fx = [];
    }
    return res;
  }
  if (run.phase === 'fade' || run.phase === 'retreat') {
    if (run.phase === 'retreat' && run.pt >= 1.2) {
      run.phase = 'camp';
      run.pt = 0;
      run.units = [];
      run.x = 220;
      formSquad(run, meta.squad, 'rest');
      campLayout(run);
      for (const a of agents(run)) a.hp = Math.max(1, a.max * 0.3);
    }
    if (run.phase === 'fade' && run.pt >= 0.6) (run.phase = 'patrol'), (run.pt = 0);
    return res;
  }

  for (const u of team) stepAgent(run, u, dt, foes, team);
  for (const u of foes) stepEnemy(run, u, dt, team);

  // 쓰러진 적 정리 + 기록
  for (const f of foes) {
    if (f.act === 'dead' && f.gone > 1.6) {
      meta.kills[f.kind as EnemyId] = (meta.kills[f.kind as EnemyId] ?? 0) + 1;
      res.changed = true;
    }
  }
  run.units = run.units.filter((u) => !(u.side === 'e' && u.act === 'dead' && u.gone > 1.6));

  const livingFoes = enemies(run).some(alive);
  if (!team.some(alive)) {
    meta.wipes += 1;
    res.changed = true;
    run.phase = 'retreat';
    run.pt = 0;
    return res;
  }
  // 싸움이 없으면 대형 기준점이 앞으로
  const engaged = livingFoes && enemies(run).some((e) => alive(e) && e.x - run.x < 130);
  if (!engaged) {
    const lagging = team.some((a) => alive(a) && run.x - SLOT_BACK[a.slot] - a.x > 30);
    if (!lagging) run.x += TUNE.walkSpeed * dt;
  }
  if (run.waves.length && run.x >= run.waves[0] - 140) {
    run.waves.shift();
    spawnWave(run, viewW);
  }
  if (!livingFoes && !run.waves.length && run.x >= TUNE.roomLen && !enemies(run).length) {
    if (run.room < 2) {
      run.room += 1;
      run.phase = 'fade';
      run.pt = 0;
      run.x = 180;
      for (const a of team) {
        if (!alive(a)) (a.act = 'rise'), (a.t = 0), (a.hp = a.max * 0.25);
        a.x = run.x - SLOT_BACK[a.slot];
      }
      run.waves = wavesFor(run);
    } else {
      meta.patrols += 1;
      meta.best = Math.max(meta.best, run.depth);
      meta.depth = run.depth + 1;
      res.changed = true;
      run.phase = 'camp';
      run.pt = 0;
      run.units = [];
      run.x = 220;
      formSquad(run, meta.squad, 'rest');
      campLayout(run);
      for (const a of agents(run)) a.hp = Math.max(1, a.max * 0.5);
    }
  }
  return res;
}
