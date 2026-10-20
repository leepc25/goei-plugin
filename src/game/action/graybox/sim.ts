// 회색 상자 시험판 · 시뮬레이션 (DOM 없음, 30Hz 고정). 그림 없이 전투·조각 생성·규칙·드랍·강화·정비 구역·승강기·후송을 돌린다.
import { AGENTS, ENEMIES, GUARDIANS, MISSIONS, RULES, RULE_BY_ID, TYPE_LABEL, UPGRADES, depthLabel, type AgentDef, type FloorType } from './data';
import { CHUNK, LANE_MAX, LANE_MIN, makeFloor, makeService, pickType, rng, type Chunk, type Floor, type Prop } from './gen';

export const W = 1280,
  H = 720,
  DT = 1 / 30,
  SAVE_VERSION = 1;
export type Phase = 'hq' | 'brief' | 'floor' | 'service' | 'settle';
export interface Ent {
  id: number;
  kind: string;
  label: string;
  x: number;
  y: number;
  z: number;
  vz: number;
  dir: number;
  hp: number;
  max: number;
  w: number;
  h: number;
  act: string;
  t: number;
  stun: number;
  down: number;
  inv: number;
  flash: number;
  armor: number;
  speed: number;
  atk: number;
  reach: number;
  windup: number;
  cool: number;
  state: 'idle' | 'approach' | 'windup' | 'attack' | 'patrol' | 'friendly' | 'follow' | 'held' | 'thrown' | 'dead';
  timer: number;
  /** 보조 시계: 순찰 경계 시간·천장 이동 주기 (timer는 준비·공격용) */
  aux: number;
  elite: boolean;
  guardian: boolean;
  special: string;
  hostile: boolean;
  patrol: [number, number] | null;
  alive: boolean;
  honest: boolean;
  vx: number;
  wave: number;
  spawned: boolean;
}
export interface Player {
  x: number;
  y: number;
  z: number;
  vz: number;
  dir: number;
  hp: number;
  max: number;
  act: string;
  t: number;
  stun: number;
  down: number;
  inv: number;
  flash: number;
  energy: number;
  gauge: number;
  guarding: boolean;
  guardBuff: number;
  items: number[];
  combo: number;
  comboWindow: number;
  evadeCd: number;
  uniqueCd: number;
  shotCd: number;
  crouch: boolean;
  running: boolean;
  grab: number | null;
  noise: number;
  lit: number;
  still: number;
  reversed: boolean;
  keys: number;
  hitOnce: boolean;
}
export interface Bolt {
  x: number;
  y: number;
  z: number;
  vx: number;
  life: number;
  enemy: boolean;
  dmg: number;
}
export interface Effect {
  x: number;
  y: number;
  t: number;
  dur: number;
  kind: 'hit' | 'blast' | 'guard' | 'text' | 'ripple';
  text?: string;
}
export interface Dialog {
  title: string;
  lines: string[];
  options: string[];
  /** 선택 처리 id */
  tag: string;
  data?: string;
}
export interface ElevatorUi {
  greeted: boolean;
  buttons: { depth: number; type: FloorType; known: boolean }[];
}
export interface Meta {
  rulebook: string[];
  currencies: { cash: number; budget: number; research: number; teeth: number };
  deepest: number;
  missionsDone: string[];
  runs: number;
  size: 128 | 96 | 80;
  lastTypes: FloorType[];
  bestFloors: number;
}
export interface Run {
  version: number;
  phase: Phase;
  agent: AgentDef['id'];
  mission: string;
  depth: number;
  seed: number;
  floor: Floor;
  service: Floor | null;
  returnX: number;
  /** 정비 구역에 있는 동안 층의 존재들을 보관 */
  floorEnts: Ent[];
  serviceCd: number;
  player: Player;
  ents: Ent[];
  bolts: Bolt[];
  effects: Effect[];
  time: number;
  floorTime: number;
  message: string;
  msgT: number;
  log: string[];
  favor: number;
  found: string[];
  sent: string[];
  loot: { cash: number; budget: number; research: number; teeth: number };
  upgrades: string[];
  hitstop: number;
  shake: number;
  visited: { depth: number; type: FloorType }[];
  chaserX: number;
  chaserSlow: number;
  chaseHurtT: number;
  trial: { kills: number; left: number; done: boolean; failed: boolean; started: boolean } | null;
  atticT: number;
  atticHealed: boolean;
  predatorSpawned: boolean;
  dialog: Dialog | null;
  elevator: ElevatorUi | null;
  upgradePick: string[] | null;
  rescue: { found: boolean; delivered: boolean };
  ended: 'return' | 'evac' | null;
  kills: number;
  guardianDead: boolean;
  closeSpam: number;
  deals: number;
  nextId: number;
  danger: number;
  growth: number;
  checklist: boolean;
  elderSkipped: boolean;
  settle: string[] | null;
  hqMission: number;
  hqAgent: number;
  cutin: number;
}
export interface Input {
  x: number;
  y: number;
  run?: boolean;
  attack?: boolean;
  shoot?: boolean;
  unique?: boolean;
  guard?: boolean;
  ult?: boolean;
  interact?: boolean;
  jump?: boolean;
  evade?: boolean;
  item?: number;
  choice?: number;
  cancel?: boolean;
  auto?: boolean;
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const agentDef = (id: AgentDef['id']) => AGENTS.find((a) => a.id === id) ?? AGENTS[0];

export function newMeta(): Meta {
  return { rulebook: [], currencies: { cash: 0, budget: 0, research: 0, teeth: 0 }, deepest: 0, missionsDone: [], runs: 0, size: 128, lastTypes: [], bestFloors: 0 };
}
function newPlayer(a: AgentDef): Player {
  return { x: 200, y: 580, z: 0, vz: 0, dir: 1, hp: a.hp, max: a.hp, act: 'idle', t: 0, stun: 0, down: 0, inv: 0, flash: 0, energy: 100, gauge: 0, guarding: false, guardBuff: 0, items: [2, 1, 1, 1], combo: 0, comboWindow: 0, evadeCd: 0, uniqueCd: 0, shotCd: 0, crouch: false, running: false, grab: null, noise: 0, lit: 0, still: 0, reversed: false, keys: 0, hitOnce: false };
}
export function newRun(meta: Meta, agent: AgentDef['id'] = 'jyaldi', mission = 'm1', seed = Math.floor(Math.random() * 1e9)): Run {
  const a = agentDef(agent);
  const run: Run = {
    version: SAVE_VERSION, phase: 'hq', agent, mission, depth: 0, seed, floor: makeFloor(1, 'lobby', seed, 0, 0), service: null, returnX: 0, floorEnts: [], serviceCd: 0, player: newPlayer(a), ents: [], bolts: [], effects: [], time: 0, floorTime: 0, message: '', msgT: 0, log: [], favor: 0, found: [], sent: [], loot: { cash: 0, budget: 0, research: 0, teeth: 0 }, upgrades: [], hitstop: 0, shake: 0, visited: [], chaserX: -9999, chaserSlow: 0, chaseHurtT: 0, trial: null, atticT: 0, atticHealed: false, predatorSpawned: false, dialog: null, elevator: null, upgradePick: null, rescue: { found: false, delivered: false }, ended: null, kills: 0, guardianDead: false, closeSpam: 0, deals: 0, nextId: 1, danger: Math.min(3, Math.floor(meta.missionsDone.length / 3)), growth: Math.min(5, Math.floor(meta.runs / 4)), checklist: false, elderSkipped: false, settle: null, hqMission: 0, hqAgent: 0, cutin: 0,
  };
  return run;
}
export function unlockedMissions(meta: Meta) {
  return MISSIONS.filter((m) => !m.requires || meta.missionsDone.includes(m.requires));
}
export function say(run: Run, text: string, t = 3) {
  run.message = text;
  run.msgT = t;
  run.log.push(text);
  if (run.log.length > 40) run.log.shift();
}
function fx(run: Run, kind: Effect['kind'], x: number, y: number, dur = 0.25, text?: string) {
  run.effects.push({ x, y, t: 0, dur, kind, text });
}
function foundRule(run: Run, id: string) {
  if (!RULE_BY_ID[id] || run.found.includes(id)) return;
  run.found.push(id);
  say(run, `규칙 발견: ${RULE_BY_ID[id].text}`, 4);
  fx(run, 'text', run.player.x, run.player.y - 300, 1.5, '규칙서 +1');
}

/** 출동 시작: 본부 → 브리핑 → L1 */
export function deploy(run: Run, meta: Meta) {
  const a = agentDef(run.agent);
  run.player = newPlayer(a);
  run.depth = 0;
  run.favor = 0;
  run.found = [];
  run.sent = [];
  run.loot = { cash: 0, budget: 0, research: 0, teeth: 0 };
  run.upgrades = [];
  run.visited = [];
  run.kills = 0;
  run.deals = 0;
  run.closeSpam = 0;
  run.checklist = false;
  run.rescue = { found: false, delivered: false };
  run.ended = null;
  run.settle = null;
  run.time = 0;
  meta.runs++;
  enterFloor(run, 1, 'lobby');
}
export function enterFloor(run: Run, depth: number, type: FloorType) {
  const last = run.visited.map((v) => v.type);
  run.depth = depth;
  run.floor = makeFloor(depth, type, run.seed + depth * 97, run.danger, run.growth, { rescue: run.mission === 'm4' && !run.rescue.found && depth >= 4 && depth <= 5 });
  run.visited.push({ depth, type });
  if (run.visited.length > 60) run.visited.shift();
  run.phase = 'floor';
  run.service = null;
  run.floorEnts = [];
  run.serviceCd = 0;
  run.ents = [];
  run.bolts = [];
  run.effects = [];
  run.floorTime = 0;
  run.guardianDead = false;
  run.elderSkipped = false;
  run.trial = type === 'trial' ? { kills: 0, left: 45, done: false, failed: false, started: false } : null;
  run.chaserX = type === 'chase' ? -600 : -99999;
  run.chaserSlow = 0;
  run.chaseHurtT = 0;
  run.elevator = null;
  run.dialog = null;
  run.player.x = 200;
  run.player.y = 580;
  run.player.z = 0;
  run.player.reversed = false;
  run.player.noise = 0;
  for (const s of run.floor.spawns) spawnEnt(run, s.kind, s.x, s.y, s.elite, s.guardian, s.wave);
  if (run.floor.passenger) {
    const e = spawnEnt(run, 'passenger', run.floor.passenger.x, 600, false, false, 0);
    e.honest = run.floor.passenger.honest;
    e.hostile = false;
    e.state = 'friendly';
    e.label = run.floor.passenger.rescue ? '실종 신고된 회사원' : run.floor.passenger.honest ? '삼 년째 승객' : '친절한 승객';
    if (run.floor.passenger.rescue) e.honest = true;
  }
  say(run, `띵. ${depthLabel(depth)}입니다. 문이 열립니다. · ${TYPE_LABEL[type]}${run.floor.variant ? ` · 변형: ${run.floor.variant}` : ''}${run.floor.fallback ? ' · 고정 배치' : ''}`, 4);
  void last;
}
function spawnEnt(run: Run, kind: string, x: number, y: number, elite: boolean, guardian: boolean, wave: number): Ent {
  const g = GUARDIANS.find((d) => d.kind === kind);
  const d = ENEMIES.find((d) => d.kind === kind);
  const depthMul = 1 + Math.max(0, run.depth - 3) * 0.08;
  const base = g ?? d ?? { label: kind, hp: 60, atk: 10, speed: 1, reach: 60, windup: 0.5, armor: 0 as const, w: 56, h: 128, special: '' };
  const hp = Math.round(base.hp * depthMul * (elite ? 1.5 : 1));
  const e: Ent = {
    id: run.nextId++, kind, label: base.label, x, y, z: 0, vz: 0, dir: -1, hp, max: hp, w: base.w, h: base.h, act: 'idle', t: 0, stun: 0, down: 0, inv: 0, flash: 0, armor: base.armor, speed: base.speed * (elite ? 1.25 : 1), atk: Math.round(base.atk * depthMul), reach: base.reach, windup: base.windup, cool: 0, state: 'idle', timer: 0, aux: 0, elite, guardian, special: (base as { special?: string }).special ?? '', hostile: true, patrol: null, alive: true, honest: true, vx: 0, wave, spawned: wave === 0,
  };
  if (kind === 'passenger') (e.w = 56), (e.h = 130), (e.special = 'passenger');
  if (e.special === 'patrol') (e.patrol = [x - 450, x + 200]), (e.state = 'patrol'), (e.hostile = false);
  if (e.special === 'rule' || e.special === 'lurker') (e.hostile = false), (e.state = 'friendly');
  if (e.special === 'elder') (e.hostile = false), (e.state = 'friendly');
  if (e.special === 'ceiling') e.z = 320;
  run.ents.push(e);
  return e;
}
const chunkAt = (f: Floor, x: number): Chunk => f.chunks.find((c) => x >= c.x && x < c.x + c.w) ?? f.chunks[f.chunks.length - 1];
/** 바닥 높이: 단(step/ledge) 위는 60 */
function ground(f: Floor, x: number): number {
  const c = chunkAt(f, x);
  if ((c.kind === 'step' || c.kind === 'ledge') && c.feature && x >= c.feature[0] && x <= c.feature[1]) return 60;
  return 0;
}
function overGap(f: Floor, x: number): boolean {
  const c = chunkAt(f, x);
  return c.kind === 'gap' && !!c.feature && x > c.feature[0] + 20 && x < c.feature[1] - 20;
}
function current(run: Run): Floor {
  return run.phase === 'service' && run.service ? run.service : run.floor;
}
/** 벽: 수호자 방은 수호자가 살아 있는 동안 끝이 막힌다. 두 문 조각은 문을 고르기 전까지 막힌다. 플레이어 앞에 있는 가장 가까운 벽만 센다. */
function wallAt(run: Run, f: Floor, x: number): number | null {
  let best: number | null = null;
  const consider = (w: number) => {
    if (w > x - 10 && (best === null || w < best)) best = w;
  };
  for (const c of f.chunks) {
    if (c.kind === 'guardian' && !run.guardianDead && run.ents.some((e) => e.guardian && e.alive)) consider(c.x + c.w - 60);
    if (c.kind === 'twodoor') {
      const doors = f.props.filter((p) => p.kind === 'door' && p.data !== 'chase' && Math.abs(p.x - c.x - 300) < 400);
      if (doors.length && !doors.some((d) => d.used)) consider(c.x + 520);
    }
    if (c.kind === 'goal' && run.trial && !run.trial.done) consider(c.x + c.w - 60);
  }
  return best;
}
export const wallAhead = wallAt;
function hurtPlayer(run: Run, dmg: number, fromX: number, heavy = false, noStun = false) {
  const p = run.player;
  if (p.inv > 0 || run.ended) return;
  let d = dmg;
  if (p.guarding) {
    d = Math.round(dmg * (run.upgrades.includes('guard') ? 0.33 : 0.5));
    fx(run, 'guard', p.x, p.y - 120);
  } else if (p.guardBuff > 0) d = Math.round(dmg * 0.5);
  p.hp -= d;
  p.flash = 0.15;
  run.shake = 0.2;
  fx(run, 'hit', p.x, p.y - 120, 0.2, `-${d}`);
  if (!p.guarding && !noStun) {
    p.combo = 0;
    p.grab = null;
    if (heavy || d >= 25) {
      p.down = 0.8;
      p.act = 'down';
      p.inv = 1.4;
      p.x += (p.x < fromX ? -1 : 1) * 60;
    } else {
      p.stun = 0.3;
      p.act = 'hurt';
      p.x += (p.x < fromX ? -1 : 1) * 18;
    }
  }
  if (p.hp <= 0) {
    p.hp = 0;
    endRun(run, 'evac');
  }
}
function hurtEnt(run: Run, e: Ent, dmg: number, fromX: number, opt: { heavy?: boolean; low?: boolean; back?: boolean; lit?: boolean } = {}) {
  if (!e.alive || e.state === 'dead') return;
  if (e.special === 'shadow' && !run.player.lit) {
    fx(run, 'text', e.x, e.y - 100, 0.6, '빛이 없으면 안 맞음');
    return;
  }
  let d = dmg;
  if (e.special === 'elder' && opt.low) d *= 2;
  if (e.special === 'patrol' && opt.back) d *= 2;
  if (e.special === 'elder' && !opt.low && e.guardian) d *= 0.7;
  d = Math.round(d);
  e.hp -= d;
  e.flash = 0.12;
  run.hitstop = Math.max(run.hitstop, opt.heavy ? 0.08 : 0.04);
  fx(run, 'hit', e.x, e.y - e.h * 0.6, 0.2, `${d}`);
  if (e.state === 'friendly' && e.special !== 'passenger') (e.hostile = true), (e.state = 'approach');
  if (e.special === 'rule' && e.state !== 'approach') angerResidents(run);
  // 슈퍼아머: 0 없음·1 경(약공격 경직 안 받음)·2 중·3 절대
  const stunOk = e.armor === 0 || (e.armor === 1 && (opt.heavy || dmg >= 30)) || (e.armor === 2 && opt.heavy && dmg >= 40);
  if (stunOk) {
    e.stun = opt.heavy ? 0.6 : 0.3;
    e.x += (e.x < fromX ? -1 : 1) * (opt.heavy ? 40 : 14);
    if (e.state !== 'held') e.state = 'approach';
  }
  if (e.hp <= 0) killEnt(run, e);
}
function killEnt(run: Run, e: Ent) {
  e.alive = false;
  e.state = 'dead';
  e.hp = 0;
  run.kills++;
  const p = run.player;
  p.gauge = Math.min(100, p.gauge + (e.guardian ? 40 : 8));
  const def = ENEMIES.find((d) => d.kind === e.kind);
  run.loot.cash += 5 + (def?.price ?? 10);
  run.loot.budget += def?.price ?? 10;
  if (Math.random() < 0.12) run.loot.teeth++;
  if (run.trial && !run.trial.done) run.trial.kills++;
  if (e.guardian) {
    run.guardianDead = true;
    run.loot.research += 2;
    run.loot.teeth += 2;
    say(run, `수호자 ${e.label} 격파. 강화를 고르세요.`, 4);
    const pool = UPGRADES.filter((u) => !run.upgrades.includes(u.id) || u.id === 'hp');
    const r = rng(run.seed + run.depth * 3 + run.kills);
    const pick: string[] = [];
    while (pick.length < 3 && pool.length) pick.push(pool.splice(Math.floor(r() * pool.length), 1)[0].id);
    run.upgradePick = pick;
    if (e.kind === 'guard') run.found.includes('lobby') || foundRule(run, 'lobby');
  } else fx(run, 'text', e.x, e.y - 60, 0.8, `+${def?.price ?? 10}`);
  if (run.phase === 'floor' && run.floor.type === 'silent' && !e.guardian) addNoise(run, 20);
}
function angerResidents(run: Run) {
  let n = 0;
  for (const e of run.ents) if (e.alive && e.special === 'rule' && !e.hostile) (e.hostile = true), (e.state = 'approach'), n++;
  if (n) say(run, '주민들이 전부 돌아본다. 규칙을 어겼다.', 3);
}
function addNoise(run: Run, n: number) {
  const p = run.player;
  p.noise = clamp(p.noise + n, 0, 100);
  if (run.phase !== 'floor' || run.floor.type !== 'silent') return;
  if (p.noise >= 100) {
    p.noise = 0;
    const e = spawnEnt(run, 'hum', p.x + (p.dir > 0 ? -200 : 200), p.y, run.depth > 8, false, 0);
    e.hostile = true;
    e.state = 'approach';
    say(run, '소리가 찼다. 발소리가 바로 옆에서 난다.', 3);
    fx(run, 'ripple', p.x, p.y, 0.8);
  }
}
export function endRun(run: Run, how: 'return' | 'evac') {
  if (run.ended) return;
  run.ended = how;
  run.phase = 'settle';
  run.dialog = null;
  run.elevator = null;
  run.upgradePick = null;
}
/** 정산: 임무 판정·보상·규칙서·기록. meta를 바꾼다. */
export function settle(run: Run, meta: Meta): string[] {
  if (run.settle) return run.settle;
  const lines: string[] = [];
  const evac = run.ended === 'evac';
  const kept = evac ? run.sent.concat(run.found.filter((f) => !run.sent.includes(f)).filter((_, i) => i % 2 === 0)) : run.found.slice();
  let added = 0;
  for (const id of kept) if (!meta.rulebook.includes(id)) (meta.rulebook.push(id), added++);
  const loot = { ...run.loot };
  if (evac) (loot.cash = 0), (loot.budget = Math.floor(loot.budget / 2)), (loot.research = Math.floor(loot.research / 2)), (loot.teeth = Math.floor(loot.teeth / 2));
  const mult = 1 + Math.max(0, run.depth - 3) * 0.1;
  loot.budget = Math.round(loot.budget * mult);
  lines.push(evac ? '후송: 다락방 로프로 끌어올려졌다. 현금 전부, 회수물 절반, 미송신 정보 절반 손실.' : '귀환: 로프를 타고 승강로를 올라 점검문을 열었다. 진짜 로비였다.');
  lines.push(`최저 도달 ${depthLabel(Math.max(1, run.depth))} · 층 ${run.visited.length} · 처치 ${run.kills} · 보상 배율 ×${mult.toFixed(1)}`);
  lines.push(`규칙서 +${added} (보존 ${kept.length}/${run.found.length})`);
  // 임무 판정
  const m = MISSIONS.find((x) => x.id === run.mission);
  const ok = (() => {
    if (!m) return false;
    switch (m.id) {
      case 'm1': return run.found.length >= 2 && !evac;
      case 'm2': return run.visited.some((v) => v.depth === 3) && run.log.some((l) => l.includes('경비원 격파'));
      case 'm3': return run.visited.some((v) => v.type === 'chase') && run.visited.some((v) => v.depth >= 5);
      case 'm4': return run.rescue.delivered;
      case 'm5': return ['r_greet', 'r_quiet', 'r_meal'].filter((r) => run.found.includes(r) || meta.rulebook.includes(r)).length >= 3 && run.visited.some((v) => v.type === 'replica');
      case 'm6': return run.log.some((l) => l.includes('405호 노부부 격파')) || run.elderSkipped;
      case 'm7': return run.checklist && !evac;
      case 'm8': return run.log.some((l) => l.includes('시험 목표 달성'));
      case 'm9': return run.visited.some((v) => v.depth >= 8);
      default: return false;
    }
  })();
  if (m && ok && !evac) {
    if (!meta.missionsDone.includes(m.id)) meta.missionsDone.push(m.id);
    loot.budget += m.reward.budget;
    loot.teeth += m.reward.teeth;
    loot.research += m.reward.research;
    lines.push(`임무 성공: ${m.title} (+예산 ${m.reward.budget})`);
  } else if (m) lines.push(`임무 ${ok ? '달성했지만 후송이라 보상 없음' : '미달성'}: ${m.title}`);
  meta.currencies.cash += loot.cash;
  meta.currencies.budget += loot.budget;
  meta.currencies.research += loot.research;
  meta.currencies.teeth += loot.teeth;
  lines.push(`현금 +${loot.cash} · 예산 +${loot.budget} · 연구 자료 +${loot.research} · 이빨 +${loot.teeth}`);
  meta.deepest = Math.max(meta.deepest, run.depth);
  meta.bestFloors = Math.max(meta.bestFloors, run.visited.length);
  meta.lastTypes = run.visited.map((v) => v.type).slice(-3);
  run.settle = lines;
  return lines;
}

/** 한 틱. */
export function step(run: Run, input: Input, meta: Meta) {
  if (run.phase === 'hq') return hqStep(run, input, meta);
  if (run.phase === 'brief') {
    if (input.choice === 0 || input.interact) deploy(run, meta);
    if (input.cancel) run.phase = 'hq';
    return;
  }
  if (run.phase === 'settle') {
    settle(run, meta);
    if (input.choice === 0 || input.interact || input.cancel) run.phase = 'hq';
    return;
  }
  run.time += DT;
  if (run.msgT > 0) run.msgT -= DT;
  else if (run.message) run.message = '';
  if (run.upgradePick) {
    if (input.choice !== undefined && run.upgradePick[input.choice]) {
      const id = run.upgradePick[input.choice];
      run.upgrades.push(id);
      applyUpgrade(run, id);
      run.upgradePick = null;
      say(run, `강화: ${UPGRADES.find((u) => u.id === id)?.label}`, 3);
    }
    return;
  }
  if (run.dialog) return dialogStep(run, input, meta);
  if (run.elevator) return elevatorStep(run, input, meta);
  if (run.hitstop > 0) {
    run.hitstop -= DT;
    return;
  }
  run.floorTime += DT;
  const f = current(run);
  playerStep(run, f, input);
  entsStep(run, f);
  boltsStep(run, f);
  floorStep(run, f);
  for (const e of run.effects) e.t += DT;
  run.effects = run.effects.filter((e) => e.t < e.dur);
  if (run.shake > 0) run.shake -= DT;
}
function applyUpgrade(run: Run, id: string) {
  const p = run.player;
  if (id === 'hp') (p.max += 40), (p.hp = Math.min(p.max, p.hp + 40));
  if (id === 'clip') p.items = p.items.map((n) => n + 2);
}
function hqStep(run: Run, input: Input, meta: Meta) {
  const list = unlockedMissions(meta);
  if (input.choice !== undefined && input.choice < list.length) run.hqMission = input.choice;
  if (input.x !== 0 && input.y === 0) run.hqAgent = clamp(run.hqAgent + (input.x > 0 ? 1 : -1), 0, AGENTS.length - 1);
  if (input.interact) {
    run.mission = list[clamp(run.hqMission, 0, list.length - 1)].id;
    run.agent = AGENTS[run.hqAgent].id;
    run.phase = 'brief';
  }
}
function dialogStep(run: Run, input: Input, meta: Meta) {
  const d = run.dialog!;
  if (input.cancel) {
    run.dialog = null;
    return;
  }
  if (input.choice === undefined || !d.options[input.choice]) return;
  const c = input.choice;
  run.dialog = null;
  const p = run.player;
  switch (d.tag) {
    case 'rope':
      if (c === 0) {
        say(run, '로프를 탄다. 승강로를 한참 올라간다.', 3);
        endRun(run, 'return');
      }
      break;
    case 'phone':
      if (c === 0) {
        run.sent = run.found.slice();
        say(run, `송신 완료: 규칙 ${run.sent.length}줄을 본부로 보냈다.`, 3);
      } else if (c === 1) {
        if (run.deals >= 1) say(run, '인터폰이 조용하다. 거래는 다락방마다 한 번.', 3);
        else if (run.loot.research < 1 && run.found.length === 0) say(run, '줄 것이 없다.', 2);
        else {
          run.deals++;
          if (run.loot.research >= 1) run.loot.research--;
          else run.found.pop();
          const truth = run.favor >= 1 || Math.random() < 0.5;
          const next = pickType(run.depth + 1, run.visited.map((v) => v.type), rng(run.seed + run.depth + 5));
          say(run, truth ? `인터폰: 「…다음 층은 ${TYPE_LABEL[next]}이에요.」` : `인터폰: 「…다음 층은 ${TYPE_LABEL[pickType(run.depth + 1, [next], rng(run.seed + 77))]}이에요.」 (총애가 낮으면 거짓이 섞인다)`, 5);
          run.floor.variant = truth ? '깊이 점프' : run.floor.variant;
        }
      }
      break;
    case 'passenger': {
      const e = run.ents.find((x) => x.id === Number(d.data));
      if (!e) break;
      if (c === 0) {
        if (e.special === 'passenger' && run.floor.passenger?.rescue) {
          e.state = 'follow';
          run.rescue.found = true;
          say(run, '회사원이 뒤를 따른다. 다락방까지 데려가면 된다.', 3);
        } else if (e.honest) {
          for (const door of current(run).props) if (door.kind === 'door' && door.data === 'ok') door.data = 'ok!';
          const next = pickType(run.depth + 1, run.visited.map((v) => v.type), rng(run.seed + run.depth + 5));
          say(run, `「저쪽 문 말고 이쪽.」 정답 문에 표시가 생겼다. 다음 층은 ${TYPE_LABEL[next]}라고 한다.`, 4);
          run.floor.variant = run.floor.variant || '지도';
          p.items[0]++;
          e.state = 'friendly';
        } else {
          say(run, '사연이 길었다. 따라갔더니 수호자 영역이다. (규칙 8)', 4);
          foundRule(run, 'passenger');
          for (let k = 0; k < 3; k++) {
            const s = spawnEnt(run, 'charger', p.x + 300 + k * 90, p.y, run.depth > 8, false, 0);
            s.hostile = true;
            s.state = 'approach';
          }
          e.alive = false;
          e.state = 'dead';
        }
      } else if (c === 1) {
        say(run, '무시했다.', 1.5);
      } else if (c === 2) {
        e.hostile = true;
        e.state = 'approach';
        e.special = '';
        say(run, '보급품을 빼앗으려 했다. 승객이 달려든다.', 2);
      }
      break;
    }
    case 'elder': {
      const e = run.ents.find((x) => x.special === 'elder' && x.alive);
      if (!e) break;
      if (c === 0) {
        foundRule(run, 'r_meal');
        run.favor++;
        run.elderSkipped = true;
        run.guardianDead = true;
        e.alive = false;
        e.state = 'dead';
        say(run, '「잘 먹었습니다.」 노부부가 웃으며 배웅한다. 전투 생략. 총애 +1', 4);
      } else if (c === 1) {
        hurtPlayer(run, 40, e.x, true);
        e.hostile = true;
        e.state = 'approach';
        say(run, '썩은 밥을 먹었다. 노부부의 얼굴이 돌아간다.', 3);
      } else {
        e.hostile = true;
        e.state = 'approach';
        say(run, '돌아섰다. 노부부가 일어난다.', 3);
      }
      break;
    }
    case 'mirror':
      if (c === 0) {
        run.floor.variant = run.floor.variant ? run.floor.variant + '·피곤한 얼굴' : '피곤한 얼굴';
        run.danger++;
        say(run, '탔다. 이 층 예산 +30%, 보상 +30%.', 3);
      } else say(run, '내렸다. 평범한 층.', 2);
      foundRule(run, 'mirror');
      break;
  }
  void meta;
}
function elevatorStep(run: Run, input: Input, meta: Meta) {
  const ui = run.elevator!;
  if (input.cancel) {
    run.elevator = null;
    return;
  }
  if (input.choice === undefined) return;
  const options = elevatorOptions(run);
  const pick = options[input.choice];
  if (!pick) return;
  if (pick.tag === 'greet') {
    ui.greeted = true;
    const r = Math.random() < 0.5 ? 1 : 0;
    run.favor = clamp(run.favor + r, -3, 3);
    foundRule(run, 'greet');
    say(run, r ? '인사했다. 인터폰에서 「…안녕하세요.」 총애 +1' : '인사했다. 대답이 없다.', 3);
    run.elevator = buildElevator(run, true);
  } else if (pick.tag === 'close') {
    run.closeSpam++;
    run.favor = clamp(run.favor - 1, -3, 3);
    foundRule(run, 'close');
    say(run, '닫힘 버튼을 연타했다. 문이 아주 천천히 닫힌다. 총애 -1', 3);
    run.elevator = buildElevator(run, ui.greeted);
    if (run.favor <= -2) {
      say(run, '문이 안 닫힌다. 10초 동안 갇혔다.', 3);
      run.elevator = null;
      const e = spawnEnt(run, 'charger', run.player.x + 400, run.player.y, true, false, 0);
      e.hostile = true;
      e.state = 'approach';
    }
  } else if (pick.tag === 'button') {
    const b = ui.buttons[pick.index];
    enterFloor(run, b.depth, b.type);
  }
  void meta;
}
export function elevatorOptions(run: Run): { label: string; tag: 'greet' | 'close' | 'button'; index: number }[] {
  const ui = run.elevator!;
  const out: { label: string; tag: 'greet' | 'close' | 'button'; index: number }[] = [];
  if (!ui.greeted) out.push({ label: '인사한다 (규칙 4)', tag: 'greet', index: 0 });
  out.push({ label: '닫힘 버튼 연타', tag: 'close', index: 0 });
  ui.buttons.forEach((b, i) => out.push({ label: `${depthLabel(b.depth)} ${b.known ? TYPE_LABEL[b.type] : '?'}`, tag: 'button', index: i }));
  return out;
}
function buildElevator(run: Run, greeted: boolean): ElevatorUi {
  const r = rng(run.seed + run.depth * 11 + run.favor);
  const n = run.favor <= -1 ? 1 : run.favor >= 2 ? 3 : 2;
  const last = run.visited.map((v) => v.type);
  const known = run.favor >= 2 || run.floor.variant.includes('지도') || run.floor.variant.includes('깊이 점프');
  const buttons: ElevatorUi['buttons'] = [];
  for (let i = 0; i < n; i++) {
    const depth = run.depth + 1 + (i === 2 && run.favor >= 1 ? 1 : 0);
    let type = pickType(depth, last.concat(buttons.map((b) => b.type)), r);
    if (run.depth + 1 <= 6 && i === 0) type = pickType(depth, last, r);
    buttons.push({ depth, type, known });
  }
  if (run.floor.variant.includes('깊이 점프') && !buttons.some((b) => b.depth === run.depth + 2)) buttons.push({ depth: run.depth + 2, type: pickType(run.depth + 2, last, r), known: true });
  return { greeted, buttons };
}

function playerStep(run: Run, f: Floor, input: Input) {
  const p = run.player,
    a = agentDef(run.agent);
  const spd = a.speed * (run.upgrades.includes('speed') ? 1.12 : 1);
  for (const k of ['inv', 'flash', 'evadeCd', 'uniqueCd', 'shotCd', 'guardBuff', 'lit', 'comboWindow'] as const) if (p[k] > 0) p[k] -= DT;
  if (p.lit < 0) p.lit = 0;
  if (p.noise > 0 && f.type !== 'silent') p.noise = Math.max(0, p.noise - 40 * DT);
  if (p.noise > 0 && f.type === 'silent') p.noise = Math.max(0, p.noise - 8 * DT);
  if (run.cutin > 0) run.cutin -= DT;
  if (run.serviceCd > 0) run.serviceCd -= DT;
  if (p.down > 0) {
    p.down -= DT;
    p.act = p.down > 0.3 ? 'down' : 'rise';
    return;
  }
  if (p.stun > 0) {
    p.stun -= DT;
    p.act = 'hurt';
    return;
  }
  // 입력 (조작 반전)
  let ix = input.x,
    iy = input.y;
  if (p.reversed) (ix = -ix), (iy = -iy);
  // 행동 중
  if (p.t > 0) {
    p.t -= DT;
    const g0 = ground(f, p.x);
    // 공격 판정 1회
    if (!p.hitOnce && p.act.startsWith('melee') && p.t < 0.22) {
      p.hitOnce = true;
      const n = Number(p.act.slice(5)) - 1;
      const dmg = Math.round(a.melee.dmg[n] * a.atk * (run.upgrades.includes('atk') ? 1.25 : 1));
      melee(run, dmg, a.melee.reach, n === 2, p.act === 'melee3' && p.crouch);
    }
    if (!p.hitOnce && p.act === 'lowkick' && p.t < 0.2) {
      p.hitOnce = true;
      melee(run, Math.round(16 * a.atk), 80, false, true);
    }
    if (!p.hitOnce && p.act === 'dashattack' && p.t < 0.25) {
      p.hitOnce = true;
      melee(run, Math.round(26 * a.atk), 110, true, false);
    }
    if (!p.hitOnce && p.act === 'airattack' && p.t < 0.2) {
      p.hitOnce = true;
      melee(run, Math.round(20 * a.atk), 90, false, false);
    }
    if (!p.hitOnce && p.act === 'unique' && p.t < 0.6) {
      p.hitOnce = true;
      if (a.unique === 'blast') {
        fx(run, 'blast', p.x, p.y - 80, 0.4);
        run.shake = 0.3;
        addNoise(run, 60);
        for (const e of run.ents) if (e.alive && e.hostile !== false && Math.abs(e.x - p.x) < 180 && Math.abs(e.y - p.y) < 90) hurtEnt(run, e, 40, p.x, { heavy: true });
        for (const pr of f.props) if ((pr.kind === 'crate' || pr.kind === 'door') && !pr.used && Math.abs(pr.x - p.x) < 200) (pr.used = true), fx(run, 'text', pr.x, pr.y - 40, 0.8, pr.kind === 'crate' ? '부서짐' : '문 폭파');
      } else {
        // 읽기: 가장 가까운 표지·문·승객
        let hit = false;
        for (const pr of f.props) if (Math.abs(pr.x - p.x) < 400 && pr.kind === 'door' && pr.data !== 'chase' && !pr.used) (pr.data = pr.data.replace('!', '') + '!'), (hit = true);
        for (const pr of f.props) if (Math.abs(pr.x - p.x) < 400 && pr.kind === 'sign' && !pr.used) (readSign(run, pr), (hit = true));
        for (const e of run.ents) if (e.alive && e.special === 'passenger' && Math.abs(e.x - p.x) < 400) (e.label = e.honest ? '승객 (진실)' : '승객 (거짓)'), (hit = true);
        say(run, hit ? '읽었다. 문·표지·승객의 정체가 보인다.' : '읽을 것이 없다.', 2);
      }
    }
    if (!p.hitOnce && p.act === 'ult' && p.t < 0.5) {
      p.hitOnce = true;
      run.shake = 0.5;
      addNoise(run, 100);
      fx(run, 'blast', p.x, p.y - 80, 0.6);
      for (const e of run.ents) if (e.alive && Math.abs(e.x - p.x) < 640) hurtEnt(run, e, 80, p.x, { heavy: true, lit: true });
    }
    if (!p.hitOnce && p.act === 'throw' && p.t < 0.25) {
      p.hitOnce = true;
      const e = run.ents.find((x) => x.id === p.grab);
      p.grab = null;
      if (e) {
        e.state = 'thrown';
        e.vx = p.dir * 700;
        e.timer = 0.5;
        hurtEnt(run, e, 30, p.x, { heavy: true });
      }
    }
    if (p.act === 'evade') {
      const dir = a.evade === 'back' && !p.running ? -p.dir : p.dir;
      p.x += dir * 680 * DT;
    }
    if (p.act === 'dashattack') p.x += p.dir * 300 * DT;
    if (p.t <= 0) {
      if (p.act.startsWith('melee')) (p.comboWindow = 0.35), (p.combo = Number(p.act.slice(5)));
      else if (p.act !== 'grab') p.combo = 0;
      p.act = p.grab ? 'grab' : 'idle';
      p.t = 0;
    }
    if (p.z === 0 && ground(f, p.x) !== g0 && p.z < ground(f, p.x)) p.x -= p.dir * 5;
    gravity(run, f);
    return;
  }
  if (p.comboWindow <= 0) p.combo = 0;
  // 잡기 중
  if (p.grab !== null) {
    const e = run.ents.find((x) => x.id === p.grab && x.alive);
    if (!e) p.grab = null;
    else {
      e.x = p.x + p.dir * 50;
      e.y = p.y;
      e.state = 'held';
      e.stun = 0.5;
      if (input.attack && ix !== 0) (p.act = 'throw'), (p.t = 0.3), (p.hitOnce = false);
      else if (input.attack) {
        hurtEnt(run, e, 15, p.x);
        p.act = 'grabhit';
        p.t = 0.25;
      } else if (input.jump) (e.state = 'approach'), (p.grab = null), (p.act = 'idle');
      else p.act = 'grab';
      p.grab = e.alive && p.grab !== null ? p.grab : null;
      return;
    }
  }
  p.guarding = !!input.guard && p.z === 0;
  if (p.guarding) {
    p.act = 'guard';
    gravity(run, f);
    return;
  }
  if (input.item !== undefined && p.items[input.item] > 0) {
    p.items[input.item]--;
    const names = ['회복약: 체력 +60', '방어 강화 10초', '능력 회복', '손전등 3초'];
    if (input.item === 0) p.hp = Math.min(p.max, p.hp + 60);
    if (input.item === 1) p.guardBuff = 10;
    if (input.item === 2) (p.uniqueCd = 0), (p.gauge = Math.min(100, p.gauge + 30)), (p.energy = 100);
    if (input.item === 3) p.lit = 3;
    say(run, names[input.item], 2);
    p.act = 'item';
    p.t = 0.35;
    return;
  }
  // 앉기
  p.crouch = p.z === 0 && iy > 0 && ix === 0 ? true : p.z === 0 && iy > 0 && p.crouch ? true : iy > 0 && ix !== 0 && p.crouch ? true : false;
  const c = chunkAt(f, p.x);
  const inDuct = c.low && c.feature && p.x > c.feature[0] && p.x < c.feature[1];
  if (inDuct && !p.crouch) p.crouch = true;
  // 입력 행동
  if (input.evade && p.evadeCd <= 0 && p.z === 0) {
    p.act = 'evade';
    p.t = 0.32;
    p.inv = 0.25 * (run.upgrades.includes('evade') ? 1.5 : 1);
    p.evadeCd = 0.7;
    p.running = !!input.run;
    return;
  }
  if (input.attack && p.z > 0) {
    p.act = 'airattack';
    p.t = 0.3;
    p.hitOnce = false;
    return;
  }
  if (input.attack && p.z === 0) {
    if (p.crouch) (p.act = 'lowkick'), (p.t = 0.3);
    else if (input.run && ix !== 0) (p.act = 'dashattack'), (p.t = 0.35);
    else {
      const n = p.combo >= 3 ? 1 : p.combo + 1;
      p.act = `melee${n}`;
      p.t = n === 3 ? 0.45 : 0.3;
      if (n === 3) addNoise(run, 15);
    }
    p.hitOnce = false;
    if (f.type === 'replica' && p.act.startsWith('melee')) addNoise(run, 10);
    return;
  }
  if (input.shoot && p.shotCd <= 0) {
    p.shotCd = a.ranged.rate;
    p.act = 'shoot';
    p.t = 0.18;
    const dmg = Math.round(a.ranged.dmg * (run.upgrades.includes('shot') ? 1.3 : 1));
    run.bolts.push({ x: p.x + p.dir * 40, y: p.y, z: p.z + (p.crouch ? 40 : 90), vx: p.dir * 1100, life: a.ranged.range / 1100, enemy: false, dmg });
    addNoise(run, f.type === 'silent' ? 35 : 20);
    if (f.type === 'replica') angerResidents(run);
    return;
  }
  if (input.unique && p.uniqueCd <= 0) {
    p.uniqueCd = (a.unique === 'blast' ? 6 : 4) * (run.upgrades.includes('unique') ? 0.7 : 1);
    p.act = 'unique';
    p.t = 0.7;
    p.hitOnce = false;
    return;
  }
  if (input.ult && p.gauge >= 100) {
    p.gauge = 0;
    p.act = 'ult';
    p.t = 0.9;
    p.hitOnce = false;
    run.cutin = 0.8;
    return;
  }
  if (input.jump && p.z === 0 && !inDuct) {
    p.vz = 620;
    p.z = 1;
    p.act = 'jump';
    p.crouch = false;
  }
  if (input.interact) {
    interact(run, f);
    // 상호작용으로 층·정비 구역이 바뀌면 이 틱의 이동은 새 공간에서 하지 않는다
    if (current(run) !== f || run.phase === 'settle') return;
  }
  // 이동
  p.running = !!input.run && !p.crouch && ix !== 0;
  const v = (p.crouch ? 120 : p.running ? 380 : 220) * spd;
  if (ix !== 0) p.dir = ix > 0 ? 1 : -1;
  if (p.running) {
    addNoise(run, 25 * DT * 4);
    if (f.type === 'replica' && run.ents.some((e) => e.alive && e.special === 'rule' && !e.hostile && Math.abs(e.x - p.x) < 500)) {
      angerResidents(run);
      foundRule(run, 'r_quiet');
    }
  }
  const nx = p.x + ix * v * DT;
  const ny = clamp(p.y + iy * v * 0.6 * DT, c.laneMin, c.laneMax);
  // 벽·단 막기
  const wall = wallAt(run, f, p.x);
  const gNext = ground(f, nx);
  let blocked = wall !== null && nx > wall && ix > 0;
  if (gNext > p.z + 1 && p.z < gNext) blocked = true;
  if (!blocked) p.x = clamp(nx, 40, f.width - 40);
  p.y = ny;
  p.still = ix === 0 && iy === 0 ? p.still + DT : 0;
  if (p.z === 0) p.act = p.crouch ? (ix ? 'crouchwalk' : 'crouch') : ix || iy ? (p.running ? 'run' : 'walk') : 'idle';
  if (p.hp < p.max && p.still > 0) p.energy = Math.min(100, p.energy + 2 * DT);
  gravity(run, f);
  // 구멍
  if (p.z <= 0 && overGap(f, p.x)) {
    const ch = chunkAt(f, p.x);
    hurtPlayer(run, 20, p.x + 100, true);
    p.x = (ch.feature?.[0] ?? p.x) - 40;
    say(run, '틈새로 떨어졌다. 아래가 끝없이 보였다.', 2);
  }
  // 어둠: 멈추면 체온을 잰다
  if (f.type === 'dark' && p.still > 1.5 && p.lit <= 0) {
    p.still = 0;
    const e = spawnEnt(run, 'shade', p.x + (p.dir > 0 ? -140 : 140), p.y, false, false, 0);
    e.hostile = true;
    e.state = 'approach';
    say(run, '멈췄더니 어둠 속에서 누가 체온을 잰다. (규칙 10)', 3);
    foundRule(run, 'dark');
  }
  // 잡기: 경직 중인 적과 닿으면 자동
  if (p.act === 'walk' || p.act === 'idle') {
    const e = run.ents.find((x) => x.alive && x.stun > 0 && !x.guardian && x.armor < 2 && x.special !== 'passenger' && Math.abs(x.x - p.x) < 60 && Math.abs(x.y - p.y) < 40);
    if (e) (p.grab = e.id), (e.state = 'held'), (p.act = 'grab'), say(run, '잡았다. A 타격 · 방향+A 던지기 · Space 놓기', 2);
  }
}
function gravity(run: Run, f: Floor) {
  const p = run.player;
  const g = ground(f, p.x);
  if (p.z > 0 || p.vz > 0) {
    p.vz -= 1800 * DT;
    p.z += p.vz * DT;
    if (p.z <= g) (p.z = g === 0 ? 0 : g), (p.vz = 0), p.act === 'jump' && (p.act = 'idle');
    if (p.z === g && g > 0) p.z = g;
  }
  if (p.z < g) p.z = g;
  if (p.z > 0 && g === 0 && p.vz === 0 && p.act !== 'jump') p.vz = -1;
  if (p.z === g && g > 0) p.vz = 0;
  if (p.z > g && p.vz === 0 && p.act !== 'jump') p.vz = -1;
  // 단 위에서 내려오면 떨어진다
  if (g === 0 && p.z > 0 && p.vz === 0) p.vz = -1;
}
function melee(run: Run, dmg: number, reach: number, heavy: boolean, low: boolean) {
  const p = run.player;
  let hit = false;
  for (const e of run.ents) {
    if (!e.alive || e.state === 'dead') continue;
    const dx = (e.x - p.x) * p.dir;
    if (dx > -20 && dx < reach + e.w / 2 && Math.abs(e.y - p.y) < 44 && Math.abs(e.z - p.z) < 160) {
      hit = true;
      hurtEnt(run, e, dmg, p.x, { heavy, low, back: e.dir === p.dir });
    }
  }
  if (hit) run.shake = Math.max(run.shake, 0.08);
  if (hit && p.act === 'melee3') run.hitstop = Math.max(run.hitstop, 0.1);
}
function readSign(run: Run, pr: Prop) {
  pr.used = true;
  const [id, extra] = pr.data.split(':');
  if (id === 'map') {
    run.floor.variant = run.floor.variant ? run.floor.variant + '·지도' : '지도';
    say(run, '선배가 긁어 쓴 지도. 다음 층 유형이 승강기 버튼에 표시된다.', 3);
    return;
  }
  if (id === 'attic') foundRule(run, 'attic');
  if (id === 'trial' && run.trial) {
    run.trial.started = true;
    foundRule(run, 'trial');
    say(run, `벽의 목표: ${run.trial.left.toFixed(0)}초 안에 ${run.floor.goal?.need}체를 쓰러뜨려라.`, 4);
    return;
  }
  if (id === 'p_sign') {
    foundRule(run, 'p_sign');
    say(run, `표지: ${extra === 'left' ? '왼쪽' : '오른쪽'} 문이 정답.`, 3);
    for (const d of current(run).props) if (d.kind === 'door' && d.data === 'ok') d.data = 'ok!';
    return;
  }
  foundRule(run, id);
}
function interact(run: Run, f: Floor) {
  const p = run.player;
  const near = (x: number, r = 90) => Math.abs(x - p.x) < r;
  // 승객·주민·노부부
  for (const e of run.ents) {
    if (!e.alive || !near(e.x, 110) || Math.abs(e.y - p.y) > 70) continue;
    if (e.special === 'passenger' && e.state !== 'follow') {
      const rescue = !!run.floor.passenger?.rescue;
      const story = e.honest ? ['「나 여기 삼 년째야. 그러니까 내 말 들어.」', '「저쪽 문 말고 이쪽.」'] : ['「나 여기 오 년째야. 처음엔 회사 엘리베이터였는데, 그때 야근이, 아니 그 전에 팀장이…」', '「…그러니까 저쪽 문으로 가. 내가 안내할게. 정말로.」'];
      run.dialog = { title: e.label, lines: rescue ? ['「…관리국? 진짜? 데려가 줘요. 제발.」'] : story, options: rescue ? ['데려간다', '나중에'] : ['따른다', '무시', '보급품을 뺏는다'], tag: 'passenger', data: String(e.id) };
      return;
    }
    if (e.special === 'rule' && !e.hostile && e.state === 'friendly' && e.timer >= 0) {
      e.timer = -1;
      e.dir = p.x < e.x ? -1 : 1;
      foundRule(run, 'r_greet');
      say(run, '인사했다. 주민이 고개를 끄덕이고 지나간다.', 2);
      e.vx = -e.dir * 60;
      return;
    }
    if (e.special === 'elder' && !e.hostile) {
      run.dialog = { title: '405호 노부부', lines: ['「아이고, 우리 아들이랑 딸이 곧 온다는구먼. 같이 밥 먹고 가.」', '밥상 위 음식은 오래전에 썩었다. 식탁엔 이미 손님이 둘 앉아 있다.'], options: ['「잘 먹었습니다」 (규칙 15)', '먹는다', '말없이 돌아선다'], tag: 'elder' };
      return;
    }
  }
  for (const pr of f.props) {
    if (!near(pr.x + pr.w / 2, 100) || pr.used) continue;
    switch (pr.kind) {
      case 'sign':
        readSign(run, pr);
        return;
      case 'pickup': {
        const n = Number(pr.data);
        pr.used = true;
        p.items[n] = Math.min(9, p.items[n] + 1);
        say(run, `주웠다: ${['회복약', '방어 강화', '능력 회복', '손전등'][n]}`, 2);
        return;
      }
      case 'checklist':
        pr.used = true;
        run.checklist = true;
        run.loot.research += 3;
        say(run, '서명란이 빈 점검표. 회수(연구 자료 +3).', 3);
        foundRule(run, 'entry');
        return;
      case 'door':
        if (pr.data === 'chase') {
          pr.used = true;
          run.chaserSlow = 3;
          foundRule(run, 'c_door');
          say(run, '문을 닫았다. 뒤의 것이 느려진다.', 2);
          return;
        }
        pr.used = true;
        for (const d of f.props) if (d.kind === 'door' && Math.abs(d.x - pr.x) < 400) d.used = true;
        if (pr.data.startsWith('ok')) {
          run.loot.budget += 20;
          say(run, '정답 문. 길이 열린다. (+예산 20)', 2);
        } else {
          hurtPlayer(run, 25, p.x + 50, true);
          say(run, '죽음 쪽 문. 길은 열렸지만 대가를 치렀다.', 3);
        }
        return;
      case 'crate':
        if (pr.data === 'gapcover') {
          pr.used = true;
          say(run, '틈새를 막았다. 다리 많은 것이 나올 곳이 줄어든다.', 2);
          return;
        }
        break;
      case 'servicedoor':
      case 'hatch':
        if (pr.data === 'back') {
          // 정비 구역 → 층으로 (조각 하나 건너뛴 지름길). 바로 다시 들어가지 않게 잠깐 막는다
          run.phase = 'floor';
          run.service = null;
          run.ents = run.floorEnts;
          run.floorEnts = [];
          run.bolts = [];
          p.x = Math.min(run.floor.width - 200, run.returnX + CHUNK);
          p.y = 580;
          p.z = 0;
          run.atticT = 0;
          run.serviceCd = 2;
          say(run, '해치로 나왔다. 조각 하나를 건너뛰었다.', 2);
          return;
        }
        if (run.serviceCd > 0) return;
        if (pr.kind === 'hatch' && p.z < 100 && run.phase === 'floor') {
          say(run, '천장 해치. 점프해서 E.', 1.5);
          return;
        }
        run.returnX = pr.x;
        run.floorEnts = run.ents;
        run.ents = [];
        run.bolts = [];
        run.service = makeService(run.depth, run.seed + run.depth * 13 + Math.floor(run.floorTime), run.floor.variant);
        run.phase = 'service';
        run.atticT = 0;
        run.atticHealed = false;
        run.predatorSpawned = false;
        p.x = 120;
        p.y = 600;
        p.z = 0;
        say(run, '정비 구역. 덕트는 앉아서, 턱은 뛰어서. 통로는 나갔다 오면 다시 짜인다.', 4);
        return;
      case 'rope':
        run.dialog = { title: '귀환 로프', lines: ['관리국 선배가 걸어 둔 로프. 타면 입구 엘리베이터 앞으로 돌아간다.', `지금까지: 규칙 ${run.found.length}줄(송신 ${run.sent.length}) · 현금 ${run.loot.cash} · 예산 ${run.loot.budget} · 연구 ${run.loot.research} · 이빨 ${run.loot.teeth}`], options: ['귀환한다 (출동 종료)', '더 내려간다'], tag: 'rope' };
        return;
      case 'phone':
        run.dialog = { title: '인터폰 (송신 장치)', lines: ['찾은 정보를 본부로 보낸다. 보낸 정보는 후송돼도 남는다.', '거래: 회수물 1개(연구 자료 또는 미송신 단서)를 주고 다음 층 유형을 듣는다. 총애가 낮으면 거짓이 섞인다.'], options: ['송신', '거래', '닫기'], tag: 'phone' };
        return;
      case 'mirror':
        pr.used = true;
        if (Math.random() < 0.4) run.dialog = { title: '거울', lines: ['거울 속 얼굴이 피곤해 보인다. (규칙 5: 내려라)'], options: ['그래도 탄다 (예산·보상 +30%)', '내린다'], tag: 'mirror' };
        else say(run, '거울. 평소 얼굴이다.', 1.5);
        return;
      case 'panel':
        if (pr.data === 'end') {
          if (run.ents.some((e) => e.alive && e.guardian && e.hostile)) {
            say(run, '수호자가 살아 있다. 패널이 반응하지 않는다.', 2);
            return;
          }
          if (run.trial && !run.trial.done) {
            say(run, '시험 목표를 먼저 달성해야 한다.', 2);
            return;
          }
          if (run.rescue.found && !run.rescue.delivered) say(run, '회사원이 같이 탄다.', 1.5);
          run.elevator = buildElevator(run, false);
          return;
        }
        say(run, '타고 온 승강기. 원래 층을 눌러도 엉뚱한 층이 열린다. (규칙 2)', 2);
        foundRule(run, 'noreturn');
        return;
    }
  }
}
function entsStep(run: Run, f: Floor) {
  const p = run.player;
  // 파도 2: 첫 파도의 절반이 죽으면 등장
  const wave0 = run.ents.filter((e) => e.wave === 0 && !e.guardian && e.special !== 'passenger');
  if (wave0.length && wave0.filter((e) => e.alive).length <= wave0.length / 2) for (const e of run.ents) if (!e.spawned) (e.spawned = true), fx(run, 'text', e.x, e.y - 100, 1, '파도 2');
  for (const e of run.ents) {
    if (!e.alive || !e.spawned) continue;
    for (const k of ['flash', 'inv', 'cool'] as const) if (e[k] > 0) e[k] -= DT;
    if (e.z > 0 && e.special === 'ceiling' && e.state !== 'thrown') {
      e.z = Math.max(0, e.z - 500 * DT);
      continue;
    }
    if (e.state === 'thrown') {
      e.x += e.vx * DT;
      e.timer -= DT;
      for (const o of run.ents) if (o !== e && o.alive && o.hostile && Math.abs(o.x - e.x) < 60 && Math.abs(o.y - e.y) < 40) hurtEnt(run, o, 20, e.x);
      if (e.timer <= 0) (e.state = 'approach'), (e.stun = 0.4);
      continue;
    }
    if (e.state === 'held' || e.state === 'dead') continue;
    if (e.stun > 0) {
      e.stun -= DT;
      continue;
    }
    const dx = p.x - e.x,
      dist = Math.abs(dx),
      laneOk = Math.abs(p.y - e.y) < 44;
    if (e.vx) {
      e.x += e.vx * DT;
      e.vx *= 0.9;
      if (Math.abs(e.vx) < 2) e.vx = 0;
    }
    if (e.state === 'follow') {
      if (dist > 120) e.x += Math.sign(dx) * 200 * DT;
      e.y += (p.y - e.y) * 0.1;
      e.dir = Math.sign(dx) || e.dir;
      if (run.phase === 'service' && chunkAt(f, p.x).kind === 'attic' && !run.rescue.delivered) {
        run.rescue.delivered = true;
        say(run, '회사원을 다락방까지 데려왔다. 로프로 먼저 올려 보낸다.', 3);
        e.alive = false;
      }
      continue;
    }
    if (e.special === 'passenger') {
      e.dir = Math.sign(dx) || e.dir;
      continue;
    }
    if (e.special === 'rule' && !e.hostile) {
      // 인사 없이 1초 이상 가까이 있으면 적대
      if (dist < 130 && e.timer >= 0) {
        e.timer += DT;
        if (e.timer > 1.2) (e.hostile = true), (e.state = 'approach'), say(run, '인사 없이 다가갔다. 주민의 턱이 벌어진다. (규칙 13)', 3);
      }
      e.dir = Math.sign(dx) || e.dir;
      continue;
    }
    if (e.special === 'lurker' && !e.hostile) {
      if (dist < 90 && laneOk) (e.hostile = true), (e.state = 'windup'), (e.timer = 0.2), say(run, '해롭지 않아 보이던 것이 돌아섰다. (규칙 6)', 3), foundRule(run, 'lobby');
      continue;
    }
    if (e.special === 'elder' && !e.hostile) continue;
    if (e.special === 'patrol' && e.state === 'patrol') {
      const [x0, x1] = e.patrol!;
      e.x += e.dir * 110 * e.speed * DT;
      if (e.x < x0) e.dir = 1;
      if (e.x > x1) e.dir = -1;
      const sees = Math.sign(dx) === e.dir && dist < 380 && Math.abs(p.y - e.y) < 70;
      if (sees) (e.state = 'approach'), (e.aux = 4), (e.hostile = true), fx(run, 'text', e.x, e.y - e.h - 20, 0.8, '!');
      continue;
    }
    if (e.special === 'patrol' && e.hostile) {
      e.aux -= DT;
      if (e.aux <= 0 && dist > 300 && e.state === 'approach') (e.state = 'patrol'), (e.hostile = false);
    }
    if (e.special === 'ceiling' && e.guardian) {
      e.aux += DT;
      if (e.aux > 6 && e.state === 'approach') {
        e.aux = 0;
        const holes = f.props.filter((pr) => pr.kind === 'crate' && pr.data === 'gapcover' && !pr.used);
        if (holes.length) {
          const h = holes[Math.floor(Math.random() * holes.length)];
          e.x = h.x;
          e.z = 300;
          fx(run, 'text', e.x, e.y - 200, 1, '틈새에서');
        } else (e.stun = 2), fx(run, 'text', e.x, e.y - e.h, 1, '나올 곳이 없다');
      }
    }
    if (e.special === 'reverse') {
      const onScreen = dist < 700;
      const facing = Math.sign(dx) !== p.dir;
      p.reversed = onScreen && facing && e.alive;
    }
    if (e.special === 'predator' && run.phase === 'service') e.speed = f.variant.includes('빠른') ? 1.0 : 0.7;
    // 공통 추격·공격
    if (!e.hostile) continue;
    if (e.state === 'idle' && dist < 520) e.state = 'approach';
    if (e.state === 'approach') {
      e.dir = Math.sign(dx) || e.dir;
      const ranged = e.special === 'ranged';
      const want = ranged ? 320 : e.reach - 10;
      if (dist > want) e.x += e.dir * 170 * e.speed * DT;
      else if (ranged && dist < 200) e.x -= e.dir * 120 * DT;
      if (!laneOk) e.y += Math.sign(p.y - e.y) * 90 * DT;
      if (e.cool <= 0 && laneOk && (ranged ? dist < e.reach : dist < e.reach + 10)) (e.state = 'windup'), (e.timer = e.windup);
    } else if (e.state === 'windup') {
      e.timer -= DT;
      if (e.timer <= 0) {
        e.state = 'attack';
        e.timer = 0.15;
        if (e.special === 'ranged') run.bolts.push({ x: e.x + e.dir * 30, y: e.y, z: 80, vx: e.dir * 800, life: 0.7, enemy: true, dmg: e.atk });
      }
    } else if (e.state === 'attack') {
      e.timer -= DT;
      if (e.special !== 'ranged' && Math.abs(p.x - e.x) < e.reach + 20 && laneOk && Math.abs(p.z - e.z) < 120 && Math.sign(p.x - e.x) === e.dir) {
        hurtPlayer(run, e.atk, e.x, e.guardian || e.elite);
        e.state = 'approach';
        e.cool = 0.8;
      }
      if (e.timer <= 0) (e.state = 'approach'), (e.cool = e.guardian ? 0.6 : 0.9);
    }
    if (e.special === 'invisible') fx(run, 'ripple', e.x, e.y, 0.1);
  }
  run.ents = run.ents.filter((e) => e.alive || e.flash > -1);
  const victoryGuard = run.ents.find((e) => !e.alive && e.guardian && e.state === 'dead');
  if (victoryGuard && !run.log.some((l) => l.includes(`${victoryGuard.label} 격파`))) run.log.push(`${victoryGuard.label} 격파`);
}
function boltsStep(run: Run, f: Floor) {
  const p = run.player;
  for (const b of run.bolts) {
    b.x += b.vx * DT;
    b.life -= DT;
    if (b.enemy) {
      if (Math.abs(b.x - p.x) < 30 && Math.abs(b.y - p.y) < 40 && p.z < 140) (hurtPlayer(run, b.dmg, b.x), (b.life = 0));
    } else
      for (const e of run.ents) {
        if (!e.alive || !e.spawned || e.special === 'passenger' || (e.state === 'friendly' && e.special === 'rule')) continue;
        if (Math.abs(b.x - e.x) < e.w / 2 + 10 && Math.abs(b.y - e.y) < 40 && Math.abs(b.z - e.z) < e.h) {
          hurtEnt(run, e, b.dmg, b.x - b.vx);
          b.life = 0;
          break;
        }
      }
    fx(run, 'ripple', b.x, b.y, 0.05);
  }
  run.bolts = run.bolts.filter((b) => b.life > 0);
  void f;
}
function floorStep(run: Run, f: Floor) {
  const p = run.player;
  if (run.ended) return;
  if (f.type === 'chase' && run.phase === 'floor') {
    const slow = run.chaserSlow > 0 ? 0.3 : 1;
    if (run.chaserSlow > 0) run.chaserSlow -= DT;
    run.chaserX += (150 + run.depth * 10) * slow * DT;
    if (run.chaserX > p.x - 60 && !run.guardianDead) {
      // 잡히면 0.5초마다 피해 + 앞으로 밀림. 경직은 없다(경직이면 빠져나올 수 없다)
      run.chaseHurtT -= DT;
      if (run.chaseHurtT <= 0) {
        run.chaseHurtT = 0.5;
        hurtPlayer(run, 8, run.chaserX - 100, false, true);
        fx(run, 'text', p.x, p.y - 280, 0.6, '잡혔다! 달려라');
      }
      p.x = run.chaserX + 70;
    }
    const endX = f.chunks.find((c) => c.kind === 'guardian' || c.kind === 'hall_end')!.x;
    if (run.chaserX > endX - 400) run.chaserX = endX - 400;
  }
  if (run.trial) {
    const t = run.trial;
    if (t.started && !t.done && !t.failed) {
      t.left -= DT;
      if (t.kills >= (f.goal?.need ?? 3)) {
        t.done = true;
        run.loot.budget += 50;
        run.favor = clamp(run.favor + 1, -3, 3);
        say(run, '시험 목표 달성. 총애 +1, 예산 +50', 4);
        run.log.push('시험 목표 달성');
      } else if (t.left <= 0) {
        t.failed = true;
        t.done = true;
        say(run, '시간 초과. 수호자가 늘어난다.', 3);
        for (let k = 0; k < 2; k++) {
          const e = spawnEnt(run, 'charger', p.x + 400 + k * 100, p.y, true, false, 0);
          e.hostile = true;
          e.state = 'approach';
        }
      }
    }
    if (!t.started && chunkAt(f, p.x).kind === 'goal') {
      t.started = true;
      say(run, `시험 층: ${f.goal?.time}초 안에 ${f.goal?.need}체. 벽의 목표를 읽지 않고 들어왔다.`, 3);
    }
  }
  if (run.phase === 'service') {
    const c = chunkAt(f, p.x);
    if (c.kind === 'attic') {
      if (!run.atticHealed) {
        run.atticHealed = true;
        p.hp = Math.min(p.max, p.hp + Math.round(p.max * 0.4));
        say(run, '다락방. 체력 40% 회복. 저장됨. 오래 있지 마라.', 3);
      }
      run.atticT += DT;
      const limit = f.variant.includes('빠른 포식자') ? 45 : 90;
      if (run.atticT > limit && !run.predatorSpawned) {
        run.predatorSpawned = true;
        const e = spawnEnt(run, 'predator', c.x + c.w - 100, 600, false, false, 0);
        e.hostile = true;
        e.state = 'approach';
        say(run, '오래 있었다. 틈새로 떨어진 것들을 먹는 것이 온다. (규칙 7)', 4);
        foundRule(run, 'attic');
      }
    }
  }
}
export function serialize(run: Run, meta: Meta): string {
  return JSON.stringify({ run, meta });
}
export function restore(text: string | null): { run: Run; meta: Meta } | null {
  if (!text) return null;
  try {
    const d = JSON.parse(text) as { run: Run; meta: Meta };
    if (d?.run?.version !== SAVE_VERSION || !d.meta) return null;
    return d;
  } catch {
    return null;
  }
}
export { RULES, TYPE_LABEL, depthLabel, LANE_MIN, LANE_MAX, CHUNK };
