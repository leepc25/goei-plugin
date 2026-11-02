// 자동전투 (모바일 조작 설계 2026-10-28 「대련 전투 AI(가상 버튼)가 내 캐릭터 버튼을 대신 누름」. 11-02 사용자 「자동전투는 되살려야지 로직 확실하게 짜서」로 다시 씀)
//
// 규칙 (확정 로직):
//  1. 켜짐은 AUTO 단추·O 키 토글, 세션 한정(저장 안 함). 싸울 상대가 없으면 켤 수 없고(단추 흐림), 켜 둔 것은 언제든 끈다.
//  2. 상대 = 살아 있고 체력이 남은 적 편 전투 몸(대련 상대·적 요원·몹). 투사체·탄·필드 행위자 대리 몸(npc)은 상대가 아니다.
//     상대가 없으면 아무것도 누르지 않고, 두뇌가 쥐고 있던 버튼(막기·충전)은 놓는다.
//  3. 두뇌 = 대련 상대와 같은 FighterBrain(난이도 normal, 기본 성향). 이 인물에게 없는 동작·기술(강공 12·점프 7·사격 15 등)은 계획하지 않는다(kit).
//  4. 사람 입력이 먼저: 스틱·방향키를 만지는 동안 + 놓은 뒤 1초는 자동이 멈춘다(두뇌 버튼 전부 놓음). 공격 버튼은 자동 입력과 OR 로 섞인다.
//  5. 앉기·샤워·대화 등 주인공이 입력을 받지 않는 동안은 플레이어 틱이 자동을 부르지 않는다(fighter/player.ts tick). 쓰러져 있으면 두뇌는 일어나기만 한다.
//  6. 주인공이 죽었거나 자동을 끄면 쥔 버튼을 모두 놓는다.
import type { Body, WorldView } from '../engine/contract';
import type { Btn as PadBtn, Pad } from '../engine/input';
import { FighterBrain, type Btn, type FighterKit, type Persona, type SelfSense } from '../../combat/brain';
import { mulberry32 } from '../../world/rng';
import { foeSense } from './ai';
import type { CharArt } from '../art/charPacks';

const BTN: Record<Btn, PadBtn | null> = { left: 'left', right: 'right', up: 'up', down: 'down', light: 'light', heavy: 'heavy', block: 'block', dodge: 'dodge', jump: 'jump', shoot: 'shoot', charge: 'charge', skill: 'skill', super: 'super', run: null, flee: null, back: null };
/** 기본 성향 (대련 세 상대의 가운데쯤) */
const PERSONA: Persona = { aggression: 0.55, patience: 0.55, zoning: 0.4, courage: 0.85 };
/** 스틱을 놓고 다시 자동이 되기까지 (틱, 30Hz = 1초) */
const MANUAL_HOLD = 30;

/** 자동이 읽는 주인공 몸 (인물 코어) */
export interface AutoSelf extends Body {
  readonly dir: 1 | -1;
  readonly guard: number;
  readonly phase?: string;
  readonly art: CharArt;
  readonly core: { P: { mode: string; z: number; sp?: number }; has(id: string): boolean };
}

/** 인물이 가진 동작·기술로 두뇌 kit (fighter/ai.ts FighterAi 와 같은 규칙) */
export function kitOfArt(art: CharArt): Partial<FighterKit> {
  const has = (id: string) => !!art.A[id], sk = (art.cfg as { skills?: Record<string, unknown> }).skills ?? {};
  return {
    heavy: has('12'), jump: has('7'), jumpAtk: has('7') && has('14'), skill: !!sk.skill, charge: !!sk.charge, super: !!sk.super,
    shoot: has('15') && (art.cfg as { bal?: { gun?: string } }).bal?.gun !== 'none', dodge: has('16'), block: has('17'), flee: false, back: false,
  };
}

