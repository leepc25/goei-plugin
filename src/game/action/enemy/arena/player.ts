// 시험장 전용 회색 상자 요원. 실제 요원·조작은 「게임 전투와 조작」 엔진이 맡고, 이것은 적을 시험하기 위한 대역이다.
// 근접 3연타(잽·스트레이트·강한 스트레이트), 달리며 A 돌진, 공중 A 점프 킥, 앉아 A 하단, S 권총, D 폭파, Q 가드, Shift 회피·달리기, G 환경 무기.
import type { Body, Hit, HitResult, PlayerState, WBox, WorldView } from '../types';
import { overlap } from '../geom';

export interface Keys {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  shift: boolean;
  guard: boolean;
  crouch: boolean;
  /** 이번 틱에 눌림 */
  press: Set<string>;
}

interface PMove {
  id: string;
  start: number;
  active: number;
  recover: number;
  box: [number, number, number, number];
  dmg: number;
  react: Hit['react'];
  push: number;
  lift?: number;
  low?: boolean;
  armorBreak?: boolean;
  vx?: number;
  strength: 1 | 2 | 3;
  dy?: number;
  noise?: number;
}
const MOVES: Record<string, PMove> = {
  jab: { id: 'jab', start: 3, active: 3, recover: 7, box: [30, 112, 120, 160], dmg: 8, react: 'flinch', push: 3, strength: 1 },
  straight: { id: 'straight', start: 4, active: 3, recover: 9, box: [30, 122, 118, 158], dmg: 10, react: 'flinch', push: 4, strength: 1 },
  strong: { id: 'strong', start: 7, active: 4, recover: 15, box: [30, 136, 110, 165], dmg: 18, react: 'down', push: 11, strength: 3, vx: 3 },
  dash: { id: 'dash', start: 5, active: 7, recover: 14, box: [10, 100, 60, 170], dmg: 14, react: 'stagger', push: 13, strength: 2, vx: 9 },
  kick: { id: 'kick', start: 3, active: 12, recover: 4, box: [10, 110, 30, 110], dmg: 12, react: 'stagger', push: 8, strength: 2 },
  sweep: { id: 'sweep', start: 6, active: 4, recover: 13, box: [10, 140, 0, 40], dmg: 10, react: 'launch', push: 3, lift: 13, low: true, strength: 2 },
  blast: { id: 'blast', start: 12, active: 4, recover: 18, box: [-170, 170, 0, 220], dmg: 24, react: 'down', push: 12, strength: 3, dy: 60, noise: 1 },
  env: { id: 'env', start: 10, active: 4, recover: 16, box: [20, 150, 40, 170], dmg: 20, react: 'down', push: 14, armorBreak: true, strength: 3 },
};

let ids = 1;
export class ArenaPlayer implements Body, PlayerState {
  readonly id = 0;
  readonly team = 'player' as const;
  readonly kind = 'agent';
  label = '시험 요원';
  x = 400;
  y = 600;
  z = 0;
  vz = 0;
  dir: 1 | -1 = 1;
  hp = 300;
  hpMax = 300;
  alive = true;
  stop = 0;
  // PlayerState
  ammo = 12;
  mag = 12;
  gauge = 0;
  guardMeter = 100;
  state = 'idle';
  airborne = false;
  running = false;
  crouching = false;
  guarding = false;
  combo = 0;

  move: PMove | null = null;
  mt = 0;
  atk = 0;
  buffered = false;
  stun = 0;
  inv = 0;
  shotCd = 0;
  blastCd = 0;
  envCd = 0;
  grabbedT = 0;
  escape = 0;
  invincible = false;
  debuffs: Record<string, number> = {};
  shiftT = 0;
  respawn = 0;
  bleedT = 0;
  lastGrabHit = -99;

  constructor(readonly spawnBullet: (x: number, y: number, dir: 1 | -1) => void) {}

  hurtLocal(): [number, number, number, number, string][] {
    if (!this.alive || this.inv > 0 && this.state === 'evade') return [];
    const h = this.crouching ? 130 : 200;
    return [
      [-22, 22, 0, h * 0.46, 'legs'],
      [-28, 28, h * 0.46, h * 0.8, 'torso'],
      [-16, 16, h * 0.8, h, 'head'],
    ];
  }
  frame(): { hit: Hit[]; hurt: WBox[] } {
    const hurt: WBox[] = this.state === 'down' ? [] : this.hurtLocal().map(([a, b, z0, z1]) => box(this, a, b, z0, z1, 16));
    const hit: Hit[] = [];
    const m = this.move;
    if (m && this.mt >= m.start && this.mt < m.start + m.active) {
      const [a, b, z0, z1] = m.box;
      hit.push({ ...box(this, a, b, z0, z1, m.dy ?? 22), attackId: this.atk, dmg: m.dmg, react: m.react, dir: this.dir, push: m.push, lift: m.lift, low: m.low, armorBreak: m.armorBreak, strength: m.strength, stop: m.strength === 3 ? 5 : m.strength === 2 ? 3 : 2 });
    }
    return { hit, hurt };
  }

