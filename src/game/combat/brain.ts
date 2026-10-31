// 전투 AI 두뇌 (docs/전투_AI_설계.md). 대전 액션 컴퓨터 플레이어처럼: 플레이어와 같은 가상 버튼을 누른다(3장).
// 상황 읽기(5장, 반응 지연 고리) → 전략(6-2) → 전술(6-3) → 실행 대본(6-4). 방어 반응(8장), 난이도(9-2), 성향(9-3), 지휘 공격권(11-2).
// 엔진·그림을 모른다: 자기·상대 상태를 숫자로 받아 버튼을 돌려준다(그래서 node 시험이 된다).
import type { Rng } from '../world/rng';

/** 가상 버튼 (에일린 시험판 정본: Q 약·W 강·C 막기·A 원거리·S 충전·D 기술·F 필살·Shift 회피/달리기·Space 점프) */
export type Btn = 'left' | 'right' | 'up' | 'down' | 'light' | 'heavy' | 'block' | 'dodge' | 'jump' | 'shoot' | 'charge' | 'skill' | 'super' | 'run' | 'flee' | 'back';
/** 이 몸이 가진 동작·기술 (인물마다 다름, 10-30 사용자): 없는 것은 계획에 넣지 않는다 */
export interface FighterKit { heavy: boolean; jump: boolean; jumpAtk: boolean; skill: boolean; charge: boolean; super: boolean; shoot: boolean; dodge: boolean; block: boolean; flee: boolean; back: boolean }
const FULL_KIT: FighterKit = { heavy: true, jump: true, jumpAtk: true, skill: true, charge: true, super: true, shoot: true, dodge: true, block: true, flee: false, back: false };

export interface SelfSense {
  x: number; y: number; z: number;
  face: 1 | -1;
  /** 움직일 수 있나 (서 있음·콤보 이음 구간) */
  free: boolean;
  /** 공중 */
  air: boolean;
  /** 맞고 있음·다운·스턴 */
  stunned: boolean;
  /** 누워 있음 (다운·엎드림, 쓰러져 끝난 것은 아님): 일어나기 버튼을 눌러야 일어난다 (8-2) */
  lying?: boolean;
  hp: number; // 0~1
  sp: number; // 필살 게이지 0~100
  guard: number; // 방어 게이지 0~100
  /** 공격 간격 배수 (두통 1.25). 없으면 1 */
  gap?: number;
}
export interface FoeSense {
  x: number; y: number; z: number;
  /** 공격 동작 중 (발동·판정) */
  attacking: boolean;
  /** 공격 뒤 빈틈 */
  recovering: boolean;
  air: boolean;
  down: boolean;
  hp: number;
}

export type Difficulty = 'easy' | 'normal' | 'hard' | 'nightmare';
export type Grade = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
/** 싸움 성향 0~1 (9-3장) */
export interface Persona { aggression: number; patience: number; zoning: number; courage: number }

/** 등급별 손 실력 (9-1장, 보통 난이도 기준) */
const GRADE: Record<Grade, { react: number; defend: number; drop: number; routes: number; tactic: number; punish: number }> = {
  F: { react: 20, defend: 0.1, drop: 0.35, routes: 1, tactic: 15, punish: 0.2 },
  E: { react: 18, defend: 0.2, drop: 0.25, routes: 1, tactic: 12, punish: 0.3 },
  D: { react: 15, defend: 0.35, drop: 0.15, routes: 2, tactic: 10, punish: 0.45 },
  C: { react: 12, defend: 0.5, drop: 0.1, routes: 3, tactic: 8, punish: 0.6 },
  B: { react: 10, defend: 0.65, drop: 0.06, routes: 4, tactic: 7, punish: 0.75 },
  A: { react: 8, defend: 0.75, drop: 0.03, routes: 5, tactic: 6, punish: 0.85 },
  S: { react: 6, defend: 0.85, drop: 0.02, routes: 5, tactic: 5, punish: 0.95 },
};
/** 난이도 (9-2장 표, 사용자 위임으로 Claude가 정함) */
export const DIFF: Record<Difficulty, { react: number; defend: number; drop: number; punish: number; melee: number; super: 'low' | 'ok' | 'combo' | 'always'; justDodge: Grade | null }> = {
  easy: { react: 1.5, defend: 0.5, drop: 2, punish: 0.6, melee: 2, super: 'low', justDodge: null },
  normal: { react: 1, defend: 1, drop: 1, punish: 1, melee: 3, super: 'ok', justDodge: 'B' },
  hard: { react: 0.8, defend: 1.15, drop: 0.6, punish: 1.1, melee: 4, super: 'combo', justDodge: 'C' },
  nightmare: { react: 0.65, defend: 1.3, drop: 0.3, punish: 1.2, melee: 5, super: 'always', justDodge: 'E' },
};
const ORDER: Grade[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];

