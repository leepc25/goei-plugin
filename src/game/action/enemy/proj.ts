// 적 발사체. 엔진 몸(Body, team 'enemy')으로 world.add 한다. 맞으면(플레이어 피격 상자와 겹치면) 다음 틱에 사라진다.
import type { Body, Hit, HitResult, WBox, WorldView } from './types';
import { overlap } from './geom';
import { armDebuff, checkDebuffs } from './debuff';
import type { Debuff } from './types';

export interface ProjDef {
  label: string;
  w: number;
  h: number;
  /** 발사 높이 */
  z: number;
  speed: number;
  vz?: number;
  gravity?: number;
  life: number;
  dmg: number;
  react: Hit['react'];
  push?: number;
  low?: boolean;
  unblockable?: boolean;
  debuff?: { kind: string; ticks: number };
  /** 퍼지는 고리 (바닥 충격파): 매 틱 양옆으로 grow만큼 넓어짐 */
  grow?: number;
  /** 맞아도 사라지지 않음 (빔·고리·구름) */
  pierce?: boolean;
  /** 지속 피해 간격 (구름) */
  every?: number;
  /** 깊이 따라가기 (틱당 최대) */
  homeY?: number;
  /** 예고 틱 (빔): 이 동안은 판정 없음 */
  arm?: number;
  color: string;
  harmless?: boolean;
}

export const PROJ: Record<string, ProjDef> = {
  bullet: { label: '탄', w: 18, h: 6, z: 128, speed: 17, life: 48, dmg: 5, react: 'none', color: '#ffd36b' },
  shard: { label: '조각', w: 24, h: 24, z: 110, speed: 9, life: 80, dmg: 8, react: 'flinch', push: 4, homeY: 1.2, color: '#a99cf0' },
  static: { label: '지지직', w: 40, h: 170, z: 0, speed: 6.5, life: 110, dmg: 7, react: 'stagger', push: 8, unblockable: true, debuff: { kind: 'headache', ticks: 60 }, color: '#9fd3e6' },
  table: { label: '밥상', w: 90, h: 40, z: 150, speed: 8, vz: 9, gravity: 0.55, life: 70, dmg: 18, react: 'down', push: 8, color: '#8a6a44' },
  chair: { label: '날아오는 가구', w: 70, h: 60, z: 90, speed: 11, life: 140, dmg: 14, react: 'stagger', push: 10, color: '#7a5a36' },
  spoon: { label: '숟가락', w: 22, h: 6, z: 120, speed: 15, life: 50, dmg: 4, react: 'flinch', color: '#d8d8d8' },
  web: { label: '거미줄', w: 36, h: 36, z: 90, speed: 7, life: 90, dmg: 2, react: 'none', debuff: { kind: 'slow', ticks: 120 }, color: '#e8e2d0' },
  ring: { label: '충격파', w: 20, h: 26, z: 0, speed: 0, life: 26, dmg: 10, react: 'stagger', push: 10, low: true, grow: 13, pierce: true, unblockable: true, color: '#e86b4f' },
  beam: { label: '모서리 빛', w: 1400, h: 46, z: 70, speed: 0, life: 34, dmg: 16, react: 'stagger', push: 6, pierce: true, arm: 20, color: '#c8b8ff' },
  cloud: { label: '썩은 내', w: 160, h: 150, z: 0, speed: 0, life: 210, dmg: 2, react: 'none', pierce: true, every: 15, unblockable: true, debuff: { kind: 'taint', ticks: 300 }, color: '#7c8a4a' },
  smoke: { label: '연막', w: 180, h: 160, z: 0, speed: 0, life: 70, dmg: 0, react: 'none', pierce: true, harmless: true, color: '#9a98a8' },
  whistle: { label: '호루라기', w: 20, h: 200, z: 0, speed: 0, life: 22, dmg: 6, react: 'stagger', push: 12, grow: 18, pierce: true, unblockable: true, debuff: { kind: 'fear', ticks: 45 }, color: '#f0e9a0' },
};

let nextProjId = 900000;

