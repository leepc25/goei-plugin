// 두뇌가 다른 적을 부를 때 쓰는 늦은 연결 (순환 import 피하기). index.ts가 채운다.
import type { WorldView } from './types';

type Spawner = (w: WorldView, kind: string, x: number, y: number, opts?: { elite?: boolean }) => unknown;
let spawner: Spawner | null = null;
export function setSpawner(fn: Spawner) {
  spawner = fn;
}
export function spawnInto(w: WorldView, kind: string, x: number, y: number, opts?: { elite?: boolean }) {
  return spawner?.(w, kind, x, y, opts);
}
