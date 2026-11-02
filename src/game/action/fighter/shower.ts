// 샤워 재생 규칙 (사용자 2026-11-01 17:10~17:12)
// - 동작을 처음부터 끝까지 통째로 되풀이하지 않는다. 동작 안의 「문지르는 구간」만 골라 속도를 바꿔 가며(빠르게·느리게) 반복하고,
//   들어가는 장·나오는 장은 한 번씩만 튼다. 머리감기(SH_D: 1~5장 손이 머리에)·몸씻기(SH_E: 1~5장) 둘 다 같은 식.
// - 샤워 한 번은 현실 시간 10분 이상(기본 600초). 구간 사이엔 멈춘 장(물 맞으며 서 있기)으로 쉰다.
// - 결과는 엔진 clip 의 seq({f, d}) 그대로라 fighter/core.ts play(id, {seq, onEnd}) 로 이어 틀면 된다.
export interface ShowerStep { id: string; seq: { f: number; d: number }[]; label: string }
export interface ShowerOpts { seconds?: number; seed?: number; has?: (id: string) => boolean; nOf?: (id: string) => number }

/** 머리감기·몸씻기 줄의 구간: 들어가는 장, 문지르는 장(앞뒤로 오가며 반복), 나오는 장, 서 있는 장 */
export const SHOWER_SEG = {
  SH_D: { into: [0], loop: [1, 2, 3, 4, 5], out: [6, 7], rest: 7, label: '머리감기' },
  SH_E: { into: [0], loop: [1, 2, 3, 4, 5], out: [6, 7], rest: 7, label: '몸씻기' },
} as const;
/** 문지르는 속도(한 장 초): 빠르게·보통·느리게. 2~3바퀴마다 바뀐다 */
export const SCRUB_SPEEDS = [0.08, 0.12, 0.18];

function rng(seed: number) {   // mulberry32: 시험이 같은 결과를 보게
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const total = (seq: { d: number }[]) => seq.reduce((s, e) => s + e.d, 0);

/** 한 블록: 들어가기 1번 → 문지르기 cycles 바퀴(앞뒤로, 속도 차등, 가끔 멈춤) → 나오기 1번 → 서 있기 hold 초 */
export function scrubBlock(id: keyof typeof SHOWER_SEG, cycles: number, hold: number, r: () => number): ShowerStep {
  const g = SHOWER_SEG[id]; const seq: { f: number; d: number }[] = [];
  for (const f of g.into) seq.push({ f, d: 0.14 });
  const L = g.loop, pingpong = [...L, ...L.slice(1, -1).reverse()];   // 1 2 3 4 5 4 3 2
  let speed = SCRUB_SPEEDS[Math.floor(r() * SCRUB_SPEEDS.length)], left = 2 + Math.floor(r() * 2);
  for (let c = 0; c < cycles; c++) {
    if (left-- <= 0) { speed = SCRUB_SPEEDS[Math.floor(r() * SCRUB_SPEEDS.length)]; left = 2 + Math.floor(r() * 2); }
    for (const f of pingpong) seq.push({ f, d: speed });
    if (r() < 0.25) seq.push({ f: L[Math.floor(r() * L.length)], d: 0.6 + r() * 0.9 });   // 잠깐 멈춤(헹굼)
  }
  for (const f of g.out) seq.push({ f, d: 0.16 });
  if (hold > 0) seq.push({ f: g.rest, d: hold });
  return { id, seq, label: g.label };
}

/** 샤워 전체 계획: 머리감기·몸씻기 블록을 번갈아(가끔 같은 것 두 번) 합계 seconds 이상 될 때까지 */
export function showerPlan(o: ShowerOpts = {}): ShowerStep[] {
  const seconds = o.seconds ?? 600, r = rng(o.seed ?? 1), has = o.has ?? (() => true);
  const ids = (['SH_D', 'SH_E'] as const).filter((id) => has(id));
  if (!ids.length) return [];
  const steps: ShowerStep[] = []; let t = 0, i = 0;
  while (t < seconds) {
    const id = ids[i % ids.length]; i += r() < 0.8 ? 1 : 0;   // 20%는 같은 동작 한 번 더
    const cycles = 6 + Math.floor(r() * 9), hold = 1.5 + r() * 3.5;
    const b = scrubBlock(id, cycles, hold, r); steps.push(b); t += total(b.seq);
  }
  return steps;
}
export const planSeconds = (p: ShowerStep[]) => p.reduce((s, b) => s + total(b.seq), 0);
