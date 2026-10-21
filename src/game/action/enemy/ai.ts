// 일반 적 두뇌. 역할(10.1)별 공통 행동 + 적마다 다른 규칙 (규칙형·천장·얼룩·보이지 않음 등).
// 벨트스크롤 관례: 한 번에 공격하는 적은 2체까지(공격권). 나머지는 둘러싸고 기다린다.
import { Enemy, stillTicks, type Brain } from './enemy';
import type { Attack } from './roster';
import type { WorldView } from './types';
import { spawnInto } from './registry';

export const MAX_ATTACKERS = 2;

export function attackersNow(w: WorldView): number {
  let n = 0;
  for (const b of w.bodies) if (b instanceof Enemy && b.alive && !b.boss && b.state === 'attack' && b.def.role !== 'shoot') n++;
  return n;
}

function cond(e: Enemy, a: Attack, w: WorldView): boolean {
  const p = w.player;
  switch (a.when) {
    case undefined:
      return true;
    case 'grounded':
      return !p.airborne && !e.mem.cling;
    case 'airTarget':
      return !!e.mem.cling;
    case 'close':
      return Math.abs(p.x - e.x) < 110;
    case 'far':
      return Math.abs(p.x - e.x) > 250;
    case 'behind':
      return Math.sign(p.x - e.x) === -e.dir;
    case 'targetBack':
      return Math.sign(e.x - p.x) === -p.dir;
    case 'phase2':
      return e.phase >= 2;
    case 'phase3':
      return e.phase >= 3;
    case 'lowHp':
      return e.hp < e.hpMax * 0.4;
  }
}

/** 쓸 수 있는 공격 중 하나를 무게로 고른다 */
export function pickAttack(e: Enemy, w: WorldView, attacks: Attack[] = e.def.attacks): Attack | null {
  const p = w.player;
  const adx = Math.abs(p.x - e.x),
    ady = Math.abs(p.y - e.y);
  const ok = attacks.filter((a) => e.cd(a.move.id) <= 0 && adx >= a.range[0] && adx <= a.range[1] && ady <= a.dy && cond(e, a, w));
  if (!ok.length) return null;
  let sum = ok.reduce((s, a) => s + a.weight, 0) * w.rand();
  for (const a of ok) if ((sum -= a.weight) <= 0) return a;
  return ok[ok.length - 1];
}

/** 선호 거리로 다가가거나 물러난다. 공격권이 없으면 바깥 원에서 기다린다 */
export function approach(e: Enemy, w: WorldView, keep = e.def.keep, wait = false) {
  const p = w.player;
  const dx = p.x - e.x;
  const adx = Math.abs(dx);
  const sp = e.speed();
  e.face(p.x);
  const far = wait ? keep[1] + 140 : keep[1];
  let mx = 0;
  if (adx > far) mx = Math.sign(dx);
  else if (adx < keep[0]) mx = -Math.sign(dx);
  // 같은 편끼리 겹치지 않게 살짝 밀기
  for (const b of w.bodies) if (b !== e && b instanceof Enemy && b.alive && Math.abs(b.x - e.x) < 40 && Math.abs(b.y - e.y) < 20) e.y += b.y > e.y ? -0.8 : 0.8;
  const ty = p.y + (wait ? e.laneOff : 0);
  const my = Math.abs(ty - e.y) > 4 ? Math.sign(ty - e.y) : 0;
  e.x += mx * sp;
  e.y += my * sp * 0.6;
  e.set(mx || my ? 'walk' : 'idle');
}

/** 기본 교전: 공격권이 있으면 공격, 없으면 다가가기 */
export function engage(e: Enemy, w: WorldView, aggression = 0.12) {
  const p = w.player;
  if (!p.alive) return approach(e, w, [300, 400], true);
  const shooter = e.def.role === 'shoot';
  const can = shooter || attackersNow(w) < MAX_ATTACKERS + (w.floor.depth && w.floor.depth > 8 ? 1 : 0);
  const a = can ? pickAttack(e, w) : null;
  if (a && w.rand() < aggression * (e.rally > 0 ? 1.6 : 1)) {
    e.face(p.x);
    return e.start(a.move, w, a.cd);
  }
  approach(e, w, e.def.keep, !can);
}

