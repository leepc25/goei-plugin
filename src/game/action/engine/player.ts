// 플레이어 (쟈알디). 조작은 기본기획서 부록 A + 사용자 결정(Shift 짧게 회피·길게 달리기, 탄약 제한).
import { PIXEL, type Hit, type HitResult, type WBox, type WorldView } from './contract';
import { Fighter, GRAVITY, toWorld } from './fighter';
import type { Pad } from './input';
import { COMBO, MOVES, type MoveDef } from './moves';
import type { FrameInfo } from './art';

const WALK_X = 7;
const WALK_Y = 4.2;
const RUN_X = 14;
const CROUCH_X = 2.6;
const JUMP_V = 27;
const BUFFER = 8;
const MAG = 8;
const HOLSTER_AFTER = 45;
const SKILL_CD = 75;
const GRAB_TIME = 66;

type Buf = 'attack' | 'skill' | 'jump' | 'shoot' | 'evade' | 'super';

export interface AnimRef {
  clip: string;
  frame: number;
  /** 그림 원점 보정 (도트) */
  origin: number;
}

export class Player extends Fighter {
  readonly team = 'player' as const;
  readonly kind = 'player';
  label = '쟈알디';
  hp = 220;
  hpMax = 220;
  width = 30;
  // 동작
  move: MoveDef | null = null;
  moveKey = '';
  mf = 0;
  mft = 0;
  attackId = 0;
  connected = false;
  comboStep = 0;
  comboTimer = 0;
  private buf: { b: Buf; ttl: number } | null = null;
  // 자세
  crouching = false;
  guarding = false;
  running = false;
  private wasGuarding = 0;
  airAttackUsed = false;
  // 총
  ammo = MAG;
  mag = MAG;
  reserve = 40;
  gunOut = 0;
  private queuedShot = false;
  // 게이지
  gauge = 0;
  guardMeter = 100;
  skillCd = 0;
  combo = 0;
  comboClock = 0;
  maxCombo = 0;
  // 잡기
  grabbed: Fighter | null = null;
  grabT = 0;
  grabHits = 0;
  // 그리기
  animClock = 0;
  lowWarned = false;
  /** 이 틱에 요청한 일 (world가 처리) */
  wantInteract = false;
  wantItem = 0;
  wantSuper = false;

  constructor(private clips: Record<string, FrameInfo[]>) {
    super();
    this.friction = 0.72;
  }

  get state(): string {
    if (this.phase !== 'free') return this.phase;
    if (this.move) return this.moveKey;
    if (this.grabbed) return 'grab';
    if (this.airborne) return 'jump';
    if (this.guarding) return 'guard';
    if (this.crouching) return 'crouch';
    return this.running ? 'run' : 'idle';
  }
  get guardMeterView() {
    return this.guardMeter;
  }

  /* ───────── 판정 ───────── */

  private frameInfo(): { info: FrameInfo | null; origin: number } {
    const a = this.anim();
    const list = this.clips[a.clip];
    return { info: list ? list[Math.min(a.frame, list.length - 1)] : null, origin: a.origin };
  }

  frame(): { hit: Hit[]; hurt: WBox[] } {
    const { info, origin } = this.frameInfo();
    const P = PIXEL;
    const hurt: WBox[] = [];
    if (this.alive && this.phase !== 'dead') {
      const h = info?.hurt;
      if (h) hurt.push(toWorld(this, (h[0] - origin) * P, (h[1] - origin) * P, h[2] * P, h[3] * P, 16));
      else hurt.push(toWorld(this, -16 * P / 2, 16 * P / 2, 0, (this.crouching ? 60 : 96) * P / 1, 16));
    }
    const hit: Hit[] = [];
    if (this.move?.hits && this.phase === 'free') {
      for (const mh of this.move.hits) {
        if (!mh.at.includes(this.mf)) continue;
        const r = mh.box ?? info?.reach;
        if (!r) continue;
        const o = mh.box ? 0 : origin;
        const w = toWorld(this, (r[0] - o) * P, (r[1] - o) * P, r[2] * P, r[3] * P, mh.dy ?? 20);
        hit.push({
          ...w,
          attackId: this.attackId,
          dmg: mh.dmg,
          react: mh.react,
          dir: this.dir,
          push: mh.push,
          lift: mh.lift,
          stop: mh.stop,
          low: mh.low,
          armorBreak: mh.armorBreak,
          strength: mh.strength,
          noise: mh.noise,
        });
      }
    }
    return { hit, hurt };
  }

