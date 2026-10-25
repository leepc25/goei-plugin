// 에일린 플레이어: 테스트룸 전투(core.ts, 테스트룸 코드 그대로)를 엔진 플레이어 자리에 꽂는다.
// 엔진과 맞닿는 곳만 여기서 한다: 입력(Pad → 테스트룸 동작), 위치 동기화, 적에게 맞히기(env.hurt → 적 applyHit), 적에게 맞기(applyHit → core.takeHit),
// 체력·게이지(게임 값), 그리기(바닥 층·몸·이펙트 층·화면 효과). 판정 크기·반응은 테스트룸 값을 게임 적 반응 등급으로 옮긴다.
import { Player } from '../engine/player';
import { Fighter } from '../engine/fighter';
import { newAttackId } from '../engine/ids';
import { spr } from '../engine/view';
import { pfont } from '../engine/pxfont';
import { eileenArt } from '../art/testPeople';
import type { Body, Hit, HitResult, React, WBox, WorldView } from '../engine/contract';
import type { Pad, Btn } from '../engine/input';
import type { FrameInfo } from '../engine/art';
import { createEileenCore } from './core';

/** 테스트룸 동작 이름 ↔ 엔진 버튼 */
/** 에일린 그림 배율: 맨 뒤 줄에서 키 1.65m = 235px (필드 그림 지침 1m = 142px) */
export const CHAR_K = 1.15;
/** 테스트룸 동작 이름 ↔ 엔진 버튼 */
const PRESS: [Btn, string][] = [
  ['light', 'light'], ['heavy', 'heavy'], ['dodge', 'dodge'], ['block', 'block'], ['shoot', 'shoot'],
  ['skill', 'skill'], ['charge', 'charge'], ['super', 'super'], ['jump', 'jump'], ['weapon', 'weapon'],
  ['combat', 'combat'], ['sit', 'sit'], ['crouch', 'crouch'], ['flee', 'flee'], ['back', 'back'],
  ['left', 'left'], ['right', 'right'], ['up', 'up'], ['down', 'down'],
];
/** 테스트룸 맞음 종류 → 게임 반응 */
const REACT: Record<string, { react: React; push: number; lift: number; strength: 1 | 2 | 3 }> = {
  light: { react: 'flinch', push: 2, lift: 0, strength: 1 },
  heavy: { react: 'stagger', push: 9, lift: 0, strength: 2 },
  stun: { react: 'stagger', push: 5, lift: 0, strength: 2 },
  launch: { react: 'launch', push: 3, lift: 24, strength: 3 },
  blow: { react: 'down', push: 26, lift: 12, strength: 3 },
  spike: { react: 'down', push: 4, lift: 0, strength: 3 },
};

/** 다른 모듈이 붙이는 곳: 소리 */
export const eileenHooks: { sfx: (e: Record<string, unknown>) => void } = { sfx: () => {} };

type Core = ReturnType<typeof createEileenCore>;

export class EileenPlayer extends Player {
  core: Core;
  private world: WorldView | null = null;
  private heldNames = new Set<string>();
  private synced = { x: 0, y: 0 };
  private started = false;
  private lastTickAt = 0;
  private lastFrameAt = 0;
  /** 방어 게이지 0..100 (사용자 2026-10-25: 방어를 무제한으로 못 하게). 막아낸 공격만큼만 깎이고, 안 맞으면 다시 찬다
   * (막고만 있으면 줄지 않는다). 맞아서 바닥나면 가드가 깨져 잠깐 휘청이고, 40까지 차오를 때까지 다시 못 막는다 */
  guard = 100;
  guardBroken = false;
  /** 마지막으로 게이지가 줄어든 뒤 지난 초 (화면 표시가 이걸 보고 사라진다) */
  guardIdle = 99;
  private guardWait = 0;
  private underFn = (ctx: CanvasRenderingContext2D, camX: number) => this.drawUnder(ctx, camX);

