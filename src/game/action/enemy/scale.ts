// 엔진이 쟈알디를 도트 1px = 2.75 논리 px로 키웠다(검수 8번). 이 모듈의 수치는 2 기준으로 만들었으므로
// 불러올 때 한 번 길이·속도를 같은 비율로 늘린다. 깊이(dy)는 그대로.
import { PIXEL } from '../engine/contract';
import type { EnemyDef } from './roster';
import type { LocalBox, Move } from './types';
import { PROJ } from './proj';

export const K = PIXEL / 2;

const seenBox = new WeakSet<object>();
const seenMove = new WeakSet<object>();
function box(b: LocalBox) {
  if (seenBox.has(b)) return;
  seenBox.add(b);
  b.fx0 *= K;
  b.fx1 *= K;
  b.z0 *= K;
  b.z1 *= K;
}
function move(m: Move) {
  if (seenMove.has(m)) return;
  seenMove.add(m);
  for (const f of m.frames) {
    f.hit.forEach(box);
    f.hurt.forEach(box);
    if (f.vx) f.vx *= K;
    if (f.vz) f.vz *= K;
  }
  for (const d of m.danger ?? []) if (!seenBox.has(d)) (seenBox.add(d), (d.fx0 *= K), (d.fx1 *= K));
}

let done = false;
export function scaleAll(defs: EnemyDef[]) {
  if (done || K === 1) return;
  done = true;
  for (const d of defs) {
    d.w *= K;
    d.h *= K;
    d.speed *= K;
    if (d.hover) d.hover *= K;
    d.keep = [d.keep[0] * K, d.keep[1] * K];
    d.body.forEach(box);
    for (const a of d.attacks) {
      move(a.move);
      a.range = [a.range[0] * K, a.range[1] * K];
    }
  }
  for (const p of Object.values(PROJ)) {
    p.w *= K;
    p.h *= K;
    p.z *= K;
    p.speed *= K;
    if (p.vz) p.vz *= K;
    if (p.gravity) p.gravity *= K;
    if (p.grow) p.grow *= K;
  }
}
