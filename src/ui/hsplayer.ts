// 망상홈쇼핑 방송 재생기 (2026-11-11). 편성의 큐시트(컷|표정|대사|화면 사건)를 차례로 틀어 준다.
// - 그림은 512×384 캔버스 한 장에 그린다: 배경 판 → (컷 A) 전구 자리만 불 꺼진 판의 점으로 바꿔 반짝임 → 진행자 동작 한 장 → 진열대 덮기 → 상품 그림.
//   그림 위에 색을 칠하지 않는다 (11-10 사용자: 전구는 꺼진 판·밝은 판의 진짜 점을 바꿔 끼운다, 그림 고치기 금지).
// - 글자·숫자·띠는 그림이 아니라 HTML 로 얹는다 (도트 글꼴, 11-10 도트 시안 site_mock_dot).
// - 화면을 다시 그려도(app render) 캔버스·채팅 줄은 같은 DOM 을 다시 꽂아 끊기지 않는다. 화면에서 빠지면(탭 닫기·창 닫기) 멈추고, 다시 꽂히면 그 자리부터.
// - 동작 고르기·길이 계산은 core/homeshop.ts (설정 값). 여기는 시간 흐름과 그리기만.
import { clipsOf, cueMs, dropEnd, dropRest, nextDrop, moodMap, moodName, CUE_EVENT_WORD, idleState, installments, moodClip, nextIdle, parseClipGroups, type CueCut, type CutId, type HsClip, type HsCue, type HsSettings, type HsShow, type IdleState } from '../core/homeshop';
import type { HsArt } from '../host/homeshop';
import { HS_FONT } from '../host/homeshop';
import { itemPic } from './items';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface PlayerFeed {
  art: HsArt | null;
  show: HsShow;
  s: HsSettings;
  /** 그림·편성이 없을 때 화면 가운데 글 (받는 중·오류·방송 없음) */
  note: string;
  /** 배율 (0.5 · 1 · 2) */
  scale: number;
  /** 주문 전화번호 (화면 글) */
  tel: string;
}
export interface PlayerHooks {
  /** 큐시트가 끝나 다음 부로 넘어갈 때 (저장·다시 그리기는 부른 쪽이) */
  advance(at: number): void;
  /** 상품 그림이 뒤늦게 준비됐을 때 화면을 한 번 다시 그린다 */
  redraw(): void;
}

interface Run {
  /** 지금 부 · 그 부의 큐 자리 (-1 = 아직 시작 전, cues.length = 끝나고 쉬는 중) */
  part: number;
  cue: number;
  cueAt: number;
  cueLen: number;
  cut: CueCut;
  clip: HsClip | null;
  frame: number;
  frameAt: number;
  /** 지금 동작이 대사에 딸린 것인가 (끝까지 돌고 대사 시간이 지나면 다음 큐) */
  talking: boolean;
  left: number;
  /** 저절로 줄기: 끝날 때 남길 수 · 다음에 줄일 수(0 = 아직 안 정함) · 그때까지 남은 시간(ms) */
  dropEnd: number;
  dropN: number;
  dropWait: number;
  flags: { price: boolean; rush: boolean; soon: boolean; sold: boolean; call: boolean; look: boolean };
  tearUntil: number;
  gapUntil: number;
  chatAt: number;
  chatIdx: number;
  bulbStep: number;
  bulbAt: number;
}

const KEEP_CHAT = 60;
/** 전구 한 칸 넘어가는 간격(ms) · 몇 개마다 하나 꺼지나 */
const BULB_MS = 260;
const BULB_EVERY = 4;
/** 찢김 길이(ms) [최소, 최대] (설계: 0.2~0.4초) */
const TEAR_MS: [number, number] = [200, 400];

