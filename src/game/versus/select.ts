// 대전 고르기 창 (11-08 사용자): 대전게임처럼 얼굴 한 판에서 1P(내 것, 왼쪽) 먼저, 이어 상대(오른쪽)를 고른다.
// 11-08 사용자 「진짜 게임처럼」: 양옆에 크게 움직이는 전신, 기운 이름판, 깜빡이는 1P·2P 커서, 30초 시간, 고를 때 번쩍임·소리.
// 얼굴은 대전 공용 자료의 얼굴판(vs-common faces.webp)에서 잘라 그리므로 인물 팩 없이 바로 뜬다. 전신은 인물 팩(미리 받아 둔 것)을 풀어 전투 자세(3)로 움직인다.
// 인물 풀 = 이름 있는 인물만(NPC 빼기). 서바이벌 상대는 NPC 도 나온다 — 고르지 않고 웨이브가 낸다.
// 키: 방향키 움직이기, Enter·Z 고르기, Backspace·X 되돌리기, Tab 모드 바꾸기, Esc 닫기. 마우스: 올리면 커서, 누르면 고르기, 오른쪽 단추 되돌리기.
import { charArt, charFace, charRoster, drawCharFrame, loadChar, sheetBody, type RosterRow } from '../action/art/charPacks';
import { dotText, hudArt, hudImg, HUD_DIM, HUD_EDGE, HUD_INK } from '../action/ui/pixelHud';
import type { VsMode } from '../action/engine/versus';

const MODES: { id: VsMode; name: string; picks: [number, number] }[] = [
  { id: 'duel', name: '1:1', picks: [1, 1] },
  { id: 'team', name: '태그매치', picks: [3, 3] },
  { id: 'survival', name: '서바이벌', picks: [1, 0] },
];
const RANDOM = '__random';
const CELL = 50;   // HUD 기술 칸 틀 그대로 1:1
const TIME = 30;
/** 1P 파랑·2P 빨강: 커서·이름 앞 표시·인물 외곽 빛에만 쓴다 */
const P_COLOR = ['#5a9cff', '#ff5a5a'];

/** 소리: move 커서, ok 고르기, back 되돌리기, vs VS 도장, start 경기 시작 */
export type VsSfx = (id: 'move' | 'ok' | 'back' | 'vs' | 'start') => void;

