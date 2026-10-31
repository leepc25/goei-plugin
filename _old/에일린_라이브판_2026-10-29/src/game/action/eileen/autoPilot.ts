// 자동전투 (모바일 조작 설계 2026-10-28: 「대련 전투 AI(가상 버튼)가 내 캐릭터 버튼을 대신 누름」).
// 대련 상대(aiFighter.ts)와 같은 두뇌(combat/brain.ts FighterBrain, 난이도 normal·기본 성향)가 주인공 에일린의 Pad 를 만든다.
// 스틱(방향)을 만지면 그동안 직접 조작이 먼저: 자동은 멈추고, 놓은 뒤 1초가 지나면 다시 자동. 공격 버튼을 누르면 그 입력도 섞인다(OR).
// 적이 없으면(본부·적 없는 거리) 아무것도 누르지 않는다. 켜짐은 저장하지 않는다(세션 한정).
import type { Body, WorldView } from '../engine/contract';
import type { Btn as PadBtn, Pad } from '../engine/input';
import { FighterBrain, type Btn, type Persona, type SelfSense } from '../../combat/brain';
import { mulberry32 } from '../../world/rng';
import { foeSense } from './aiFighter';

const BTN: Record<Btn, PadBtn | null> = { left: 'left', right: 'right', up: 'up', down: 'down', light: 'light', heavy: 'heavy', block: 'block', dodge: 'dodge', jump: 'jump', shoot: 'shoot', charge: 'charge', skill: 'skill', super: 'super', run: null };
/** 기본 성향 (대련 세 상대의 가운데쯤) */
const PERSONA: Persona = { aggression: 0.55, patience: 0.55, zoning: 0.4, courage: 0.85 };
/** 스틱을 놓고 다시 자동이 되기까지 (틱, 30Hz = 1초) */
const MANUAL_HOLD = 30;

/** 자동이 읽는 주인공 몸 (에일린 코어) */
export interface AutoSelf extends Body {
  readonly dir: 1 | -1;
  readonly guard: number;
  readonly phase?: string;
  readonly core: { P: { mode: string; z: number; sp?: number } };
}

export class AutoPilot {
  /** 켜짐 (AUTO 버튼·O 키) */
  on = false;
  /** 직접 조작 중인가 (스틱 아날로그 ≠ 0 또는 방향키) — 껍데기가 넣는다 */
  manual: () => boolean = () => false;
  private brain: FighterBrain;
  /** 두뇌가 지난 틱에 누르고 있던 버튼 */
  private held = new Set<PadBtn>();
  private manualT = 0;
  /** 시험용: 마지막으로 두뇌가 고른 전술, 그동안 섞은 버튼 수 */
  last = { tactic: '', pressed: [] as PadBtn[], foe: false, manual: false, presses: 0, counts: {} as Partial<Record<PadBtn, number>> };
  constructor(seed = 20261029) {
    this.brain = new FighterBrain('auto-player', 'B', 'normal', PERSONA, mulberry32(seed));
  }
  /** 가장 가까운 적 (살아 있고 체력이 남은 적 편 몸) */
  static foe(self: Body, w: WorldView): Body | null {
    let best: Body | null = null,
      bd = Infinity;
    for (const b of w.bodies) {
      if (!AutoPilot.isFoe(b)) continue;
      const d = Math.abs(b.x - self.x) + Math.abs(b.y - self.y) * 0.5;
      if (d < bd) (bd = d), (best = b);
    }
    return best;
  }
  private static isFoe(b: Body) {
    return b.alive && b.team === 'enemy' && b.hp > 0 && !b.kind.startsWith('proj') && b.kind !== 'bullet';
  }
  /** 싸울 상대가 있는가 (없으면 AUTO 버튼을 흐리게) */
  static fight(w: WorldView | null): boolean {
    return !!w && w.bodies.some((b) => AutoPilot.isFoe(b));
  }
  /** 두뇌가 쥔 버튼을 모두 놓는 Pad (자동이 멈출 때 막기·충전이 눌린 채 남지 않게) */
  private release(pad: Pad): Pad {
    if (!this.held.size) return pad;
    const released = new Set(pad.released);
    for (const b of this.held) if (!pad.held.has(b)) released.add(b);
    this.held.clear();
    return { ...pad, released };
  }
  /** 엔진 틱마다: 사람 입력 pad 를 받아 자동 입력을 섞은 pad 를 돌려준다 */
  apply(self: AutoSelf, w: WorldView, pad: Pad): Pad {
    if (!this.on) return this.release(pad);
    const man = this.manual() || pad.mx !== 0 || pad.my !== 0;
    if (man) this.manualT = MANUAL_HOLD;
    else if (this.manualT > 0) this.manualT--;
    this.last.manual = this.manualT > 0;
    if (this.manualT > 0) return this.release(pad);
    const foe = AutoPilot.foe(self, w);
    this.last.foe = !!foe;
    if (!foe) return this.release(pad);
    const P = self.core.P;
    const me: SelfSense = {
      x: self.x, y: self.y, z: self.z, face: self.dir,
      free: ['ground', 'chain', 'block'].includes(P.mode),
      air: P.mode === 'air',
      stunned: ['down', 'belly', 'stun'].includes(P.mode) || self.phase === 'down',
      lying: (P.mode === 'down' || P.mode === 'belly') && self.phase !== 'down',
      hp: self.hpMax ? self.hp / self.hpMax : 1, sp: P.sp ?? 0, guard: self.guard,
    };
    const d = this.brain.tick(me, foeSense(foe));
    this.last.tactic = this.brain.tactic;
    const was = this.held;
    const now = new Set<PadBtn>();
    const pressed = new Set(pad.pressed);
    const released = new Set(pad.released);
    for (const b of d.hold) {
      const k = BTN[b];
      if (k) now.add(k);
    }
    const auto: PadBtn[] = [];
    for (const b of d.press) {
      const k = BTN[b];
      if (!k) continue;
      pressed.add(k);
      auto.push(k);
      this.last.counts[k] = (this.last.counts[k] ?? 0) + 1;
      if (b === 'charge' || b === 'block') now.add(k);
    }
    // 두뇌가 뗀 것, 대본이 바뀌어 사라진 것은 뗀다 (사람이 누르고 있으면 그대로)
    for (const b of d.release) {
      const k = BTN[b];
      if (k && was.has(k) && !pad.held.has(k)) released.add(k);
    }
    for (const k of was) if (!now.has(k) && !pad.held.has(k)) released.add(k);
    this.held = now;
    this.last.pressed = auto;
    this.last.presses += auto.length;
    const held = new Set([...pad.held, ...now]);
    const mx = held.has('right') ? 1 : held.has('left') ? -1 : 0;
    const my = held.has('down') ? 1 : held.has('up') ? -1 : 0;
    return { held, pressed, released, mx, my, evade: pad.evade, run: pad.run || d.hold.has('run'), downDouble: pad.downDouble };
  }
}
