// 수호자 (층 유형별 구역 보스). 근거: 스테이지설계서_차원승강기 10장, 명일아파트 6.1(405호), 기본 기획서 10.4·부록 E.2.
// 공통: 평상시 경 아머, 공격 유효 구간 중 아머, 그로기 게이지가 차면 2초간 아머 없음. 체력 50%(일부 66/33%)에서 패턴이 바뀐다.
// 규칙 약점: 그 층 규칙을 아는 사람이 쉽게 이긴다 (경로 밖 기습, 틈새 막기, 빛, 그릇, 등 돌리기, 잘 먹었습니다).
import { emitDebuff } from './debuff';
import { attackersNow, engage, pickAttack } from './ai';
import { B, bake, humanoid } from './frames';
import { Enemy, newAttackId, stillTicks, type Brain } from './enemy';
import { charge, grab, S, shoot, strike } from './moves';
import type { Attack, EnemyDef } from './roster';
import type { FloorType, Hit, LocalBox, WorldView } from './types';
import { spawnInto } from './registry';

export interface GuardianDef extends EnemyDef {
  floor: FloorType;
  /** 그로기 게이지 최대 (누적 피해) */
  groggyMax: number;
  intro: string;
  /** 규칙 약점 한 줄 (도감·HUD) */
  rule: string;
}

const g = (d: Omit<GuardianDef, 'role' | 'faction' | 'drop' | 'grabbable' | 'ai' | 'types' | 'price'> & Partial<GuardianDef>): GuardianDef => ({
  role: 'rush',
  faction: 'guardian',
  drop: 'guardian',
  grabbable: false,
  ai: 'boss',
  types: [d.floor],
  price: 0,
  ...d,
});

function phaseCheck(e: Enemy, w: WorldView, marks: number[]) {
  const next = marks[e.phase - 1];
  if (next !== undefined && e.hp < e.hpMax * next) {
    e.phase++;
    e.move = null;
    e.set('stunned');
    e.stunT = 24;
    e.inv = 24;
    w.emit({ type: 'bossRoar', x: e.x, kind: e.kind });
    w.emit({ type: 'custom', name: 'bossPhase', data: { id: e.id, kind: e.kind, phase: e.phase } });
    w.shake(12, 5);
    return true;
  }
  return false;
}
function intro(e: Enemy, w: WorldView) {
  if (e.age !== 2) return;
  const d = e.def as GuardianDef;
  e.groggyMax = d.groggyMax;
  e.say(d.intro, 90);
  w.emit({ type: 'bossRoar', x: e.x, kind: e.kind });
}

// ─── 1. 낡은 제복의 경비원 (로비 L3) / 시험 감독 (시험 층) ───────────────────

const GH = 210;
const guardBody = humanoid(76, GH);
const guardAtk = {
  rush: charge('rush', '손전등 돌진', 76, GH, { tele: 20, dash: 20, speed: 12, recover: 26, armor: 2, spec: S(18, 'stagger', 16, { strength: 2 }), body: guardBody }),
  baton: bake(
    'baton',
    '경봉 2연타',
    guardBody,
    [
      { n: 14, tele: true, hurt: humanoid(76, GH, 16, -10) },
      { n: 4, hit: [B(20, 130, 110, 200, 22, 'weapon')], spec: 0, vx: 4, armor: 2 },
      { n: 8 },
      { n: 5, hit: [B(10, 140, 40, 170, 22, 'weapon')], spec: 1, vx: 5, armor: 2 },
      { n: 22, hurt: humanoid(76, GH, 16, 14) },
    ],
    [S(12, 'flinch', 5), S(18, 'down', 8, { strength: 3 })],
    { danger: [{ fx0: 10, fx1: 180, dy: 22 }] },
  ),
  slam: bake(
    'slam',
    '내리치기',
    guardBody,
    [
      { n: 26, tele: true, hurt: humanoid(76, GH, 16, -16) },
      { n: 4, hit: [B(20, 120, 0, 120, 26, 'weapon')], armor: 2, fire: 'ring' },
      { n: 26 },
    ],
    [S(20, 'down', 6, { strength: 3 })],
    { danger: [{ fx0: -260, fx1: 260, dy: 24 }] },
  ),
  whistle: shoot('whistle', '호루라기', 76, GH, { tele: 24, shots: 1, gap: 10, recover: 30, fire: 'whistle', armor: 2, body: guardBody }),
  punch: grab('punch', '표 검사 (붙잡기)', 76, GH, { tele: 14, active: 5, recover: 22, reach: 120, lunge: 6, ticks: 40, dmgPerTick: 1.6, armor: 2, body: guardBody }),
};
const guardAttacks: Attack[] = [
  { move: guardAtk.baton, range: [0, 170], dy: 24, cd: 50, weight: 3 },
  { move: guardAtk.rush, range: [160, 520], dy: 22, cd: 110, weight: 2 },
  { move: guardAtk.slam, range: [0, 240], dy: 40, cd: 150, weight: 2, when: 'phase2' },
  { move: guardAtk.whistle, range: [0, 600], dy: 200, cd: 240, weight: 1, when: 'phase2' },
];
const proctorAttacks: Attack[] = [
  { move: guardAtk.punch, range: [0, 140], dy: 24, cd: 90, weight: 3 },
  { move: guardAtk.baton, range: [0, 170], dy: 24, cd: 60, weight: 2 },
  { move: guardAtk.rush, range: [180, 520], dy: 22, cd: 140, weight: 1 },
  { move: guardAtk.slam, range: [0, 240], dy: 40, cd: 150, weight: 2, when: 'phase2' },
];

export const guard: GuardianDef = g({
  kind: 'guard',
  label: '낡은 제복의 경비원',
  floor: 'lobby',
  hp: 500,
  speed: 1.1,
  w: 76,
  h: GH,
  body: guardBody,
  armor: 1,
  attacks: guardAttacks,
  keep: [60, 150],
  groggyMax: 110,
  intro: '…순찰 중입니다.',
  rule: '경로 밖에 서 있으면 못 본다. 순찰 중 등 뒤 타격 2배',
  note: '수십 년 전 제복. 바닥에 표시된 경로를 돌며 손전등으로 비춘다. 빛에 들어가면 돌진한다.',
  color: '#3e4a5a',
});
export const proctor: GuardianDef = g({
  kind: 'proctor',
  label: '낡은 제복의 차장',
  floor: 'trial',
  hp: 550,
  speed: 1.2,
  w: 76,
  h: GH,
  body: guardBody,
  armor: 1,
  attacks: proctorAttacks,
  keep: [60, 140],
  groggyMax: 120,
  intro: '시험 시작. 목표를 읽었습니까?',
  rule: '10초마다 호루라기 (점프로 피함). 분 뒤 초시계를 보는 2초가 빈틈',
  note: '고정된 순찰 경로와 초시계. 10초마다 호루라기를 분다. 시험 층에서 가장 많이 목격된다.',
  color: '#4a4436',
});

function inCone(e: Enemy, w: WorldView): boolean {
  const p = w.player;
  const dx = (p.x - e.x) * e.dir;
  return dx > 0 && dx < 380 && Math.abs(p.y - e.y) < 30 + dx * 0.16 && !(p.crouching && dx > 200);
}

