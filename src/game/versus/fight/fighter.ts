// 대전 캐릭터 한 명 (2026-11-08 새로 짬). 1P 와 AI 가 같은 몸·같은 규칙을 쓴다: AI 는 손 대신 두뇌(ai.ts)가 같은 단추를 누른다.
// 판정은 장 단위: 공격 칸 = 그 장의 손발 끝(reach), 맞는 칸 = 그 장의 몸 그림(몸통 + 뻗은 손발). 피해·경직·밀림은 rules.ts 표 하나
import { drawSprite, framePt, muzzleOf, drawVfx, baseOf, type CharArt } from './art';
import { Anim, has, nOf, loopOf, range, steps, type Step } from './anim';
import { normalSeq, rangedSeq, skillSteps, stepsOf, countSkill, countSteps, MIN_TIP } from './moves';
import { runFx, type FxCtx } from './skillfx';
import { later, type Stage, type Use } from './stage';
import {
  K, LINE, DT, GRAV, HP, DMG, SCALE, JUGGLE_MUL, OTG_MUL, CHIP, GAUGE, STUN, FREEZE, PUSH, FRICTION, CHAIN_DOWN, CHAIN_GAP,
  JUGGLE_MAX, OTG_MAX, LIE_SEC, MOVE, ATK, CHAIN_WINDOW, BUFFER, SPECIAL_LAG, BODY_HALF, TIP, WALL,
  HIT_CAP, LAUNCH_GRAV,
  dotSample, RUSH_SUPER,
} from './rules';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

export type Btn = 'left' | 'right' | 'up' | 'light' | 'heavy' | 'charge' | 'shoot' | 'skill' | 'sit' | 'crouch';
export interface Ctl { held: Set<Btn>; pressed: Set<Btn>; released: Set<Btn> }
export const emptyCtl = (): Ctl => ({ held: new Set(), pressed: new Set(), released: new Set() });

export type State = 'idle' | 'run' | 'back' | 'guard' | 'crouch' | 'cower' | 'dash' | 'jump' | 'atk' | 'charge' | 'hit' | 'air' | 'down' | 'getup' | 'ko' | 'pose';
/** 맞음 종류 → 반응 */
export type HitKind = 'light' | 'heavy' | 'launch' | 'blow' | 'down' | 'stun' | 'spike' | 'pull' | 'turn';

export interface Box { x0: number; x1: number; z0: number; z1: number }
export interface HitSpec {
  use: Use;
  kind: HitKind;
  /** 맞힌 자리 (화면 효과) */
  at?: { x: number; y: number };
  /** 그림 없이 (탄이 따로 그린다) */
  noVfx?: boolean;
  /** 따로 정한 맞음 그림 */
  vfx?: string;
  vs?: number;
  tint?: string;
  sound?: string;
  /** 평타 (때린 쪽도 멈춘다) */
  normal?: boolean;
  /** 붙잡아 두기 (돌진 난무): 서 있으면 이 초만큼 맞는 자세로 묶고 쓰러뜨리지 않는다, 공중이면 띄운 채 둔다 */
  lock?: number;
  /** 맞은 쪽 멈춤 (초) 따로 정함 */
  stop?: number;
}

interface Atk {
  use: Use;
  /** 평타 공격 칸이 이미 맞혔다 */
  hit: boolean;
  /** 이 동작으로 상대를 맞혔다 (캔슬 허용) */
  connected: boolean;
  start: number;
  /** 평타 종류 (콤보 판단) */
  normal: 'light' | 'heavy' | 'jump' | null;
  /** 끝나면 이 자세로 잠깐 굳음 */
  lag: number;
}


export class Fighter {
  readonly name: string;
  readonly color: string;
  x: number;
  z = 0;
  vx = 0;
  vz = 0;
  face: 1 | -1;
  hp = HP;
  hpMax = HP;
  gauge = 0;
  state: State = 'idle';
  stT = 0;
  anim: Anim | null = null;
  ctl: Ctl = emptyCtl();
  alive = true;

  /** 히트스톱 · 필살기 연출 정지 · 무적 · 경직 */
  freeze = 0;
  hold = 0;
  inv = 0;
  stun = 0;
  /** 공중 몸 그림 (장 가장 낮은 점을 몸 높이에) */
  air = false;
  /** 받은 이어 맞음 */
  chainN = 0;
  chainT = -9;
  comboTaken = 0;
  /** 이번 이음에 준 맞음 수 (HUD 「N HIT」) */
  combo = 0;
  juggle = 0;
  otg = 0;
  airKind: HitKind | 'ko' | null = null;
  airT = 0;
  airT0 = 1;
  lieT = 0;
  atk: Atk | null = null;
  lightIdx = 0;
  lightEnd = -9;
  buf: { a: Btn; t: number } | null = null;
  pressedAt: Partial<Record<Btn, number>> = {};
  lastTap: { l: number; r: number } = { l: -9, r: -9 };
  dashDir = 0;
  chargeT = 0;
  inSuper = false;
  pending: (() => void) | null = null;
  /** 돌진 난무 필살기 진행 (한 틱마다) */
  rush: (() => void) | null = null;
  /** 돌진 난무 중 잔상 (예전 자세 몇 개) */
  trail: { x: number; z: number; id: string; f: number; face: 1 | -1; air: boolean }[] = [];
  private trailN = 0;
  /** 보이는 모습 */
  flashT = 0;
  flashC = '#ffffff';
  /** 맞은 순간 하얗게 (초) */
  whiteT = 0;
  /** 이번 공격에서 다음 타로 이을 수 있게 된 때 (-1 = 아직) */
  cancelAt = -1;
  hurtT = 0;
  alpha = 1;
  vanish: { out: boolean; t: number; d: number } | null = null;
  bindT = 0;
  liftT = 0;
  liftH = 0;
  /** 판 끝 자세 */
  poseId: string | null = null;
  /** 판 사이 들어오기: 그림만 정해 둔다 */
  force: { id: string; f: number; air: boolean } | null = null;
  /** 서바이벌 */
  boss = false;
  deadT = -1;
  /** 기술 연습 더미: 쓰러지지 않는다 (체력 1 밑으로 안 내려감) */
  noKo = false;
  hpMul = 1;
  dmgMul = 1;
  /** 쓴 공격 번호 → 맞은 적 있음 (같은 공격 칸에 두 번 맞지 않게) */
  private gotIds = new Set<number>();

  constructor(readonly art: CharArt, readonly side: 0 | 1, readonly team: 0 | 1, x: number, face: 1 | -1, readonly st: Stage) {
    this.name = art.cfg.name;
    this.color = art.cfg.color || '#ffffff';
    this.x = x;
    this.face = face;
    this.toIdle();
  }

  // ───────── 자료 ─────────
  get cfg(): Json { return this.art.cfg; }
  get skills(): Json { return (this.art.cfg.skills as Json) || {}; }
  has(id: string | null | undefined): id is string { return has(this.art, id); }
  idleId(): string { return this.has('3') ? '3' : '1'; }
  lightIds(): string[] { return ['9', '10', '11'].filter((i) => this.has(i)); }

  /** 지금 그리는 장 */
  pose(): { id: string; f: number; air: boolean } {
    if (this.force) return this.force;
    const a = this.anim;
    const id = a && this.has(a.id) ? a.id : this.idleId();
    return { id, f: a ? a.f : 0, air: this.air };
  }