/** 콤보 경로 (7장 형식, 에일린 키트): 버튼 순서와 이음 간격(틱). 등급이 높을수록 긴 경로까지 */
export const ROUTES: { id: string; seq: Btn[]; gap: number; diff: number }[] = [
  { id: 'jab', seq: ['light'], gap: 0, diff: 1 },
  { id: 'L-H stun', seq: ['light', 'heavy'], gap: 7, diff: 1 },
  { id: 'LL-H launch', seq: ['light', 'light', 'heavy'], gap: 7, diff: 2 },
  { id: 'LLL-H blow', seq: ['light', 'light', 'light', 'heavy'], gap: 7, diff: 3 },
  { id: 'LL-H-jump', seq: ['light', 'light', 'heavy', 'jump', 'light'], gap: 8, diff: 4 },
  { id: 'LLL-skill', seq: ['light', 'light', 'light', 'skill'], gap: 7, diff: 5 },
];
/** 공격 무게 (11-2장) */
const WEIGHT: Partial<Record<Btn, number>> = { light: 1, heavy: 2, skill: 2, charge: 3, super: 3 };

type Step = { press?: Btn; hold?: Btn[]; ticks: number; release?: Btn };
export type Strategy = 'press' | 'careful' | 'zone' | 'rest' | 'flee';

/** 집단 지휘 (11장): 한 표적에 동시에 쓰는 공격 무게 상한 */
export class Squad {
  private used = new Map<object, Map<string, number>>();
  constructor(public cap = 3) {}
  borrow(target: object, who: string, w: number): boolean {
    const m = this.used.get(target) ?? this.used.set(target, new Map()).get(target)!;
    const total = [...m.entries()].filter(([k]) => k !== who).reduce((s, [, v]) => s + v, 0);
    if (total + w > this.cap) return false;
    m.set(who, w);
    return true;
  }
  give(target: object, who: string): void {
    this.used.get(target)?.delete(who);
  }
}

export interface Decision {
  hold: Set<Btn>;
  press: Btn[];
  release: Btn[];
}

export class FighterBrain {
  readonly g: (typeof GRADE)[Grade];
  readonly d: (typeof DIFF)[Difficulty];
  strategy: Strategy = 'careful';
  tactic = '대기';
  private hist: FoeSense[] = [];
  private script: Step[] = [];
  private stratT = 0;
  private picked = false;
  private tacT = 0;
  private holding = new Set<Btn>();
  private defendT = 0;
  /** 플레이어 버릇 (10장): 점프·회피 반격 횟수 → 대공·유인 가중 */
  private habit = { jump: 0, attack: 0 };
  private lastFoe: FoeSense | null = null;
  /** 누운 뒤 일어나기까지 남은 틱 (8-2: 바로 / 늦게 +10~20틱). null = 아직 안 고름 */
  private wakeT: number | null = null;
  /** 이번 틱의 공격 간격 배수 */
  private gap = 1;
  readonly kit: FighterKit;
  constructor(readonly id: string, readonly grade: Grade, readonly difficulty: Difficulty, readonly persona: Persona, private rng: Rng, private squad?: Squad, private squadKey: object = {}, kit: Partial<FighterKit> = {}) {
    this.kit = { ...FULL_KIT, ...kit };
    this.g = GRADE[grade];
    this.d = DIFF[difficulty];
  }

