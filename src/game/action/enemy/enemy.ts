// 적 몸 하나 (엔진 Body). 상태 기계 공통 부분: 등장 → 생각(brain) → 공격 동작(장별 판정) → 피격 반응(부록 E.1·E.2) → 다운·기상 → 죽음·드랍.
// 적마다 다른 행동은 brains.ts의 Brain이 맡는다 (ai.ts 일반 적, guardians.ts 수호자).
import { toWorld } from './geom';
import { newBodyId, bumpBodyIds, newAttackId } from '../engine/ids';
export { newAttackId } from '../engine/ids';
import { PROJ, Proj } from './proj';
import type { AiKind, EnemyDef } from './roster';
import type { Armor, Body, Debuff, FrameBoxes, Hit, HitResult, LocalBox, Move, Part, PartBox, RuleSignal, WBox, WorldView } from './types';
import { rollDrops, fireDropHook } from './drops';
import { armDebuff, checkDebuffs } from './debuff';
import { drawFigure, drawSwing } from './look';
import { drawAilments } from '../ui/ailments';
import { STATUS, StatusSet } from '../../combat/status';
import { PIXEL_FONT, kitPiece, kitSlice, nine } from '../ui/kit';

export type St = 'spawn' | 'idle' | 'walk' | 'attack' | 'hurt' | 'air' | 'down' | 'getup' | 'bound' | 'grabbing' | 'dormant' | 'hidden' | 'flee' | 'dead' | 'stunned';
export type Affix = 'bleed' | 'armor' | 'fast' | 'regen';
export const AFFIX_LABEL: Record<Affix, string> = { bleed: '출혈', armor: '경 아머', fast: '빠름', regen: '재생' };

export interface HitMod {
  mult?: number;
  immune?: boolean;
  /** 정면 막기 (피해 배율은 mult) */
  guard?: boolean;
  weak?: boolean;
  /** 반응 무시 (피해만) */
  noReact?: boolean;
  text?: string;
}

export interface Brain {
  /** 매 틱 가장 먼저. true를 돌려주면 공통 처리(생각·이동)를 건너뛴다 */
  tick?(e: Enemy, w: WorldView): boolean | void;
  /** 자유로울 때(대기·이동) 무엇을 할지 */
  think?(e: Enemy, w: WorldView): void;
  hit?(e: Enemy, hit: Hit, part: Part | undefined, w: WorldView): HitMod | void;
  after?(e: Enemy, w: WorldView, dmg: number): void;
  ev?(e: Enemy, name: string, w: WorldView): void;
  signal?(e: Enemy, s: RuleSignal, w: WorldView): void;
  /** 이 틱 피격 상자를 바꾼다 (숨음·천장 등). null이면 없음 */
  hurt?(e: Enemy, w: WorldView | null): LocalBox[] | null | void;
  /** 배경 쪽 (틈새 등): 몸들보다 먼저 그린다. 엔진은 Enemy.drawBack을 부른다 */
  drawBack?(e: Enemy, ctx: CanvasRenderingContext2D): void;
  drawUnder?(e: Enemy, ctx: CanvasRenderingContext2D): void;
  drawOver?(e: Enemy, ctx: CanvasRenderingContext2D): void;
  death?(e: Enemy, w: WorldView): void;
  /** 동작 밖의 공격 상자 (손전등·만지는 손 등) */
  hits?(e: Enemy): Hit[];
}

export const REACT_RANK: Record<Hit['react'], number> = { none: 0, flinch: 1, stagger: 2, launch: 2, down: 3, bind: 3 };

/** 같은 세계에서 몸을 다시 만들 때(불러오기) id 겹침 방지 */
export const bumpIds = bumpBodyIds;

const still = new WeakMap<object, { x: number; y: number; tick: number; n: number }>();
/** 플레이어가 움직이지 않은 틱 수 (어둠의 층 체온, 그림자·얼룩) */
export function stillTicks(w: WorldView): number {
  const p = w.player;
  let s = still.get(p);
  if (!s) still.set(p, (s = { x: p.x, y: p.y, tick: w.tick, n: 0 }));
  if (s.tick !== w.tick) {
    const moved = Math.abs(p.x - s.x) + Math.abs(p.y - s.y) > 0.5 || p.airborne;
    s.n = moved ? 0 : s.n + (w.tick - s.tick);
    s.x = p.x;
    s.y = p.y;
    s.tick = w.tick;
  }
  return s.n;
}

