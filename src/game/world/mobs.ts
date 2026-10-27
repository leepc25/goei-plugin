// 몹 자료 (docs/필드_세계_NPC_설계.md 6장, 사용자 확정: 외형·역할·성향·상태 분리, 성향은 나올 때마다 새로 뽑는다).
// 원형 = 역할 + 성향을 뽑는 범위 + 무엇을 할 수 있나. 그림 이름(look)과 따로다.
import type { Rng } from './rng';

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

const BASE: Record<keyof Temperament, [number, number]> = { courage: [0.1, 0.8], social: [0.1, 0.8], haste: [0.1, 0.7], curious: [0.1, 0.8], sly: [0, 0.05] };

export const ARCHETYPES: Record<string, Archetype> = {
  행인: { name: '행인', role: 'civilian', range: {} },
  회사원: { name: '회사원', role: 'civilian', range: { haste: [0.3, 0.9] }, drinks: true },
  관광객: { name: '관광객', role: 'civilian', range: { curious: [0.5, 1], courage: [0.1, 0.5] } },
  학생: { name: '학생', role: 'student', range: { courage: [0, 0.6], curious: [0.4, 1] } },
  배달원: { name: '배달원', role: 'worker', range: { haste: [0.6, 1] } },
  불량배: { name: '불량배', role: 'thug', range: { courage: [0.5, 1], haste: [0.5, 1], sly: [0.05, 0.5] }, drinks: true },
  방문객: { name: '방문객', role: 'civilian', range: { courage: [0.1, 0.5] } },
  '행정 직원': { name: '행정 직원', role: 'staff', range: { courage: [0.1, 0.5], social: [0.3, 0.9] } },
  '안내 직원': { name: '안내 직원', role: 'staff', range: { social: [0.5, 1] } },
  청소부: { name: '청소부', role: 'worker', range: { courage: [0.2, 0.6] } },
  경비: { name: '경비', role: 'guard', range: { courage: [0.6, 1], curious: [0.4, 0.9] } },
  경찰: { name: '경찰', role: 'police', range: { courage: [0.6, 1], haste: [0.3, 0.7] } },
  '편의점 점원': { name: '편의점 점원', role: 'staff', range: {} },
  // 장소 종류별 인구(6-4장)에 쓰는 원형
  상인: { name: '상인', role: 'worker', range: { social: [0.4, 1], courage: [0.3, 0.8] } },
  취객: { name: '취객', role: 'civilian', range: { haste: [0.4, 1], courage: [0.4, 1], curious: [0.3, 0.9] }, drinks: true },
  주민: { name: '주민', role: 'civilian', range: { haste: [0, 0.5] } },
  산책객: { name: '산책객', role: 'civilian', range: { haste: [0, 0.4], social: [0.3, 0.9] } },
  승객: { name: '승객', role: 'civilian', range: { haste: [0.4, 1], curious: [0, 0.4] } },
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
  how: 'fixed' | 'patrol' | 'roam';
  /** fixed: 서는 x. patrol: [왼쪽, 오른쪽] */
  spot?: number;
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
