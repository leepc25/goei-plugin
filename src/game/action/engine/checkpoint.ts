// 저장 가능한 값만 넘긴다. 그림 함수는 스테이지 복원기가 다시 연결한다.
export const encodeState = (v: unknown): string => JSON.stringify(v, (_k, x) =>
  x instanceof Set ? { $set: [...x] } : x instanceof Map ? { $map: [...x] } : x === Infinity ? { $infinity: true } : x);
export const decodeState = <T>(s: string): T => JSON.parse(s, (_k, x) =>
  x && typeof x === 'object' ? ('$set' in x ? new Set(x.$set) : '$map' in x ? new Map(x.$map) : x.$infinity ? Infinity : x) : x);

export interface RunCheckpoint {
  version: 1;
  run: import('./contract').RunConfigCore;
  stage: string;
  world: string;
  savedAt: number;
}
