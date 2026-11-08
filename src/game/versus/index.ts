// 대전 (11-08 사용자 「기다리는 동안 대전」): 고르기 창 → VS 화면(고른 인물만 받기) → 경기 → 끝나면 고르기 창(직전 쌍에 커서).
// 시험판(fighter/waitfight.ts)과 플러그인이 같이 쓴다. 자료는 대전 공용 팩 vs-common + 인물 팩 vs-<번호> (tools/build_vs_packs.py).
import { mountGame } from '../action/main';
import { prepareCharPacks, loadChar, charArt, commonUrl, CHAR_K } from '../action/art/charPacks';
import { playerFactory } from '../action/engine/player';
import { FighterPlayer } from '../action/fighter/player';
import { view } from '../action/engine/view';
import { versus, newMatch, fighterOf } from '../action/engine/versus';
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

/** 대전 배경 (11-08 사용자): 필드 장면 그림을 사람 크기에 맞춰(장면 dotK) 무대 1280 에 깐다. 발 줄(700)이 장면 앞줄에 오게 */
interface BgMeta { w: number; h: number; dotK: number; lane: [number, number]; cut?: number; objs?: { file: string; x: number; y: number; w: number; h: number; front: boolean }[] }
let bgMeta: Promise<Record<string, BgMeta> | null> | null = null;
async function loadBg(id: string | undefined): Promise<typeof view.vsBg> {
  if (!id) return null;
  bgMeta ??= commonUrl('bg.json').then((u) => (u ? fetch(u).then((r) => r.json() as Promise<Record<string, BgMeta>>) : null)).catch(() => null);
  const m = (await bgMeta)?.[id];
  const u = m && (await commonUrl(`bg-${id}.webp`));
  if (!m || !u) return null;
  const pic = async (url: string) => { const im = new Image(); im.src = url; await im.decode(); return im; };
  let img: HTMLImageElement;
  try { img = await pic(u); } catch { return null; }
  const LINE = 700, pick = m.lane[1];
  // 사람과 같은 도트 크기, 단 무대 폭(1280)·위쪽 끝(0)까지는 덮게
  const s = Math.max(CHAR_K / m.dotK, 1280 / m.w, LINE / pick);
  const w = m.w * s, h = m.h * s;
  let y = LINE - pick * s;
  if (y + h < 720) y = 720 - h;
  // 무대 1280 (2화면) 에 장면의 한 구간(cut 가운데)을 놓는다. 그림 끝이 무대 안으로 들어오지 않게
  const x = Math.min(0, Math.max(1280 - w, 640 - (m.cut ?? m.w / 2) * s));
  const objs = (await Promise.all((m.objs ?? []).map(async (o) => {
    const ou = await commonUrl(`bgo-${o.file}.webp`);
    const im = ou ? await pic(ou).catch(() => null) : null;
    return im ? { img: im, x: x + o.x * s, y: y + o.y * s, w: o.w * s, h: o.h * s, front: o.front } : null;
  }))).filter((o): o is NonNullable<typeof o> => !!o);
  return { img, x, y, w, h, objs };
}

export function startVersus(box: HTMLElement, assets: GameAssets, opts: { onClose?: () => void; bg?: () => string | undefined } = {}): VersusHandle {
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
    if (dead) return;
    if (!game) {
      unmount = mountGame(box, { assets } as never, {
        charPacks: true,
        hero: fighterOf(0),
        onReady: (g) => {
          game = g;
          playerFactory.make = (clips) => new FighterPlayer(clips, charArt(fighterOf(0))!);
          g.start_new('versus');
        },
      });
    } else {
      playerFactory.make = (clips) => new FighterPlayer(clips, charArt(fighterOf(0))!);
      game.start_new('versus');
    }
  };

  versus.onMatchEnd = () => select();
  void packs.ready.then(() => { if (!dead) select(); });

  return {
    pause: () => { versus.hold = true; box.style.visibility = 'hidden'; vsSoundPause(true); },
    resume: () => { box.style.visibility = ''; vsSoundPause(false); if (!sel && game) versus.hold = false; },
    destroy: () => {
      dead = true;
      sel?.close();
      unmount?.();
      packs.dispose();
      audio.dispose();
      vsBgm(false);
      versus.onMatchEnd = null;
    },
  };
}