const rush: Brain = { think: (e, w) => engage(e, w) };

const kite: Brain = {
  think(e, w) {
    const p = w.player;
    const adx = Math.abs(p.x - e.x);
    // 너무 붙으면 물러나며 근접 반격, 사격은 깊이를 맞춘 뒤에만
    if (adx < e.def.keep[0] - 60 && w.rand() < 0.5) {
      const a = pickAttack(e, w, e.def.attacks.filter((x) => x.when === 'close'));
      if (a) return e.start(a.move, w, a.cd);
    }
    engage(e, w, 0.08);
  },
};

const shield: Brain = {
  think(e, w) {
    engage(e, w, 0.1);
  },
};

/** 해롭지 않아 보이는 것: 등을 보인 채 서 있다가 가까이 오거나 등을 보이면 깨어난다 */
const ambush: Brain = {
  tick(e, w) {
    if (e.mem.awake) return;
    const p = w.player;
    if (e.age === 1) ((e.state = 'dormant'), (e.dir = p.x > e.x ? -1 : 1));
    if (e.state !== 'dormant') return;
    const adx = Math.abs(p.x - e.x);
    const back = Math.sign(e.x - p.x) === -p.dir;
    if (adx < 130 || (back && adx < 320 && Math.abs(p.y - e.y) < 60) || e.lastHurt > 0) {
      e.mem.awake = true;
      e.face(p.x);
      e.say('…', 20);
      e.set('stunned');
      e.stunT = 10;
      w.emit({ type: 'custom', name: 'ruleBroken', data: { rule: 'lobby', id: e.id } });
    }
    return true;
  },
  think: (e, w) => engage(e, w, 0.16),
};

/** 다리 많은 새끼: 천장을 기다 바로 위에서 떨어진다 */
const ceiling: Brain = {
  tick(e, w) {
    if (e.age === 1) ((e.mem.cling = true), (e.z = 280));
    if (e.state === 'idle' || e.state === 'walk') {
      if (!e.mem.cling && e.mem.groundT !== undefined && ++e.mem.groundT > 150) e.mem.climb = true;
      if (e.mem.climb) {
        e.z += 9;
        if (e.z >= 280) ((e.z = 280), (e.mem.cling = true), (e.mem.climb = false), (e.mem.groundT = undefined));
        return true;
      }
    }
    if (e.state === 'attack' && e.move?.id === 'drop' && e.mf === e.move.frames.length - 1) e.mem.groundT = 0;
  },
  think(e, w) {
    const p = w.player;
    if (e.mem.cling) {
      const dx = p.x - e.x,
        dy = p.y - e.y;
      e.face(p.x);
      e.x += Math.sign(dx) * Math.min(Math.abs(dx), e.speed());
      e.y += Math.sign(dy) * Math.min(Math.abs(dy), e.speed() * 0.6);
      e.set('walk');
      if (Math.abs(dx) < 24 && Math.abs(dy) < 16 && e.cd('drop') <= 0 && attackersNow(w) < MAX_ATTACKERS) {
        const a = e.def.attacks.find((x) => x.move.id === 'drop')!;
        e.start(a.move, w, a.cd);
      }
      return;
    }
    engage(e, w, 0.18);
  },
  hurt(e) {
    if (e.mem.cling && e.state !== 'attack') return [{ fx0: -50, fx1: 50, z0: -20, z1: 30, dy: 20, part: 'torso' }];
  },
  drawUnder(e, ctx) {
    if (!e.mem.cling && !(e.state === 'attack' && e.move?.id === 'drop')) return;
    // 바닥 그림자가 떨어질 때가 다가올수록 진해진다
    const k = e.state === 'attack' ? 0.35 + 0.4 * Math.min(1, e.mf / 18) : 0.15;
    ctx.globalAlpha = k;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, 62, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  },
};

const lit = (e: Enemy, w: WorldView) => w.light > 0.3 && Math.sign(e.x - w.player.x) === w.player.dir && Math.abs(e.x - w.player.x) < 380;