  get reactTicks(): number {
    return Math.max(2, Math.round(this.g.react * this.d.react));
  }
  private chance(p: number): boolean {
    return this.rng() < p;
  }

  /** 한 틱 판단 */
  tick(me: SelfSense, foeNow: FoeSense): Decision {
    // 반응 지연: 지금 상대가 아니라 reactTicks 전 모습을 본다
    this.hist.push(foeNow);
    if (this.hist.length > 40) this.hist.shift();
    const foe = this.hist[Math.max(0, this.hist.length - 1 - this.reactTicks)];
    this.learn(foeNow);
    this.gap = me.gap ?? 1;
    const out: Decision = { hold: new Set(), press: [], release: [] };
    if (me.stunned) {
      this.script = [];
      this.squad?.give(this.squadKey, this.id);
      // 다운: 일어나기(점프 버튼)를 눌러야 일어난다. 누르지 않으면 무적으로 누운 채 대련이 끝나지 않았다 (8-2 기상 시점: 바로 / 늦게)
      if (me.lying) {
        if (this.wakeT === null) this.wakeT = this.chance(0.5) ? 0 : 10 + Math.floor(this.rng() * 11);
        if (this.wakeT-- <= 0) { out.press.push('jump'); this.wakeT = null; }
      } else this.wakeT = null;
      return this.finish(out);
    }
    this.wakeT = null;
    const dx = foe.x - me.x, dist = Math.abs(dx), dy = foe.y - me.y;
    const toward: Btn = dx > 0 ? 'right' : 'left';
    const away: Btn = dx > 0 ? 'left' : 'right';
    // 전략 (60~120틱마다, 큰 일이 생기면 바로)
    if (--this.stratT <= 0) {
      this.stratT = 60 + Math.floor(this.rng() * 60);
      this.strategy = this.pickStrategy(me, foe);
    }
    // 방어 반응 (8장): 상대 공격이 보이고 가까우면 막기·회피 (지연된 모습 기준)
    if (this.defendT > 0) {
      this.defendT--;
      out.hold.add('block');
      return this.finish(out);
    }
    if (foe.attacking && dist < 190 && Math.abs(dy) < 50 && me.free && !this.script.length) {
      if (this.chance(this.g.defend * this.d.defend)) {
        this.tactic = '방어';
        if (me.guard > 35 && this.kit.block && (this.chance(0.65) || !this.kit.dodge)) this.defendT = 8 + Math.floor(this.rng() * 10);
        else if (this.kit.dodge) out.press.push('dodge');
        return this.finish(out);
      }
    }
    // 대본 실행
    if (this.script.length) return this.runScript(out);
    if (--this.tacT > 0) {
      this.align(out, dy, dist);
      return this.finish(out);
    }
    this.tacT = Math.round((this.g.tactic + Math.floor(this.rng() * 4)) * this.gap);
    this.chooseTactic(me, foe, dist, dy, toward, away, out);
    return this.finish(out);
  }

  private learn(foe: FoeSense): void {
    const l = this.lastFoe;
    if (l && !l.air && foe.air) this.habit.jump++;
    if (l && !l.attacking && foe.attacking) this.habit.attack++;
    this.lastFoe = foe;
  }

  private pickStrategy(me: SelfSense, foe: FoeSense): Strategy {
    const gap = me.hp - foe.hp;
    const p = this.persona;
    const s: Record<Strategy, number> = {
      press: 40 + 30 * gap + 30 * p.aggression + (me.sp >= 100 ? 15 : 0),
      careful: 40 - 30 * gap + 30 * p.patience,
      zone: 20 + 40 * p.zoning,
      rest: 0,
      flee: 160 * (1 - p.courage) * (1 - me.hp) - 20,   // 10-30: 용기가 낮을수록 체력이 덜 줄어도 기세가 꺾여 달아남(몹은 실제 성격 값)
    };
    if (this.picked) s[this.strategy] += 15; // 자꾸 바뀌지 않게 (첫 판단엔 없음)
    this.picked = true;
    return (Object.entries(s) as [Strategy, number][]).sort((a, b) => b[1] - a[1])[0][0];
  }

