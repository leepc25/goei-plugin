/** 포즈 수와 재생 시간을 분리한다. 준비·타격·회수의 가변 유지 시간에 사용한다. */
export function clipIndex(phase: number, frames: readonly number[], times?: readonly number[]): number {
  if (!frames.length) return 0;
  const p = Math.max(0, Math.min(0.999999, phase));
  if (!times || times.length !== frames.length) return Math.floor(p * frames.length);
  const duration = times.reduce((sum, value) => sum + value, 0);
  if (duration <= 0) return 0;
  let cursor = p * duration;
  for (let i = 0; i < times.length; i++) {
    if (cursor < times[i]) return i;
    cursor -= times[i];
  }
  return frames.length - 1;
}