export class Enemy implements Body {
  readonly id = newBodyId();
  readonly team = 'enemy' as const;
  readonly kind: string;
  label: string;
  x: number;
  y: number;
  z = 0;
  dir: 1 | -1 = -1;
  hp: number;
  hpMax: number;
  alive = true;
  stop = 0;
  grabbable: boolean;
  boss: boolean;
  vx = 0;
  vy = 0;
  vz = 0;
  state: St = 'spawn';
  /** 지금 상태에 머문 틱 */
  st = 0;
  /** 살아 있은 틱 */
  age = 0;
  move: Move | null = null;
  mf = 0;
  atk = 0;
  cds: Record<string, number> = {};
  stunT = 0;
  bindT = 0;
  launches = 0;
  inv = 0;
  flash = 0;
  armorBase: Armor;
  affixes: Affix[] = [];
  elite = false;
  /** 과장님 호명 버프 남은 틱 */
  rally = 0;
  slow = 0;
  /** 상태 이상 (플레이어 기술 부가효과·퍽이 건다, src/game/combat/status.ts) */
  status = new StatusSet();
  /** 벽꽝 추가 피해(최대 체력 비율, 퍽 「벽꽝 강화」 0.15) · 다운 전 띄우기 횟수(퍽 「공중 사냥」 3) */
  wallDmg = 0.06;
  maxLaunch = 2;
  /** 공격 간격 배수 (퍽 「방 안이 먼저 지친다」) · 공격 끝난 뒤 쉬는 틱(두통·지침) */
  perkGap = 1;
  restT = 0;
  /** 기상 지연 틱 (퍽 「바닥 차갑지?」·「얼어붙은 발」) */
  wakeExtra = 0;
  /** 0~1 보이는 정도 (발소리·소리와 냄새) */
  alpha = 1;
  /** 그로기 게이지 (수호자) */
  groggy = 0;
  groggyMax = 0;
  phase = 1;
  /** 규칙 약점이 열렸나 (흰 삼각, 피해 2배·아머 무시) */
  weakOpen = 0;
  /** 마지막으로 맞은 틱 */
  lastHurt = -999;
  /** 잡고 있는 동안 */
  grabT = 0;
  grabEvery = 15;
  grabDmg = 0;
  grabHitId = 0;
  /** 바깥에 보이는 한 줄 (말풍선) */
  bubble = '';
  bubbleT = 0;
  hostile = true;
  /** brain 기억 */
  mem: Record<string, any> = {};
  /** 깊이 대기 줄 (둘러싸기) */
  laneOff = 0;
  wave = 0;
  deadT = 0;
  hitBy = new Set<number>();
  readonly def: EnemyDef;
  brain: Brain;
  /** 발사체 피해 배율 (호명·정예) */
  get power(): number {
    return (this.rally > 0 ? 1.25 : 1) * (this.elite ? 1.2 : 1);
  }

  constructor(def: EnemyDef, x: number, y: number, brain: Brain, opts: { elite?: boolean; affixes?: Affix[]; rand?: () => number } = {}) {
    this.def = def;
    this.kind = def.kind;
    this.label = def.label;
    this.x = x;
    this.y = y;
    this.z = def.hover ?? 0;
    this.hp = this.hpMax = def.hp;
    this.grabbable = def.grabbable;
    this.boss = false;
    this.armorBase = def.armor;
    this.brain = brain;
    const r = opts.rand ?? (() => 0.5);
    this.laneOff = (r() - 0.5) * 80;
    if (opts.elite) {
      this.elite = true;
      this.affixes = opts.affixes ?? [];
      this.hp = this.hpMax = Math.round(def.hp * 1.6);
      this.label = '정예 ' + def.label;
    }
  }

  get ai(): AiKind {
    return this.def.ai;
  }
  has(a: Affix) {
    return this.affixes.includes(a);
  }
  speed(): number {
    return this.def.speed * (this.has('fast') ? 1.35 : 1) * (this.rally > 0 ? 1.3 : 1) * (this.slow > 0 ? 0.6 : 1) * this.status.speedMul();
  }
  set(s: St) {
    if (this.state !== s) (this.state = s), (this.st = 0);
  }
  say(text: string, ticks = 60) {
    this.bubble = text;
    this.bubbleT = ticks;
  }
  face(x: number) {
    if (Math.abs(x - this.x) > 4) this.dir = x > this.x ? 1 : -1;
  }
  cd(id: string): number {
    return this.cds[id] ?? 0;
  }