// 11-08 사용자: 본문을 덮지 않는다(배경판·띠 없음). 글자는 전부 도트(HUD 와 같은 pixelHud 글자), 효과는 인물 외곽 빛만.
const CSS = `
.vs-sel{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:40;user-select:none}
.vs-sel *{box-sizing:border-box}
.vs-sel canvas{image-rendering:pixelated;display:block}
.vs-top{position:absolute;left:0;right:0;top:10px;display:flex;flex-direction:column;align-items:center;gap:8px;z-index:5}
.vs-modes{display:flex;gap:18px;pointer-events:auto}
.vs-mode{cursor:pointer;padding:2px 0}
.vs-mode.on{border-bottom:3px solid ${HUD_INK}}
.vs-time{position:absolute;top:10px;right:16px;z-index:6}
.vs-time.low{animation:vs-pulse .5s steps(2) infinite}
.vs-fig{position:absolute;bottom:calc(var(--gh) + 50px);z-index:2;pointer-events:none}
.vs-fig[data-s="0"]{left:3%}
.vs-fig[data-s="1"]{right:3%}
.vs-slot{position:absolute;bottom:0}
.vs-slot[data-k="0"]{left:50%;transform:translateX(-50%);z-index:3}
.vs-slot[data-k="1"]{left:0;bottom:5%;transform:scale(.8);transform-origin:bottom left;z-index:2}
.vs-slot[data-k="2"]{right:0;bottom:5%;transform:scale(.8);transform-origin:bottom right;z-index:1}
.vs-slot[data-k="1"] canvas,.vs-slot[data-k="2"] canvas{opacity:.85}
.vs-slot.in{animation:vs-pop .2s steps(4)}
@keyframes vs-pop{from{opacity:0;margin-bottom:-30px}}
.vs-fig[data-s="0"] canvas{filter:drop-shadow(0 0 3px ${P_COLOR[0]}) drop-shadow(0 0 8px ${P_COLOR[0]}aa)}
.vs-fig[data-s="1"] canvas{filter:drop-shadow(0 0 3px ${P_COLOR[1]}) drop-shadow(0 0 8px ${P_COLOR[1]}aa)}
.vs-fig.pick .vs-slot[data-k="0"] canvas{animation:vs-pick .3s steps(3)}
.vs-fig .unk{position:absolute;left:0;right:0;bottom:30%;display:flex;justify-content:center}
.vs-nm{position:absolute;z-index:4;bottom:calc(var(--gh) + 12px);display:flex;align-items:flex-end;gap:8px}
.vs-nm[data-s="0"]{left:3%}
.vs-nm[data-s="1"]{right:3%;flex-direction:row-reverse}
.vs-picks{display:flex;gap:3px;margin-bottom:2px}
.vs-nm[data-s="1"] .vs-picks{flex-direction:row-reverse}
.vs-gridw{position:absolute;z-index:3;left:50%;bottom:24px;transform:translateX(-50%);pointer-events:auto}
.vs-grid{display:grid;gap:2px}
.vs-cell{position:relative;width:${CELL}px;height:${CELL}px;cursor:pointer}
.vs-cell>canvas{position:absolute;left:0;top:0}
.vs-cell.rand{display:flex;align-items:center;justify-content:center}
.vs-cell.taken>canvas{filter:grayscale(1) brightness(.45)}
.vs-cur{position:absolute;left:-4px;top:-4px;animation:vs-pulse .4s steps(2) infinite;z-index:2}
.vs-cur canvas{position:absolute;left:0;top:0}
.vs-cur canvas+canvas{top:-14px;left:2px}
.vs-cur.c1 canvas+canvas{left:${CELL - 12}px}
.vs-say{position:absolute;z-index:4;left:0;right:0;bottom:calc(var(--gh) - 46px);display:flex;justify-content:center;animation:vs-pulse 1s steps(2) infinite}
.vs-help{position:absolute;z-index:4;left:0;right:0;bottom:4px;display:flex;justify-content:center}
@keyframes vs-blink{50%{border-color:${HUD_INK}}}
@keyframes vs-pulse{50%{opacity:.4}}
@keyframes vs-inL{from{transform:translateX(-80px);opacity:0}}
@keyframes vs-inR{from{transform:translateX(80px);opacity:0}}
@keyframes vs-pick{0%{filter:brightness(3)}}
.vs-vfig{position:absolute;bottom:56px}
.vs-vfig[data-s="0"]{left:8%;animation:vs-inL .3s steps(5) backwards}
.vs-vfig[data-s="1"]{right:8%;animation:vs-inR .3s steps(5) backwards}
.vs-vfig[data-s="0"] canvas{filter:drop-shadow(0 0 3px ${P_COLOR[0]}) drop-shadow(0 0 8px ${P_COLOR[0]}aa)}
.vs-vfig[data-s="1"] canvas{filter:drop-shadow(0 0 3px ${P_COLOR[1]}) drop-shadow(0 0 8px ${P_COLOR[1]}aa)}
.vs-vname{position:absolute;bottom:14px;display:flex;align-items:flex-end;gap:8px}
.vs-vname[data-s="0"]{left:8%}
.vs-vname[data-s="1"]{right:8%;flex-direction:row-reverse}
.vs-vteam{position:absolute;top:14px;display:flex;gap:4px}
.vs-vteam[data-s="0"]{left:8%}
.vs-vteam[data-s="1"]{right:8%;flex-direction:row-reverse}
.vs-big{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);z-index:5;animation:vs-stamp .25s .4s steps(4) backwards}
.vs-load{position:absolute;left:0;right:0;bottom:4px;display:flex;justify-content:center;animation:vs-pulse .8s steps(2) infinite}
@keyframes vs-stamp{from{transform:translate(-50%,-50%) scale(3);opacity:0}}
`;

/** 도트 글자 한 장 (DOM 에 넣을 새 canvas) */
function dot(s: string, color = HUD_INK, scale = 2): HTMLCanvasElement {
  const src = dotText(s, color, scale);
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}
const put = (el: Element, ...cs: HTMLCanvasElement[]) => { el.replaceChildren(...cs); };

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

