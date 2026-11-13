// PC 마우스 제스처 (11-09 사용자: 브라우저 확장 「마우스 제스처」처럼). 오른쪽 단추를 누른 채 끌면 선이 그려지고, 놓을 때 모양으로 동작한다.
//   ←  뒤로 (상황판 전체, 폰 쓸기와 같은 navStep)      →  앞으로
//   ㄴ (↓ 뒤 →)  탭 닫기 (인터넷)                      ㄱ 거꾸로 (↑ 뒤 ←)  닫은 탭 다시 열기 (인터넷, 2026-11-10 사용자: ㄱ 을 역순으로 그리는 것)
// 끌지 않고 그냥 오른쪽 클릭하면 평소 메뉴가 뜬다. 끌었을 때만 메뉴를 막는다 (Windows 는 메뉴가 단추를 놓을 때 뜨므로 여기서 막힌다).
// 모양 읽기는 readStroke 하나 (2026-11-12 사용자: ㄱ 거꾸로가 안 먹음 → 제스처마다 고치지 않고 읽는 곳 하나를 고친다).
//   옛 방식(28px 구간마다 방향, 방향 열이 정확히 같아야 함)은 끝·첫머리가 살짝 삐치거나 ㄱ 다리처럼 비스듬히 그으면 못 읽었다.
//   지금: 선을 큰 획으로 간추리고(RDP) → 짧은 삐침은 버리고 → 비스듬한 획은 옆 획과 직각이 되는 쪽으로 읽는다.
export type Gesture = 'L' | 'R' | 'DR' | 'UL';

export interface GestureHandler {
  /** 지금 이 제스처를 할 수 있는지와 이름 (못 하면 '' — 선은 그려지되 회색 글) */
  label(g: Gesture): string;
  run(g: Gesture): void;
}

const MOVE_MIN = 10;
/** 획 하나로 셈하는 최소 길이 */
const SEG = 28;
/** 간추릴 때 이만큼 벗어난 굽이는 같은 획으로 본다 */
const RDP_EPS = 14;
/** 가장 긴 획의 이 비율보다 짧은 획은 삐침으로 보고 버린다 */
const HOOK_RATIO = 0.35;
/** 이만큼 긴 획은 비율과 상관없이 진짜 획이다 (짧은 세로 + 긴 가로 ㄱ거꾸로·ㄴ, 전수검사 11-13) */
const LEG_MIN = 45;
/** 축에서 이 각도(도) 안이면 그 방향이 분명하다. 넘으면 비스듬한 획 */
const AXIS_DEG = 32;
const SKIP = 'input, textarea, select, [contenteditable]';
const bound = new WeakSet<HTMLElement>();

type Dir = 'L' | 'R' | 'U' | 'D';
type Pt = readonly [number, number];
/** 제스처 목록: 획 방향 열 → 제스처. 새 제스처는 여기에만 더한다 */
const SHAPES: Record<string, Gesture> = { L: 'L', R: 'R', DR: 'DR', UL: 'UL' };