let feed: PlayerFeed | null = null;
let hooks: PlayerHooks = { advance() {}, redraw() {} };
let iconMiss = false;
let resizing = false;
const extra: HsCue[] = [];
const extraChat: { nick: string; text: string }[] = [];
/** 화면에 흐른 채팅 (내 채팅 뒤 호출에 넘긴다) */
const shown: { nick: string; text: string }[] = [];
/** 지금 자막에 찍는 끼어든 대사 (없으면 큐시트의 것) */
let said: HsCue | null = null;
let stage: HTMLElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let cg: HTMLElement | null = null;
let chatLog: HTMLElement | null = null;
let run: Run | null = null;
let showKey = '';
let timer: ReturnType<typeof setInterval> | null = null;
/** 바로 앞 tick 시각 (0 = 막 다시 돌기 시작) */
let tickAt = 0;
const idle: Record<CutId, IdleState> = { A: idleState(), B: idleState() };
const icons = new Map<string, HTMLImageElement | null>();
let scratch: HTMLCanvasElement | null = null;

const now = () => performance.now();
const cutArt = (c: CueCut): CutId => (c === 'A' || c === 'C' ? 'A' : 'B');

function freshRun(part: number): Run {
  const left = feed?.s.left ?? 30;
  return { part, cue: -1, cueAt: 0, cueLen: 0, cut: 'A', clip: null, frame: 0, frameAt: 0, talking: false, left, dropEnd: feed ? dropEnd(left, feed.s.drop) : 1, dropN: 0, dropWait: 0, flags: { price: false, rush: false, soon: false, sold: false, call: false, look: false }, tearUntil: 0, gapUntil: 0, chatAt: 0, chatIdx: 0, bulbStep: 0, bulbAt: 0 };
}

/** 화면 상태를 갈아 끼운다. 편성이 바뀌었으면 처음부터, 같으면 보던 자리 그대로 */
export function setPlayerFeed(f: PlayerFeed, h: PlayerHooks): void {
  feed = f;
  hooks = h;
  const key = f.show.loaded ? `${f.show.key}:${f.show.parts.map((p) => p.item.id).join(',')}` : '';
  if (key !== showKey) {
    showKey = key;
    run = null;
    extra.length = 0;
    extraChat.length = 0;
    shown.length = 0;
    said = null;
    if (chatLog) chatLog.innerHTML = '';
  }
  if (f.show.loaded && (!run || run.part !== f.show.at)) run = freshRun(f.show.at);
}