  constructor(clips: Record<string, FrameInfo[]>) {
    super(clips);
    this.label = '에일린';
    // 멈춤(히트스톱)은 테스트룸 코드가 스스로 한다: 엔진이 플레이어에 거는 멈춤은 받지 않는다
    Object.defineProperty(this, 'stop', { get: () => 0, set: () => {}, configurable: true });
    const art = eileenArt()!;
    this.core = createEileenCore({
      A: art.A, IMG: art.IMG, VFX: art.VFX,
      held: this.heldNames,
      K: (y: number) => spr(y) * CHAR_K,
      sfx: (type: string, extra: Record<string, unknown>) => eileenHooks.sfx({ type, ...extra }),
      font: (n: number) => pfont(n).f,
      targets: () => this.targets(),
      // 물건 윗면은 이미 그 높이에 있을 때만 땅이다 (아래에서 걸어 들어가면 올라서지 않고 막힌다)
      ground: (x: number, y: number) => { const p = this.platformAt(x, y); return p && this.core.P.z >= p.h - 10 ? p.h : 0; },
      hurt: (t: { body: Body }, dmg: number, kind: string, face: 1 | -1, hitstop: number, o: { push?: number }) => this.hurtTarget(t.body, dmg, kind, face, hitstop, o),
      clamp: (P: { x: number; y: number }) => {
        const w = this.world;
        if (!w) return;
        P.y = Math.max(w.lane[0], Math.min(w.lane[1], P.y));
        P.x = Math.max(w.bounds[0] + 30, Math.min(w.bounds[1] - 30, P.x));
      },
    });
  }

  /** 발 자리 아래 올라설 물건 (데스크 등) */
  private platformAt(x: number, y: number) {
    const ps = (this.world?.floor as { platforms?: { x0: number; x1: number; y0: number; y1: number; h: number }[] } | undefined)?.platforms;
    let best: { x0: number; x1: number; y0: number; y1: number; h: number } | null = null;
    for (const p of ps ?? []) if (x >= p.x0 && x <= p.x1 && y >= p.y0 - 4 && y <= p.y1 + 4 && (!best || p.h > best.h)) best = p;
    return best;
  }
  /** 그리는 순서용 깊이: 물건 위에 서 있으면 그 물건 앞 모서리보다 앞으로 */
  get sortY() {
    const p = this.z > 4 ? this.platformAt(this.x, this.y) : null;
    return p && this.z >= p.h - 8 ? p.y1 + 2 : this.y;
  }

  private targets() {
    const w = this.world as (WorldView & { bodies: Body[] }) | null;
    if (!w) return [];
    return w.bodies.filter((b) => b.alive && b.team === 'enemy' && b.hp > 0 && b.kind !== 'bullet').map((b) => ({ body: b, x: b.x, y: b.y, z: b.z }));
  }

  private hurtTarget(t: Body, dmg: number, kind: string, face: 1 | -1, hitstop: number, o: { push?: number }) {
    const w = this.world as (WorldView & { kills: number; emit(e: unknown): void }) | null;
    if (!w || !t.alive) return;
    const r = REACT[kind] ?? REACT.light;
    const hit: Hit = { x0: t.x - 1, x1: t.x + 1, z0: 0, z1: 400, y: t.y, dy: 999, attackId: newAttackId(), dmg: dmg * this.dmgMul, react: r.react, dir: face, push: o.push ?? r.push, lift: r.lift, stop: 0, strength: r.strength };
    const res = t.applyHit(hit, w);
    if (res.kind === 'immune') return;
    // 맞은 적은 테스트룸 멈춤만큼 멈춘다
    t.stop = Math.max(t.stop, Math.round(Math.max(hitstop, kind === 'light' ? 0.085 : 0.16) * 30));
    this.combo = this.comboClock > 0 ? this.combo + 1 : 1;
    this.comboClock = 40;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (res.killed) {
      w.kills++;
      if (t.team === 'enemy' && !(t instanceof Fighter)) w.emit({ type: 'enemyDie', x: t.x, kind: t.kind });
    }
  }

  /* ───────── 엔진 쪽 ───────── */

  frame(): { hit: Hit[]; hurt: WBox[] } {
    const k = spr(this.y) * CHAR_K;
    return { hit: [], hurt: this.alive ? [{ x0: this.x - 26 * k, x1: this.x + 26 * k, z0: this.z, z1: this.z + 210 * k, y: this.y, dy: 16 }] : [] };
  }

