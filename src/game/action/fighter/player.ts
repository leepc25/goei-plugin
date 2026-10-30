// 인물 플레이어: 인물 전투·생활 엔진(fighter/core.ts)을 엔진 플레이어 자리에 꽂는다.
// eileen/player.ts(에일린 시험판)를 126명 공용으로 일반화한 것: 그림·설정은 인물 팩(art/charPacks.ts)에서, 이펙트·의자는 action-fx 팩에서.
// 엔진과 맞닿는 곳만 여기서 한다: 입력(Pad → 테스트룸 동작), 위치 동기화, 적에게 맞히기(env.hurt → 적 applyHit), 적에게 맞기(applyHit → core.takeHit),
// 체력·게이지(게임 값), 그리기(바닥 층·몸·이펙트 층·화면 효과). 판정 크기·반응은 테스트룸 값을 게임 적 반응 등급으로 옮긴다.
import { baseOf, derive, type BaseStats, type Derived } from '../../combat/stats';
import type { DebuffKind } from '../../combat/status';
/** 코어가 타격마다 넘기는 꼬리표 */
type HurtOpt = { push?: number; src?: 'ranged' | 'blast' | 'skill' | null; form?: 'body' | 'gun' | 'psi'; el?: string; debuff?: { k: DebuffKind; s: number }; crit?: boolean };
import { Player } from '../engine/player';
import { Fighter } from '../engine/fighter';
import { newAttackId } from '../engine/ids';
import { spr } from '../engine/view';
import { pfont } from '../engine/pxfont';
import { CHAR_K, charFx, type CharArt } from '../art/charPacks';
import type { Body, Hit, HitResult, React, WBox, WorldView } from '../engine/contract';
import type { Pad, Btn } from '../engine/input';
import type { FrameInfo } from '../engine/art';
import { createFighterCore } from './core';
import { seatBody } from './seats';
import { StatusSet } from '../../combat/status';

/** 테스트룸 동작 이름 ↔ 엔진 버튼 */
const PRESS: [Btn, string][] = [
  ['light', 'light'], ['heavy', 'heavy'], ['dodge', 'dodge'], ['block', 'block'], ['shoot', 'shoot'],
  ['skill', 'skill'], ['charge', 'charge'], ['super', 'super'], ['jump', 'jump'], ['weapon', 'weapon'],
  ['combat', 'combat'], ['sit', 'sit'], ['crouch', 'crouch'], ['flee', 'flee'], ['back', 'back'],
  ['left', 'left'], ['right', 'right'], ['up', 'up'], ['down', 'down'],
];
/** 테스트룸 맞음 종류(hurtDummy kind) → 게임 반응. 테스트룸 수치: light 밀림·heavy 휘청·stun 1.4초·launch 띄움·blow 크게 날림·down 넘어뜨림·spike 내리찍음·pull 끌어당김·turn 홱 돌려 밀기 */
const REACT: Record<string, { react: React; push: number; lift: number; strength: 1 | 2 | 3 }> = {
  light: { react: 'flinch', push: 2, lift: 0, strength: 1 },
  heavy: { react: 'stagger', push: 9, lift: 0, strength: 2 },
  stun: { react: 'stagger', push: 5, lift: 0, strength: 2 },
  launch: { react: 'launch', push: 3, lift: 24, strength: 3 },
  blow: { react: 'down', push: 26, lift: 12, strength: 3 },
  down: { react: 'down', push: 12, lift: 6, strength: 3 },
  spike: { react: 'down', push: 4, lift: 0, strength: 3 },
  pull: { react: 'stagger', push: -14, lift: 0, strength: 2 },
  turn: { react: 'stagger', push: 6, lift: 0, strength: 2 },
};

/** 다른 모듈이 붙이는 곳. sfx: 효과음. extraTargets: 전투 몸이 아닌 필드 행위자도 때릴 수 있게 (src/game/world, 엔진 modules가 채운다) */
export const fighterHooks: { sfx: (e: Record<string, unknown>) => void; extraTargets?: () => { body: Body; x: number; y: number; z: number }[] } = { sfx: () => {} };

type Core = ReturnType<typeof createFighterCore>;