  /** 공격 시작. 예고 장이 있으면 enemyTell/bossTell을 낸다 */
  start(move: Move, w: WorldView, cd = 0) {
    // 침묵: 특수기(쿨 있는 기술)를 못 쓴다
    if (cd && this.status.has('silence')) { this.restT = 15; return; }
    cd *= this.status.attackGap() * this.perkGap;
    this.move = move;
    // 혼란: 엉뚱한 쪽으로 휘두른다 (퍽 「제 편 때리기」면 다른 적이 맞음)
    if (this.status.has('confuse')) this.dir = (this.dir === 1 ? -1 : 1);
    this.mf = 0;
    this.atk = newAttackId(move.specs.length);
    this.mem.last = move.id;
    this.set('attack');
    if (cd) this.cds[move.id] = Math.round(cd * (this.has('fast') ? 0.7 : 1));
    if (move.frames[0]?.tele) w.emit({ type: this.boss ? 'bossTell' : 'enemyTell', x: this.x, kind: this.kind });
  }
  frameNow(): FrameBoxes | null {
    return this.state === 'attack' && this.move ? (this.move.frames[this.mf] ?? null) : null;
  }

  /** 지금 몸 기준 피격 상자 */
  localHurt(w: WorldView | null = null): LocalBox[] {
    const o = this.brain.hurt?.(this, w);
    if (o !== undefined) return o ?? [];
    if (this.state === 'dead' || this.state === 'down' || this.state === 'getup' || this.state === 'spawn' || this.inv > 0) return [];
    const f = this.frameNow();
    if (f) return f.inv ? [] : f.hurt;
    if (this.state === 'air') return this.def.body.map((b) => ({ ...b, z1: b.z0 + (b.z1 - b.z0) * 0.7 }));
    return this.def.body;
  }

  frame(): { hit: Hit[]; hurt: WBox[] } {
    const hurt = this.localHurt().map((b) => toWorld(b, this.x, this.y, this.z, this.dir));
    const hit: Hit[] = [];
    const f = this.frameNow();
    if (f && this.move && f.hit.length) {
      const spec = this.move.specs[f.spec ?? 0];
      for (const b of f.hit) {
        const wb = toWorld(b, this.x, this.y, this.z, this.dir);
        const h: Hit & { debuff?: Debuff } = {
          ...wb,
          attackId: this.atk + (f.spec ?? 0),
          dmg: Math.round(spec.dmg * this.power),
          react: spec.react,
          dir: this.dir,
          push: spec.push,
          lift: spec.lift,
          stop: spec.stop,
          low: spec.low,
          grab: !!spec.grab,
          armorBreak: spec.unblockable,
          strength: spec.strength,
          noise: spec.noise,
        };
        const debuff = spec.debuff ?? (this.has('bleed') && spec.dmg > 0 ? { kind: 'bleed' as const, ticks: 120 } : undefined);
        if (debuff) {
          h.debuff = debuff;
          armDebuff(h, debuff, this.id);
        }
        hit.push(h);
      }
    }
    const extra = this.brain.hits?.(this);
    if (extra) hit.push(...extra);
    if (this.state === 'grabbing' && this.grabHitId) {
      hit.push({ ...this.grabBox, attackId: this.grabHitId, dmg: this.grabDmg, react: 'none', dir: this.dir, grab: true, armorBreak: true, stop: 1, strength: 1 });
    }
    return { hit, hurt };
  }
  grabBox: WBox = { x0: 0, x1: 0, z0: 0, z1: 0, y: 0 };

  private lastTick = -1;
  step(w: WorldView): void {
    if (!this.alive || this.lastTick === w.tick) return;
    this.lastTick = w.tick;
    checkDebuffs(w);
    this.age++;
    this.st++;
    for (const k in this.cds) if (this.cds[k] > 0) this.cds[k]--;
    if (this.flash > 0) this.flash--;
    if (this.inv > 0) this.inv--;
    if (this.rally > 0) this.rally--;
    if (this.slow > 0) this.slow--;
    if (this.weakOpen > 0) this.weakOpen--;
    if (this.bubbleT > 0 && --this.bubbleT === 0) this.bubble = '';
    if (this.state === 'dead') {
      if (++this.deadT > 24) this.alive = false;
      return;
    }
    // 상태 이상: 출혈 지속 피해(쓰러뜨리지는 않음, 1 남김)·오염 최대 체력
    if (this.status.list.length) {
      const d = this.status.step(1 / 30, { maxHp: this.hpMax });
      if (d > 0 && this.hp > 1) this.hp = Math.max(1, this.hp - d);
      const cap = this.hpMax * this.status.maxHpRatio();
      if (this.hp > cap) this.hp = cap;
    }
    if (this.has('regen') && this.age - this.lastHurt > 90 && this.hp < this.hpMax) this.hp = Math.min(this.hpMax, this.hp + this.hpMax * 0.003);
    stillTicks(w);
    if (this.state === 'spawn' && this.st >= 12) this.set('idle');

    const skip = this.brain.tick?.(this, w) === true;
    if (!skip) this.common(w);
    this.physics(w);
  }

