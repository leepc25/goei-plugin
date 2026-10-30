// 엔진 기본 몸: 허수아비, 임시 적(적 모듈이 없을 때만), 총알. 전부 회색 상자. 진짜 적·수호자는 enemy/ 몫이다.
import type { Body, Hit, HitResult, SpawnSpec, WBox, WorldView } from './contract';
import { Fighter, newId, toWorld } from './fighter';
import { newAttackId } from './ids';

/** 허수아비: 쓰러지지 않고 체력이 다시 찬다. 콤보 연습용 */
export class Dummy extends Fighter {
  readonly team = 'enemy' as const;
  readonly kind = 'dummy';
  label = '허수아비';
  hp = 1000;
  hpMax = 1000;
  regen = 0;
  constructor(x: number, y: number, private endless = true) {
    super();
    if (!endless) this.hp = this.hpMax = 70;
    this.x = this.px = x;
    this.y = this.py = y;
    this.dir = -1;
  }
  frame() {
    if (this.phase === 'dead') return { hit: [], hurt: [] };
    const lying = this.phase === 'down';
    return { hit: [], hurt: [toWorld(this, -22, 22, 0, lying ? 30 : 170)] };
  }
  applyHit(hit: Hit, world: WorldView): HitResult {
    const r = super.applyHit(hit, world);
    if (this.endless) {
      if (this.hp <= 0) this.hp = 1;
      if (this.phase === 'dead') this.enter('down', 20);
      this.regen = 90;
    }
    return { kind: r.kind };
  }
  step(world: WorldView) {
    if (this.regen > 0 && --this.regen === 0) this.hp = this.hpMax;
    if (this.stepReact(world)) return;
    this.vx = 0;
  }
}

