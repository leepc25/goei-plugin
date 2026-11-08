// 대전 고르기 창 (11-08 사용자): 대전게임처럼 얼굴 한 판에서 1P(내 것, 왼쪽) 먼저, 이어 상대(오른쪽)를 고른다.
// 11-08 사용자 「진짜 게임처럼」: 양옆에 크게 움직이는 전신, 기운 이름판, 깜빡이는 1P·2P 커서, 30초 시간, 고를 때 번쩍임·소리.
// 얼굴은 대전 공용 자료의 얼굴판(vs-common faces.webp)에서 잘라 그리므로 인물 팩 없이 바로 뜬다. 전신은 인물 팩(미리 받아 둔 것)을 풀어 전투 자세(3)로 움직인다.
// 인물 풀 = 이름 있는 인물만(NPC 빼기). 서바이벌 상대는 NPC 도 나온다 — 고르지 않고 웨이브가 낸다.
// 키: 방향키 움직이기, Enter·Z 고르기, Backspace·X 되돌리기, Tab 모드 바꾸기, Esc 닫기. 마우스: 올리면 커서, 누르면 고르기, 오른쪽 단추 되돌리기.
import { charArt, charFace, charRoster, drawCharFrame, loadChar, sheetBody, type RosterRow } from '../action/art/charPacks';
import { crt2d } from './crt2d';
import { dotText, HUD_DIM, HUD_EDGE, HUD_INK } from '../action/ui/pixelHud';
import { bigText, BIG_FIRE, BIG_INK } from '../action/ui/bigText';
import type { VsMode } from '../action/engine/versus';

/** big = 모드 고르기 큰 글자 (도트 한글은 크게 키우면 획이 뭉개져서 영문 큰 글자, 11-08) */
const MODES: { id: VsMode; name: string; big: string; picks: [number, number] }[] = [
  { id: 'duel', name: '1 VS 1', big: '1 VS 1', picks: [1, 1] },
  { id: 'team', name: '태그매치', big: 'TAG MATCH', picks: [3, 3] },
  { id: 'survival', name: '서바이벌', big: 'SURVIVAL', picks: [1, 0] },
];
const RANDOM = '__random';
const CELL = 64;   // 11-08 사용자 「격투게임처럼」: 얼굴판 얼굴을 1:1 로 크게
const TIME = 30;
/** 1P 파랑·2P 빨강: 커서·이름 앞 표시·인물 외곽 빛에만 쓴다 */
const P_COLOR = ['#5a9cff', '#ff5a5a'];

/** 소리: move 커서, ok 고르기, back 되돌리기, vs VS 도장, start 경기 시작 */
export type VsSfx = (id: 'move' | 'ok' | 'back' | 'vs' | 'start') => void;

// 11-08 사용자: 본문을 덮지 않는다(배경판·띠 없음). 글자는 전부 도트(HUD 와 같은 pixelHud 글자), 효과는 인물 외곽 빛만.
/** 도트 상자 틀 (11-08 사용자: 평평한 네모 말고 제대로 된 도트 상자). 12×12 원본을 border-image 로 2배(도트 한 칸 = 2px).
 *  모서리 한 도트 깎기 · 검은 테 · 밝은 윗면/왼면 · 어두운 아랫면/오른면 · 안쪽 강조 줄 · 반투명 속 */
interface FrameCol { edge: string; light: string; shadow: string; accent: string; fill: string }
function framePixels(o: CanvasRenderingContext2D, n: number, c: FrameCol, px = 1) {
  const dot = (x: number, y: number, col: string) => { o.fillStyle = col; o.fillRect(x * px, y * px, px, px); };
  const N = n - 1;
  for (let y = 0; y <= N; y++) for (let x = 0; x <= N; x++) {
    const edgeX = x === 0 || x === N, edgeY = y === 0 || y === N;
    if (edgeX && edgeY) continue;                                   // 모서리 깎기
    if (edgeX || edgeY) { dot(x, y, c.edge); continue; }
    if ((x === 1 || x === N - 1) && (y === 1 || y === N - 1)) { dot(x, y, c.edge); continue; }   // 깎은 모서리 안쪽을 닫는다
    if (y === 1 || x === 1) { dot(x, y, c.light); continue; }
    if (y === N - 1 || x === N - 1) { dot(x, y, c.shadow); continue; }
    if (x === 2 || y === 2 || x === N - 2 || y === N - 2) { dot(x, y, c.accent); continue; }
    dot(x, y, c.fill);
  }
}
const frameCache = new Map<string, string>();
function frameUrl(c: FrameCol): string {
  const key = JSON.stringify(c);
  let u = frameCache.get(key);
  if (!u) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 12;
    framePixels(cv.getContext('2d')!, 12, c);
    u = cv.toDataURL();
    frameCache.set(key, u);
  }
  return u;
}
const F_BASE: FrameCol = { edge: '#07090b', light: '#6a717c', shadow: '#272b31', accent: '#1a1e24', fill: 'rgba(15,18,22,.92)' };
const F_ON: FrameCol = { edge: '#07090b', light: '#fff3c4', shadow: '#8a6a1c', accent: '#d9a72e', fill: 'rgba(40,32,14,.94)' };
const frameCss = (c: FrameCol) => `border:8px solid transparent;border-image:url(${frameUrl(c)}) 4 fill / 8px stretch;image-rendering:pixelated;background:none`;
/** VS 도장 (11-08 사용자 「VS 퀄리티」): 글꼴을 키우지 않고 도트로 그린 글자. 굵기 3도트, 오른쪽으로 살짝 기울임,
 *  검은 테 · 윗줄 밝게 · 아랫줄 어둡게(띠 세 단, 그라데이션 아님) · 오른쪽 아래 그림자. 도트 한 칸 = 4px (정수배) */