/** 얼룩: 멈춘 사람 밑으로 모인다. 빛 안에서만 피해를 받는다 */
const stain: Brain = {
  tick(e, w) {
    e.alpha = lit(e, w) ? 0.45 : 0.9;
  },
  think(e, w) {
    const p = w.player;
    const still = stillTicks(w);
    const dx = p.x - e.x,
      dy = p.y - e.y;
    if (lit(e, w)) {
      e.x -= Math.sign(dx) * e.speed() * 1.4;
      return e.set('walk');
    }
    const sp = e.speed() * (still > 20 ? 2 : 1);
    e.x += Math.sign(dx) * Math.min(Math.abs(dx), sp);
    e.y += Math.sign(dy) * Math.min(Math.abs(dy), sp * 0.7);
    e.set('walk');
    const rise = e.def.attacks[0];
    if (Math.abs(dx) < 30 && Math.abs(dy) < 20 && e.cd('rise') <= 0 && (still > 20 || w.rand() < 0.02)) e.start(rise.move, w, rise.cd);
  },
  hit(e, _h, _p, w) {
    const risen = e.state === 'attack' && e.mf >= 20;
    if (!lit(e, w) && !risen) return { immune: true, text: '빛이 필요하다' };
  },
};

/** 발소리: 보이지 않는다. 소리 나는 쪽으로 온다 */
const invisible: Brain = {
  tick(e, w) {
    const shown = e.state === 'attack' || e.age - e.lastHurt < 30 || e.state === 'hurt' || e.state === 'air' || e.state === 'down';
    e.alpha += ((shown ? 0.85 : 0.06) - e.alpha) * 0.2;
    if (e.age % 18 === 0 && e.state === 'walk') w.fx('ring', e.x, e.y, 0);
  },
  think(e, w) {
    const p = w.player;
    const loud = w.noise > 0.35 || p.running || /shot|shoot|super|ability/.test(p.state);
    if (loud || Math.abs(p.x - e.x) < 160 || e.mem.heard) {
      e.mem.heard = true;
      return engage(e, w, 0.14);
    }
    // 서성임
    if (!e.mem.wander || e.age % 90 === 0) e.mem.wander = (w.rand() - 0.5) * 300;
    e.x += Math.sign(e.mem.wander) * e.speed() * 0.4;
    e.set('walk');
  },
  drawUnder(e, ctx) {
    if (e.state !== 'walk' && e.state !== 'idle') return;
    const r = (e.age % 18) / 18;
    ctx.globalAlpha = 0.5 * (1 - r);
    ctx.strokeStyle = '#cfe3ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, 20 + r * 50, 5 + r * 12, 0, 0, Math.PI * 2);
    ctx.stroke();
  },
};

/** 포식자: 크고 느리다. 삼키기 뒤 입이 열린다 (머리 2배) */
const heavy: Brain = {
  tick(e) {
    if (e.state !== 'attack' && e.mem.last === 'maw') ((e.mem.mouth = 30), (e.mem.last = ''));
    if (e.mem.mouth > 0) e.mem.mouth--;
  },
  think: (e, w) => engage(e, w, 0.09),
  hit(e, _h, part) {
    if (e.mem.mouth > 0 && part === 'head') return { weak: true, text: '입 안' };
  },
};

