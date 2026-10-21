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
export const PROP_DEPTH = 34;
/** 한 틱에 비켜 서는 최대 거리 (순간 이동처럼 보이지 않게) */
const STEP = 9;

export function blockByProps(bodies: BlockBody[], props: BlockProp[], lane: [number, number]): void {
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
}