  applyHit(hit: Hit, world: WorldView): HitResult {
    const P = this.core.P;
    if (P.inv > 0 || this.invuln > 0) { this.core.takeHit('hit'); return { kind: 'immune' }; }
    if (P.mode === 'down' || P.mode === 'belly' || this.phase === 'down') return { kind: 'immune' };
    const front = hit.dir === -P.face;
    if (P.mode === 'block' && front) {
      this.spendGuard(14 + hit.dmg * 0.6);
      if (this.guardBroken) {
        // 가드 브레이크: 막던 자세가 깨지고 잠깐 휘청인다
        this.core.onRelease('block');
        this.core.stun();
        P.stunT = 1.1;
        world.emit({ type: 'guard', x: this.x });
        return { kind: 'hit' };
      }
      this.core.takeHit('hit');
      this.hp = Math.max(1, this.hp - Math.round(hit.dmg * 0.1));
      world.emit({ type: 'guard', x: this.x });
      return { kind: 'guard' };
    }
    if (this.ward > 0 && hit.dmg > 0) {
      this.ward--;
      this.invuln = 20;
      world.say('부적이 대신 맞았다', 1);
      return { kind: 'immune' };
    }
    const armored = this.core.armored();
    this.hp = Math.max(0, this.hp - (armored ? Math.round(hit.dmg * 0.5) : hit.dmg));
    world.emit({ type: 'hurt', x: this.x, dmg: hit.dmg, hp: this.hp });
    if (!this.lowWarned && this.hp < this.hpMax * 0.3) {
      this.lowWarned = true;
      world.emit({ type: 'hp:low' });
    }
    if (this.hp <= 0) {
      this.core.knock();
      this.phase = 'down';
      return { kind: 'hit', killed: true };
    }
    if (armored) { this.core.takeHit('hit'); return { kind: 'armor' }; }
    P.face = (Math.sign(hit.dir) === 1 ? -1 : 1) as 1 | -1;
    this.core.takeHit(hit.react === 'down' || hit.react === 'launch' ? 'knock' : 'hit');
    return { kind: 'hit' };
  }

  listen(p: Pad) {
    this.input(p);
  }

  private input(p: Pad) {
    const names = this.heldNames;
    names.clear();
    for (const [b, n] of PRESS) if (p.held.has(b)) names.add(n);
    if (p.run) names.add('run');
    // 방어: 게이지가 다 회복되지 않았거나(깨진 뒤 40 미만) 거의 없으면 들어가지 않는다
    if (this.guardBroken || this.guard < 8) names.delete('block');
    // 방향키는 쓰러짐·웅크림·주저앉음일 때만 테스트룸에 넘긴다 (좌우 = 기기, 위 = 일어나기)
    const lying = ['down', 'belly', 'sit', 'scoot', 'crouch', 'crawl4'].includes(this.core.P.mode);
    for (const [b, n] of PRESS) if (p.pressed.has(b) && (lying || !['left', 'right', 'up', 'down'].includes(n)) && (n !== 'block' || names.has('block'))) this.core.onPress(n);
    if (p.evade) this.core.onPress('dodge');
    for (const b of ['block', 'charge'] as Btn[]) if (p.released.has(b)) this.core.onRelease(b);
  }

  tick(world: WorldView, p: Pad) {
    this.world = world;
    const w = world as WorldView & { underlays: ((c: CanvasRenderingContext2D, camX: number) => void)[]; camX: number };
    if (!w.underlays.includes(this.underFn)) w.underlays.push(this.underFn);
    if (this.seat) return super.tick(world, p);
    const P = this.core.P;
    // 엔진이 옮긴 만큼(문 앞 도착·막힘·화면 끝)만 받는다: 틱 사이에 그림 장마다 움직인 것은 그대로 둔다
    if (!this.started) { this.started = true; P.x = this.x; P.y = this.y; }
    else { P.x += this.x - this.synced.x; P.y += this.y - this.synced.y; }
    P.hp = Math.round((this.hp / this.hpMax) * 100);
    this.lastTickAt = performance.now();
    this.wantInteract = p.pressed.has('interact');
    this.wantItem = p.pressed.has('item1') ? 1 : p.pressed.has('item2') ? 2 : p.pressed.has('item3') ? 3 : p.pressed.has('item4') ? 4 : 0;
    if (this.comboClock > 0 && --this.comboClock === 0) this.combo = 0;
    if (this.phase !== 'down') this.input(p); // 쓰러지면 후송을 기다린다
    this.core.frameView({ x0: w.camX, lane: w.lane });
    this.sync();
  }

