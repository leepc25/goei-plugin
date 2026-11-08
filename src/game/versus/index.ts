// 대전 (11-08 사용자 「기다리는 동안 대전」): 고르기 창 → VS 화면(고른 인물만 받기) → 경기 → 끝나면 고르기 창(직전 쌍에 커서).
// 시험판(fighter/waitfight.ts)과 플러그인이 같이 쓴다. 자료는 대전 공용 팩 vs-common + 인물 팩 vs-<번호> (tools/build_vs_packs.py).
import { mountGame } from '../action/main';
import { prepareCharPacks, loadChar, charArt, commonUrl } from '../action/art/charPacks';
import { playerFactory } from '../action/engine/player';
import { FighterPlayer } from '../action/fighter/player';
import { view } from '../action/engine/view';
import { useVersusKeys } from '../action/engine/input';
import { versus, newMatch, fighterOf, VS_RAISE, VS_LEN } from '../action/engine/versus';
import { resetSurvival } from '../action/engine/survival';
import type { Game } from '../action/engine/game';
import type { GameAssets } from '../bridge';
import { createGameAudio } from '../action/audio';
import { vsVoice } from './voice';
import { vsBgm, vsSoundPause, vsSoundWarm } from './sound';
import { openSelect, showVs, type SelectResult, type VsSfx } from './select';

export interface VersusHandle {
  /** 멈추고 숨기기 (다음에 resume 하면 이어서) */
  pause(): void;
  resume(): void;
  destroy(): void;
}

/** 대전 배경 (11-08 사용자): 필드 장면 그림을 사람 크기에 맞춰 깐다. 장면의 싸우는 줄(yF)이 발 줄(VS_LINE 700)에 오고, 무대 길이(len)만큼 한 구간(cut 가운데)을 쓴다 */
interface BgMeta {
  w: number; h: number; s: number; yF: number; len: number; cut: number;
  bench: { spots: { x: number; dy: number; k: number }[][] };
  objs?: { file: string; x: number; y: number; w: number; h: number; front: boolean }[];
}
let bgMeta: Promise<Record<string, BgMeta> | null> | null = null;
/** 화면 아래 끝(월드 y): engine/game.ts 대전 cropY 와 같게 (발 줄을 화면 아래에서 띄운 만큼) */
const VIEW_BOTTOM = 720 + VS_RAISE;
async function loadBg(id: string | undefined): Promise<typeof view.vsBg> {
  if (!id) return null;
  bgMeta ??= commonUrl('bg.json').then((u) => (u ? fetch(u).then((r) => r.json() as Promise<Record<string, BgMeta>>) : null)).catch(() => null);
  const m = (await bgMeta)?.[id];
  const u = m && (await commonUrl(`bg-${id}.webp`));
  if (!m || !u || !m.s) return null;
  const pic = async (url: string) => { const im = new Image(); im.src = url; await im.decode(); return im; };
  let src: HTMLImageElement;
  try { src = await pic(u); } catch { return null; }
  const s = m.s, LINE = 700, len = m.len;
  const w = m.w * s;
  const y = LINE - m.yF * s;
  // 그림 아래 끝이 화면 아래까지 안 닿으면 맨 아래 바닥 줄을 늘여 채운다 (싸우는 줄을 올려서 생긴 빈 곳)
  let img: CanvasImageSource = src, h = m.h * s;
  if (y + h < VIEW_BOTTOM) {
    const add = Math.ceil((VIEW_BOTTOM - y - h) / s) + 2;
    const cv = document.createElement('canvas');
    cv.width = m.w; cv.height = m.h + add;
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0);
    // 발 줄 아래 바닥 아래쪽 절반을 세로로 늘여 아래 빈 곳까지 (맨 끝 줄만 늘이면 어두운 띠가 생긴다)
    const y0 = Math.min(m.h - 4, Math.round((m.yF + m.h) / 2));
    g.drawImage(src, 0, y0, m.w, m.h - y0, 0, y0, m.w, m.h - y0 + add);
    img = cv; h = cv.height * s;
  }
  // 무대(0~len)에 장면 구간을 놓는다. 그림 끝이 무대 안으로 들어오지 않게
  const x = Math.min(0, Math.max(len - w, len / 2 - m.cut * s));
  const objs = (await Promise.all((m.objs ?? []).map(async (o) => {
    const ou = await commonUrl(`bgo-${o.file}.webp`);
    const im = ou ? await pic(ou).catch(() => null) : null;
    return im ? { img: im, x: x + o.x * s, y: y + o.y * s, w: o.w * s, h: o.h * s, front: o.front } : null;
  }))).filter((o): o is NonNullable<typeof o> => !!o);
  return { img, x, y, w, h, objs, len, bench: m.bench };
}