const guardBrain: Brain = {
  tick(e, w) {
    intro(e, w);
    if (e.age === 1) ((e.mem.route = [e.x - 320, e.x + 320]), (e.mem.mode = 'patrol'), (e.dir = 1));
    if (phaseCheck(e, w, [0.5])) e.mem.mode = 'fight';
    const proctorV = e.kind === 'proctor';
    if (proctorV) {
      // 초시계: 300틱마다 호루라기, 그 뒤 60틱 초시계를 들여다본다 (빈틈)
      e.mem.watch = (e.mem.watch ?? 0) + 1;
      if (e.mem.watch === 280) e.say('…10초.', 20);
      if (e.mem.watch >= 300 && (e.state === 'idle' || e.state === 'walk')) {
        e.mem.watch = 0;
        e.start(guardAtk.whistle, w, 0);
        e.mem.peek = 90;
      }
      if (e.mem.peek > 0 && --e.mem.peek < 60 && e.state !== 'attack') {
        if (e.mem.peek === 59) e.say('(초시계를 본다)', 50);
        e.weakOpen = Math.max(e.weakOpen, 2);
        if (e.state === 'idle' || e.state === 'walk') return true;
      }
    }
    if (e.mem.mode === 'patrol' && e.lastHurt > 0 && e.age - e.lastHurt < 2 && !e.mem.stealth) e.mem.mode = 'fight';
    e.mem.stealth = false;
  },
  think(e, w) {
    const p = w.player;
    if (e.mem.mode === 'patrol') {
      const [a, b] = e.mem.route;
      const sp = e.speed() * (e.phase >= 2 ? 1.5 : 0.8);
      e.x += e.dir * sp;
      if (e.x > b) e.dir = -1;
      if (e.x < a) e.dir = 1;
      // 2단계: 45틱마다 뒤를 돌아본다
      if (e.phase >= 2 && e.st % 45 === 44) e.dir = e.dir === 1 ? -1 : 1;
      e.set('walk');
      if (inCone(e, w)) {
        e.mem.mode = 'fight';
        e.mem.seen = w.tick;
        e.say('거기 누구야', 40);
        e.face(p.x);
        return e.start(guardAtk.rush, w, 110);
      }
      return;
    }
    // 싸움: 6초 동안 못 보면 순찰로 돌아간다
    if (inCone(e, w) || e.age - e.lastHurt < 30) e.mem.seen = w.tick;
    if (w.tick - (e.mem.seen ?? 0) > 180 && e.phase < 2) {
      e.mem.mode = 'patrol';
      e.say('…기분 탓인가', 40);
      return;
    }
    engage(e, w, 0.12);
  },
  hit(e, h) {
    // 순찰 중 등 뒤 = 기습 2배, 아머 무시
    if (e.mem.mode === 'patrol' && h.dir === e.dir) {
      e.mem.stealth = true;
      return { weak: true, text: '기습' };
    }
  },
  drawUnder(e, ctx) {
    const r = e.mem.route as [number, number] | undefined;
    if (r) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = e.kind === 'proctor' ? '#e8d27a' : '#7fb0e0';
      ctx.setLineDash([14, 10]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(r[0], e.y + 4);
      ctx.lineTo(r[1], e.y + 4);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (e.state === 'dead') return;
    // 손전등 원뿔 (바닥에 비친 빛)
    ctx.globalAlpha = e.mem.mode === 'patrol' ? 0.22 : 0.12;
    ctx.fillStyle = '#ffe79a';
    ctx.beginPath();
    ctx.moveTo(e.x + e.dir * 20, e.y - 6);
    ctx.lineTo(e.x + e.dir * 380, e.y - 30 - 380 * 0.16);
    ctx.lineTo(e.x + e.dir * 380, e.y + 30 + 380 * 0.16);
    ctx.closePath();
    ctx.fill();
  },
};

// ─── 2. 다리 많은 것 (추격의 층) ───────────────────────────────

const legsBody: LocalBox[] = [B(-110, 70, 20, 110, 30, 'torso'), B(70, 120, 40, 120, 24, 'head'), B(-120, 120, 0, 30, 34, 'legs')];
const legsAtk = {
  pounce: bake(
    'pounce',
    '덮치기',
    legsBody,
    [
      { n: 26, tele: true, hurt: [B(-90, 90, -10, 40, 30, 'torso')] },
      { n: 6, hit: [B(-120, 120, 0, 120, 36, 'legs')], vz: -40, armor: 2, fire: 'ring' },
      { n: 34, hurt: [B(-110, 110, 0, 50, 30, 'core')] },
    ],
    [S(22, 'down', 4, { strength: 3 })],
    { danger: [{ fx0: -130, fx1: 130, dy: 36 }] },
  ),
  sweep: strike('sweep', '다리 쓸기', 240, 120, { tele: 18, active: 7, recover: 22, reach: [-170, 190], z: [0, 46], dy: 44, extend: false, low: true, armor: 2, body: legsBody, spec: S(16, 'down', 8, { strength: 3 }) }),
  stab: bake(
    'stab',
    '앞다리 찌르기',
    legsBody,
    [
      { n: 14, tele: true },
      { n: 4, hit: [B(60, 210, 60, 140, 20, 'legs')], spec: 0, armor: 2 },
      { n: 6 },
      { n: 4, hit: [B(60, 220, 20, 100, 20, 'legs')], spec: 0, armor: 2 },
      { n: 18 },
    ],
    [S(12, 'stagger', 8, { debuff: { kind: 'bleed', ticks: 120 } })],
    { danger: [{ fx0: 60, fx1: 220, dy: 20 }] },
  ),
  web: shoot('web', '거미줄', 240, 120, { tele: 16, shots: 3, gap: 6, recover: 18, fire: 'web', body: legsBody }),
  emerge: charge('emerge', '틈새에서 튀어나오기', 240, 120, { tele: 16, dash: 14, speed: 14, recover: 20, armor: 2, spec: S(18, 'stagger', 14, { strength: 2 }), body: legsBody }),
};
export const legs: GuardianDef = g({
  kind: 'legs',
  label: '다리 많은 것',
  floor: 'chase',
  hp: 700,
  speed: 2.6,
  w: 240,
  h: 120,
  body: legsBody,
  armor: 1,
  attacks: [
    { move: legsAtk.sweep, range: [0, 200], dy: 44, cd: 90, weight: 2, when: 'grounded' },
    { move: legsAtk.stab, range: [40, 230], dy: 22, cd: 50, weight: 3 },
    { move: legsAtk.web, range: [200, 600], dy: 30, cd: 120, weight: 2, when: 'phase2' },
  ],
  keep: [120, 200],
  groggyMax: 140,
  intro: '(벽 속에서 다리 소리가 난다)',
  rule: '틈새를 막으면(E) 나올 곳이 줄어든다. 다 막히면 못 숨고 넘어진다',
  note: '벽과 천장을 기는 다리 많은 것. 천장에서 덮치고, 틈새로 사라졌다 다른 틈새에서 나온다.',
  color: '#3b3029',
});

interface Crevice {
  x: number;
  plugged: boolean;
}
function crevices(e: Enemy, w: WorldView): Crevice[] {
  if (!e.mem.crev) {
    const fromFloor = (w.floor.props ?? []).filter((p) => p.kind === 'crevice').map((p) => ({ x: p.x, plugged: p.label === 'plugged' }));
    const [b0, b1] = w.bounds;
    e.mem.crev = fromFloor.length ? fromFloor : [0.12, 0.38, 0.62, 0.88].map((k) => ({ x: b0 + (b1 - b0) * k, plugged: false }));
  }
  return e.mem.crev;
}

const legsBrain: Brain = {
  tick(e, w) {
    intro(e, w);
    e.mem.laneTop = w.lane[0];
    if (e.age === 1) ((e.mem.mode = 'ceiling'), (e.mem.cling = true), (e.z = 300), (e.mem.modeT = 0));
    phaseCheck(e, w, [0.5]);
    e.mem.modeT++;
    const cs = crevices(e, w);
    if (e.mem.mode === 'hidden') {
      e.alpha = 0;
      if (e.mem.modeT > 60) {
        const open = cs.filter((c, i) => !c.plugged && i !== e.mem.inIdx);
        const c = open.length ? open[Math.floor(w.rand() * open.length)] : null;
        e.alpha = 1;
        if (!c) {
          // 나올 틈새가 없다 → 들어간 곳으로 끌려 나와 넘어짐
          const back = cs[e.mem.inIdx];
          e.x = back.x;
          e.y = w.lane[0] + 10;
          e.mem.mode = 'ground';
          e.mem.modeT = 0;
          e.set('stunned');
          e.stunT = 120;
          e.weakOpen = 120;
          e.say('(틈새가 막혔다)', 60);
          return true;
        }
        e.x = c.x;
        e.y = w.lane[0] + 10;
        e.mem.mode = 'ground';
        e.mem.modeT = 0;
        e.face(w.player.x);
        e.start(legsAtk.emerge, w, 0);
      }
      return true;
    }
    if (e.mem.mode === 'ground' && (e.state === 'idle' || e.state === 'walk')) {
      // 7초마다 틈새로 사라지거나 천장으로 올라간다
      if (e.mem.modeT > 210) {
        const open = cs.map((c, i) => [c, i] as const).filter(([c]) => !c.plugged);
        if (open.length && w.rand() < 0.6) {
          const [c, i] = open.reduce((a, b) => (Math.abs(b[0].x - e.x) < Math.abs(a[0].x - e.x) ? b : a));
          e.mem.mode = 'toCrevice';
          e.mem.target = i;
          e.mem.cx = c.x;
        } else e.mem.mode = 'climb';
        e.mem.modeT = 0;
      }
    }
    if (e.mem.mode === 'toCrevice' && (e.state === 'idle' || e.state === 'walk')) {
      const c = cs[e.mem.target];
      if (c.plugged) return void ((e.mem.mode = 'ground'), (e.mem.modeT = 150));
      const dx = c.x - e.x,
        dy = w.lane[0] - e.y;
      e.face(c.x);
      e.x += Math.sign(dx) * Math.min(Math.abs(dx), e.speed() * 1.6);
      e.y += Math.sign(dy) * Math.min(Math.abs(dy), e.speed());
      e.set('walk');
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) ((e.mem.mode = 'hidden'), (e.mem.modeT = 0), (e.mem.inIdx = e.mem.target));
      return true;
    }
    if (e.mem.mode === 'climb' && (e.state === 'idle' || e.state === 'walk')) {
      e.z += 10;
      if (e.z >= 300) ((e.z = 300), (e.mem.cling = true), (e.mem.mode = 'ceiling'), (e.mem.modeT = 0), (e.mem.pounces = 0));
      return true;
    }
    if (e.state === 'attack' && e.move?.id === 'pounce' && e.mf === e.move.frames.length - 1) {
      e.mem.pounces = (e.mem.pounces ?? 0) + 1;
      // 2단계: 세 번 연속 덮친다
      if (e.phase >= 2 && e.mem.pounces < 3) ((e.mem.mode = 'climb'), (e.mem.modeT = 0));
      else ((e.mem.mode = 'ground'), (e.mem.modeT = 0));
    }
  },
  think(e, w) {
    const p = w.player;
    if (e.mem.mode === 'ceiling') {
      const dx = p.x - e.x,
        dy = p.y - e.y;
      e.face(p.x);
      e.x += Math.sign(dx) * Math.min(Math.abs(dx), e.speed() * 1.4);
      e.y += Math.sign(dy) * Math.min(Math.abs(dy), e.speed());
      e.set('walk');
      if (Math.abs(dx) < 30 && Math.abs(dy) < 18 && e.mem.modeT > 30) e.start(legsAtk.pounce, w, 0);
      return;
    }
    engage(e, w, 0.12);
  },
  hurt(e) {
    if (e.mem.mode === 'hidden') return null;
    if (e.mem.cling && e.state !== 'attack') return [B(-90, 90, -10, 40, 30, 'torso')];
  },
  signal(e, s, w) {
    if (s.kind !== 'plug') return;
    const c = crevices(e, w)
      .filter((c) => !c.plugged)
      .sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x))[0];
    if (c && Math.abs(c.x - s.x) < 120) {
      c.plugged = true;
      w.emit({ type: 'custom', name: 'ruleKept', data: { rule: 'c_plug', id: e.id } });
      w.fx('text', c.x, w.lane[0], 120, '틈새 막음');
    }
  },
  drawBack(e, ctx) {
    for (const c of (e.mem.crev ?? []) as Crevice[]) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = c.plugged ? '#6b5a3e' : '#050505';
      const y = (e.mem.laneTop ?? 500) - 4;
      ctx.fillRect(c.x - 26, y - 70, 52, 70);
      if (c.plugged) ((ctx.strokeStyle = '#a88a5a'), ctx.strokeRect(c.x - 26, y - 70, 52, 70));
    }
  },
  drawUnder(e, ctx) {
    if (e.mem.cling || (e.state === 'attack' && e.move?.id === 'pounce')) {
      const k = e.state === 'attack' ? 0.3 + 0.45 * Math.min(1, e.mf / 26) : 0.18;
      ctx.globalAlpha = k;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, 130, 24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

// ─── 3. 그림자 (어둠의 층) ───────────────────────────────────

const shadowFlat: LocalBox[] = [B(-90, 90, 0, 12, 34, 'core')];
const shadowTall = humanoid(90, 230, 20);
const shadowAtk = {
  rise: bake(
    'rise',
    '발밑에서 솟기',
    shadowFlat,
    [
      { n: 24, tele: true },
      { n: 8, hit: (t) => [B(-60, 60, 0, 60 + 180 * t, 30, 'arm')], hurt: (t) => [B(-45, 45, 0, 60 + 170 * t, 22, 'core')], armor: 2 },
      { n: 36, hurt: shadowTall },
    ],
    [S(20, 'launch', 1, { lift: 15, strength: 3, unblockable: true })],
    { danger: [{ fx0: -60, fx1: 60, dy: 30 }] },
  ),
  grasp: bake(
    'grasp',
    '손 모으기',
    shadowTall,
    [
      { n: 30, tele: true },
      { n: 10, hit: (t) => [B(-420 + 300 * t, -120 + 120 * t, 0, 60, 30, 'arm'), B(120 - 120 * t, 420 - 300 * t, 0, 60, 30, 'arm')], armor: 2 },
      { n: 30 },
    ],
    [S(14, 'bind', 2, { low: true, unblockable: false, debuff: { kind: 'fear', ticks: 60 } })],
    { danger: [{ fx0: -420, fx1: 420, dy: 30 }] },
  ),
  engulf: bake('engulf', '어둠 퍼뜨리기', shadowTall, [{ n: 36, tele: true }, { n: 6, ev: 'engulf', armor: 2 }, { n: 30 }], [S(0, 'none')]),
};
export const shadow: GuardianDef = g({
  kind: 'shadow',
  label: '그림자',
  floor: 'dark',
  hp: 600,
  speed: 1.6,
  w: 180,
  h: 230,
  body: shadowFlat,
  armor: 1,
  attacks: [
    { move: shadowAtk.grasp, range: [0, 420], dy: 40, cd: 160, weight: 2 },
    { move: shadowAtk.engulf, range: [0, 900], dy: 400, cd: 420, weight: 1, when: 'phase2' },
  ],
  keep: [0, 30],
  groggyMax: 120,
  intro: '(바닥의 얼룩이 짙어진다)',
  rule: '빛(손전등) 안에서만 피해를 받는다. 멈추면 발밑에서 솟는다',
  note: '처음엔 얼룩, 점점 손에 잡힐 듯 진해진다. 멈춘 사람 밑에서 솟아오른다.',
  color: '#120f18',
});

const shadowBrain: Brain = {
  tick(e, w) {
    intro(e, w);
    phaseCheck(e, w, [0.5]);
    const lit = w.light > 0.3 && Math.sign(e.x - w.player.x) === w.player.dir && Math.abs(e.x - w.player.x) < 420;
    e.mem.lit = lit;
    e.alpha = lit ? 0.55 : 1;
    if (e.phase >= 2 && e.mem.decoy === undefined) e.mem.decoy = e.x + 300;
    if (e.mem.decoy !== undefined) e.mem.decoy += Math.sign(w.player.x - e.mem.decoy) * 1.2;
  },
  think(e, w) {
    const p = w.player;
    const still = stillTicks(w);
    if (e.mem.lit) {
      // 빛을 받으면 얇아져 물러난다
      e.x -= Math.sign(p.x - e.x) * e.speed();
      return e.set('walk');
    }
    const dx = p.x - e.x,
      dy = p.y - e.y;
    const sp = e.speed() * (still > 15 ? 2.2 : 1);
    e.x += Math.sign(dx) * Math.min(Math.abs(dx), sp);
    e.y += Math.sign(dy) * Math.min(Math.abs(dy), sp * 0.7);
    e.set('walk');
    if (Math.abs(dx) < 30 && Math.abs(dy) < 20 && e.cd('rise') <= 0 && (still > 15 || w.rand() < 0.03)) return e.start(shadowAtk.rise, w, 70);
    const a = pickAttack(e, w);
    if (a && w.rand() < 0.04) e.start(a.move, w, a.cd);
  },
  ev(e, name, w) {
    if (name !== 'engulf') return;
    w.emit({ type: 'custom', name: 'screen', data: { effect: 'dark', ticks: 150 } });
    emitDebuff(w, { kind: 'fear', ticks: 60 }, e.id);
    spawnInto(w, 'shade', e.x - 200, e.y);
    spawnInto(w, 'shade', e.x + 200, e.y);
  },
  hit(e) {
    const risen = e.state === 'attack' && (e.move?.id === 'rise' ? e.mf >= 24 : true);
    if (!e.mem.lit && !risen && e.state !== 'stunned') return { immune: true, text: '빛이 필요하다' };
  },
  drawUnder(e, ctx) {
    if (e.mem.decoy === undefined || e.state === 'dead') return;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#120f18';
    ctx.beginPath();
    ctx.ellipse(e.mem.decoy, e.y + 8, 90, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  },
};

// ─── 4. 소리와 냄새 (침묵의 층) ────────────────────────────────

const noiseBody = humanoid(70, 200);
const noiseAtk = {
  scream: strike('scream', '귓가의 비명', 70, 200, { tele: 16, active: 6, recover: 24, reach: [-150, 150], z: [0, 220], dy: 60, extend: false, armor: 2, body: noiseBody, spec: S(16, 'stagger', 12, { unblockable: true, debuff: { kind: 'fear', ticks: 75 }, strength: 2 }) }),
  claw: strike('claw', '보이지 않는 손톱', 70, 200, { tele: 12, active: 4, recover: 16, reach: [15, 110], z: [60, 190], armor: 2, body: noiseBody, spec: S(14, 'stagger', 8, { debuff: { kind: 'bleed', ticks: 120 } }) }),
  stink: bake('stink', '썩은 내', noiseBody, [{ n: 14, tele: true }, { n: 4, fire: 'cloud' }, { n: 16 }], [S(0, 'none')]),
};
export const noise: GuardianDef = g({
  kind: 'noise',
  label: '소리와 냄새',
  floor: 'silent',
  hp: 400,
  speed: 1.4,
  w: 70,
  h: 200,
  body: noiseBody,
  armor: 1,
  attacks: [
    { move: noiseAtk.claw, range: [0, 120], dy: 24, cd: 40, weight: 3 },
    { move: noiseAtk.scream, range: [0, 150], dy: 60, cd: 150, weight: 1 },
    { move: noiseAtk.stink, range: [0, 400], dy: 120, cd: 180, weight: 1 },
  ],
  keep: [30, 90],
  groggyMax: 90,
  intro: '(아무 소리도 들리지 않는다)',
  rule: '소리를 내면 바로 옆에 온다. 조용히 그릇 옆으로 유인해 덮어라(E)',
  note: '몸 없는 발소리·목소리·썩은 내. 보이지 않고 파문만 보인다.',
  color: '#bfc8b0',
});

const noiseBrain: Brain = {
  tick(e, w) {
    intro(e, w);
    phaseCheck(e, w, [0.5]);
    const shown = e.state === 'attack' || e.state === 'bound' || e.age - e.lastHurt < 24;
    e.alpha += ((shown ? 0.8 : 0.04) - e.alpha) * 0.25;
    if (e.state === 'bound') {
      e.weakOpen = Math.max(e.weakOpen, 2);
      return;
    }
    if (e.age % 12 === 0 && e.state !== 'dead') w.fx('ring', e.x, e.y, 0);
    // 큰 소리 → 소리 난 사람 바로 뒤로 순간 이동
    const p = w.player;
    const loud = w.noise > 0.5 || p.running || /shot|shoot|super|ability/.test(p.state);
    if (loud && e.cd('blink') <= 0 && (e.state === 'idle' || e.state === 'walk')) {
      e.cds.blink = e.phase >= 2 ? 60 : 100;
      e.x = p.x - p.dir * 90;
      e.y = p.y;
      e.face(p.x);
      e.say('쉿', 20);
      e.start(noiseAtk.claw, w, 0);
      return true;
    }
  },
  think(e, w) {
    const p = w.player;
    // 조용하면 소리 났던 곳(마지막 위치)으로 천천히 간다
    if (w.noise > 0.15 || Math.abs(p.x - e.x) < 200) e.mem.lastHeard = [p.x, p.y];
    const t = e.mem.lastHeard as [number, number] | undefined;
    if (t && Math.abs(t[0] - e.x) > 60) {
      e.face(t[0]);
      e.x += Math.sign(t[0] - e.x) * e.speed();
      e.y += Math.sign(t[1] - e.y) * Math.min(Math.abs(t[1] - e.y), e.speed() * 0.6);
      return e.set('walk');
    }
    engage(e, w, 0.1);
  },
  signal(e, s, w) {
    if (s.kind !== 'bowl') return;
    if (Math.abs(s.x - e.x) < 100 && Math.abs(s.y - e.y) < 50 && e.state !== 'dead') {
      e.move = null;
      e.set('bound');
      e.bindT = 240;
      e.weakOpen = 240;
      e.say('(그릇 아래에 갇혔다)', 80);
      w.emit({ type: 'custom', name: 'ruleKept', data: { rule: 's_bowl', id: e.id } });
      w.shake(6, 3);
    } else w.fx('text', s.x, s.y, 80, '빈 그릇');
  },
  drawOver(e, ctx) {
    if (e.state !== 'bound') return;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#9a9a9a';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y - 60, 80, 70, 0, Math.PI, 0);
    ctx.fill();
  },
};

// ─── 5. 불가능한 입체 도형 (퍼즐과 선택의 층) ──────────────────────

const HOVER = 150;
const shapeCore = B(-70, 70, -70, 70, 22, 'core');
const corners = (k = 1): LocalBox[] => [B(-96 * k, -60 * k, -96 * k, -60 * k, 24, 'corner'), B(60 * k, 96 * k, -96 * k, -60 * k, 24, 'corner'), B(60 * k, 96 * k, 60 * k, 96 * k, 24, 'corner'), B(-96 * k, -60 * k, 60 * k, 96 * k, 24, 'corner')];
const shapeBody = [shapeCore, ...corners()];
const shapeAtk = {
  beam: bake('beam', '모서리 빛', shapeBody, [{ n: 10, tele: true }, { n: 4, fire: 'beam' }, { n: 34 }], [S(0, 'none')]),
  slam: bake(
    'slam',
    '펼쳐 내려찍기',
    shapeBody,
    [
      { n: 28, tele: true },
      { n: 6, hit: [B(-130, 130, -150, 40, 40, 'core')], armor: 2, fire: 'ring', ev: 'drop' },
      { n: 30 },
    ],
    [S(24, 'down', 6, { strength: 3 })],
    { danger: [{ fx0: -130, fx1: 130, dy: 40 }] },
  ),
  split: bake('split', '조각 떼어내기', shapeBody, [{ n: 24, tele: true }, { n: 6, ev: 'split' }, { n: 20 }], [S(0, 'none')]),
};
export const shape: GuardianDef = g({
  kind: 'shape',
  label: '불가능한 입체 도형',
  floor: 'puzzle',
  hp: 800,
  speed: 1.3,
  w: 200,
  h: 100,
  body: shapeBody,
  armor: 2,
  hover: HOVER,
  attacks: [
    { move: shapeAtk.beam, range: [0, 900], dy: 400, cd: 110, weight: 3 },
    { move: shapeAtk.slam, range: [0, 60], dy: 30, cd: 120, weight: 2 },
    { move: shapeAtk.split, range: [0, 900], dy: 400, cd: 400, weight: 1, when: 'phase2' },
  ],
  keep: [0, 40],
  groggyMax: 9999,
  intro: '(보는 순간 바닥이 기울어 보인다)',
  rule: '보고 있으면 조작이 뒤집힌다(등 돌리면 해제). 모서리를 번호 순서대로 때리면 접힌다',
  note: '보면 멀미가 나는 도형. 모서리 넷을 정해진 순서로 치면 접혀 떨어진다. 몸통은 거의 안 들어간다.',
  color: '#5b4fa8',
});

const shapeBrain: Brain = {
  tick(e, w) {
    intro(e, w);
    if (e.age === 1) ((e.mem.order = shuffle([0, 1, 2, 3], w)), (e.mem.next = 0));
    e.mem.cling = true;
    if (e.state === 'attack' && e.move?.id === 'slam' && e.mf >= 28 && e.mf < 34) e.z = Math.max(30, e.z - 30);
    phaseCheck(e, w, [0.5]);
    const p = w.player;
    // 보고 있으면 멀미 (조작 반전): 엔진에 두통 디버프로 알린다
    const looking = Math.sign(e.x - p.x) === p.dir && Math.abs(e.x - p.x) < 760 && !e.mem.folded;
    e.mem.looking = looking;
    if (looking && e.age % 30 === 0) emitDebuff(w, { kind: 'headache', ticks: 32 }, e.id);
    if (e.mem.folded) {
      if (--e.mem.folded <= 0) {
        e.mem.folded = 0;
        e.mem.order = shuffle([0, 1, 2, 3], w);
        e.mem.next = 0;
        e.armorBase = 2;
        e.say('(다시 펼쳐진다)', 40);
      } else {
        e.z = Math.max(40, e.z - 6);
        e.weakOpen = 2;
        return true;
      }
    }
    if (e.state !== 'attack' && e.state !== 'stunned') e.z += (HOVER + Math.sin(e.age / 14) * 14 - e.z) * 0.1;
  },
  think(e, w) {
    const p = w.player;
    const dx = p.x - e.x,
      dy = p.y - e.y;
    e.x += Math.sign(dx) * Math.min(Math.abs(dx), e.speed());
    e.y += Math.sign(dy) * Math.min(Math.abs(dy), e.speed() * 0.6);
    e.set('walk');
    const a = pickAttack(e, w);
    if (a && w.rand() < 0.05) e.start(a.move, w, a.cd);
  },
  ev(e, name, w) {
    if (name === 'split') for (const k of [-1, 1]) spawnInto(w, 'edge', e.x + k * 160, e.y);
  },
  hit(e, h, part, w) {
    if (e.mem.folded) return { weak: true, text: '접힘' };
    if (part !== 'corner') return { mult: 0.2, noReact: true };
    // 어느 모서리인지
    const lb = e.localHurt(w).filter((b) => b.part === 'corner');
    let idx = -1;
    for (let i = 0; i < lb.length; i++) {
      const b = lb[i];
      const a0 = e.x + b.fx0 * e.dir,
        a1 = e.x + b.fx1 * e.dir;
      const x0 = Math.min(a0, a1),
        x1 = Math.max(a0, a1);
      if (h.x0 < x1 && x0 < h.x1 && h.z0 < e.z + b.z1 && e.z + b.z0 < h.z1) idx = i;
    }
    // 바라보는 방향 기준 번호를 화면 기준으로 고정
    if (idx >= 0 && e.dir === -1) idx = [1, 0, 3, 2][idx];
    const want = e.mem.order[e.mem.next];
    if (idx === want) {
      e.mem.next++;
      if (e.mem.next >= 4) {
        e.mem.folded = 150;
        e.armorBase = 0;
        e.move = null;
        e.set('stunned');
        e.stunT = 150;
        w.emit({ type: 'custom', name: 'ruleKept', data: { rule: 'p_fold', id: e.id } });
        w.shake(10, 4);
        return { mult: 3, weak: true, text: '접혔다' };
      }
      return { mult: 1, noReact: true, text: `${e.mem.next}/4` };
    }
    e.mem.next = 0;
    if (e.state !== 'attack') e.start(shapeAtk.beam, w, 60);
    return { mult: 0.3, noReact: true, text: '순서 틀림' };
  },
  drawOver(e, ctx) {
    if (e.state === 'dead' || !e.mem.order) return;
    const lb = corners();
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 4; i++) {
      const b = lb[i];
      const cx = e.x + ((b.fx0 + b.fx1) / 2) * (e.dir === -1 ? 1 : 1),
        cz = e.z + (b.z0 + b.z1) / 2;
      const order = (e.mem.order as number[]).indexOf(i);
      const done = order < e.mem.next;
      ctx.fillStyle = done ? '#7dffb0' : '#ffffff';
      ctx.globalAlpha = done ? 1 : 0.75;
      ctx.fillText(String(order + 1), cx, e.y - cz + 8);
    }
    if (e.mem.looking) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#c8b8ff';
      ctx.font = '600 18px sans-serif';
      ctx.fillText('보고 있다: 조작 반전', e.x, e.y - e.z - 120);
    }
  },
};
function shuffle(a: number[], w: WorldView) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(w.rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── 6. 405호 노부부 (재현의 층 · 아파트) ─────────────────────────

const grannyBody = humanoid(70, 170);
const grandpaBody = humanoid(84, 196);
export const elderF: GuardianDef = g({
  kind: 'elder_f',
  label: '405호 할머니',
  floor: 'replica',
  hp: 600,
  speed: 1.1,
  w: 70,
  h: 170,
  body: grannyBody,
  armor: 1,
  attacks: [
    { move: shoot('table', '밥상 던지기', 70, 170, { tele: 26, shots: 1, gap: 10, recover: 30, fire: 'table', armor: 2, body: grannyBody }), range: [160, 640], dy: 40, cd: 120, weight: 3 },
    { move: shoot('spoons', '숟가락 세례', 70, 170, { tele: 14, shots: 3, gap: 5, recover: 18, fire: 'spoon', body: grannyBody }), range: [120, 600], dy: 20, cd: 70, weight: 2 },
    { move: strike('scold', '등짝 스매싱', 70, 170, { tele: 12, active: 4, recover: 16, reach: [15, 95], z: [80, 160], armor: 2, body: grannyBody, spec: S(12, 'stagger', 14) }), range: [0, 100], dy: 22, cd: 40, weight: 3 },
  ],
  keep: [260, 420],
  groggyMax: 100,
  intro: '앉아요, 밥 먹고 가요.',
  rule: '「잘 먹었습니다」(E)로 거절하면 싸우지 않는다 (규칙 7). 하단·앉아 공격은 거꾸로 된 얼굴의 입을 때려 2배',
  note: '얼굴이 거꾸로 붙은 할머니. 밥을 권한다. 거절 없이 돌아서면 밥상을 집어 던진다.',
  color: '#8a6f8a',
});
export const elderM: GuardianDef = g({
  kind: 'elder_m',
  label: '405호 할아버지',
  floor: 'replica',
  hp: 600,
  speed: 0.75,
  w: 84,
  h: 196,
  body: grandpaBody,
  armor: 1,
  attacks: [
    { move: grab('embrace', '끌어안기', 84, 196, { tele: 22, active: 6, recover: 26, reach: 120, lunge: 5, ticks: 50, dmgPerTick: 2.4, armor: 2, body: grandpaBody }), range: [0, 140], dy: 26, cd: 110, weight: 3 },
    { move: strike('stomp', '발 구르기', 84, 196, { tele: 24, active: 4, recover: 26, reach: [-60, 60], z: [0, 40], dy: 30, extend: false, armor: 2, body: grandpaBody, low: true, fire: 'ring', spec: S(14, 'stagger', 10) }), range: [0, 260], dy: 60, cd: 130, weight: 2 },
  ],
  keep: [20, 80],
  groggyMax: 120,
  intro: '…',
  rule: '하단 공격 2배',
  note: '거꾸로 된 얼굴의 할아버지. 느리게 다가와 끌어안는다. 잡히면 식탁에 앉혀진다.',
  color: '#6f6a58',
});

function pairOf(e: Enemy, w: WorldView): Enemy | null {
  for (const b of w.bodies) if (b instanceof Enemy && b !== e && b.alive && (b.kind === 'elder_f' || b.kind === 'elder_m') && b.state !== 'dead') return b;
  return null;
}
function startFight(e: Enemy, w: WorldView, why: string) {
  const all = [e, pairOf(e, w)].filter(Boolean) as Enemy[];
  if (all.some((x) => x.mem.mode === 'fight')) return;
  for (const x of all) ((x.mem.mode = 'fight'), (x.hostile = true));
  const f = all.find((x) => x.kind === 'elder_f') ?? e;
  f.say(why === 'eat' ? '맛있지? 더 먹어' : '아이고, 우리 아들이랑 딸이 곧 온다는구먼.', 90);
  w.emit({ type: 'bossRoar', x: e.x, kind: 'elder' });
  w.emit({ type: 'custom', name: 'ruleBroken', data: { rule: 'r_meal', why } });
  spawnInto(w, 'mummy', f.x - 60, w.lane[0] + 20);
  spawnInto(w, 'mummy', f.x + 60, w.lane[0] + 20);
}

const elderBrain: Brain = {
  tick(e, w) {
    if (e.age === 1 && e.mem.solo && e.kind === 'elder_f') spawnInto(w, 'elder_m', e.x + 120, e.y + 10);
    if (e.age === 1) {
      e.mem.mode = 'table';
      e.hostile = false;
      e.groggyMax = (e.def as GuardianDef).groggyMax;
      e.mem.tableX = e.x;
    }
    if (e.age === 4 && e.kind === 'elder_f') e.say('앉아요, 밥 먹고 가요.', 120);
    const pair = pairOf(e, w);
    if (e.mem.mode === 'table') {
      e.face(w.player.x);
      // 권했는데 밥상에서 멀어지면 = 거절 없이 돌아섬
      if (e.kind === 'elder_f' && Math.abs(w.player.x - e.x) < 260) e.mem.offered = true;
      if (e.mem.offered && Math.abs(w.player.x - e.x) > 520) startFight(e, w, 'leave');
      if (e.lastHurt > 0) startFight(e, w, 'hit');
      return true;
    }
    if (e.mem.mode === 'peace') {
      e.alpha = Math.max(0, e.alpha - 0.02);
      if (e.alpha <= 0) {
        e.alive = false;
        if (e.kind === 'elder_f') w.emit({ type: 'custom', name: 'guardianCleared', data: { kind: 'elder', how: 'rule' } });
      }
      return true;
    }
    // 둘 합쳐 50%: 현관문이 열리고 "곧 오는 누군가"가 들어온다 → 둘 다 멈춤 (마무리 기회)
    const total = e.hp + (pair?.hp ?? 0),
      max = e.hpMax + (pair?.hpMax ?? e.hpMax);
    if (!e.mem.visit && total < max * 0.5 && e.kind === 'elder_f') {
      for (const x of [e, pair]) if (x) ((x.mem.visit = true), (x.move = null), x.set('stunned'), (x.stunT = 150), (x.weakOpen = 150), x.say('…왔니?', 90));
      e.mem.visitorT = 150;
      w.emit({ type: 'custom', name: 'bossPhase', data: { id: e.id, kind: 'elder', phase: 2, event: 'visitor' } });
    }
    if (e.mem.visitorT > 0) e.mem.visitorT--;
    // 혼자 남으면 성난다
    if (!pair && !e.mem.alone) {
      e.mem.alone = true;
      e.rally = 99999;
      e.say(e.kind === 'elder_f' ? '영감!' : '…임자', 60);
    }
  },
  think(e, w) {
    if (e.kind === 'elder_m') {
      // 할아버지는 공격권과 무관하게 천천히 다가온다
      const a = pickAttack(e, w);
      if (a && w.rand() < 0.08) return e.start(a.move, w, a.cd);
      return engage(e, w, 0);
    }
    engage(e, w, 0.1);
  },
  hit(e, h) {
    if (e.mem.mode === 'table') return;
    if (h.low) return { weak: true, text: '입' };
  },
  signal(e, s, w) {
    if (e.mem.mode !== 'table') return;
    if (s.kind === 'mealThanks') {
      for (const x of [e, pairOf(e, w)]) if (x) ((x.mem.mode = 'peace'), x.say('잘 가요, 또 와요.', 80));
      if (e.kind === 'elder_f') {
        w.emit({ type: 'custom', name: 'ruleKept', data: { rule: 'r_meal', id: e.id } });
        w.emit({ type: 'custom', name: 'enemyDrop', data: { id: e.id, kind: 'elder', x: e.x, y: e.y, drops: [{ item: 'relic', n: 1 }, { item: 'shard', n: 5 }] } });
      }
    } else if (s.kind === 'mealEat') {
      w.emit({ type: 'custom', name: 'hurtPlayer', data: { dmg: 30, debuff: { kind: 'taint', ticks: 900 } } });
      startFight(e, w, 'eat');
    } else if (s.kind === 'turnAway') startFight(e, w, 'leave');
  },
  drawUnder(e, ctx) {
    if (e.kind !== 'elder_f' || e.mem.tableX === undefined || e.mem.mode !== 'table') return;
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#7a5a36';
    ctx.fillRect(e.mem.tableX + 50, e.y - 60, 140, 14);
    ctx.fillRect(e.mem.tableX + 60, e.y - 46, 10, 46);
    ctx.fillRect(e.mem.tableX + 170, e.y - 46, 10, 46);
  },
  drawOver(e, ctx) {
    // 거꾸로 된 얼굴: 머리 위쪽에 입
    if (e.state === 'dead' || e.state === 'down') return;
    ctx.fillStyle = '#2a0c0c';
    ctx.fillRect(e.x - 12, e.y - e.z - e.def.h + 4, 24, 7);
    if (e.mem.visitorT > 0 && e.kind === 'elder_f') {
      ctx.globalAlpha = Math.min(1, e.mem.visitorT / 30) * 0.8;
      ctx.fillStyle = '#000';
      const vx = (e.mem.tableX ?? e.x) - 420;
      ctx.fillRect(vx - 28, e.y - 200, 56, 200);
      ctx.fillRect(vx - 18, e.y - 236, 36, 36);
    }
  },
};

// ─── 7. B-12 「만지는 것들」 (버티고 지나가기) ──────────────────────

export const touchers: GuardianDef = g({
  kind: 'touchers',
  label: '만지는 것들',
  floor: 'b12',
  hp: 1,
  speed: 0,
  w: 10,
  h: 10,
  body: [],
  armor: 3,
  attacks: [],
  keep: [0, 0],
  groggyMax: 0,
  drop: 'none',
  intro: '(완전한 어둠. 무언가 팔을 만진다)',
  rule: '멈추지 마라 + 소리 내지 마라 (규칙 10·11). 셋 이상 동시에 닿으면 후송. 60초 버티기',
  note: '완전한 어둠 속에서 만져서 말을 거는 것들. 싸우는 상대가 아니다. 버티고 지나간다.',
  color: '#000000',
});
interface Touch {
  x: number;
  y: number;
  t: number;
  id: number;
  hit: boolean;
}
const TOUCH_TELE = 24;
const touchBrain: Brain = {
  tick(e, w) {
    intro(e, w);
    if (e.age === 3) w.emit({ type: 'custom', name: 'screen', data: { effect: 'dark', ticks: 1800 } });
    e.alpha = 1;
    const p = w.player;
    const hands: Touch[] = (e.mem.hands ??= []);
    const still = stillTicks(w);
    const loud = w.noise > 0.3 || p.running || /shot|shoot|super|ability/.test(p.state);
    // 멈추거나 소리를 내면 더 자주, 더 가까이
    const rate = 0.02 + (still > 10 ? 0.06 : 0) + (loud ? 0.06 : 0);
    if (w.rand() < rate && hands.length < 6) {
      const spread = still > 10 || loud ? 30 : 140;
      hands.push({ x: p.x + (w.rand() - 0.5) * spread * 2, y: Math.max(w.lane[0], Math.min(w.lane[1], p.y + (w.rand() - 0.5) * spread)), t: 0, id: newAttackId(), hit: false });
    }
    let touching = 0;
    for (const h of hands) {
      h.t++;
      if (h.t === TOUCH_TELE + 1) {
        h.hit = Math.abs(p.x - h.x) < 40 && Math.abs(p.y - h.y) < 22 && !p.airborne;
        if (h.hit) emitDebuff(w, { kind: 'fear', ticks: 60 }, e.id);
      }
      if (h.hit && h.t < TOUCH_TELE + 60) touching++;
    }
    e.mem.hands = hands.filter((h) => h.t < TOUCH_TELE + 60);
    e.mem.touching = touching;
    if (touching >= 3 && !e.mem.evac) {
      e.mem.evac = true;
      w.emit({ type: 'custom', name: 'evac', data: { reason: 'touchers' } });
    }
    e.mem.left = 1800 - e.age;
    if (e.age >= 1800 && e.state !== 'dead') {
      e.set('dead');
      w.emit({ type: 'custom', name: 'guardianCleared', data: { kind: 'touchers', how: 'endure' } });
      w.emit({ type: 'custom', name: 'screen', data: { effect: 'dark', ticks: 0 } });
    }
    return true;
  },
  hurt: () => null,
  hits(e) {
    const out: Hit[] = [];
    for (const h of (e.mem.hands ?? []) as Touch[])
      if (h.t > TOUCH_TELE && h.t <= TOUCH_TELE + 4) out.push({ x0: h.x - 30, x1: h.x + 30, z0: 0, z1: 200, y: h.y, dy: 14, attackId: h.id, dmg: 0, react: 'none', dir: 1, armorBreak: true, stop: 0, strength: 1 });
    return out;
  },
  hit: () => ({ immune: true, text: '닿지 않는다' }),
  drawUnder(e, ctx) {
    for (const h of (e.mem.hands ?? []) as Touch[]) {
      const k = Math.min(1, h.t / TOUCH_TELE);
      ctx.globalAlpha = h.t <= TOUCH_TELE ? 0.2 + 0.5 * k : 0.7 * (1 - (h.t - TOUCH_TELE) / 60);
      ctx.strokeStyle = h.hit ? '#ff7070' : '#d8d0c0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, 40 - 20 * k, 10 - 4 * k, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
  drawOver(e, ctx) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e8e0d0';
    ctx.font = '600 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`버티기 ${Math.max(0, Math.ceil((e.mem.left ?? 0) / 30))}초 · 닿음 ${e.mem.touching ?? 0}/3`, e.x, e.y - 260);
  },
};

// ─── 7. 208호 가족 (재현의 층 · 붉은 벽) ─────────────────────────

/** 총알처럼 약한 원거리 (엔진 총알: noise가 있고 강도 1) */
const ranged = (h: Hit) => (h.noise ?? 0) > 0 && (h.strength ?? 1) === 1;
const auntBody = humanoid(66, 178);
const uncleBody = humanoid(86, 200);
export const familyF: GuardianDef = g({
  kind: 'family_f',
  label: '208호 아주머니',
  floor: 'replica',
  hp: 900,
  speed: 2.2,
  w: 66,
  h: 178,
  body: auntBody,
  armor: 1,
  attacks: [
    { move: strike('bite', '턱 찢고 물기', 66, 178, { tele: 14, active: 5, recover: 18, reach: [20, 120], z: [120, 190], lunge: 9, armor: 2, body: auntBody, spec: S(16, 'stagger', 10, { debuff: { kind: 'bleed', ticks: 150 }, strength: 2 }) }), range: [40, 200], dy: 24, cd: 50, weight: 3 },
    { move: charge('dash', '달려들기', 66, 178, { tele: 18, dash: 16, speed: 14, recover: 22, armor: 2, spec: S(14, 'down', 10, { strength: 3 }), body: auntBody }), range: [200, 560], dy: 20, cd: 110, weight: 2 },
  ],
  keep: [60, 140],
  groggyMax: 110,
  intro: '우리 애 못 봤어요?',
  rule: '방 안 아이 방 문(E)을 열면 둘이 그쪽을 보고 멈춘다 (규칙 11을 지켜 열쇠를 얻었을 때)',
  note: '보라색 머리 아주머니. 아이를 찾는다며 묻다가 세 번째 대화에서 턱이 찢어진다. 빠르게 달려들어 문다.',
  color: '#7a4a8a',
});
export const familyM: GuardianDef = g({
  kind: 'family_m',
  label: '208호 아저씨',
  floor: 'replica',
  hp: 900,
  speed: 0.8,
  w: 86,
  h: 200,
  body: uncleBody,
  armor: 1,
  attacks: [
    { move: strike('smash', '내려치기', 86, 200, { tele: 22, active: 5, recover: 26, reach: [20, 130], z: [0, 200], extend: false, armor: 2, body: uncleBody, spec: S(20, 'down', 8, { strength: 3 }) }), range: [0, 150], dy: 26, cd: 70, weight: 3 },
    { move: grab('hold', '움켜잡기', 86, 200, { tele: 18, active: 5, recover: 24, reach: 120, ticks: 45, dmgPerTick: 2, armor: 2, body: uncleBody }), range: [0, 130], dy: 24, cd: 120, weight: 2 },
  ],
  keep: [20, 80],
  groggyMax: 140,
  intro: '…',
  rule: '총이 안 듣는다 (비틀거리기만). 근접·잡기·환경 무기',
  note: '표정이 굳은 아저씨. 총을 맞고도 비틀거리기만 한다. 느리게 다가와 내려친다.',
  color: '#5a5a62',
});
const FAMILY_ASK = ['우리 애 못 봤어요?', '키가 이만해요. 머리핀을 했어요.', '…정말 못 봤어요?'];
function familyOther(e: Enemy, w: WorldView): Enemy | null {
  for (const b of w.bodies) if (b instanceof Enemy && b !== e && b.alive && (b.kind === 'family_f' || b.kind === 'family_m') && b.state !== 'dead') return b;
  return null;
}
function familyFight(e: Enemy, w: WorldView) {
  for (const x of [e, familyOther(e, w)]) if (x && x.mem.mode !== 'fight') ((x.mem.mode = 'fight'), (x.hostile = true));
  e.say('(턱이 찢어진다)', 60);
  w.emit({ type: 'bossRoar', x: e.x, kind: 'family208' });
  w.emit({ type: 'combat:boss', index: 0 });
}
const familyBrain: Brain = {
  tick(e, w) {
    if (e.age === 1) {
      e.groggyMax = (e.def as GuardianDef).groggyMax;
      e.mem.mode = 'ask';
      e.hostile = false;
      if (e.mem.solo && e.kind === 'family_f') spawnInto(w, 'family_m', e.x + 140, e.y + 10);
    }
    if (e.mem.mode === 'ask') {
      e.face(w.player.x);
      if (e.lastHurt > 0) familyFight(e, w);
      else if (e.kind === 'family_f' && Math.abs(w.player.x - e.x) < 360) {
        e.mem.askT = (e.mem.askT ?? 0) + 1;
        const i = Math.floor(e.mem.askT / 75);
        if (e.mem.askT % 75 === 1 && i < FAMILY_ASK.length) e.say(FAMILY_ASK[i], 70);
        if (i >= FAMILY_ASK.length) familyFight(e, w);
      }
      return true;
    }
    if (e.mem.froze > 0) {
      e.mem.froze--;
      e.weakOpen = 2;
      return true;
    }
    if (!familyOther(e, w) && !e.mem.alone) ((e.mem.alone = true), (e.rally = 99999));
  },
  think: (e, w) => engage(e, w, e.kind === 'family_f' ? 0.14 : 0.08),
  hit(e, h) {
    if (e.kind === 'family_m' && ranged(h)) return { mult: 0, noReact: true, text: '비틀거릴 뿐' };
  },
  signal(e, s, w) {
    if ((s.kind === 'childDoor' || s.kind === 'door') && e.mem.mode === 'fight' && !e.mem.doorDone) {
      for (const x of [e, familyOther(e, w)]) if (x) ((x.mem.doorDone = true), (x.mem.froze = 150), (x.move = null), x.set('stunned'), (x.stunT = 150), x.say('…거기 있니?', 80));
      w.emit({ type: 'custom', name: 'ruleKept', data: { rule: 'r_child', id: e.id } });
    }
  },
};

// ─── 8. 일어난 집 (재현의 층 · 빈집) ───────────────────────────────

const houseBody: LocalBox[] = [B(-180, 180, 0, 260, 20, 'torso'), B(-30, 30, 170, 230, 22, 'core')];
export const risenhouse: GuardianDef = g({
  kind: 'risenhouse',
  label: '일어난 집',
  floor: 'replica',
  hp: 800,
  speed: 0,
  w: 360,
  h: 260,
  body: houseBody,
  armor: 3,
  attacks: [
    { move: bake('furniture', '가구 날리기', houseBody, [{ n: 22, tele: true }, { n: 4, ev: 'furniture' }, { n: 20 }], [S(0, 'none')]), range: [0, 2000], dy: 2000, cd: 70, weight: 3 },
    { move: bake('tilt', '바닥 기울기', houseBody, [{ n: 26, tele: true }, { n: 4, fire: 'ring' }, { n: 14 }, { n: 4, fire: 'ring' }, { n: 20 }], [S(0, 'none')], { danger: [{ fx0: -400, fx1: 400, dy: 60 }] }), range: [0, 2000], dy: 2000, cd: 150, weight: 2 },
    { move: bake('rally', '집이 부른다', houseBody, [{ n: 30, tele: true }, { n: 4, ev: 'wake' }, { n: 20 }], [S(0, 'none')]), range: [0, 2000], dy: 2000, cd: 400, weight: 1, when: 'phase2' },
  ],
  keep: [0, 0],
  groggyMax: 9999,
  intro: '(집이 삐걱거리며 일어선다)',
  rule: '멈춘 시계(가운데 동그라미)를 부수면 다시 「떠난 집」이 된다. 시계 말고는 거의 안 들어간다',
  note: '물건을 너무 집으면 집 자체가 일어난다. 방 전체가 보스. 가구가 날아오고, 바닥이 기울고, 먼지 쌓인 물건들이 깨어난다.',
  color: '#4a3e30',
});
const houseBrain: Brain = {
  tick(e, w) {
    intro(e, w);
    e.y = w.lane[0] + 4;
    phaseCheck(e, w, [0.5]);
  },
  think(e, w) {
    e.face(w.player.x);
    const a = pickAttack(e, w);
    if (a && w.rand() < 0.04) e.start(a.move, w, a.cd);
  },
  ev(e, name, w) {
    const p = w.player;
    if (name === 'furniture') {
      const [b0, b1] = w.bounds;
      const fromLeft = w.rand() < 0.5;
      e.fire('chair', w, { x: fromLeft ? b0 - 30 : b1 + 30, y: p.y, dir: fromLeft ? 1 : -1 });
      if (e.phase >= 2) e.fire('chair', w, { x: fromLeft ? b1 + 30 : b0 - 30, y: Math.max(w.lane[0], Math.min(w.lane[1], p.y + 40)), dir: fromLeft ? -1 : 1 });
    } else if (name === 'wake') for (const k of [-1, 1]) spawnInto(w, 'dusty', p.x + k * 300, p.y);
  },
  hit(e, h, part) {
    if (part === 'core') return { mult: 2, weak: true, text: '시계' };
    return { mult: 0.2, noReact: true };
  },
  signal(e, s, w) {
    if (s.kind === 'clock' && e.state !== 'dead') {
      e.say('(시계가 멈췄다. 집이 다시 떠났다)', 80);
      w.emit({ type: 'custom', name: 'ruleKept', data: { rule: 'r_clock', id: e.id } });
      w.emit({ type: 'custom', name: 'guardianCleared', data: { kind: 'risenhouse', how: 'rule' } });
      e.set('dead');
    }
  },
  drawOver(e, ctx) {
    if (e.state === 'dead') return;
    ctx.fillStyle = '#d8c8a0';
    ctx.beginPath();
    ctx.arc(e.x, e.y - e.z - 200, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a2018';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y - e.z - 200);
    ctx.lineTo(e.x, e.y - e.z - 218);
    ctx.moveTo(e.x, e.y - e.z - 200);
    ctx.lineTo(e.x + 12, e.y - e.z - 196);
    ctx.stroke();
  },
};

export const GUARDIANS: GuardianDef[] = [guard, legs, shadow, noise, shape, elderF, elderM, proctor, touchers, familyF, familyM, risenhouse];
export const GUARDIAN_BRAINS: Record<string, Brain> = {
  guard: guardBrain,
  proctor: guardBrain,
  legs: legsBrain,
  shadow: shadowBrain,
  noise: noiseBrain,
  shape: shapeBrain,
  elder_f: elderBrain,
  elder_m: elderBrain,
  touchers: touchBrain,
  family_f: familyBrain,
  family_m: familyBrain,
  risenhouse: houseBrain,
};
/** 층 유형 → 수호자 (재현은 노부부 둘을 같이 부른다) */
export const GUARDIAN_FOR: Record<FloorType, string[]> = {
  lobby: ['guard'],
  trial: ['proctor'],
  chase: ['legs'],
  dark: ['shadow'],
  silent: ['noise'],
  puzzle: ['shape'],
  replica: ['elder_f', 'elder_m'],
  b12: ['touchers'],
  service: [],
};
export { attackersNow };
