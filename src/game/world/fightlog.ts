// 필드 싸움 기록 (10-31 사용자: 모델에게 가는 글은 영어 짧은 문장, 주인공은 {user}).
// 주먹 한 대마다가 아니라 싸움 한 건 = 한 줄: 누가 먼저였나(공격함/공격당함)·상대(원형 영어 이름 + A·B)·수단·결과.
// 조용해지면(QUIET초) 닫아 한 줄을 낸다. 사망은 따로 한 줄(인물 기록·평판이 kill 사건으로 계기를 단다).
import { ARCHETYPES } from './mobs';

/** 원형 이름 → 영어 (모델 글용). 이름 있는 인물·없는 원형은 그대로 */
const EN: Record<string, string> = {
  행인: 'pedestrian', 회사원: 'office worker', 관광객: 'tourist', 학생: 'student', 배달원: 'courier', 불량배: 'thug', 방문객: 'visitor',
  '행정 직원': 'admin clerk', '안내 직원': 'receptionist', 청소부: 'cleaner', 경비: 'guard', 경찰: 'police officer', '편의점 점원': 'store clerk',
  의사: 'doctor', 간호사: 'nurse', 상인: 'merchant', 취객: 'drunk', 주민: 'resident', 산책객: 'stroller', 승객: 'passenger',
};
export const enName = (name: string): string => EN[name] ?? name;
/** 싸움이 끝났다고 보는 조용한 초 */
export const QUIET = 8;

export type Means = 'fists' | 'weapon';
export interface FightLine { kind: 'provoke' | 'act' | 'kill' | 'down'; text: string; weight: 1 | 2 | 3; who?: string[] }
interface Foe { id: string; name: string; tag: string; out?: 'knocked out' | 'fled' | 'killed' }
interface Episode { at: string; scene: string; first: 'user' | 'them'; why?: string; foes: Foe[]; means: Set<Means>; user?: string; quiet: number }

export class FightLog {
  private ep: Episode | null = null;
  /** 장면마다 원형별 다음 글자 (A, B, …): 같은 사람은 그 장면 안에서 같은 글자 */
  private tags = new Map<string, string>();
  private seq = new Map<string, number>();
  constructor(private emit: (line: FightLine) => void) {}

  private tagOf(scene: string, id: string, name: string): string {
    const k = `${scene}|${id}`;
    const old = this.tags.get(k);
    if (old) return old;
    const n = this.seq.get(`${scene}|${name}`) ?? 0;
    this.seq.set(`${scene}|${name}`, n + 1);
    const t = `${enName(name)} ${String.fromCharCode(65 + (n % 26))}`;
    this.tags.set(k, t);
    return t;
  }
  private foe(scene: string, id: string, name: string): Foe {
    const ep = this.ep!;
    let f = ep.foes.find((q) => q.id === id);
    if (!f) ep.foes.push((f = { id, name, tag: this.tagOf(scene, id, name) }));
    return f;
  }
  private open(at: string, scene: string, first: 'user' | 'them', why?: string): Episode {
    if (this.ep && this.ep.scene !== scene) this.close();
    if (!this.ep) this.ep = { at, scene, first, why, foes: [], means: new Set(), quiet: 0 };
    this.ep.quiet = 0;
    return this.ep;
  }