/** 그린 뒤 부른다: 자리표시(.hs-mount)에 캔버스·채팅 줄을 다시 꽂고 돌린다. 자리가 없으면 멈춘다 */
export function mountPlayer(root: HTMLElement): void {
  const slot = root.querySelector<HTMLElement>('[data-hs-mount="stage"]');
  const chatSlot = root.querySelector<HTMLElement>('[data-hs-mount="chat"]');
  if (!slot || !feed) return stopPlayer();
  if (!stage) build();
  if (stage!.parentElement !== slot) slot.appendChild(stage!);
  if (chatSlot && chatLog && chatLog.parentElement !== chatSlot) {
    chatSlot.appendChild(chatLog);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
  layout();
  if (!timer) {
    // 멈췄다 다시 돌 때: 멈춘 동안은 수량 줄기 시간에 치지 않는다
    tickAt = 0;
    timer = setInterval(tick, 33);
  }
  if (!resizing) {
    resizing = true;
    window.addEventListener('resize', () => layout());
  }
  tick();
}
export function stopPlayer(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

function build(): void {
  stage = document.createElement('div');
  stage.className = 'hs-scr';
  canvas = document.createElement('canvas');
  canvas.className = 'hs-cv';
  cg = document.createElement('div');
  cg.className = 'hs-cg';
  const scan = document.createElement('div');
  scan.className = 'hs-scan';
  stage.append(canvas, cg, scan);
  chatLog = document.createElement('div');
  chatLog.className = 'hs-chlog';
}

/** 「자동·폭 맞춤」 배율: 방송 칸이 화면을 다 차지하지 않게, 사이트 칸 폭(PC 는 채팅 칸을 뺀 폭)과 보이는 높이 안에서.
 *  1배·2배처럼 정수가 들어가면 정수로 (도트가 고르게), 1배도 안 들어가면 그 폭에 맞춰 줄인다 (11-11 사용자: 큰 화면에서 2배로 커져 나머지가 안 보였다) */
function fitScale(w: number, h: number): number {
  const wrap = stage?.closest<HTMLElement>('.hs-wrap');
  const page = stage?.closest<HTMLElement>('.hs');
  if (!wrap || !page) return 1;
  const phone = page.classList.contains('hs-m');
  const cs = getComputedStyle(wrap);
  const inner = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  // PC: 채팅 칸 최소 폭 260 + 사이 14 · 방송 칸 테두리 2. 높이: 보이는 높이의 60% (아래 상품 칸·주문 단추가 첫 화면에 같이 보이게)
  const roomW = (phone ? inner : inner - 274) - 2;
  const roomH = (page.clientHeight || window.innerHeight) * (phone ? 0.5 : 0.6) - 36;
  const fit = Math.max(0.25, Math.min(roomW / w, roomH / h));
  return fit >= 2 ? 2 : fit >= 1 ? 1 : fit;
}

function layout(): void {
  if (!stage || !canvas || !feed) return;
  const w = feed.art?.pack.w ?? 512;
  const h = feed.art?.pack.h ?? 384;
  // 0 = 꽂힌 칸의 폭에 맞춤 (1배를 넘기지 않는다)
  const k = feed.scale > 0 ? feed.scale : fitScale(w, h);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  stage.style.width = `${w * k}px`;
  stage.style.height = `${h * k}px`;
  stage.style.fontFamily = `${HS_FONT}, monospace`;
  // 글자 층: 1배 이상은 512×384 를 통째로 키우고, 0.5배(폰)는 256×192 칸에 줄인 구성으로 (도트 시안 폰판)
  const small = k < 0.65;
  stage.classList.toggle('fit', !Number.isInteger(k) && k !== 0.5);
  stage.classList.toggle('sm', small);
  stage.classList.toggle('noscan', !feed.s.fx.scan);
  cg!.style.width = `${small ? w * k : w}px`;
  cg!.style.height = `${small ? h * k : h}px`;
  cg!.style.transform = small || k === 1 ? '' : `scale(${k})`;
  if (small) stage.style.fontSize = '';
}

function iconOf(it: { name: string; icon?: string; id?: string }): HTMLImageElement | null {
  const src = /src="([^"]+)"/.exec(itemPic(it))?.[1] ?? '';
  if (!src) return null;
  let im = icons.get(src) ?? null;
  if (!im) {
    im = new Image();
    im.src = src;
    icons.set(src, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}

// ── 시간 ──

function tick(): void {
  if (!stage || !feed) return;
  // 화면에서 빠졌으면 멈춘다 (보고 있을 때만 흐른다)
  if (!stage.isConnected || !stage.offsetParent) return stopPlayer();
  const f = feed;
  const t = now();
  if (!f.art || !f.show.loaded) return void drawNote(f, t);
  if (!run) run = freshRun(f.show.at);
  const r = run;
  // 돌고 있던 시간만 (수량 줄기용)
  const dt = tickAt ? t - tickAt : 0;
  tickAt = t;
  if (r.part >= f.show.parts.length) return void drawOff(f);
  const part = f.show.parts[r.part];
  const over = parseClipGroups(f.s.clipsText);
  const clips = (c: CueCut) => clipsOf(f.art!.pack.cuts[cutArt(c)], cutArt(c), over);
  const startCue = (i: number, own?: HsCue) => {
    if (!own) r.cue = i;
    r.cueAt = t;
    const c = own ?? part.cues[i];
    said = own ?? null;
    r.cueLen = cueMs(c, f.s);
    r.cut = f.s.fx.cut ? c.cut : 'B';
    if (c.ev === 'call' && f.s.fx.cut) r.cut = 'D';
    applyEvent(r, c, f, t);
    r.clip = moodClip(clips(r.cut), c.ev === 'look' ? 'stare' : moodName(c.mood, moodMap(f.art!.pack)), idle[cutArt(r.cut)]);
    r.frame = 0;
    r.frameAt = t;
    r.talking = true;
    if (f.s.fx.tear && c.ev !== 'tear' && Math.random() < f.s.fx.tearP) r.tearUntil = t + TEAR_MS[0] + Math.random() * (TEAR_MS[1] - TEAR_MS[0]);
    pushChat('진행자', c.text, 'host');
  };
  const startIdle = () => {
    r.clip = nextIdle(clips(r.cut), idle[cutArt(r.cut)], f.s.rules);
    r.frame = 0;
    r.frameAt = t;
    r.talking = false;
  };
  if (r.cue < 0) startCue(0);
  // 동작 한 장씩
  while (r.clip && t - r.frameAt >= f.s.frame) {
    r.frameAt += f.s.frame;
    r.frame++;
    if (r.frame >= r.clip.frames) {
      // 동작은 한 번만 (11-11 사용자: 기본은 대기 자세, 각 동작은 한 번씩 나오고 대기로 돌아온다. 무한 반복 금지)
      // 대사 시간이 남았으면 대기 동작으로 돌아가 기다린다. 대기 동작이 한 바퀴 끝나는 자리(처음·끝 장이 같은 자세)에서 다음 큐로
      if (r.talking && t - r.cueAt < r.cueLen) {
        r.clip = clips(r.cut).find((c) => c.group === 'base') ?? r.clip;
        r.frame = 0;
      }
      // 내 채팅에 대한 진행자 반응이 와 있으면 지금 대사가 끝난 자리에 끼운다 (큐시트 자리는 그대로)
      else if (extra.length) {
        extraChat.splice(0).forEach((c) => pushChat(c.nick, c.text, /^\?+$/.test(c.nick) ? 'q' : ''));
        startCue(r.cue, extra.shift());
      }
      else if (r.talking && r.cue + 1 < part.cues.length) startCue(r.cue + 1);
      else if (r.talking && r.cue < part.cues.length) {
        // 큐시트 끝: 쉬다가 다음 부로
        r.cue = part.cues.length;
        r.gapUntil = f.s.next > 0 ? t + f.s.next * 1000 : Infinity;
        r.flags.call = false;
        r.flags.look = false;
        if (f.s.fx.cut) r.cut = 'B';
        startIdle();
      } else if (t >= r.gapUntil && !holding) {
        const next = r.part + 1;
        run = freshRun(next);
        hooks.advance(next);
        return;
      } else startIdle();
    }
  }
  if (!r.clip) r.clip = clips(r.cut)[0] ?? null;
  // 상품 그림 묶음이 방송보다 늦게 오면, 온 때 바깥 화면(지금 방송 중 칸)도 한 번 다시 그린다
  if (!iconOf(part.item)) iconMiss = true;
  else if (iconMiss) {
    iconMiss = false;
    hooks.redraw();
  }
  // 전구
  if (t - r.bulbAt >= BULB_MS) {
    r.bulbAt = t;
    r.bulbStep++;
  }
  // 채팅 (응시 중에는 멈춘다)
  // 이 부의 채팅만 흐르고, 다 흐르면 되풀이하지 않는다 (11-12 사용자)
  const lines = f.show.parts[r.part]?.chat?.length ? f.show.parts[r.part].chat! : f.show.chat;
  if (r.chatIdx < lines.length && !r.flags.look && t - r.chatAt >= f.s.chatGap * 1000 * (0.6 + Math.random() * 0.8)) {
    r.chatAt = t;
    const line = lines[r.chatIdx];
    r.chatIdx++;
    pushChat(line.nick, line.text, /^\?+$/.test(line.nick) ? 'q' : '');
  }
  // 남은 수량 저절로 줄기 (큐시트가 도는 동안만. 끝 수 아래로는 안 내려가고, 매진은 큐시트의 「매진」만)
  const d = f.s.drop;
  if (d.on && !r.flags.sold && r.cue >= 0 && r.cue < part.cues.length) {
    const fast = r.flags.price || r.flags.rush;
    if (!r.dropN) {
      const plan = nextDrop(r.left, r.dropEnd, dropRest(part.cues, r.cue, r.cueLen - (t - r.cueAt), fast, f.s), d);
      if (plan) {
        r.dropN = plan.n;
        r.dropWait = plan.wait;
      }
    } else {
      r.dropWait -= dt * (fast ? d.fast : 1);
      if (r.dropWait <= 0) {
        r.left = Math.min(r.left, Math.max(1, r.dropEnd, r.left - r.dropN));
        r.dropN = 0;
      }
    }
  }
  // 매진 임박 딱지: 기준 수 이하가 되면 저절로
  if (d.on && d.soon > 0 && !r.flags.sold && r.left <= d.soon) r.flags.soon = true;
  // 지금 동작 이름 (시험·디버그용 표시, 화면에는 안 보인다)
  const tag = `${r.cut}:${r.clip?.name ?? ''}:${r.cue}`;
  if (stage.dataset.clip !== tag) stage.dataset.clip = tag;
  // 큐시트가 끝나 기다리는 중 (「다음 상품」 단추가 알려 준다)
  const waiting = r.cue >= part.cues.length && !extra.length ? '1' : '';
  if ((stage.dataset.wait ?? '') !== waiting) stage.dataset.wait = waiting;
  draw(f, r, t);
  drawCg(f, r, t);
}

function applyEvent(r: Run, c: HsCue, f: PlayerFeed, t: number): void {
  r.flags.call = c.ev === 'call';
  r.flags.look = c.ev === 'look';
  if (c.ev === 'price') r.flags.price = true;
  if (c.ev === 'rush') r.flags.rush = true;
  if (c.ev === 'soon') r.flags.soon = true;
  if (c.ev === 'left') r.left = Math.max(1, r.left - (c.n ?? 1));
  if (c.ev === 'sold') {
    r.left = 0;
    r.flags.sold = true;
  }
  if (c.ev === 'tear' && f.s.fx.tear) r.tearUntil = t + TEAR_MS[0] + Math.random() * (TEAR_MS[1] - TEAR_MS[0]);
}

function pushChat(nick: string, text: string, cls: string): void {
  shown.push({ nick, text });
  if (shown.length > KEEP_CHAT) shown.splice(0, shown.length - KEEP_CHAT);
  if (!chatLog) return;
  const p = document.createElement('p');
  if (cls) p.className = cls;
  p.innerHTML = `<span>${esc(nick)}</span>${esc(text)}`;
  const bottom = chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < 40;
  chatLog.appendChild(p);
  while (chatLog.childElementCount > KEEP_CHAT) chatLog.firstElementChild!.remove();
  if (bottom) chatLog.scrollTop = chatLog.scrollHeight;
}
/** 전화 주문이 들어갔을 때 남은 수량을 n 줄인다 (0으로는 안 간다. 저절로 줄기를 껐으면 안 줄인다) */
export function playerTake(n: number): void {
  if (!run || !feed?.s.drop.on || run.flags.sold) return;
  run.left = Math.max(1, run.left - n);
}
/** 내가 쓴 채팅 줄 (화면이 부른다) */
export const playerSay = (nick: string, text: string, cls = 'me'): void => pushChat(nick, text, cls);
/** 내 채팅에 대한 반응: 진행자 큐 몇 줄(지금 대사 뒤에 끼움)과 다른 시청자 줄 */
export function playerCut(cues: HsCue[], chat: { nick: string; text: string }[]): void {
  extra.push(...cues);
  extraChat.push(...chat);
  if (!cues.length) extraChat.splice(0).forEach((c) => pushChat(c.nick, c.text, ''));
}

// ── 그리기 ──

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const g = c.getContext('2d');
  if (g) g.imageSmoothingEnabled = false;
  return g;
}

/** 컷 A·B 한 장을 g 에 그린다 (글자 없음) */
function scene(g: CanvasRenderingContext2D, f: PlayerFeed, r: Run, id: CutId, clip: HsClip | null, frame: number): void {
  const pack = f.art!.pack;
  const a = pack.cuts[id];
  const img = (name: string | undefined) => (name ? f.art!.img.get(name) : undefined);
  const plate = img(a.plate);
  if (plate) g.drawImage(plate, 0, 0);
  // 전구: 차례로 하나씩 꺼졌다 켜진다. 꺼진 전구는 불 꺼진 판의 그 자리 점 그대로
  const off = img(a.off);
  if (off && a.bulbs && f.s.fx.bulb) {
    a.bulbs.forEach(([x, y, rad], i) => {
      if ((i + r.bulbStep) % BULB_EVERY) return;
      const d = rad * 2 + 4;
      g.drawImage(off, x - rad - 2, y - rad - 2, d, d, x - rad - 2, y - rad - 2, d, d);
    });
  }
  const sheet = clip ? img(clip.file) : undefined;
  const host = img(a.host);
  const rows = a.over !== undefined ? Math.max(0, Math.min(pack.box, a.over - a.y)) : pack.box;
  if (sheet && clip) g.drawImage(sheet, Math.min(frame, clip.frames - 1) * pack.box, 0, pack.box, rows, a.x, a.y, pack.box, rows);
  else if (host) g.drawImage(host, 0, 0, pack.box, rows, a.x, a.y, pack.box, rows);
  // 상품: 컷 A 진열대 회전판 위 (그림 그대로 1배)
  if (id === 'A') {
    const part = f.show.parts[r.part];
    const ic = part ? iconOf(part.item) : null;
    if (ic) g.drawImage(ic, Math.round(pack.w / 2 - ic.naturalWidth / 2), TABLE_Y - ic.naturalHeight);
  }
}
/** 컷 A 회전판 윗면 높이 (bg_plate_512x384_bright_ttsym 기준) */
const TABLE_Y = 302;

function draw(f: PlayerFeed, r: Run, t: number): void {
  const g = canvas && ctx2d(canvas);
  if (!g) return;
  const pack = f.art!.pack;
  const tearing = t < r.tearUntil;
  if (r.cut === 'C') {
    // 상품 클로즈업: 컷 A 를 따로 그려 회전판 둘레를 정수 2배로
    scratch ??= document.createElement('canvas');
    scratch.width = pack.w;
    scratch.height = pack.h;
    const sg = ctx2d(scratch);
    if (!sg) return;
    scene(sg, f, r, 'A', r.clip, r.frame);
    const sw = pack.w / 2;
    const sh = pack.h / 2;
    g.drawImage(scratch, Math.round(pack.w / 2 - sw / 2), Math.round(TABLE_Y - 30 - sh / 2), sw, sh, 0, 0, pack.w, pack.h);
  } else if (tearing) {
    // 신호 찢김: 방송이 꺼진 얼굴(컷 B 「입 크게 벌리기」 한가운데 장)이 잠깐 끼어든다
    const b = clipsOf(pack.cuts.B, 'B', {}).find((c) => c.name === 'gape') ?? r.clip;
    scene(g, f, r, 'B', b, b ? Math.floor(b.frames / 2) : 0);
    // 가로 줄 몇 개를 옆으로 민다 (그림의 점을 옮길 뿐, 칠하지 않는다)
    for (let i = 0; i < 6; i++) {
      const y = Math.floor(Math.random() * pack.h);
      const hgt = 4 + Math.floor(Math.random() * 18);
      const dx = Math.floor((Math.random() - 0.5) * 60);
      g.drawImage(canvas!, 0, y, pack.w, hgt, dx, y, pack.w, hgt);
    }
  } else scene(g, f, r, cutArt(r.cut), r.clip, r.frame);
}

/** 그림·편성이 아직 없을 때: 신호 없음 (컬러바 + 글) */
function drawNote(f: PlayerFeed, t: number): void {
  const g = canvas && ctx2d(canvas);
  if (!g || !canvas) return;
  const w = canvas.width;
  const h = canvas.height;
  const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
  bars.forEach((c, i) => {
    g.fillStyle = c;
    g.fillRect(Math.floor((i * w) / bars.length), 0, Math.ceil(w / bars.length), h);
  });
  g.fillStyle = '#0b0513';
  g.fillRect(0, Math.floor(h * 0.68), w, Math.ceil(h * 0.32));
  // 지직
  for (let i = 0; i < 40; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.25)';
    g.fillRect(0, Math.floor(Math.random() * h), w, 1);
  }
  void t;
  if (cg) {
    const html = `<div class="hs-note"><b>${esc(f.note || '신호 없음')}</b></div>`;
    if (cg.dataset.h !== html) {
      cg.dataset.h = html;
      cg.innerHTML = html;
    }
  }
}

