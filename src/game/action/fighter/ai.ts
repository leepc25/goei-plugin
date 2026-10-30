// 전투 AI 상대(10-29 본 게임 탑재): 인물 플레이어(fighter/player.ts)를 가상 버튼으로 조종하는 적 몸 (docs/전투_AI_설계.md 3장 「AI도 플레이어와 같은 버튼」).
// eileen/aiFighter.ts 를 126명 공용으로: 어떤 인물 팩이든 같은 두뇌를 그 키트에 붙인다(13장).
import { NPC_SKILL_MUL } from '../../combat/grades';
import { STATUS } from '../../combat/status';
import { perkDecoy, perkWorld } from '../../perks/runtime';
import { drawAilments } from '../ui/ailments';
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
    const out = w && w.player.alive ? [w.player as unknown as Body] : [];
    // 제 편 때리기(플레이어 퍽): 혼란 걸린 동안은 다른 적도 맞는다
    if (w && perkWorld.friendlyFire && this.status.has('confuse')) out.push(...(w as WorldView & { bodies: Body[] }).bodies.filter((b) => b !== (this as unknown as Body) && b.alive && b.team === 'enemy' && b.hp > 0 && b.kind !== 'bullet'));
    return out;
  }
  /** 방 안이 먼저 지친다(플레이어 퍽): 공격 간격 배수 */
  perkGap = 1;
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
      hp: this.hp / this.hpMax, sp: me.sp ?? 0, guard: this.guard, gap: this.status.attackGap() * this.perkGap,
    };
    const foe = foeSense(world.player as unknown as Body);
    // 미끼 잔상(플레이어 퍽): 남아 있는 동안 그 자리를 노린다
    if (perkDecoy.until > performance.now()) { foe.x = perkDecoy.x; foe.y = perkDecoy.y; foe.attacking = false; }
    const d = this.brain.tick(self, foe);
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
    this.drawBar(ctx);
  }

  /** 머리 위 체력 막대(맞은 뒤에만), 방어막이 있으면 그 위에 흰 막대 */
  private drawBar(ctx: CanvasRenderingContext2D): void {
    if (!this.alive || (this.hp >= this.hpMax && this.shield >= this.shieldMax && !this.status.list.length)) return;
    // 몸 자리 기준 좌표 (draw 가 받은 ctx 원점 = 발밑)
    const top = -this.height() - 14, w = 70;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(-w / 2, top, w, this.shieldMax ? 10 : 6);
    ctx.fillStyle = '#e8c35a';
    ctx.fillRect(-w / 2, top + (this.shieldMax ? 4 : 0), (w * Math.max(0, this.hp)) / this.hpMax, 6);
    if (this.shieldMax) {
      ctx.fillStyle = '#dfe8ee';
      ctx.fillRect(-w / 2, top, (w * this.shield) / this.shieldMax, 3);
    }
    drawAilments(ctx, this.status.list.map((s) => STATUS[s.kind].label + (s.stacks > 1 ? s.stacks : '')), top - 4);
  }
}