  /** {user}가 때림. hostile = 상대가 이미 맞서던 중(막아섬·시비 뒤 맞섬)이면 먼저 친 게 아님 */
  userHit(at: string, scene: string, id: string, name: string, means: Means, hostile: boolean, why?: string): void {
    const ep = this.open(at, scene, hostile ? 'them' : 'user', hostile ? why : undefined);
    ep.means.add(means);
    this.foe(scene, id, name);
  }
  /** 상대가 덤벼 옴 (경찰 출동·시비 뒤 맞섬·적대 세력) */
  joined(at: string, scene: string, id: string, name: string, why: string): void {
    const ep = this.open(at, scene, 'them', why);
    if (!ep.foes.length) { ep.first = 'them'; ep.why = why; }
    this.foe(scene, id, name);
  }
  knockedOut(id: string): void { this.out(id, 'knocked out'); }
  fled(id: string): void { this.out(id, 'fled'); }
  private out(id: string, out: Foe['out']): void {
    const f = this.ep?.foes.find((q) => q.id === id);
    if (f && f.out !== 'killed') { f.out = out; this.ep!.quiet = 0; }
  }
  /** 살해: 싸움 줄과 따로 한 줄 */
  killed(at: string, scene: string, id: string, name: string, means: Means): void {
    const tag = this.tagOf(scene, id, name);
    const f = this.ep?.foes.find((q) => q.id === id);
    if (f) f.out = 'killed';
    this.emit({ kind: 'kill', weight: 3, text: `${at} {user} killed ${tag} (${means === 'weapon' ? 'with a weapon' : 'bare-handed'}) while they were knocked out.` });
  }
  /** {user}가 쓰러짐: 그 싸움을 닫고 끝 줄까지 */
  userDown(dead: boolean, byId: string | null, extra = ''): void {
    const by = byId ? this.ep?.foes.find((q) => q.id === byId)?.tag : undefined;
    if (this.ep) this.ep.user = `${by ?? 'someone'} ${dead ? 'killed {user}' : 'knocked {user} out'}`;
    else if (dead || by) this.emit({ kind: 'down', weight: 3, text: `${by ?? 'Someone'} ${dead ? 'killed {user}' : 'knocked {user} out'}.` });
    this.close(true);
    this.emit({ kind: 'down', weight: 3, text: `{user} ${dead ? 'died' : 'lost consciousness'}; the field visit ended here.${extra ? ` ${extra}` : ''}` });
  }
  /** 매 틱: 조용하면 닫는다 */
  tick(dt: number, busy: boolean): void {
    if (!this.ep) return;
    if (busy) { this.ep.quiet = 0; return; }
    if ((this.ep.quiet += dt) >= QUIET) this.close();
  }
  /** 장면을 떠날 때 등: 지금 싸움을 닫고 글자표를 비운다 */
  leave(): void {
    this.close();
    this.tags.clear();
    this.seq.clear();
  }

  private close(down = false): void {
    const ep = this.ep;
    this.ep = null;
    if (!ep || !ep.foes.length) return;
    const list = (fs: Foe[]) => {
      // 같은 원형은 묶어서 「pedestrian A, B」
      const by = new Map<string, string[]>();
      for (const f of fs) { const [base, t] = [f.tag.slice(0, -2), f.tag.slice(-1)]; by.set(base, [...(by.get(base) ?? []), t]); }
      return [...by].map(([b, ts]) => `${b} ${ts.join(', ')}`).join('; ');
    };
    const means = ep.means.size ? ` (${[...ep.means].map((m) => (m === 'weapon' ? 'weapon' : 'fists')).join(', ')})` : '';
    const head = ep.first === 'user'
      ? `${ep.at} {user} attacked first: ${list(ep.foes)}${means}.`
      : `${ep.at} ${list(ep.foes).replace(/^./, (c) => c.toUpperCase())}${ep.why ? ` (${ep.why})` : ''} attacked {user}${means ? `; {user} fought back${means}` : ''}.`;
    const outs: string[] = [];
    for (const k of ['knocked out', 'fled'] as const) {
      const fs = ep.foes.filter((f) => f.out === k);
      if (fs.length) outs.push(`${fs.map((f) => f.tag.split(' ').pop()).join(', ')} ${k}`);
    }
    if (ep.user) outs.push(ep.user);
    const text = `${head}${outs.length ? ` ${outs.join('; ')}.` : ''}`;
    // {user}가 먼저 친 싸움 = 도발(평판 계기), 당한 싸움 = 행동
    this.emit({ kind: ep.first === 'user' ? 'provoke' : 'act', weight: down || ep.foes.length >= 3 ? 3 : 2, text });
  }
}

/** 원형이 경찰·경비인가 (돈을 뜯지 않음) */
export const isLaw = (archetype: string | undefined): boolean => ['police', 'guard'].includes(ARCHETYPES[archetype ?? '']?.role ?? '');