  private common(w: WorldView) {
    switch (this.state) {
      case 'spawn':
        if (this.st >= 12) this.set('idle');
        break;
      case 'hurt':
      case 'stunned':
        if (--this.stunT <= 0) this.set('idle');
        break;
      case 'down':
        if (this.st >= (this.mem.downFor ?? 30) + this.wakeExtra) (this.set('getup'), (this.launches = 0), (this.wakeExtra = 0));
        break;
      case 'getup':
        if (this.st >= 12) ((this.inv = 10), this.set('idle'));
        break;
      case 'bound':
        if (--this.bindT <= 0) this.set('idle');
        break;
      case 'grabbing':
        this.holdGrab(w);
        break;
      case 'attack':
        this.runMove(w);
        break;
      case 'idle':
      case 'walk':
        if (this.restT > 0) { this.restT--; break; }
        // 공포: 플레이어에게서 물러난다 · 혼란: 갈피 없이 오락가락
        if (this.status.has('fear')) { this.face(w.player.x); this.x -= this.dir * this.speed(); this.set('walk'); break; }
        if (this.status.has('confuse') && this.age % 60 < 30) { this.x += Math.sin(this.age * 0.15) * this.speed(); this.set('walk'); break; }
        this.brain.think?.(this, w);
        break;
    }
  }

  private runMove(w: WorldView) {
    const m = this.move;
    if (!m) return this.set('idle');
    const f = m.frames[this.mf];
    if (!f) return this.endMove();
    if (f.vx) this.x += f.vx * this.dir * (this.has('fast') ? 1.15 : 1);
    if (f.vz) ((this.vz = f.vz), (this.mem.cling = false));
    if (f.fire && this.mf === firstIndex(m, this.mf, 'fire')) this.fire(f.fire, w);
    if (f.ev && this.mf === firstIndex(m, this.mf, 'ev')) this.brain.ev?.(this, f.ev, w);
    // 잡기: 손 상자가 플레이어 몸에 닿으면 붙잡는다 (발 거리 + 상대 상태, E.2.1)
    const spec = f.hit.length ? m.specs[f.spec ?? 0] : null;
    if (spec?.grab && this.state === 'attack') {
      const p = w.player;
      const free = p.alive && !p.airborne && !/evade|down|dead|grabbed|getup/.test(p.state);
      if (free && Math.abs(p.y - this.y) < 26) {
        const hit = this.frame().hit;
        const hurt = p.frame().hurt;
        if (hit.some((h) => hurt.some((b) => h.x0 < b.x1 && b.x0 < h.x1 && h.z0 < b.z1 && b.z0 < h.z1))) return this.beginGrab(spec.grab, w);
      }
    }
    if (this.state !== 'attack') return;
    this.mf++;
    if (this.mf >= m.frames.length) this.endMove();
  }
  endMove() {
    this.move = null;
    this.mf = 0;
    this.set('idle');
    // 두통(×1.25)·방 지침: 공격 사이를 그만큼 더 쉰다
    const g = this.status.attackGap() * this.perkGap;
    if (g > 1) this.restT = Math.round(40 * (g - 1));
  }
  private beginGrab(g: { ticks: number; dmgPerTick: number; every?: number }, w: WorldView) {
    this.set('grabbing');
    this.grabT = g.ticks;
    this.grabEvery = g.every ?? 10;
    this.grabDmg = Math.max(1, Math.round(g.dmgPerTick * this.grabEvery * this.power));
    this.grabHitId = newAttackId();
    this.mem.grabbedAt = w.tick;
    w.emit({ type: 'custom', name: 'enemyGrab', data: { id: this.id, kind: this.kind, ticks: g.ticks } });
  }
  private holdGrab(w: WorldView) {
    const p = w.player;
    this.face(p.x);
    this.grabBox = { x0: p.x - 12, x1: p.x + 12, z0: p.z + 40, z1: p.z + 120, y: p.y, dy: 30 };
    if (this.st % this.grabEvery === 0) this.grabHitId = newAttackId();
    if (--this.grabT <= 0 || !p.alive) this.releaseGrab(w);
  }
  releaseGrab(w: WorldView | null) {
    if (this.state !== 'grabbing') return;
    this.grabHitId = 0;
    w?.emit({ type: 'custom', name: 'enemyRelease', data: { id: this.id } });
    this.cds.grabRest = 30;
    this.set('stunned');
    this.stunT = 14;
  }