/** 임시 적: 다가와서 예고(붉게 번쩍) 뒤 주먹. 적 모듈이 붙으면 쓰지 않는다 */
export class Thug extends Fighter {
  readonly team = 'enemy' as const;
  readonly kind: string;
  private ai: 'approach' | 'windup' | 'strike' | 'recover' | 'wait' = 'wait';
  private aiT = 0;
  private atk = 0;
  private hitDone = 0;
  private strafe = 0;
  readonly elite: boolean;
  speed: number;
  dmg: number;
  constructor(spec: SpawnSpec, world: WorldView) {
    super();
    this.kind = spec.kind;
    this.elite = !!spec.elite;
    this.boss = !!spec.boss;
    this.label = spec.boss ? '낡은 제복의 경비원' : spec.elite ? '정예 · 해롭지 않아 보이는 것' : '해롭지 않아 보이는 것';
    this.hp = this.hpMax = spec.boss ? 420 : spec.elite ? 110 : 60;
    this.speed = spec.boss ? 2.6 : 3.2;
    this.dmg = spec.boss ? 18 : spec.elite ? 14 : 10;
    this.armor = spec.boss ? 1 : 0;
    this.grabbable = !spec.boss;
    this.x = this.px = spec.x;
    this.y = this.py = spec.y;
    this.aiT = Math.floor(world.rand() * 30);
    this.strafe = world.rand() < 0.5 ? -1 : 1;
  }
  get tall() {
    return this.boss ? 200 : 168;
  }
  frame(): { hit: Hit[]; hurt: WBox[] } {
    if (this.phase === 'dead') return { hit: [], hurt: [] };
    const lying = this.phase === 'down' || (this.phase === 'air-hurt' && this.z < 20);
    const hurt = [toWorld(this, -24, 24, 0, lying ? 34 : this.tall)];
    const hit: Hit[] = [];
    if (this.phase === 'free' && this.ai === 'strike' && this.aiT < 3) {
      const reach = this.boss ? 120 : 92;
      hit.push({ ...toWorld(this, 10, reach, 90, 140, 16), attackId: this.atk, dmg: this.dmg, react: this.boss ? 'down' : 'stagger', dir: this.dir, push: this.boss ? 10 : 6, lift: 10, stop: 4, strength: 2 });
    }
    return { hit, hurt };
  }
  protected onKilled(world: WorldView) {
    world.emit({ type: 'enemyDie', x: this.x, kind: this.kind });
  }
  step(world: WorldView) {
    if (this.boss) this.armor = this.ai === 'windup' || this.ai === 'strike' ? 2 : 1;
    if (this.stepReact(world)) {
      if (this.phase !== 'free') this.ai = 'recover';
      this.aiT = 0;
      return;
    }
    const p = world.player;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    this.aiT++;
    switch (this.ai) {
      case 'wait':
      case 'recover': {
        this.vx = 0;
        if (this.aiT > (this.ai === 'recover' ? 18 : 10)) this.set('approach');
        break;
      }
      case 'approach': {
        if (p.hp <= 0) return;
        this.dir = dx > 0 ? 1 : -1;
        const want = this.boss ? 100 : 78;
        const okX = Math.abs(dx) < want + 8;
        const okY = Math.abs(dy) < 10;
        // 같은 줄로 맞추면서 다가간다. 다른 적과 겹치지 않게 살짝 옆으로
        const tx = okX ? 0 : Math.sign(dx) * this.speed;
        const ty = okY ? 0 : Math.sign(dy) * this.speed * 0.6;
        this.x += tx;
        this.y += ty + this.strafe * 0.15;
        if (okX && okY && this.aiT > 6) {
          this.set('windup');
          world.emit({ type: this.boss ? 'bossTell' : 'enemyTell', x: this.x, kind: this.kind });
        }
        if (this.aiT > 200) this.set('wait');
        break;
      }
      case 'windup':
        if (this.aiT >= (this.boss ? 18 : 13)) {
          this.atk = newAttackId();
          this.hitDone = 0;
          this.set('strike');
          this.x += this.dir * 6;
        }
        break;
      case 'strike':
        if (this.aiT >= (this.boss ? 14 : 12)) this.set('recover');
        break;
    }
    const [lo, hi] = world.lane;
    this.y = Math.max(lo, Math.min(hi, this.y));
    void this.hitDone;
  }
  private set(a: Thug['ai']) {
    this.ai = a;
    this.aiT = 0;
  }
  draw(ctx: CanvasRenderingContext2D) {
    const h = this.tall;
    const w = 48;
    const lying = this.phase === 'down' || this.phase === 'dead';
    const tell = this.ai === 'windup' && this.phase === 'free';
    ctx.save();
    if (this.phase === 'dead') ctx.globalAlpha = Math.max(0, 1 - this.t / 30) * (this.t % 4 < 2 ? 1 : 0.4);
    const body = this.flash > 0 ? '#ffffff' : tell && this.aiT % 4 < 2 ? '#c84040' : this.boss ? '#5d5a52' : this.elite ? '#6a6070' : '#77818a';
    ctx.fillStyle = body;
    if (lying) ctx.fillRect(-h / 2, -30, h, 30);
    else {
      ctx.fillRect(-w / 2, -h, w, h);
      // 얼굴 쪽 표시와 팔
      ctx.fillStyle = '#20262a';
      ctx.fillRect(this.dir * 8 - 4, -h + 18, 8, 6);
      ctx.fillStyle = body;
      const arm = this.phase === 'free' && this.ai === 'strike' ? (this.boss ? 110 : 84) : tell ? -14 : 18;
      ctx.fillRect(this.dir > 0 ? 6 : -6 - arm, -120, arm, 16);
    }
    ctx.restore();
  }
}

/** 총알. 짧은 섬광 선으로 그린다 */
export class Bullet implements Body {
  readonly id = newId();
  readonly team = 'player' as const;
  readonly kind = 'bullet';
  private readonly attackId = newAttackId();
  hp = 1;
  hpMax = 1;
  alive = true;
  stop = 0;
  dist = 0;
  px: number;
  py: number;
  pz: number;
  constructor(public x: number, public y: number, public z: number, public dir: 1 | -1) {
    this.px = x;
    this.py = y;
    this.pz = z;
  }
  frame() {
    const x0 = this.dir > 0 ? this.x - 44 : this.x;
    return {
      hit: [{ x0, x1: x0 + 44, z0: this.z - 10, z1: this.z + 10, y: this.y, dy: 14, attackId: this.attackId, dmg: 7, react: 'flinch' as const, dir: this.dir, push: 2, stop: 2, strength: 1 as const, noise: 0.6 }],
      hurt: [],
    };
  }
  step(world: WorldView) {
    this.x += this.dir * 44;
    this.dist += 44;
    const [b0, b1] = world.bounds;
    if (this.dist > 1100 || this.x < b0 - 100 || this.x > b1 + 100) this.alive = false;
  }
  applyHit(): HitResult {
    return { kind: 'immune' };
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(this.dir > 0 ? -40 : 0, -2, 40, 4);
  }
}
