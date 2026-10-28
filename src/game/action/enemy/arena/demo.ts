// 적 시험장 단일 HTML 진입점 (release/demo/goei-enemy-arena.html). 그림 없음, 회색 상자만.
import { ArenaWorld, FLOOR_LABEL, FLOOR_TYPES, GROUPS, describe, draw } from './arena';
import { DEF_BY_KIND } from '../index';
import type { Keys } from './player';
import type { FloorType } from '../types';

const css = `
*{box-sizing:border-box}html,body{margin:0;height:100%;background:#0b0f12;color:#e8e4d8;font:14px/1.4 system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;overscroll-behavior:none}
#app{display:flex;flex-direction:column;height:100dvh;width:100vw;overflow:hidden}
.bar{display:flex;flex-wrap:wrap;gap:6px;padding:6px 8px;background:#151c1f;border-bottom:1px solid #2c383e;align-items:center}
.bar button,.bar select{background:#232d32;color:#e8e4d8;border:1px solid #3a474e;border-radius:8px;padding:6px 10px;font:inherit;cursor:pointer;touch-action:manipulation}
.bar button.on{background:#c9a24a;color:#14110a;border-color:#c9a24a}
.bar .depth{display:flex;align-items:center;gap:4px}
.bar .depth span{min-width:44px;text-align:center}
.stage{position:relative;flex:1;min-height:0;display:flex;align-items:flex-start;justify-content:center;background:#05080a}
canvas{width:100%;height:100%;object-fit:contain;object-position:top;display:block;touch-action:none}
.bar .opt{display:none}.bar.expanded .opt{display:inline-flex}
@media (pointer:fine){.bar .opt{display:inline-flex}.bar #more{display:none}}
@media (pointer:coarse){.bar{gap:4px;padding:4px 6px}.bar button,.bar select{padding:5px 8px}.info{display:none}.info.show{display:block;position:fixed;left:8px;right:8px;top:48px;z-index:5;max-height:60dvh;border:1px solid #3a474e;border-radius:10px}}
.info{white-space:pre-wrap;padding:6px 10px;background:#151c1f;border-top:1px solid #2c383e;font-size:13px;max-height:24vh;overflow:auto}
.sheet{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;z-index:10;padding:12px}
.sheet.open{display:flex}
.sheet .card{background:#1a2226;border:1px solid #3a474e;border-radius:12px;max-width:760px;width:100%;max-height:90dvh;overflow:auto;padding:14px}
.sheet h3{margin:12px 0 6px;font-size:14px;color:#c9a24a}
.sheet .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.sheet .grid button{background:#232d32;color:#e8e4d8;border:1px solid #3a474e;border-radius:8px;padding:8px;text-align:left;font:inherit;cursor:pointer}
.sheet .row{display:flex;gap:10px;align-items:center;justify-content:space-between}
.sheet .row button{background:#c9a24a;border:0;border-radius:8px;padding:8px 14px;font:inherit;font-weight:700;cursor:pointer}
.touch{position:absolute;inset:0;pointer-events:none;display:none}
.touch.show{display:block}
.stick{position:absolute;left:12px;bottom:12px;width:136px;height:136px;border-radius:50%;background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.18);pointer-events:auto;touch-action:none}
.stick i{position:absolute;left:50%;top:50%;width:62px;height:62px;margin:-31px;border-radius:50%;background:rgba(255,255,255,.25)}
.pad{position:absolute;right:8px;bottom:8px;display:grid;grid-template-columns:repeat(4,52px);gap:6px;pointer-events:auto;opacity:.85}
.pad button{width:52px;height:52px;border-radius:50%;border:2px solid rgba(255,255,255,.25);background:rgba(20,26,30,.7);color:#fff;font:700 13px/1.1 inherit;touch-action:none;user-select:none;-webkit-user-select:none}
.pad button.big{background:rgba(201,162,74,.55)}
.pad button.down{background:rgba(255,255,255,.35)}
`;

