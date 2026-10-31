// 거리 인구와 지역 이동 판정. 지역(district)이 바뀌는 이동은 시계 「지역 이동」(16-2장)으로 센다.
import type { SpawnRule } from './actors';

// 10-31 사용자: 장소 종류(도심·주택가·시장·유흥가 등)로 나눈 적도, 나눌 계획도 없다 → 모든 거리에 같은 규칙 하나.
// 시민은 그냥 시민(행인). 기믹 있는 종류(학생·불량배)가 섞인다. 옛 「장소 꼬리표 인구」(10-26 Claude 안, 6-4장)는 걷어냈다
/** 거리 인구 (모든 거리 장면 같음). 수치는 옛 도심 값 그대로, 시연판에서 조정 */
export const STREET_POP: Omit<SpawnRule, 'scene' | 'gates'> = {
  target: { day: 8, night: 3 }, refill: [2, 5],
  mix: ['행인', '행인', '행인', '행인', '행인', '학생', '불량배'],
  nightMix: ['행인', '행인', '행인', '행인', '불량배'],
};

/** 거리 장면들 → 보충 규칙 */
export function streetSpawns(scenes: string[], gates: Record<string, number[]> = {}): SpawnRule[] {
  return scenes.map((scene) => ({ scene, ...STREET_POP, ...(gates[scene] ? { gates: gates[scene] } : {}) }));
}

/** 두 장면 사이 이동이 지역 이동인가 (둘 다 지역을 알고 서로 다를 때) */
export const isRegionMove = (from: string | null | undefined, to: string | null | undefined) => !!from && !!to && from !== to;
