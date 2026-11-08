// 대전 고르기 창 (11-08 사용자): 대전게임처럼 얼굴 한 판에서 1P(내 것, 왼쪽) 먼저, 이어 상대(오른쪽)를 고른다.
// 11-08 사용자 「진짜 게임처럼」: 양옆에 크게 움직이는 전신, 기운 이름판, 깜빡이는 1P·2P 커서, 30초 시간, 고를 때 번쩍임·소리.
// 얼굴은 대전 공용 자료의 얼굴판(vs-common faces.webp)에서 잘라 그리므로 인물 팩 없이 바로 뜬다. 전신은 인물 팩(미리 받아 둔 것)을 풀어 전투 자세(3)로 움직인다.
// 인물 풀 = 이름 있는 인물만(NPC 빼기). 서바이벌 상대는 NPC 도 나온다 — 고르지 않고 웨이브가 낸다.
// 키: 방향키 움직이기, Enter·Z 고르기, Backspace·X 되돌리기, Tab 모드 바꾸기, Esc 닫기. 마우스: 올리면 커서, 누르면 고르기, 오른쪽 단추 되돌리기.
import { charArt, charFace, charRoster, drawCharFrame, loadChar, sheetBody, type RosterRow } from '../action/art/charPacks';
import { PIXEL_FONT } from '../action/ui/kit';
import type { VsMode } from '../action/engine/versus';

const MODES: { id: VsMode; name: string; picks: [number, number] }[] = [
  { id: 'duel', name: '1 : 1', picks: [1, 1] },
  { id: 'team', name: '3인 팀전', picks: [3, 3] },
  { id: 'survival', name: '서바이벌', picks: [1, 0] },
];
const RANDOM = '__random';
const COLS = 11;
const CELL = 46;
const TIME = 30;
const P_COLOR = ['#2f8bff', '#ff3b3b'];

/** 소리: move 커서, ok 고르기, back 되돌리기, vs VS 도장, start 경기 시작 */
export type VsSfx = (id: 'move' | 'ok' | 'back' | 'vs' | 'start') => void;

// 글자 테두리: 8방향 검은 그림자 (도트 글꼴이 본문 위에서도 읽히게)
const OUT = (w: number, c = '#000') =>
  [[-w, 0], [w, 0], [0, -w], [0, w], [-w, -w], [w, -w], [-w, w], [w, w]].map(([x, y]) => `${x}px ${y}px 0 ${c}`).join(',');