/** 대형: 앞 가운데 = 첫째(지금 나갈 사람), 뒤 양옆 = 둘째·셋째 (태그매치). 1:1 은 앞 한 명만 */
function troupe(h: number, flip: boolean) {
  const figs = [0, 1, 2].map(() => figure(h, flip));
  const el = document.createElement('div');
  const w = figs[0].cv.width;
  el.style.cssText = `position:relative;width:${Math.round(w * 1.9)}px;height:${h}px`;
  // 2P 는 거울: 둘째가 오른쪽(바깥) 뒤
  const slots = figs.map((f, k) => { const d = document.createElement('div'); d.className = 'vs-slot'; d.dataset.k = String(flip && k ? 3 - k : k); d.appendChild(f.cv); el.appendChild(d); return d; });
  const names = ['', '', ''];
  return {
    el,
    draw: (now: number) => figs.forEach((f) => f.draw(now)),
    set(list: string[]) {
      for (let k = 0; k < 3; k++) {
        const n = list[k] ?? '';
        if (n === names[k]) continue;
        names[k] = n;
        figs[k].set(n);
        slots[k].querySelector('.unk')?.remove();
        if (n === RANDOM) { const u = document.createElement('div'); u.className = 'unk'; u.appendChild(dot('?', HUD_INK, 8)); slots[k].appendChild(u); }
        if (n) { slots[k].classList.remove('in'); void slots[k].offsetWidth; slots[k].classList.add('in'); }
      }
    },
  };
}