export function startVersus(box: HTMLElement, assets: GameAssets, opts: { onClose?: () => void; bg?: () => string | undefined; wide?: () => boolean } = {}): VersusHandle {
  view.clear = true;
  const packs = prepareCharPacks(assets, 'vs-common');
  let game: Game | null = null;
  let unmount: (() => void) | null = null;
  let sel: { close(): void } | null = null;
  let last: SelectResult | null = null;
  let dead = false;
  // 고르기·VS 화면 소리 (경기 소리는 엔진이 따로). 음량 설정은 엔진과 같은 저장 키를 읽기만 한다
  const audio = createGameAudio({ load: () => { try { return localStorage.getItem('goei-game-audio'); } catch { return null; } } });
  const SFX = { move: 'uiMove', ok: 'uiOk', back: 'uiBack', vs: 'superStart', start: 'superHit' } as const;
  const sfx: VsSfx = (id) => { try { audio.play(SFX[id]); } catch { /* 소리 없음 */ } };
  /** 고르기·VS 화면 동안 경기 그림은 숨긴다 (뒤에 멈춘 인물이 비치지 않게) */
  const showGame = (on: boolean) => { const g = box.querySelector<HTMLElement>('.goei-engine'); if (g) g.style.visibility = on ? '' : 'hidden'; };
  const select = () => {
    versus.hold = true;
    showGame(false);
    vsBgm(false);
    vsVoice('choose');
    sel = openSelect(box, {
      last,
      sfx,
      onPick: (r) => { sel = null; void play(r); },
      onClose: () => { sel = null; opts.onClose?.(); },
    });
  };

  const play = async (r: SelectResult) => {
    last = r;
    // 서바이벌 상대는 웨이브가 낸다 (engine/survival.ts)
    const foe = r.mode === 'survival' ? [] : r.foe;
    await showVs(box, r, () => Promise.all([...r.me, ...foe].map((n) => loadChar(n))), sfx);
    if (dead) return;
    newMatch(r.mode, r.me, foe);
    resetSurvival();
    showGame(true);
    vsSoundWarm();
    vsBgm(true);
    view.vsBg = await loadBg(opts.bg?.());
    view.vsLen = view.vsBg?.len ?? VS_LEN;
    view.vsWide = opts.wide?.() ?? false;
    view.relayout?.();
    if (dead) return;
    if (!game) {
      unmount = mountGame(box, { assets } as never, {
        charPacks: true,
        hero: fighterOf(0),
        onReady: (g) => {
          game = g;
          useVersusKeys();
          playerFactory.make = (clips) => new FighterPlayer(clips, charArt(fighterOf(0))!);
          g.start_new('versus');
        },
      });
    } else {
      playerFactory.make = (clips) => new FighterPlayer(clips, charArt(fighterOf(0))!);
      game.start_new('versus');
    }
  };

  // 창이 너무 작으면(모바일 크기, 11-08 사용자) 아예 숨기고 멈춘다. 다시 커지면 이어서
  let tiny = false, paused = false;
  const show = () => { box.style.visibility = tiny || paused ? 'hidden' : ''; };
  const ro = new ResizeObserver(() => {
    const t = box.clientWidth < 640 || box.clientHeight < 480;
    if (t === tiny) return;
    tiny = t;
    show();
    if (t) versus.hold = true;
    else if (!paused && !sel && game) versus.hold = false;
  });
  ro.observe(box);

  versus.onMatchEnd = () => select();
  void packs.ready.then(() => { if (!dead) select(); });

  return {
    pause: () => { paused = true; versus.hold = true; show(); vsSoundPause(true); },
    resume: () => { paused = false; show(); vsSoundPause(false); if (!sel && game && !tiny) versus.hold = false; },
    destroy: () => {
      dead = true;
      ro.disconnect();
      sel?.close();
      unmount?.();
      packs.dispose();
      audio.dispose();
      vsBgm(false);
      versus.onMatchEnd = null;
    },
  };
}