const CSS = `
.vs-sel{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:40;font-family:'${PIXEL_FONT}','Galmuri11',monospace;-webkit-font-smoothing:none;color:#fff;text-shadow:${OUT(2)};user-select:none}
.vs-sel *{box-sizing:border-box}
.vs-bg{position:absolute;inset:0;pointer-events:auto;background:
  repeating-linear-gradient(115deg,rgba(255,255,255,.035) 0 2px,transparent 2px 14px),
  radial-gradient(ellipse 45% 70% at 0% 55%,rgba(47,139,255,.45),transparent 70%),
  radial-gradient(ellipse 45% 70% at 100% 55%,rgba(255,59,59,.45),transparent 70%),
  linear-gradient(180deg,#05060c 0%,#0d1020 55%,#05060c 100%)}
.vs-bg:after{content:'';position:absolute;left:0;right:0;bottom:0;height:38%;background:linear-gradient(180deg,transparent,rgba(0,0,0,.7))}
.vs-top{position:absolute;left:0;right:0;top:10px;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:5}
.vs-title{position:relative;padding:3px 34px;background:linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent);font-size:26px;letter-spacing:4px;color:#ffe066;text-shadow:${OUT(2)},0 4px 0 #b5470c}
.vs-title small{display:block;text-align:center;font-size:11px;letter-spacing:6px;color:#9aa4bf;text-shadow:${OUT(1)}}
.vs-time{position:absolute;top:8px;right:16px;z-index:6;text-align:center;font-size:12px;color:#c9cfdf}
.vs-time b{display:block;font-size:40px;line-height:1;color:#fff;text-shadow:${OUT(3)},0 4px 0 #8a1010}
.vs-time.low b{color:#ff5050;animation:vs-pulse .5s steps(2) infinite}
.vs-modes{display:flex;gap:4px;pointer-events:auto}
.vs-mode{transform:skewX(-14deg);padding:3px 16px;background:#141826;border:2px solid #000;box-shadow:inset 0 0 0 2px #2b3150;color:#7f88a6;font-size:15px;cursor:pointer}
.vs-mode>span{display:inline-block;transform:skewX(14deg)}
.vs-mode.on{background:linear-gradient(180deg,#ffe066,#e08a12);box-shadow:inset 0 0 0 2px #fff3b0;color:#fff}
.vs-fig{position:absolute;bottom:calc(var(--gh) + 44px);z-index:2;pointer-events:none}
.vs-fig[data-s="0"]{left:3%}
.vs-fig[data-s="1"]{right:3%}
.vs-fig canvas{display:block;image-rendering:pixelated}
.vs-fig.in[data-s="0"]{animation:vs-inL .22s ease-out}
.vs-fig.in[data-s="1"]{animation:vs-inR .22s ease-out}
.vs-fig .flash{position:absolute;inset:0;background:#fff;opacity:0;mix-blend-mode:screen}
.vs-fig.pick .flash{animation:vs-flash .35s ease-out}
.vs-fig .unk{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:120px;color:#2a0a0a;text-shadow:${OUT(3, '#ff3b3b')}}
.vs-plate{position:absolute;z-index:4;bottom:calc(var(--gh) + 22px);min-width:200px;height:40px;transform:skewX(-16deg);border:2px solid #000;display:flex;align-items:center;padding:0 14px}
.vs-plate[data-s="0"]{left:-8px;background:linear-gradient(90deg,#0b2e66,${P_COLOR[0]});box-shadow:inset 0 -6px 0 rgba(0,0,0,.25),0 0 0 2px #9fd0ff inset}
.vs-plate[data-s="1"]{right:-8px;justify-content:flex-end;background:linear-gradient(270deg,#661010,${P_COLOR[1]});box-shadow:inset 0 -6px 0 rgba(0,0,0,.25),0 0 0 2px #ffb0b0 inset}
.vs-plate>div{transform:skewX(16deg);display:flex;align-items:center;gap:10px}
.vs-plate .p{font-size:14px;padding:0 4px;background:#000;color:#ffe066;text-shadow:none}
.vs-plate .n{font-size:22px;letter-spacing:1px;white-space:nowrap}
.vs-plate .k{display:flex;gap:3px}
.vs-picks{display:flex;gap:3px}
.vs-picks[data-s="1"]{flex-direction:row-reverse}
.vs-picks i{display:block;width:28px;height:28px;border:2px solid #000;box-shadow:0 0 0 1px #fff;background:#111}
.vs-picks i canvas{width:24px;height:24px;display:block;image-rendering:pixelated}
.vs-picks i.e{box-shadow:0 0 0 2px #555;background:rgba(0,0,0,.5)}
.vs-gridw{position:absolute;z-index:3;left:50%;bottom:28px;transform:translateX(-50%);padding:6px;background:rgba(0,0,0,.72);border:2px solid #000;box-shadow:0 0 0 2px #3a4160,0 6px 0 rgba(0,0,0,.5);pointer-events:auto}
.vs-grid{display:grid;grid-template-columns:repeat(${COLS},${CELL}px);gap:2px}
.vs-cell{position:relative;width:${CELL}px;height:${CELL}px;background:linear-gradient(180deg,#2a3048,#151826);cursor:pointer}
.vs-cell canvas{position:absolute;left:1px;top:1px;width:${CELL - 2}px;height:${CELL - 2}px;image-rendering:pixelated}
.vs-cell.rand{display:flex;align-items:center;justify-content:center;font-size:26px;color:#ffe066}
.vs-cell.taken canvas{filter:grayscale(1) brightness(.45)}
.vs-cur{position:absolute;inset:-3px;border:3px solid var(--c);box-shadow:0 0 0 1px #000,inset 0 0 0 1px #000;animation:vs-blink .4s steps(2) infinite;z-index:2}
.vs-cur b{position:absolute;top:-13px;left:-3px;padding:0 3px;font-size:11px;line-height:13px;background:var(--c);color:#fff;text-shadow:${OUT(1)}}
.vs-cur.c1 b{left:auto;right:-3px}
.vs-cur.both{inset:-6px}
.vs-say{position:absolute;z-index:4;left:0;right:0;bottom:calc(var(--gh) + 36px);text-align:center;font-size:17px;color:#fff;animation:vs-pulse 1s steps(2) infinite}
.vs-help{position:absolute;z-index:4;left:0;right:0;bottom:6px;text-align:center;font-size:11px;color:#9aa4bf;text-shadow:${OUT(1)}}
.vs-help b{color:#ffe066;font-weight:normal}
@keyframes vs-blink{50%{border-color:#fff}}
@keyframes vs-pulse{50%{opacity:.55}}
@keyframes vs-inL{from{transform:translateX(-90px);opacity:0}}
@keyframes vs-inR{from{transform:translateX(90px);opacity:0}}
@keyframes vs-flash{0%{opacity:.9}100%{opacity:0}}
.vs-vs{position:absolute;inset:0;pointer-events:auto;overflow:hidden;background:#000}
.vs-half{position:absolute;top:0;bottom:0;width:62%;overflow:hidden}
.vs-half[data-s="0"]{left:-6%;background:linear-gradient(90deg,#03122e,#0d48a8 70%,#2f8bff);clip-path:polygon(0 0,100% 0,82% 100%,0 100%);animation:vs-halfL .35s cubic-bezier(.2,.9,.3,1)}
.vs-half[data-s="1"]{right:-6%;background:linear-gradient(270deg,#2e0303,#a80d0d 70%,#ff3b3b);clip-path:polygon(18% 0,100% 0,100% 100%,0 100%);animation:vs-halfR .35s cubic-bezier(.2,.9,.3,1)}
.vs-half:before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.06) 0 3px,transparent 3px 18px)}
.vs-vfig{position:absolute;bottom:0}
.vs-half[data-s="0"] .vs-vfig{left:8%;animation:vs-inL .5s .15s ease-out backwards}
.vs-half[data-s="1"] .vs-vfig{right:8%;animation:vs-inR .5s .15s ease-out backwards}
.vs-vname{position:absolute;bottom:18px;font-size:30px;letter-spacing:2px;text-shadow:${OUT(3)},0 4px 0 rgba(0,0,0,.6)}
.vs-half[data-s="0"] .vs-vname{left:16%}
.vs-half[data-s="1"] .vs-vname{right:16%;text-align:right}
.vs-vname small{display:block;font-size:14px;color:#ffe066}
.vs-vteam{position:absolute;top:18px;display:flex;gap:6px}
.vs-half[data-s="0"] .vs-vteam{left:16%}
.vs-half[data-s="1"] .vs-vteam{right:16%;flex-direction:row-reverse}
.vs-vteam canvas{width:56px;height:56px;border:2px solid #000;box-shadow:0 0 0 2px #fff;image-rendering:pixelated;background:#111}
.vs-big{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);z-index:5;font-size:120px;line-height:1;color:#ffe066;letter-spacing:-6px;text-shadow:${OUT(5)},0 10px 0 #b5470c,0 10px 0 #000;animation:vs-stamp .35s .45s cubic-bezier(.3,1.6,.5,1) backwards}
.vs-flashall{position:absolute;inset:0;z-index:6;background:#fff;opacity:0;pointer-events:none;animation:vs-flash .4s .45s ease-out backwards}
.vs-load{position:absolute;left:0;right:0;bottom:10px;z-index:6;text-align:center;font-size:13px;color:#fff;animation:vs-pulse .8s steps(2) infinite}
@keyframes vs-halfL{from{transform:translateX(-100%)}}
@keyframes vs-halfR{from{transform:translateX(100%)}}
@keyframes vs-stamp{from{transform:translate(-50%,-50%) scale(4) rotate(-12deg);opacity:0}}
`;