  /** 지금 보여 줄 클립·장 */
  anim(): AnimRef {
    const c = this.animClock;
    const loop = (clip: string, every: number): AnimRef => {
      const n = this.clips[clip]?.length || 1;
      return { clip, frame: Math.floor(c / every) % n, origin: 0 };
    };
    switch (this.phase) {
      case 'hurt':
        return { clip: 'hit', frame: Math.min(3, Math.floor((this.t / Math.max(1, this.until)) * 4)), origin: 0 };
      case 'air-hurt':
        return { clip: 'down', frame: this.vz > 4 ? 0 : this.vz > -6 ? 1 : 2, origin: 0 };
      case 'down':
        return { clip: 'down', frame: Math.min(6, 3 + Math.floor(this.t / 3)), origin: 0 };
      case 'getup':
        return { clip: 'getup', frame: Math.min(4, Math.floor((this.t / this.until) * 5)), origin: 0 };
      case 'dead':
        return { clip: 'down', frame: 6, origin: 0 };
      default:
    }
    if (this.move) return { clip: this.move.clip, frame: this.mf, origin: this.move.origin ?? 0 };
    if (this.grabbed) return { clip: 'grab', frame: Math.min(3, Math.floor(this.grabT / 2)), origin: 0 };
    if (this.airborne) {
      const f = this.vz > 14 ? 2 : this.vz > 3 ? 3 : this.vz > -6 ? 4 : this.vz > -16 ? 5 : 6;
      return { clip: 'jump', frame: f, origin: 0 };
    }
    if (this.guarding) return { clip: 'block', frame: Math.min(3, this.wasGuarding), origin: 0 };
    if (this.crouching) return Math.abs(this.vx) > 0.5 ? loop('crouchwalk', 3) : { clip: 'crouch', frame: 3, origin: 0 };
    if (this.running) return loop('run', 2);
    if (Math.abs(this.vx) > 0.5 || Math.abs(this.vy) > 0.5) return loop('walk', 3);
    return this.gunOut > 0 ? loop('guard', 6) : loop('idle', 7);
  }

  /* ───────── 맞음 ───────── */

  applyHit(hit: Hit, world: WorldView): HitResult {
    if (this.invuln > 0 || this.move?.invuln && this.mf >= this.move.invuln[0] && this.mf <= this.move.invuln[1]) return { kind: 'immune' };
    const front = hit.dir === -this.dir;
    const blockable = !hit.grab && (!hit.low || this.crouching);
    if (this.guarding && front && blockable && this.phase === 'free') {
      this.guardMeter -= (hit.dmg ?? 0) * 2.4;
      this.x += hit.dir * Math.max(3, (hit.push ?? 4) * 1.6);
      world.emit({ type: 'guard', x: this.x });
      world.fx('ring', this.x + this.dir * 36, this.y, 90);
      if (this.guardMeter <= 0) {
        this.guardMeter = 0;
        this.guarding = false;
        world.emit({ type: 'guardBreak', x: this.x });
        world.say('가드가 깨졌다!', 1.2);
        this.enter('hurt', 30);
      }
      return { kind: 'guard' };
    }
    const armorFrame = this.move?.armor && this.mf >= this.move.armor[0] && this.mf <= this.move.armor[1] ? this.move.armor[2] : 0;
    this.armor = armorFrame;
    this.cancelMove();
    if (this.grabbed) this.releaseGrab();
    const r = super.applyHit(hit, world);
    if (r.kind === 'hit' || r.kind === 'armor') {
      this.gauge = Math.min(100, this.gauge + 4);
      world.emit({ type: 'hurt', x: this.x, dmg: hit.dmg, hp: this.hp });
      if (!this.lowWarned && this.hp < this.hpMax * 0.3) {
        this.lowWarned = true;
        world.emit({ type: 'hp:low' });
      }
    }
    if (r.kind === 'armor') this.armor = 0;
    return r;
  }

  protected onKilled() {
    this.crouching = this.guarding = this.running = false;
  }

  /* ───────── 한 틱 ───────── */

  private cancelMove() {
    this.move = null;
    this.moveKey = '';
    this.queuedShot = false;
  }

  play(key: string, world: WorldView) {
    const m = MOVES[key];
    this.move = m;
    this.moveKey = key;
    this.mf = 0;
    this.mft = 0;
    this.attackId++;
    this.connected = false;
    this.running = false;
    this.guarding = false;
    if (m.lunge) this.vx = this.dir * m.lunge[0];
    else if (!this.airborne) this.vx = 0;
    this.vy = 0;
    this.skipZeroFrames();
    const ability = key === 'blast' || key === 'groundblast' || key === 'grabblast';
    world.emit(ability ? { type: 'ability', x: this.x, move: key } : key === 'super' ? { type: 'super', x: this.x, move: key } : key === 'evade' ? { type: 'evade', x: this.x } : { type: 'custom', name: 'move', data: key });
  }

