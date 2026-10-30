// 전투 AI 상대(10-29 본 게임 탑재): 인물 플레이어(fighter/player.ts)를 가상 버튼으로 조종하는 적 몸 (docs/전투_AI_설계.md 3장 「AI도 플레이어와 같은 버튼」).
// eileen/aiFighter.ts 를 126명 공용으로: 어떤 인물 팩이든 같은 두뇌를 그 키트에 붙인다(13장).
import { NPC_SKILL_MUL } from '../../combat/grades';
import type { Body, WorldView } from '../engine/contract';
import type { Btn as PadBtn, Pad } from '../engine/input';
import type { FrameInfo } from '../engine/art';
import { FighterPlayer } from './player';
import type { CharArt } from '../art/charPacks';
import { FighterBrain, Squad, type Btn, type Difficulty, type FoeSense, type Grade, type Persona, type SelfSense } from '../../combat/brain';
import { mulberry32 } from '../../world/rng';

const BTN: Record<Btn, PadBtn | null> = { left: 'left', right: 'right', up: 'up', down: 'down', light: 'light', heavy: 'heavy', block: 'block', dodge: 'dodge', jump: 'jump', shoot: 'shoot', charge: 'charge', skill: 'skill', super: 'super', run: null };

/** 상대 몸 → 두뇌가 보는 모습 (테스트룸 코어면 자세까지 읽는다) */
export function foeSense(b: Body): FoeSense {
  const P = (b as unknown as { core?: { P: { mode: string; z: number } } }).core?.P;
  const mode = P?.mode ?? (b as unknown as { phase?: string }).phase ?? 'ground';
  return {
    x: b.x, y: b.y, z: b.z,
    attacking: mode === 'act',
    recovering: mode === 'chain',
    air: (P?.z ?? b.z) > 6 || mode === 'air',
    down: mode === 'down' || mode === 'belly' || mode === 'dead',
    hp: b.hpMax ? b.hp / b.hpMax : 1,
  };
}

export class FighterAi extends FighterPlayer {
  readonly brain: FighterBrain;
  private pad: Pad = { held: new Set(), pressed: new Set(), released: new Set(), mx: 0, my: 0, evade: false, run: false, downDouble: false };
  constructor(clips: Record<string, FrameInfo[]>, art: CharArt, o: { id: string; grade: Grade; difficulty: Difficulty; persona: Persona; seed: number; squad?: Squad; label?: string }) {
    super(clips, art);
    // 적 편 몸 (Player는 'player'로 굳어 있어서 덮는다)
    Object.defineProperty(this, 'team', { value: 'enemy', configurable: true });
    Object.defineProperty(this, 'kind', { value: 'ai-char', configurable: true });
    this.label = o.label ?? `AI ${art.cfg.name}`;
    this.skillMul = NPC_SKILL_MUL;
    this.brain = new FighterBrain(o.id, o.grade, o.difficulty, o.persona, mulberry32(o.seed), o.squad);
  }
  /** 때릴 상대 = 주인공 (주인공 편 동행자가 생기면 여기에) */
  protected foes(): Body[] {
    const w = this.worldNow;
    return w && w.player.alive ? [w.player as unknown as Body] : [];
  }
  protected extraFoes() {
    return [];
  }

  step(world: WorldView): void {
    const me = this.core.P as unknown as { mode: string; z: number; sp: number };
    const self: SelfSense = {
      x: this.x, y: this.y, z: this.z, face: this.dir,
      free: ['ground', 'chain', 'block'].includes(me.mode),
      air: me.mode === 'air',
      stunned: ['down', 'belly', 'stun'].includes(me.mode) || this.phase === 'down',
      hp: this.hp / this.hpMax, sp: me.sp ?? 0, guard: this.guard,
    };
    const d = this.brain.tick(self, foeSense(world.player as unknown as Body));
    const p = this.pad;
    p.pressed.clear();
    p.released.clear();
    const was = new Set(p.held);
    p.held.clear();
    for (const b of d.hold) { const k = BTN[b]; if (k) p.held.add(k); }
    for (const b of d.press) { const k = BTN[b]; if (k) { p.pressed.add(k); if (b === 'charge' || b === 'block') p.held.add(k); } }
    for (const b of d.release) { const k = BTN[b]; if (k && was.has(k)) p.released.add(k); }
    p.run = d.hold.has('run');
    p.mx = p.held.has('right') ? 1 : p.held.has('left') ? -1 : 0;
    p.my = p.held.has('down') ? 1 : p.held.has('up') ? -1 : 0;
    p.evade = false;
    this.tick(world, p);
  }

  /** 렌더러가 몸 자리로 옮겨 놓고 부른다: 월드 좌표로 되돌려 코어가 그린다 */
  draw(ctx: CanvasRenderingContext2D): void {
    this.frameStep();
    ctx.save();
    ctx.translate(-this.x, -(this.y - this.z));
    ctx.imageSmoothingEnabled = false;
    this.core.drawBody(ctx);
    this.core.drawFxLayer(ctx);
    ctx.restore();
  }
}
