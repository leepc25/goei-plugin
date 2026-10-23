// 관계값과 태도 (docs/필드_기능_설계.md 6-2, 12장). 모델 태그는 계기일 뿐, 수치는 여기서 정한다.
export type Mood = '평온' | '기쁨' | '화남' | '슬픔' | '불안' | '피곤';
export interface Rel { affinity: number; trust: number; mood: Mood; guard: 0 | 1 | 2 | 3; /** 오늘 오른 호감 */ today: number; day: number }
export const newRel = (): Rel => ({ affinity: 0, trust: 0, mood: '평온', guard: 0, today: 0, day: 0 });

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** 성격 계수 (1 = 보통). open = 마음 여는 정도, grudge = 화 오래 가는 정도 */
export interface Temper { open: number; grudge: number }
export const DEFAULT_TEMPER: Temper = { open: 1, grudge: 1 };

export type Cue = '호감' | '불쾌' | '진정' | '선물' | '구함' | '약속지킴' | '배신' | '폭력' | '위협' | '방해';
const BASE: Record<Cue, { aff: number; trust: number; mood?: Mood; guard?: number }> = {
  호감: { aff: 2, trust: 0, mood: '기쁨' },
  불쾌: { aff: -2, trust: 0, mood: '화남' },
  진정: { aff: 1, trust: 0, mood: '평온', guard: -1 },
  선물: { aff: 4, trust: 1, mood: '기쁨' },
  구함: { aff: 8, trust: 5 },
  약속지킴: { aff: 3, trust: 6 },
  배신: { aff: -15, trust: -40, mood: '화남', guard: 2 },
  폭력: { aff: -20, trust: -15, mood: '화남', guard: 3 },
  위협: { aff: -6, trust: -5, mood: '불안', guard: 1 },
  방해: { aff: -3, trust: 0, mood: '화남', guard: 1 },
};
/** 한 번에 ±5 이하, 하루 상한 +12. 같은 계기 반복(recent에 이미 있음)은 체감 */
export function applyCue(r: Rel, cue: Cue, t: Temper = DEFAULT_TEMPER, day = r.day, recent: Cue[] = []): Rel {
  const b = BASE[cue];
  if (!b) return r;
  const same = recent.filter(c => c === cue).length;
  const fade = 1 / (1 + same);
  const raw = b.aff * (b.aff > 0 ? t.open : t.grudge) * fade;
  const big = cue === '구함' || cue === '배신' || cue === '폭력';
  let d = big ? raw : clamp(raw, -5, 5);
  const base = day !== r.day ? { ...r, today: 0, day } : r;
  if (d > 0) d = Math.max(0, Math.min(d, 12 - base.today));
  const next: Rel = {
    ...base,
    affinity: clamp(Math.round(base.affinity + d), -100, 100),
    trust: clamp(base.trust + Math.round(b.trust * fade), 0, 100),
    mood: b.mood ?? base.mood,
    guard: clamp(base.guard + (b.guard ?? 0), 0, 3) as Rel['guard'],
    today: d > 0 ? base.today + d : base.today,
  };
  return next;
}

/** 시간이 흐른다: 호감은 아주 느리게 0쪽, 기분은 평온으로, 경계는 풀린다. hours = 지난 시간 */
export function decay(r: Rel, hours: number): Rel {
  const aff = r.affinity > 0 ? Math.max(0, r.affinity - Math.floor(hours / 24)) : Math.min(0, r.affinity + Math.floor(hours / 24));
  return { ...r, affinity: aff, mood: hours >= 3 ? '평온' : r.mood, guard: clamp(r.guard - Math.floor(hours / 2), 0, 3) as Rel['guard'] };
}

const STEPS = ['매우 싫음', '싫음', '불편', '보통', '호의', '친근', '매우 친근'];
/** 표시 7단계 */
export const affinityLabel = (a: number) => STEPS[clamp(Math.round((clamp(a, -100, 100) + 100) / (200 / 6)), 0, 6)];

/** 프롬프트에 넣을 한 줄 */
export const relLine = (r: Rel) => `호감 ${affinityLabel(r.affinity)}, 기분 ${r.mood}${r.guard ? `, 경계 ${r.guard}단계` : ''}`;

// ── 도발과 태도 (12장) ──
export type Stance = 'friendly' | 'neutral' | 'wary' | 'hostile' | 'fight' | 'flee' | 'down';
export interface Attitude { stance: Stance; provocation: number }
export interface Nerve { /** 문턱 배율: 작을수록 쉽게 화낸다 */ edge: number; /** 소심하면 전투 대신 도망 */ timid: boolean; canFight: boolean }
export const DEFAULT_NERVE: Nerve = { edge: 1, timid: false, canFight: false };

export function stanceOf(provocation: number, n: Nerve = DEFAULT_NERVE, affinity = 0): Stance {
  const p = provocation / n.edge - Math.max(0, affinity) / 10;
  if (p >= 90) return n.timid || !n.canFight ? 'flee' : 'fight';
  if (p >= 60) return 'hostile';
  if (p >= 30) return 'wary';
  return affinity >= 30 ? 'friendly' : 'neutral';
}
/** 도발 점수 변화. level 1~3 (3 = 선제 공격) */
export const provoke = (a: Attitude, level: 1 | 2 | 3, n: Nerve = DEFAULT_NERVE, affinity = 0): Attitude => {
  const p = clamp(a.provocation + [0, 12, 30, 100][level], 0, 100);
  return { provocation: p, stance: level === 3 && a.stance !== 'down' ? stanceOf(Math.max(p, 90), n, affinity) : stanceOf(p, n, affinity) };
};
export const calm = (a: Attitude, amount: number, n: Nerve = DEFAULT_NERVE, affinity = 0): Attitude => {
  if (a.stance === 'down') return a;
  const p = clamp(a.provocation - amount, 0, 100);
  return { provocation: p, stance: stanceOf(p, n, affinity) };
};
export const cool = (a: Attitude, hours: number, n: Nerve = DEFAULT_NERVE, affinity = 0) => calm(a, hours * 10, n, affinity);

/** 체력이 0이 됐을 때. 살해 설정이 꺼져 있으면 쓰러짐까지 */
export const lethal = (allowKill: boolean): 'kill' | 'down' => (allowKill ? 'kill' : 'down');

/** 목격자 반응: 같은 장면에 있던 사람의 호감·경계 */
export function witness(r: Rel, cue: 'violence' | 'help'): Rel {
  return cue === 'violence' ? applyCue(r, '위협') : applyCue(r, '호감');
}