  private skipZeroFrames() {
    const m = this.move;
    if (!m) return;
    while (this.mf < m.ticks.length - 1 && m.ticks[this.mf] === 0) this.mf++;
  }

  /** 엔진이 명중을 알려 줌 */
  onConnect(world: WorldView, killed: boolean) {
    this.connected = true;
    this.gauge = Math.min(100, this.gauge + 2.5);
    this.combo = this.comboClock > 0 ? this.combo + 1 : 1;
    this.comboClock = 40;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (killed) this.gauge = Math.min(100, this.gauge + 4);
    void world;
  }

  private bufPress(p: Pad) {
    const order: [string, Buf][] = [['super', 'super'], ['skill', 'skill'], ['attack', 'attack'], ['jump', 'jump'], ['shoot', 'shoot']];
    for (const [k, b] of order) if (p.pressed.has(k as never)) this.buf = { b, ttl: BUFFER };
    if (p.evade) this.buf = { b: 'evade', ttl: BUFFER };
    if (p.held.has('shoot') && this.gunOut > 0 && !this.buf) this.buf = { b: 'shoot', ttl: 1 };
  }

  private take(b: Buf): boolean {
    if (this.buf?.b === b) {
      this.buf = null;
      return true;
    }
    return false;
  }

  step(world: WorldView) {
    // world가 직접 pad를 넣고 tick()을 부른다. Body.step은 반응만.
    void world;
  }

  tick(world: WorldView, p: Pad) {
    this.animClock++;
    if (this.comboTimer > 0) this.comboTimer--;
    if (this.comboClock > 0 && --this.comboClock === 0) this.combo = 0;
    if (this.skillCd > 0) this.skillCd--;
    if (this.gunOut > 0) this.gunOut--;
    if (!this.guarding) this.guardMeter = Math.min(100, this.guardMeter + 0.5);
    this.bufPress(p);
    if (this.buf && --this.buf.ttl < 0) this.buf = null;
    this.wantInteract = p.pressed.has('interact');
    this.wantItem = p.pressed.has('item1') ? 1 : p.pressed.has('item2') ? 2 : p.pressed.has('item3') ? 3 : p.pressed.has('item4') ? 4 : 0;

    if (this.stepReact(world)) {
      this.running = this.guarding = this.crouching = false;
      this.wantInteract = false;
      this.wantItem = 0;
      return;
    }
    this.armor = 0;
    if (this.move?.free && (this.buf || p.mx || p.my)) this.cancelMove();
    if (this.move) this.stepMove(world, p);
    else if (this.grabbed) this.stepGrab(world, p);
    else this.stepFree(world, p);
    this.stepPhysics(world);
  }

  private stepPhysics(world: WorldView) {
    if (this.z > 0 || this.vz > 0) {
      this.z += this.vz;
      this.vz -= GRAVITY;
      this.x += this.vx;
      if (this.z <= 0) {
        this.z = 0;
        this.vz = 0;
        this.airAttackUsed = false;
        world.emit({ type: 'land', x: this.x });
        world.fx('dust', this.x, this.y, 0);
        if (this.moveKey === 'airkick' || !this.move) this.play('land', world);
        this.vx = 0;
      }
    } else if (this.move) {
      this.x += this.vx;
      this.vx *= this.move.lunge?.[1] ?? 0.6;
    } else {
      this.x += this.vx;
      this.y += this.vy;
    }
    const [lo, hi] = world.lane;
    this.y = Math.max(lo, Math.min(hi, this.y));
    const [b0, b1] = world.bounds;
    this.x = Math.max(b0 + 30, Math.min(b1 - 30, this.x));
  }

