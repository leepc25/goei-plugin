// 일반 적 두뇌. 역할별 공통 행동 + 가짜 관리국·백일몽 고유 행동. 옛 승강기 괴이 두뇌(규칙형·천장·얼룩 등)는 2026-10-28에 지웠다.
// 벨트스크롤 관례: 한 번에 공격하는 적은 2체까지(공격권). 나머지는 둘러싸고 기다린다.
import { Enemy, type Brain } from './enemy';
import type { Attack } from './roster';
import type { WorldView } from './types';
import { walkTo } from './navigation';

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
  // 같은 쪽에서 플레이어에 더 가까운 같은 편 수만큼 한 줄 뒤에 선다 (한 덩어리로 겹치지 않게, 검수 4-10)
  let rank = 0;
  for (const b of w.bodies)
    if (b !== e && b instanceof Enemy && b.alive && b.state !== 'dead' && Math.sign(p.x - b.x) === Math.sign(dx) && Math.abs(p.x - b.x) < adx) rank++;
  const back = Math.min(rank, 3) * 110;
  let far = (wait ? keep[1] + 140 : keep[1]) + back;
  let near = keep[0] + back;
  // 공격권이 있는데 줄 간격/선호 거리 때문에 사거리 밖에서 영구 대기하지 않는다.
  // 호명·자세 같은 비공격 동작의 긴 범위는 교전 사거리로 세지 않는다.
  if (!wait && !e.boss) {
    const ranges = e.def.attacks.filter(a => cond(e, a, w) && a.move.frames.some(f => f.hit.length || f.fire)).map(a => a.range[1]);
    if (ranges.length) far = Math.min(far, Math.max(...ranges)), near = Math.min(near, far);
  }
  let mx = 0;
  if (adx > far) mx = Math.sign(dx);
  else if (adx < near) mx = -Math.sign(dx);
  // 같은 편끼리 가까우면 앞뒤(깊이)와 옆으로 벌린다
  let ny = 0;
  for (const b of w.bodies)
    if (b !== e && b instanceof Enemy && b.alive && Math.abs(b.x - e.x) < 90 && Math.abs(b.y - e.y) < 50) {
      ny += b.y > e.y || (b.y === e.y && b.id > e.id) ? -1 : 1;
      if (!mx) e.x += (b.x > e.x || (b.x === e.x && b.id > e.id) ? -1 : 1) * Math.min(1.5, sp * 0.4);
    }
  if (ny) e.y += Math.sign(ny) * Math.min(2, sp * 0.5);
  const ty = p.y + (wait ? e.laneOff : 0);
  const my = Math.abs(ty - e.y) > 4 ? Math.sign(ty - e.y) : 0;
  if (e.boss) {
    e.x += mx * sp;
    e.y += my * sp * 0.6;
  } else if (mx || my) walkTo(e, w, mx ? p.x - Math.sign(dx) * (adx > far ? far : near) : e.x, my ? ty : e.y);
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
      const [b0, b1] = w.bounds;
      walkTo(e, w, e.mem.fleeDir < 0 ? b0 - 126 : b1 + 126, e.y, 6);
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

export const AI_BRAINS: Record<string, Brain> = { rush, kite, shield, chief, duelist, rival };
