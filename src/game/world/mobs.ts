// 몹 자료 (docs/필드_세계_NPC_설계.md 6장, 사용자 확정: 외형·역할·성향·상태 분리, 성향은 나올 때마다 새로 뽑는다).
// 원형 = 역할 + 성향을 뽑는 범위 + 무엇을 할 수 있나. 그림 이름(look)과 따로다.
import type { Rng } from './rng';
import PROFILES from './mobProfiles.json';

export interface Temperament {
  /** 용기: 높으면 맞서고 말린다, 낮으면 도망 */
  courage: number;
  /** 친화: 수다·다가오기 */
  social: number;
  /** 성급함: 시비·급한 걸음 */
  haste: number;
  /** 호기심: 구경·주인공 쳐다보기 */
  curious: number;
  /** 손버릇: 소매치기 (거의 0, 일부만) */
  sly: number;
}
export type MobRole = 'civilian' | 'worker' | 'guard' | 'police' | 'thug' | 'staff' | 'student';
export interface Archetype {
  name: string;
  role: MobRole;
  /** 성향 범위 [최소, 최대] */
  range: Partial<Record<keyof Temperament, [number, number]>>;
  /** 그림 후보 (몹 71명 그림 이름. 없으면 원형 이름) */
  looks?: string[];
  /** 밤에 「취함」 상태가 붙을 수 있다 */
  drinks?: boolean;
}

/** 몸 등급 (docs/게임_성장_경제_설계.md 2-3, 기본값): 체력과 주머니 돈 범위. 원형 역할로 정한다 */
export type MobGrade = 'F' | 'E' | 'D' | 'C';
// 10-30: 체력 1,000 단위로(docs/설계_인물_초기값.md 등급표) — F 시민 0.15 · D 거리 0.3 · C 훈련 0.6. E 는 쓰지 않음
/** 주는 피해 배수 (같은 표) */
/** 주머니 돈 (원): 소매치기가 옮기고, 기절한 불량배·취객은 떨어뜨린다. 행인을 때려 돈 버는 구조는 막는다(떨어뜨리는 원형만) */
export const POCKET: Partial<Record<string, [number, number]>> = {
  행인: [0, 30000], 회사원: [5000, 50000], 관광객: [10000, 80000], 학생: [0, 10000], 주민: [0, 20000], 산책객: [0, 10000], 승객: [0, 20000], 상인: [20000, 100000],
  불량배: [3000, 40000], 취객: [5000, 60000],
};
/** 기절하면 주머니를 떨어뜨리는 원형 (설계 8장: 경찰·경비·행인은 안 떨굼) */
export const DROPS = new Set(['불량배', '취객']);

const BASE: Record<keyof Temperament, [number, number]> = { courage: [0.1, 0.8], social: [0.1, 0.8], haste: [0.1, 0.7], curious: [0.1, 0.8], sly: [0, 0.05] };

