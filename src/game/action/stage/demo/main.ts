// 차원 승강기 층 생성 시연판 (단일 HTML). 대역 엔진 + createElevatorStage.
import { B12, FLOOR_TYPES, depthLabel } from '../data/floortypes';
import { RULE } from '../data/rules';
import { createElevatorStage, itemName } from '../module';
import type { StagePlan } from '../plan';
import { exitOpen, exitProgress, rulebook, variantNotes, type StageMeta } from '../state';
import { DT, DemoEngine, type Keys } from './engine';
import css from './style.css';

const KEY = 'goei-elevator-stage:v1';
const store = {
  load(): StageMeta | null {
    try {
      const s = localStorage.getItem(KEY);
      return s ? (JSON.parse(s) as StageMeta) : null;
    } catch {
      return null;
    }
  },
  save(m: StageMeta) {
    try {
      localStorage.setItem(KEY, JSON.stringify(m));
    } catch {
      /* 저장 못 해도 진행 */
    }
  },
};

const logLines: string[] = [];
const stage = createElevatorStage(store, { log: (s) => (logLines.push(s), logLines.length > 80 && logLines.shift(), renderLog()) });

document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
document.body.innerHTML = `
<div class="es">
  <div class="es-top"><b>차원 승강기 · 층 생성 시연판</b><span data-where></span><span class="sp"></span><button data-do="book">규칙서 (R)</button><button data-do="log">기록 (L)</button><button data-do="map">지도 (M)</button></div>
  <div class="es-view"><canvas width="1280" height="720"></canvas>
    <div class="es-panel" data-panel="start"></div>
    <div class="es-panel" data-panel="book"></div>
    <div class="es-panel" data-panel="log"><h2>출동 기록</h2><pre data-log></pre><div class="row"><button data-do="close">닫기</button></div></div>
    <div class="es-panel" data-panel="end"></div>
  </div>
  <div class="es-pad">
    <div class="stick"><i></i></div>
    <div class="btns">
      <button data-k="attack">A<small>공격</small></button><button data-k="jump">점프<small>Space</small></button><button data-k="interact">E<small>조사</small></button>
      <button data-k="run">달리기<small>Shift</small></button><button data-k="crouch" data-toggle>앉기<small>C</small></button><button data-do="book">규칙서</button>
    </div>
  </div>
  <p class="es-help">←→ 이동 · ↑↓ 앞뒤 · Space 점프 · Shift 누른 채 달리기 · C 앉기(낮은 천장·덕트) · A 공격(대역) · E 조사·문·패널·인사 · R 규칙서 · L 기록 · M 정비 구역 지도</p>
</div>`;
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const canvas = $<HTMLCanvasElement>('canvas');
const ctx = canvas.getContext('2d')!;

let eng: DemoEngine | null = null;
let agent = 'jyaldi';
let panel: string | null = 'start';
let showMap = true;
const keys = new Set<string>();
const edges = new Set<string>();
let crouchToggle = false;