function simplify(pts: readonly Pt[], eps: number): Pt[] {
  if (pts.length < 3) return [...pts];
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
    let far = -1;
    let max = eps;
    for (let i = a + 1; i < b; i++) {
      // 선분까지의 거리 (곧은 선까지가 아니라): 갔다가 되돌아온 자취의 꺾인 곳도 잡힌다
      const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * (bx - ax) + (pts[i][1] - ay) * (by - ay)) / len2));
      const d = Math.hypot(pts[i][0] - (ax + t * (bx - ax)), pts[i][1] - (ay + t * (by - ay)));
      if (d > max) (max = d), (far = i);
    }
    if (far > 0) (keep[far] = true), stack.push([a, far], [far, b]);
  }
  return pts.filter((_, i) => keep[i]);
}
const turn = (a: Pt, b: Pt) => Math.abs((Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]) * 180) / Math.PI);
/** 같은 쪽으로 이어지는 획(꺾임 40° 미만)은 하나로 */
function join(vs: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const v of vs) {
    const p = out[out.length - 1];
    if (p && turn(p, v) < 40) out[out.length - 1] = [p[0] + v[0], p[1] + v[1]];
    else out.push(v);
  }
  return out;
}
/** 끈 자취 → 제스처 (없으면 null). 선 그리는 중의 이름표와 놓았을 때의 동작이 같은 함수를 쓴다 */
export function readStroke(pts: readonly Pt[]): Gesture | null {
  if (pts.length < 2) return null;
  const v = simplify(pts, RDP_EPS);
  let vs = join(v.slice(1).map((p, i): Pt => [p[0] - v[i][0], p[1] - v[i][1]]));
  const longest = Math.max(...vs.map((s) => Math.hypot(s[0], s[1])));
  if (longest < SEG) return null;
  vs = join(vs.filter((s) => Math.hypot(s[0], s[1]) >= Math.max(SEG * 0.6, Math.min(LEG_MIN, longest * HOOK_RATIO))));
  if (!vs.length || vs.length > 3) return null;
  // 획마다: 축에 가까우면 그 방향, 비스듬하면 일단 비워 둔다
  const off = (s: Pt) => (Math.atan2(Math.min(Math.abs(s[0]), Math.abs(s[1])), Math.max(Math.abs(s[0]), Math.abs(s[1]))) * 180) / Math.PI;
  const horiz = (s: Pt): Dir => (s[0] > 0 ? 'R' : 'L');
  const vert = (s: Pt): Dir => (s[1] > 0 ? 'D' : 'U');
  const sure = vs.map((s): Dir | null => (off(s) <= AXIS_DEG ? (Math.abs(s[0]) >= Math.abs(s[1]) ? horiz(s) : vert(s)) : null));
  const dirs = vs.map((s, i): Dir => {
    if (sure[i]) return sure[i]!;
    // 비스듬한 획: 옆 획이 가로면 세로로, 세로면 가로로 (ㄱ 다리처럼). 옆 획이 없거나 둘 다 비스듬하면 더 많이 간 쪽
    const near = sure[i + 1] ?? sure[i - 1];
    if (near) return near === 'L' || near === 'R' ? vert(s) : horiz(s);
    return Math.abs(s[0]) >= Math.abs(s[1]) ? horiz(s) : vert(s);
  });
  const key = dirs.filter((d, i) => d !== dirs[i - 1]).join('');
  return SHAPES[key] ?? null;
}

export function bindMouseGesture(root: HTMLElement, h: GestureHandler): void {
  if (bound.has(root)) return;
  bound.add(root);
  let on = false;
  let moved = false;
  let suppress = false;
  let pts: [number, number][] = [];
  let canvas: HTMLCanvasElement | null = null;
  let tip: HTMLDivElement | null = null;

  const ensure = () => {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'gx-gest';
    canvas.width = root.clientWidth;
    canvas.height = root.clientHeight;
    root.appendChild(canvas);
    tip = document.createElement('div');
    tip.className = 'gx-gest-tip';
    root.appendChild(tip);
  };
  const clear = () => {
    canvas?.remove();
    tip?.remove();
    canvas = tip = null;
  };
  const draw = () => {
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = getComputedStyle(root).getPropertyValue('--signal').trim() || '#e35d6a';
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
    const g = readStroke(pts);
    const label = g ? h.label(g) : '';
    if (tip) {
      tip.textContent = g ? label || '—' : '';
      tip.classList.toggle('off', !!g && !label);
      const [x, y] = pts[pts.length - 1];
      tip.style.left = `${x + 16}px`;
      tip.style.top = `${y + 16}px`;
    }
  };
  const local = (e: PointerEvent): [number, number] => {
    const r = root.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const finish = () => {
    if (!on) return;
    on = false;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('blur', cancel);
    clear();
  };
  const move = (e: PointerEvent) => {
    if (!on) return;
    // 놓는 것을 못 받았을 때(창 밖에서 놓음·메뉴가 가로챔): 오른쪽 단추가 떨어져 있으면 여기서 끝낸다
    if (!(e.buttons & 2)) return finish();
    const p = local(e);
    const [sx, sy] = pts[0];
    if (!moved && Math.hypot(p[0] - sx, p[1] - sy) < MOVE_MIN) return;
    if (!moved) {
      moved = true;
      ensure();
    }
    pts.push(p);
    draw();
  };
  const up = (e: PointerEvent) => {
    if (!on || e.button !== 2) return;
    const g = moved ? readStroke(pts) : null;
    finish();
    if (moved) {
      suppress = true;
      setTimeout(() => (suppress = false), 300);
    }
    if (g && h.label(g)) h.run(g);
  };
  const cancel = () => finish();

  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 2 || e.pointerType !== 'mouse') return;
    // 앞 제스처의 놓기를 못 받아 켜진 채 남았으면 치우고 새로 시작한다 (옛 코드는 여기서 돌아가 버려 그 뒤로 제스처가 전부 죽었다)
    if (on) finish();
    if ((e.target as HTMLElement).closest(SKIP)) return;
    on = true;
    moved = false;
    pts = [local(e)];
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
  });
  root.addEventListener('contextmenu', (e) => {
    if (moved && (on || suppress)) e.preventDefault();
  });
  root.addEventListener('dragstart', (e) => {
    if (on) e.preventDefault();
  });
}
