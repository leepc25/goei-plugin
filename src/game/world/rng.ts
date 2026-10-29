// 필드 세계의 무작위는 전부 이 씨앗 하나에서 나온다 (같은 씨앗 = 같은 하루, docs/필드_세계_NPC_설계.md 15장).
export type Rng = () => number;

/** mulberry32: 작고 빠르며 같은 씨앗이면 같은 수열 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 글자 씨앗 → 수 (FNV-1a) */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const range = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const pick = <T>(r: Rng, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];