  // ───────── 상자 ─────────
  /** 맞는 칸: 몸통(그 장 몸 가운데 ± BODY_HALF) + 공격 중 뻗은 손발 */
  hurt(): Box {
    const { id, f, air } = this.pose(), m = this.art.A[id];
    if (!m) return { x0: this.x - 40, x1: this.x + 40, z0: this.z, z1: this.z + 240 };
    const cx = m.cx?.[f] ?? 0;
    let front = cx + BODY_HALF;
    const back = cx - BODY_HALF;
    if (this.state === 'atk' && this.atk?.normal && m.reach[f] - 12 > front) front = m.reach[f] - 12;
    const b = baseOf(id, m, f, air);
    const bot = this.z + (b - m.bot[f]) * K, top = this.z + (b - m.top[f]) * K;
    const xa = this.x + this.face * back * K, xb = this.x + this.face * front * K;
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: Math.max(0, bot), z1: Math.max(bot + 40, top) };
  }
  /** 평타 공격 칸: 그 장 손발 끝 둘레 */
  hitBox(): Box | null {
    const { id, f, air } = this.pose(), m = this.art.A[id];
    if (!m) return null;
    // 짧은 손발도 몸끼리 붙어 선 상대에게는 닿게 (밀어내기 간격보다 조금 더)
    const tip = Math.max(m.reach[f], MIN_TIP);
    const xa = this.x + this.face * (tip - TIP.back) * K, xb = this.x + this.face * (tip + TIP.front) * K;
    const b = baseOf(id, m, f, air);
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: this.z + (b - m.bot[f]) * K + 24, z1: this.z + (b - m.top[f]) * K };
  }
  /** 밀어내기 반폭 (월드) */
  half(): number { return BODY_HALF * K; }
  /** 지금 장의 총구·손끝 (월드 x, 화면 y) */
  muzzle(): { x: number; y: number } {
    const { id, f, air } = this.pose(), m = this.art.A[id];
    if (!m) return { x: this.x + this.face * 40, y: LINE - this.z - 150 };
    const [px, py] = muzzleOf(this.art, id, f);
    return framePt(this.x, this.z, this.face, id, m, f, air, px, py);
  }
  /** 몸 가운데 높이 (화면 y) */
  midY(): number {
    const h = this.hurt();
    return LINE - (h.z0 + h.z1) / 2;
  }

  // ───────── 상대 ─────────
  foes(): Fighter[] { return this.st.fighters.filter((o) => o.team !== this.team && o.alive && o.deadT < 0); }
  foe(): Fighter | null {
    let best: Fighter | null = null;
    for (const o of this.foes()) if (!best || Math.abs(o.x - this.x) < Math.abs(best.x - this.x)) best = o;
    return best;
  }
  toward(): 1 | -1 { const o = this.foe(); return o ? ((Math.sign(o.x - this.x) || this.face) as 1 | -1) : this.face; }

  // ───────── 동작 ─────────
  play(id: string, s: Step[], o: { loop?: number; onEnd?: () => void } = {}): void {
    if (!this.has(id)) id = this.idleId();
    const n = nOf(this.art, id);
    for (const e of s) e.f = Math.max(0, Math.min(n - 1, e.f));
    this.anim = new Anim(id, s, o.loop ?? -1, o.onEnd ?? null, (e) => this.onStep(e)).start();
  }
  setState(s: State): void { this.state = s; this.stT = 0; }
  toIdle(): void {
    this.setState('idle');
    this.rush = null;
    this.atk = null;
    this.air = false;
    this.vanish = null;
    this.inSuper = false;
    const id = this.idleId(), n = nOf(this.art, id), lp = loopOf(this.art, id);
    this.play(id, steps(lp ?? range(0, Math.max(0, n - 1)), 0.11), { loop: 0 });
  }
  private onStep(e: Step): void {
    e.fn?.();
    if (e.run && this.atk) runFx(this, e.run as Json[], this.fxCtx());
    if (e.shot && this.atk) this.fireShot();
  }
  fxCtx(): FxCtx { return { use: this.atk?.use ?? null }; }

  /** 판정·피해 기록 하나 */
  newUse(kind: Use['kind'], budget: number, hits: number, o: Partial<Use> = {}): Use {
    // 맞는 수가 많은 기술은 앞쪽 몇 대(HIT_CAP)로 전체 피해가 차게: 그림이 헛나가는 대가 많아도 기술 피해가 고르게
    const cap = (HIT_CAP as Record<string, number>)[kind] ?? hits;
    return { id: this.st.nextId(), kind, budget, per: Math.max(1, Math.round(budget / Math.max(1, Math.min(hits, cap)))), dealt: 0, unblock: false, special: kind === 'ranged' || kind === 'skill' || kind === 'charge' || kind === 'super', ...o };
  }

  // ───────── 한 틱 ─────────
  tick(): void {
    const dt = DT;
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.freeze <= 0) this.whiteT = Math.max(0, this.whiteT - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.vanish) { this.vanish.t += dt; if (!this.vanish.out && this.vanish.t >= this.vanish.d) this.vanish = null; }
    if (this.hold > 0) {
      this.hold -= dt;
      this.readInput(true);
      if (this.hold <= 0 && this.pending) { const p = this.pending; this.pending = null; p(); }
      return;
    }
    if (this.freeze > 0) { this.freeze -= dt; this.readInput(true); return; }
    this.stT += dt;
    this.inv = Math.max(0, this.inv - dt);
    this.bindT = Math.max(0, this.bindT - dt);
    this.readInput(false);
    this.think(dt);
    this.physics(dt);
    if (this.state !== 'hit' && this.state !== 'air' && this.state !== 'jump') this.anim?.tick(dt);
    if (this.state === 'atk' && this.atk && !this.atk.hit && this.anim?.step.act) this.checkNormalHit();
    // 잔상: 돌진 난무 동안 3틱마다 지금 자세를 남긴다 (4개)
    if (this.rush) { if (++this.trailN % 3 === 0) { const p = this.pose(); this.trail.push({ x: this.x, z: this.z, id: p.id, f: p.f, face: this.face, air: p.air }); if (this.trail.length > 4) this.trail.shift(); } }
    else if (this.trail.length) this.trail.shift();
  }

  /** 입력: 누른 단추를 잠깐 들고 있는다 (늦게 나가는 예약 공격은 없다) */
  private readInput(frozen: boolean): void {
    const c = this.ctl;
    for (const b of c.pressed) {
      this.pressedAt[b] = this.st.t;
      if (b === 'left' || b === 'right') {
        const k = b === 'left' ? 'l' : 'r';
        if (!frozen && this.st.t - this.lastTap[k] < 0.25) { this.dashDir = b === 'left' ? -1 : 1; this.lastTap[k] = -9; }
        else this.lastTap[k] = this.st.t;
        continue;
      }
      if (b === 'light' || b === 'heavy' || b === 'shoot' || b === 'skill' || b === 'charge' || b === 'up') this.buf = { a: b, t: this.st.t };
    }
  }
  private takeBuf(maxAge = BUFFER): Btn | null {
    const b = this.buf;
    if (!b || this.st.t - b.t > maxAge) return null;
    return b.a;
  }
  /** 약+강 동시 = 필살기 */
  private superInput(): boolean {
    const a = this.pressedAt.light ?? -9, s = this.pressedAt.heavy ?? -9;
    return Math.abs(a - s) <= 0.07 && this.st.t - Math.max(a, s) <= 0.07;
  }
  private canSuper(): boolean { return this.gauge >= 100 && !!this.skills.super; }

  private threat(): boolean {
    for (const o of this.foes()) {
      if (o.inSuper) return true;
      if (o.state === 'atk' && o.atk && !o.atk.hit && Math.abs(o.x - this.x) < 620 && (o.anim?.left() ?? 0) > 0.08) return true;
      if (o.state === 'jump' && o.atk && Math.abs(o.x - this.x) < 300) return true;
    }
    for (const p of this.st.proj) if (p.owner.team !== this.team && Math.sign(this.x - p.x) === p.dir && Math.abs(this.x - p.x) < 620) return true;
    return false;
  }

  private think(_dt: number): void {
    const c = this.ctl;
    const tw = this.toward();
    const fwdHeld = c.held.has(tw > 0 ? 'right' : 'left'), backHeld = c.held.has(tw > 0 ? 'left' : 'right');
    switch (this.state) {
      case 'idle': case 'run': case 'back': case 'guard': case 'crouch': case 'cower': {
        if (this.state === 'guard' && this.stun > 0) { this.stun -= DT; return; }
        if (this.bindT > 0) { this.vx = 0; return; }
        if (this.z <= 0) this.face = tw;
        if (this.tryAct()) return;
        const dash = this.dashDir; this.dashDir = 0;
        if (dash) return this.dash(dash);
        if (c.held.has('sit') && this.has('39')) return this.lowPose('crouch', '39');
        if (c.held.has('crouch') && this.has('41')) return this.lowPose('cower', '41');
        if (this.state === 'crouch' || this.state === 'cower') return this.leaveLow();
        if (backHeld && this.threat()) return this.guardPose();
        if (fwdHeld) return this.runPose(tw);
        if (backHeld) return this.backPose(tw);
        if (this.state !== 'idle') this.toIdle();
        this.vx = 0;
        return;
      }
      case 'dash': return;
      case 'jump': return this.jumpTick();
      case 'atk': return this.atkTick();
      case 'charge': return this.chargeTick();
      case 'hit': return this.hitTick();
      case 'air': return this.airTick();
      case 'down': return this.downTick();
      case 'getup': return;
      case 'ko': return this.airKind ? this.airTick() : this.downTick();
      case 'pose': return;
    }
  }

  /** 서 있는 상태에서 공격 단추 */
  private tryAct(): boolean {
    if (this.bindT > 0) return false;
    if (this.superInput() && this.canSuper()) { this.buf = null; this.superMove(); return true; }
    const b = this.takeBuf();
    if (!b) return false;
    this.buf = null;
    if (b === 'light') { this.light(); return true; }
    if (b === 'heavy') { this.heavy(); return true; }
    if (b === 'skill' && this.skills.skill) { this.skill(); return true; }
    if (b === 'charge' && this.skills.charge && this.ctl.held.has('charge')) { this.charge(); return true; }
    if (b === 'shoot') return this.ranged();
    if (b === 'up' && this.has('7')) { this.jump(); return true; }
    return false;
  }

  // ───────── 서기·이동 ─────────
  private runPose(tw: 1 | -1): void {
    this.vx = tw * MOVE.run;
    if (this.state === 'run') return;
    this.setState('run');
    const id = this.has('5') ? '5' : '4';
    this.play(id, steps(range(0, nOf(this.art, id) - 1), 0.075), { loop: 0 });
  }
  /** 뒤로: 상대를 본 채 걷기 그림을 거꾸로 (겁먹은 뒷걸음 X) */
  private backPose(tw: 1 | -1): void {
    this.vx = -tw * MOVE.back;
    if (this.state === 'back') return;
    this.setState('back');
    this.play('4', steps(range(nOf(this.art, '4') - 1, 0), 0.1), { loop: 0 });
  }
  private guardPose(): void {
    this.vx = 0;
    if (this.state === 'guard') return;
    this.setState('guard');
    const n = nOf(this.art, '17'), mid = Math.max(0, Math.floor(n / 2));
    this.play('17', [...steps(range(0, mid), 0.03), { f: mid, d: 99 }]);
  }
  private lowPose(s: 'crouch' | 'cower', id: string): void {
    this.vx = 0;
    if (this.state === s) return;
    this.setState(s);
    const n = nOf(this.art, id), lp = loopOf(this.art, id) ?? range(Math.max(0, n - 4), n - 1);
    this.play(id, [...steps(range(0, Math.max(0, lp[0] - 1)), 0.04), ...steps(lp, 0.12)], { loop: Math.max(0, lp[0]) });
  }
  private leaveLow(): void {
    const id = this.anim?.id ?? '39', f = this.anim?.f ?? 0;
    this.setState('atk');
    this.atk = null;
    this.play(id, steps(range(f, 0), 0.03), { onEnd: () => this.toIdle() });
  }
  private dash(dir: number): void {
    const fwd = dir === this.face, id = fwd && this.has('16_1') ? '16_1' : '16';
    const sec = fwd ? MOVE.dashSec : MOVE.backdashSec, v = fwd ? MOVE.dash : MOVE.backdash;
    this.setState('dash');
    this.inv = MOVE.dashInv;
    this.vx = dir * v;
    this.st.sfx({ type: 'evade', x: this.x });
    const n = nOf(this.art, id);
    this.play(id, steps(range(0, n - 1), sec / Math.max(1, n)), { onEnd: () => { this.vx = 0; this.toIdle(); } });
  }
  private jump(): void {
    this.setState('jump');
    this.atk = null;
    const c = this.ctl, tw = this.toward();
    const dir = c.held.has('right') ? 1 : c.held.has('left') ? -1 : 0;
    this.vz = MOVE.jumpVz; this.vx = dir * MOVE.jumpVx; this.z = 1; this.air = true;
    this.face = tw;
    this.st.sfx({ type: 'jump', x: this.x });
    this.play('7', [{ f: 0, d: 99 }]);
  }
  private jumpTick(): void {
    if (this.atk) { this.anim?.tick(DT); if (!this.atk.hit && this.anim?.step.act !== false) this.checkNormalHit(); }
    else {
      const b = this.takeBuf();
      if ((b === 'light' || b === 'heavy') && this.has('14')) {
        this.buf = null;
        const big = b === 'heavy';
        this.atk = { use: this.newUse('jump', big ? DMG.jump * 1.5 : DMG.jump, 1), hit: false, connected: false, start: this.st.t, normal: 'jump', lag: 0 };
        const s = normalSeq(this.art, '14', big).map((e) => ({ ...e, act: e.act || !!e.cancel }));
        s[s.length - 1].d = 9;
        this.play('14', s);
        this.st.sfx({ type: 'whiff', strength: big ? 2 : 1, x: this.x });
      } else {
        const n = nOf(this.art, '7'), apex = Math.max(1, Math.floor(n / 2) - 1);
        const k = this.vz > 0 ? 1 - this.vz / MOVE.jumpVz : 1 + Math.min(1, -this.vz / MOVE.jumpVz);
        const f = Math.round(k < 1 ? 1 + k * (apex - 1) : apex + (k - 1) * Math.max(0, n - 3 - apex));
        if (this.anim) this.anim.steps[0].f = Math.max(0, Math.min(n - 1, f));
      }
    }
    if (this.z <= 0 && this.vz <= 0) {
      this.z = 0; this.vz = 0; this.air = false; this.atk = null; this.vx = 0;
      this.st.sfx({ type: 'land', x: this.x });
      const n = nOf(this.art, '7');
      this.setState('atk');
      this.play('7', [{ f: Math.max(0, n - 2), d: 0.05 }, { f: n - 1, d: 0.05 }], { onEnd: () => this.toIdle() });
    }
  }

  // ───────── 평타 ─────────
  private light(): void {
    const L = this.lightIds();
    if (!L.length) return;
    const idx = this.st.t - this.lightEnd <= CHAIN_WINDOW && this.lightIdx < L.length ? this.lightIdx : 0;
    this.lightIdx = idx + 1;
    this.normal(L[idx], 'light', this.newUse('light', DMG.light, 1), ATK.lungeLight);
  }
  private heavy(): void {
    if (!this.has('12')) return this.light();
    const chained = this.st.t - this.lightEnd <= CHAIN_WINDOW || (this.atk?.normal === 'light' && this.atk.connected);
    const prev = chained ? this.lightIdx : 0;
    const kind: Use['kind'] = prev === 2 ? 'launch' : prev >= 3 ? 'blow' : 'heavy';
    this.lightIdx = 0; this.lightEnd = -9;
    this.normal('12', 'heavy', this.newUse(kind, kind === 'launch' ? DMG.launch : kind === 'blow' ? DMG.blow : DMG.heavy, 1), kind === 'heavy' ? ATK.lungeHeavy : ATK.lungeFinisher);
  }
  private normal(id: string, n: 'light' | 'heavy', use: Use, lunge: number): void {
    this.setState('atk');
    this.atk = { use, hit: false, connected: false, start: this.st.t, normal: n, lag: 0 };
    this.cancelAt = -1;
    this.st.sfx({ type: 'whiff', strength: n === 'heavy' ? 3 : 1, x: this.x });
    const s = normalSeq(this.art, id, n === 'heavy');
    const pre = s.filter((e) => !e.act && !e.cancel).reduce((a, e) => a + e.d, 0);
    // 이어치기: 앞 타에 밀려난 상대(맞는 중·막는 중)에게 이번 타가 닿도록 그만큼 더 다가간다 (11-08: 3타가 밀려난 상대에게 헛나감)
    const o = this.foe(), imp = s.find((e) => e.act);
    if (o && imp && pre > 0 && (o.state === 'hit' || (o.state === 'guard' && o.stun > 0))) {
      const m = this.art.A[id], tip = (Math.max(m.reach[imp.f], MIN_TIP) + TIP.front - 12) * K;
      const need = Math.abs(o.x - this.x) - o.half() - tip + o.stun * Math.abs(o.vx) * 0.5;
      if (need > 0) lunge = Math.max(lunge, Math.min(1100, need / pre));
    }
    this.vx = this.face * lunge;
    later(this.st, pre, () => { if (this.atk?.use === use && this.state === 'atk') this.vx = 0; });
    this.play(id, s, { onEnd: () => { if (n === 'light') this.lightEnd = this.st.t; this.vx = 0; this.toIdle(); } });
  }
  private checkNormalHit(): void {
    const box = this.hitBox();
    if (!box || !this.atk) return;
    const k = this.atk.use.kind;
    for (const o of this.foes()) {
      if (!overlap(box, o.hurt())) continue;
      const kind: HitKind = k === 'launch' ? 'launch' : k === 'blow' ? 'blow' : k === 'heavy' ? 'heavy' : k === 'jump' ? (this.atk.use.budget > DMG.jump ? 'heavy' : 'light') : 'light';
      const r = o.receive(this, { use: this.atk.use, kind, normal: true, at: { x: (Math.max(box.x0, o.hurt().x0) + Math.min(box.x1, o.hurt().x1)) / 2, y: LINE - Math.min(box.z1, o.hurt().z1) + 30 } });
      if (r !== 'miss') { this.atk.hit = true; this.atk.connected = true; }
    }
  }
  /** 공격 중: 맞혔으면 마무리 장에서 다음 동작으로 잇는다 */
  private atkTick(): void {
    if (this.rush) return this.rush();
    const a = this.atk;
    if (!a || !this.anim) return;
    // 약·강을 몇 프레임 차이로 눌러도 필살기 (먼저 눌린 평타 시작을 필살기로 바꾼다)
    if ((a.normal === 'light' || a.normal === 'heavy') && this.st.t - a.start <= 0.08 && this.superInput() && this.canSuper()) { this.buf = null; this.superMove(); return; }
    if (a.connected && this.anim.step.cancel) {
      if (this.superInput() && this.canSuper()) { this.buf = null; this.superMove(); return; }
      // 예약 없음 (11-09 사용자): 이을 수 있는 때가 열리기 직전 아주 잠깐(BUFFER) 또는 열린 뒤에 누른 것만
      if (this.cancelAt < 0) this.cancelAt = this.st.t;
      const b = this.buf && this.buf.t >= Math.max(a.start, this.cancelAt - BUFFER) ? this.buf.a : null;
      if (b) {
        if (a.normal === 'light' && (b === 'light' || b === 'heavy')) {
          this.buf = null;
          this.lightEnd = this.st.t;
          if (b === 'light' && this.lightIdx < this.lightIds().length) return this.light();
          if (b === 'heavy') return this.heavy();
        }
        if ((a.normal === 'light' || a.normal === 'heavy') && (b === 'skill' || b === 'shoot')) {
          this.buf = null;
          if (b === 'skill' && this.skills.skill) return this.skill();
          if (b === 'shoot') { this.ranged(); return; }
        }
      }
    }
  }

  // ───────── 원거리 ─────────
  private ranged(): boolean {
    if (!this.has('15')) return false;
    // 내 탄이 화면에 남아 있는 동안은 못 쏜다 (11-08 사용자 「무한 원거리 짤짤이」)
    if (this.st.proj.some((p) => p.owner === this && p.basic) || this.st.fx.some((e) => e.k === 'tracer' && e.owner === this)) return false;
    const s = rangedSeq(this.art), shots = s.filter((e) => e.shot).length;
    this.setState('atk');
    this.atk = { use: this.newUse('ranged', DMG.ranged, shots), hit: true, connected: false, start: this.st.t, normal: null, lag: SPECIAL_LAG };
    this.play('15', s, { onEnd: () => this.afterSpecial('15') });
    return true;
  }
  private fireShot(): void {
    const pj = (this.cfg.ranged as Json)?.proj || { t: 'proj', kind: 'orb' };
    runFx(this, [{ ...pj, t: pj.t || 'proj', hit: { ...(pj.hit || {}), kind: pj.hit?.kind || 'light' } }], { use: this.atk!.use, basic: true });
  }
  /** 특수기·충전·원거리 끝: 마지막 장으로 잠깐 굳는다 (후딜) */
  private afterSpecial(id: string): void {
    const lag = this.atk?.lag ?? SPECIAL_LAG;
    if (lag <= 0) return this.toIdle();
    const f = nOf(this.art, id) - 1;
    this.play(id, [{ f, d: lag }], { onEnd: () => this.toIdle() });
  }

  // ───────── 고유기·충전·필살기 ─────────
  /** 기술(단계 목록)을 차례로. 피해는 use 하나가 전체를 나눠 갖는다 */
  private runSteps(sp: Json, use: Use, then: () => void): void {
    const list = stepsOf(sp);
    const go = (i: number) => {
      if (i >= list.length) return then();
      const st = { ...list[i] };
      const { id, s } = skillSteps(this.art, st, this.idleId());
      if (st.push) this.vx = this.face * Math.min(600, st.push);
      this.play(id, s, { onEnd: () => go(i + 1) });
    };
    go(0);
  }
  private skill(): void {
    const sp = this.skills.skill;
    this.setState('atk');
    const use = this.newUse('skill', DMG.skill, countSkill(this.art, sp, this.idleId()), { hitVfx: sp.hitVfx ? { n: sp.hitVfx, s: sp.hitScale || 1 } : null });
    this.atk = { use, hit: true, connected: false, start: this.st.t, normal: null, lag: SPECIAL_LAG };
    this.st.sfx({ type: 'ability', x: this.x });
    this.runSteps(sp, use, () => this.afterSpecial(this.anim?.id ?? this.idleId()));
  }
  private charge(): void {
    const sp = this.skills.charge;
    this.setState('charge');
    this.atk = null;
    this.chargeT = 0;
    const id = this.has(sp.hold) ? String(sp.hold) : this.idleId(), n = nOf(this.art, id);
    const lp = loopOf(this.art, id) ?? range(Math.min(3, n - 1), n - 1);
    this.play(id, [...steps(range(0, Math.max(0, lp[0] - 1)), 0.055), ...steps(lp, 0.11)], { loop: Math.max(0, lp[0]) });
  }
  levels(): number[] { return ((this.skills.charge?.levels as number[]) || [0.5, 1.2]); }
  chargeLv(): number { return this.levels().filter((t) => this.chargeT >= t).length; }
  private chargeTick(): void {
    this.chargeT += DT;
    this.vx = 0;
    const L = this.levels();
    if (!this.ctl.held.has('charge') || this.chargeT > L[L.length - 1] + 1.5) this.release();
  }
  private release(): void {
    const sp = this.skills.charge, lv = this.chargeLv(), top = this.levels().length;
    const lvs = (sp.lv || {}) as Record<string, Json[]>;
    let list: Json[] = [];
    for (let k = lv; k >= 0 && !list.length; k--) list = lvs[k] || [];
    const hv = (sp.hitVfx || {})[lv];
    const rl = (sp.releaseLv && sp.releaseLv[lv]) || sp.release, rid = this.has(rl) ? String(rl) : this.idleId(), n = nOf(this.art, rid);
    this.setState('atk');
    if (sp.fireOnRelease) {
      const use = this.newUse('charge', DMG.charge[Math.min(3, lv)], Math.max(1, countSteps([{ f: 0, d: 0, run: list }])), { lv, unblock: lv >= top, hitVfx: hv ? { n: hv, s: (sp.hitScale || {})[lv] || 1 } : null });
      this.atk = { use, hit: true, connected: false, start: this.st.t, normal: null, lag: SPECIAL_LAG };
      runFx(this, list, { use, o: this.muzzle(), lv });
      this.play(rid, steps(range(Math.min(1, n - 1), n - 1), 0.06), { onEnd: () => this.afterSpecial(rid) });
      return;
    }
    const step = { anim: rid, fps: sp.fps || 12, events: [{ f: (sp.fireLv && sp.fireLv[lv]) || sp.fire || 2, fx: list }] };
    const use = this.newUse('charge', DMG.charge[Math.min(3, lv)], Math.max(1, countSteps(skillSteps(this.art, step, rid).s)), { lv, unblock: lv >= top, hitVfx: hv ? { n: hv, s: (sp.hitScale || {})[lv] || 1 } : null });
    this.atk = { use, hit: true, connected: false, start: this.st.t, normal: null, lag: SPECIAL_LAG };
    this.runSteps(step, use, () => this.afterSpecial(rid));
  }
  superMove(): void {
    const sp = this.skills.super;
    if (!sp) return;
    if (RUSH_SUPER.has(this.name)) return this.rushSuper(String(sp.name || '필살기'));
    this.gauge = 0;
    this.inSuper = true;
    this.setState('atk');
    this.vx = 0;
    const use = this.newUse('super', DMG.super, countSkill(this.art, sp, this.idleId()), { unblock: true });
    this.atk = { use, hit: true, connected: false, start: this.st.t, normal: null, lag: SPECIAL_LAG };
    this.inv = 99;
    this.flashT = 0.35; this.flashC = '#ffffff';
    // 시작 자세 (첫 단계 첫 장) 로 멈춘 채 연출
    const first = stepsOf(sp)[0] || {};
    const id = this.has(first.anim) ? String(first.anim) : this.idleId();
    this.play(id, [{ f: 0, d: 99 }]);
    this.pending = () => this.runSteps(sp, use, () => { this.inSuper = false; this.inv = 0; this.afterSpecial(this.anim?.id ?? this.idleId()); });
    this.st.superFlash(this, String(sp.name || '필살기'));
  }

  // ───────── 돌진 난무 필살기 (견본) ─────────
  /** 화면 어두워짐 → 상대 앞까지 돌진 → 약·강 연타 12대 → 띄우기 → 따라 뛰어올라 공중 연타 → 내려찍기 → 땅에서 에너지 대폭발.
   *  새 그림 없이 그 캐릭터의 평타(9·10·11·12)·대시(16_1)·점프(7)·점프 공격(14) 장을 빠르게 돌린다. 피해는 필살기 값(DMG.super)을 맞는 수로 나눈다 */
  private rushSuper(name: string): void {
    const L = this.lightIds(), H = this.has('12') ? '12' : L[L.length - 1];
    const beats = [...L, ...L, H, ...L, H, ...L].slice(0, 12);
    const AIR = 4, total = beats.length + 1 + AIR + 1;
    this.gauge = 0;
    this.inSuper = true;
    this.setState('atk');
    this.vx = 0;
    const use = this.newUse('super', DMG.super, total, { unblock: true });
    use.per = Math.max(1, Math.round(DMG.super / total));
    this.atk = { use, hit: true, connected: false, start: this.st.t, normal: null, lag: SPECIAL_LAG };
    this.inv = 99;
    // 시작 때 몸을 하얗게 칠하지 않음 (킹오파: 배경만 하얘지고 캐릭터는 그대로, 11-09)
    this.play(this.has('16_1') ? '16_1' : this.idleId(), [{ f: 0, d: 99 }]);
    const o0 = this.foe();
    const gap = () => (o0 ? o0.half() + this.half() + 18 : 80);
    const end = () => {
      this.rush = null; this.inSuper = false; this.inv = 0.2; this.vx = 0;
      if (this.z > 0) { this.rush = () => { if (this.z <= 0 && this.vz <= 0) { this.z = 0; this.vz = 0; this.air = false; this.rush = null; this.st.sfx({ type: 'land', x: this.x }); this.afterSpecial('7'); } }; return; }
      this.air = false; this.afterSpecial(this.anim?.id ?? this.idleId());
    };
    const foeOk = () => !!o0 && o0.alive && o0.deadT < 0 && o0.state !== 'ko';
    let hitN = 0;
    /** 맞는 자리 효과 (11-09 4판): 점 하나씩 손으로 찍은 세 가지(A 흰 불 뿜음·B 먹물 튐·C 베인 빛)를 대마다 돌려 쓰고 겹쳐 깖. 한 칸 = 캐릭터 점 2개 */
    const HAND = ['dot-hand-a', 'dot-hand-c', 'dot-hand-a', 'dot-hand-b'];
    const bigFx = (x: number, y: number, big: boolean) => {
      const flip = this.face < 0, j = () => (Math.random() - 0.5);
      const put = (name: string, dx: number, dy: number, s: number, fl = flip, dl = 0) => {
        const go = () => this.st.fx.push({ k: 'sheet', name, x: x + (fl ? -dx : dx), y: y + dy, s, flip: fl, anchor: 'center', t: 9, t0: 9, el: 0 });
        if (dl) later(this.st, dl, go); else go();
      };
      if (big) {
        // 큰 한 방 (11-09 5판, 킹오파98 롬에서 잰 순서): 흰 화면 2장 → 검은 별 → 흰 별 → 빛살 → 주황 가시 → 조각. 48칸 손도트, 한 칸 = 캐릭터 점 2.4개(캐릭터 키 절반)
        if (hitN === 1) this.st.bgWhite?.(2 / 60);   // 킹오파: 첫 대에만 흰 배경 2장
        put('dot-hand-big3', 0, 0, 2 * K, hitN % 2 ? !flip : flip);
      } else {
        put(HAND[hitN % HAND.length], j() * 20, j() * 40, 3 * K, hitN % 3 === 2 ? !flip : flip);
        if (hitN % 2) put('dot-hand-c', j() * 30, j() * 50, 2.4 * K, Math.random() < 0.5, 0.04);
      }
    };
    const hit = (kind: HitKind, o: Partial<HitSpec> = {}) => {
      if (!foeOk() || !o0) return;
      const at = { x: o0.x - this.face * 22, y: o0.midY() + (Math.random() - 0.5) * 50 };
      const r = o0.receive(this, { use, kind, at, noVfx: true, ...o });
      if (r === 'hit') {
        hitN++;
        const big = kind !== 'light' || hitN === 1 || hitN % 4 === 0;
        bigFx(at.x, at.y, big);
        this.freeze = Math.max(this.freeze, o.stop ?? 0.05);
        this.st.shake(big ? 12 : 7);
      }
    };
    // 한 대: 그 장들을 빠르게, 때리는 장에서 맞힘
    const beat = (id: string, heavy: boolean, d: number, f: () => void, then: () => void) => {
      const s0 = normalSeq(this.art, id, heavy), imp0 = Math.max(0, s0.findIndex((e) => e.act));
      // 킹오파 난무 박자 (11-09 롬 대조): 때리기 직전 두 장 → 때리는 장 → 한 장. 약 6~8게임장마다 한 대
      const G = 1 / 60, k = d >= 0.6 ? 2 : d >= 0.5 ? 1.5 : 1;
      const a = Math.max(0, imp0 - 2), imp = imp0 - a;
      const s = s0.slice(a, imp0 + 2).map((e, i) => ({ ...e, d: (i < imp ? 1 : 2) * G * k, act: false, cancel: false }));
      s[imp].fn = f;
      this.play(id, s, { onEnd: then });
    };
    let phase = 'dash';
    const glue = () => { if (o0 && foeOk() && o0.z <= 0 && phase === 'beat') this.x += ((o0.x - this.face * gap()) - this.x) * 0.5; };
    const runBeats = (i: number) => {
      if (!foeOk()) return end();
      if (i >= beats.length) return launch();
      const id = beats[i], heavy = id === H;
      beat(id, heavy, heavy ? 0.5 : 0.45, () => hit(heavy ? 'heavy' : 'light', { lock: 0.9, stop: heavy ? 0.1 : 0.03 }), () => runBeats(i + 1));
    };
    const launch = () => {
      phase = 'launch';
      beat(H, true, 0.7, () => {
        hit('launch', { stop: 0.16 });
        if (o0) {
          // 띄우기: 상대 발밑에서 불기둥이 솟는다. 캐릭터 뒤에 깔아 몸을 가리지 않음
          this.st.fx.push({ k: 'sheet', name: 'dot-hand-pillar', x: o0.x, y: LINE + 6, s: 2 * K, anchor: 'pivot', under: true, t: 9, t0: 9, el: 0 });
        }
        this.st.shake(16);
      }, () => jumpUp());
    };
    const jumpUp = () => {
      if (!foeOk()) return end();
      phase = 'air';
      this.vz = 1200; this.z = 1; this.air = true; this.vx = 0;
      this.st.sfx({ type: 'jump', x: this.x });
      const n7 = nOf(this.art, '7');
      this.play('7', steps(range(0, Math.min(2, n7 - 1)), 0.03), { onEnd: () => airHits(0) });
    };
    const airHits = (i: number) => {
      if (!foeOk()) return end();
      if (i >= AIR) return spike();
      beat(this.has('14') ? '14' : H, false, 0.5, () => hit('light', { lock: 1, stop: 0.05 }), () => airHits(i + 1));
    };
    const spike = () => {
      phase = 'spike';
      beat(this.has('14') ? '14' : H, true, 0.8, () => {
        hit('spike', { stop: 0.35 });
        if (o0 && foeOk()) { o0.vz = -2800; o0.vx = this.face * 120; o0.freeze = 0.35; }
        this.st.bgWhite?.(2 / 60);   // 화면 전체를 덮지 않고 배경만 (킹오파)
        this.st.shake(18);
        phase = 'fall';
      }, () => { if (phase !== 'fall') end(); });
    };
    this.rush = () => {
      if (!o0) return end();
      if (phase === 'dash') {
        this.vx = this.face * 1700;
        const d = Math.abs(o0.x - this.x) - gap();
        if (d <= 10) { this.vx = 0; phase = 'beat'; runBeats(0); }
        else if (this.stT > 0.6) end();
        return;
      }
      glue();
      if (phase === 'air') {
        // 띄운 상대를 내 앞 조금 위에 붙여 둔다 (같이 올라갔다 내려옴)
        if (foeOk()) { o0.x += ((this.x + this.face * gap()) - o0.x) * 0.4; o0.z += ((this.z + 30) - o0.z) * 0.4; o0.vz = this.vz; }
      }
      if (phase === 'fall') {
        if (!foeOk() || o0.z <= 0 || o0.state === 'down' || o0.state === 'ko') {
          phase = 'done';
          const x = o0.x;
          // 마무리 (11-09 5판): 배경만 하얗게 → 쓰러진 상대 뒤 불기둥 + 몸 위 큰 한 방(크게), 조금 뒤 하나 더
          this.st.bgWhite?.(4 / 60);
          this.st.fx.push({ k: 'sheet', name: 'dot-hand-pillar', x, y: LINE + 6, s: 2.2 * K, anchor: 'pivot', under: true, t: 9, t0: 9, el: 0 });
          this.st.fx.push({ k: 'sheet', name: 'dot-hand-big3', x, y: LINE - 60 * K, s: 2.8 * K, flip: this.face < 0, anchor: 'center', t: 9, t0: 9, el: 0 });
          later(this.st, 0.2, () => { this.st.bgWhite?.(2 / 60); this.st.fx.push({ k: 'sheet', name: 'dot-hand-big3', x: x + this.face * 50, y: LINE - 110 * K, s: 2.3 * K, flip: this.face > 0, anchor: 'center', t: 9, t0: 9, el: 0 }); });
          this.st.sfx({ type: 'hit', strength: 3, kind: 'blast', x });
          later(this.st, 0.22, () => this.st.sfx({ type: 'hit', strength: 3, kind: 'blast', x }));
          this.st.shake(24);
          this.st.fx.push({ k: 'dust', x, y: LINE, t: 0.6, t0: 0.6, n: 16, seed: Math.random() * 99 });
          this.freeze = 0.12;
          end();
        }
      }
    };
    this.st.superFlash(this, name);
  }

  // ───────── 맞기 ─────────
  /** 상대 공격 하나를 받는다. 'miss' | 'guard' | 'hit' */
  receive(by: Fighter, h: HitSpec): 'miss' | 'guard' | 'hit' {
    if (!this.alive || this.state === 'ko' || this.deadT >= 0) return 'miss';
    if (this.inv > 0 || (this.vanish && this.vanish.out)) return 'miss';
    const use = h.use;
    if (this.gotIds.has(use.id) && h.normal) return 'miss';
    if (h.normal) this.gotIds.add(use.id);
    if (this.gotIds.size > 200) this.gotIds.clear();
    const dir = (Math.sign(this.x - by.x) || by.face) as 1 | -1;
    const at = h.at ?? { x: this.x - dir * 20, y: this.midY() };
    const t = this.st.t;
    this.chainN = t - this.chainT < CHAIN_GAP ? this.chainN + 1 : 1;
    this.chainT = t;
    // 막기: 뒤로 누른 채 서 있으면 (평타 헛손질에는 막기 자세가 나오지 않는다)
    const backHeld = this.ctl.held.has(dir > 0 ? 'right' : 'left');
    const canGuard = this.z <= 0 && !use.unblock && (this.state === 'guard' || (backHeld && (this.state === 'idle' || this.state === 'back' || this.state === 'run')));
    if (canGuard) {
      const heavy = h.kind !== 'light';
      const chip = Math.round(this.scaleDmg(use, h) * (use.special ? CHIP.special : CHIP.normal));
      this.takeDmg(by, use, chip, 0.5);
      if (this.state !== 'guard') this.guardPose();
      this.stun = Math.max(STUN.blockHold, heavy ? STUN.blockHeavy : STUN.blockLight);
      this.vx = dir * (heavy ? PUSH.guardHeavy : PUSH.guard);
      this.freeze = FREEZE.guard;
      if (h.normal) by.freeze = FREEZE.guard;
      this.st.sfx({ type: 'guard', x: this.x });
      this.st.fx.push({ k: 'spark', x: at.x, y: at.y, t: 0.18, t0: 0.18, c: '#bfe0ff', n: 6, seed: Math.random() * 99 });
      if (this.hp <= 0) { this.koFly(dir); return 'hit'; }
      if (this.chainN >= CHAIN_DOWN) { this.chainN = 0; this.knock('down', dir); }
      this.wallPush(by, dir, heavy ? PUSH.guardHeavy : PUSH.guard);
      return 'guard';
    }
    // 맞음
    const lying = this.state === 'down' || this.state === 'getup';
    const multi = use.kind !== 'light' && use.kind !== 'heavy' && use.kind !== 'launch' && use.kind !== 'blow' && use.kind !== 'jump';
    // 여러 대 맞는 기술은 처음 맞힌 때의 배율로 끝까지 (기술 안에서 콤보 줄임·누운 상대 한도에 걸려 피해가 사라지지 않게)
    if (lying && this.otg >= OTG_MAX && !(multi && use.sc != null)) return 'miss';
    let dmg: number;
    if (multi && use.sc != null) dmg = this.scaleDmg(use, h, use.sc);
    else {
      let k = Math.max(SCALE.min, 1 - SCALE.step * this.comboTaken);
      if (lying) k *= OTG_MUL;
      else if (this.z > 0 || this.state === 'air') k *= JUGGLE_MUL;
      if (multi) use.sc = k;
      dmg = this.scaleDmg(use, h, k);
    }
    // 기술 전체 피해를 다 쓴 뒤의 대는 피해 없이 맞는 모습만
    dmg = multi && use.dealt >= use.budget ? 0 : Math.max(1, Math.round(dmg));
    this.takeDmg(by, use, dmg, 1);
    this.comboTaken++;
    by.combo = this.comboTaken;
    this.hurtT = 0.12;
    const big = h.kind !== 'light';
    const fr = h.stop != null ? h.stop : use.kind === 'super' ? FREEZE.super : h.kind === 'launch' || h.kind === 'blow' || h.kind === 'down' ? FREEZE.big : big ? FREEZE.heavy : FREEZE.light;
    this.freeze = fr;
    if (h.normal) by.freeze = fr;
    this.st.shake(h.kind === 'launch' || h.kind === 'blow' || h.kind === 'down' || use.kind === 'super' ? 12 : big ? 9 : 4);
    // 맞은 쪽만 잠깐 하얗게 (11-09 묵직함)
    this.whiteT = big ? 0.07 : 0.05;
    // 돌진 필살기 연타는 하얗게 덮지 않음 (11-09 3판: 맞는 몸이 내내 흰 덩어리로 보임)
    if (h.noVfx) { this.whiteT = 0; this.hurtT = 0.04; }
    this.st.sfx({ type: 'hit', strength: big ? 3 : 1, kind: use.kind === 'super' ? 'super' : (this.cfg.kick || []).includes(by.anim?.id) ? 'kick' : undefined, by: by.name, x: this.x });
    if (!h.noVfx) this.hitVfx(by, h, at, big);
    if (this.hp <= 0) { this.koFly(dir); return 'hit'; }
    if (lying) {
      if (!(multi && use.sc != null && this.otg >= OTG_MAX)) this.otg++;
      this.lieT = Math.min(this.lieT, LIE_SEC * 0.6);
      if (this.has('43')) { const n = nOf(this.art, '43'); this.play('43', steps(range(0, n - 1), 0.05), { onEnd: () => this.lie() }); }
      return 'hit';
    }
    if (this.bindT > 0 && h.kind !== 'launch' && h.kind !== 'blow' && h.kind !== 'down') { this.vx = 0; this.hitPose(STUN.light, h.kind); return 'hit'; }
    if (h.lock) {
      if (this.z > 0 || this.state === 'air') { if (this.state !== 'air') this.knock('launch', dir, 0.3); return 'hit'; }
      this.vx = dir * 40; this.chainN = 0; this.hitPose(h.lock, h.kind); return 'hit';
    }
    if (this.z > 0 || this.state === 'air') {
      this.juggle++;
      const k = this.juggle > JUGGLE_MAX ? 0 : Math.max(0.35, 1 - this.juggle * 0.15);
      if (h.kind === 'blow' || h.kind === 'down' || h.kind === 'spike') this.knock(h.kind === 'spike' ? 'down' : h.kind, dir, k || 0.3);
      else { this.vz = Math.max(this.vz, PUSH.air.vz * k); this.vx = dir * PUSH.air.vx; if (this.state !== 'air') this.knock('launch', dir, k); }
      return 'hit';
    }
    if (this.chainN >= CHAIN_DOWN) { this.chainN = 0; this.knock('down', dir); return 'hit'; }
    switch (h.kind) {
      case 'launch': this.knock('launch', dir); break;
      case 'blow': this.knock('blow', dir); break;
      case 'down': case 'spike': this.knock('down', dir); break;
      case 'pull': this.vx = -dir * 520; this.hitPose(STUN.heavy, 'heavy'); break;
      case 'stun': this.vx = dir * PUSH.light; this.hitPose(STUN.heavy + 0.2, 'heavy'); break;
      default: this.vx = dir * (big ? PUSH.heavy : PUSH.light); this.hitPose(big ? STUN.heavy : STUN.light, h.kind);
    }
    this.wallPush(by, dir, big ? PUSH.heavy : PUSH.light);
    return 'hit';
  }
  /** 이어 맞을수록 줄이기 + 기술 전체 피해 한도 */
  private scaleDmg(use: Use, h: HitSpec, k = Math.max(SCALE.min, 1 - SCALE.step * this.comboTaken)): number {
    const base = use.kind === 'light' || use.kind === 'heavy' || use.kind === 'launch' || use.kind === 'blow' || use.kind === 'jump' ? use.budget : Math.min(use.per, Math.max(0, use.budget - use.dealt));
    void h;
    return base * k;
  }
  private takeDmg(by: Fighter, use: Use, dmg: number, gain: number): void {
    use.dealt += use.kind === 'light' || use.kind === 'heavy' || use.kind === 'launch' || use.kind === 'blow' || use.kind === 'jump' ? 0 : Math.max(1, use.per);
    dmg = Math.round(Math.max(0, dmg) * by.dmgMul);
    this.st.log?.({ by: by.name, to: this.name, kind: use.kind, clip: by.anim?.id, id: use.id, dmg, guard: gain < 1 });
    if (dmg <= 0) return;
    this.hp = Math.max(this.noKo ? 1 : 0, this.hp - dmg);
    if (!by.inSuper) by.gauge = Math.min(100, by.gauge + dmg * GAUGE.deal * gain);
    this.gauge = Math.min(100, this.gauge + dmg * GAUGE.take);
  }
  private wallPush(by: Fighter, dir: number, v: number): void {
    const L = this.st.L;
    if ((dir > 0 && this.x > L - WALL - 20) || (dir < 0 && this.x < WALL + 20)) if (by.z <= 0) by.vx = -dir * v * 0.7;
  }
  private hitVfx(by: Fighter, h: HitSpec, at: { x: number; y: number }, big: boolean): void {
    const flip = by.face < 0;
    const hv = h.use.hitVfx;
    if (dotSample(by)) this.st.fx.push({ k: 'sheet', name: 'dot-impact', x: at.x, y: at.y, s: 1.5 * K, flip, anchor: 'center', t: 9, t0: 9, el: 0 });
    else if (h.vfx) this.st.fx.push({ k: 'sheet', name: h.vfx, x: at.x, y: at.y, s: (h.vs || 1) * K, flip, anchor: 'center', tint: h.tint, t: 9, t0: 9, el: 0 });
    else if (hv) this.st.fx.push({ k: 'sheet', name: hv.n, x: at.x, y: at.y, s: hv.s * K, flip, anchor: 'center', t: 9, t0: 9, el: 0 });
    else this.st.fx.push({ k: 'sheet', name: big ? 'hit_heavy' : 'hit_light', x: at.x, y: at.y, s: big ? 2.6 : 2.2, flip, anchor: 'pivot', t: 9, t0: 9, el: 0 });
    this.st.fx.push({ k: 'spark', x: at.x, y: at.y, t: big ? 0.3 : 0.2, t0: big ? 0.3 : 0.2, c: big ? '#fff2b0' : '#ffffff', n: big ? 14 : 7, seed: Math.random() * 99 });
  }
  private hitPose(sec: number, kind: HitKind): void {
    this.setState('hit');
    this.rush = null;
    this.atk = null; this.inSuper = false; this.charge0();
    this.stun = sec;
    const id = kind === 'heavy' && this.has('18_2') ? '18_2' : '18';
    this.play(id, [{ f: 0, d: 99 }]);
  }
  private charge0(): void { this.chargeT = 0; }
  private hitTick(): void {
    this.stun -= DT;
    const a = this.anim;
    if (a) {
      const n = nOf(this.art, a.id), p = 1 - Math.max(0, this.stun) / Math.max(0.01, this.stT + Math.max(0, this.stun));
      const peak = a.id === '18_2' ? n - 1 : Math.min(n - 1, 3);
      const f = p < 0.35 ? (p / 0.35) * peak : p < 0.7 ? peak : peak * (1 - (p - 0.7) / 0.3);
      a.steps[0].f = Math.max(0, Math.min(n - 1, Math.round(f)));
    }
    if (this.stun <= 0) { this.comboTaken = 0; this.toIdle(); }
  }
  /** 띄우기 · 날리기 · 넘어뜨리기 */
  knock(kind: 'launch' | 'blow' | 'down', dir: number, k = 1): void {
    this.setState('air');
    this.rush = null;
    this.atk = null; this.inSuper = false; this.charge0();
    this.airKind = kind;
    const p = kind === 'launch' ? PUSH.launch : kind === 'blow' ? PUSH.blow : PUSH.down;
    this.vz = p.vz * k; this.vx = dir * p.vx * Math.max(0.5, k); this.z = Math.max(1, this.z);
    this.air = true;
    this.airT = 0; this.airT0 = Math.max(0.3, (2 * this.vz) / (GRAV * (kind === 'launch' ? LAUNCH_GRAV : 1)));
    const id = kind === 'launch' && this.has('18_3') ? '18_3' : '19';
    this.play(id, [{ f: 0, d: 99 }]);
  }
  koFly(dir: number): void {
    this.knock('blow', dir);
    this.setState('ko');
    this.airKind = 'ko';
    this.vz = PUSH.ko.vz; this.vx = dir * PUSH.ko.vx;
    this.airT0 = (2 * this.vz) / GRAV;
    this.inv = 0;
    this.st.sfx({ type: 'down', x: this.x });
  }
  private lieFrom(): number { const m = this.art.A['19']; return m ? Math.min(m.n - 1, m.bot.indexOf(Math.min(...m.bot)) + 1) : 0; }
  private airTick(): void {
    this.airT += DT;
    const a = this.anim;
    if (this.liftT > 0) { this.liftT -= DT; this.vz = 0; this.z += (this.liftH - this.z) * 0.2; }
    if (a) {
      const n = nOf(this.art, a.id);
      if (a.id === '18_3') a.steps[0].f = Math.max(0, Math.min(n - 1, Math.round((this.airT / this.airT0) * (n - 1))));
      else { const lf = this.lieFrom(); a.steps[0].f = Math.max(0, Math.min(lf - 1, Math.round((this.airT / this.airT0) * Math.max(0, lf - 1)))); }
    }
    if (this.z <= 0 && this.vz <= 0 && this.airT > 0.05) {
      this.z = 0; this.vz = 0; this.air = false;
      this.st.sfx({ type: 'land', x: this.x });
      this.st.fx.push({ k: 'dust', x: this.x, y: LINE, t: 0.45, t0: 0.45, n: 8, seed: Math.random() * 99 });
      this.st.shake(4);
      this.fall();
    }
  }
  /** 땅에 닿음: 쓰러진 장으로 */
  private fall(): void {
    const ko = this.state === 'ko';
    if (!ko) this.setState('down');
    this.airKind = null;
    this.juggle = 0;
    this.vx *= 0.35;
    const lf = this.lieFrom(), n = nOf(this.art, '19');
    this.lieT = LIE_SEC;
    this.play('19', steps(range(lf, n - 1), 0.06), { onEnd: () => this.lie() });
  }
  private lie(): void {
    const n = nOf(this.art, '19');
    const lp = ((this.cfg.lie19 as number[]) || []).map((f) => Math.max(0, Math.min(n - 1, f - 1)));
    this.play('19', lp.length ? steps(lp, 0.12) : [{ f: n - 1, d: 99 }], { loop: lp.length ? 0 : -1 });
  }
  private downTick(): void {
    this.vx *= 0.9;
    if (this.state === 'ko') return;
    // 상대 필살기 중에는 누운 채 (일어나며 무적이 되어 필살기 나머지가 헛나가지 않게)
    if (!this.foes().some((f) => f.inSuper)) this.lieT -= DT;
    if (this.lieT <= 0 && (this.anim?.id === '19')) this.getUp();
  }
  private getUp(): void {
    this.setState('getup');
    this.otg = 0; this.comboTaken = 0; this.chainN = 0;
    const id = this.has('20') ? '20' : this.idleId(), n = nOf(this.art, id);
    this.inv = n * 0.07 + 0.15;
    this.play(id, steps(range(0, n - 1), 0.07), { onEnd: () => this.toIdle() });
  }

  // ───────── 몸 움직임 ─────────
  private physics(dt: number): void {
    const groundState = this.state !== 'air' && this.state !== 'ko' && this.state !== 'jump';
    if (!groundState || this.z > 0) {
      if (this.liftT <= 0) { this.vz -= GRAV * (this.state === 'air' && this.airKind === 'launch' ? LAUNCH_GRAV : 1) * dt; this.z += this.vz * dt; }
      if (this.z < 0) this.z = 0;
      this.x += this.vx * dt;
    } else {
      this.x += this.vx * dt;
      const driven = this.state === 'run' || this.state === 'back' || this.state === 'dash' || (this.state === 'atk' && this.stT < 0.15 && !!this.atk?.normal);
      if (!driven) this.vx = Math.sign(this.vx) * Math.max(0, Math.abs(this.vx) - FRICTION * dt);
    }
    const L = this.st.L;
    this.x = Math.max(WALL, Math.min(L - WALL, this.x));
  }

  // ───────── 판 끝·판 사이 ─────────
  /** 판 끝 자세 (이긴 쪽 35 기뻐하기, 진 쪽 32 화내기). 하던 동작이 끝나면 */
  emote(id: string): void {
    if (!this.has(id) || this.state === 'ko' || this.state === 'down' || this.state === 'air' || this.state === 'pose' || this.state === 'atk' || this.state === 'hit' || this.state === 'getup') return;
    this.setState('pose');
    this.atk = null; this.vx = 0;
    const n = nOf(this.art, id);
    this.play(id, steps(range(0, n - 1), 1 / 8), { onEnd: () => this.toIdle() });
  }
  /** 새 판 자리 */
  reset(x: number, face: 1 | -1, hp: number): void {
    this.x = x; this.z = 0; this.vx = 0; this.vz = 0; this.face = face; this.hp = hp;
    this.freeze = 0; this.hold = 0; this.inv = 0; this.stun = 0; this.air = false; this.chainN = 0; this.comboTaken = 0; this.combo = 0;
    this.juggle = 0; this.otg = 0; this.atk = null; this.inSuper = false; this.pending = null; this.rush = null; this.buf = null; this.vanish = null; this.bindT = 0; this.liftT = 0;
    this.force = null; this.lightIdx = 0; this.lightEnd = -9; this.flashT = 0;
    this.toIdle();
  }

  // ───────── 그리기 ─────────
  draw(c: CanvasRenderingContext2D, look: { red?: number; white?: number; slowJit?: boolean } = {}): void {
    const { id, f, air } = this.pose();
    let alpha = this.alpha;
    if (this.vanish) { const k = Math.min(1, this.vanish.t / this.vanish.d); alpha *= this.vanish.out ? 1 - k : k; }
    if (alpha <= 0.01) return;
    const jit = this.freeze > 0 && this.hurtT > 0 ? (Math.floor(performance.now() / 33) % 2 ? 3 : -3) : 0;
    const over = look.red ? { c: '#ff2a1a', a: look.red } : this.whiteT > 0 ? { c: '#ffffff', a: 0.85 } : this.flashT > 0 ? { c: this.flashC, a: Math.min(0.85, this.flashT * 3) } : this.hurtT > 0 ? { c: '#ffffff', a: this.hurtT * 3 } : undefined;
    // 잔상 (캐릭터 기운색, 오래된 것일수록 옅게)
    this.trail.forEach((g, i) => { if (i % 2) drawSprite(c, this.art, g.id, g.f, g.x, g.z, g.face, g.air, { over: { c: '#ff9a28', a: 0.85 }, alpha: 0.18 + 0.08 * i }); });
    // 돌진 난무 중엔 몸 전체를 기운색으로 물들임 (11-09 킹오파식)
    const tint = !over && this.rush ? { c: '#ff9a28', a: 0.28 } : over;
    drawSprite(c, this.art, id, f, this.x + jit, this.z, this.face, air, { over: tint, alpha });
    if (this.state === 'charge') {
      const m = this.muzzle(), lv = this.chargeLv();
      drawVfx(c, 'charge_gather', this.st.t, m.x, m.y, 1.2 + Math.min(1, this.chargeT) * 0.8, { loop: true, anchor: 'center', tint: ['#ffffff', '#fff6c0', '#8fdcff', '#c89bff'][Math.min(3, lv)] });
    }
  }
}

export const overlap = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
