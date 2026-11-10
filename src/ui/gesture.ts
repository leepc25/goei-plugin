// PC 마우스 제스처 (11-09 사용자: 브라우저 확장 「마우스 제스처」처럼). 오른쪽 단추를 누른 채 끌면 선이 그려지고, 놓을 때 모양으로 동작한다.
//   ←  뒤로 (상황판 전체, 폰 쓸기와 같은 navStep)      →  앞으로
//   ㄴ (↓ 뒤 →)  탭 닫기 (인터넷)                      ㄱ (→ 뒤 ↓)  닫은 탭 다시 열기 (인터넷)
// 끌지 않고 그냥 오른쪽 클릭하면 평소 메뉴가 뜬다. 끌었을 때만 메뉴를 막는다 (Windows 는 메뉴가 단추를 놓을 때 뜨므로 여기서 막힌다).
export type Gesture = 'L' | 'R' | 'DR' | 'RD';

export interface GestureHandler {
  /** 지금 이 제스처를 할 수 있는지와 이름 (못 하면 '' — 선은 그려지되 회색 글) */
  label(g: Gesture): string;
  run(g: Gesture): void;
}

const MOVE_MIN = 10;
/** 방향 하나로 셈하는 최소 거리 */
const SEG = 28;
const SKIP = 'input, textarea, select, [contenteditable]';
const bound = new WeakSet<HTMLElement>();

type Dir = 'L' | 'R' | 'U' | 'D';
function readGesture(dirs: Dir[]): Gesture | null {
  const s = dirs.join('');
  if (s === 'L') return 'L';
  if (s === 'R') return 'R';
  if (s === 'DR') return 'DR';
  if (s === 'RD') return 'RD';
  return null;
}

export function bindMouseGesture(root: HTMLElement, h: GestureHandler): void {
  if (bound.has(root)) return;
  bound.add(root);
  let on = false;
  let moved = false;
  let suppress = false;
  let pts: [number, number][] = [];
  let dirs: Dir[] = [];
  let anchor: [number, number] = [0, 0];
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
    const g = readGesture(dirs);
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
    clear();
  };
  const move = (e: PointerEvent) => {
    if (!on) return;
    const p = local(e);
    const [sx, sy] = pts[0];
    if (!moved && Math.hypot(p[0] - sx, p[1] - sy) < MOVE_MIN) return;
    if (!moved) {
      moved = true;
      ensure();
    }
    pts.push(p);
    const dx = p[0] - anchor[0];
    const dy = p[1] - anchor[1];
    if (Math.hypot(dx, dy) >= SEG) {
      const d: Dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : dy > 0 ? 'D' : 'U';
      if (dirs[dirs.length - 1] !== d) dirs.push(d);
      anchor = p;
    }
    draw();
  };
  const up = (e: PointerEvent) => {
    if (!on || e.button !== 2) return;
    const g = moved ? readGesture(dirs) : null;
    finish();
    if (moved) {
      suppress = true;
      setTimeout(() => (suppress = false), 300);
    }
    if (g && h.label(g)) h.run(g);
  };
  const cancel = () => finish();

  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 2 || e.pointerType !== 'mouse' || on) return;
    if ((e.target as HTMLElement).closest(SKIP)) return;
    on = true;
    moved = false;
    pts = [local(e)];
    anchor = pts[0];
    dirs = [];
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  });
  root.addEventListener('contextmenu', (e) => {
    if (moved && (on || suppress)) e.preventDefault();
  });
  root.addEventListener('dragstart', (e) => {
    if (on) e.preventDefault();
  });
}
