// 대전 AI (2026-11-08 새로 짬): 1P 와 같은 몸·같은 단추. 손 대신 누를 단추를 정한다.
// 거리 재기 · 헛친 틈 때리기 · 막기(너무 잘하지 않게) · 맞혔을 때만 콤보 잇기 · 붙으면 떨어지기(몸 비비며 치지 않게)
import { emptyCtl, type Btn, type Ctl, type Fighter } from './fighter';
import { K, BODY_HALF, TIP } from './rules';

export interface Persona { aggr: number; guard: number; zoning: number; patience: number }
export const PERSONAS: Persona[] = [
  { aggr: 0.75, guard: 0.3, zoning: 0.2, patience: 0.35 },
  { aggr: 0.45, guard: 0.45, zoning: 0.35, patience: 0.7 },
  { aggr: 0.5, guard: 0.35, zoning: 0.7, patience: 0.5 },
];

type Plan = { kind: 'idle' | 'approach' | 'retreat' | 'guard' | 'charge'; until: number; hold?: number };

export class Brain {
  private held = new Set<Btn>();
  private taps: { t: number; b: Btn }[] = [];
  private plan: Plan = { kind: 'idle', until: 0 };
  private nextThink = 0;
  private combo: Btn[] = [];
  private comboNext = 0;
  private prevHeld = new Set<Btn>();
  /** 공격을 마친 뒤 쉬는 끝 (쉬지 않고 계속 치지 않게: 사람이 끼어들 틈) */
  private rest = 0;
  private wasAtk = false;
  /** 동시 공격 허락 (서바이벌: 한꺼번에 둘까지) */
  canAttack: () => boolean = () => true;
  /** 멈춤 (판 시작 전·K.O. 뒤) */
  off = false;

  constructor(readonly me: Fighter, readonly p: Persona, readonly react = 0.2, readonly rand: () => number = Math.random) {}

  private tap(b: Btn, delay = 0) { this.taps.push({ t: this.me.st.t + delay, b }); }
  /** 평타가 닿는 거리 (몸 사이 틈, 월드) */
  private reach(): number {
    const m = this.me.art.A['9'] ?? this.me.art.A['12'];
    const r = m ? Math.max(...m.reach) : 100;
    return (r + TIP.front - BODY_HALF) * K;
  }

