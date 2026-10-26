// 장소 종류별 인구 (docs/필드_세계_NPC_설계.md 6-4장). 장면에 꼬리표(area)만 붙이면 보충 규칙이 깔린다.
// 수치는 시연판에서 조정. 지역(district)이 바뀌는 이동은 시계 「지역 이동」(16-2장)으로 센다.
import type { SpawnRule } from './actors';

export type AreaKind = 'downtown' | 'alley' | 'market' | 'nightlife' | 'residential' | 'park' | 'subway';

export const POPULATION: Record<AreaKind, Omit<SpawnRule, 'scene' | 'gates'>> = {
  // 도심: 낮 회사원·행인 많음, 밤 한산·취객
  downtown: { target: { day: 8, night: 3 }, refill: [2, 5], mix: ['행인', '회사원', '회사원', '학생', '관광객', '배달원', '불량배'], nightMix: ['행인', '회사원', '취객', '취객', '불량배'] },
  // 뒷골목: 지나가는 사람 적음, 밤엔 불량배
  alley: { target: { day: 4, night: 2 }, refill: [3, 7], mix: ['행인', '회사원', '배달원', '불량배'], nightMix: ['행인', '취객', '불량배', '불량배'] },
  // 서민 상권·시장: 낮 빽빽, 밤 폐장
  market: { target: { day: 10, night: 1 }, refill: [1.5, 4], mix: ['상인', '상인', '주민', '주민', '행인', '배달원', '관광객'], nightMix: ['주민', '취객'] },
  // 번화·유흥가: 낮 적음, 밤 취객·불량배
  nightlife: { target: { day: 3, night: 9 }, refill: [2, 5], mix: ['행인', '회사원', '배달원'], nightMix: ['취객', '취객', '회사원', '불량배', '불량배', '행인'] },
  // 주택가·학교 앞: 주민·학생, 밤 드문드문
  residential: { target: { day: 4, night: 2 }, refill: [3, 8], mix: ['주민', '주민', '학생', '학생', '배달원', '행인'], nightMix: ['주민', '배달원'] },
  // 공원·강변: 산책·운동
  park: { target: { day: 5, night: 2 }, refill: [3, 7], mix: ['산책객', '산책객', '주민', '학생', '관광객'], nightMix: ['산책객', '취객'] },
  // 지하철: 승객
  subway: { target: { day: 9, night: 3 }, refill: [1.5, 4], mix: ['승객', '승객', '회사원', '학생', '행인'], nightMix: ['승객', '취객', '회사원'] },
};

/** 장면 꼬리표 → 보충 규칙 */
export function areaSpawns(areas: Record<string, AreaKind>, gates: Record<string, number[]> = {}): SpawnRule[] {
  return Object.entries(areas).map(([scene, area]) => ({ scene, ...POPULATION[area], ...(gates[scene] ? { gates: gates[scene] } : {}) }));
}

/** 두 장면 사이 이동이 지역 이동인가 (둘 다 지역을 알고 서로 다를 때) */
export const isRegionMove = (from: string | null | undefined, to: string | null | undefined) => !!from && !!to && from !== to;