function show(name: string | null) {
  panel = name;
  document.querySelectorAll<HTMLElement>('.es-panel').forEach((p) => p.classList.toggle('on', p.dataset.panel === name));
  if (name === 'start') renderStart();
  if (name === 'book') renderBook();
  if (name === 'log') renderLog();
}
function renderStart() {
  const m = stage.meta();
  $('[data-panel=start]').innerHTML = `<h2>차원 승강기</h2>
<p>낡은 건물의 엘리베이터를 탔더니 「띵. 1층입니다.」 그런데 로비가 아니다. 내려갈수록 층마다 규칙이 다르고, 아무도 미리 알려 주지 않는다.</p>
<p>이 시연판은 <b>층 생성과 층 규칙</b>을 걸어서 확인하는 판이다. 전투·적·대사·그림은 다른 작업이 붙인다(지금은 회색 상자와 대역 공격).</p>
<p>출동 ${m.outings}회 · 최저 ${m.deepest ? depthLabel(m.deepest) : '—'} · 한 출동 최다 ${m.bestFloors}층 · 총애 ${m.favor} · 재편 ${m.epoch}회<br>EXIT 조건: ${exitProgress(m)}${exitOpen(m) ? ' → <b>로비 L1 패널에 EXIT가 뜬다</b>' : ''}</p>
<div class="row"><button data-agent="jyaldi" class="${agent === 'jyaldi' ? 'sel' : ''}">쟈알디</button><button data-agent="eileen" class="${agent === 'eileen' ? 'sel' : ''}">에일린</button></div>
<div class="row"><button data-do="go" class="go">출동 (E)</button><button data-do="exitfill">EXIT 조건 바로 채우기 (시험용)</button><button data-do="reset">기록 지우기</button></div>
<p class="dim">흐름: 로비 L1~L3 → 층 끝 패널(E) → 승강기 안에서 인사·버튼 → B-1… · 점검문/해치(E) → 정비 구역(사다리·덕트) → 다락방(매트·인터폰 송신·로프 귀환) · 90초 넘게 있으면 포식자</p>`;
}
function renderBook() {
  const m = stage.meta();
  const out = stage.outing();
  const book = rulebook(m);
  const found = out?.found ?? [];
  const vars = out ? variantNotes(m, out) : [];
  $('[data-panel=book]').innerHTML = `<h2>규칙서</h2>
<p>${exitProgress(m)} · 재편 ${m.epoch}회</p>
<ul>${book.map((b) => `<li class="${b.stale ? 'stale' : ''}">${b.text}</li>`).join('') || '<li class="dim">아직 송신한 줄이 없다. 표지(노란 상자)를 E로 읽고, 다락방 인터폰이나 로프로 송신해야 남는다.</li>'}</ul>
${found.length ? `<h3>읽었지만 아직 송신 안 함 (후송되면 사라짐)</h3><ul>${found.map((id) => `<li>${RULE[id]?.texts[m.ruleVer[id] ?? 0] ?? id}</li>`).join('')}</ul>` : ''}
${vars.length ? `<h3>이번 출동에는 다름</h3><ul>${vars.map((v) => `<li class="var">${v}</li>`).join('')}</ul>` : out?.variants.length ? `<p class="dim">이번 출동에 뒤집힌 줄이 ${out.variants.length}개 있다. 그 줄을 알아야 보인다.</p>` : ''}
${out ? `<p>가진 것: ${out.items.map(itemName).join(', ') || '없음'}</p>` : ''}
<div class="row"><button data-do="close">닫기 (R)</button></div>`;
}
function renderLog() {
  const el = document.querySelector('[data-log]');
  if (el) el.textContent = logLines.slice().reverse().join('\n');
}
function renderEnd(how: 'return' | 'evac') {
  const m = stage.meta();
  const out = stage.outing()!;
  const ending = out.ending;
  $('[data-panel=end]').innerHTML = `<h2>${ending ? '출구 · 진짜 로비' : how === 'evac' ? '후송' : '귀환'}</h2>
${ending ? '<p>패널에 EXIT가 떴다. 눌렀다. 문이 열리자 관리국 차량. 인터폰 마지막 한 줄: 「또 와요.」</p><p><b>승강기가 재편됐다.</b> 규칙서 몇 줄이 바뀌어 취소선이 그어졌고, 총애는 0, 층 유형·수호자·승객의 진실이 다시 섞였다. 영원한 공략은 없다.</p>' : ''}
${how === 'evac' ? `<p>송신하지 못한 규칙 ${out.found.length}줄은 사라졌다.</p>` : `<p>송신한 규칙 ${out.sent.length}줄.</p>`}
<p>가 본 층: ${out.visited.map((v) => `${depthLabel(v.depth)} ${FLOOR_TYPES[v.type].label}`).join(' → ')}</p>
<p>최저 기록 ${depthLabel(m.deepest)}${m.deepest >= B12 ? ' (B-12 도달)' : ''} · 한 출동 최다 ${m.bestFloors}층 · 총애 ${m.favor}</p>
<div class="row"><button data-do="again" class="go">다시 출동 (E)</button><button data-do="book">규칙서</button></div>`;
  show('end');
}

function begin() {
  const seed = Math.floor(Math.random() * 1e9);
  logLines.length = 0;
  eng = new DemoEngine(stage, { seed, agent });
  eng.onFloor = (plan: StagePlan) => {
    $('[data-where]').textContent = plan.title;
  };
  eng.onEnd = (how) => setTimeout(() => renderEnd(how), 600);
  eng.viewW = canvas.width;
  eng.start();
  show(null);
  canvas.focus();
}