/** 얼굴 칸: HUD 기술 칸 틀(PixelLab 도트 틀, 50×50)에 얼굴판 얼굴을 1:1 로 (줄이지 않고 가운데를 자른다) */
const SLOT = hudArt.slot;
function drawCell(cv: HTMLCanvasElement, name: string) {
  const o = cv.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  o.clearRect(0, 0, cv.width, cv.height);
  const [x0, y0, x1, y1] = SLOT.inner, iw = x1 - x0, ih = y1 - y0;
  // 틀 먼저, 그 안쪽에 얼굴 (틀 안쪽이 칠해져 있다)
  const fr = hudImg('slot');
  if (fr) o.drawImage(fr, 0, 0);
  else { o.fillStyle = '#0f1216'; o.fillRect(x0, y0, iw, ih); }
  if (name === RANDOM) { const q = dotText('?', HUD_INK, 2); o.drawImage(q, Math.round(x0 + (iw - q.width) / 2), Math.round(y0 + (ih - q.height) / 2)); }
  else if (name) { const f = charFace(name, 64, false); if (f) o.drawImage(f, Math.round((64 - iw) / 2), 4, iw, ih, x0, y0, iw, ih); }
}
function cellCanvas(name: string, css = CELL): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = SLOT.w; cv.height = SLOT.h;
  cv.style.width = cv.style.height = `${css}px`;
  drawCell(cv, name);
  return cv;
}
/** 커서: 네 귀퉁이 도트 꺾쇠 (검은 1도트 테) */
function cursorCanvas(color: string): HTMLCanvasElement {
  const n = CELL + 8, L = 12, T = 3;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const o = cv.getContext('2d')!;
  const bar = (x: number, y: number, w: number, h: number) => { o.fillStyle = HUD_EDGE; o.fillRect(x - 1, y - 1, w + 2, h + 2); };
  const fill = (x: number, y: number, w: number, h: number) => { o.fillStyle = color; o.fillRect(x, y, w, h); };
  const corners: [number, number, number, number][] = [];
  for (const [cx, cy] of [[1, 1], [n - 1 - L, 1], [1, n - 1 - T], [n - 1 - L, n - 1 - T]]) corners.push([cx, cy, L, T]);
  for (const [cx, cy] of [[1, 1], [n - 1 - T, 1], [1, n - 1 - L], [n - 1 - T, n - 1 - L]]) corners.push([cx, cy, T, L]);
  corners.forEach((r) => bar(...r));
  corners.forEach((r) => fill(...r));
  return cv;
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

  // ── 판 짜기 (한 번만. 커서·이름은 아래 update 가 바꾼다). 배경판 없음: 본문이 그대로 보인다
  // 칸 줄 수: 본문 폭에 맞춰 (줄이 적을수록 인물이 크게 선다)
  const COLS = Math.max(8, Math.min(16, Math.floor((box.clientWidth - 140) / (CELL + 2))));
  const gridH = Math.ceil(names.length / COLS) * (CELL + 2) + 24 + 22 + 30;   // 판 + 아래 도움말 + 판 위 안내 한 줄
  el.style.setProperty('--gh', `${gridH}px`);
  // 전신은 이름 줄 위에 선다: 위 제목 줄(약 90px)과 판 사이 높이
  const figH = Math.max(180, Math.min(420, box.clientHeight - gridH - 50 - 90));
  el.innerHTML = `<div class="vs-top"><div class="vs-title"></div>
      <div class="vs-modes">${MODES.map((m) => `<div class="vs-mode" data-m="${m.id}"></div>`).join('')}</div></div>
    <div class="vs-time"></div>
    <div class="vs-fig" data-s="0"></div><div class="vs-fig" data-s="1"></div>
    <div class="vs-nm" data-s="0"><span class="p"></span><span class="n"></span><span class="vs-picks"></span></div>
    <div class="vs-nm" data-s="1"><span class="p"></span><span class="n"></span><span class="vs-picks"></span></div>
    <div class="vs-say"></div>
    <div class="vs-gridw"><div class="vs-grid">${names.map((n, i) => `<div class="vs-cell" data-i="${i}"></div>`).join('')}</div></div>
    <div class="vs-help"></div>`;
  const $ = <T extends HTMLElement>(q: string) => el.querySelector<T>(q)!;
  $('.vs-grid').style.gridTemplateColumns = `repeat(${COLS},${CELL}px)`;
  put($('.vs-title'), dot('인물 선택', HUD_INK, 3));
  put($('.vs-help'), dot('방향키 움직이기 · Enter 고르기 · Backspace 되돌리기 · Tab 모드 · Esc 닫기', HUD_DIM, 1));
  for (const s of [0, 1] as const) put($(`.vs-nm[data-s="${s}"] .p`), dot(s ? '2P' : '1P', P_COLOR[s], 2));
  const cells = [...el.querySelectorAll<HTMLElement>('.vs-cell')];
  const cellCv = cells.map((c, i) => { const cv = cellCanvas(names[i]); c.appendChild(cv); return cv; });
  let framed = false;
  const figs = ([0, 1] as const).map((s) => {
    const f = troupe(figH, s === 1);
    $(`.vs-fig[data-s="${s}"]`).appendChild(f.el);
    return f;
  });
  const curEl = ([0, 1] as const).map((s) => {
    const d = document.createElement('div');
    d.className = `vs-cur c${s}`;
    d.append(cursorCanvas(P_COLOR[s]), dot(s ? '2P' : '1P', P_COLOR[s], 1));
    return d;
  });
  const shown: [string, string] = ['', ''];
  let lastTurn = -1;
  let time = TIME, timeAt = performance.now();
  const drawTime = (left: number) => { const te = $('.vs-time'); put(te, dot(String(left).padStart(2, '0'), left <= 5 ? P_COLOR[1] : HUD_INK, 3)); te.classList.toggle('low', left <= 5); };
  drawTime(TIME);

  const update = () => {
    const t = turn();
    el.querySelectorAll<HTMLElement>('.vs-mode').forEach((m) => {
      const on = m.dataset.m === mode.id;
      m.classList.toggle('on', on);
      put(m, dot(MODES.find((x) => x.id === m.dataset.m)!.name, on ? HUD_INK : HUD_DIM, 2));
    });
    const taken = new Set([...picks[0], ...picks[1]]);
    cells.forEach((c, i) => c.classList.toggle('taken', taken.has(names[i])));
    // 커서: 지금 차례인 쪽만. 2P 차례면 1P 가 고른 칸은 회색
    curEl.forEach((d) => d.remove());
    if (!done()) cells[cur[t]].appendChild(curEl[t]);
    for (const s of [0, 1] as const) {
      const surv = s === 1 && mode.id === 'survival';
      const n = surv ? '' : t === s && !done() ? names[cur[s]] : picks[s][picks[s].length - 1] ?? (s === 1 ? names[cur[1]] : '');
      // 대형: 고른 사람들 + 지금 커서 인물(다음 빈자리)
      const list = surv ? [] : mode.picks[s] > 1 ? [...picks[s], ...(t === s && !done() ? [names[cur[s]]] : [])].slice(0, 3) : [n];
      const key = list.join('|');
      const fig = $(`.vs-fig[data-s="${s}"]`);
      if (key !== shown[s] || (surv && !fig.querySelector(':scope > .unk'))) {
        shown[s] = key;
        figs[s].set(list);
        fig.querySelector(':scope > .unk')?.remove();
        if (surv) { const u = document.createElement('div'); u.className = 'unk'; u.appendChild(dot('?', HUD_INK, 8)); fig.appendChild(u); }
      }
      put($(`.vs-nm[data-s="${s}"] .n`), dot(surv ? '웨이브 서바이벌' : n === RANDOM ? '무작위' : n, HUD_INK, 3));
      const pk = $(`.vs-nm[data-s="${s}"] .vs-picks`);
      pk.replaceChildren();
      if (mode.picks[s] > 1) for (let i = 0; i < mode.picks[s]; i++) {
        const p = picks[s][i];
        const c = cellCanvas(p ?? '', 50);
        pk.appendChild(c);
      }
    }
    const who = t === 0 ? '1P' : '2P';
    if (done()) $('.vs-say').replaceChildren();
    else put($('.vs-say'), dot(`${who} 인물을 고르세요${mode.picks[t] > 1 ? ` (${picks[t].length + 1}/${mode.picks[t]})` : ''}`, HUD_INK, 2));
    if (t !== lastTurn) { lastTurn = t; time = TIME; timeAt = performance.now(); drawTime(TIME); }
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
    // 틀 그림이 늦게 읽히면 한 번 다시
    if (!framed && hudImg('slot')) { framed = true; cellCv.forEach((cv, i) => drawCell(cv, names[i])); }
    if (!done()) {
      const left = Math.max(0, TIME - Math.floor((now - timeAt) / 1000));
      if (left !== time) {
        time = left;
        drawTime(left);
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
  // 배경판 없음 (11-08 사용자): 본문 위에 인물(외곽 빛)·이름·얼굴 칸·VS 도트 글자만
  const figH = Math.max(200, Math.min(420, box.clientHeight - 140));
  const figs: ReturnType<typeof troupe>[] = [];
  for (const s of [0, 1] as const) {
    const list = s ? r.foe : r.me;
    const surv = s === 1 && r.mode === 'survival';
    const fw = document.createElement('div');
    fw.className = 'vs-vfig';
    fw.dataset.s = String(s);
    if (surv) { fw.style.height = `${figH}px`; fw.style.display = 'flex'; fw.style.alignItems = 'center'; fw.appendChild(dot('?', HUD_INK, 10)); }
    else { const f = troupe(figH, s === 1); f.set(list); figs.push(f); fw.appendChild(f.el); }
    const nm = document.createElement('div');
    nm.className = 'vs-vname';
    nm.dataset.s = String(s);
    nm.append(dot(s ? '2P' : '1P', P_COLOR[s], 2), dot(surv ? '웨이브 서바이벌' : list[0], HUD_INK, 3));   // 팀은 첫 사람 이름만, 셋은 위 얼굴 칸으로
    el.append(fw, nm);
    if (list.length > 1) {
      const tm = document.createElement('div');
      tm.className = 'vs-vteam';
      tm.dataset.s = String(s);
      list.forEach((n) => tm.appendChild(cellCanvas(n, 50)));
      el.appendChild(tm);
    }
  }
  const big = document.createElement('div'); big.className = 'vs-big'; big.appendChild(dot('VS', HUD_INK, 8));
  const ld = document.createElement('div'); ld.className = 'vs-load'; ld.appendChild(dot('불러오는 중', HUD_DIM, 1));
  el.append(big, ld);
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
