/** 바닥에 놓인 부술·들 물건(밥상·의자·TV…)을 몸이 뚫고 지나가지 않게 (검수 12, 15-2: 적 다리가 원탁 한가운데).
 * 벨트스크롤이라 옆(x)으로 막지 않고 깊이(y)로 비켜 세운다: 물건 앞이나 뒤로 돌아 걷는다. */
export interface BlockProp {
  x: number;
  y: number;
  w: number;
}
export interface BlockBody {
  x: number;
  y: number;
  z: number;
}

/** 물건 발치에서 이만큼(깊이 px) 떨어져야 겹쳐 보이지 않는다 */
export const PROP_DEPTH = 50;
/** 한 틱에 비켜 서는 최대 거리 (순간 이동처럼 보이지 않게) */
const STEP = 9;

/** 밀고 난 뒤에도 몸과 겹친 물건 번호들을 돌려준다 (제자리에 묶인 적: 숨은 적·잠든 적은 AI가 자리를 되돌린다) */
export function blockByProps(bodies: BlockBody[], props: BlockProp[], lane: [number, number]): Set<number> {
  const stuck = new Set<number>();
  for (const b of bodies) {
    if (b.z > 4) continue; // 뛰어넘는 중
    for (const p of props) {
      const dy = b.y - p.y;
      if (Math.abs(b.x - p.x) >= p.w / 2 + 18 || Math.abs(dy) >= PROP_DEPTH) continue;
      // 가까운 쪽(앞·뒤)으로. 그쪽이 길 끝이면 반대쪽
      let s = dy === 0 ? (p.y < (lane[0] + lane[1]) / 2 ? 1 : -1) : Math.sign(dy);
      if ((s < 0 && p.y - PROP_DEPTH < lane[0]) || (s > 0 && p.y + PROP_DEPTH > lane[1])) s = -s;
      const want = p.y + s * PROP_DEPTH;
      b.y += Math.max(-STEP, Math.min(STEP, want - b.y));
      b.y = Math.max(lane[0], Math.min(lane[1], b.y));
    }
  }
  props.forEach((p, i) => {
    if (bodies.some((b) => b.z <= 4 && Math.abs(b.x - p.x) < p.w / 2 + 18 && Math.abs(b.y - p.y) < PROP_DEPTH - STEP)) stuck.add(i);
  });
  return stuck;
}

/** 오래 겹쳐 있는 물건은 물건 쪽을 옆으로 옮긴다: 다른 물건·몸과 겹치지 않는 가장 가까운 x */
export function nudgeProp(p: BlockProp, bodies: BlockBody[], others: BlockProp[], x0: number, x1: number): void {
  const clear = (x: number) =>
    x > x0 && x < x1 && !bodies.some((b) => Math.abs(b.x - x) < p.w / 2 + 60 && Math.abs(b.y - p.y) < PROP_DEPTH) && !others.some((o) => o !== p && Math.abs(o.x - x) < (o.w + p.w) / 2 + 20 && Math.abs(o.y - p.y) < PROP_DEPTH);
  for (let d = 40; d < 800; d += 20) for (const x of [p.x + d, p.x - d]) if (clear(x)) return void (p.x = x);
}