/** 방송 끝: 불 꺼진 스튜디오 */
function drawOff(f: PlayerFeed): void {
  const g = canvas && ctx2d(canvas);
  const off = f.art?.img.get(f.art.pack.cuts.A.off ?? '');
  if (g && off) g.drawImage(off, 0, 0);
  if (cg) {
    const html = `<div class="hs-note"><b>오늘 방송은 끝났습니다</b></div>`;
    if (cg.dataset.h !== html) {
      cg.dataset.h = html;
      cg.innerHTML = html;
    }
  }
}

/** 방송 그래픽 (HTML). 바뀐 때만 다시 쓴다. 자막은 글자 수만 늘린다 */
function drawCg(f: PlayerFeed, r: Run, t: number): void {
  if (!cg) return;
  const part = f.show.parts[r.part];
  if (!part) return;
  const it = part.item;
  const cue = said && r.talking ? said : r.talking && r.cue >= 0 && r.cue < part.cues.length ? part.cues[r.cue] : null;
  const n = installments(it);
  const pay = it.pay || (it.price > 0 ? `${it.price.toLocaleString('en-US')}원` : '');
  const art = cutArt(r.cut);
  const board = r.flags.price && r.cut !== 'C' && r.cut !== 'D'
    ? `<div class="hs-board hs-b${art}">${n ? `<span><span class="sm">무이자 </span><span class="big">${n}회</span></span>` : `<span class="big">${esc(pay)}</span>`}<span class="sm">오늘 방송에서만</span></div>` : '';
  const tag = r.flags.sold ? '매진' : r.flags.rush ? CUE_EVENT_WORD.rush : '';
  const key = [r.part, r.cut, r.flags.price, r.flags.soon, r.flags.sold, r.flags.rush, r.flags.call, r.left, f.tel, stage?.classList.contains('sm')].join('|');
  if (cg.dataset.h !== key) {
    cg.dataset.h = key;
    cg.innerHTML = `<div class="hs-lg"><b>망상홈쇼핑</b><i>${r.part + 1}부</i></div>
<div class="hs-live">LIVE</div>
${r.flags.soon && !r.flags.sold ? '<div class="hs-soon">매진 임박</div>' : ''}
${r.flags.sold ? '<div class="hs-soon sold">매진</div>' : `<div class="hs-left">남은 수량 ${r.left}</div>`}
${board}
${r.flags.call ? '<div class="hs-call">☎ 전화 연결 중</div>' : ''}
<div class="hs-band hs-k${r.cut}${tag ? ' hs-t' : ''}">
<div class="hs-sub"></div>
<div class="hs-l3"><div class="nm">${tag ? `<span class="tag">${esc(tag)}</span>` : ''}<div class="n">${esc(it.name)}</div><div class="p2">${n ? `무이자 할부 <span class="p">${n}회</span>` : esc(pay)}</div></div><div class="ph"><small>☎ 전화 주문</small><b>${esc(f.tel)}</b></div></div>
</div>`;
  }
  const sub = cg.querySelector<HTMLElement>('.hs-sub');
  if (sub) {
    const chars = cue ? Array.from(cue.text) : [];
    const shown = cue ? chars.slice(0, Math.max(0, Math.floor(((t - r.cueAt) / 1000) * f.s.speed))).join('') : '';
    if (sub.textContent !== shown) sub.textContent = shown;
    sub.classList.toggle('on', !!shown);
  }
}

/** 시험·디버그: 지금 재생 자리 */
/** 내 채팅의 반응을 기다리는 동안에는 저절로 다음 부로 넘어가지 않는다 */
let holding = false;
export const playerHold = (on: boolean): void => { holding = on; };
/** 방금까지 흐른 채팅 n줄 */
export const playerRecentChat = (n: number): { nick: string; text: string }[] => shown.slice(-n);
export const playerState = () => (run ? { part: run.part, cue: run.cue, cut: run.cut, clip: run.clip?.name ?? '', left: run.left, flags: { ...run.flags } } : null);