// ── 입력
const codeMap: Record<string, string> = { KeyA: 'attack', Space: 'jump', KeyE: 'interact', ShiftLeft: 'run', ShiftRight: 'run' };
addEventListener('keydown', (e) => {
  if (e.repeat && e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
  if (e.code === 'KeyR') return void show(panel === 'book' ? null : 'book');
  if (e.code === 'KeyL') return void show(panel === 'log' ? null : 'log');
  if (e.code === 'KeyM') return void (showMap = !showMap);
  if (e.code === 'KeyC') crouchToggle = !crouchToggle;
  if (e.code === 'Escape') return void show(panel && panel !== 'start' && panel !== 'end' ? null : panel);
  if (e.code === 'KeyE' && (panel === 'start' || panel === 'end')) return void begin();
  keys.add(e.code);
  const k = codeMap[e.code];
  if (k) edges.add(k);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-do],[data-agent]');
  if (!t) return;
  if (t.dataset.agent) (agent = t.dataset.agent), renderStart();
  switch (t.dataset.do) {
    case 'go':
    case 'again':
      begin();
      break;
    case 'book':
      show(panel === 'book' ? null : 'book');
      break;
    case 'log':
      show(panel === 'log' ? null : 'log');
      break;
    case 'map':
      showMap = !showMap;
      break;
    case 'close':
      show(eng && !eng.ended ? null : eng ? 'end' : 'start');
      break;
    case 'exitfill':
      stage.debugFillExit();
      renderStart();
      break;
    case 'reset':
      if (confirm('규칙서·총애·기록을 지울까요?')) stage.resetMeta(), renderStart();
      break;
  }
});
// 터치: 스틱 + 버튼
const stick = $('.stick'),
  thumb = $('.stick i');
let sx = 0,
  sy = 0,
  sid: number | null = null;
const onStick = (ev: PointerEvent) => {
  if (ev.type === 'pointerdown') (sid = ev.pointerId), stick.setPointerCapture(ev.pointerId);
  if (sid !== ev.pointerId) return;
  if (ev.type === 'pointerup' || ev.type === 'pointercancel') {
    sid = null;
    sx = sy = 0;
    thumb.style.transform = '';
    return;
  }
  const r = stick.getBoundingClientRect();
  const dx = (ev.clientX - r.left - r.width / 2) / (r.width / 2),
    dy = (ev.clientY - r.top - r.height / 2) / (r.height / 2);
  // 판이 90° 돌아가 있으면 화면 아래쪽이 판의 오른쪽이다
  sx = Math.max(-1, Math.min(1, rotated ? dy : dx));
  sy = Math.max(-1, Math.min(1, rotated ? -dx : dy));
  thumb.style.transform = `translate(${sx * 34}px,${sy * 34}px)`;
};
for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) stick.addEventListener(t, onStick);
const held = new Set<string>();
document.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => {
  const k = b.dataset.k!;
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (b.hasAttribute('data-toggle')) {
      crouchToggle = !crouchToggle;
      return;
    }
    held.add(k);
    edges.add(k);
    b.setPointerCapture(e.pointerId);
  });
  const up = () => held.delete(k);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
});

function readKeys(): Keys {
  const x = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0) + (Math.abs(sx) > 0.3 ? Math.sign(sx) : 0);
  const y = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0) + (Math.abs(sy) > 0.35 ? Math.sign(sy) : 0);
  const k: Keys = {
    x: Math.max(-1, Math.min(1, x)),
    y: Math.max(-1, Math.min(1, y)),
    run: keys.has('ShiftLeft') || keys.has('ShiftRight') || held.has('run') || Math.abs(sx) > 0.92,
    jump: edges.has('jump'),
    attack: edges.has('attack'),
    interact: edges.has('interact'),
    crouch: crouchToggle,
  };
  edges.clear();
  return k;
}