  input(k: Keys, w: WorldView) {
    if (!this.alive) {
      if (--this.respawn <= 0) Object.assign(this, { alive: true, hp: this.hpMax, state: 'idle', inv: 60, stun: 0, debuffs: {} });
      return;
    }
    const rev = (this.debuffs.headache ?? 0) > 0;
    let mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    if (rev) mx = -mx;
    const my = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    const fear = (this.debuffs.fear ?? 0) > 0;
    if (this.grabbedT > 0) {
      // 잡힘: 아무 키나 연타해 빠져나온다
      if (k.press.size) this.escape += k.press.size;
      this.state = 'grabbed';
      return;
    }
    if (this.stun > 0 || this.state === 'down') return;
    // Shift: 짧게 = 회피, 누르고 있으면 달리기
    if (k.shift) this.shiftT++;
    const released = !k.shift && this.shiftT > 0;
    if (released && this.shiftT <= 5 && !fear && !this.move && !this.airborne) {
      this.state = 'evade';
      this.inv = 12;
      this.stun = 12;
      this.evadeDir = mx || -this.dir;
    }
    if (!k.shift) this.shiftT = 0;
    this.running = k.shift && this.shiftT > 5 && mx !== 0;
    this.crouching = k.crouch && !this.airborne;
    this.guarding = k.guard && !fear && !this.move && !this.airborne;
    const p = k.press;
    const busy = !!this.move;
    if (p.has('A')) {
      if (busy) this.buffered = true;
      else if (this.airborne) this.begin('kick');
      else if (this.crouching) this.begin('sweep');
      else if (this.running) this.begin('dash');
      else this.begin('jab');
    }
    if (p.has('S') && !busy && this.shotCd <= 0) {
      this.shotCd = 9;
      this.spawnBullet(this.x + this.dir * 40, this.y, this.dir);
      this.state = 'shot';
      this.noise = Math.max(this.noise, 1);
      w.emit({ type: 'shot', x: this.x, ammo: 99 });
    }
    if (p.has('D') && !busy && this.blastCd <= 0 && !this.airborne) ((this.blastCd = 120), this.begin('blast'));
    if (p.has('G') && !busy && this.envCd <= 0 && !this.airborne) ((this.envCd = 30), this.begin('env'));
    if (p.has('Space') && !this.airborne && !busy && !this.crouching) ((this.vz = 17), (this.airborne = true), w.emit({ type: 'jump', x: this.x }));
    if (!busy && !this.guarding && this.state !== 'evade') {
      const sp = (this.running ? 7 : 4) * ((this.debuffs.slow ?? 0) > 0 ? 0.55 : 1) * (this.crouching ? 0.4 : 1);
      this.x += mx * sp;
      this.y += my * sp * 0.6;
      if (mx) this.dir = (mx > 0 ? 1 : -1) as 1 | -1;
      if (!this.airborne && !this.crouching) this.state = mx || my ? (this.running ? 'run' : 'walk') : this.state === 'shot' && this.shotCd > 4 ? 'shot' : 'idle';
      if (this.crouching) this.state = 'crouch';
    }
    if (this.guarding) this.state = 'guard';
    if (this.running) this.noise = Math.max(this.noise, 0.6);
  }
  evadeDir = 1;
  noise = 0;

  begin(id: string) {
    this.move = MOVES[id];
    this.mt = 0;
    this.atk = 5_000_000 + ids++ * 4;
    this.buffered = false;
    this.state = id;
    if (id === 'blast') this.noise = 1;
  }

  step(w: WorldView) {
    if (!this.alive) return;
    for (const k in this.debuffs) if (this.debuffs[k] > 0) this.debuffs[k]--;
    if ((this.debuffs.bleed ?? 0) > 0 && w.tick % 30 === 0 && !this.invincible) this.hp -= this.hpMax * 0.01;
    if (this.inv > 0) this.inv--;
    if (this.shotCd > 0) this.shotCd--;
    if (this.blastCd > 0) this.blastCd--;
    if (this.envCd > 0) this.envCd--;
    this.noise = Math.max(0, this.noise - 0.025);
    if (this.grabbedT > 0) {
      this.grabbedT--;
      if (this.escape >= 8 || w.tick - this.lastGrabHit > 14) ((this.grabbedT = 0), (this.escape = 0), (this.inv = 20), (this.state = 'idle'));
    }
    if (this.stun > 0) {
      this.stun--;
      if (this.state === 'evade') this.x += this.evadeDir * 9;
      else this.x += this.knock;
      this.knock *= 0.8;
      if (this.stun === 0 && this.state !== 'down') this.state = 'idle';
      if (this.stun === 0 && this.state === 'down') ((this.state = 'idle'), (this.inv = 12));
    }
    const m = this.move;
    if (m) {
      this.mt++;
      if (m.vx && this.mt >= m.start && this.mt < m.start + m.active) this.x += m.vx * this.dir;
      if (this.mt === m.start && m.noise) this.noise = 1;
      const end = m.start + m.active + m.recover;
      // 연타: 마무리 중 A가 들어와 있으면 다음 타
      if (this.buffered && this.mt >= m.start + m.active && (m.id === 'jab' || m.id === 'straight')) this.begin(m.id === 'jab' ? 'straight' : 'strong');
      else if (this.mt >= end || (m.id === 'kick' && !this.airborne)) ((this.move = null), (this.state = 'idle'));
    }
    if (this.airborne) {
      this.z += this.vz;
      this.vz -= 1.2;
      if (this.z <= 0) ((this.z = 0), (this.vz = 0), (this.airborne = false), w.emit({ type: 'land', x: this.x }));
    }
    const [b0, b1] = w.bounds;
    const [l0, l1] = w.lane;
    this.x = Math.max(b0 + 20, Math.min(b1 - 20, this.x));
    this.y = Math.max(l0, Math.min(l1, this.y));
    if (this.hp <= 0 && !this.invincible) ((this.alive = false), (this.respawn = 60), (this.move = null));
    if (this.invincible) this.hp = Math.max(this.hp, 1);
  }
  knock = 0;

