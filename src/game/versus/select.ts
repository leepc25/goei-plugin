// 대전 고르기 창 (11-08 사용자): 대전게임처럼 얼굴 한 판에서 1P(내 것, 왼쪽) 먼저, 이어 상대(오른쪽)를 고른다.
// 얼굴은 대전 공용 자료의 얼굴판(vs-common faces.webp)에서 잘라 그리므로 인물 팩을 하나도 받지 않는다. 고른 인물만 VS 화면에서 받는다.
// 인물 풀 = 이름 있는 인물만(NPC 빼기). 서바이벌 상대는 NPC 도 나온다(11-08 사용자) — 고르지 않고 이어서 뽑는다.
// 키: 방향키 움직이기, Enter·Z 고르기, Backspace·X 되돌리기, Tab 모드 바꾸기, Esc 닫기. 마우스: 올리면 커서, 누르면 고르기.
import { charFace, charRoster, sheetBody, type RosterRow } from '../action/art/charPacks';
import { PIXEL_FONT } from '../action/ui/kit';
import type { VsMode } from '../action/engine/versus';

const MODES: { id: VsMode; name: string; picks: [number, number] }[] = [
  { id: 'duel', name: '1:1', picks: [1, 1] },
  { id: 'team', name: '3인 팀전', picks: [3, 3] },
  { id: 'survival', name: '서바이벌', picks: [1, 0] },
];
const RANDOM = '__random';
const COLS = 11;
const P_COLOR = ['#3c8cff', '#ff4646'];

const CSS = `
.vs-sel{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:40;font-family:'${PIXEL_FONT}','Galmuri11',monospace;-webkit-font-smoothing:none;color:#e8e2d0;text-shadow:2px 2px 0 #000;user-select:none}
.vs-sel *{box-sizing:border-box}
.vs-panel{pointer-events:auto;position:relative;padding:10px 12px 12px;background:rgba(12,14,18,.98);border:2px solid #4a4438;box-shadow:0 0 0 2px #000;display:grid;grid-template-columns:150px auto 150px;gap:10px;align-items:end}
.vs-modes{grid-column:1/4;display:flex;gap:6px;justify-content:center;font-size:16px}
.vs-mode{padding:2px 10px;border:2px solid #3a352c;color:#8a826e;cursor:pointer}
.vs-mode.on{border-color:#c8b47a;color:#fff2c8}
.vs-grid{display:grid;grid-template-columns:repeat(${COLS},44px);gap:3px}
.vs-cell{position:relative;width:44px;height:44px;background:#1c1f26;border:2px solid #2a2e36;cursor:pointer;image-rendering:pixelated}
.vs-cell canvas{width:40px;height:40px;image-rendering:pixelated;display:block}
.vs-cell.rand{display:flex;align-items:center;justify-content:center;font-size:22px;color:#c8b47a}
.vs-cell.c0{border-color:${P_COLOR[0]}}
.vs-cell.c1{border-color:${P_COLOR[1]}}
.vs-cell.c0.c1{border-color:#c060ff}
.vs-cell .tag{position:absolute;top:-2px;left:1px;font-size:11px;line-height:1}
.vs-cell.taken0{box-shadow:inset 0 0 0 2px ${P_COLOR[0]}88}
.vs-cell.taken1{box-shadow:inset 0 0 0 2px ${P_COLOR[1]}88}
.vs-side{display:flex;flex-direction:column;align-items:center;gap:4px;min-height:260px;justify-content:flex-end}
.vs-side canvas{image-rendering:pixelated}
.vs-name{font-size:18px}
.vs-picks{display:flex;gap:3px;min-height:30px}
.vs-picks canvas{width:28px;height:28px;border:2px solid #333;image-rendering:pixelated}
.vs-who{font-size:16px}
.vs-help{grid-column:1/4;text-align:center;font-size:12px;color:#8a826e}
.vs-vs{pointer-events:auto;position:relative;padding:16px 24px;background:rgba(12,14,18,.98);border:2px solid #4a4438;display:flex;align-items:center;gap:24px;font-size:20px}
.vs-vs .big{font-size:44px;color:#ffd24a}
.vs-vs .team{display:flex;flex-direction:column;align-items:center;gap:4px}
.vs-vs .team canvas{width:96px;height:96px;image-rendering:pixelated}
.vs-vs .load{position:absolute;left:0;right:0;bottom:-22px;text-align:center;font-size:13px;color:#b8ae96}
`;

