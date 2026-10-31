// 필드 말풍선 연출 (5단계): 시뮬 사건(소매치기·시비·도망·맞음·경찰·주인공 알아봄)과 평소 혼잣말을 대사로.
// 말하는 건 보이는 장면 사람만. 같은 사람은 잠깐 쉬고, 화면에 말풍선이 너무 많지 않게.
import type { Actor, SimEvent, WorldSim } from './actors';
import type { LineCtx, Lines } from './lines';

/** 인물끼리 상호작용 상황 → 말풍선 기호 (수다 = 「…」 결정, 시비 = 화남 #·당한 쪽 ?) */
const PAIR: Record<string, string> = { chat: '…', harass: '#', harassed: '?' };
const TASK_TAG: Record<string, string> = { work: 'work', eat: 'eat', rest: 'rest', pee: 'restroom', poo: 'restroom', chat: 'chat', hobby: 'hobby' };

export class Chatter {
  private last = new Map<string, number>();
  private ambientT = 3;
  constructor(private sim: WorldSim, private lines: Lines, private ctx: (a: Actor) => LineCtx) {}

  private can(a: Actor, gap = 14): boolean {
    return this.sim.time - (this.last.get(a.def.id) ?? -999) > gap;
  }
  private talk(a: Actor, tag: string, partner?: string): boolean {
    // 인물끼리 주고받는 것(대화·시비)은 대사를 정해 둘 수 없다 → 머리 위 작은 말풍선 (10-31 사용자). 그 밖의 말은 대사 자료대로
    const pair = PAIR[tag];
    if (pair) {
      this.sim.emote(a, pair, 2.5);
      this.last.set(a.def.id, this.sim.time);
      return true;
    }
    const t = this.lines.bark(a.def.kind, a.def.name, tag, this.ctx(a), { archetype: a.def.archetype, partner });
    if (!t) return false;
    this.sim.say(a, t, Math.min(4.5, 1.8 + t.length * 0.12));
    this.last.set(a.def.id, this.sim.time);
    return true;
  }
  private find(scene: string, name: string, near?: number): Actor | undefined {
    return this.sim.inScene(scene).filter((a) => a.def.name === name).sort((a, b) => Math.abs(a.x - (near ?? a.x)) - Math.abs(b.x - (near ?? b.x)))[0];
  }

  /** 시뮬 사건(바깥이 비워서 건넨다)을 대사로 (보이는 장면만), 그리고 가끔 평소 혼잣말 */
  step(dt: number, scene: string, px: number, evs: SimEvent[]): void {
    const speaking = () => this.sim.inScene(scene).filter((a) => a.say).length;
    for (const e of evs) {
      if (e.scene !== scene || speaking() >= 3) continue;
      if (e.kind === 'steal') {
        const v = this.find(scene, e.victim, e.x), t = this.find(scene, e.thief, e.x);
        if (v) this.talk(v, 'victim');
        if (t && this.sim.rng() < 0.6) this.talk(t, 'thief');
        const w = this.sim.inScene(scene).find((a) => a.act === 'watch' && a !== v && this.can(a));
        if (w) this.talk(w, 'witness');
      } else if (e.kind === 'harass') {
        const a = this.find(scene, e.who, e.x), b = this.find(scene, e.target, e.x);
        if (a) this.talk(a, 'harass');
        if (b) this.talk(b, 'harassed');
      } else if (e.kind === 'flee') {
        const a = this.find(scene, e.who);
        if (a && this.can(a, 6) && this.sim.rng() < 0.5) this.talk(a, 'flee');
      } else if (e.kind === 'hurt') {
        const a = this.find(scene, e.who, e.x);
        if (a) this.talk(a, 'hit') || this.talk(a, 'hurt');
      } else if (e.kind === 'police') {
        const cop = this.sim.inScene(scene).find((a) => (a.def.name === '경찰' || a.def.name === '경비') && this.can(a, 6));
        if (cop) this.talk(cop, 'warn');
      } else if (e.kind === 'notice') {
        const a = this.find(scene, e.who, px);
        if (a && this.can(a, 20)) this.talk(a, 'idle');
      }
    }
    // 평소 혼잣말: 몇 초마다 주인공 근처에서 한 명
    this.ambientT -= dt;
    if (this.ambientT > 0) return;
    this.ambientT = 3 + this.sim.rng() * 4;
    if (speaking() >= 2) return;
    const near = this.sim.inScene(scene).filter((a) => Math.abs(a.x - px) < 700 && !a.say && this.can(a)).sort(() => this.sim.rng() - 0.5);
    for (const a of near) {
      let tag = 'idle';
      let partner: string | undefined;
      if (a.act === 'do' && a.task) {
        tag = TASK_TAG[a.task.id] ?? 'idle';
        if (a.task.id === 'chat') partner = a.doing.split('와 ')[0];
      } else if (a.post) tag = 'work';
      else if (a.drunk) tag = 'drunk';
      else if (a.act === 'watch' && this.sim.uproarLevel(scene) > 0) tag = 'crowd';
      else if (a.def.kind === 'mob' && a.act === 'walk' && this.sim.rng() < 0.5) tag = 'pass';
      if (this.talk(a, tag, partner) || (tag !== 'idle' && this.talk(a, 'idle'))) return;
    }
  }
}
