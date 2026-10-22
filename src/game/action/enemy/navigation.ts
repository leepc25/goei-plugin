// 일반 적의 가구 우회. itemsLink가 이미 공개하는 충돌 목록을 읽고, 공용 충돌 처리는 그대로 둔다.
import { PROP_DEPTH, type BlockProp } from '../engine/propBlock';
import type { Enemy } from './enemy';
import type { WorldView } from './types';

type Point = { x: number; y: number };
type Rect = { left: number; right: number; top: number; bottom: number };
const inside = (p: Point, r: Rect) => p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom;

/** 선분이 열린 사각형 내부를 지나는가. 모서리를 잇는 선은 통과할 수 있다. */
function crosses(a: Point, b: Point, r: Rect) {
  let lo = 0, hi = 1;
  for (const [start, delta, min, max] of [[a.x, b.x - a.x, r.left, r.right], [a.y, b.y - a.y, r.top, r.bottom]]) {
    if (Math.abs(delta) < 1e-8) {
      if (start <= min || start >= max) return false;
    } else {
      const t0 = (min - start) / delta, t1 = (max - start) / delta;
      lo = Math.max(lo, Math.min(t0, t1));
      hi = Math.min(hi, Math.max(t0, t1));
    }
  }
  return hi - lo > 1e-8;
}

export function walkTo(e: Enemy, w: WorldView, x: number, y: number, sx = e.speed(), sy = sx * 0.6) {
  let target = { x, y: Math.max(w.lane[0], Math.min(w.lane[1], y)) };
  // 수호자는 기존 이동을 유지하고, 공중 적은 공용 충돌처럼 가구를 넘는다.
  const solids = !e.boss && e.z <= 4 ? (w as WorldView & { readonly solidsNow?: BlockProp[] }).solidsNow ?? [] : [];
  const rects = solids.map(p => ({ left: p.x - p.w / 2 - 22, right: p.x + p.w / 2 + 22,
    top: p.y - (p.back ?? PROP_DEPTH) - 4, bottom: p.y + (p.front ?? PROP_DEPTH) + 4 }));
  // 선호 거리의 종착점이 가구 안이면 플레이어까지 우회한 뒤 다음 틱에 거리를 다시 판단한다.
  if (rects.some(r => inside(target, r))) target = { x: w.player.x, y: w.player.y };
  // 생성/넉백으로 이미 가구 안이면 공용 충돌이 먼저 밖으로 밀어내게 한다.
  const obstacles = rects.filter(r => !inside(e, r));
  const clear = (a: Point, b: Point) => !obstacles.some(r => crosses(a, b, r));
  if (!clear(e, target)) {
    const points: Point[] = [e, target];
    for (const r of obstacles) for (const xx of [r.left, r.right]) for (const yy of [r.top, r.bottom]) {
      const p = { x: xx, y: yy };
      if (xx >= w.bounds[0] + 10 && xx <= w.bounds[1] - 10 && yy >= w.lane[0] && yy <= w.lane[1]
        && !obstacles.some(o => inside(p, o))) points.push(p);
    }
    const dist = points.map(() => Infinity), prev = points.map(() => -1), done = new Set<number>();
    dist[0] = 0;
    while (done.size < points.length) {
      let u = -1;
      for (let i = 0; i < points.length; i++) if (!done.has(i) && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || !Number.isFinite(dist[u]) || u === 1) break;
      done.add(u);
      for (let v = 1; v < points.length; v++) if (!done.has(v) && clear(points[u], points[v])) {
        const cost = dist[u] + Math.hypot(points[v].x - points[u].x, (points[v].y - points[u].y) * sx / sy);
        if (cost < dist[v]) { dist[v] = cost; prev[v] = u; }
      }
    }
    if (prev[1] < 0) return; // 통로 자체가 없으면 가구를 뚫거나 순간 이동하지 않는다.
    let next = 1;
    while (prev[next] > 0) next = prev[next];
    target = points[next];
    // 직선 비율을 보존해야 모서리로 향하는 중 가구 안을 가로지르지 않는다.
    const dx = target.x - e.x, dy = target.y - e.y;
    const t = Math.min(1, sx / (Math.abs(dx) || 1), sy / (Math.abs(dy) || 1));
    e.x += dx * t; e.y += dy * t;
    return;
  }
  const dx = target.x - e.x, dy = target.y - e.y;
  if (obstacles.length) {
    const t = Math.min(1, sx / (Math.abs(dx) || 1), sy / (Math.abs(dy) || 1));
    e.x += dx * t; e.y += dy * t;
  } else {
    e.x += Math.sign(dx) * Math.min(sx, Math.abs(dx));
    e.y += Math.sign(dy) * Math.min(sy, Math.abs(dy));
  }
}