export interface SelectResult { mode: VsMode; me: string[]; foe: string[] }
export interface SelectOpts {
  mode?: VsMode;
  /** 직전 경기: 커서를 그 인물들에 둔다 (Enter 두 번이면 같은 경기) */
  last?: SelectResult | null;
  onPick(r: SelectResult): void;
  onClose(): void;
}

const pool = (): RosterRow[] => charRoster().filter((r) => !r.npc);

function face(name: string, side: number, flip = false): HTMLCanvasElement {
  const f = charFace(name, 64, flip);
  const c = document.createElement('canvas');
  c.width = c.height = side;
  const o = c.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  if (f) o.drawImage(f, 0, 0, side, side);
  return c;
}
function body(name: string, flip: boolean, k = 1): HTMLCanvasElement {
  const b = sheetBody(name);
  const c = document.createElement('canvas');
  if (!b) { c.width = c.height = 1; return c; }
  c.width = Math.round(b.w * k); c.height = Math.round(b.h * k);
  const o = c.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  if (flip) { o.translate(c.width, 0); o.scale(-1, 1); }
  o.drawImage(b.img, b.x, b.y, b.w, b.h, 0, 0, c.width, c.height);
  return c;
}

export function openSelect(box: HTMLElement, opts: SelectOpts): { close(): void; el: HTMLElement } {
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
    return (free.length ? free : rows)[Math.floor(Math.random() * (free.length || rows.length))].name;
  };

  const draw = () => {
    const t = turn();
    const grid = names.map((n, i) => {
      const cls = ['vs-cell', n === RANDOM ? 'rand' : ''];
      if (cur[0] === i && t === 0) cls.push('c0');
      if (cur[1] === i && t === 1) cls.push('c1');
      if (picks[0].includes(n)) cls.push('taken0');
      if (picks[1].includes(n)) cls.push('taken1');
      return `<div class="${cls.join(' ')}" data-i="${i}">${n === RANDOM ? '?' : ''}</div>`;
    }).join('');
    const sideHtml = (s: 0 | 1) => `<div class="vs-side" data-s="${s}"><div class="vs-who" style="color:${P_COLOR[s]}">${s === 0 ? '1P' : mode.id === 'survival' ? '상대' : '상대'}</div><div class="vs-body"></div><div class="vs-name"></div><div class="vs-picks"></div></div>`;
    el.innerHTML = `<div class="vs-panel">
      <div class="vs-modes">${MODES.map((m) => `<div class="vs-mode${m === mode ? ' on' : ''}" data-m="${m.id}">${m.name}</div>`).join('')}</div>
      ${sideHtml(0)}<div class="vs-grid">${grid}</div>${sideHtml(1)}
      <div class="vs-help">${t === 0 ? '내 인물' : '상대'} 고르기${mode.picks[t] > 1 ? ` (${picks[t].length + 1}/${mode.picks[t]})` : ''} · Enter 고르기 · Backspace 되돌리기 · Tab 모드 · Esc 닫기</div>
    </div>`;
    el.querySelectorAll<HTMLElement>('.vs-cell').forEach((c) => {
      const n = names[+c.dataset.i!];
      if (n !== RANDOM) c.appendChild(face(n, 40));
    });
    for (const s of [0, 1] as const) {
      const side = el.querySelector<HTMLElement>(`.vs-side[data-s="${s}"]`)!;
      if (s === 1 && mode.id === 'survival') {
        side.querySelector('.vs-name')!.textContent = '계속 나와요';
        continue;
      }
      // 커서가 그 쪽 차례면 커서 인물, 아니면 마지막으로 고른 인물
      const show = turn() === s && !done() ? names[cur[s]] : picks[s][picks[s].length - 1];
      if (show && show !== RANDOM) {
        side.querySelector('.vs-body')!.appendChild(body(show, s === 1, 1));
        side.querySelector('.vs-name')!.textContent = show;
      } else if (show === RANDOM) side.querySelector('.vs-name')!.textContent = '무작위';
      const pk = side.querySelector('.vs-picks')!;
      for (const n of picks[s]) pk.appendChild(face(n, 28, s === 1));
    }
  };

  const pick = () => {
    const t = turn();
    const n = resolve(names[cur[t]], [...picks[0], ...picks[1]]);
    if (mode.id === 'team' && picks[t].includes(n)) return;   // 팀 안에서 같은 인물 두 번 X
    picks[t].push(n);
    if (t === 0 && picks[0].length === mode.picks[0] && mode.picks[1] && !opts.last) cur[1] = cur[0];
    if (done()) { finish(); return; }
    draw();
  };
  const undo = () => {
    const t = picks[1].length ? 1 : 0;
    if (!picks[t].length) return;
    picks[t].pop();
    draw();
  };
  const setMode = (m: (typeof MODES)[number]) => { mode = m; picks[0] = []; picks[1] = []; draw(); };
  const move = (dx: number, dy: number) => {
    const t = turn();
    let i = cur[t];
    if (dx) i = (i + dx + names.length) % names.length;
    if (dy) { i += dy * COLS; if (i < 0) i += Math.ceil(names.length / COLS) * COLS; if (i >= names.length) i = dy > 0 ? i % COLS : names.length - 1; i = Math.min(Math.max(0, i), names.length - 1); }
    cur[t] = i;
    draw();
  };

  let closed = false;
  const onKey = (e: KeyboardEvent) => {
    if (closed) return;
    const k = e.key;
    const map: Record<string, () => void> = {
      ArrowLeft: () => move(-1, 0), ArrowRight: () => move(1, 0), ArrowUp: () => move(0, -1), ArrowDown: () => move(0, 1),
      Enter: pick, z: pick, Z: pick, ' ': pick, Backspace: undo, x: undo, X: undo,
      Tab: () => setMode(MODES[(MODES.indexOf(mode) + (e.shiftKey ? MODES.length - 1 : 1)) % MODES.length]),
      Escape: () => { close(); opts.onClose(); },
    };
    if (!map[k]) return;
    e.preventDefault(); e.stopPropagation();
    map[k]();
  };
  el.addEventListener('pointerover', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.vs-cell');
    if (!c || done()) return;
    const i = +c.dataset.i!;
    if (cur[turn()] !== i) { cur[turn()] = i; draw(); }
  });
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const m = t.closest<HTMLElement>('.vs-mode');
    if (m) { setMode(MODES.find((x) => x.id === m.dataset.m)!); return; }
    const c = t.closest<HTMLElement>('.vs-cell');
    if (c) { cur[turn()] = +c.dataset.i!; pick(); }
  });
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); undo(); });
  window.addEventListener('keydown', onKey, true);

  const finish = () => { const r = { mode: mode.id, me: picks[0].slice(), foe: picks[1].slice() }; close(); opts.onPick(r); };
  const close = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey, true);
    el.remove(); st.remove();
  };
  draw();
  return { close, el };
}