const app = document.getElementById('app') ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'app' }));
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
app.innerHTML = `
<div class="bar">
  <select id="floor">${FLOOR_TYPES.map((t) => `<option value="${t}">${FLOOR_LABEL[t]}</option>`).join('')}</select>
  <button id="wave">편성</button>
  <button id="pick">적 고르기</button>
  <button id="more">☰</button>
  <span class="depth opt"><button id="dm">−</button><span id="dl"></span><button id="dp">+</button></span>
  <button id="bureau" class="opt">관리국 난입</button>
  <button id="dream" class="opt">백일몽</button>
  <button id="boxes" class="opt">판정</button>
  <button id="god" class="opt">무적</button>
  <button id="freeze" class="opt">AI 멈춤</button>
  <button id="clear" class="opt">지우기</button>
  <button id="help" class="opt">설명</button>
</div>
<div class="stage"><canvas id="cv" width="1280" height="560"></canvas>
  <div class="touch" id="touch"><div class="stick" id="stick"><i></i></div>
  <div class="pad">
    <button data-k="F">빛</button><button data-k="E">상호</button><button data-k="G">환경<br>무기</button><button data-k="D">폭파</button>
    <button data-h="crouch">앉기</button><button data-h="guard">가드</button><button data-k="S">사격</button><button data-k="Space">점프</button>
    <button data-k="T">먹기</button><button data-h="run">달리기</button><button data-k="Evade">회피</button><button data-k="A" class="big">공격</button>
  </div></div>
</div>
<div class="info" id="info"></div>
<div class="sheet" id="sheet"><div class="card" id="sheetCard"></div></div>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const cv = $<HTMLCanvasElement>('cv');
const ctx = cv.getContext('2d')!;
const w = new ArenaWorld(20261021);
(window as any).__arena = w;

const q = new URLSearchParams(location.search);
let floor: FloorType = (q.get('floor') as FloorType) || 'lobby';
w.depth = Number(q.get('depth') ?? 4);
w.setFloor(floor);
$<HTMLSelectElement>('floor').value = floor;
const info = $('info');
let infoT = 0;
const showInfo = (s: string) => {
  info.textContent = s;
  // 휴대폰: 잠깐 띄웠다 숨긴다 (누르면 바로 닫힘)
  info.classList.add('show');
  clearTimeout(infoT);
  infoT = setTimeout(() => info.classList.remove('show'), 6000) as unknown as number;
};
info.onclick = () => info.classList.remove('show');
$('more').onclick = () => document.querySelector('.bar')!.classList.toggle('expanded');
const HELP =
  '조작 (PC): 방향키 이동 · Shift 짧게 회피 / 누르고 있으면 달리기 · Space 점프 · A 3연타 (달리며 A 돌진, 공중 A 점프 킥, 앉아 A 하단) · S 권총 · D 폭파 · Q 가드 · X 앉기 · E 상호작용 (인사·문 닫기·틈새 막기·그릇·「잘 먹었습니다」) · T 밥 먹기 · F 손전등 · G 환경 무기(아머 무시) · H 판정 보기 · P 일시정지\n' +
  '휴대폰: 왼쪽 원으로 이동, 오른쪽 버튼. 가로 화면 권장.\n' +
  '빨강 띠 = 곧 공격이 떨어질 자리 (예고). 빨간 테두리·! = 예고 중, 노란 테두리 = 슈퍼아머, 흰 삼각 = 약점 열림.';
info.textContent = HELP;

const dl = $('dl');
const showDepth = () => (dl.textContent = w.depth <= 3 ? `L${w.depth}` : `B-${w.depth - 3}`);
showDepth();
$('dm').onclick = () => ((w.depth = Math.max(1, w.depth - 1)), showDepth());
$('dp').onclick = () => ((w.depth = Math.min(30, w.depth + 1)), showDepth());
$<HTMLSelectElement>('floor').onchange = (e) => {
  floor = (e.target as HTMLSelectElement).value as FloorType;
  w.clear();
  w.setFloor(floor);
};
$('wave').onclick = () => w.spawnPlan();
$('bureau').onclick = () => w.spawnPlan('bureau');
$('dream').onclick = () => w.spawnPlan('daydream');
const toggle = (id: string, get: () => boolean, set: (v: boolean) => void) => {
  const b = $(id);
  b.onclick = () => (set(!get()), b.classList.toggle('on', get()));
};
toggle('boxes', () => w.showBoxes, (v) => (w.showBoxes = v));
toggle('god', () => w.player.invincible, (v) => (w.player.invincible = v));
toggle('freeze', () => w.aiFrozen, (v) => (w.aiFrozen = v));
$('clear').onclick = () => w.clear();
$('help').onclick = () => showInfo(HELP);

// 적 고르기
const sheet = $('sheet');
let elite = false;
function openPicker() {
  const card = $('sheetCard');
  card.innerHTML =
    `<div class="row"><label><input type="checkbox" id="elite" ${elite ? 'checked' : ''}> 정예로 부르기</label><button id="close">닫기</button></div>` +
    GROUPS.map((g) => `<h3>${g.label}</h3><div class="grid">${g.kinds.map((k) => `<button data-kind="${k}">${DEF_BY_KIND[k].label}${DEF_BY_KIND[k].mid ? ' ★' : ''}</button>`).join('')}</div>`).join('');
  sheet.classList.add('open');
  $('close').onclick = () => sheet.classList.remove('open');
  $<HTMLInputElement>('elite').onchange = (e) => (elite = (e.target as HTMLInputElement).checked);
  card.querySelectorAll<HTMLButtonElement>('button[data-kind]').forEach(
    (b) =>
      (b.onclick = () => {
        const kind = b.dataset.kind!;
        const x = w.player.x < 640 ? 1000 : 280;
        const d = DEF_BY_KIND[kind];
        if (d.faction === 'guardian') {
          if (kind === 'elder_f') (w.spawn('elder_f', x - 60, 580), w.spawn('elder_m', x + 60, 600));
          else w.spawn(kind, kind === 'touchers' ? 640 : x, 590);
        } else w.spawn(kind, x, 560 + Math.random() * 100, { elite });
        showInfo(describe(kind));
        sheet.classList.remove('open');
      }),
  );
}
$('pick').onclick = openPicker;
sheet.onclick = (e) => e.target === sheet && sheet.classList.remove('open');

// 입력
const keys: Keys = { left: false, right: false, up: false, down: false, shift: false, guard: false, crouch: false, press: new Set() };
let pending = new Set<string>();
let evadeTap = 0;
const KEYMAP: Record<string, string> = { KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyE: 'E', KeyF: 'F', KeyG: 'G', KeyT: 'T', Space: 'Space' };
addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'SELECT') return;
  const c = e.code;
  if (c === 'ArrowLeft') keys.left = true;
  else if (c === 'ArrowRight') keys.right = true;
  else if (c === 'ArrowUp') keys.up = true;
  else if (c === 'ArrowDown') keys.down = true;
  else if (c === 'ShiftLeft' || c === 'ShiftRight') keys.shift = true;
  else if (c === 'KeyQ') keys.guard = true;
  else if (c === 'KeyX' || c === 'KeyC') keys.crouch = true;
  else if (c === 'KeyH') (w.showBoxes = !w.showBoxes), $('boxes').classList.toggle('on', w.showBoxes);
  else if (c === 'KeyP' || c === 'Escape') w.paused = !w.paused;
  else if (KEYMAP[c] && !e.repeat) pending.add(KEYMAP[c]);
  else return;
  e.preventDefault();
});
addEventListener('keyup', (e) => {
  const c = e.code;
  if (c === 'ArrowLeft') keys.left = false;
  else if (c === 'ArrowRight') keys.right = false;
  else if (c === 'ArrowUp') keys.up = false;
  else if (c === 'ArrowDown') keys.down = false;
  else if (c === 'ShiftLeft' || c === 'ShiftRight') keys.shift = false;
  else if (c === 'KeyQ') keys.guard = false;
  else if (c === 'KeyX' || c === 'KeyC') keys.crouch = false;
});
addEventListener('blur', () => Object.assign(keys, { left: false, right: false, up: false, down: false, shift: false, guard: false, crouch: false }));

// 터치: 왼쪽 원 = 이동 (끝까지 밀면 달리기), 오른쪽 버튼
const touchEl = $('touch');
if (matchMedia('(pointer: coarse)').matches || q.has('touch')) touchEl.classList.add('show');
const stick = $('stick');
const knob = stick.querySelector('i') as HTMLElement;
let stickId: number | null = null;
let holdRun = false;
const stickMove = (e: PointerEvent) => {
  const r = stick.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2),
    dy = e.clientY - (r.top + r.height / 2);
  const m = Math.hypot(dx, dy),
    max = r.width / 2;
  if (m > max) ((dx *= max / m), (dy *= max / m));
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  keys.left = dx < -max * 0.3;
  keys.right = dx > max * 0.3;
  keys.up = dy < -max * 0.35;
  keys.down = dy > max * 0.35;
  keys.shift = holdRun || (m > max * 0.92 && Math.abs(dx) > max * 0.7);
};
stick.addEventListener('pointerdown', (e) => ((stickId = e.pointerId), stick.setPointerCapture(e.pointerId), stickMove(e)));
stick.addEventListener('pointermove', (e) => e.pointerId === stickId && stickMove(e));
const stickEnd = (e: PointerEvent) => {
  if (e.pointerId !== stickId) return;
  stickId = null;
  knob.style.transform = '';
  Object.assign(keys, { left: false, right: false, up: false, down: false, shift: holdRun });
};
stick.addEventListener('pointerup', stickEnd);
stick.addEventListener('pointercancel', stickEnd);
touchEl.querySelectorAll<HTMLButtonElement>('.pad button').forEach((b) => {
  const k = b.dataset.k,
    h = b.dataset.h;
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.classList.add('down');
    if (k === 'Evade') evadeTap = 2;
    else if (k) pending.add(k);
    if (h === 'crouch') keys.crouch = true;
    if (h === 'guard') keys.guard = true;
    if (h === 'run') ((holdRun = true), (keys.shift = true));
  });
  const up = () => {
    b.classList.remove('down');
    if (h === 'crouch') keys.crouch = false;
    if (h === 'guard') keys.guard = false;
    if (h === 'run') ((holdRun = false), (keys.shift = false));
  };
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
});

// 30Hz 고정 틱
let acc = 0,
  last = performance.now();
function frame(now: number) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= 1 / 30) {
    acc -= 1 / 30;
    // 터치 회피 = Shift를 한 틱 눌렀다 떼기
    if (evadeTap === 2) ((keys.shift = true), (evadeTap = 1));
    else if (evadeTap === 1) ((keys.shift = holdRun), (evadeTap = 0));
    keys.press = pending;
    pending = new Set();
    w.update(keys);
  }
  draw(ctx, w, 160);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 시작: 편성 하나
if (q.get('spawn') !== 'none') w.spawnPlan();