  think(): Ctl {
    const me = this.me, st = me.st, t = st.t, R = this.rand;
    const out = emptyCtl();
    if (this.off || me.hp <= 0) { this.held.clear(); this.combo = []; this.prevHeld = new Set(); return out; }
    const o = me.foe();
    const tw: Btn = !o || o.x >= me.x ? 'right' : 'left', away: Btn = tw === 'right' ? 'left' : 'right';
    const gap = o ? Math.abs(o.x - me.x) - (o.half() + me.half()) : 9999;
    const reach = this.reach();
    if (this.wasAtk && me.state !== 'atk') this.rest = t + (0.3 + R() * 0.5) * (0.6 + this.p.patience);
    this.wasAtk = me.state === 'atk';
    const busy = me.state === 'atk' || me.state === 'hit' || me.state === 'air' || me.state === 'down' || me.state === 'getup' || me.state === 'dash';

    // 콤보 잇기: 앞 공격이 맞았을 때만 다음 단추
    if (this.combo.length && t >= this.comboNext) {
      if (me.state === 'atk' && me.atk && me.atk.connected && me.anim?.step.cancel) { this.tap(this.combo.shift()!); this.comboNext = t + 0.05; }
      else if (me.state === 'atk' && me.atk && !me.atk.connected && (me.anim?.step.cancel || me.anim?.done)) this.combo = [];
      else if (me.state !== 'atk') this.combo = [];
    }

    if (o && t >= this.nextThink) {
      this.nextThink = t + this.react * (0.7 + R() * 0.6);
      this.held.clear();
      const foeAtk = o.state === 'atk' && !!o.atk && !o.atk.hit;
      const foeWhiff = o.state === 'atk' && !!o.atk && !o.atk.connected && !!o.anim?.step.cancel;
      const foeDown = o.state === 'down' || o.state === 'getup';
      const mine = st.proj.some((p) => p.owner === me && p.basic);
      const enemyProj = st.proj.some((p) => p.owner === o && Math.sign(me.x - p.x) === p.dir && Math.abs(me.x - p.x) < 520);
      if (!busy) {
        if ((foeAtk && gap < reach + 120) || enemyProj) {
          // 막기는 너무 잘하지 않게 (11-08 사용자)
          if (R() < this.p.guard) this.plan = { kind: 'guard', until: t + 0.3 + R() * 0.25 };
          else if (R() < 0.25) { this.tap(away); this.tap(away, 0.06); this.plan = { kind: 'idle', until: t + 0.3 }; }
          else this.plan = { kind: 'idle', until: t + 0.15 };
        } else if (foeWhiff && gap < reach + 20 && this.canAttack()) {
          this.startCombo(R() < 0.5 ? ['light', 'light', 'heavy'] : ['heavy']);
        } else if (me.gauge >= 100 && gap < reach + 160 && R() < 0.5 && this.canAttack() && !foeDown) {
          this.tap('light'); this.tap('heavy');
        } else if (gap < -10 && R() < 0.5) {
          // 붙으면 떨어지기 (몸 비비며 치지 않게)
          this.plan = { kind: 'retreat', until: t + 0.25 + R() * 0.2 };
        } else if (gap < reach - 6 && !foeDown && this.canAttack() && t < this.rest) {
          // 쉬는 중: 거리 두거나 지켜보기 (가끔 막기 자세)
          const r = R();
          this.plan = r < 0.45 ? { kind: 'retreat', until: t + 0.2 + R() * 0.2 } : r < 0.45 + this.p.guard * 0.5 ? { kind: 'guard', until: t + 0.25 } : { kind: 'idle', until: t + 0.15 };
        } else if (gap < reach - 6 && !foeDown && this.canAttack()) {
          const r = R();
          if (r < 0.42) this.startCombo(['light', 'light', 'light', 'heavy']);
          else if (r < 0.62) this.startCombo(['light', 'light', 'heavy', 'light']);
          else if (r < 0.78) this.startCombo(['heavy']);
          else if (r < 0.9 && me.skills.skill) this.tap('skill');
          else this.plan = { kind: 'retreat', until: t + 0.3 };
        } else if (foeDown) {
          this.plan = { kind: gap > reach ? 'approach' : 'idle', until: t + 0.3 };
          if (gap < reach && R() < 0.3 && this.canAttack()) this.tap('light');
        } else if (gap > 340 && !mine && R() < this.p.zoning && me.has('15')) {
          this.tap('shoot');
        } else if (gap > 420 && R() < this.p.zoning * 0.35 && me.skills.charge) {
          this.plan = { kind: 'charge', until: t + 0.5 + R() * 1.0 };
        } else if (gap > 260 && R() < 0.12 && me.skills.skill && this.canAttack()) {
          this.tap('skill');
        } else if (R() < this.p.aggr) {
          this.plan = { kind: 'approach', until: t + 0.25 + R() * 0.4 };
          if (gap > 300 && R() < 0.15) { this.tap(tw); this.tap(tw, 0.07); }
        } else if (R() < this.p.patience) this.plan = { kind: 'idle', until: t + 0.2 + R() * 0.4 };
        else this.plan = { kind: 'retreat', until: t + 0.2 + R() * 0.3 };
      }
    }
    if (t < this.plan.until && !busy) {
      if (this.plan.kind === 'approach') this.held.add(tw);
      if (this.plan.kind === 'retreat' || this.plan.kind === 'guard') this.held.add(away);
    }
    if (this.plan.kind === 'charge' && t < this.plan.until && (me.state === 'charge' || !busy)) this.held.add('charge');
    if (this.plan.kind === 'charge' && t < this.plan.until && me.state !== 'charge' && !busy && !this.taps.some((x) => x.b === 'charge')) this.tap('charge');
    // 맞는 중에도 뒤로 누른 채면 다음 공격을 막는다 (막기 자세 중일 때)
    if (me.state === 'guard' && me.stun > 0) this.held.add(away);

    for (const b of this.held) out.held.add(b);
    const now = this.taps.filter((x) => x.t <= t);
    this.taps = this.taps.filter((x) => x.t > t);
    for (const x of now) { out.pressed.add(x.b); out.held.add(x.b); }
    if (this.held.has('charge') && !this.prevHeld.has('charge')) out.pressed.add('charge');
    for (const b of this.prevHeld) if (!out.held.has(b)) out.released.add(b);
    this.prevHeld = new Set(out.held);
    return out;
  }

  private startCombo(seq: Btn[]) {
    this.tap(seq[0]);
    this.combo = seq.slice(1);
    this.comboNext = this.me.st.t + 0.08;
  }
}