/** 사는 척하는 주민: 인사하면 지나가고, 뛰거나 무시하거나 때리면 턱이 벌어진다 */
const rule: Brain = {
  tick(e, w) {
    if (e.age === 1) e.hostile = false;
    if (e.hostile) return;
    const p = w.player;
    const adx = Math.abs(p.x - e.x);
    e.face(p.x);
    if (e.mem.greeted) {
      if (adx < 200 && !e.bubble && w.rand() < 0.01) e.say('…어서 가요', 50);
      return true;
    }
    let why = '';
    if (e.lastHurt > 0) why = 'hit';
    else if (p.running && adx < 320) why = 'run';
    else if (adx < 140 && Math.abs(p.y - e.y) < 60) {
      e.mem.near = (e.mem.near ?? 0) + 1;
      if (e.mem.near === 1) e.say('…', 40);
      if (e.mem.near > 75) why = 'rude';
    }
    for (const b of w.bodies) if (b instanceof Enemy && b !== e && b.kind === e.kind && b.hostile && b.alive && Math.abs(b.x - e.x) < 420 && b.mem.turnedAt !== undefined && w.tick - b.mem.turnedAt > 15) why ||= 'chain';
    if (why) {
      e.hostile = true;
      e.mem.turnedAt = w.tick;
      e.say(why === 'run' ? '복도에서 뛰면 안 되지' : why === 'rude' ? '인사도 안 하네' : '…', 50);
      e.set('stunned');
      e.stunT = 20;
      w.emit({ type: 'custom', name: 'ruleBroken', data: { rule: why === 'run' ? 'r_quiet' : 'r_greet', id: e.id } });
      w.emit({ type: 'enemyTell', x: e.x, kind: e.kind });
      return true;
    }
    return true;
  },
  think: (e, w) => engage(e, w, 0.14),
  hit(e, h) {
    if (h.dir === e.dir) return { mult: 1.5 };
  },
  signal(e, s, w) {
    if (s.kind === 'greet' && !e.hostile && Math.abs(s.x - e.x) < 220) {
      e.mem.greeted = true;
      e.say('안녕하세요', 50);
      w.emit({ type: 'custom', name: 'ruleKept', data: { rule: 'r_greet', id: e.id } });
    }
  },
};

/** 붙박이 (문틈 손·벽 얼굴) */
const fixed: Brain = {
  tick(e, w) {
    if (e.kind === 'wallface') e.y = w.lane[0];
  },
  think(e, w) {
    const p = w.player;
    if (e.kind === 'doorhand') e.face(p.x);
    const a = pickAttack(e, w);
    if (a && (e.kind === 'wallface' ? Math.abs(p.y - e.y) < 50 : true)) e.start(a.move, w, a.cd);
    else e.set('idle');
  },
  after(e, w) {
    if (e.kind !== 'wallface' || e.mem.woke) return;
    // 벽 얼굴을 때리면 바닥 손 군집이 깨어난다 (규칙 11)
    e.mem.woke = true;
    e.say('으아아아', 60);
    w.emit({ type: 'custom', name: 'ruleBroken', data: { rule: 'r11', id: e.id } });
    for (let i = 0; i < 2; i++) spawnInto(w, 'floorhand', w.player.x + (i ? 140 : -140), w.player.y);
  },
  signal(e, s, w) {
    if (e.kind === 'doorhand' && s.kind === 'door' && Math.abs(s.x - e.x) < 160) {
      e.say('', 1);
      e.hp = 0;
      e.set('dead');
      w.emit({ type: 'custom', name: 'ruleKept', data: { rule: 'door', id: e.id } });
    }
  },
};

/** 납작한 손 바닥: 바닥에 붙어 다가와 발목을 잡는다 */
const floorgrab: Brain = {
  tick(e) {
    e.alpha = e.state === 'attack' ? 1 : 0.35;
  },
  think(e, w) {
    const p = w.player;
    const dx = p.x - e.x,
      dy = p.y - e.y;
    e.x += Math.sign(dx) * Math.min(Math.abs(dx), e.speed());
    e.y += Math.sign(dy) * Math.min(Math.abs(dy), e.speed() * 0.6);
    e.set('walk');
    const a = e.def.attacks[0];
    if (Math.abs(dx) < 34 && Math.abs(dy) < 18 && !p.airborne && e.cd(a.move.id) <= 0) e.start(a.move, w, a.cd);
  },
};