export class Proj implements Body {
  readonly id = nextProjId++;
  readonly team = 'enemy' as const;
  readonly kind: string;
  x: number;
  y: number;
  z: number;
  dir: 1 | -1;
  hp = 1;
  hpMax = 1;
  alive = true;
  stop = 0;
  label: string;
  vx: number;
  vz: number;
  t = 0;
  half: number;
  done = false;
  attackId: number;
  constructor(
    readonly def: ProjDef,
    name: string,
    x: number,
    y: number,
    dir: 1 | -1,
    readonly owner: number,
    attackBase: number,
    readonly mult = 1,
  ) {
    this.kind = 'proj:' + name;
    this.label = def.label;
    this.x = x;
    this.y = y;
    this.z = def.z;
    this.dir = dir;
    this.vx = def.speed * dir;
    this.vz = def.vz ?? 0;
    this.half = def.w / 2;
    this.attackId = attackBase;
  }
  box(): WBox {
    const d = this.def;
    return { x0: this.x - this.half, x1: this.x + this.half, z0: this.z, z1: this.z + d.h, y: this.y, dy: d.low ? 16 : 20 };
  }
  frame(): { hit: Hit[]; hurt: WBox[] } {
    const d = this.def;
    if (!this.alive || d.harmless || (d.arm && this.t < d.arm)) return { hit: [], hurt: [] };
    const hit: Hit & { debuff?: unknown } = {
      ...this.box(),
      attackId: this.attackId,
      dmg: Math.round(d.dmg * this.mult),
      react: d.react,
      dir: this.dir,
      push: d.push ?? 2,
      stop: 2,
      low: d.low,
      armorBreak: d.unblockable,
      strength: d.react === 'down' ? 3 : d.react === 'stagger' ? 2 : 1,
    };
    if (d.debuff) {
      hit.debuff = d.debuff;
      armDebuff(hit, d.debuff as Debuff, this.id);
    }
    return { hit: [hit], hurt: [] };
  }
  step(world: WorldView): void {
    const d = this.def;
    checkDebuffs(world);
    if (this.done) return void (this.alive = false);
    this.t++;
    if (d.every && this.t % d.every === 0) this.attackId = nextProjId++ * 7;
    this.x += this.vx;
    if (d.gravity) {
      this.z += this.vz;
      this.vz -= d.gravity;
      if (this.z <= 0) {
        this.z = 0;
        world.fx('dust', this.x, this.y, 0);
        world.shake(4, 2);
        this.alive = false;
      }
    }
    if (d.grow) this.half += d.grow;
    if (d.homeY) {
      const dy = world.player.y - this.y;
      this.y += Math.max(-d.homeY, Math.min(d.homeY, dy));
    }
    if (this.t >= d.life) this.alive = false;
    if (!d.pierce && !d.harmless && !(d.arm && this.t < d.arm)) {
      const p = world.player;
      if (p.alive && p.frame().hurt.some((h) => overlap(this.box(), h))) this.done = true;
    }
  }
  applyHit(): HitResult {
    return { kind: 'immune' };
  }
  draw(ctx: CanvasRenderingContext2D): void {
    const d = this.def;
    const b = this.box();
    ctx.save();
    if (d.arm && this.t < d.arm) {
      // 빔 예고: 가는 선이 깜빡임
      ctx.globalAlpha = 0.25 + 0.5 * ((this.t >> 2) & 1);
      ctx.fillStyle = '#ff4040';
      ctx.fillRect(b.x0, this.y - b.z1 + d.h / 2 - 2, b.x1 - b.x0, 4);
      ctx.restore();
      return;
    }
    ctx.globalAlpha = d.harmless ? 0.55 * (1 - this.t / d.life) + 0.2 : d.pierce ? 0.55 : 0.95;
    ctx.fillStyle = d.color;
    if (d.grow) {
      ctx.fillRect(b.x0, this.y - b.z1, 10, b.z1 - b.z0);
      ctx.fillRect(b.x1 - 10, this.y - b.z1, 10, b.z1 - b.z0);
    } else ctx.fillRect(b.x0, this.y - b.z1, b.x1 - b.x0, b.z1 - b.z0);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, Math.min(60, this.half), 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
