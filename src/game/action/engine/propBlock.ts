/** 바닥에 놓인 부술·들 물건(밥상·의자·TV…)을 몸이 뚫고 지나가지 않게 (검수 12, 15-2: 적 다리가 원탁 한가운데).
 * 벨트스크롤이라 옆(x)으로 막지 않고 깊이(y)로 비켜 세운다: 물건 앞이나 뒤로 돌아 걷는다. */
export interface BlockProp {
  x: number;
  y: number;
  w: number;
  /** 물건 뒤쪽 막는 깊이 (키 큰 상자 더미는 뒤에 서면 다리가 박혀 보인다). 없으면 PROP_DEPTH */
  back?: number;
  /** 물건 앞쪽 막는 깊이. 키 큰 물건(상자 더미) 바로 앞에 서면 다리가 물건 위에 걸쳐 앉은 듯 보인다 (검수 23). 없으면 PROP_DEPTH */
  front?: number;
}
export interface BlockBody {
  x: number;
  y: number;
  z: number;
  /** 지난 틱 x (요원 등 Fighter). 있으면 옆에서 걸어 들어오는 몸은 벽처럼 막는다 */
  px?: number;
}

/** 물건 발치 앞쪽으로 이만큼(깊이 px) 떨어져야 겹쳐 보이지 않는다 */
export const PROP_DEPTH = 50;
/** 한 틱에 비켜 서는 최대 거리 (순간 이동처럼 보이지 않게) */
const STEP = 9;

const backOf = (p: BlockProp) => p.back ?? PROP_DEPTH;
const frontOf = (p: BlockProp) => p.front ?? PROP_DEPTH;
/** 이 자리(x, y)가 물건 막힌 칸 안인가: 요원·적·생성 자리 모두 이 하나로 잰다 (검수 18) */
export function insideProp(p: BlockProp, x: number, y: number, pad = 0): boolean {
  const dy = y - p.y;
  return Math.abs(x - p.x) < p.w / 2 + 18 + pad && dy > -backOf(p) - pad && dy < frontOf(p) + pad;
}

/** 밀고 난 뒤에도 몸과 겹친 물건 번호들을 돌려준다 (제자리에 묶인 적: 숨은 적·잠든 적은 AI가 자리를 되돌린다) */
export function blockByProps(bodies: BlockBody[], props: BlockProp[], lane: [number, number]): Set<number> {
  const stuck = new Set<number>();
  for (const b of bodies) {
    if (b.z > 4) continue; // 뛰어넘는 중
    for (const p of props) {
      if (!insideProp(p, b.x, b.y)) continue;
      const front = p.y + frontOf(p),
        rear = p.y - backOf(p);
      const okF = front <= lane[1],
        okR = rear >= lane[0];
      const want: number | null = okF && okR ? (front - b.y < b.y - rear ? front : rear) : okF ? front : okR ? rear : null;
      // 옆에서 걸어 들어오면(밀려 들어와도) 그 자리에서 막고, 가까운 앞·뒤로 조금씩 미끄러져 돌아가게
      if (b.px !== undefined && !insideProp(p, b.px, b.y)) {
        b.x = b.px;
        if (want !== null) b.y = Math.max(lane[0], Math.min(lane[1], b.y + Math.max(-STEP / 3, Math.min(STEP / 3, want - b.y))));
        continue;
      }
      // 이미 안에 있으면(순간 이동·생성·떨어짐) 가까운 앞·뒤로 비켜 선다. 그쪽이 길 밖이면 반대쪽
      if (want === null) {
        // 길 깊이 전체를 막는 물건: 옆으로
        const side = b.x < p.x ? -1 : 1;
        b.x += side * STEP;
        continue;
      }
      b.y += Math.max(-STEP, Math.min(STEP, want - b.y));
      b.y = Math.max(lane[0], Math.min(lane[1], b.y));
    }
  }
  props.forEach((p, i) => {
    if (bodies.some((b) => b.z <= 4 && insideProp(p, b.x, b.y, -STEP))) stuck.add(i);
  });
  return stuck;
}

/** 오래 겹쳐 있는 물건은 물건 쪽을 옆으로 옮긴다: 다른 물건·몸과 겹치지 않는 가장 가까운 x */
export function nudgeProp(p: BlockProp, bodies: BlockBody[], others: BlockProp[], x0: number, x1: number): void {
  const clear = (x: number) =>
    x > x0 && x < x1 && !bodies.some((b) => Math.abs(b.x - x) < p.w / 2 + 60 && Math.abs(b.y - p.y) < PROP_DEPTH) && !others.some((o) => o !== p && Math.abs(o.x - x) < (o.w + p.w) / 2 + 20 && Math.abs(o.y - p.y) < PROP_DEPTH);
  for (let d = 40; d < 800; d += 20) for (const x of [p.x + d, p.x - d]) if (clear(x)) return void (p.x = x);
}

/** 몸을 세울 자리: 물건 발치(깊이 PROP_DEPTH, 폭 w/2+40) 밖으로. 깊이를 먼저 비키고, 안 되면 옆으로 (검수 17-1: 원탁 안에 생겨나는 적) */
export function clearSpot(x: number, y: number, props: BlockProp[], lane: [number, number]): { x: number; y: number } {
  const hit = (xx: number, yy: number) => props.some((p) => insideProp(p, xx, yy, 22));
  if (!hit(x, y)) return { x, y };
  for (const d of [60, -60, 110, -110, 170, -170, 230, -230]) {
    const yy = y + d;
    if (yy >= lane[0] && yy <= lane[1] && !hit(x, yy)) return { x, y: yy };
  }
  for (let d = 40; d < 600; d += 20) for (const xx of [x + d, x - d]) if (!hit(xx, y)) return { x: xx, y };
  return { x, y };
}

/** 층에 들·부술 물건을 놓을 때 피할 x 구간들: 층 소품, 지형(±180), 벽 그림 문·가구 앞, 적이 생겨날 자리 (검수 12-2, 17-3) */
export function furnishAvoid(
  floor: { props?: { x: number; w: number }[]; keepOut?: [number, number][]; encounters?: { waves: { x: number }[][] }[]; stage?: unknown },
  bodies: { x: number }[] = [],
): { x: number; w: number }[] {
  const terr = ((floor.stage as { terrain?: { x0: number; x1: number }[] } | undefined)?.terrain ?? []).map((t) => ({ x: (t.x0 + t.x1) / 2, w: t.x1 - t.x0 + 360 }));
  // 물건 폭은 가운데만 검사되므로 가장 넓은 물건(우편함 242) 절반만큼 더 넓게
  const doors = (floor.keepOut ?? []).map(([a, b]) => ({ x: (a + b) / 2, w: b - a + 260 }));
  const foes = [...(floor.encounters ?? []).flatMap((en) => en.waves.flat()), ...bodies].map((s) => ({ x: s.x, w: 200 }));
  return [...(floor.props ?? []).map((p) => ({ x: p.x, w: Math.max(p.w, 130) })), ...terr, ...doors, ...foes];
}