/** 402호의 것: 쳐다보면 두통, 등을 돌리면 멈춘다 */
const summoner: Brain = {
  tick(e, w) {
    const p = w.player;
    const watching = Math.sign(e.x - p.x) === p.dir && Math.abs(e.x - p.x) < 640;
    e.mem.frozen = !watching;
    if (watching && e.age % 45 === 0 && e.state !== 'dead') w.emit({ type: 'custom', name: 'debuff', data: { kind: 'headache', ticks: 30, from: e.id } });
    for (const [mark, n] of [[0.66, 1], [0.33, 2]] as const)
      if (e.hp < e.hpMax * mark && (e.mem.summoned ?? 0) < n) {
        e.mem.summoned = n;
        e.say('채널을 돌리지 마', 60);
        spawnInto(w, 'dusty', e.x - 120, e.y - 30);
        spawnInto(w, 'dusty', e.x + 120, e.y + 30);
      }
    if (e.mem.frozen && (e.state === 'idle' || e.state === 'walk')) return true;
  },
  think: (e, w) => engage(e, w, 0.1),
  hit(e, _h, part) {
    if (part === 'back' || (e.mem.frozen && part === 'head')) return { weak: true, text: '뒤통수' };
  },
  drawOver(e, ctx) {
    if (!e.mem.frozen) return;
    ctx.fillStyle = '#9fd3e6';
    ctx.font = '600 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('멈춤', e.x, e.y - e.def.h - 40);
  },
};

/** 과장님: 뒤에서 호명해 부하를 강화 */
const chief: Brain = {
  think: (e, w) => engage(e, w, 0.1),
  ev(e, name, w) {
    if (name !== 'rally') return;
    const ranks = ['김 대리!', '박 주임!', '이 사원!'];
    e.say(ranks[Math.floor(w.rand() * ranks.length)], 50);
    for (const b of w.bodies) if (b instanceof Enemy && b.alive && b.def.faction === 'bureau' && b !== e) ((b.rally = 300), b.say('네!', 30));
    w.emit({ type: 'custom', name: 'enemyRally', data: { id: e.id } });
  },
};

/** 검사: 2연베기·돌진 베기, 2단계에 받아치기 자세 */
const duelist: Brain = {
  tick(e, w) {
    if (e.phase === 1 && e.hp < e.hpMax * 0.5) {
      e.phase = 2;
      e.say('…', 30);
      w.emit({ type: 'bossRoar', x: e.x, kind: e.kind });
    }
  },
  think: (e, w) => engage(e, w, 0.12),
  hit(e, h, _p, w) {
    if (e.move?.id === 'stance' && e.mf >= 8 && e.mf < 48) {
      e.face(w.player.x);
      const cut = e.def.attacks[0];
      e.start(cut.move, w, 0);
      e.mf = 12; // 예고 거의 없이 받아친다
      return { immune: true, text: '받아침' };
    }
    if (h.dir === e.dir && e.state === 'attack') return { mult: 1.3 };
  },
};

/** 백일몽 탐사원: 몰리면 연막 뒤 도망 */
const rival: Brain = {
  tick(e, w) {
    if (e.state === 'flee') {
      e.x += e.mem.fleeDir * 6;
      const [b0, b1] = w.bounds;
      if (e.x < b0 - 120 || e.x > b1 + 120) {
        e.alive = false;
        w.emit({ type: 'custom', name: 'enemyEscape', data: { id: e.id, kind: e.kind } });
      }
      return true;
    }
    if (e.hp < e.hpMax * 0.3 && (e.state === 'idle' || e.state === 'walk' || e.state === 'hurt')) {
      e.fire('smoke', w, { x: e.x });
      e.say('철수!', 40);
      e.mem.fleeDir = Math.sign(e.x - w.player.x) || 1;
      e.dir = e.mem.fleeDir;
      e.set('flee');
      return true;
    }
  },
  think: (e, w) => engage(e, w, 0.14),
};

/** 모서리 조각: 떠서 거리를 두고 조각을 날린다 */
const float: Brain = {
  tick(e) {
    if (e.state !== 'attack' && e.state !== 'air' && e.state !== 'down') e.z = (e.def.hover ?? 0) + Math.sin(e.age / 9) * 10;
  },
  think: (e, w) => engage(e, w, 0.09),
};

export const AI_BRAINS: Record<string, Brain> = { rush, kite, shield, ambush, ceiling, stain, invisible, heavy, rule, fixed, floorgrab, summoner, chief, duelist, rival, float };