export interface SelectResult { mode: VsMode; me: string[]; foe: string[] }
export interface SelectOpts {
  mode?: VsMode;
  /** 직전 경기: 커서를 그 인물들에 둔다 (Enter 두 번이면 같은 경기) */
  last?: SelectResult | null;
  onPick(r: SelectResult): void;
  onClose(): void;
  sfx?: VsSfx;
}

const pool = (): RosterRow[] => charRoster().filter((r) => !r.npc);
const STANCE = ['3', '1'];

function face(name: string, side: number, flip = false): HTMLCanvasElement {
  const f = charFace(name, 64, flip);
  const c = document.createElement('canvas');
  c.width = c.height = side;
  const o = c.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  if (f) o.drawImage(f, 0, 0, side, side);
  return c;
}

/** 크게 움직이는 전신. 인물 팩이 풀릴 때까지는 전신판 첫 장 */
function figure(h: number, flip: boolean) {
  const k = h / 256;
  const cv = document.createElement('canvas');
  cv.width = Math.round(150 * k); cv.height = h;
  const o = cv.getContext('2d')!;
  let name = '';
  const draw = (now: number) => {
    o.clearRect(0, 0, cv.width, cv.height);
    if (!name || name === RANDOM) return;
    const a = charArt(name);
    const id = STANCE.find((i) => a?.A[i] && a.IMG[i]);
    if (a && id) {
      // 전투 자세는 모든 장을 8fps, 평상 대기는 앞 두 장만 (테스트룸 규칙)
      const f = id === '3' ? Math.floor(now / 125) : Math.floor(now / 600) % 2;
      drawCharFrame(o, name, id, f, cv.width / 2, cv.height - 4 * k, flip ? -1 : 1, k);
      return;
    }
    const b = sheetBody(name);
    if (!b) return;
    o.save();
    o.imageSmoothingEnabled = false;
    if (flip) { o.translate(cv.width, 0); o.scale(-1, 1); }
    o.drawImage(b.img, b.x, b.y, b.w, b.h, Math.round(cv.width / 2 - (b.w * k) / 2), Math.round(cv.height - 4 * k - b.h * k), Math.round(b.w * k), Math.round(b.h * k));
    o.restore();
  };
  return {
    cv,
    draw,
    set(n: string) { name = n; if (n && n !== RANDOM && !charArt(n)) void loadChar(n); },
  };
}