  fire(name: string, w: WorldView, opts: { x?: number; y?: number; dir?: 1 | -1 } = {}) {
    const d = PROJ[name];
    if (!d) return;
    const x = d.grow || d.speed === 0 ? (opts.x ?? this.x) : (opts.x ?? this.x + this.dir * (this.def.w * 0.5));
    const y = opts.y ?? (name === 'beam' ? w.player.y : this.y);
    const p = new Proj(d, name, x, y, opts.dir ?? this.dir, this.id, newAttackId(), this.power);
    if (name === 'shard') p.z = this.z;
    w.add(p);
    if (name === 'bullet') w.emit({ type: 'custom', name: 'enemyShot', data: { x: this.x } });
  }

  private physics(w: WorldView) {
    const [bx0, bx1] = w.bounds;
    const [ly0, ly1] = w.lane;
    if (this.state === 'hurt' || this.state === 'air' || this.state === 'stunned') {
      this.x += this.vx;
      this.vx *= 0.82;
      // 벽 충돌: 강하게 밀려 벽에 닿으면 추가 피해 + 다운 (E.1)
      if ((this.x < bx0 + 20 || this.x > bx1 - 20) && Math.abs(this.vx) > 7 && !this.mem.wallHit) {
        this.mem.wallHit = true;
        this.hp -= Math.round(this.hpMax * this.wallDmg);
        this.vx = -this.vx * 0.3;
        w.fx('spark-big', this.x, this.y, 80);
        w.shake(5, 3);
        if (this.hp <= 0) return this.die(w);
        if (this.state !== 'air') ((this.vz = 6), this.set('air'));
      }
    } else this.vx = 0;
    if (!this.mem.cling && (this.state === 'air' || this.z > (this.def.hover ?? 0) || this.vz)) {
      if (this.state !== 'attack' || this.vz) {
        this.z += this.vz;
        this.vz -= 1.1;
        const floor = this.def.hover ?? 0;
        if (this.z <= floor) {
          this.z = floor;
          this.vz = 0;
          if (this.state === 'air') {
            this.mem.wallHit = false;
            w.fx('dust', this.x, this.y, 0);
            this.set('down');
            this.mem.downFor = 30;
            w.emit({ type: 'down', x: this.x, who: 'enemy' });
          }
        }
      }
    }
    if (this.state !== 'flee' && this.state !== 'hidden' && this.age > 30) this.x = Math.max(bx0 + 10, Math.min(bx1 - 10, this.x));
    this.y = Math.max(ly0, Math.min(ly1, this.y));
  }

