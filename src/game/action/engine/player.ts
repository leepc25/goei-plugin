// 플레이어 (쟈알디). 조작은 기본기획서 부록 A + 사용자 결정(Shift 짧게 회피·길게 달리기, 탄약 제한).
import { PIXEL, type Body, type Hit, type HitResult, type WBox, type WorldView } from './contract';
import { Fighter, GRAVITY, toWorld } from './fighter';
import type { Pad } from './input';
import { newAttackId } from './ids';
import { COMBO, MOVES, type MoveDef } from './moves';
import type { FrameInfo } from './art';
import { progressionFor, progressionHit, defendedHit, isBlastMove, canUseMasteryMove, masteryMove, masteryHitId } from './progression';

const WALK_X = 9; // 캐릭터를 2.75배로 키우면서(검수 8번) 속도도 같은 비율 가까이
const WALK_Y = 4.2;
const RUN_X = 18;
const CROUCH_X = 3.4;
const JUMP_V = 31;
const BUFFER = 8;
const MAG = 8;
const HOLSTER_AFTER = 48; // 뽑은 권총을 들고 있는 시간 (시연판 1.6초)
const CHARGE_AFTER = 9; // D를 이만큼 누르고 있으면 충전으로
const FIGHT_STANCE = 150;
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
  private burst = 0;
  private burstT = 0;
  private dry = false;
  // D 길게: 충전
  chargeT = -1;
  charging = false;
  /** 싸움 자세 남은 틱 (때리거나 맞으면 켜짐) */
  fightT = 0;
  /** C 지원 호출: 걸어 들어와 폭파하고 나가는 다른 쟈알디 (시연판과 같게, 필살 게이지 절반) */
  ally: { x: number; y: number; dir: 1 | -1; phase: 'in' | 'act' | 'out'; clip: string; f: number; ft: number; hitOn: boolean; id: number } | null = null;
  /** 강화 선택 등이 곱하는 공격력 배수 */
  dmgMul = 1;
  progression = progressionFor();
  // 게이지
  gauge = 0;
  guardMeter = 100;
  skillCd = 0;
  combo = 0;
  comboClock = 0;
  maxCombo = 0;
  // 잡기
  grabbed: Grabbed | null = null;
  grabT = 0;
  grabHits = 0;
  // 그리기
  animClock = 0;
  private gaitFrame = 0;
  private gaitMoving = false;
  private gaitDir: 1 | -1 = 1;
  lowWarned = false;
  /** 부적: 피격 무효 남은 횟수 */
  ward = 0;
  /** 이 틱에 요청한 일 (world가 처리) */
  /** 든 것: 환경 물건은 머리 위('over'), 임시 무기는 손('hand'). 그림은 엔진이 따로 그린다 */
  carry: { kind: 'prop' | 'weapon'; id: string; hold: 'over' | 'hand'; cls?: 'melee' | 'gun' } | null = null;
  /** 든 것이 있을 때 A·S를 아이템 쪽이 받는다. 돌려준 동작을 재생, null이면 엔진 기본 */
  itemAct: ((k: 'attack' | 'shoot') => string | null) | null = null;
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

  /** 든 물건을 그릴 자리: 발 기준 앞쪽 px(dx), 높이 px(dz), 각도° (오른쪽 보기 기준) */
  heldAt(): { dx: number; dz: number; deg: number } | null {
    if (!this.carry) return null;
    const { info, origin } = this.frameInfo();
    const P = PIXEL;
    if (this.carry.hold === 'over' && info?.hand && /^carry2_|^toss/.test(this.anim().clip)) return { dx: (info.hand[0] - origin) * P, dz: info.hand[1] * P, deg: 0 };
    if (this.carry.hold === 'over') {
      const top = info?.hurt ? info.hurt[3] : 96;
      return { dx: ((info?.hurt ? (info.hurt[0] + info.hurt[1]) / 2 : 0) - origin) * P, dz: (top - 6) * P, deg: 0 };
    }
    const h = info?.hand;
    if (h) return { dx: (h[0] - origin) * P, dz: h[1] * P, deg: h[2] };
    const r = info?.reach;
    return r ? { dx: ((r[0] + r[1]) / 2 - origin) * P, dz: ((r[2] + r[3]) / 2) * P, deg: -30 } : { dx: 18 * P, dz: 50 * P, deg: -30 };
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
    const al = this.ally;
    if (al?.hitOn) {
      const a = al.dir === 1 ? al.x + 260 : al.x - 640,
        b = al.dir === 1 ? al.x + 640 : al.x - 260;
      hit.push({ x0: a, x1: b, z0: 0, z1: 320, y: al.y, dy: 70, attackId: al.id, dmg: 30 * this.dmgMul, react: 'down', dir: al.dir, push: 16, lift: 16, stop: 8, strength: 3, armorBreak: true, noise: 1 });
    }
    if (this.move?.hits && this.phase === 'free') {
      for (const mh of this.move.hits) {
        if (!mh.at.includes(this.mf)) continue;
        const r = mh.box ?? info?.reach;
        if (!r) continue;
        const o = mh.box ? 0 : origin;
        const w = toWorld(this, (r[0] - o) * P, (r[1] - o) * P, r[2] * P, r[3] * P, mh.dy ?? 20);
        hit.push({
          ...w,
          attackId: masteryHitId(this.progression, this.moveKey, this.mf, this.attackId),
          dmg: mh.dmg * this.dmgMul,
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
    return { hit: hit.map(h => progressionHit(h, this.progression, h.attackId === al?.id || isBlastMove(this.moveKey) ? 'ability' : 'melee')), hurt };
  }

  /** 지금 보여 줄 클립·장 */
  anim(): AnimRef {
    const c = this.animClock;
    const loop = (clip: string, every: number): AnimRef => {
      const n = this.clips[clip]?.length || 1;
      return { clip, frame: Math.floor(c / every) % n, origin: 0 };
    };
    const gait = (clip: string): AnimRef => ({ clip, frame: Math.floor(this.gaitFrame + 1e-9) % (this.clips[clip]?.length || 1), origin: 0 });
    switch (this.phase) {
      case 'hurt':
        return { clip: 'hit', frame: Math.min(3, Math.floor((this.t / Math.max(1, this.until)) * 4)), origin: 0 };
      case 'air-hurt':
        return { clip: 'down', frame: this.vz > 0 ? 0 : 1, origin: 0 };
      case 'down':
        return { clip: 'down', frame: Math.min(4, 2 + Math.floor(this.t / 3)), origin: 0 };
      case 'getup':
        return { clip: 'getup', frame: Math.min(4, Math.floor((this.t / this.until) * 5)), origin: 0 };
      case 'dead':
        return { clip: 'down', frame: 4, origin: 0 };
      default:
    }
    if (this.move) return { clip: this.move.clip, frame: this.mf, origin: this.move.origin ?? 0 };
    if (this.grabbed) return { clip: 'grab', frame: Math.min(3, Math.floor(this.grabT / 2)), origin: 0 };
    if (this.airborne) {
      const f = this.vz > 14 ? 2 : this.vz > 3 ? 3 : this.vz > -6 ? 4 : this.vz > -16 ? 5 : 6;
      return { clip: 'jump', frame: f, origin: 0 };
    }
    if (this.charging) return loop('charge', 3);
    if (this.guarding) return { clip: 'block', frame: Math.min(3, this.wasGuarding), origin: 0 };
    if (this.crouching) return this.gaitMoving ? gait('crouchwalk') : { clip: 'crouch', frame: 3, origin: 0 };
    // 든 것에 따라 서기·걷기·뛰기 클립이 다르다 (시연판: 산탄총·쇠파이프·두 손 들기)
    const held = this.heldSet();
    const moving = this.gaitMoving;
    const running = moving && this.running;
    if (held) {
      const want = `${held === 'carry2' ? 'carry2_' : ''}${running ? 'run' : moving ? 'walk' : 'idle'}${held === 'carry2' ? '' : '_' + held}`;
      const alt = `${held === 'carry2' ? 'carry2_' : ''}${moving ? 'walk' : 'idle'}${held === 'carry2' ? '' : '_' + held}`;
      if (this.clips[want]) return moving ? gait(want) : loop(want, 6);
      if (this.clips[alt]) return moving ? gait(alt) : loop(alt, 6);
    }
    if (running) return gait('run');
    if (moving) return gait('walk');
    // 뽑은 권총: 겨눈 자세(발사 마지막 장)를 유지
    if (this.gunOut > 0) return { clip: 'fire', frame: Math.max(0, (this.clips.fire?.length ?? 4) - 1), origin: 0 };
    return this.fightT > 0 ? loop('guard', 6) : loop('idle', 7);
  }

  /** 월드가 가구·지형·카메라 경계까지 처리한 뒤 한 번 호출한다.
   * 입력 속도만 보면 벽에 막힌 채 계속 달리므로, 최종 이동량만 발걸음에 반영한다. */
  finishLocomotion() {
    const canWalk = this.phase === 'free' && !this.move && !this.airborne && !this.grabbed && !this.guarding && !this.charging && this.stop <= 0;
    const dx = Math.abs(this.x - this.px), dy = Math.abs(this.y - this.py);
    const moving = canWalk && (Math.abs(this.vx) > 0.5 || Math.abs(this.vy) > 0.5) && (dx > 0.05 || dy > 0.05);
    if (!moving) return this.resetLocomotion();
    // 정상 보행 주기(걷기 3틱/장, 달리기 2틱/장)는 유지한다.
    // 막혀서 일부만 이동한 틱은 그 비율만큼 진행하며, 순간 이동은 주기를 가속하지 않는다.
    const speedX = this.crouching ? CROUCH_X : this.running ? RUN_X : WALK_X;
    const speedY = this.running ? WALK_Y * 1.2 : WALK_Y;
    const progress = Math.min(this.progression.stats.speed, Math.max(dx / speedX, dy / speedY));
    if (!this.gaitMoving || this.gaitDir !== this.dir) this.gaitFrame = 0;
    else this.gaitFrame += progress / (this.running && !this.crouching ? 2 : 3);
    this.gaitMoving = true;
    this.gaitDir = this.dir;
  }

  /** 방 이동·저장 복원은 보행 도중의 자세를 다음 방에 끌고 가지 않는다. */
  resetLocomotion() {
    this.gaitFrame = 0;
    this.gaitMoving = false;
    this.gaitDir = this.dir;
  }

  /** 든 물건 종류별 자세 클립 이름 조각 */
  private heldSet(): 'shotgun' | 'pipe' | 'carry2' | null {
    const c = this.carry;
    if (!c) return null;
    if (c.kind === 'prop') return 'carry2';
    if (c.cls === 'melee') return 'pipe';
    if (c.cls === 'gun' && c.id !== 'servicepistol') return 'shotgun';
    return null;
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
    if (this.ward > 0 && hit.dmg > 0) {
      this.ward--;
      this.invuln = 20;
      world.fx('ring', this.x, this.y, 100, '3');
      world.say('부적이 대신 맞았다', 1);
      return { kind: 'immune' };
    }
    hit = defendedHit(hit, this.progression);
    const armorFrame = this.move?.armor && this.mf >= this.move.armor[0] && this.mf <= this.move.armor[1] ? this.move.armor[2] : 0;
    this.armor = armorFrame;
    this.cancelMove();
    if (this.grabbed) this.releaseGrab();
    const r = super.applyHit(hit, world);
    if (r.kind === 'hit' || r.kind === 'armor') {
      this.gauge = Math.min(100, this.gauge + 4 * this.progression.stats.charge);
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
    if (!canUseMasteryMove(this.progression, key)) {
      world.say(key === 'chain' ? '연쇄 폭파: 숙련 3에서 열린다.' : '벽 통째로: 숙련 6에서 열린다.', 2);
      return;
    }
    const m = masteryMove(this.progression, key, MOVES[key]);
    this.move = m;
    this.moveKey = key;
    this.mf = 0;
    this.mft = 0;
    // 숙련 필살의 두 번째 폭발 번호까지 예약한다.
    this.attackId = newAttackId(2);
    this.connected = false;
    this.running = false;
    this.guarding = false;
    if (m.hits) this.fightT = FIGHT_STANCE;
    if (m.lunge) this.vx = this.dir * m.lunge[0];
    else if (!this.airborne) this.vx = 0;
    this.vy = 0;
    this.skipZeroFrames();
    const ability = key === 'blast' || key === 'bigblast' || key === 'groundblast' || key === 'grabblast' || key === 'chain' || key === 'wall';
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
    this.gauge = Math.min(100, this.gauge + 2.5 * this.progression.stats.charge);
    this.combo = this.comboClock > 0 ? this.combo + 1 : 1;
    this.comboClock = 40;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (killed) this.gauge = Math.min(100, this.gauge + 4 * this.progression.stats.charge);
    void world;
  }

  /** 멈춰 있는 동안(히트스톱) 입력만 받아 두기 */
  listen(p: Pad) {
    this.bufPress(p);
    if (this.buf) this.buf.ttl = Math.max(this.buf.ttl, BUFFER);
  }

  private bufPress(p: Pad) {
    const order: [string, Buf][] = [['super', 'super'], ['skill', 'skill'], ['attack', 'attack'], ['jump', 'jump'], ['shoot', 'shoot']];
    for (const [k, b] of order) if (p.pressed.has(k as never)) this.buf = { b, ttl: BUFFER };
    if (p.evade) this.buf = { b: 'evade', ttl: BUFFER };
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
    if (!this.guarding) this.guardMeter = Math.min(100, this.guardMeter + 0.5);
    this.bufPress(p);
    if (this.buf && --this.buf.ttl < 0) this.buf = null;
    this.wantInteract = p.pressed.has('interact');
    this.wantItem = p.pressed.has('item1') ? 1 : p.pressed.has('item2') ? 2 : p.pressed.has('item3') ? 3 : p.pressed.has('item4') ? 4 : 0;

    if (this.fightT > 0) this.fightT--;
    if (this.burstT > 0 && --this.burstT === 0) this.burst = 0;
    this.stepAlly(world);
    if (this.stepReact(world)) {
      this.running = this.guarding = this.crouching = this.charging = false;
      this.chargeT = -1;
      this.fightT = FIGHT_STANCE;
      this.wantInteract = false;
      this.wantItem = 0;
      return;
    }
    this.armor = 0;
    if (this.move?.free && (this.buf || p.mx || p.my)) this.cancelMove();
    if (this.move) this.stepMove(world, p);
    else if (this.charging) this.stepCharge(world, p);
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
      const k = this.move.lunge?.[1] ?? 0.6;
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= k;
      this.vy *= k;
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
    // D를 누르고 있는 동안 폭파 예비 자세(장 2)에서 멈췄다가, 길어지면 충전으로
    if (key === 'blast' && this.chargeT >= 0) {
      if (p.held.has('skill')) {
        this.chargeT++;
        if (this.mf >= 2) {
          this.mf = 2;
          this.mft = 0;
        }
        if (this.chargeT >= CHARGE_AFTER) {
          this.cancelMove();
          this.charging = true;
          this.chargeT = 0;
          return;
        }
        return;
      }
      this.chargeT = -1;
    }
    if (key === 'reload' && this.mf === 3 && this.mft === 0) {
      const n = Math.min(this.mag - this.ammo, this.reserve);
      this.ammo += n;
      this.reserve -= n;
      world.emit({ type: 'reload', x: this.x });
    }
    if (key === 'fire' && this.mf === 0 && this.mft === 0 && !this.dry) this.fireBullet(world);
    // 장 진행
    if (++this.mft >= Math.max(1, m.ticks[this.mf])) {
      this.mft = 0;
      this.mf++;
      this.skipZeroFrames();
      // 타격 장에 들어가는 순간 헛침 소리
      const h = m.hits?.find((x) => x.at[0] === this.mf || (key === 'super' && x.at.includes(this.mf)));
      if (h) {
        if (h.shake) world.shake(2, 1);
        if (key === 'blast' || key === 'bigblast' || key === 'grabblast' || key === 'groundblast' || key === 'super' || key === 'chain' || key === 'wall') {
          // 폭발은 손 고정점(있으면)에서. 필살은 앞쪽 멀리, 바닥 폭파는 발밑
          const { info, origin } = this.frameInfo();
          const hd = info?.hand;
          const reachX = h.box ? ((h.box[0] + h.box[1]) / 2) * PIXEL : 0;
          const dx = key === 'super' ? 130 * PIXEL / 2 : key === 'groundblast' ? 0 : key === 'chain' || key === 'wall' || key === 'bigblast' ? reachX : hd ? (hd[0] - origin) * PIXEL : 56 * PIXEL / 2;
          const dz = key === 'groundblast' ? 10 : hd && key !== 'super' ? hd[1] * PIXEL : 70 * PIXEL / 2;
          world.fx('boom', this.x + this.dir * dx, this.y, dz);
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
    void queued;
    // 뽑기·사격·장전 뒤에는 겨눈 채 기다린다. 다음 S가 사격 (시연판과 같게)
    if (key === 'draw' || key === 'fire' || key === 'reload') this.gunOut = HOLSTER_AFTER;
    if (key === 'holster') this.gunOut = 0;
    if (key === 'grabblast' || key === 'grabknee') {
      /* 잡기 끝 처리는 stepGrab에서 */
    }
  }

  private startSkill(world: WorldView, p: Pad) {
    this.skillCd = SKILL_CD;
    if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
    else this.faceNearest(world);
    this.gunOut = 0;
    this.play(this.crouching ? 'groundblast' : 'blast', world);
    if (!this.crouching && p.held.has('skill')) this.chargeT = 0;
  }

  /** 충전 중: 놓으면 큰 폭파 */
  private stepCharge(world: WorldView, p: Pad) {
    this.vx = this.vy = 0;
    this.chargeT++;
    if (this.chargeT % 8 === 0) {
      // 손끝 앞에서 작게 (몸·얼굴을 덮지 않게)
      const hd = this.clips.charge?.[0]?.hand;
      world.fx('spark', this.x + this.dir * ((hd ? hd[0] : 37) + 14) * PIXEL, this.y, (hd ? hd[1] : 70) * PIXEL);
    }
    if (!p.held.has('skill')) {
      this.charging = false;
      this.chargeT = -1;
      this.play('bigblast', world);
    }
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

  /** S: 집어넣은 상태면 뽑기만, 뽑은 상태면 한 발. 3발 뒤 잠깐 멈춤, 빈 탄창은 「찰칵」 (R로 장전) */
  private tryShoot(world: WorldView) {
    this.fightT = FIGHT_STANCE;
    if (this.gunOut <= 0) return this.play('draw', world);
    if (this.burst >= 3 && this.burstT > 0) return;
    this.dry = this.ammo <= 0;
    if (this.dry) {
      world.emit({ type: 'empty', x: this.x });
      world.say(this.reserve > 0 ? '찰칵 — R로 장전' : '찰칵 — 탄약이 없다', 1);
    }
    this.play('fire', world);
    if (this.dry) {
      this.mf = this.move!.ticks.length - 1;
      return;
    }
    if (++this.burst >= 3) this.burstT = 14;
  }

  private fireBullet(world: WorldView) {
    this.ammo--;
    this.gunOut = HOLSTER_AFTER;
    world.emit({ type: 'shot', x: this.x, ammo: this.ammo });
    // 총구 = 발사 장의 손 고정점 + 권총 길이 (무릎 높이에서 나가던 것 고침)
    const { info, origin } = this.frameInfo();
    const hd = info?.hand;
    const mx = hd ? (hd[0] - origin + 14) * PIXEL : 48 * PIXEL;
    const mz = hd ? (hd[1] + 3) * PIXEL : 74 * PIXEL;
    (world as unknown as { addBullet(o: { x: number; y: number; z: number; dir: 1 | -1 }): void }).addBullet({
      x: this.x + this.dir * mx,
      y: this.y,
      z: mz,
      dir: this.dir,
    });
    world.fx('spark', this.x + this.dir * mx, this.y, mz);
    this.x -= this.dir * 2;
  }

  private callAlly(world: WorldView) {
    if (this.ally) return;
    if (this.gauge < 50) return world.say('지원 호출: 필살 게이지 절반 필요', 1);
    this.gauge -= 50;
    const d = this.dir;
    this.ally = { x: this.x - d * 580, y: Math.min(world.lane[1], this.y + 30), dir: d, phase: 'in', clip: 'walk', f: 0, ft: 0, hitOn: false, id: newAttackId() };
    world.say('「길 비켜.」', 1.4);
  }

  private stepAlly(world: WorldView) {
    const a = this.ally;
    if (!a) return;
    a.hitOn = false;
    a.ft++;
    if (a.phase === 'in') {
      a.x += a.dir * 12;
      if (a.ft % 3 === 0) a.f = (a.f + 1) % (this.clips.walk?.length || 1);
      if ((this.x - a.x) * a.dir <= 150) Object.assign(a, { phase: 'act', clip: 'support', f: 3, ft: 0 });
    } else if (a.phase === 'act') {
      if (a.ft >= 3) {
        a.ft = 0;
        a.f++;
        if (a.f === 5) {
          a.hitOn = true;
          world.fx('boom', a.x + a.dir * 450, a.y, 150);
          world.shake(10, 3);
          world.emit({ type: 'ability', x: a.x, move: 'support' });
        }
        if (a.f >= (this.clips.support?.length || 10)) Object.assign(a, { phase: 'out', clip: 'walk', f: 0, ft: 0, dir: -a.dir });
      }
    } else {
      a.x += a.dir * 12;
      if (a.ft % 3 === 0) a.f = (a.f + 1) % (this.clips.walk?.length || 1);
      if (Math.abs(a.x - this.x) > 900) this.ally = null;
    }
  }

  /** 방향키 없이 칠 때: 등 뒤에만 적이 붙어 있으면 그쪽으로 돈다 (독립 검수: 허공을 침) */
  private faceNearest(world: WorldView) {
    let front = Infinity,
      back = Infinity;
    for (const b of world.bodies) {
      if (b.team !== 'enemy' || !b.alive || Math.abs(b.y - this.y) > 60) continue;
      const d = (b.x - this.x) * this.dir;
      if (d >= 0) front = Math.min(front, d);
      else back = Math.min(back, -d);
    }
    if (back < 220 && front > 260) this.dir = (-this.dir) as 1 | -1;
  }

  /** E: 앞에 있는 적을 붙잡는다 (시연판). 잡을 수 없는 적(대형·환경형)은 안 잡힌다 */
  private tryGrabFront(world: WorldView): boolean {
    for (const b of world.bodies) {
      if (b.team !== 'enemy' || !b.alive || b.z > 0) continue;
      const g = b as Grabbed;
      if (!g.grabbable || !(g instanceof Fighter || typeof g.set === 'function')) continue;
      const dx = b.x - this.x;
      if (Math.sign(dx) !== this.dir || Math.abs(dx) > 90 || Math.abs(b.y - this.y) > 20) continue;
      this.grabbed = g;
      this.grabT = 0;
      this.grabHits = 0;
      grabHold(g);
      g.vx = 0;
      this.vx = this.vy = 0;
      this.gunOut = 0;
      this.fightT = FIGHT_STANCE;
      world.emit({ type: 'custom', name: 'grab' });
      return true;
    }
    return false;
  }

  private stepFree(world: WorldView, p: Pad) {
    // 공중
    if (this.airborne) {
      this.vx += p.mx * 0.4;
      this.vx = Math.max(-16, Math.min(16, this.vx));
      if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
      if (this.carry?.kind === 'prop' && this.itemAct && this.take('attack')) {
        const anim = this.itemAct('attack');
        if (anim) this.play(anim, world);
        return;
      }
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
    // 앉기: ↓ 두 번으로 앉고 앉은 채 유지, ↑·Space·↓ 두 번으로 일어선다 (시연판)
    if (this.crouching && (p.pressed.has('up') || p.pressed.has('jump') || p.downDouble)) {
      this.crouching = false;
      if (this.buf?.b === 'jump') this.buf = null;
      p.pressed.delete('up');
    } else if (p.downDouble && !this.carry) {
      this.crouching = true;
      this.gunOut = 0;
    }
    if (p.pressed.has('interact') && !this.carry && !this.crouching && this.tryGrabFront(world)) {
      this.wantInteract = false;
      return;
    }
    if (p.pressed.has('ally')) this.callAlly(world);
    // F 연쇄 폭파, G 벽 통째로 (숙련 동작)
    if (!this.crouching && !this.carry && p.pressed.has('chain')) {
      this.play('chain', world);
      if (this.move) return;
    }
    if (!this.crouching && !this.carry && p.pressed.has('wall')) {
      this.play('wall', world);
      if (this.move) return;
    }
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
      this.vx = p.mx * (this.running ? 16 : WALK_X);
      if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
      this.running = false;
      world.emit({ type: 'jump', x: this.x });
      return;
    }
    // 든 것이 있으면 A·S는 던지기·휘두르기·임시 총
    if (this.carry && this.itemAct && (this.buf?.b === 'attack' || this.buf?.b === 'shoot')) {
      const k = this.buf.b as 'attack' | 'shoot';
      if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
      const anim = this.itemAct(k);
      if (anim !== null) {
        this.take(k);
        if (anim) this.play(anim === 'wfire' && this.heldSet() === 'shotgun' ? 'wshot' : anim, world);
        return;
      }
    }
    if (this.take('attack')) {
      if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
      else this.faceNearest(world);
      if (this.crouching) return this.play('lowkick', world);
      if (this.running) return this.play('dash', world);
      const next = this.comboTimer > 0 && this.comboStep > 0 ? COMBO[this.comboStep] : 'jab';
      this.comboStep = COMBO.indexOf(next);
      return this.play(next, world);
    }
    if (p.pressed.has('reload') && this.ammo < this.mag) {
      if (this.reserve > 0) return this.play('reload', world);
      world.say('예비 탄약이 없다', 1);
    }
    if (this.take('shoot') && !this.crouching) {
      if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
      return this.tryShoot(world);
    }
    // 겨눈 채 움직이면 권총을 집어넣는다. 아무것도 안 하고 시간이 지나도 집어넣는다
    if (this.gunOut > 0 && (p.mx || p.my || --this.gunOut === 0)) {
      this.gunOut = 0;
      return this.play('holster', world);
    }
    // 이동
    if (p.mx) this.dir = p.mx > 0 ? 1 : -1;
    this.running = p.run && p.mx !== 0 && !this.crouching;
    if (this.crouching) {
      this.vx = p.mx * CROUCH_X * this.progression.stats.speed;
      this.vy = 0;
    } else {
      this.vx = p.mx * (this.running ? RUN_X : WALK_X) * this.progression.stats.speed;
      this.vy = p.my * (this.running ? WALK_Y * 1.2 : WALK_Y) * this.progression.stats.speed;
    }
    // 자동 잡기: 경직 중인 적에게 걸어 붙으면
    if (p.mx && !this.running && !this.crouching) {
      for (const b of world.bodies) {
        if (b.team !== 'enemy' || !b.alive || b.z > 0 || !grabCan(b as Grabbed)) continue;
        const dx = b.x - this.x;
        if (Math.sign(dx) === p.mx && Math.abs(dx) < 62 && Math.abs(b.y - this.y) < 14) {
          const gb = b as Grabbed;
          this.grabbed = gb;
          this.grabT = 0;
          this.grabHits = 0;
          grabHold(gb);
          gb.vx = 0;
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
    if (g && grabIsHeld(g)) grabRelease(g, 8);
  }

  private stepGrab(world: WorldView, p: Pad) {
    const g = this.grabbed!;
    this.grabT++;
    this.vx = this.vy = 0;
    if (!g.alive || !grabIsHeld(g)) {
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
        grabRelease(g, 30);
        this.grabbed = null;
        return;
      }
      this.grabHits++;
      this.play('grabknee', world);
      grabHold(g);
    }
  }

  /** 무릎 치기 동안 잡힌 상태 유지 */
  keepHeld() {
    const g = this.grabbed;
    if (g && (g instanceof Fighter ? g.phase === 'hurt' : g.state === 'hurt' || g.state === 'stunned')) grabHold(g);
  }
}

/** 잡을 수 있는 몸: 엔진 Fighter, 또는 적 모듈 Enemy(grabbable·state·set·bindT) */
type Grabbed = Body & { vx: number; grabbable?: boolean; phase?: string; state?: string; set?: (s: string) => void; bindT?: number };

function grabCan(b: Grabbed): boolean {
  if (!b.grabbable) return false;
  if (b instanceof Fighter) return b.phase === 'hurt';
  return (b.state === 'hurt' || b.state === 'stunned') && typeof b.set === 'function';
}
function grabHold(b: Grabbed) {
  if (b instanceof Fighter) b.enter('held');
  else {
    b.set!('bound');
    b.bindT = 9999;
  }
}
function grabIsHeld(b: Grabbed): boolean {
  return b instanceof Fighter ? b.phase === 'held' : b.state === 'bound';
}
function grabRelease(b: Grabbed, ticks: number) {
  if (b instanceof Fighter) b.enter('hurt', ticks);
  else b.bindT = ticks;
}