  private stepMove(world: WorldView, p: Pad) {
    const m = this.move!;
    const key = this.moveKey;
    // 끊어 넘기기 (캔슬)
    const canCancel = this.connected ? m.cancel !== undefined && this.mf >= m.cancel : m.whiffCancel !== undefined && this.mf >= m.whiffCancel;
    if (canCancel) {
      const ci = COMBO.indexOf(key as (typeof COMBO)[number]);
      if (this.connected && this.take('skill') && this.skillCd <= 0) return this.startSkill(world, p);
      if (this.connected && this.take('super') && this.gauge >= 100) return this.startSuper(world);
      if (this.take('attack')) {
        const next = this.connected && ci >= 0 && ci < 2 ? COMBO[ci + 1] : 'jab';
        if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
        this.comboStep = COMBO.indexOf(next as never);
        this.endMoveAdvance();
        return this.play(next, world);
      }
      if (this.connected && this.take('evade')) {
        this.endMoveAdvance();
        return this.startEvade(world, p);
      }
    }
    // 회피 초반 A = 돌진 공격
    if (key === 'evade' && this.mf <= 2 && this.take('attack')) {
      if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
      return this.play('dash', world);
    }
    if (key === 'reload' && this.mf === 3 && this.mft === 0) {
      const n = Math.min(this.mag - this.ammo, this.reserve);
      this.ammo += n;
      this.reserve -= n;
      world.emit({ type: 'reload', x: this.x });
    }
    if (key === 'fire' && this.mf === 0 && this.mft === 0) this.fireBullet(world);
    // 장 진행
    if (++this.mft >= Math.max(1, m.ticks[this.mf])) {
      this.mft = 0;
      this.mf++;
      this.skipZeroFrames();
      // 타격 장에 들어가는 순간 헛침 소리
      const h = m.hits?.find((x) => x.at[0] === this.mf);
      if (h) {
        if (h.shake) world.shake(2, 1);
        if (key === 'blast' || key === 'grabblast' || key === 'groundblast' || key === 'super') {
          const fx = key === 'super' ? 130 : key === 'groundblast' ? 0 : 56;
          world.fx('boom', this.x + this.dir * fx * PIXEL / 2, this.y, key === 'groundblast' ? 10 : 70);
          world.shake(h.shake ?? 6, key === 'super' ? 3 : 2);
        }
      }
      if (this.mf >= m.ticks.length) return this.finishMove(world);
    }
  }

  private endMoveAdvance() {
    const m = this.move;
    if (m?.adv) this.x += this.dir * ((m.adv - (m.origin ?? 0)) * PIXEL);
  }

  private finishMove(world: WorldView) {
    const key = this.moveKey;
    if (this.move?.hits && !this.connected) world.emit({ type: 'whiff', x: this.x });
    const queued = this.queuedShot;
    this.endMoveAdvance();
    this.cancelMove();
    if (key === 'jab' || key === 'cross') this.comboTimer = 8;
    else this.comboStep = 0;
    if (key === 'draw') {
      this.gunOut = HOLSTER_AFTER;
      if (queued || this.buf?.b === 'shoot') {
        this.buf = null;
        this.tryShoot(world);
      }
    }
    if (key === 'fire') this.gunOut = HOLSTER_AFTER;
    if (key === 'grabblast' || key === 'grabknee') {
      /* 잡기 끝 처리는 stepGrab에서 */
    }
  }

  private startSkill(world: WorldView, p: Pad) {
    this.skillCd = SKILL_CD;
    if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
    this.play(this.crouching ? 'groundblast' : 'blast', world);
  }

  private startSuper(world: WorldView) {
    this.gauge = 0;
    this.wantSuper = true;
    this.play('super', world);
  }

  private startEvade(world: WorldView, p: Pad) {
    if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
    this.play('evade', world);
    const mx = p.mx || (p.my ? 0 : this.dir);
    const sp = MOVES.evade.lunge![0];
    this.vx = mx * sp;
    this.vy = p.my * sp * 0.55;
    this.invuln = 9;
    world.fx('dust', this.x, this.y, 0);
  }

  private tryShoot(world: WorldView) {
    if (this.ammo <= 0) {
      if (this.reserve > 0) this.play('reload', world);
      else {
        world.emit({ type: 'empty', x: this.x });
        world.say('탄약이 없다', 1);
      }
      return;
    }
    if (this.gunOut <= 0) {
      this.play('draw', world);
      this.queuedShot = true;
      return;
    }
    this.play('fire', world);
  }

  private fireBullet(world: WorldView) {
    this.ammo--;
    this.gunOut = HOLSTER_AFTER;
    world.emit({ type: 'shot', x: this.x, ammo: this.ammo });
    (world as unknown as { addBullet(o: { x: number; y: number; z: number; dir: 1 | -1 }): void }).addBullet({
      x: this.x + this.dir * 150,
      y: this.y,
      z: 66,
      dir: this.dir,
    });
    this.x -= this.dir * 2;
  }