export function openSelect(box: HTMLElement, opts: SelectOpts): { close(): void; el: HTMLElement } {
  const sfx: VsSfx = opts.sfx ?? (() => {});
  const st = document.createElement('style');
  st.textContent = CSS;
  const el = document.createElement('div');
  el.className = 'vs-sel';
  el.tabIndex = -1;
  box.append(st, el);
  const rows = pool();
  const names = [...rows.map((r) => r.name), RANDOM];
  let mode = MODES.find((m) => m.id === (opts.last?.mode ?? opts.mode)) ?? MODES[0];
  const picks: [string[], string[]] = [[], []];
  const idx = (n: string | undefined) => Math.max(0, names.indexOf(n ?? ''));
  const cur: [number, number] = [idx(opts.last?.me[0]), idx(opts.last?.foe[0] ?? opts.last?.me[0])];
  const turn = (): 0 | 1 => (picks[0].length < mode.picks[0] ? 0 : 1);
  const done = () => picks[0].length >= mode.picks[0] && picks[1].length >= mode.picks[1];
  const resolve = (n: string, taken: string[]) => {
    if (n !== RANDOM) return n;
    const free = rows.filter((r) => !taken.includes(r.name));
    const list = free.length ? free : rows;
    return list[Math.floor(Math.random() * list.length)].name;
  };

  // ── 판 짜기 (한 번만. 커서·이름은 아래 update 가 바꾼다)
  const gridH = Math.ceil(names.length / COLS) * (CELL + 2) + 12 + 28;
  el.style.setProperty('--gh', `${gridH}px`);
  // 전신은 이름판 위에 선다: 위 제목 줄(약 100px)과 판 사이 높이
  const figH = Math.max(180, Math.min(420, box.clientHeight - gridH - 44 - 96));
  el.innerHTML = `<div class="vs-bg"></div>
    <div class="vs-top"><div class="vs-title">인물 선택<small>SELECT YOUR FIGHTER</small></div>
      <div class="vs-modes">${MODES.map((m) => `<div class="vs-mode" data-m="${m.id}"><span>${m.name}</span></div>`).join('')}</div></div>
    <div class="vs-time"><b>${TIME}</b>TIME</div>
    <div class="vs-fig" data-s="0"><i class="flash"></i></div><div class="vs-fig" data-s="1"><i class="flash"></i></div>
    <div class="vs-plate" data-s="0"><div><span class="p">1P</span><span class="n"></span><span class="vs-picks" data-s="0"></span></div></div>
    <div class="vs-plate" data-s="1"><div><span class="vs-picks" data-s="1"></span><span class="n"></span><span class="p">2P</span></div></div>
    <div class="vs-say"></div>
    <div class="vs-gridw"><div class="vs-grid">${names.map((n, i) => `<div class="vs-cell${n === RANDOM ? ' rand' : ''}" data-i="${i}">${n === RANDOM ? '?' : ''}</div>`).join('')}</div></div>
    <div class="vs-help"><b>방향키</b> 움직이기 · <b>Enter</b> 고르기 · <b>Backspace</b> 되돌리기 · <b>Tab</b> 모드 · <b>Esc</b> 닫기</div>`;
  const $ = <T extends HTMLElement>(q: string) => el.querySelector<T>(q)!;
  const cells = [...el.querySelectorAll<HTMLElement>('.vs-cell')];
  cells.forEach((c, i) => { if (names[i] !== RANDOM) c.appendChild(face(names[i], CELL - 2)); });
  const figs = ([0, 1] as const).map((s) => {
    const f = figure(figH, s === 1);
    $(`.vs-fig[data-s="${s}"]`).prepend(f.cv);
    return f;
  });
  const curEl = ([0, 1] as const).map((s) => {
    const d = document.createElement('div');
    d.className = `vs-cur c${s}`;
    d.style.setProperty('--c', P_COLOR[s]);
    d.innerHTML = `<b>${s ? '2P' : '1P'}</b>`;
    return d;
  });
  const shown: [string, string] = ['', ''];
  let lastTurn = -1;
  let time = TIME, timeAt = performance.now();

  const update = () => {
    const t = turn();
    el.querySelectorAll<HTMLElement>('.vs-mode').forEach((m) => m.classList.toggle('on', m.dataset.m === mode.id));
    const taken = new Set([...picks[0], ...picks[1]]);
    cells.forEach((c, i) => c.classList.toggle('taken', taken.has(names[i])));
    // 커서: 지금 차례인 쪽만. 2P 차례면 1P 가 고른 칸은 회색
    curEl.forEach((d) => d.remove());
    if (!done()) cells[cur[t]].appendChild(curEl[t]);
    for (const s of [0, 1] as const) {
      const surv = s === 1 && mode.id === 'survival';
      const n = surv ? '' : t === s && !done() ? names[cur[s]] : picks[s][picks[s].length - 1] ?? (s === 1 ? names[cur[1]] : '');
      const fig = $(`.vs-fig[data-s="${s}"]`);
      if (n !== shown[s] || (surv && !fig.querySelector('.unk'))) {
        shown[s] = n;
        figs[s].set(n);
        fig.querySelector('.unk')?.remove();
        if (n === RANDOM || surv) fig.insertAdjacentHTML('beforeend', `<div class="unk">?</div>`);
        fig.classList.remove('in'); void fig.offsetWidth; fig.classList.add('in');
      }
      $(`.vs-plate[data-s="${s}"] .n`).textContent = surv ? '웨이브 서바이벌' : n === RANDOM ? '무작위' : n;
      const pk = $(`.vs-picks[data-s="${s}"]`);
      pk.innerHTML = '';
      for (let i = 0; i < mode.picks[s]; i++) {
        const box = document.createElement('i');
        if (mode.picks[s] < 2) break;   // 한 명 고르기면 칸 없이 이름만
        const p = picks[s][i];
        if (p) box.appendChild(face(p, 30, s === 1)); else box.className = 'e';
        pk.appendChild(box);
      }
    }
    const who = t === 0 ? '1P' : '2P';
    $('.vs-say').textContent = done() ? '' : `${who} 인물을 고르세요${mode.picks[t] > 1 ? ` (${picks[t].length + 1}/${mode.picks[t]})` : ''}`;
    $<HTMLElement>('.vs-say').style.color = P_COLOR[t] === P_COLOR[0] ? '#bfe0ff' : '#ffc4c4';
    if (t !== lastTurn) { lastTurn = t; time = TIME; timeAt = performance.now(); }
  };

  const flash = (s: 0 | 1) => { const f = $(`.vs-fig[data-s="${s}"]`); f.classList.remove('pick'); void f.offsetWidth; f.classList.add('pick'); };
  const pick = () => {
    if (done()) return;
    const t = turn();
    const n = resolve(names[cur[t]], [...picks[0], ...picks[1]]);
    if (mode.id === 'team' && picks[t].includes(n)) { sfx('back'); return; }   // 팀 안에서 같은 인물 두 번 X
    picks[t].push(n);
    sfx('ok');
    flash(t);
    if (t === 0 && picks[0].length === mode.picks[0] && mode.picks[1] && !opts.last) cur[1] = cur[0];
    update();
    if (done()) setTimeout(finish, 450);   // 번쩍임을 보고 넘어간다
  };
  const undo = () => {
    if (done()) return;
    const t = picks[1].length ? 1 : 0;
    if (!picks[t].length) return;
    picks[t].pop();
    sfx('back');
    update();
  };
  const setMode = (m: (typeof MODES)[number]) => { if (m === mode) return; mode = m; picks[0] = []; picks[1] = []; lastTurn = -1; sfx('move'); update(); };
  const move = (dx: number, dy: number) => {
    if (done()) return;
    const t = turn();
    let i = cur[t];
    if (dx) i = (i + dx + names.length) % names.length;
    if (dy) { i += dy * COLS; if (i < 0) i += Math.ceil(names.length / COLS) * COLS; if (i >= names.length) i = dy > 0 ? i % COLS : names.length - 1; i = Math.min(Math.max(0, i), names.length - 1); }
    if (i === cur[t]) return;
    cur[t] = i;
    sfx('move');
    update();
  };

  let closed = false;
  const onKey = (e: KeyboardEvent) => {
    if (closed) return;
    const k = e.key;
    const map: Record<string, () => void> = {
      ArrowLeft: () => move(-1, 0), ArrowRight: () => move(1, 0), ArrowUp: () => move(0, -1), ArrowDown: () => move(0, 1),
      Enter: pick, z: pick, Z: pick, ' ': pick, Backspace: undo, x: undo, X: undo,
      Tab: () => setMode(MODES[(MODES.indexOf(mode) + (e.shiftKey ? MODES.length - 1 : 1)) % MODES.length]),
      Escape: () => { sfx('back'); close(); opts.onClose(); },
    };
    if (!map[k]) return;
    e.preventDefault(); e.stopPropagation();
    map[k]();
  };
  el.addEventListener('pointerover', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.vs-cell');
    if (!c || done()) return;
    const i = +c.dataset.i!;
    if (cur[turn()] !== i) { cur[turn()] = i; sfx('move'); update(); }
  });
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const m = t.closest<HTMLElement>('.vs-mode');
    if (m) { setMode(MODES.find((x) => x.id === m.dataset.m)!); return; }
    const c = t.closest<HTMLElement>('.vs-cell');
    if (c && !done()) { cur[turn()] = +c.dataset.i!; pick(); }
  });
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); undo(); });
  window.addEventListener('keydown', onKey, true);

  // 그리기·시간: 시간이 다 되면 커서 칸을 고른다 (대전게임 관례)
  let raf = 0;
  const tick = (now: number) => {
    if (closed) return;
    figs.forEach((f) => f.draw(now));
    if (!done()) {
      const left = Math.max(0, TIME - Math.floor((now - timeAt) / 1000));
      if (left !== time) {
        time = left;
        const te = $('.vs-time');
        te.querySelector('b')!.textContent = String(left);
        te.classList.toggle('low', left <= 5);
        if (left === 0) pick();
      }
    }
    raf = requestAnimationFrame(tick);
  };

  const finish = () => { if (closed) return; const r = { mode: mode.id, me: picks[0].slice(), foe: picks[1].slice() }; close(); opts.onPick(r); };
  const close = () => {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey, true);
    el.remove(); st.remove();
  };
  update();
  raf = requestAnimationFrame(tick);
  return { close, el };
}

