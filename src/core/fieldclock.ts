// 필드 시계: 걸은 거리에서 초를 센다 (한 걸음에 1분이 아니라 실제 속도). 필드 시각은 본편보다 앞설 수 있고,
// 합칠 때는 둘 중 늦은 쪽을 쓴다.
export const PX_PER_M = 142;
export const WALK_MPS = 1.3;
/** 장면 이동에 드는 초 */
export const DOOR_S = 3;
export const STAIR_S = 20;
export const ELEVATOR_S = 30;
export const TALK_S = 40;

export const walkSeconds = (px: number) => Math.round(Math.max(0, px) / PX_PER_M / WALK_MPS);

/** 시각(분) 표기 HH:MM (24시간 넘으면 다음 날로 돈다) */
export function clockText(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** 필드 시각(초)과 본편 시각(분)을 합친다. 늦은 쪽이 이긴다. 본편 시각이 없으면 필드 것 */
export function mergeClock(fieldSec: number | null, mainMinute: number | null): number | null {
  const a = fieldSec, b = mainMinute === null ? null : mainMinute * 60;
  return a === null ? b : b === null ? a : Math.max(a, b);
}