const VS_GLYPH = [
  '###.......###...########..',
  '###.......###..##########.',
  '###.......###.####....####',
  '###.......###.###......###',
  '###.......###.###.........',
  '.###.....###..####........',
  '.###.....###...########...',
  '.###.....###....########..',
  '..###...###.........#####.',
  '..###...###...........###.',
  '...###.###....###.....###.',
  '...###.###....####...####.',
  '....#####......#########..',
  '....#####.......#######...',
  '.....###..................',
];
function vsMark(): HTMLCanvasElement {
  const H = VS_GLYPH.length, slant = (y: number) => Math.floor((H - 1 - y) / 4);
  const W = VS_GLYPH[0].length + slant(0) + 4, HH = H + 4, U = 4;
  const on = (x: number, y: number) => { if (y < 0 || y >= H) return false; const gx = x - 1 - slant(y); return gx >= 0 && gx < VS_GLYPH[y].length && VS_GLYPH[y][gx] === '#'; };
  const cv = document.createElement('canvas');
  cv.width = W * U; cv.height = HH * U;
  const o = cv.getContext('2d')!;
  const px = (x: number, y: number, c: string) => { o.fillStyle = c; o.fillRect(x * U, y * U, U, U); };
  const near = (x: number, y: number) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => on(x + dx, y + dy)));
  // 그림자(오른쪽 아래 1도트) → 검은 테 → 글자
  for (let y = 0; y < HH; y++) for (let x = 0; x < W; x++) if (!near(x, y) && near(x - 1, y - 1)) px(x, y + 1, 'rgba(0,0,0,.55)');
  for (let y = -1; y < HH; y++) for (let x = 0; x < W; x++) if (!on(x, y) && near(x, y)) px(x, y + 1, HUD_EDGE);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (on(x, y)) {
    const c = !on(x, y - 1) ? '#ffffff' : y >= H - 4 || !on(x, y + 1) ? '#a9a598' : HUD_INK;
    px(x, y + 1, c);
  }
  return crt2d(cv);
}


/** 고르기·VS 화면을 경기 그림판과 같은 틀에 넣는다 (11-08 사용자 「화면 구성이 이상한데」): 1280×960 을 경기와 같은 배율로 줄여(키우지 않음) 상자 아래 가운데에.
 * ui/stage.ts 투명 무대와 같은 식: 배율 = min(1, 높이/960, 폭/1280), 바닥을 상자 아래에 붙인다 */
const STAGE_W = 1280, STAGE_H = 960;
/** 전신 확대: 경기 화면처럼 도트 한 칸 = 2px (11-08 사용자 「캐릭터는 확대 적용 안되서 좃만하게」) */
const FIG_ZOOM = 1.6;
function fitStage(el: HTMLElement, box: HTMLElement): void {
  const fit = () => {
    if (!el.isConnected) { ro.disconnect(); return; }
    const bw = box.clientWidth, bh = box.clientHeight, sc = Math.min(1, bh / STAGE_H, bw / STAGE_W);
    Object.assign(el.style, { inset: 'auto', left: `${Math.round((bw - STAGE_W * sc) / 2)}px`, top: `${Math.round(bh - STAGE_H * sc)}px`, width: `${STAGE_W}px`, height: `${STAGE_H}px`, transformOrigin: '0 0', transform: `scale(${sc})` });
  };
  const ro = new ResizeObserver(fit);
  ro.observe(box);
  fit();
}