  applyHit(hit: Hit, w: WorldView): HitResult {
    if (!this.alive || this.state === 'dead' || this.state === 'spawn' || this.inv > 0) return { kind: 'immune' };
    if (this.hitBy.has(hit.attackId)) return { kind: 'immune' };
    this.hitBy.add(hit.attackId);
    if (this.hitBy.size > 24) this.hitBy.delete(this.hitBy.values().next().value as number);
    const hurt = this.localHurt(w).map((b) => toWorld(b, this.x, this.y, this.z, this.dir));
    const part = pickPart(hurt, hit);
    const mod = this.brain.hit?.(this, hit, part, w) ?? {};
    if (mod.immune) {
      if (mod.text) w.fx('text', this.x, this.y, this.def.h + 20, mod.text);
      return { kind: 'immune' };
    }
    const front = hit.dir === -this.dir;
    let mult = mod.mult ?? 1;
    let guard = !!mod.guard;
    // 방패 역할: 정면 막기 (문틀이 된 등은 반만 들어간다)
    if (!guard && this.def.role === 'shield' && front && !hit.armorBreak && !hit.grab && this.state !== 'hurt' && this.state !== 'air') {
      guard = true;
      mult *= this.kind === 'doorframe' ? 0.5 : 0.1;
    }
    const weak = !!mod.weak || this.weakOpen > 0;
    if (weak) mult *= 2;
    const dmg = Math.max(1, Math.round(hit.dmg * mult));
    this.hp -= dmg;
    this.lastHurt = this.age;
    this.flash = 6;
    if (weak) w.fx('text', this.x, this.y, this.def.h + 30, mod.text ?? '약점');
    this.brain.after?.(this, w, dmg);
    if (this.groggyMax && this.state !== 'stunned' && this.hp > 0) {
      this.groggy += dmg;
      if (this.groggy >= this.groggyMax) {
        // 그로기: 2초간 아머 없음 (E.2 수호자)
        this.groggy = 0;
        if (this.state === 'grabbing') this.releaseGrab(w);
        this.move = null;
        this.set('stunned');
        this.stunT = 60;
        w.fx('text', this.x, this.y, this.def.h + 40, '그로기');
        w.emit({ type: 'custom', name: 'groggy', data: { id: this.id, kind: this.kind } });
        return { kind: 'hit' };
      }
    }
    if (this.hp <= 0) {
      this.die(w, hit);
      return { kind: 'hit', killed: true };
    }
    if (guard) {
      this.x += hit.dir * 3;
      w.fx('spark', this.x - this.dir * -30, this.y, 100);
      return { kind: 'guard' };
    }
    if (mod.noReact) return { kind: hit.react === 'none' ? 'hit' : 'armor' };
    const f = this.frameNow();
    let armor = Math.max(this.armorBase, f?.armor ?? 0, this.has('armor') && f?.hit.length ? 1 : 0) as Armor;
    if (weak || hit.armorBreak || this.state === 'stunned' || this.state === 'bound') armor = 0;
    if (REACT_RANK[hit.react] <= armor) return { kind: hit.react === 'none' ? 'hit' : 'armor' };
    this.react(hit, w);
    return { kind: 'hit' };
  }

  react(hit: Hit, w: WorldView) {
    if (this.state === 'grabbing') this.releaseGrab(w);
    this.move = null;
    const push = hit.push ?? 4;
    switch (hit.react) {
      case 'none':
        return;
      case 'flinch':
        if (this.state === 'air') return void (this.vz = Math.max(this.vz, 3));
        this.set('hurt');
        this.stunT = 10;
        this.vx = hit.dir * push * 0.4;
        return;
      case 'stagger':
        if (this.state === 'air') return void ((this.vz = Math.max(this.vz, 4)), (this.vx = hit.dir * push * 0.5));
        this.set('hurt');
        this.stunT = 16;
        this.vx = hit.dir * push;
        return;
      case 'launch':
        if (this.launches >= this.maxLaunch) return this.knockDown(hit);
        this.launches++;
        this.set('air');
        this.vz = hit.lift ?? 12;
        this.vx = hit.dir * push * 0.5;
        this.z = Math.max(this.z, (this.def.hover ?? 0) + 1);
        return;
      case 'down':
        return this.knockDown(hit);
      case 'bind':
        this.set('bound');
        this.bindT = 75;
        return;
    }
  }
  private knockDown(hit: Hit) {
    this.set('air');
    this.vz = Math.max(this.vz, hit.lift ?? 8);
    this.vx = hit.dir * (hit.push ?? 6);
    this.z = Math.max(this.z, (this.def.hover ?? 0) + 1);
  }

