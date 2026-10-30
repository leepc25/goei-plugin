// 상태 효과 (docs/게임_성장_경제_설계.md 6장): 디버프·버프 하나의 규격. 엔진·그림을 모른다 (node 시험 가능).
// 디버프는 동시 3개(기본기획서 A16). 넷째가 오면 남은 시간이 가장 짧은 것이 밀려난다. 오염은 풀릴 때까지 남는다.
// 효과는 배율로만 밖에 알린다: 이동 속도·필살 충전·막기 가능·기술/필살 가능·좌우 반전·초당 피해·최대 체력 비율.

export type DebuffKind = 'bleed' | 'taint' | 'headache' | 'confuse' | 'fear' | 'slow' | 'silence';

export interface StatusDef {
  label: string;
  /** 처음 걸릴 때 한 줄 (기존 enemy/debuff.ts 글귀와 같음) */
  text: string;
  /** 겹침 상한 (1 = 시간만 새로) */
  max: number;
  /** 기본 시간(초). Infinity = 풀릴 때까지 */
  sec: number;
}

export const STATUS: Record<DebuffKind, StatusDef> = {
  bleed: { label: '출혈', text: '출혈 · 피가 멎지 않는다', max: 3, sec: 8 },
  taint: { label: '오염', text: '오염 · 숨이 탁해진다', max: 3, sec: Infinity },
  headache: { label: '두통', text: '두통 · 머리가 울린다', max: 1, sec: 10 },
  confuse: { label: '혼란', text: '혼란 · 방향이 뒤집힌다', max: 1, sec: 4 },
  fear: { label: '공포', text: '공포 · 몸이 굳는다', max: 1, sec: 5 },
  slow: { label: '둔화', text: '느려졌다', max: 1, sec: 5 },
  silence: { label: '침묵', text: '목소리가 안 나온다', max: 1, sec: 6 },
};

/** 수치 (설정으로 뺄 기본값) */
export const STATUS_NUM = {
  /** 출혈: 초당 최대 체력 비율 (겹침마다), 달리면 배 */
  bleedPerSec: 0.01,
  /** 출혈: 막기를 이만큼 이어 하면 멎는다 (초) */
  bleedBlockStop: 3,
  /** 오염: 단계마다 최대 체력 감소 */
  taintPerStack: 0.2,
  headacheSp: 0.5,
  /** 두통 걸린 AI 적의 공격 간격 배수 (10-30 결정) */
  headacheGap: 1.25,
  fearSpeed: 0.75,
  slowSpeed: 0.6,
  maxDebuffs: 3,
};

export interface Status {
  kind: DebuffKind;
  stacks: number;
  /** 남은 초 */
  t: number;
  /** 거는 쪽 배율 (퍽 「깊은 상처」: 출혈 피해 ×) */
  mul?: number;
}

export class StatusSet {
  list: Status[] = [];
  private blockT = 0;
  /** 걸리지 않는 상태 (퍽 「정신 방벽」: 공포·혼란) */
  immune?: Set<DebuffKind>;
  /** 오염 단계마다 줄어드는 최대 체력 (퍽 「내성」으로 줄어듦) */
  taintPer?: number;

  has(k: DebuffKind): boolean {
    return this.list.some((s) => s.kind === k);
  }
  stacks(k: DebuffKind): number {
    return this.list.find((s) => s.kind === k)?.stacks ?? 0;
  }

  /** 걸기. sec 생략이면 기본 시간. 새로 걸렸으면 true (글귀를 띄울지) */
  apply(kind: DebuffKind, sec?: number, mul?: number): boolean {
    if (this.immune?.has(kind)) return false;
    const def = STATUS[kind];
    const dur = def.sec === Infinity ? Infinity : Math.max(0.5, sec ?? def.sec);
    const cur = this.list.find((s) => s.kind === kind);
    if (cur) {
      cur.stacks = Math.min(def.max, cur.stacks + (def.max > 1 ? 1 : 0));
      cur.t = Math.max(cur.t, dur);
      if (mul) cur.mul = Math.max(cur.mul ?? 1, mul);
      return false;
    }
    if (this.list.length >= STATUS_NUM.maxDebuffs) {
      // 밀려나는 것: 남은 시간이 가장 짧은 것 (오염은 끝이 없어서 남는다)
      const out = [...this.list].sort((a, b) => a.t - b.t)[0];
      this.list = this.list.filter((s) => s !== out);
    }
    this.list.push({ kind, stacks: 1, t: dur, ...(mul ? { mul } : {}) });
    return true;
  }

  /** 해제. 오염은 한 단계씩(정화제), 나머지는 전부. 풀린 게 있으면 true */
  cure(kind: DebuffKind, stages = 1): boolean {
    const cur = this.list.find((s) => s.kind === kind);
    if (!cur) return false;
    if (kind === 'taint' && cur.stacks > stages) cur.stacks -= stages;
    else this.list = this.list.filter((s) => s !== cur);
    return true;
  }
  clear(): void {
    this.list = [];
  }

  /** 시간 흐름. 이 동안의 체력 피해(최대 체력 기준)를 돌려준다 */
  step(dt: number, o: { maxHp: number; running?: boolean; blocking?: boolean }): number {
    let dmg = 0;
    const bleed = this.stacks('bleed');
    if (bleed) dmg += o.maxHp * STATUS_NUM.bleedPerSec * bleed * (o.running ? 2 : 1) * dt * (this.list.find((s) => s.kind === 'bleed')?.mul ?? 1);
    // 막기를 이어 하면 출혈이 멎는다
    this.blockT = o.blocking ? this.blockT + dt : 0;
    if (bleed && this.blockT >= STATUS_NUM.bleedBlockStop) this.cure('bleed');
    for (const s of this.list) s.t -= dt;
    this.list = this.list.filter((s) => s.t > 0);
    return dmg;
  }

  /** 맞으면 혼란이 풀린다 */
  onHit(): void {
    this.cure('confuse');
  }

  speedMul(): number {
    return (this.has('slow') ? STATUS_NUM.slowSpeed : 1) * (this.has('fear') ? STATUS_NUM.fearSpeed : 1);
  }
  spMul(): number {
    return this.has('headache') ? STATUS_NUM.headacheSp : 1;
  }
  /** AI 두뇌의 공격 간격 배수: 두통이면 느려진다 */
  attackGap(): number {
    return this.has('headache') ? STATUS_NUM.headacheGap : 1;
  }

  canBlock(): boolean {
    return !this.has('fear');
  }
  canSkill(): boolean {
    return !this.has('silence');
  }
  flipped(): boolean {
    return this.has('confuse');
  }
  /** 오염으로 줄어든 최대 체력 비율 (1 = 그대로) */
  maxHpRatio(): number {
    return Math.max(0.2, 1 - (this.taintPer ?? STATUS_NUM.taintPerStack) * this.stacks('taint'));
  }

  /** 화면 표시용 */
  view(): { kind: DebuffKind; label: string; stacks: number; t: number | null }[] {
    return this.list.map((s) => ({ kind: s.kind, label: STATUS[s.kind].label, stacks: s.stacks, t: s.t === Infinity ? null : s.t }));
  }
}
