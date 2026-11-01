// 필드 말풍선 연출: 시뮬 사건을 새 대사 자료(dialogue2.ts, game-src/dialogue2 칸)로 — 보이는 장면 사람만.
// 10-31 사용자: 의사소통의 기본은 「…」·감정 말풍선이고 글 대사는 틈틈이. 평상시(일하는 중)에는 말하지 않는다. 혼잣말은 시간대 4칸만 드물게.
// 같은 사람은 잠깐 쉬고, 화면에 글 말풍선이 너무 많지 않게. 자료가 없는 칸은 억지로 다른 말을 끼우지 않는다.
import type { Actor, SimEvent, WorldSim } from './actors';
import { npcFileOf, type CueCtx, type Dialogue2 } from './dialogue2';
import { profileOf } from './mobs';

/** 인물끼리 상호작용 상황 → 말풍선 기호 (수다 = 「…」 결정, 시비 = 화남 #·당한 쪽 ?) */
const PAIR: Record<string, string> = { 'social.mate': '…', harass: '#', harassed: '?' };
/** 인물끼리 상호작용에서 말풍선 대신 대사를 칠 확률 */
export const PAIR_LINE = 0.25;
/** 혼잣말(time 칸) 간격 초·칠 확률 — 드물게 (사용자) */
export const AMBIENT_GAP: [number, number] = [25, 50];
export const AMBIENT_P = 0.35;

/** 이름 인물 칸 ↔ 몹(NPC) 칸이 다른 것 (NPC 파일은 공통 칸이 1갈래) */
const MOB_CELL: Record<string, string> = {
  'facing.greet': 'glance', 'facing.hit1': 'hit', 'facing.hit2': 'hit', 'combat.faint': 'faint', 'combat.wake': 'wake', 'combat.death': 'death',
  'situation.crowd': 'crowd', 'situation.see_body': 'see_body', 'react.armed': 'armed_angry', 'situation.alert': 'situation.alert',
  'situation.shift_on': 'shift_on', 'situation.shift_off': 'shift_off',
};
/** 세력 소속 NPC(이름 인물과 같은 구조)의 원형 */
const FACTION_NPC = new Set(['경비', '안내 직원', '행정 직원', '관리국 요원']);

export class Chatter {
  private last = new Map<string, number>();
  private ambientT = 8;
  constructor(private sim: WorldSim, private dlg: Dialogue2, private ctx: (a: Actor, target?: string) => CueCtx) {}

  private can(a: Actor, gap = 14): boolean {
    return this.sim.time - (this.last.get(a.def.id) ?? -999) > gap;
  }
  /** 이 사람 자료의 칸 열쇠: 이름 인물·세력 NPC는 그대로, 일반 NPC는 공통 칸 이름으로 */
  private cellFor(a: Actor, cell: string): string {
    if (a.def.kind === 'named' || FACTION_NPC.has(a.def.archetype ?? '')) return cell;
    return MOB_CELL[cell] ?? cell;
  }
  /** 이 사람의 대사 파일 (이름 인물 = 이름, 몹 = 원형·성별·거점 소속으로 고른 NPC 파일) */
  fileOf(a: Actor): string | null {
    return a.def.kind === 'named' ? a.def.name : npcFileOf(a.def.archetype ?? a.def.name, profileOf(a.def.look)?.sex, this.sim.mobFaction(a));
  }
  /** 대사 자료에서 한 줄 (없으면 null) */
  line(a: Actor, cell: string, ctx: Partial<CueCtx> = {}): string | null {
    const name = this.fileOf(a);
    if (!name) return null;
    return this.dlg.line(a.def.kind, name, this.cellFor(a, cell), { ...this.ctx(a, ctx.target), ...ctx });
  }
  /** 칸 하나를 말풍선으로. 자료가 없으면 fallback(임시 글)이나 기호. 말했으면 true */
  cue(a: Actor, cell: string, ctx: Partial<CueCtx> = {}, o: { fallback?: string; icon?: string; gap?: number } = {}): boolean {
    if (!this.can(a, o.gap ?? 0)) return false;
    const t = this.line(a, cell, ctx) ?? o.fallback ?? null;
    if (t) {
      this.sim.say(a, t, Math.min(4.5, 1.8 + t.length * 0.12));
      this.last.set(a.def.id, this.sim.time);
      return true;
    }
    if (o.icon) this.sim.emote(a, o.icon, 2.5);
    return false;
  }
  private talk(a: Actor, cell: string, partner?: string): boolean {
    // 인물끼리 주고받는 것(대화·시비): 대사를 칠 때도 있지만 대개는 머리 위 작은 말풍선으로 대신한다 (10-31 사용자).
    // 대사는 PAIR_LINE 확률로, 그 장면에 글 말풍선이 하나도 없을 때만 (화면이 지저분하지 않게)
    const pair = PAIR[cell];
    if (pair) {
      const line = this.sim.rng() < PAIR_LINE && !this.sim.inScene(a.scene).some((q) => q.say) ? this.line(a, cell, { partner, target: partner ?? 'other' }) : null;
      if (line) this.sim.say(a, line, Math.min(4.5, 1.8 + line.length * 0.12));
      else this.sim.emote(a, pair, 2.5);
      this.last.set(a.def.id, this.sim.time);
      return true;
    }
    return this.cue(a, cell, { partner });
  }
  private find(scene: string, name: string, near?: number): Actor | undefined {
    return this.sim.inScene(scene).filter((a) => a.def.name === name || a.def.id === name).sort((a, b) => Math.abs(a.x - (near ?? a.x)) - Math.abs(b.x - (near ?? b.x)))[0];
  }