  private stepFree(world: WorldView, p: Pad) {
    // 공중
    if (this.airborne) {
      this.vx += p.mx * 0.4;
      this.vx = Math.max(-9, Math.min(9, this.vx));
      if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
      if (!this.airAttackUsed && this.take('attack')) {
        this.airAttackUsed = true;
        this.play('airkick', world);
      }
      return;
    }
    // 필살기
    if (this.take('super')) {
      if (this.gauge >= 100) return this.startSuper(world);
      world.say('필살 게이지가 모자라다', 1);
    }
    // 앉기: ↓ 두 번, ↓ 누르고 있는 동안 유지
    if (p.downDouble) this.crouching = true;
    if (!p.held.has('down')) this.crouching = false;
    // 가드
    const g = p.held.has('guard') && this.guardMeter > 0;
    this.wasGuarding = g ? this.wasGuarding + 1 : 0;
    this.guarding = g;
    if (g) {
      this.vx = this.vy = 0;
      this.running = false;
      if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
      if (this.take('evade')) return this.startEvade(world, p);
      return;
    }
    if (this.take('evade')) return this.startEvade(world, p);
    if (this.take('skill')) {
      if (this.skillCd <= 0) return this.startSkill(world, p);
      world.say('폭파 충전 중', 0.6);
    }
    if (this.take('jump') && !this.crouching) {
      this.vz = JUMP_V;
      this.z = 1;
      this.vx = p.mx * (this.running ? 9 : 5);
      if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
      this.running = false;
      world.emit({ type: 'jump', x: this.x });
      return;
    }
    if (this.take('attack')) {
      if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
      if (this.crouching) return this.play('lowkick', world);
      if (this.running) return this.play('dash', world);
      const next = this.comboTimer > 0 && this.comboStep > 0 ? COMBO[this.comboStep] : 'jab';
      this.comboStep = COMBO.indexOf(next);
      return this.play(next, world);
    }
    if (p.pressed.has('reload') && this.ammo < this.mag && this.reserve > 0) return this.play('reload', world);
    if (this.take('shoot') && !this.crouching) {
      if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
      return this.tryShoot(world);
    }
    // 이동
    if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
    this.running = p.run && p.mx !== 0 && !this.crouching;
    if (this.crouching) {
      this.vx = p.mx * CROUCH_X;
      this.vy = 0;
    } else {
      this.vx = p.mx * (this.running ? RUN_X : WALK_X);
      this.vy = p.my * (this.running ? WALK_Y * 1.2 : WALK_Y);
    }
    // 자동 잡기: 경직 중인 적에게 걸어 붙으면
    if (p.mx && !this.running && !this.crouching) {
      for (const b of world.bodies) {
        if (!(b instanceof Fighter) || b.team !== 'enemy' || !b.alive || !b.grabbable || b.phase !== 'hurt' || b.z > 0) continue;
        const dx = b.x - this.x;
        if (Math.sign(dx) === p.mx && Math.abs(dx) < 62 && Math.abs(b.y - this.y) < 14) {
          this.grabbed = b;
          this.grabT = 0;
          this.grabHits = 0;
          b.enter('held');
          b.vx = b.vz = 0;
          this.vx = this.vy = 0;
          this.dir = dx > 0 ? 1 : -1;
          world.emit({ type: 'custom', name: 'grab' });
          break;
        }
      }
    }
  }

  releaseGrab() {
    const g = this.grabbed;
    this.grabbed = null;
    if (g && g.phase === 'held') g.enter('hurt', 8);
  }

  private stepGrab(world: WorldView, p: Pad) {
    const g = this.grabbed!;
    this.grabT++;
    this.vx = this.vy = 0;
    if (!g.alive || g.phase !== 'held') {
      this.grabbed = null;
      return;
    }
    g.x = this.x + this.dir * 50;
    g.y = this.y;
    g.z = 0;
    g.dir = (-this.dir) as 1 | -1;
    if (this.take('jump') || this.grabT > GRAB_TIME) return this.releaseGrab();
    if (this.take('attack')) {
      if (p.mx || this.grabHits >= 2) {
        if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
        g.x = this.x + this.dir * 50;
        this.play('grabblast', world);
        g.enter('hurt', 30);
        this.grabbed = null;
        return;
      }
      this.grabHits++;
      this.play('grabknee', world);
      g.phase = 'held';
    }
  }

  /** 무릎 치기 동안 잡힌 상태 유지 */
  keepHeld() {
    const g = this.grabbed;
    if (g && g.phase === 'hurt') g.enter('held');
  }
}