  /** 깊이(y) 맞추기: 상대와 같은 줄로 */
  private align(out: Decision, dy: number, dist: number): void {
    if (Math.abs(dy) > 22 && dist < 600) out.hold.add(dy > 0 ? 'down' : 'up');
  }

  private plan(steps: Step[], name: string): void {
    if (this.gap !== 1) for (const s of steps) if (s.press) s.ticks = Math.round(s.ticks * this.gap);
    this.script = steps;
    this.tactic = name;
  }
  private attackOk(b: Btn): boolean {
    const w = WEIGHT[b] ?? 0;
    if (!w || !this.squad) return true;
    return this.squad.borrow(this.squadKey, this.id, w);
  }

  private chooseTactic(me: SelfSense, foe: FoeSense, dist: number, dy: number, toward: Btn, away: Btn, out: Decision): void {
    const p = this.persona;
    this.align(out, dy, dist);
    const sameLane = Math.abs(dy) < 40;
    const routes = ROUTES.filter((r) => r.diff <= this.g.routes && (this.kit.heavy || !r.seq.includes('heavy')) && (this.kit.jump || !r.seq.includes('jump')) && (this.kit.skill || !r.seq.includes('skill')));
    const route = () => routes[Math.floor(this.rng() * routes.length)];
    const combo = (r = route()) => {
      if (!this.attackOk(r.seq.includes('heavy') ? 'heavy' : 'light')) return false;
      const steps: Step[] = [];
      for (let i = 0; i < r.seq.length; i++) {
        // 이음마다 놓칠 수 있다 (손 실력)
        if (i > 0 && this.chance(this.g.drop * this.d.drop)) break;
        steps.push({ press: r.seq[i], ticks: r.gap || 6 });
      }
      this.plan(steps, `콤보 ${r.id}`);
      return true;
    };
    // 기세가 꺾임: 뒷걸음질(37)로 물러나다 겁에 질려 달아남(36). 그 동작이 없으면 그냥 뛰어서
    if (this.strategy === 'flee') {
      const steps: Step[] = [];
      if (this.kit.back && dist < 260) steps.push({ hold: ['back'], ticks: 20 });
      steps.push(this.kit.flee ? { hold: ['flee', away], ticks: 60 } : { hold: [away, 'run'], ticks: 30 });
      this.plan(steps, '도망');
      return;
    }
    if (this.strategy === 'rest' || (!this.attackOk('light') && dist < 260)) {
      this.squad?.give(this.squadKey, this.id);
      this.plan([{ hold: [dist < 260 ? away : toward], ticks: 12 }, { ticks: 10 }], '둘러서 기다림');
      return;
    }
    // 필살: 게이지 100이고 가까우면 (난이도별 조건)
    if (me.sp >= 100 && dist < 260 && sameLane && this.kit.super) {
      const ok = this.d.super === 'low' ? me.hp < 0.3 : true;
      if (ok && this.attackOk('super')) return this.plan([{ press: 'super', ticks: 30 }], '필살');
    }
    // 빈틈 벌주기: 상대가 공격 뒤 빈틈이고 가까우면 대시해서 콤보
    if (foe.recovering && dist < 240 && sameLane && this.chance(this.g.punish * this.d.punish)) {
      if (dist > 130) return this.plan([{ hold: [toward, 'run'], ticks: Math.ceil((dist - 110) / 14) }, { press: 'light', ticks: 6 }, { press: 'light', ticks: 6 }, { press: this.kit.heavy ? 'heavy' : 'light', ticks: 10 }], '빈틈 벌주기');
      if (combo(routes[routes.length - 1])) { this.tactic = '빈틈 벌주기 콤보'; return; }
    }
    // 대공: 상대가 뛰어들면 강공격 (버릇: 점프를 많이 하면 대공을 더)
    if (foe.air && dist < 230 && this.kit.heavy && this.chance(0.35 + Math.min(0.4, this.habit.jump * 0.04))) {
      if (this.attackOk('heavy')) return this.plan([{ press: 'heavy', ticks: 12 }], '대공');
    }
    // 다운된 상대: 신중하면 물러서 기다리고, 공세면 일어날 자리에 붙는다
    if (foe.down) {
      if (this.strategy === 'careful') return this.plan([{ hold: [away], ticks: 10 }, { ticks: 12 }], '기상 기다림');
      return this.plan([{ hold: [toward], ticks: Math.max(4, Math.ceil((dist - 120) / 8)) }, { ticks: 6 }], '기상 압박');
    }
    // 가까움: 콤보 / 찌르기
    if (dist < 135 && sameLane) {
      if (this.strategy !== 'zone' || this.chance(0.4)) if (combo()) return;
    }
    // 중거리: 점프 공격·돌진 공격·기술
    if (dist < 400 && sameLane) {
      const r = this.rng();
      if (this.strategy === 'press' && this.kit.jumpAtk && r < 0.25 + p.aggression * 0.2 && this.attackOk('light')) {
        return this.plan([{ press: 'jump', hold: [toward], ticks: 8 }, { press: 'light', hold: [toward], ticks: 16 }], '점프 공격');
      }
      if (this.strategy === 'press' && dist > 180 && r < 0.6 && this.attackOk('light')) {
        // 달리다 약 = 돌진 공격 (확정 2판)
        return this.plan([{ hold: [toward, 'run'], ticks: Math.ceil((dist - 140) / 14) }, { press: 'light', hold: [toward, 'run'], ticks: 14 }], '돌진 공격');
      }
      if (dist > 160 && r < 0.75 && this.kit.skill && this.attackOk('skill')) return this.plan([{ press: 'skill', ticks: 24 }], '기술');
    }
    // 원거리: 견제 (충전·사격)
    if (this.strategy === 'zone' && dist > 300) {
      if (this.chance(0.4) && this.kit.charge && this.attackOk('charge')) return this.plan([{ press: 'charge', hold: ['charge'], ticks: 16 + Math.floor(this.rng() * 22) }, { release: 'charge', ticks: 14 }], '충전기');
      if (sameLane && this.kit.shoot) return this.plan([{ press: 'shoot', ticks: 14 }], '사격 견제');
    }
    // 신중: 상대 사거리 바로 밖에서 서성
    if (this.strategy === 'careful' && dist < 230) return this.plan([{ hold: [away], ticks: 8 }, { ticks: 8 }], '거리 재기');
    // 기본: 다가간다 (멀면 달린다)
    this.plan([{ hold: dist > 500 ? [toward, 'run'] : [toward], ticks: 10 }], '접근');
  }

  private runScript(out: Decision): Decision {
    const s = this.script[0];
    if (s.press && !(s as Step & { done?: boolean }).done) {
      out.press.push(s.press);
      (s as Step & { done?: boolean }).done = true;
    }
    if (s.release && !(s as Step & { rel?: boolean }).rel) {
      out.release.push(s.release);
      (s as Step & { rel?: boolean }).rel = true;
    }
    for (const h of s.hold ?? []) out.hold.add(h);
    if (--s.ticks <= 0) this.script.shift();
    if (!this.script.length) this.squad?.give(this.squadKey, this.id);
    return this.finish(out);
  }

  /** 눌러 둔 버튼 중 이번에 뗀 것 */
  private finish(out: Decision): Decision {
    for (const h of this.holding) if (!out.hold.has(h) && !out.release.includes(h)) out.release.push(h);
    this.holding = new Set(out.hold);
    return out;
  }
}

/** 등급 비교 (저스트 회피를 쓰는 등급 이상인가) */
export const gradeAtLeast = (g: Grade, min: Grade | null) => min !== null && ORDER.indexOf(g) >= ORDER.indexOf(min);
