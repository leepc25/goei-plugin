// 전투 AI 상대(10-29 본 게임 탑재): 인물 플레이어(fighter/player.ts)를 가상 버튼으로 조종하는 적 몸 (docs/전투_AI_설계.md 3장 「AI도 플레이어와 같은 버튼」).
// eileen/aiFighter.ts 를 126명 공용으로: 어떤 인물 팩이든 같은 두뇌를 그 키트에 붙인다(13장).
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

const BTN: Record<Btn, PadBtn | null> = { left: 'left', right: 'right', up: 'up', down: 'down', light: 'light', heavy: 'heavy', block: 'block', dodge: 'dodge', jump: 'jump', shoot: 'shoot', charge: 'charge', skill: 'skill', super: 'super', run: null, flee: 'flee', back: 'back' };

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
  /** side: enemy = 주인공·동행과 싸움(기본), ally = 주인공 편(동행)으로 적과 싸움 — 같은 두뇌·같은 몸 */
  constructor(clips: Record<string, FrameInfo[]>, art: CharArt, o: { id: string; grade: Grade; difficulty: Difficulty; persona: Persona; seed: number; squad?: Squad; label?: string; side?: 'enemy' | 'ally' }) {
    super(clips, art);
    const ally = o.side === 'ally';
    // 편 (Player는 'player'로 굳어 있어서 덮는다). 동행은 주인공과 같은 편이라 서로 맞지 않는다
    Object.defineProperty(this, 'team', { value: ally ? 'player' : 'enemy', configurable: true });
    Object.defineProperty(this, 'kind', { value: ally ? 'ally-char' : 'ai-char', configurable: true });
    this.allySide = ally;
    this.label = o.label ?? `AI ${art.cfg.name}`;
    // 인물마다 가진 동작·기술이 다르다: 없는 것은 두뇌가 계획하지 않는다 (점프 공격 14·강공 12·사격 15 등)
    const has = (id: string) => !!art.A[id], sk = (art.cfg as { skills?: Record<string, unknown> }).skills ?? {};
    this.brain = new FighterBrain(o.id, o.grade, o.difficulty, o.persona, mulberry32(o.seed), o.squad, {}, {
      heavy: has('12'), jump: has('7'), jumpAtk: has('7') && has('14'), skill: !!sk.skill, charge: !!sk.charge, super: !!sk.super,
      shoot: has('15') && (art.cfg as { bal?: { gun?: string } }).bal?.gun !== 'none', dodge: has('16'), block: has('17'), flee: has('36'), back: has('37'),
    });
  }
  /** 때릴 상대: 적 편 = 주인공 + 동행(주인공 편 AI 몸), 동행 = 적 편 몸 전부 */
  protected foes(): Body[] {
    const w = this.worldNow as (WorldView & { bodies: Body[] }) | null;
    if (!w) return [];
    if (this.allySide) return w.bodies.filter((b) => b.alive && b.team === 'enemy' && b.hp > 0 && b.kind !== 'bullet');
    const out = w.player.alive ? [w.player as unknown as Body] : [];
    out.push(...w.bodies.filter((b) => b !== (this as unknown as Body) && b.alive && b.team === 'player' && b.hp > 0 && b.kind !== 'bullet'));
    // 제 편 때리기(플레이어 퍽): 혼란 걸린 동안은 다른 적도 맞는다
    if (w && perkWorld.friendlyFire && this.status.has('confuse')) out.push(...(w as WorldView & { bodies: Body[] }).bodies.filter((b) => b !== (this as unknown as Body) && b.alive && b.team === 'enemy' && b.hp > 0 && b.kind !== 'bullet'));
    return out;
  }
  /** 방 안이 먼저 지친다(플레이어 퍽): 공격 간격 배수 */
  perkGap = 1;
  /** NPC 퍽 공격 간격 배수 (술기운 1.2) */
  npcGap = 1;
  /** 붙은 NPC 퍽 이름 (표시용) */
  npcPerks: string[] = [];
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
      hp: this.hp / this.hpMax, sp: me.sp ?? 0, guard: this.guard, gap: this.status.attackGap() * this.perkGap * this.npcGap,
    };
    // 노릴 상대: 가장 가까운 상대 (적 편은 주인공·동행 중, 동행은 적 중)
    const t = this.foes().filter((b) => b.team !== this.team).sort((a, b) => Math.abs(a.x - this.x) + Math.abs(a.y - this.y) * 2 - (Math.abs(b.x - this.x) + Math.abs(b.y - this.y) * 2))[0];
    const p = this.pad;
    if (!t) {
      // 상대가 없음: 동행은 주인공 곁으로, 적 편은 그대로 선다
      p.pressed.clear(); p.released.clear(); p.held.clear(); p.mx = 0; p.my = 0; p.run = false; p.evade = false;
      const pl = world.player as unknown as Body;
      if (this.allySide && pl.alive && Math.abs(pl.x - this.x) > 160) { const k = pl.x > this.x ? 'right' : 'left'; p.held.add(k); p.mx = k === 'right' ? 1 : -1; p.run = Math.abs(pl.x - this.x) > 400; }
      if (this.allySide && pl.alive && Math.abs(pl.y - this.y) > 30) { const k = pl.y > this.y ? 'down' : 'up'; p.held.add(k); p.my = k === 'down' ? 1 : -1; }
      this.lieStep(p, pl.x);
      this.tick(world, p);
      return;
    }
    const foe = foeSense(t);
    // 미끼 잔상(플레이어 퍽): 주인공을 노릴 때 남아 있는 동안 그 자리를 노린다
    if (t === (world.player as unknown as Body) && perkDecoy.until > performance.now()) { foe.x = perkDecoy.x; foe.y = perkDecoy.y; foe.attacking = false; }
    const d = this.brain.tick(self, foe);
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
    this.lieStep(p, foe.x);
    this.tick(world, p);
  }

  // 쓰러진 뒤 (두뇌는 누운 동안 아무것도 안 누름): 기상 지연이 지나면 일어난다. 체력이 낮고 겁 많으면 일어나지 않고 엎드려 기어(38) 상대 반대쪽으로 물러났다가 일어남
  private lieLag = -1;
  private crawlT = 0;
  private crawled = false;
  private lieStep(p: Pad, foeX: number): void {
    const P = this.core.P as unknown as { mode: string; t: number; downAt?: number; wakeDelay: number; wakeExtra?: number };
    if (this.phase === 'down' || (P.mode !== 'down' && P.mode !== 'belly')) { this.lieLag = -1; if (P.mode !== 'belly') this.crawled = false; return; }
    p.held.clear(); p.pressed.clear(); p.released.clear(); p.mx = 0; p.my = 0;
    const away = foeX > this.x ? 'left' : 'right';
    if (P.mode === 'belly') {
      if ((this.crawlT -= 1 / 30) > 0) { p.held.add(away); p.mx = away === 'right' ? 1 : -1; }
      else p.pressed.add('up');
      return;
    }
    if (this.lieLag < 0) this.lieLag = 0.2 + Math.random() * 0.7;
    if (P.t - (P.downAt ?? -9) < P.wakeDelay + (P.wakeExtra ?? 0) + this.lieLag) return;
    if (!this.crawled && this.core.has('38') && this.hp / this.hpMax < 0.35 && this.brain.persona.courage < 0.5) {
      this.crawled = true;
      this.crawlT = 1.5 + Math.random() * 2;
      p.pressed.add(away);
      p.held.add(away);
      return;
    }
    p.pressed.add('up');
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
    // NPC 퍽 이름: 막대 아래 작은 글씨 (docs/퍽/NPC_퍽_안.md 「전투 체력 막대 옆에 보인다」)
    if (this.npcPerks.length) {
      ctx.save();
      ctx.font = '11px Galmuri11, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.7)';
      const t = this.npcPerks.join('·');
      ctx.fillText(t, 1, top + (this.shieldMax ? 22 : 18));
      ctx.fillStyle = '#cfd8dc';
      ctx.fillText(t, 0, top + (this.shieldMax ? 21 : 17));
      ctx.restore();
    }
  }
}