const CSS = `
.vs-sel{--shd:drop-shadow(3px 3px 0 rgba(0,0,0,.6));position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:40;user-select:none}
.vs-sel *{box-sizing:border-box}
.vs-sel canvas{image-rendering:pixelated;display:block}
.vs-top{position:absolute;left:0;right:0;top:10px;display:flex;flex-direction:column;align-items:center;gap:8px;z-index:5}
.vs-title{padding:0 10px;filter:var(--shd);${frameCss(F_BASE)}}
.vs-modes{display:none}
.vs-tsub{display:flex;justify-content:center;margin-top:2px}
.vs-mlist{position:absolute;z-index:5;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:16px;pointer-events:auto}
.vs-mlist{gap:10px}
.vs-mlist .vs-mode{width:auto;padding:0;border:0;border-image:none;background:none;filter:none}
.vs-mlist .vs-mode:before,.vs-mlist .vs-mode:after{display:none}
.vs-mlist .vs-mode.on{animation:none;border:0;border-image:none;background:none}
.vs-sel[data-st="mode"] .vs-title{border:0;border-image:none;background:none;padding:0;filter:none}
.vs-sel[data-st="mode"] .vs-title:before{display:none}
.vs-sel[data-st="mode"] .vs-top{top:40px}
.vs-sel[data-st="mode"]>:not(.vs-top):not(.vs-mlist):not(.vs-help){display:none}
.vs-sel[data-st="char"]>.vs-mlist{display:none}
.vs-mode{position:relative;cursor:pointer;width:150px;display:flex;justify-content:center;filter:var(--shd);${frameCss(F_BASE)}}
.vs-mode.on{${frameCss(F_ON)}}
.vs-mode.on:after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 0 40%,rgba(255,255,255,.45) 40% 48%,transparent 48% 54%,rgba(255,255,255,.25) 54% 57%,transparent 57%);background-size:300% 100%;animation:vs-shine 1.6s steps(16) infinite}
.vs-mode .ar{position:absolute;top:50%;margin-top:-9px;animation:vs-pulse .5s steps(2) infinite}
.vs-mode .ar.l{left:-24px}
.vs-mode .ar.r{right:-24px}
@keyframes vs-shine{0%{background-position:100% 0}60%,100%{background-position:0 0}}
.vs-time{position:absolute;top:10px;right:16px;z-index:6;padding:0 4px;filter:var(--shd);${frameCss(F_BASE)}}
.vs-time.low{animation:vs-pulse .5s steps(2) infinite}
.vs-fig{position:absolute;bottom:58px;z-index:2;pointer-events:none}
.vs-fig[data-s="0"]{left:0;transform:scale(${FIG_ZOOM});transform-origin:left bottom}
.vs-fig[data-s="1"]{right:0;transform:scale(${FIG_ZOOM});transform-origin:right bottom}
.vs-slot{position:absolute;bottom:0}
.vs-slot[data-k="1"] canvas:not(.sh),.vs-slot[data-k="2"] canvas:not(.sh){opacity:.85}
.vs-slot.in{animation:vs-pop .2s steps(4)}
@keyframes vs-pop{from{opacity:0;margin-bottom:-30px}}
.vs-fig[data-s="0"] canvas:not(.sh){filter:drop-shadow(0 0 3px ${P_COLOR[0]}) drop-shadow(0 0 8px ${P_COLOR[0]}aa)}
.vs-fig[data-s="1"] canvas:not(.sh){filter:drop-shadow(0 0 3px ${P_COLOR[1]}) drop-shadow(0 0 8px ${P_COLOR[1]}aa)}
.vs-fig.pick .vs-slot[data-k="0"] canvas:not(.sh){animation:vs-pick .3s steps(3)}
.vs-fig .unk{position:absolute;left:0;right:0;bottom:30%;display:flex;justify-content:center}
.vs-nm{position:absolute;z-index:4;bottom:12px;display:flex;align-items:center;gap:8px;padding:0 6px;filter:var(--shd);${frameCss(F_BASE)}}
.vs-nm[data-s="0"]{left:3%}
.vs-nm[data-s="1"]{right:3%;flex-direction:row-reverse}
.vs-picks{display:flex;gap:3px;margin-bottom:2px}
.vs-nm[data-s="1"] .vs-picks{flex-direction:row-reverse}
.vs-gridw{position:absolute;z-index:3;left:50%;top:var(--gt);transform:translateX(-50%);pointer-events:auto}
.vs-sel[data-st="char"] .vs-top{top:34px}
.vs-title{display:flex;flex-direction:column;align-items:center;gap:4px}
.vs-sel[data-st="char"] .vs-title{padding:8px 14px}
.vs-grid{display:grid;gap:3px}
.vs-cell{position:relative;width:${CELL}px;height:${CELL}px;cursor:pointer}
.vs-cell>canvas{position:absolute;left:0;top:0;filter:var(--shd);transition:transform .06s steps(2)}
.vs-cell.cur>canvas{transform:translateY(-3px);filter:drop-shadow(3px 5px 0 rgba(0,0,0,.6))}
.vs-cell.rand{display:flex;align-items:center;justify-content:center}
.vs-cell.taken:not(.cur)>canvas{filter:grayscale(1) brightness(.45) var(--shd)}
.vs-cell.taken.cur>canvas{filter:brightness(.8) drop-shadow(3px 5px 0 rgba(0,0,0,.6))}
.vs-cur{position:absolute;left:0;top:-19px;z-index:2;animation:vs-pulse .4s steps(2) infinite}
.vs-cur.c1{left:auto;right:0}
.vs-say{position:absolute;z-index:4;left:0;right:0;bottom:170px;display:flex;justify-content:center;animation:vs-pulse 1s steps(2) infinite}
.vs-help{position:absolute;z-index:4;left:0;right:0;bottom:2px;}
.vs-sel[data-st="char"] .vs-help{display:flex;justify-content:center}
.vs-say canvas,.vs-help canvas,.vs-load canvas,.vs-vteam canvas{filter:var(--shd)}
.vs-say canvas,.vs-help canvas,.vs-load canvas{padding:0 4px;${frameCss(F_BASE)}}
.vs-title{position:relative}
.vs-title:before,.vs-mode:before,.vs-time:before,.vs-nm:before,.vs-vname:before{content:'';position:absolute;inset:-6px;z-index:-1;pointer-events:none;background:repeating-linear-gradient(to bottom,rgba(0,0,0,.3) 0 1px,transparent 1px 2px),repeating-linear-gradient(to right,rgba(255,60,60,.07) 0 1px,rgba(60,255,60,.07) 1px 2px,rgba(60,60,255,.07) 2px 3px)}
@keyframes vs-blink{50%{border-color:${HUD_INK}}}
@keyframes vs-pulse{50%{opacity:.4}}
@keyframes vs-inL{from{transform:translateX(-80px) scale(${FIG_ZOOM});opacity:0}}
@keyframes vs-inR{from{transform:translateX(80px) scale(${FIG_ZOOM});opacity:0}}
@keyframes vs-pick{0%{filter:brightness(3)}}
.vs-vfig{position:absolute;bottom:56px}
.vs-vfig{transform:scale(${FIG_ZOOM})}
.vs-vfig[data-s="0"]{transform-origin:left bottom;left:0;animation:vs-inL .3s steps(5) backwards}
.vs-vfig[data-s="1"]{transform-origin:right bottom;right:0;animation:vs-inR .3s steps(5) backwards}
.vs-vfig[data-s="0"] canvas:not(.sh){filter:drop-shadow(0 0 3px ${P_COLOR[0]}) drop-shadow(0 0 8px ${P_COLOR[0]}aa)}
.vs-vfig[data-s="1"] canvas:not(.sh){filter:drop-shadow(0 0 3px ${P_COLOR[1]}) drop-shadow(0 0 8px ${P_COLOR[1]}aa)}
.vs-vnm{position:absolute;z-index:5;bottom:184px;transform:translateY(50%);display:flex;flex-direction:column;gap:6px}
.vs-vnm[data-s="0"]{right:calc(50% + 84px);align-items:flex-end;animation:vs-inL .3s .3s steps(5) backwards}
.vs-vnm[data-s="1"]{left:calc(50% + 84px);align-items:flex-start;animation:vs-inR .3s .3s steps(5) backwards}
.vs-vname{position:absolute;bottom:14px;display:flex;align-items:center;gap:8px;padding:0 6px;filter:var(--shd);${frameCss(F_BASE)}}
.vs-vname[data-s="0"]{left:8%}
.vs-vname[data-s="1"]{right:8%;flex-direction:row-reverse}
.vs-vteam{position:absolute;display:flex;gap:4px}
.vs-vteam[data-s="0"]{left:20px}
.vs-vteam[data-s="1"]{right:20px;flex-direction:row-reverse}
.vs-big{position:absolute;left:50%;bottom:184px;transform:translate(-50%,50%);z-index:5;animation:vs-stamp .25s .4s steps(4) backwards}
.vs-load{position:absolute;left:0;right:0;bottom:4px;display:flex;justify-content:center;animation:vs-pulse .8s steps(2) infinite}
@keyframes vs-stamp{from{transform:translate(-50%,50%) scale(3);opacity:0}}
`;