  applyHit(hit: Hit & { debuff?: { kind: string; ticks: number } }, w: WorldView): HitResult {
    if (!this.alive || (this.inv > 0 && !hit.grab) || this.state === 'down') return { kind: 'immune' };
    if (hit.grab) {
      if (this.airborne || this.state === 'evade') return { kind: 'immune' };
      this.lastGrabHit = w.tick;
      if (this.grabbedT <= 0) ((this.grabbedT = 300), (this.escape = 0), (this.move = null));
      this.hp -= hit.dmg;
      if (hit.debuff) this.debuffs[hit.debuff.kind] = hit.debuff.ticks;
      return { kind: 'hit' };
    }
    if (hit.low && this.airborne) return { kind: 'immune' };
    const front = hit.dir === -this.dir;
    if (this.guarding && front && !hit.armorBreak) {
      this.hp -= Math.round(hit.dmg * 0.15);
      this.knock = hit.dir * 3;
      this.stun = 6;
      w.emit({ type: 'guard', x: this.x });
      return { kind: 'guard' };
    }
    this.hp -= hit.dmg;
    if (hit.debuff) this.debuffs[hit.debuff.kind] = hit.debuff.ticks;
    w.emit({ type: 'hurt', x: this.x, dmg: hit.dmg, hp: this.hp });
    this.move = null;
    const r = hit.react;
    if (r === 'none') return { kind: 'hit' };
    this.knock = hit.dir * (hit.push ?? 4) * 0.7;
    if (r === 'down' || r === 'launch' || r === 'bind') {
      this.state = 'down';
      this.stun = r === 'bind' ? 50 : 36;
      if (r === 'launch') ((this.vz = hit.lift ?? 12), (this.airborne = true));
    } else {
      this.state = 'hurt';
      this.stun = r === 'stagger' ? 16 : 10;
    }
    return { kind: 'hit' };
  }
}

function box(p: { x: number; y: number; z: number; dir: number }, a: number, b: number, z0: number, z1: number, dy: number): WBox {
  const x0 = p.x + a * p.dir,
    x1 = p.x + b * p.dir;
  return { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: p.z + z0, z1: p.z + z1, y: p.y, dy };
}

/** 요원 총알 */
export class Bullet implements Body {
  readonly id = 800000 + ids++;
  readonly team = 'player' as const;
  readonly kind = 'bullet';
  z = 128;
  hp = 1;
  hpMax = 1;
  alive = true;
  stop = 0;
  t = 0;
  atk = 6_000_000 + ids++;
  hitOnce = false;
  constructor(
    public x: number,
    public y: number,
    public dir: 1 | -1,
  ) {}
  frame() {
    if (!this.alive) return { hit: [], hurt: [] };
    const b = { x0: this.x - 12, x1: this.x + 12, z0: this.z, z1: this.z + 8, y: this.y, dy: 14 };
    return { hit: [{ ...b, attackId: this.atk, dmg: 6, react: 'none' as const, dir: this.dir, push: 1, stop: 1, strength: 1 as const }], hurt: [] };
  }
  step(w: WorldView) {
    if (this.hitOnce) return void (this.alive = false);
    this.x += this.dir * 22;
    if (++this.t > 40) this.alive = false;
    const mine = this.frame().hit[0];
    for (const b of w.bodies)
      if (mine && b.team === 'enemy' && b.alive && !b.kind.startsWith('proj') && b.frame().hurt.some((h) => overlap(mine, h))) {
        this.hitOnce = true;
        break;
      }
  }
  applyHit(): HitResult {
    return { kind: 'immune' };
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#9fe7ff';
    ctx.fillRect(this.x - 10, this.y - this.z - 8, 20, 5);
  }
}
