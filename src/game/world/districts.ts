// 거리 인구와 지역 이동 판정. 지역(district)이 바뀌는 이동은 시계 「지역 이동」(16-2장)으로 센다.
import type { SpawnRule } from './actors';

// 10-31 사용자: 장소 종류(도심·주택가·시장·유흥가 등)로 나눈 적도, 나눌 계획도 없다 → 모든 거리에 같은 규칙 하나.
// 시민은 그냥 시민(행인). 기믹 있는 종류(학생·불량배)가 섞인다. 옛 「장소 꼬리표 인구」(10-26 Claude 안, 6-4장)는 걷어냈다
/** 거리 유동인구 (모든 거리 장면 같음, 10-31 사용자: 시간대로 통제). 출퇴근·점심에 붐비고 새벽엔 거의 없다.
 *  학생은 등하교 시간에, 불량배는 밤에 많다. n = 장면에 있으려는 인원 (소란·시체·사건 현장이면 줄어든다). 수치는 시연판에서 조정 */
const P = (k: number) => Array<string>(k).fill('행인');
export const STREET_BANDS: { from: number; to: number; n: number; mix: string[] }[] = [
  { from: 0, to: 5, n: 1, mix: [...P(3), '불량배'] },              // 새벽: 거의 없음
  { from: 5, to: 7, n: 2, mix: P(1) },                             // 이른 아침
  { from: 7, to: 9, n: 8, mix: [...P(6), '학생', '학생', '학생'] },  // 출근·등교
  { from: 9, to: 11, n: 4, mix: P(1) },                            // 오전
  { from: 11, to: 14, n: 7, mix: P(1) },                           // 점심
  { from: 14, to: 16, n: 4, mix: [...P(6), '학생'] },               // 오후
  { from: 16, to: 18, n: 6, mix: [...P(5), '학생', '학생', '학생'] }, // 하교
  { from: 18, to: 20, n: 9, mix: [...P(8), '학생'] },               // 퇴근
  { from: 20, to: 22, n: 5, mix: [...P(5), '불량배'] },              // 저녁
  { from: 22, to: 24, n: 3, mix: [...P(3), '불량배', '불량배'] },     // 밤
];
/** 옛 낮·밤 두 칸 (bands 를 모르는 곳·시험용): 낮 = 점심 구간, 밤 = 밤 구간 */
export const STREET_POP: Omit<SpawnRule, 'scene' | 'gates'> = {
  target: { day: 7, night: 3 }, refill: [2, 5],
  mix: STREET_BANDS[4].mix, nightMix: STREET_BANDS[9].mix, bands: STREET_BANDS,
};

/** 거리 장면들 → 보충 규칙 */
export function streetSpawns(scenes: string[], gates: Record<string, number[]> = {}): SpawnRule[] {
  return scenes.map((scene) => ({ scene, ...STREET_POP, ...(gates[scene] ? { gates: gates[scene] } : {}) }));
}

/** 두 장면 사이 이동이 지역 이동인가 (둘 다 지역을 알고 서로 다를 때) */
export const isRegionMove = (from: string | null | undefined, to: string | null | undefined) => !!from && !!to && from !== to;