/** 모드 고르기 줄 (11-08 사용자 「격투게임 모드 고르기처럼」): 상자 없이 큰 글자, 고른 줄은 [ ] 로 감싸고 노랑→주황, 나머지는 흰→회색 */
function bigMode(text: string, on: boolean): HTMLCanvasElement {
  const src = bigText(on ? `[ ${text} ]` : text, on ? BIG_FIRE : BIG_INK, 5, { slant: false, bold: true });
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  cv.getContext('2d')!.drawImage(src, 0, 0);
  return crt2d(cv);
}

/** VS 화면 이름: HUD 도트 글자 3배, 1P 파랑·2P 빨강 세 단(위 밝게) + 오른쪽 아래 검은 그림자 한 도트 */
const NAME_BAND = [['#e4f0ff', '#6fa8ff', '#2a4fb0'], ['#ffe0d8', '#ff6a4a', '#a8261a']];
function nameBig(text: string, side: 0 | 1, k = 3): HTMLCanvasElement {
  const src = dotText(text, '#ffffff', k);
  const cv = document.createElement('canvas');
  cv.width = src.width + k * 2; cv.height = src.height + k * 2;
  const o = cv.getContext('2d')!;
  const tint = (fill: (q: CanvasRenderingContext2D) => void) => { const t = document.createElement('canvas'); t.width = src.width; t.height = src.height; const q = t.getContext('2d')!; q.drawImage(src, 0, 0); q.globalCompositeOperation = 'source-in'; fill(q); return t; };
  o.drawImage(tint((q) => { q.fillStyle = '#07090b'; q.fillRect(0, 0, src.width, src.height); }), k, k);
  // dotText 는 테두리(어두운 색)가 붙어 나온다: 밝은 칸(글자 몸)만 세 단 색으로 바꾸고 테두리는 그대로
  const band = NAME_BAND[side].map((c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
  const g = document.createElement('canvas'); g.width = src.width; g.height = src.height;
  const q = g.getContext('2d')!; q.drawImage(src, 0, 0);
  const d = q.getImageData(0, 0, g.width, g.height);
  for (let y = 0; y < g.height; y++) {
    const c = band[Math.min(band.length - 1, Math.floor((y * band.length) / g.height))];
    for (let x = 0; x < g.width; x++) {
      const i = (y * g.width + x) * 4;
      if (d.data[i + 3] > 0 && d.data[i] + d.data[i + 1] + d.data[i + 2] > 384) { d.data[i] = c[0]; d.data[i + 1] = c[1]; d.data[i + 2] = c[2]; }
    }
  }
  q.putImageData(d, 0, 0);
  o.drawImage(g, 0, 0);
  return crt2d(cv);
}

/** 도트 글자 한 장 (DOM 에 넣을 새 canvas) */
function dot(s: string, color = HUD_INK, scale = 2): HTMLCanvasElement {
  const src = dotText(s, color, scale);
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return crt2d(c);
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
function figure(h: number, flip: boolean, k = 1) {
  // 11-08 사용자: 키우지 않는다. 앞사람은 도트 한 칸 = 1px, 뒤 사람만 원근으로 작게
  h = Math.round(h * k);
  // 그림자는 따로 (외곽 빛이 그림자에 번지지 않게), 발 아래로 PAD 만큼 더
  const PAD = 16;
  const cv = document.createElement('canvas'), sc = document.createElement('canvas');
  cv.width = sc.width = Math.round(150 * k); cv.height = sc.height = h + PAD;
  cv.style.marginBottom = `-${PAD}px`;
  sc.className = 'sh';
  sc.style.cssText = `position:absolute;left:0;bottom:-${PAD}px`;
  const o = cv.getContext('2d')!, so = sc.getContext('2d')!;
  let name = '', shown = '';
  // 브라운관을 입힌 장 (이름·줄·장마다 한 번만 만든다)
  const done = new Map<string, HTMLCanvasElement>();
  const draw = (now: number) => {
    if (!name || name === RANDOM) { if (shown) { o.clearRect(0, 0, cv.width, cv.height); so.clearRect(0, 0, sc.width, sc.height); shown = ''; } return; }
    const a = charArt(name);
    const id = STANCE.find((i) => a?.A[i] && a.IMG[i]);
    if (a && id) {
      // 전투 자세는 모든 장을 8fps, 평상 대기는 앞 두 장만 (테스트룸 규칙)
      const n = a.A[id].n;
      const f = (id === '3' ? Math.floor(now / 125) : Math.floor(now / 600) % 2) % n;
      const key = `${name}|${id}|${f}`;
      if (key === shown) return;
      shown = key;
      o.clearRect(0, 0, cv.width, cv.height);
      so.clearRect(0, 0, sc.width, sc.height);
      let fr = done.get(key);
      if (!fr) {
        fr = document.createElement('canvas');
        fr.width = cv.width; fr.height = cv.height;
        drawCharFrame(fr.getContext('2d')!, name, id, f, cv.width / 2, h - 4 * k, flip ? -1 : 1, k, so);
        done.set(key, crt2d(fr));
      } else drawCharFrame(document.createElement('canvas').getContext('2d')!, name, id, f, cv.width / 2, h - 4 * k, flip ? -1 : 1, k, so);
      o.drawImage(fr, 0, 0);
      return;
    }
    if (shown === `${name}|body`) return;
    shown = `${name}|body`;
    o.clearRect(0, 0, cv.width, cv.height);
    so.clearRect(0, 0, sc.width, sc.height);
    const b = sheetBody(name);
    if (!b) { shown = ''; return; }
    o.save();
    o.imageSmoothingEnabled = false;
    if (flip) { o.translate(cv.width, 0); o.scale(-1, 1); }
    o.drawImage(b.img, b.x, b.y, b.w, b.h, Math.round(cv.width / 2 - (b.w * k) / 2), Math.round(h - 4 * k - b.h * k), Math.round(b.w * k), Math.round(b.h * k));
    o.restore();
    crt2d(cv);
  };
  return {
    cv,
    sc,
    draw,
    set(n: string) { name = n; if (n && n !== RANDOM && !charArt(n)) void loadChar(n); },
  };
}

/** 대형 (태그매치, 11-08 사용자): 1P 「/」, 2P 「\」 대각선 줄. 뒤로 갈수록 원근으로 작게, 조금 위에. 1:1 은 한 명 */
const FIG_H = 256, PERSP = [1, 0.93, 0.86], DX = 34, DY = 12;   // 살짝 겹치게, 원근은 적게 (11-08 사용자)
function troupe(_h: number, flip: boolean, n = 3) {
  const figs = Array.from({ length: n }, (_, k) => figure(FIG_H, flip, PERSP[k]));
  const el = document.createElement('div');
  const w = figs[0].cv.width;
  el.style.cssText = `position:relative;width:${w + DX * (n - 1)}px;height:${FIG_H}px`;
  // 11-08 사용자: 1P 는 「/」 줄 — 앞사람이 바깥(왼쪽) 아래, 뒤 사람은 안쪽으로 DX·위로 DY 씩
  const slots = figs.map((f, k) => {
    const d = document.createElement('div');
    d.className = 'vs-slot'; d.dataset.k = String(k);
    const cx = flip ? w / 2 + (n - 1 - k) * DX : w / 2 + k * DX;   // 1P 「/」 (앞사람 왼쪽 아래 → 오른쪽 위로), 2P 는 거울 「\」
    d.style.left = `${Math.round(cx - f.cv.width / 2)}px`;
    d.style.bottom = `${k * DY}px`;
    d.style.zIndex = String(3 - k);
    d.append(f.sc, f.cv); el.appendChild(d); return d;
  });
  const names = Array(n).fill('');
  return {
    el,
    draw: (now: number) => figs.forEach((f) => f.draw(now)),
    set(list: string[]) {
      for (let k = 0; k < n; k++) {
        const nm = list[k] ?? '';
        if (nm === names[k]) continue;
        names[k] = nm;
        figs[k].set(nm);
        slots[k].querySelector('.unk')?.remove();
        if (nm === RANDOM) { const u = document.createElement('div'); u.className = 'unk'; u.appendChild(dot('?', HUD_INK, 8)); slots[k].appendChild(u); }
        if (nm) { slots[k].classList.remove('in'); void slots[k].offsetWidth; slots[k].classList.add('in'); }
      }
    },
  };
}

/** 얼굴 칸 (11-08 사용자): 상자와 같은 도트 틀(도트 한 칸 = 2px)에 얼굴판 얼굴을 1:1 로. 커서가 오면 1P·2P 색 틀로 빛나고 살짝 떠오른다 */
function drawCell(cv: HTMLCanvasElement, name: string, state = '') {
  const o = cv.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  o.clearRect(0, 0, cv.width, cv.height);
  // 11-08 사용자 「격투게임처럼」: 검은 테 1 · 밝은 줄 2(커서면 1P 파랑/2P 빨강) · 따뜻한 두 단 바탕 · 얼굴 1:1
  const ring = state === 'p0' ? P_COLOR[0] : state === 'p1' ? P_COLOR[1] : '#e8e4d8';
  o.fillStyle = '#07090b'; o.fillRect(0, 0, CELL, CELL);
  o.fillStyle = ring; o.fillRect(1, 1, CELL - 2, CELL - 2);
  const at = 3, inn = CELL - 6;
  if (name === RANDOM) {
    o.fillStyle = '#1f3f8a'; o.fillRect(at, at, inn, inn);
    const q = bigText('?', BIG_FIRE, 4, { slant: false, bold: true });
    o.drawImage(q, Math.round((CELL - q.width) / 2), Math.round((CELL - q.height) / 2));
  } else {
    o.fillStyle = name ? '#a8642a' : '#1a1e24'; o.fillRect(at, at, inn, inn);
    if (name) { o.fillStyle = '#c47e36'; o.fillRect(at, at, inn, Math.round(inn * 0.4)); }
    const f = name ? charFace(name, 64, false) : null;
    if (f) o.drawImage(f, 3, 4, inn, inn, at, at, inn, inn);
  }
  crt2d(cv);
}
function cellCanvas(name: string, css = CELL): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = CELL;
  cv.style.width = cv.style.height = `${css}px`;
  drawCell(cv, name);
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
  fitStage(el, box);
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
  // 11-08 사용자 「격투게임처럼」: 얼굴은 네 칸씩 묶음, 묶음 사이를 띄운다
  // 판은 위쪽(도움말 아래)에, 세 칸 묶음을 띄워 늘어놓는다. 아래는 양옆 전신과 가운데 PLAYER SELECT
  const BLOCK = 3, BGAP = 14;
  const COLS = 9;   // 1280 틀 가운데 세 묶음, 양옆에 큰 전신 (11-08 사용자 「캐릭터칸은 저 위에 붙어있고」)
  const gridH = Math.ceil(names.length / COLS) * (CELL + 3);
  el.style.setProperty('--gh', `${gridH}px`);
  el.style.setProperty('--gt', `${Math.max(120, Math.round((STAGE_H - gridH) / 2 - 10))}px`);
  // 전신은 이름 줄 위에 선다: 위 제목 줄(약 90px)과 판 사이 높이
  const figH = FIG_H;
  el.innerHTML = `<div class="vs-top"><div class="vs-title"></div>
      <div class="vs-modes"></div></div>
    <div class="vs-mlist">${MODES.map((m) => `<div class="vs-mode" data-m="${m.id}"></div>`).join('')}</div>
    <div class="vs-time"></div>
    <div class="vs-fig" data-s="0"></div><div class="vs-fig" data-s="1"></div>
    <div class="vs-nm" data-s="0"><span class="p"></span><span class="n"></span><span class="vs-picks"></span></div>
    <div class="vs-nm" data-s="1"><span class="p"></span><span class="n"></span><span class="vs-picks"></span></div>
    <div class="vs-say"></div>
    <div class="vs-gridw"><div class="vs-grid">${names.map((n, i) => `<div class="vs-cell" data-i="${i}"></div>`).join('')}</div></div>
    <div class="vs-help"></div>`;
  const $ = <T extends HTMLElement>(q: string) => el.querySelector<T>(q)!;
  $('.vs-grid').style.gridTemplateColumns = Array.from({ length: COLS / BLOCK }, () => `repeat(${BLOCK},${CELL}px)`).join(` ${BGAP - 4}px `);
  el.querySelectorAll<HTMLElement>('.vs-cell').forEach((c, i) => {
    const col = i % COLS;
    c.style.gridColumn = String(col + 1 + Math.floor(col / BLOCK));
    c.style.gridRow = String(Math.floor(i / COLS) + 1);
  });
  // 첫 단계 = 모드 고르기(큰 글자 세로 목록), 다음 = 캐릭터 고르기
  let stage: 'mode' | 'char' = 'mode';
  const title = () => {
    const t = $('.vs-title');
    const bigs = (stage === 'mode' ? ['MODE SELECT'] : ['PLAYER', 'SELECT']).map((line) => {
      const big = document.createElement('canvas'), src = bigText(line, BIG_FIRE, stage === 'mode' ? 4 : 3, { slant: false, bold: true });
      big.width = src.width; big.height = src.height; big.getContext('2d')!.drawImage(src, 0, 0);
      return crt2d(big);
    });
    t.replaceChildren(...bigs);
    if (stage === 'char') { const sub = document.createElement('div'); sub.className = 'vs-tsub'; sub.appendChild(dot(mode.name, '#fff3c4', 1)); t.appendChild(sub); }
    put($('.vs-help'), dot(stage === 'mode' ? '↑↓ 움직이기 · Enter 고르기 · Esc 닫기' : '방향키 움직이기 · Enter 고르기 · Backspace 되돌리기 · Tab 모드 · Esc 닫기', HUD_DIM, 1));
  };
  const setStage = (st: 'mode' | 'char') => { stage = st; el.dataset.st = st; lastTurn = -1; title(); };
  for (const s of [0, 1] as const) put($(`.vs-nm[data-s="${s}"] .p`), dot(s ? '2P' : '1P', P_COLOR[s], 2));
  const cells = [...el.querySelectorAll<HTMLElement>('.vs-cell')];
  cells.forEach((c, i) => { c.appendChild(cellCanvas(names[i])); });
  let figs: ReturnType<typeof troupe>[] = [];
  let figN = 0;
  const makeFigs = (n: number) => {
    if (n === figN) return;
    figN = n; shown[0] = shown[1] = '\u0000';
    figs = ([0, 1] as const).map((s) => {
      const f = troupe(figH, s === 1, n);
      $(`.vs-fig[data-s="${s}"]`).querySelectorAll(':scope > div:not(.unk)').forEach((d) => d.remove());
      $(`.vs-fig[data-s="${s}"]`).prepend(f.el);
      return f;
    });
  };
  const curEl = ([0, 1] as const).map((s) => {
    const d = document.createElement('div');
    d.className = `vs-cur c${s}`;
    d.append(dot(s ? '2P' : '1P', P_COLOR[s], 1));
    return d;
  });
  const shown: [string, string] = ['', ''];
  let lastTurn = -1;
  makeFigs(1);
  let time = TIME, timeAt = performance.now();
  const drawTime = (left: number) => { const te = $('.vs-time'); put(te, dot(String(left).padStart(2, '0'), left <= 5 ? P_COLOR[1] : HUD_INK, 2)); te.classList.toggle('low', left <= 5); };
  drawTime(TIME);

  const update = () => {
    const t = turn();
    makeFigs(mode.picks[0] > 1 ? 3 : 1);
    el.querySelectorAll<HTMLElement>('.vs-mode').forEach((m) => {
      const on = m.dataset.m === mode.id;
      m.classList.toggle('on', on);
      // 11-08 사용자 「격투게임 모드 고르기처럼」: 상자 없이 큰 글자 줄, 고른 줄은 [ ] 로 감싸고 노랑→주황
      put(m, bigMode(MODES.find((x) => x.id === m.dataset.m)!.big, on));
    });
    const taken = new Set([...picks[0], ...picks[1]]);
    cells.forEach((c, i) => c.classList.toggle('taken', taken.has(names[i])));
    // 커서: 지금 차례인 쪽만. 그 칸은 1P·2P 색 틀로 다시 그리고 살짝 띄운다. 2P 차례면 1P 가 고른 칸은 회색
    curEl.forEach((d) => d.remove());
    const ci = done() ? -1 : cur[t];
    cells.forEach((c, i) => {
      const st = i === ci ? `p${t}` : '';
      if (c.dataset.st !== st) { c.dataset.st = st; drawCell(c.querySelector('canvas')!, names[i], st); }
      c.classList.toggle('cur', i === ci);
    });
    if (ci >= 0) cells[ci].appendChild(curEl[t]);
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
      put($(`.vs-nm[data-s="${s}"] .n`), dot(surv ? '웨이브 서바이벌' : n === RANDOM ? '무작위' : n, HUD_INK, 2));
      const pk = $(`.vs-nm[data-s="${s}"] .vs-picks`);
      pk.replaceChildren();
      if (mode.picks[s] > 1) for (let i = 0; i < mode.picks[s]; i++) {
        const p = picks[s][i];
        const c = cellCanvas(p ?? '', CELL / 2);
        pk.appendChild(c);
      }
    }
    const who = t === 0 ? '1P' : '2P';
    if (done()) $('.vs-say').replaceChildren();
    else put($('.vs-say'), dot(`${who} 캐릭터를 고르세요${mode.picks[t] > 1 ? ` (${picks[t].length + 1}/${mode.picks[t]})` : ''}`, HUD_INK, 1));
    if (t !== lastTurn) { lastTurn = t; time = TIME; timeAt = performance.now(); drawTime(TIME); }
  };

  const flash = (s: 0 | 1) => { const f = $(`.vs-fig[data-s="${s}"]`); f.classList.remove('pick'); void f.offsetWidth; f.classList.add('pick'); };
  const pick = () => {
    if (stage === 'mode') { sfx('ok'); setStage('char'); update(); return; }
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
    if (!picks[t].length) { if (stage === 'char') { sfx('back'); setStage('mode'); update(); } return; }
    picks[t].pop();
    sfx('back');
    update();
  };
  const setMode = (m: (typeof MODES)[number]) => { if (m === mode) return; mode = m; picks[0] = []; picks[1] = []; lastTurn = -1; sfx('move'); if (stage === 'char') title(); update(); };
  const move = (dx: number, dy: number) => {
    if (stage === 'mode') { if (dy) setMode(MODES[(MODES.indexOf(mode) + dy + MODES.length) % MODES.length]); return; }
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
    const mo = (e.target as HTMLElement).closest<HTMLElement>('.vs-mode');
    if (mo && stage === 'mode') { setMode(MODES.find((x) => x.id === mo.dataset.m)!); return; }
    const c = (e.target as HTMLElement).closest<HTMLElement>('.vs-cell');
    if (!c || done() || stage !== 'char') return;
    const i = +c.dataset.i!;
    if (cur[turn()] !== i) { cur[turn()] = i; sfx('move'); update(); }
  });
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const m = t.closest<HTMLElement>('.vs-mode');
    if (m) { setMode(MODES.find((x) => x.id === m.dataset.m)!); pick(); return; }
    const c = t.closest<HTMLElement>('.vs-cell');
    if (c && !done() && stage === 'char') { cur[turn()] = +c.dataset.i!; pick(); }
  });
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); undo(); });
  window.addEventListener('keydown', onKey, true);

  // 그리기·시간: 시간이 다 되면 커서 칸을 고른다 (대전게임 관례)
  let raf = 0;
  const tick = (now: number) => {
    if (closed) return;
    figs.forEach((f) => f.draw(now));
    // 틀 그림이 늦게 읽히면 한 번 다시
    if (!done() && stage === 'char') {
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
  setStage('mode');
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
  const figH = FIG_H;
  const figs: ReturnType<typeof troupe>[] = [];
  for (const s of [0, 1] as const) {
    const list = s ? r.foe : r.me;
    const surv = s === 1 && r.mode === 'survival';
    const fw = document.createElement('div');
    fw.className = 'vs-vfig';
    fw.dataset.s = String(s);
    if (surv) { fw.style.height = `${figH}px`; fw.style.display = 'flex'; fw.style.alignItems = 'center'; fw.appendChild(dot('?', HUD_INK, 10)); }
    else { const f = troupe(figH, s === 1, Math.max(1, Math.min(3, list.length))); f.set(list); figs.push(f); fw.appendChild(f.el); }
    // 이름 (11-08 사용자 「격투게임 VS 화면처럼」): VS 양옆에 크게, 상자 없이. 1P 파랑·2P 빨강, 팀은 셋 다 위아래로
    const nm = document.createElement('div');
    nm.className = 'vs-vnm';
    nm.dataset.s = String(s);
    for (const line of surv ? ['웨이브', '서바이벌'] : list) nm.appendChild(nameBig(line, s));
    el.append(fw, nm);
    if (list.length > 1) {
      const tm = document.createElement('div');
      tm.className = 'vs-vteam';
      tm.dataset.s = String(s);
      // 11-08 사용자: 얼굴 칸은 경기 체력 칸 자리(modules.ts drawVersusBars: 1.25배, 위 14 + 16:9 넘는 높이, 옆 16)
      // 경기 그림판은 폭 1280 을 본문 폭에 맞춰 줄이고, 칸은 그 그림판의 (14 + 16:9 넘는 높이/1.25)×1.25 자리
      tm.style.top = `${Math.round(1.25 * (14 + (STAGE_H - 720) / 1.25 * 0.25))}px`;   // 틀 안 좌표 = 그림판 좌표
      tm.style[s ? 'right' : 'left'] = `${Math.round(16 * 1.25)}px`;
      list.forEach((n) => tm.appendChild(cellCanvas(n, CELL)));
      el.appendChild(tm);
    }
  }
  const big = document.createElement('div'); big.className = 'vs-big'; big.appendChild(vsMark());
  const ld = document.createElement('div'); ld.className = 'vs-load'; ld.appendChild(dot('불러오는 중', HUD_DIM, 1));
  el.append(big, ld);
  box.append(st, el);
  fitStage(el, box);
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