  /** 그림 장마다 (render.ts): 테스트룸처럼 실제 시간으로 움직이고 동작을 넘긴다.
   * 엔진 틱(30Hz)에서 1/30초씩 돌리면 0.04초짜리 장이 0.067초로 늘고 움직임이 30장으로 끊긴다 (사용자: 테스트룸보다 프레임이 떨어져 보임) */
  frameStep() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - (this.lastFrameAt || now)) / 1000);
    this.lastFrameAt = now;
    // 월드가 멈춰 있으면(메뉴·대화창) 같이 멈춘다
    if (!this.world || this.seat || now - this.lastTickAt > 120 || dt <= 0) return;
    const w = this.world as WorldView & { camX: number };
    const P = this.core.P;
    P.x += this.x - this.synced.x; P.y += this.y - this.synced.y; // 틱 뒤 막힘·끝 보정
    this.core.frameView({ x0: w.camX, lane: w.lane });
    this.core.update(dt);
    this.core.tickMarks(dt);
    this.guardStep(dt);
    const s = this.core.shake;
    if (s > 6) w.shake(2, Math.min(4, s / 6));
    this.sync();
  }

  private spendGuard(n: number) {
    this.guard = Math.max(0, this.guard - n);
    this.guardWait = 0.8;
    this.guardIdle = 0;
    if (this.guard <= 0) this.guardBroken = true;
  }

  /** 마지막으로 막아낸 뒤 0.8초가 지나면 초당 35씩 찬다 (막는 중이어도) */
  private guardStep(dt: number) {
    this.guardIdle += dt;
    if (this.guardWait > 0) { this.guardWait -= dt; return; }
    this.guard = Math.min(100, this.guard + 35 * dt);
    if (this.guardBroken && this.guard >= 40) this.guardBroken = false;
  }

  private sync() {
    const P = this.core.P;
    this.x = P.x; this.y = P.y; this.z = P.z;
    this.px = this.x; this.py = this.y; this.pz = this.z; // 보간 없이 지금 자리 (장마다 움직인다)
    this.synced.x = this.x; this.synced.y = this.y;
    this.dir = P.face > 0 ? 1 : -1;
    this.gauge = P.sp;
    this.running = this.core.P.mode === 'ground' && this.heldNames.has('run');
  }

  /* ───────── 그리기 (render.ts가 부른다) ───────── */

  private drawUnder(ctx: CanvasRenderingContext2D, camX: number) {
    this.core.frameView({ x0: camX, lane: this.world?.lane ?? [440, 669] });
    ctx.save(); ctx.translate(-camX, 0); this.core.drawUnder(ctx); ctx.restore();
  }
  /** 몸 (x,y = 화면 좌표 발 자리: 보간된 값이라 테스트룸 P 대신 이것을 쓴다) */
  drawSelf(ctx: CanvasRenderingContext2D, camX: number) {
    ctx.save(); ctx.translate(-camX, 0); ctx.imageSmoothingEnabled = false; this.core.drawBody(ctx); ctx.restore();
  }
  drawFxLayer(ctx: CanvasRenderingContext2D, camX: number) {
    this.core.frameView({ x0: camX, lane: this.world?.lane ?? [440, 669] });
    ctx.save(); ctx.translate(-camX, 0); ctx.imageSmoothingEnabled = false; this.core.drawFxLayer(ctx); ctx.restore();
  }
  drawScreen(ctx: CanvasRenderingContext2D) {
    this.core.drawScreen(ctx);
  }
}
