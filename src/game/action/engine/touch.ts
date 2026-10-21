// 엔진 기본 터치 조작 (ui/ 모듈이 붙으면 그쪽 것을 쓴다). 왼쪽 = 놓은 자리에서 시작하는 스틱, 오른쪽 = 버튼.
import type { Btn, Input } from './input';

const CSS = `
.gt-wrap{position:absolute;inset:0;pointer-events:none;user-select:none;-webkit-user-select:none;touch-action:none;z-index:5}
.gt-stick{position:absolute;left:0;top:0;bottom:0;width:42%;pointer-events:auto;touch-action:none}
.gt-ring{position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;border:2px solid rgba(255,255,255,.35);background:rgba(255,255,255,.06);display:none}
.gt-knob{position:absolute;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(255,255,255,.4);display:none}
.gt-btns{position:absolute;right:10px;bottom:10px;display:grid;grid-template-columns:repeat(4,52px);gap:6px;pointer-events:auto}
.gt-b{width:52px;height:52px;border-radius:12px;background:rgba(20,26,30,.6);border:2px solid rgba(255,255,255,.3);color:#e8eef0;font:600 14px sans-serif;display:flex;align-items:center;justify-content:center;touch-action:none}
.gt-b.on{background:rgba(255,211,106,.6);color:#111}
.gt-b.big{background:rgba(180,60,50,.6)}
.gt-top{position:absolute;right:10px;top:10px;display:flex;gap:8px;pointer-events:auto}
`;

const BTNS: [Btn, string, string?][] = [
  ['super', '필살'], ['guard', '가드'], ['reload', '장전'], ['item1', '1'],
  ['skill', '폭파'], ['shoot', '사격'], ['shift', '회피'], ['item2', '2'],
  ['jump', '점프'], ['attack', '공격', 'big'], ['interact', 'E'], ['hitbox', '판정'],
];

export function mountTouch(root: HTMLElement, input: Input): () => void {
  const st = document.createElement('style');
  st.textContent = CSS;
  const wrap = document.createElement('div');
  wrap.className = 'gt-wrap';
  wrap.innerHTML = `<div class="gt-stick"><div class="gt-ring"></div><div class="gt-knob"></div></div><div class="gt-btns"></div><div class="gt-top"><div class="gt-b" data-b="pause">메뉴</div></div>`;
  root.append(st, wrap);
  const grid = wrap.querySelector('.gt-btns')!;
  for (const [b, label, cls] of BTNS) {
    const d = document.createElement('div');
    d.className = 'gt-b' + (cls ? ' ' + cls : '');
    d.dataset.b = b;
    d.textContent = label;
    grid.appendChild(d);
  }
  wrap.querySelectorAll<HTMLElement>('.gt-b').forEach((el) => {
    const b = el.dataset.b as Btn;
    const on = (e: PointerEvent) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('on');
      input.press(b);
    };
    const off = () => {
      el.classList.remove('on');
      input.release(b);
    };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
  });
  // 스틱
  const stick = wrap.querySelector<HTMLElement>('.gt-stick')!;
  const ring = wrap.querySelector<HTMLElement>('.gt-ring')!;
  const knob = wrap.querySelector<HTMLElement>('.gt-knob')!;
  let id = -1;
  let ox = 0;
  let oy = 0;
  const held = new Set<Btn>();
  const set = (b: Btn, v: boolean) => {
    if (v && !held.has(b)) (held.add(b), input.press(b));
    if (!v && held.has(b)) (held.delete(b), input.release(b));
  };
  const move = (x: number, y: number) => {
    const dx = x - ox;
    const dy = y - oy;
    const r = Math.min(50, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    knob.style.left = ox + Math.cos(a) * r + 'px';
    knob.style.top = oy + Math.sin(a) * r + 'px';
    const T = 18;
    set('left', dx < -T);
    set('right', dx > T);
    set('up', dy < -T);
    set('down', dy > T);
  };
  stick.addEventListener('pointerdown', (e) => {
    if (id >= 0) return;
    e.preventDefault();
    id = e.pointerId;
    stick.setPointerCapture(id);
    const r = stick.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    ring.style.display = knob.style.display = 'block';
    ring.style.left = ox + 'px';
    ring.style.top = oy + 'px';
    move(ox, oy);
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const r = stick.getBoundingClientRect();
    move(e.clientX - r.left, e.clientY - r.top);
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    ring.style.display = knob.style.display = 'none';
    for (const b of [...held]) set(b, false);
  };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
  return () => {
    wrap.remove();
    st.remove();
  };
}