/** VS 화면: 고른 인물을 받는 동안 띄운다. load 가 끝나면 닫힌다 */
export async function showVs(box: HTMLElement, r: SelectResult, load: () => Promise<unknown>): Promise<void> {
  const st = document.createElement('style');
  st.textContent = CSS;
  const el = document.createElement('div');
  el.className = 'vs-sel';
  const team = (list: string[], flip: boolean) => {
    const d = document.createElement('div');
    d.className = 'team';
    list.forEach((n, i) => { if (i === 0) d.appendChild(face(n, 96, flip)); });
    d.insertAdjacentHTML('beforeend', `<div>${list.join(' · ')}</div>`);
    return d;
  };
  const panel = document.createElement('div');
  panel.className = 'vs-vs';
  panel.append(team(r.me, false));
  panel.insertAdjacentHTML('beforeend', '<div class="big">VS</div>');
  if (r.mode === 'survival') panel.insertAdjacentHTML('beforeend', '<div class="team"><div style="font-size:28px">?</div><div>계속 나와요</div></div>');
  else panel.append(team(r.foe, true));
  panel.insertAdjacentHTML('beforeend', '<div class="load">불러오는 중…</div>');
  el.appendChild(panel);
  box.append(st, el);
  const t0 = performance.now();
  try { await load(); } finally {
    const wait = 1200 - (performance.now() - t0);   // 너무 빨리 지나가면 VS 가 안 보인다
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    el.remove(); st.remove();
  }
}