export class FighterPlayer extends Player {
  core: Core;
  private world: WorldView | null = null;
  private heldNames = new Set<string>();
  private synced = { x: 0, y: 0 };
  private started = false;
  private lastTickAt = 0;
  private lastFrameAt = 0;
  /** 「조준경 덮개」 유물: 이번 출동 첫 사격을 썼나 */
  private firstShotUsed = false;
  /** 마지막으로 코어에서 받아 온 게이지 (바깥에서 바뀌었는지 보려고) */
  private gaugeSeen = 0;
  /** 방어 게이지 0..100 (사용자 2026-10-25: 방어를 무제한으로 못 하게). 막아낸 공격만큼만 깎이고, 안 맞으면 다시 찬다
   * (막고만 있으면 줄지 않는다). 맞아서 바닥나면 가드가 깨져 잠깐 휘청이고, 40까지 차오를 때까지 다시 못 막는다 */
  guard = 100;
  guardBroken = false;
  /** 마지막으로 게이지가 줄어든 뒤 지난 초 (화면 표시가 이걸 보고 사라진다) */
  guardIdle = 99;
  private guardWait = 0;
  private underFn = (ctx: CanvasRenderingContext2D, camX: number) => this.drawUnder(ctx, camX);

  /** 인물 팩 (그림·설정) */
  readonly art: CharArt;
  /** 기본 능력치(힘민체지정)와 산출 전투 수치 (combat/stats.ts) */
  base: BaseStats;
  stat: Derived;
  /** 능력치에서 나온 최대 체력 (출동 시작 때 progression 이 이 값을 쓴다) */
  baseHp: number;
  constructor(clips: Record<string, FrameInfo[]>, art: CharArt) {
    super(clips);
    this.art = art;
    this.label = art.cfg.name;
    this.base = baseOf(art.cfg.name);
    this.stat = derive(this.base);
    this.baseHp = this.hp = this.hpMax = this.stat.hp;
    // 멈춤(히트스톱)은 테스트룸 코드가 스스로 한다: 엔진이 플레이어에 거는 멈춤은 받지 않는다
    Object.defineProperty(this, 'stop', { get: () => 0, set: () => {}, configurable: true });
    const fx = charFx();
    this.core = createFighterCore({
      A: art.A, IMG: art.IMG, CH: art.cfg, VFX: fx?.VFX ?? {}, CHAIR: fx?.CHAIR ?? {},
      held: this.heldNames,
      K: (y: number) => spr(y) * CHAR_K,
      sfx: (type: string, extra: Record<string, unknown>) => fighterHooks.sfx({ type, ...extra }),
      font: (n: number) => pfont(n).f,
      targets: () => this.targets(),
      // 능력치(본부 출동 stats)·상태 효과 배율 (docs/게임_성장_경제_설계.md 2-2·6장)
      mod: { speed: () => this.speedMul(), sp: () => this.spMul(), cd: () => this.stat.cd },
      // 치명: 플레이어·NPC·적 모두 같은 확률 (10-30)
      crit: () => Math.random() < this.stat.crit, critDmg: () => this.stat.critDmg,
      // 물건 윗면은 이미 그 높이에 있을 때만 땅이다 (아래에서 걸어 들어가면 올라서지 않고 막힌다)
      ground: (x: number, y: number) => { const p = this.platformAt(x, y); return p && this.core.P.z >= p.h - 10 ? p.h : 0; },
      hurt: (t: { body: Body }, dmg: number, kind: string, face: 1 | -1, hitstop: number, o: HurtOpt) => this.hurtTarget(t.body, dmg, kind, face, hitstop, o),
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
  /** 회피 충전: 쓸 수 있는 회피 수 + 다음 하나가 찬 만큼(0~1) */
  get dodgeMeter(): number { const P = this.core.P; return P.dodgeN + (P.dodgeN < P.dodgeMax && P.dodgeCd > 0 ? 1 - Math.max(0, P.dodgeT) / P.dodgeCd : 0); }
  get dodgeMax(): number { return this.core.P.dodgeMax; }
  /** 아이템 쓸 때 몸짓(엔진은 옛 동작 이름 drink·eat·bandage·toss 를 부름): 인물 팩 공통 줄 「26 섭취」로. 던지는 동작은 공통 줄에 없어서 몸짓 없이 효과만(10-30 동작 대조) */
  override play(key: string, world: WorldView): void {
    if (key === 'drink' || key === 'eat' || key === 'bandage') { if (this.core.has('26')) this.core.emote('26', 7); return; }
    if (key === 'toss') return;
    super.play(key, world);
  }
  /** 고유기·충전·필살 피해 배율: NPC만 0.5 (docs/설계_기본피해_표준.md 3장) */
  skillMul = 1;
  get sortY() {
    const p = this.z > 4 ? this.platformAt(this.x, this.y) : null;
    return p && this.z >= p.h - 8 ? p.y1 + 2 : this.y;
  }

  private targets() {
    return this.foes().map((b) => ({ body: b, x: b.x, y: b.y, z: b.z })).concat(this.extraFoes());
  }
  /** 때릴 상대 (주인공: 적 편 몸 전부. AI 대련 상대(src/game/combat)는 주인공 쪽으로 바꾼다) */
  protected foes(): Body[] {
    const w = this.world as (WorldView & { bodies: Body[] }) | null;
    if (!w) return [];
    return w.bodies.filter((b) => b.alive && b.team === 'enemy' && b.hp > 0 && b.kind !== 'bullet');
  }
  /** 전투 몸이 아닌 필드 행위자 (주인공만) */
  protected extraFoes(): { body: Body; x: number; y: number; z: number }[] {
    return fighterHooks.extraTargets?.() ?? [];
  }
  /** AI 쪽에서 쓰는 지금 월드 */
  protected get worldNow(): WorldView | null {
    return this.world;
  }

  /** 이동·회피·점프 속도 배율: 능력치 speed × 상태 효과 */
  protected speedMul(): number {
    return this.stat.speed * (this.progression?.stats.speed ?? 1) * (this.statusMod?.speed() ?? 1);
  }
  /** 필살 게이지 차는 배율: 능력치 charge × 상태 효과 */
  protected spMul(): number {
    return this.stat.sp * (this.progression?.stats.charge ?? 1) * (this.statusMod?.sp() ?? 1);
  }
  /** 상태 효과 (출혈·오염·두통·혼란·공포·둔화·침묵, src/game/combat/status.ts). 적 공격의 debuff 이벤트가 건다 */
  status = new StatusSet();
  /** 상태 효과가 거는 배율 */
  statusMod?: { speed(): number; sp(): number } = { speed: () => this.status.speedMul(), sp: () => this.status.spMul() };

  private hurtTarget(t: Body, dmg: number, kind: string, face: 1 | -1, hitstop: number, o: HurtOpt) {
    const w = this.world as (WorldView & { kills: number; emit(e: unknown): void }) | null;
    if (!w || !t.alive) return;
    const r = REACT[kind] ?? REACT.light;
    // 근접·기술은 힘, 원거리(사격·충전탄·제압사격)는 사격 배율 (폭발은 배율 없음: 엔진 progressionHit 'ability'와 같음)
    const st = this.progression?.stats;
    // 판정 형태로 어느 능력치가 피해를 키울지 (docs/설계_능력치_기술피해_안.md 4장): 몸 = 힘, 총·투척 = 민, 이능 = 지. 꼬리표가 없으면 사격은 총, 나머지는 몸
    const form = o.form ?? (o.src === 'ranged' ? 'gun' : 'body');
    let scale = form === 'gun' ? this.stat.aim * (st?.aim ?? 1) : form === 'psi' ? this.stat.psi : this.stat.power * (st?.power ?? 1);
    if (o.src === 'blast' && !o.form) scale = 1;
    // 에일린 전용 유물 「조준경 덮개」(숙련 8): 출동마다 첫 사격 명중은 치명 ×2
    if (o.src === 'ranged' && !this.firstShotUsed && this.label === '에일린' && this.progression?.relics.includes('own_eileen')) {
      this.firstShotUsed = true;
      scale *= 2;
      w.say('치명!', 0.8);
    }
    const hit: Hit = { x0: t.x - 1, x1: t.x + 1, z0: 0, z1: 400, y: t.y, dy: 999, attackId: newAttackId(), dmg: dmg * this.dmgMul * scale * (o.src === 'skill' ? this.skillMul : 1), react: r.react, dir: face, push: o.push ?? r.push, lift: r.lift, stop: 0, strength: r.strength };
    const res = t.applyHit(hit, w);
    if (res.kind === 'immune') return;
    // 기술 부가효과: 맞은 상대에게 상태 이상 (docs/퍽/기술_부가효과.md). 막았으면 안 걸림. 상대 정신력으로 지속이 줄어듦
    const tf = t as Body & { status?: StatusSet; stat?: Derived };
    if (o.debuff && res.kind !== 'guard' && tf.status) tf.status.apply(o.debuff.k, o.debuff.s > 0 ? o.debuff.s * (tf.stat?.statusDur ?? 1) : undefined);
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
    const m = this.art.A['1'];
    const h = m ? Math.min(m.h - 4, m.floor) - (m.top[0] ?? 14) : 210;
    return { hit: [], hurt: this.alive ? [{ x0: this.x - 26 * k, x1: this.x + 26 * k, z0: this.z, z1: this.z + h * k, y: this.y, dy: 16 }] : [] };
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
    // 경직 저항(poise): 이 값 이하 세기의 공격엔 움찔하지 않는다 (피해는 받음). 세기가 없으면 반응으로 어림한다
    const strength = hit.strength ?? (hit.react === 'down' || hit.react === 'launch' ? 3 : hit.react === 'stagger' ? 2 : 1);
    const armored = this.core.armored() || strength <= (this.progression?.stats.poise ?? 0);
    // 방어(defense): 받는 피해 감소 (가드·무적·부적 뒤 실제 체력 피해에만, 엔진 defendedHit과 같음)
    const taken = hit.dmg * this.stat.taken * (1 - (this.progression?.stats.defense ?? 0)) * (this.core.armored() ? 0.5 : 1);
    this.hp = Math.max(0, this.hp - Math.round(taken));
    world.emit({ type: 'hurt', x: this.x, dmg: taken, hp: this.hp });
    if (!this.lowWarned && this.hp < this.hpMax * 0.3) {
      this.lowWarned = true;
      world.emit({ type: 'hp:low' });
    }
    if (this.hp <= 0) {
      this.core.knock();
      this.phase = 'down';
      return { kind: 'hit', killed: true };
    }
    this.status.onHit();
    if (armored) { this.core.takeHit('hit'); return { kind: 'armor' }; }
    P.face = (Math.sign(hit.dir) === 1 ? -1 : 1) as 1 | -1;
    this.core.takeHit(hit.react === 'down' || hit.react === 'launch' ? 'knock' : 'hit');
    return { kind: 'hit' };
  }

  listen(p: Pad) {
    this.input(p);
  }

  /** 본부 의자 자리(hub.ts seat): 엔진 앉기 클립 대신 테스트룸 앉기(코어 sitAt, 의자 그림·맞춤 chairs/<키>.json 그대로). 조사 키로 일어나 exit 자리로 */
  private coreSeat: { exit: { x: number; y: number } } | null = null;
  /** 코어 의자에 앉아 있나 (hub.ts: 방 의자 그림 숨김) */
  get sitting(): boolean { return !!this.coreSeat; }
  sit(clip: string, x: number, y: number, face: 1 | -1, exit: { x: number; y: number }): boolean {
    const P = this.core.P as unknown as { x: number; y: number; z: number; vx: number; face: 1 | -1; mode: string; seat: unknown };
    const can = ['60', '96', '61'].some((id) => this.core.has(id));
    if (!can || P.mode !== 'ground' || this.z > 0) return super.sit(clip, x, y, face, exit);
    P.x = x; P.y = y; P.z = 0; P.vx = 0; P.face = face;
    this.core.sitAt(clip.includes('side') ? 'side' : clip.includes('back') ? 'back' : 'front');
    if (!P.seat) return super.sit(clip, x, y, face, exit);
    // 지도 의자는 (x, y) 그 자리에 둔다: 사람 발을 이 인물 의자 맞춤값(chairs/<키>.json)만큼 옮긴다 (fighter/seats.ts)
    const seat = P.seat as { dir: string; cx?: number; cy?: number };
    seat.cx = x; seat.cy = y;
    const body = seatBody(x, y, face, this.core.chairFit(seat.dir), spr(y) * CHAR_K);
    P.x = body.x; P.y = body.y;
    this.coreSeat = { exit };
    this.sync();
    return true;
  }
  private coreSeatStep(p: Pad) {
    const P = this.core.P as unknown as { x: number; y: number; mode: string; seat: unknown };
    if (!this.coreSeat) return;
    if (P.mode === 'seat' && (p.pressed.has('interact') || p.pressed.has('sit') || p.pressed.has('jump'))) this.core.rise(false);
    if (!P.seat && P.mode !== 'seatUp') { const e = this.coreSeat.exit; this.coreSeat = null; P.x = e.x; P.y = e.y; this.sync(); }
  }

  private input(p: Pad) {
    const names = this.heldNames;
    names.clear();
    // 혼란: 좌우가 뒤집힌다
    const flip = this.status.flipped();
    const nameOf = (n: string) => (flip && n === 'left' ? 'right' : flip && n === 'right' ? 'left' : n);
    for (const [b, n] of PRESS) if (p.held.has(b)) names.add(nameOf(n));
    if (p.run) names.add('run');
    // 공포: 막지 못한다. 침묵: 기술·필살을 못 쓴다
    if (!this.status.canBlock()) names.delete('block');
    const silenced = !this.status.canSkill();
    if (silenced) { names.delete('skill'); names.delete('super'); }
    // 방어: 게이지가 다 회복되지 않았거나(깨진 뒤 40 미만) 거의 없으면 들어가지 않는다
    if (this.guardBroken || this.guard < 8) names.delete('block');
    // 방향키는 쓰러짐·웅크림·주저앉음일 때만 테스트룸에 넘긴다 (좌우 = 기기, 위 = 일어나기)
    const lying = ['down', 'belly', 'sit', 'scoot', 'crouch', 'crawl4'].includes(this.core.P.mode);
    for (const [b, n0] of PRESS) {
      const n = nameOf(n0);
      if (!p.pressed.has(b) || (silenced && (n === 'skill' || n === 'super'))) continue;
      if ((lying || !['left', 'right', 'up', 'down'].includes(n)) && (n !== 'block' || names.has('block'))) this.core.onPress(n);
    }
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
    this.statusStep(world, 1 / 30);
    this.coreSeatStep(p);
    if (this.coreSeat) { this.heldNames.clear(); this.core.frameView({ x0: w.camX, lane: w.lane }); this.sync(); return; } // 앉아 있는 동안은 일어나기만
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
    this.guardStep(dt);
    this.calmStep(dt);
    const s = this.core.shake;
    if (s > 6) w.shake(2, Math.min(4, s / 6));
    this.sync();
  }

  /** 전투 자세(무기 꺼냄 포함)로 있다가 가까이(700px) 적이 없고 공격·방어 키를 안 누른 채 5초가 지나면
   * 평상 대기로 돌아온다: 무기부터 넣고, 1.5초 뒤 자세를 푼다 (사용자 2026-10-25). 걷기는 상관없다 */
  private calmT = 0;
  private calmHold = false;
  private calmStep(dt: number) {
    const P = this.core.P;
    const acting = [...this.heldNames].some((n) => !['left', 'right', 'up', 'down', 'run'].includes(n));
    const near = this.targets().some((t) => Math.abs(t.x - this.x) < 700);
    if (acting || near || !(P.combat || P.armed)) { this.calmT = 0; this.calmHold = false; return; }
    if (P.mode !== 'ground') { if (!this.calmHold) this.calmT = 0; return; } // 무기 넣는 동작 중에는 시계를 이어 간다
    this.calmT += dt;
    if (this.calmT < 5) return;
    if (P.armed) { this.core.onPress('weapon'); this.calmT = 3.5; this.calmHold = true; return; }
    this.calmT = 0; this.calmHold = false;
    this.core.onPress('combat');
  }

  /** 상태 효과 시간·피해 (엔진 틱마다). 지속 피해로는 쓰러지지 않는다(1 남김). 오염은 최대 체력을 줄인다 */
  private statusStep(world: WorldView, dt: number) {
    if (!this.status.list.length) return;
    const P = this.core.P;
    const dmg = this.status.step(dt, { maxHp: this.hpMax, running: this.running, blocking: P.mode === 'block' });
    if (dmg > 0 && this.hp > 1) this.hp = Math.max(1, this.hp - dmg);
    const cap = this.hpMax * this.status.maxHpRatio();
    if (this.hp > cap) this.hp = cap;
    void world;
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
    // 엔진·아이템이 게이지를 바꿨으면(각성제 등) 먼저 코어 필살 게이지에 넘긴다 (코어 값으로 덮어써서 아이템이 헛돌던 문제)
    if (this.gauge !== this.gaugeSeen) P.sp = Math.max(0, Math.min(100, this.gauge));
    this.gauge = this.gaugeSeen = P.sp;
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