// 몹 71명 그림(인물 팩 roster.json, npc:true)을 원형마다 나눠 쓴다 (2026-10-29 NPC 배치). 가짜관리국·백일몽·협회·프리랜서 그림은 자리(장소·원형)가 정해지면 넣는다
const 시민 = ['시민남1', '시민남2', '시민남3', '시민남4', '시민남5', '시민남6', '시민남7', '시민남8', '시민남9', '시민여1', '시민여2', '시민여3', '시민여4', '시민여5', '시민여6', '시민여7', '시민여8', '시민여9'];
const 학생 = ['학생남1', '학생남2', '학생여1', '학생여2'];
const 불량배 = ['불량배남1', '불량배남2', '불량배남3', '불량배여1', '불량배여2', '불량배여3'];
const 관리국 = ['관리국남A', '관리국남B', '관리국여A', '관리국여B'];
const 경찰 = ['경찰남1', '경찰남2', '경찰여1', '경찰여2'];
const 상인 = ['상인남1', '상인남2', '상인남3', '상인남4', '상인여1', '상인여2', '상인여3'];
const 청소부 = ['청소부남1', '청소부여1'];
export const ARCHETYPES: Record<string, Archetype> = {
  행인: { name: '행인', role: 'civilian', range: {}, looks: 시민 },
  회사원: { name: '회사원', role: 'civilian', range: { haste: [0.3, 0.9] }, drinks: true, looks: 시민 },
  관광객: { name: '관광객', role: 'civilian', range: { curious: [0.5, 1], courage: [0.1, 0.5] }, looks: 시민 },
  학생: { name: '학생', role: 'student', range: { courage: [0, 0.6], curious: [0.4, 1] }, looks: 학생 },
  배달원: { name: '배달원', role: 'worker', range: { haste: [0.6, 1] }, looks: 시민 },
  불량배: { name: '불량배', role: 'thug', range: { courage: [0.5, 1], haste: [0.5, 1], sly: [0.05, 0.5] }, drinks: true, looks: 불량배 },
  방문객: { name: '방문객', role: 'civilian', range: { courage: [0.1, 0.5] }, looks: 시민 },
  '행정 직원': { name: '행정 직원', role: 'staff', range: { courage: [0.1, 0.5], social: [0.3, 0.9] }, looks: 관리국 },
  '안내 직원': { name: '안내 직원', role: 'staff', range: { social: [0.5, 1] }, looks: 관리국 },
  청소부: { name: '청소부', role: 'worker', range: { courage: [0.2, 0.6] }, looks: 청소부 },
  // 경비 그림은 따로 없어 관리국 직원 그림으로
  경비: { name: '경비', role: 'guard', range: { courage: [0.6, 1], curious: [0.4, 0.9] }, looks: 관리국 },
  // 관리국 전투원 (10-31): 훈련장에서 훈련, 그림은 관리국 4장 복사
  '관리국 요원': { name: '관리국 요원', role: 'guard', range: { courage: [0.6, 1], haste: [0.3, 0.8] }, looks: 관리국 },
  경찰: { name: '경찰', role: 'police', range: { courage: [0.6, 1], haste: [0.3, 0.7] }, looks: 경찰 },
  '편의점 점원': { name: '편의점 점원', role: 'staff', range: {}, looks: 상인 },
  // 의무실 근무형 (본부 B2 의무실·연구실)
  의사: { name: '의사', role: 'staff', range: { courage: [0.2, 0.6], social: [0.3, 0.8] }, looks: ['의사1'] },
  간호사: { name: '간호사', role: 'staff', range: { social: [0.5, 1] }, looks: ['간호사1'] },
  // 장소 종류별 인구(6-4장)에 쓰는 원형
  상인: { name: '상인', role: 'worker', range: { social: [0.4, 1], courage: [0.3, 0.8] }, looks: 상인 },
  취객: { name: '취객', role: 'civilian', range: { haste: [0.4, 1], courage: [0.4, 1], curious: [0.3, 0.9] }, drinks: true, looks: 시민 },
  주민: { name: '주민', role: 'civilian', range: { haste: [0, 0.5] }, looks: 시민 },
  산책객: { name: '산책객', role: 'civilian', range: { haste: [0, 0.4], social: [0.3, 0.9] }, looks: 시민 },
  승객: { name: '승객', role: 'civilian', range: { haste: [0.4, 1], curious: [0, 0.4] }, looks: 시민 },
};

export function rollTemper(r: Rng, a: Archetype | undefined): Temperament {
  const t = {} as Temperament;
  for (const k of Object.keys(BASE) as (keyof Temperament)[]) {
    const [lo, hi] = a?.range[k] ?? BASE[k];
    t[k] = lo + (hi - lo) * r();
  }
  return t;
}

/** 근무형 몹 (6-3장) */
export interface Post {
  id: string;
  archetype: string;
  scene: string;
  /** desk = 그 방 의자에서 책상 일(타자), train = 그 방에서 훈련 동작을 돌아가며 (10-31 자율 행동 2단계) */
  how: 'fixed' | 'patrol' | 'roam' | 'desk' | 'train';
  /** fixed: 서는 x. patrol: [왼쪽, 오른쪽] */
  spot?: number;
  /** fixed: 서는 깊이 y (없으면 걷는 띠 뒤쪽) */
  y?: number;
  span?: [number, number];
  /** roam: 도는 장면 순서, 장면마다 머무는 초 */
  route?: string[];
  stay?: number;
  /** 근무 [시작 시, 끝 시] 여러 개 (자정 넘김 가능) */
  shifts: [number, number][];
  count: number;
  /** 소란도가 이 단계 이상일 때만 (진압 대기 등) */
  uproar?: number;
  /** 들어오고 나가는 곳 x (그 장면) */
  gate: number;
}

export const inShift = (hour: number | null | undefined, shifts: [number, number][]) => {
  if (hour == null) return true;
  return shifts.some(([a, b]) => (a <= b ? hour >= a && hour < b : hour >= a || hour < b));
};

// 몹 그림 신상 (10-31 사용자: 직업이 안 적힌 시민은 그냥 엑스트라 시민, 성별·나이대는 그림과 맞아야 한다).
// 그림 설계 문서(docs/동작표_3판/6.*.md Subject·인상)에서 tools/build_mob_profiles.py 가 뽑는다. 모델에 몹을 넘길 때·관찰 창이 쓴다
export interface MobProfile { sex: '남' | '여'; age: string; job?: string; note: string }
export const profileOf = (look: string | undefined): MobProfile | null => (look ? ((PROFILES as Record<string, MobProfile>)[look] ?? null) : null);