export class AutoPilot {
  /** 켜짐 (AUTO 버튼·O 키) */
  on = false;
  /** 직접 조작 중인가 (스틱 아날로그 ≠ 0) — 껍데기가 넣는다 */
  manual: () => boolean = () => false;
  private brain: FighterBrain | null = null;
  private brainFor: CharArt | null = null;
  private readonly seed: number;
  /** 두뇌가 지난 틱에 누르고 있던 버튼 */
  private held = new Set<PadBtn>();
  private manualT = 0;
  /** 시험용: 마지막으로 두뇌가 고른 전술, 그동안 섞은 버튼 수 */
  last = { tactic: '', pressed: [] as PadBtn[], foe: false, manual: false, presses: 0, counts: {} as Partial<Record<PadBtn, number>> };
  constructor(seed = 20261029) {
    this.seed = seed;
  }
  /** 싸울 상대인가: 살아 있고 체력이 남은 적 편 전투 몸. 투사체·탄·필드 행위자 대리 몸(npc)은 아니다 */
  static isFoe(b: Body): boolean {
    return b.alive && b.team === 'enemy' && b.hp > 0 && !b.kind.startsWith('proj') && b.kind !== 'bullet' && b.kind !== 'npc';
  }
  /** 가장 가까운 상대 (같은 줄 우선: 세로 차이는 절반으로 센다) */
  static foe(self: Body, w: WorldView): Body | null {
    let best: Body | null = null, bd = Infinity;
    for (const b of w.bodies) {
      if (!AutoPilot.isFoe(b)) continue;
      const d = Math.abs(b.x - self.x) + Math.abs(b.y - self.y) * 0.5;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  /** 싸울 상대가 있는가 (없으면 AUTO 버튼을 흐리게) */
  static fight(w: WorldView | null): boolean {
    return !!w && w.bodies.some((b) => AutoPilot.isFoe(b));
  }
  /** 끄기: 쥔 버튼은 다음 apply 에서 놓인다 */
  setOn(on: boolean) {
    this.on = on;
    if (!on) this.manualT = 0;
  }
  /** 두뇌가 쥔 버튼을 모두 놓는 Pad (자동이 멈출 때 막기·충전이 눌린 채 남지 않게) */
  private release(pad: Pad): Pad {
    this.last.pressed = [];
    if (!this.held.size) return pad;
    const released = new Set(pad.released);
    for (const b of this.held) if (!pad.held.has(b)) released.add(b);
    this.held.clear();
    return { ...pad, released };
  }
  private brainOf(self: AutoSelf): FighterBrain {
    if (!this.brain || this.brainFor !== self.art) {
      this.brain = new FighterBrain('auto-player', 'B', 'normal', PERSONA, mulberry32(this.seed), undefined, {}, kitOfArt(self.art));
      this.brainFor = self.art;
    }
    return this.brain;
  }
  /** 엔진 틱마다: 사람 입력 pad 를 받아 자동 입력을 섞은 pad 를 돌려준다 */
  apply(self: AutoSelf, w: WorldView, pad: Pad): Pad {
    if (!this.on || !self.alive || self.hp <= 0) return this.release(pad);
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
    const brain = this.brainOf(self);
    const d = brain.tick(me, foeSense(foe));
    this.last.tactic = brain.tactic;
    const was = this.held;
    const now = new Set<PadBtn>();
    const pressed = new Set(pad.pressed);
    const released = new Set(pad.released);
    for (const b of d.hold) { const k = BTN[b]; if (k) now.add(k); }
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
    for (const b of d.release) { const k = BTN[b]; if (k && was.has(k) && !pad.held.has(k)) released.add(k); }
    for (const k of was) if (!now.has(k) && !pad.held.has(k)) released.add(k);
    this.held = now;
    this.last.pressed = auto;
    this.last.presses += auto.length;
    const held = new Set([...pad.held, ...now]);
    const mx = held.has('right') ? 1 : held.has('left') ? -1 : 0;
    const my = held.has('down') ? 1 : held.has('up') ? -1 : 0;
    return { ...pad, held, pressed, released, mx, my, run: pad.run || d.hold.has('run') };
  }
}