  /** 시뮬 사건(바깥이 비워서 건넨다)을 대사로 (보이는 장면만), 그리고 가끔 혼잣말 */
  step(dt: number, scene: string, px: number, evs: SimEvent[]): void {
    const speaking = () => this.sim.inScene(scene).filter((a) => a.say).length;
    for (const e of evs) {
      if (e.scene !== scene || speaking() >= 3) continue;
      if (e.kind === 'cue') {
        // 코드가 콕 집은 칸 (경비 막기·동행·경고 등). ctx.say = 자료가 없을 때 임시 글
        const a = this.find(scene, e.id) ?? this.find(scene, e.who);
        if (a) this.cue(a, e.cell, { ...(e.ctx ?? {}), target: e.ctx?.target }, { fallback: e.ctx?.say });
      } else if (e.kind === 'steal') {
        const v = this.find(scene, e.victim, e.x), t = this.find(scene, e.thief, e.x);
        if (v) this.cue(v, 'robbed');
        if (t && this.sim.rng() < 0.6) this.cue(t, 'pick_run');
        const w = this.sim.inScene(scene).find((a) => a.act === 'watch' && a !== v && a !== t && this.can(a));
        if (w) this.cue(w, 'situation.crowd');
      } else if (e.kind === 'harass') {
        const a = this.find(scene, e.who, e.x), b = this.find(scene, e.target, e.x);
        if (a) this.talk(a, 'harass');
        if (b) this.talk(b, 'harassed');
      } else if (e.kind === 'flee') {
        const a = this.find(scene, e.who);
        if (a && this.can(a, 6) && this.sim.rng() < 0.5) this.cue(a, 'flee');
      } else if (e.kind === 'hurt') {
        const a = this.find(scene, e.id, e.x) ?? this.find(scene, e.who, e.x);
        // 기절하는 순간은 짧은 신음(faint), 그 밖은 처음 맞음(hit1)·또 맞아 맞섬(hit2)
        if (a) this.cue(a, e.down ? 'combat.faint' : e.hostile ? 'facing.hit2' : 'facing.hit1', {}, { gap: 1.5 });
      } else if (e.kind === 'kill') {
        const w = this.sim.inScene(scene).filter((a) => a.def.id !== e.id && Math.abs(a.x - e.x) < 500 && this.can(a)).sort(() => this.sim.rng() - 0.5)[0];
        if (w) this.cue(w, 'situation.see_body');
      } else if (e.kind === 'report') {
        const a = this.find(scene, e.who);
        if (a) this.cue(a, 'report');
      } else if (e.kind === 'police') {
        const cop = this.sim.inScene(scene).find((a) => a.def.archetype === '경찰' && this.can(a, 6));
        if (cop) this.cue(cop, 'halt');
      } else if (e.kind === 'notice') {
        const a = this.find(scene, e.who, px);
        if (a && this.can(a, 20)) this.cue(a, 'facing.greet');
      } else if (e.kind === 'follow') {
        const a = this.find(scene, e.who);
        if (a) this.cue(a, e.mode === 'follow' ? 'react.follow_yes' : e.mode === 'wait' ? 'react.wait' : e.mode === 'return' ? 'react.return' : 'facing.hit1');
      } else if (e.kind === 'shift') {
        const a = this.find(scene, e.who, px);
        if (a && this.sim.rng() < 0.5) this.cue(a, e.on ? 'situation.shift_on' : 'situation.shift_off');
      } else if (e.kind === 'alarm' && e.on) {
        // 경보가 울린 거점: 그 장면 사람 둘까지 반응
        for (const a of this.sim.inScene(scene).filter((a) => this.can(a, 5)).sort(() => this.sim.rng() - 0.5).slice(0, 2)) this.cue(a, 'situation.alert');
      } else if (e.kind === 'brawl') {
        const a = this.find(scene, e.a, e.x);
        if (a) this.cue(a, 'combat.start', { target: e.b });
      }
    }
    // 혼잣말(시간대 칸): 드물게, 주인공 근처에서 한 명 (평상시 일하는 중에는 말하지 않는다 — 사용자)
    this.ambientT -= dt;
    if (this.ambientT > 0) return;
    this.ambientT = AMBIENT_GAP[0] + this.sim.rng() * (AMBIENT_GAP[1] - AMBIENT_GAP[0]);
    if (speaking() >= 1 || this.sim.rng() > AMBIENT_P) return;
    const near = this.sim.inScene(scene).filter((a) => Math.abs(a.x - px) < 700 && !a.say && !a.fighting && this.can(a, 30) && ['idle', 'walk', 'pause', 'do', 'post'].includes(a.act)).sort(() => this.sim.rng() - 0.5);
    for (const a of near) {
      if (a.act === 'do' && a.task?.id === 'chat') { this.talk(a, 'social.mate', a.doing.split('와 ')[0]); return; }
      if (a.act === 'watch' && this.sim.uproarLevel(scene) > 0) { if (this.cue(a, 'situation.crowd')) return; continue; }
      if (this.cue(a, 'time')) return;
    }
  }
}
