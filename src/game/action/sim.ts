import {GAIT} from './space';
/** 방 하나의 1인 전투 검증판. DOM/호스트와 무관한 고정 시간 시뮬레이션. */
export const WIDTH = 1280,
  HEIGHT = 720,
  SAVE_VERSION = 2;
export type Act =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'land'
  | 'melee1'
  | 'melee2'
  | 'melee3'
  | 'shot'
  | 'skill'
  | 'ult'
  | 'dash'
  | 'guard'
  | 'crouch'
  | 'hurt'
  | 'down'
  | 'rise'
  | 'dead';
export interface Body {
  id: number;
  kind: 'jyaldi' | 'corner' | 'watchman';
  x: number;
  y: number;
  z: number;
  vz: number;
  dir: number;
  hp: number;
  max: number;
  act: Act;
  t: number;
  duration: number;
  fired: boolean;
  inv: number;
  flash: number;
  cooldown: number;
  armor: boolean;
  stride: number;
  speed: number;
}
export interface Player extends Body {
  energy: number;
  gauge: number;
  guard: number;
  dashCd: number;
  items: number[];
}
export interface Bolt {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  life: number;
  enemy: boolean;
}
export interface Effect {
  x: number;
  y: number;
  z: number;
  t: number;
  duration: number;
  kind: 'hit' | 'blast' | 'guard' | 'shot';
}
export interface Run {
  version: number;
  player: Player;
  enemies: Body[];
  bolts: Bolt[];
  effects: Effect[];
  time: number;
  auto: boolean;
  phase: 'combat' | 'cleared' | 'evacuated';
  nextId: number;
  cutin: number;
  hitstop: number;
  kills: number;
  message: string;
}
export interface Input {
  x: number;
  y: number;
  attack?: boolean;
  run?: boolean;
  jump?: boolean;
  dash?: boolean;
  guard?: boolean;
  skill?: boolean;
  ult?: boolean;
  item?: number;
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const body = (id: number, kind: Body['kind'], x: number, y: number, hp: number): Body => ({
  id,
  kind,
  x,
  y,
  z: 0,
  vz: 0,
  dir: kind === 'jyaldi' ? 1 : -1,
  hp,
  max: hp,
  act: 'idle',
  t: 0,
  duration: 0,
  fired: false,
  inv: 0,
  flash: 0,
  cooldown: 0,
  armor: false,
  stride: 0,
  speed: 0,
});
export function newRun(): Run {
  return {
    version: SAVE_VERSION,
    player: { ...body(1, 'jyaldi', 220, 510, 200), energy: 100, gauge: 100, guard: 100, dashCd: 0, items: [3, 2, 2] },
    enemies: [
      body(2, 'corner', 760, 480, 130),
      body(3, 'watchman', 1030, 560, 145),
      body(4, 'corner', 1130, 440, 130),
      body(5, 'watchman', 940, 610, 145),
    ],
    bolts: [],
    effects: [],
    time: 0,
    auto: false,
    phase: 'combat',
    nextId: 6,
    cutin: 0,
    hitstop: 0,
    kills: 0,
    message: 'Z 가까이서 3연계 · 멀리서 권총 / Shift 유지 달리기',
  };
}
function act(b: Body, name: Act, duration: number) {
  b.act = name;
  b.t = 0;
  b.duration = duration;
  b.fired = false;
}
function fx(r: Run, kind: Effect['kind'], x: number, y: number, z = 65) {
  if (r.effects.length >= 64) r.effects.shift();
  const duration = kind === 'blast' ? 0.55 : 0.22;
  r.effects.push({ x, y, z, t: 0, duration, kind });
}
function facing(a: Body, b: Body) {
  return (b.x - a.x) * a.dir >= -8;
}
function damage(r: Run, b: Body, amount: number, source: Body, down = false) {
  if (b.hp <= 0 || b.inv > 0) return;
  const p = r.player;
  if (b === p && (p.act === 'guard' || p.act === 'crouch') && facing(p, source) && p.guard > 0) {
    p.guard = Math.max(0, p.guard - amount * 2);
    fx(r, 'guard', p.x + p.dir * 25, p.y);
    if (!p.guard) {
      act(p, 'hurt', 0.65);
      r.message = '가드 붕괴! 거리를 확보하세요.';
    }
    return;
  }
  b.hp = Math.max(0, b.hp - amount);
  b.flash = 0.12;
  fx(r, 'hit', b.x, b.y, b.z + 75);
  r.hitstop = down ? 0.055 : 0.025;
  b.x = clamp(b.x + source.dir * (down ? 44 : 12), 55, WIDTH - 55);
  if (b === p) {
    p.inv = 0.5;
    p.gauge = clamp(p.gauge + 7, 0, 100);
  } else p.gauge = clamp(p.gauge + amount * 0.35, 0, 100);
  if (b.hp <= 0) {
    act(b, 'dead', 1);
    if (b !== p) r.kills++;
  } else if (!b.armor) act(b, down ? 'down' : 'hurt', down ? 0.9 : 0.23);
}
function move(b: Body, x: number, y: number, speed: number, dt: number, face = true) {
  const len = Math.max(1, Math.hypot(x, y)),
    ox = b.x,
    oy = b.y;
  b.x = clamp(b.x + (x / len) * speed * dt, 55, WIDTH - 55);
  b.y = clamp(b.y + (y / len) * speed * dt, 400, 655);
  const distance = Math.hypot(b.x - ox, b.y - oy);
  b.speed = distance / dt;
  // 1주기의 실제 보폭과 재생 위상을 연결. 벽에 막히면 위상도 정지한다.
  if (b.z === 0 && b.act !== 'dash') b.stride = (b.stride + distance / (speed > 180 ? GAIT.run : GAIT.walk)) % 1;
  if (x && face) b.dir = x > 0 ? 1 : -1;
}
function nearTarget(r: Run) {
  const p = r.player;
  return r.enemies.find(
    (e) =>
      e.hp > 0 &&
      (e.x - p.x) * p.dir >= -8 &&
      Math.abs(e.x - p.x) < 118 &&
      Math.abs(e.y - p.y) < 32 &&
      Math.abs(e.z - p.z) < 60,
  );
}
function bolt(r: Run, b: Body, enemy: boolean) {
  if (r.bolts.length >= 48) return;
  r.bolts.push({
    id: r.nextId++,
    x: b.x + b.dir * (enemy ? 34 : 64),
    y: b.y,
    z: b.z + (enemy ? 82 : 113),
    vx: b.dir * (enemy ? 410 : 1000),
    life: 1.7,
    enemy,
  });
  fx(r, 'shot', b.x + b.dir * (enemy ? 40 : 64), b.y, b.z + (enemy ? 82 : 113));
}
function item(r: Run, i: number) {
  const p = r.player;
  if (!Number.isInteger(i) || i < 0 || i > 2 || p.items[i] <= 0 || p.hp <= 0) return;
  if (i === 0) {
    if (p.hp >= p.max) return;
    p.hp = Math.min(p.max, p.hp + 70);
  }
  if (i === 1) {
    if (p.guard >= 100) return;
    p.guard = 100;
  }
  if (i === 2) {
    if (p.energy >= 100) return;
    p.energy = 100;
  }
  p.items[i]--;
  r.message = ['회복제 사용', '방어 회복제 사용', '능력 회복제 사용'][i];
}
/** 자동도 같은 명령과 사거리·재사용 대기시간을 사용한다. */
export function autoInput(r: Run): Input {
  const p = r.player,
    live = r.enemies.filter((e) => e.hp > 0);
  const e = live.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  if (!e) return { x: 0, y: 0 };
  const dx = e.x - p.x,
    dy = e.y - p.y,
    threat = live.find((e) => e.act === 'shot' && e.duration - e.t < 0.25 && Math.abs(e.y - p.y) < 30);
  return {
    x: Math.abs(dy) > 22 ? 0 : Math.abs(dx) > 100 ? Math.sign(dx) : 0,
    run: Math.abs(dx) > 260,
    y: threat ? (p.y > 540 ? -1 : 1) : Math.abs(dy) > 12 ? Math.sign(dy) : 0,
    attack: Math.abs(dy) < 26,
    skill: Math.abs(dx) < 390 && Math.abs(dy) < 70 && p.energy >= 35,
    dash: !!threat,
    ult: p.gauge >= 100 && live.length >= 2,
    item: p.hp < 95 ? 0 : undefined,
  };
}
export function step(r: Run, raw: Input, dt: number) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 1 / 30);
  if (r.phase !== 'combat') return;
  if (r.cutin > 0) {
    r.cutin = Math.max(0, r.cutin - dt);
    return;
  }
  if (r.hitstop > 0) {
    r.hitstop = Math.max(0, r.hitstop - dt);
    return;
  }
  r.time += dt;
  r.effects = r.effects.filter((f) => (f.t += dt) < f.duration);
  const p = r.player,
    input = r.auto ? autoInput(r) : raw;
  for (const b of [p, ...r.enemies]) {
    b.t += dt;
    b.inv = Math.max(0, b.inv - dt);
    b.flash = Math.max(0, b.flash - dt);
    b.cooldown = Math.max(0, b.cooldown - dt);
    if (b.z > 0 || b.vz > 0) {
      b.vz -= 1000 * dt;
      b.z = Math.max(0, b.z + b.vz * dt);
      if (!b.z) {
        b.vz = 0;
        if (b === p && ['jump', 'walk', 'run', 'idle'].includes(b.act)) act(b, 'land', 0.14);
      }
    }
    if (b.act === 'down' && b.t >= b.duration) {
      act(b, 'rise', 0.35);
      b.inv = 0.55;
    } else if (!['dead', 'idle', 'walk', 'run', 'jump', 'guard', 'crouch'].includes(b.act) && b.t >= b.duration) {
      const next =
        b === p && input.attack && b.z === 0 && b.act === 'melee1'
          ? 'melee2'
          : b === p && input.attack && b.z === 0 && b.act === 'melee2'
            ? 'melee3'
            : null;
      if (next) act(b, next, next === 'melee2' ? 0.34 : 0.52);
      else {
        if (b === p && b.act === 'melee3') b.cooldown = 0.18;
        act(b, 'idle', 0);
      }
      b.armor = false;
    }
  }
  p.energy = Math.min(100, p.energy + dt * 9);
  p.dashCd = Math.max(0, p.dashCd - dt);
  if (p.act !== 'guard' && p.act !== 'crouch') p.guard = Math.min(100, p.guard + dt * 15);
  if (input.item !== undefined) item(r, input.item);
  if (['idle', 'walk', 'run', 'jump', 'guard', 'crouch'].includes(p.act)) {
    if (r.auto) {
      const target = r.enemies
        .filter((e) => e.hp > 0)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (target) p.dir = target.x >= p.x ? 1 : -1;
    }
    if (input.x && !r.auto) p.dir = input.x > 0 ? 1 : -1;
    if (input.jump && p.z === 0) p.vz = 500;
    if (input.ult && p.gauge >= 100) {
      p.gauge = 0;
      act(p, 'ult', 0.85);
      p.armor = true;
      p.inv = 1.05;
      r.cutin = 0.75;
      r.message = '집중 파괴';
    } else if (input.dash && p.dashCd <= 0) {
      if (input.x) p.dir = Math.sign(input.x);
      act(p, 'dash', 0.22);
      p.inv = 0.24;
      p.dashCd = 0.8;
    } else if (input.guard && !p.z) {
      p.act = input.y > 0 ? 'crouch' : 'guard';
      if (input.x) p.dir = Math.sign(input.x);
    } else if (input.skill && p.energy >= 35) {
      p.energy -= 35;
      act(p, 'skill', 0.62);
      p.armor = true;
    } else if (input.attack && p.cooldown <= 0) {
      if (!p.z && nearTarget(r)) {
        act(p, 'melee1', 0.28);
        p.cooldown = 0;
      } else {
        act(p, 'shot', 0.32);
        p.cooldown = 0.36;
      }
    } else {
      const x = clamp(input.x, -1, 1),
        y = clamp(input.y, -1, 1);
      const running = !!input.run;
      move(p, x, y, p.z ? 200 : running ? 240 : 125, dt, !r.auto);
      p.act = p.z > 0 || p.vz > 0 ? 'jump' : x || y ? (running ? 'run' : 'walk') : 'idle';
    }
  }
  if (p.act === 'dash') move(p, input.x || p.dir, input.y, 800, dt);
  if (p.act.startsWith('melee') && p.t >= (p.act === 'melee1' ? 0.14 : p.act === 'melee2' ? 0.17 : 0.26) && !p.fired) {
    p.fired = true;
    const finish = p.act === 'melee3';
    const oldX = p.x;
    p.x = clamp(p.x + p.dir * (finish ? 8 : 5), 55, 1225);
    for (const e of r.enemies)
      if (
        e.hp > 0 &&
        (e.x - oldX) * p.dir >= -8 &&
        Math.abs(e.x - oldX) < (finish ? 135 : 120) &&
        Math.abs(e.y - p.y) < 35 &&
        Math.abs(e.z - p.z) < 60
      )
        damage(r, e, finish ? 38 : p.act === 'melee2' ? 24 : 18, p, finish);
    if (finish) fx(r, 'blast', p.x + p.dir * 90, p.y, 95);
    r.message = finish ? '근접 3타 · 파괴 충격' : p.act === 'melee2' ? '근접 2타 · 제압' : '근접 1타 · 장타';
  }
  if (p.act === 'shot' && p.t >= 0.16 && !p.fired) {
    p.fired = true;
    bolt(r, p, false);
  }
  if ((p.act === 'skill' || p.act === 'ult') && p.t >= (p.act === 'ult' ? 0.25 : 0.28) && !p.fired) {
    p.fired = true;
    const ultimate = p.act === 'ult',
      x = p.x + p.dir * (ultimate ? 280 : 190);
    fx(r, 'blast', x, p.y, 70);
    for (const e of r.enemies)
      if (e.hp > 0 && Math.abs(e.x - x) < (ultimate ? 550 : 220) && Math.abs(e.y - p.y) < (ultimate ? 260 : 100))
        damage(r, e, ultimate ? 70 : 45, p, true);
  }
  for (const e of r.enemies) {
    if (e.hp <= 0 || ['hurt', 'down', 'rise'].includes(e.act)) continue;
    if (e.act === 'shot') {
      if (!e.fired && e.t >= e.duration - 0.12) {
        e.fired = true;
        if (e.kind === 'watchman') bolt(r, e, true);
        else if (Math.abs(p.x - e.x) < 115 && Math.abs(p.y - e.y) < 42 && p.z < 55 && facing(e, p))
          damage(r, p, 16, e, true);
      }
      continue;
    }
    const dx = p.x - e.x,
      dy = p.y - e.y,
      range = e.kind === 'watchman' ? 550 : 90;
    e.dir = dx >= 0 ? 1 : -1;
    if (Math.abs(dx) < range && Math.abs(dy) < 25 && e.cooldown <= 0) {
      act(e, 'shot', e.kind === 'watchman' ? 0.85 : 0.65);
      e.cooldown = e.kind === 'watchman' ? 1.7 : 1.2;
    } else {
      move(
        e,
        Math.abs(dx) > range * 0.8 ? Math.sign(dx) : 0,
        Math.abs(dy) > 15 ? Math.sign(dy) : 0,
        e.kind === 'watchman' ? 75 : 125,
        dt,
      );
      e.act = 'walk';
    }
  }
  for (const b of r.bolts) {
    const old = b.x;
    b.x += b.vx * dt;
    b.life -= dt;
    const targets = b.enemy ? [p] : r.enemies;
    // 먼저 접촉하는 대상을 선택한다. 빠른 탄환도 이동 구간 전체를 검사한다.
    const candidates = targets
      .filter(
        (t) =>
          t.hp > 0 &&
          t.inv <= 0 &&
          Math.abs(t.y - b.y) < 28 &&
          b.z >= t.z + 10 &&
          b.z <= t.z + (t.act === 'crouch' ? 55 : 155) &&
          Math.max(old, b.x) >= t.x - 28 &&
          Math.min(old, b.x) <= t.x + 28,
      )
      .sort((a, c) => Math.abs(a.x - old) - Math.abs(c.x - old));
    if (candidates[0]) {
      damage(r, candidates[0], b.enemy ? 12 : 18, { ...p, x: old, dir: Math.sign(b.vx) });
      b.life = 0;
    }
  }
  r.bolts = r.bolts.filter((b) => b.life > 0 && b.x > -30 && b.x < WIDTH + 30);
  if (p.hp <= 0) {
    r.phase = 'evacuated';
    r.message = '작전 지속 불가 · 본부 후송';
  } else if (r.enemies.every((e) => e.hp <= 0)) {
    r.phase = 'cleared';
    r.message = '훈련 완료 · 전원 제압';
  }
}
export function serialize(r: Run): string {
  return JSON.stringify(r);
}
/** 필드/범위 검증 후 복원. 예전 순찰 데이터와는 다른 키를 사용한다. */
export function restore(raw: string | null): Run | null {
  try {
    if (!raw || raw.length > 120_000) return null;
    const r = JSON.parse(raw) as Run;
    if (r?.version === 1 && r.player && Array.isArray(r.enemies)) {
      for (const b of [r.player, ...r.enemies]) {
        b.stride = 0;
        b.speed = 0;
      }
      r.version = SAVE_VERSION;
    }
    const finite = (n: unknown, lo: number, hi: number) =>
      typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
    const actions: Act[] = [
      'idle',
      'walk',
      'run',
      'jump',
      'land',
      'melee1',
      'melee2',
      'melee3',
      'shot',
      'skill',
      'ult',
      'dash',
      'guard',
      'crouch',
      'hurt',
      'down',
      'rise',
      'dead',
    ];
    const validBody = (b: Body) =>
      b &&
      Number.isInteger(b.id) &&
      finite(b.id, 1, 1e8) &&
      ['jyaldi', 'corner', 'watchman'].includes(b.kind) &&
      finite(b.x, 55, 1225) &&
      finite(b.y, 400, 655) &&
      finite(b.z, 0, 500) &&
      finite(b.vz, -1500, 600) &&
      (b.dir === 1 || b.dir === -1) &&
      finite(b.max, 1, 1000) &&
      finite(b.hp, 0, b.max) &&
      actions.includes(b.act) &&
      finite(b.t, 0, 1e7) &&
      finite(b.duration, 0, 10) &&
      finite(b.inv, 0, 10) &&
      finite(b.flash, 0, 10) &&
      finite(b.cooldown, 0, 10) &&
      typeof b.fired === 'boolean' &&
      typeof b.armor === 'boolean' &&
      finite(b.stride, 0, 1) &&
      finite(b.speed, 0, 1200);
    if (
      !r ||
      r.version !== SAVE_VERSION ||
      !validBody(r.player) ||
      r.player.kind !== 'jyaldi' ||
      !Array.isArray(r.enemies) ||
      r.enemies.length !== 4 ||
      !r.enemies.every((e) => validBody(e) && e.kind !== 'jyaldi') ||
      new Set([r.player, ...r.enemies].map((b) => b.id)).size !== 5
    )
      return null;
    const p = r.player;
    if (
      ![p.energy, p.gauge, p.guard].every((n) => finite(n, 0, 100)) ||
      !finite(p.dashCd, 0, 10) ||
      !Array.isArray(p.items) ||
      p.items.length !== 3 ||
      !p.items.every((n) => Number.isInteger(n) && finite(n, 0, 9))
    )
      return null;
    if (
      !finite(r.time, 0, 1e7) ||
      !finite(r.nextId, 6, 1e8) ||
      !Number.isInteger(r.nextId) ||
      !finite(r.kills, 0, 4) ||
      !Number.isInteger(r.kills) ||
      typeof r.auto !== 'boolean' ||
      !['combat', 'cleared', 'evacuated'].includes(r.phase) ||
      !finite(r.cutin, 0, 1) ||
      !finite(r.hitstop, 0, 1) ||
      typeof r.message !== 'string' ||
      r.message.length > 150
    )
      return null;
    if (
      (r.phase === 'combat' && (p.hp <= 0 || r.enemies.every((e) => !e.hp))) ||
      (r.phase === 'cleared' && (p.hp <= 0 || r.enemies.some((e) => e.hp > 0))) ||
      (r.phase === 'evacuated' && p.hp > 0)
    )
      return null;
    if (
      !Array.isArray(r.bolts) ||
      r.bolts.length > 48 ||
      !r.bolts.every(
        (b) =>
          Number.isInteger(b.id) &&
          finite(b.id, 1, 1e8) &&
          finite(b.x, -30, 1310) &&
          finite(b.y, 400, 655) &&
          finite(b.z, 0, 600) &&
          finite(b.vx, -1000, 1000) &&
          finite(b.life, 0, 2) &&
          typeof b.enemy === 'boolean',
      )
    )
      return null;
    // 장식 효과는 복구하지 않아도 판정에 영향 없음. 도중 공격·탄환·컷인은 유지한다.
    r.effects = [];
    return r;
  } catch {
    return null;
  }
}