// ── HUD
function hud(camX: number) {
  if (!eng) return;
  const e = eng;
  const plan = e.plan;
  const m = stage.meta();
  const out = stage.outing();
  const W = canvas.width,
    S = hudScale;
  const font = (px: number, bold = false) => `${bold ? 'bold ' : ''}${Math.round(px * S)}px sans-serif`;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, 64 * S);
  ctx.font = font(22, true);
  ctx.fillStyle = plan.palette?.accent ?? '#fff';
  ctx.fillText(plan.title, 16, 30 * S);
  ctx.font = font(15);
  ctx.fillStyle = '#ddd';
  const hearts = Array.from({ length: 7 }, (_, i) => (i - 3 === 0 ? '·' : i - 3 <= m.favor && i - 3 > 0 ? '♥' : i - 3 >= m.favor && i - 3 < 0 ? '✕' : '○')).join('');
  ctx.fillText(`총애 ${m.favor > 0 ? '+' : ''}${m.favor} ${hearts}   미송신 규칙 ${out?.found.length ?? 0}   가방 ${out?.items.length ?? 0}   최저 ${depthLabel(Math.max(1, m.deepest))}`, 16, 56 * S);
  // 체력
  const hpW = W < 1000 ? 200 : 360;
  ctx.fillStyle = '#311';
  ctx.fillRect(W - hpW - 20, 12, hpW, 16 * S);
  ctx.fillStyle = e.p.hp < e.p.hpMax * 0.3 ? '#f44' : '#4c4';
  ctx.fillRect(W - hpW - 20, 12, (hpW * Math.max(0, e.p.hp)) / e.p.hpMax, 16 * S);
  ctx.fillStyle = '#fff';
  ctx.fillText(`HP ${Math.max(0, Math.round(e.p.hp))}`, W - hpW - 15, 12 + 13 * S);
  // 유형별 계기
  let gy = 64 * S + 22 * S;
  const gauge = (label: string, v: number, color: string) => {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(12, gy - 18 * S, 300 * S, 26 * S);
    ctx.fillStyle = color;
    ctx.fillRect(110 * S, gy - 12 * S, 190 * S * Math.max(0, Math.min(1, v)), 12 * S);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, 18, gy);
    gy += 30 * S;
  };
  const f = plan.stage.floor;
  if (f && (f.type === 'silent' || f.type === 'deep')) gauge('소리', e.noise, e.noise > 0.75 ? '#f55' : '#9fc6c0');
  if (f && (f.type === 'dark' || f.type === 'deep')) gauge('빛', e.light, '#e8d7a0');
  if (f?.type === 'chase' && plan.stage.fx.chaseX > -9000) {
    const gap = e.p.x - plan.stage.fx.chaseX;
    gauge(`뒤의 것 ${Math.round(gap / 10)}m`, Math.min(1, gap / 900), gap < 300 ? '#f55' : '#ff8a6a');
  }
  if (f?.type === 'puzzle') {
    const sq = (plan.stage.fx.squeeze ?? 0) > 0;
    ctx.fillStyle = sq ? '#f88' : '#c9a8ff';
    ctx.fillText(sq ? '벽이 조여 온다!' : '벽이 조여 오기 전에 셔터를 열어라', 18, gy);
    gy += 30 * S;
  }
  if (f?.goal) {
    ctx.fillStyle = '#7ad0ff';
    ctx.fillText(`시험: ${f.goal.text}`, 18, gy);
    gy += 26 * S;
  }
  if (plan.stage.where === 'service' && out?.service) {
    const left = out.service.predatorAfter - out.serviceTime;
    gauge(left > 0 ? `포식자 ${Math.ceil(left)}초` : '포식자!', left / out.service.predatorAfter, left < 20 ? '#f55' : '#f0b860');
  }
  if (plan.stage.where === 'car') {
    ctx.fillStyle = '#ffd27a';
    ctx.fillText(`버튼 ${plan.stage.buttons?.length ?? 0}개${W < 1000 ? '' : ' (총애가 높을수록 많고 유형이 보인다)'}${out?.greeted ? ' · 인사함' : ''}`, 18, gy);
    gy += 26 * S;
  }
  // 정비 구역 지도
  if (showMap && out?.service && plan.stage.where === 'service') {
    const z = out.service;
    const cw = 46 * S,
      ch = 26 * S,
      x0 = W - z.cols * cw - 20,
      y0 = 64 * S + 40;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x0 - 10, y0 - 22, z.cols * cw + 20, z.rows * ch + 34);
    ctx.fillStyle = '#ccc';
    ctx.font = font(12);
    ctx.fillText('정비 구역 (세로 미로)', x0, y0 - 8);
    for (const c of z.cells) {
      const x = x0 + c.col * cw,
        y = y0 + c.row * ch;
      const here = out.cell[0] === c.col && out.cell[1] === c.row;
      ctx.fillStyle = here ? '#f0b860' : c.kind === 'attic' ? '#6a8a5a' : c.kind === 'down' ? '#5a6a8a' : c.kind === 'entry' ? '#8a7a5a' : c.kind === 'shaft' ? '#222' : '#4a4038';
      ctx.fillRect(x + 4, y + 4, cw - 8, ch - 8);
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (c.open.r) ctx.moveTo(x + cw - 4, y + ch / 2), ctx.lineTo(x + cw + 4, y + ch / 2);
      if (c.open.d) ctx.moveTo(x + cw / 2, y + ch - 4), ctx.lineTo(x + cw / 2, y + ch + 4);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      const tag = c.kind === 'attic' ? '다락' : c.kind === 'down' ? '↓층' : c.kind === 'entry' ? '↑층' : c.kind === 'shaft' ? '틈새' : '';
      if (tag) ctx.fillText(tag, x + 8, y + 17 * S);
    }
  }
  // 가까운 소품 안내
  const near = e.nearestProp();
  if (near) {
    ctx.font = font(18, true);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(`E: ${near.label ?? near.kind}`, Math.max(160, Math.min(W - 160, near.x - camX)), 230);
    ctx.textAlign = 'left';
  }
  // 말
  ctx.font = font(19);
  let y = 700;
  for (const s of e.says.slice().reverse()) {
    const lines = wrap(s.text, Math.floor(W / (19 * S * 1.05)));
    for (const ln of lines.reverse()) {
      const w = ctx.measureText(ln).width;
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(W / 2 - w / 2 - 12, y - 22 * S, w + 24, 30 * S);
      ctx.fillStyle = '#fff';
      ctx.fillText(ln, W / 2 - w / 2, y);
      y -= 32 * S;
    }
    y -= 6;
  }
  if (e.p.crouching) {
    ctx.fillStyle = '#ffd27a';
    ctx.fillText('앉음', W - 120, 64 * S + 30);
  }
  ctx.restore();
}
function wrap(s: string, n: number): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      if ((line + ' ' + w).trim().length > n) out.push(line.trim()), (line = w);
      else line += ' ' + w;
    }
    if (line.trim()) out.push(line.trim());
  }
  return out;
}

