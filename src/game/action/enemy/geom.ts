// 상자 계산. 깊이는 y 차이가 두 상자의 dy 합 안이어야 겹친다 (게임_모듈_연결 2장).
import type { LocalBox, PartBox, WBox } from './types';

export function overlap(a: WBox, b: WBox): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1 && Math.abs(a.y - b.y) <= (a.dy ?? 18) + (b.dy ?? 18);
}

/** 몸 기준 상자 → 월드 상자 */
export function toWorld(b: LocalBox, x: number, y: number, z: number, dir: number): PartBox {
  const a = x + b.fx0 * dir,
    c = x + b.fx1 * dir;
  return { x0: Math.min(a, c), x1: Math.max(a, c), z0: z + b.z0, z1: z + b.z1, y, dy: b.dy, part: b.part };
}