  die(w: WorldView, hit?: Hit) {
    if (this.state === 'dead') return;
    if (this.state === 'grabbing') this.releaseGrab(w);
    this.hp = 0;
    this.move = null;
    this.set('dead');
    this.vx = (hit?.dir ?? -this.dir) * 4;
    this.brain.death?.(this, w);
    // 맞아서 죽으면 엔진 world.ts가 enemyDie를 낸다. 출혈·자폭 같은 다른 죽음만 여기서 낸다
    if (!hit) w.emit({ type: 'enemyDie', x: this.x, kind: this.kind });
    const drops = rollDrops(this.def.drop, () => w.rand(), this.elite);
    if (drops.length) {
      w.emit({ type: 'custom', name: 'enemyDrop', data: { id: this.id, kind: this.kind, x: this.x, y: this.y, drops } });
      fireDropHook({ enemy: this, kind: this.kind, x: this.x, y: this.y, drops, world: w });
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawEnemy(this, ctx);
  }
  /** 몸보다 먼저 그릴 배경 장치 (틈새 등). 없으면 아무것도 안 함 */
  drawBack(ctx: CanvasRenderingContext2D): void {
    if (!this.brain.drawBack) return;
    ctx.save();
    this.brain.drawBack(this, ctx);
    ctx.restore();
  }
}

function firstIndex(m: Move, i: number, key: 'fire' | 'ev'): number {
  // 같은 이름이 이어진 단계의 첫 장에서만 발동 (bake가 첫 장에만 넣으므로 그대로 i)
  return m.frames[i][key] ? i : -1;
}

const PART_ORDER: Part[] = ['corner', 'mouth', 'back', 'head', 'shield', 'core', 'weapon', 'arm', 'torso', 'legs'];
function pickPart(hurt: PartBox[], hit: Hit): Part | undefined {
  const hits = hurt.filter((b) => hit.x0 < b.x1 && b.x0 < hit.x1 && hit.z0 < b.z1 && b.z0 < hit.z1);
  if (!hits.length) return hurt[0]?.part;
  hits.sort((a, b) => PART_ORDER.indexOf(a.part ?? 'torso') - PART_ORDER.indexOf(b.part ?? 'torso'));
  // 방패가 앞에 있으면 방패가 먼저 맞는다
  const shield = hits.find((b) => b.part === 'shield');
  return shield ? 'shield' : hits[0].part;
}

// ─── 회색 상자 그리기 (그림 없음) ───────────────────────────
const PART_SHADE: Partial<Record<Part, number>> = { head: 0.18, legs: -0.12, arm: 0.08, shield: 0.3, back: 0.22, mouth: 0.35, corner: 0.4, weapon: 0.5 };

function tint(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export function drawEnemy(e: Enemy, ctx: CanvasRenderingContext2D) {
  const f = e.frameNow();
  ctx.save();
  // 바닥 그림자
  ctx.globalAlpha = 0.35 * e.alpha;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y, e.def.w * 0.55, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // 예고는 몸 테두리 깜빡임과 「!」로만 (바닥의 붉은 판은 놀이판 대역처럼 보여 뺐다, 검수 4-3)
  e.brain.drawUnder?.(e, ctx);
  ctx.restore();
  ctx.save();
  let alpha = e.alpha;
  if (e.state === 'dead') alpha *= 1 - e.deadT / 24;
  if (e.state === 'spawn') alpha *= e.st / 12;
  ctx.globalAlpha = alpha;
  // 예고 테두리 (빨강 깜빡임) · 슈퍼아머 (노랑 점멸, E.7)
  const armorNow = Math.max(e.armorBase, f?.armor ?? 0);
  const outline = f?.tele ? ((e.st >> 1) & 1 ? '#ff3030' : '#ffb0a0') : armorNow >= 1 && e.state === 'attack' ? ((e.age >> 2) & 1 ? '#ffd23c' : '#a08020') : e.elite ? '#b46cff' : '';
  if (drawFigure(e, ctx, outline)) drawSwing(e, ctx, alpha);
  else drawBoxes(e, ctx, f, alpha, outline, armorNow);
  ctx.globalAlpha = alpha;
  if (f?.tele && e.mf < 6) {
    ctx.fillStyle = '#ff3030';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', e.x, e.y - e.z - e.def.h - 18);
  }
  // 약점 열림: 흰 삼각
  if (e.weakOpen > 0) {
    const top = e.y - e.z - e.def.h - 30;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(e.x - 12, top - 14);
    ctx.lineTo(e.x + 12, top - 14);
    ctx.lineTo(e.x, top + 4);
    ctx.fill();
  }
  e.brain.drawOver?.(e, ctx);
  // 체력 막대 (수호자는 HUD가 따로 그리므로 작게)
  if (e.state !== 'dead' && e.alpha > 0.3 && (e.hp < e.hpMax || e.boss)) {
    const w = Math.max(50, e.def.w * 0.8);
    const top = e.y - e.z - e.def.h - 12;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(e.x - w / 2, top, w, 6);
    ctx.fillStyle = e.boss ? '#e0503a' : '#e8c35a';
    ctx.fillRect(e.x - w / 2, top, (w * Math.max(0, e.hp)) / e.hpMax, 6);
    if (e.groggyMax) {
      ctx.fillStyle = '#7fd0ff';
      ctx.fillRect(e.x - w / 2, top + 7, (w * Math.min(1, e.groggy / e.groggyMax)) / 1, 3);
    }
  }
  if (e.state !== 'dead' && e.status.list.length) {
    ctx.save();
    ctx.translate(e.x, e.y - e.z - e.def.h - 18);
    drawAilments(ctx, e.status.list.map((s) => STATUS[s.kind].label + (s.stacks > 1 ? s.stacks : '')), 0);
    ctx.restore();
  }
  if (e.bubble) drawBubble(ctx, e.bubble, e.x, e.y - e.z - e.def.h - 30);
  ctx.restore();
}

/** 적 말풍선: 화면 표시 도트 틀(slot) + 도트 글꼴, 아래로 도트 꼬리. bottom = 꼬리 끝 높이 */
function drawBubble(ctx: CanvasRenderingContext2D, text: string, x: number, bottom: number) {
  const P = 3;
  ctx.save();
  ctx.font = `700 22px '${PIXEL_FONT}', 'Galmuri11', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = Math.ceil(ctx.measureText(text).width / P) * P;
  const w = tw + 15 * P;
  const h = 14 * P;
  const x0 = Math.round((x - w / 2) / P) * P;
  const y0 = Math.round((bottom - h - 4 * P) / P) * P;
  const frame = kitPiece('slot');
  ctx.fillStyle = '#16130f';
  ctx.fillRect(x0 + P, y0 + P, w - 2 * P, h - 2 * P);
  if (frame?.complete && frame.naturalWidth) nine(ctx, frame, kitSlice('slot'), x0, y0, w, h, 1);
  else {
    ctx.strokeStyle = '#8a7a58';
    ctx.lineWidth = P;
    ctx.strokeRect(x0 + P / 2, y0 + P / 2, w - P, h - P);
  }
  // 꼬리 (계단 도트)
  const tx = Math.round(x / P) * P;
  ctx.fillStyle = '#8a7a58';
  for (let i = 0; i < 4; i++) ctx.fillRect(tx - (3 - i) * P, y0 + h + i * P - P, (3 - i) * 2 * P + P, P);
  ctx.fillStyle = '#16130f';
  for (let i = 0; i < 3; i++) ctx.fillRect(tx - (2 - i) * P, y0 + h + i * P - P, (2 - i) * 2 * P + P, P);
  ctx.fillStyle = '#000';
  ctx.fillText(text, x + 2, y0 + h / 2 + 2);
  ctx.fillStyle = '#ece6d4';
  ctx.fillText(text, x, y0 + h / 2);
  ctx.restore();
}

/** 모양이 없는 종 (도형·집·얼룩·벽 얼굴 등): 판정 상자를 칠한다 */
function drawBoxes(e: Enemy, ctx: CanvasRenderingContext2D, f: ReturnType<Enemy['frameNow']>, alpha: number, outline: string, armorNow: number) {
  const body = e.state === 'down' || e.state === 'getup' || e.state === 'dead' ? flat(e) : e.localHurt().length ? e.localHurt() : e.brain.hurt ? [] : e.def.body;
  // 테두리는 사각 틀 대신 몸을 따라 번지는 빛 (검수 4-3)
  ctx.save();
  if (outline) {
    ctx.shadowColor = outline;
    ctx.shadowBlur = armorNow >= 2 ? 18 : 12;
  }
  for (const b of body) {
    const wb = toWorld(b, e.x, e.y, e.z, e.dir);
    ctx.fillStyle = tint(e.def.color, (PART_SHADE[b.part ?? 'torso'] ?? 0) + (e.flash > 0 && e.state !== 'dead' ? 0.5 : 0));
    ctx.fillRect(wb.x0, e.y - wb.z1, wb.x1 - wb.x0, wb.z1 - wb.z0);
  }
  ctx.restore();
  // 바라보는 쪽 눈
  if (body.length && e.state !== 'dead' && e.state !== 'down') {
    const top = Math.max(...body.map((b) => b.z1));
    ctx.fillStyle = e.state === 'attack' ? '#ff4b3a' : '#f2efe6';
    ctx.fillRect(e.x + e.dir * (e.def.w * 0.18) - 4, e.y - e.z - top + 12, 8, 6);
  }
  // 공격 상자 (유효 장)는 반투명 흰 칼날
  if (f?.hit.length) {
    ctx.globalAlpha = 0.5 * alpha;
    ctx.fillStyle = '#fff3e0';
    for (const b of f.hit) {
      const wb = toWorld(b, e.x, e.y, e.z, e.dir);
      ctx.fillRect(wb.x0, e.y - wb.z1, wb.x1 - wb.x0, wb.z1 - wb.z0);
    }
  }
  ctx.globalAlpha = alpha;
}

function flat(e: Enemy): LocalBox[] {
  const w = Math.max(e.def.w, e.def.h * 0.8);
  return [{ fx0: -w * 0.5, fx1: w * 0.5, z0: e.def.hover ?? 0, z1: (e.def.hover ?? 0) + Math.min(36, e.def.h * 0.3), dy: 20, part: 'torso' }];
}