let last = performance.now(),
  acc = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= DT) {
    acc -= DT;
    if (eng && !panel) eng.step(readKeys());
  }
  if (eng) {
    const camX = eng.draw(ctx);
    hud(camX);
  } else {
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, canvas.width, 720);
  }
}
// 세로 폰: 화면 논리 폭을 좁혀 글씨·상자가 커 보이게
// 폰: 세로로 들고 있으면 판 전체를 90° 돌려 가로 화면으로 쓰고, 조작 버튼은 화면 위에 겹친다.
// 캔버스 논리 폭은 화면 비율에 맞춰 늘려(760~1600) 좌우 빈칸 없이 꽉 채운다.
const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
let rotated = false;
let hudScale = 1;
function fit() {
  const es = $('.es');
  es.classList.toggle('touch', touch);
  rotated = touch && innerHeight > innerWidth;
  es.classList.toggle('rot', rotated);
  if (rotated) {
    es.style.width = `${innerHeight}px`;
    es.style.height = `${innerWidth}px`;
  } else es.style.width = es.style.height = '';
  const v = $('.es-view');
  const vw = v.clientWidth,
    vh = Math.max(1, v.clientHeight);
  const w = Math.max(760, Math.min(1600, Math.round((720 * vw) / vh)));
  if (canvas.width !== w) canvas.width = w;
  canvas.style.aspectRatio = `${w} / 720`;
  // 화면에 실제로 보이는 배율이 작을수록 글씨를 키운다
  hudScale = Math.max(1, Math.min(1.9, (0.72 * 720) / Math.min(vh, (vw * 720) / w)));
  if (eng) eng.viewW = w;
}
addEventListener('resize', fit);
fit();
show('start');
requestAnimationFrame(frame);
Object.assign(window, { __es: { get eng() { return eng; }, stage, begin, readKeys } });