/** VS 화면: 양쪽 반이 밀려 들어오고 VS 도장. 고른 인물을 받는 동안 띄운다. load 가 끝나면 닫힌다 */
export async function showVs(box: HTMLElement, r: SelectResult, load: () => Promise<unknown>, sfx: VsSfx = () => {}): Promise<void> {
  const st = document.createElement('style');
  st.textContent = CSS;
  const el = document.createElement('div');
  el.className = 'vs-sel';
  const wrap = document.createElement('div');
  wrap.className = 'vs-vs';
  el.appendChild(wrap);
  const figH = Math.max(200, Math.min(460, Math.round(box.clientHeight * 0.85)));
  const figs: ReturnType<typeof figure>[] = [];
  const half = (s: 0 | 1, list: string[]) => {
    const d = document.createElement('div');
    d.className = 'vs-half';
    d.dataset.s = String(s);
    const surv = s === 1 && r.mode === 'survival';
    const fw = document.createElement('div');
    fw.className = 'vs-vfig';
    if (surv) fw.innerHTML = `<div style="font-size:180px;line-height:${figH}px;color:#2a0a0a;text-shadow:${OUT(4, '#ff3b3b')}">?</div>`;
    else { const f = figure(figH, s === 1); f.set(list[0]); figs.push(f); fw.appendChild(f.cv); }
    d.appendChild(fw);
    if (list.length > 1) {
      const tm = document.createElement('div');
      tm.className = 'vs-vteam';
      list.forEach((n) => tm.appendChild(face(n, 56, s === 1)));
      d.appendChild(tm);
    }
    const nm = document.createElement('div');
    nm.className = 'vs-vname';
    nm.innerHTML = `<small>${s ? '2P' : '1P'}</small>`;
    nm.append(surv ? '웨이브 서바이벌' : list[0]);   // 팀은 첫 사람 이름만 크게, 셋은 위 얼굴 칸으로
    d.appendChild(nm);
    return d;
  };
  wrap.append(half(0, r.me), half(1, r.foe));
  wrap.insertAdjacentHTML('beforeend', '<div class="vs-big">VS</div><div class="vs-flashall"></div><div class="vs-load">불러오는 중…</div>');
  box.append(st, el);
  let raf = 0;
  const tick = (now: number) => { figs.forEach((f) => f.draw(now)); raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  const t0 = performance.now();
  const stamp = setTimeout(() => sfx('vs'), 450);
  try { await load(); } finally {
    const wait = 2000 - (performance.now() - t0);   // 너무 빨리 지나가면 VS 가 안 보인다
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    clearTimeout(stamp);
    sfx('start');
    cancelAnimationFrame(raf);
    el.remove(); st.remove();
  }
}
