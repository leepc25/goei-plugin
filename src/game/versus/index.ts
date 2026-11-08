// 대전 (11-08 사용자 「기다리는 동안 대전」): 고르기 창 → VS 화면(고른 인물만 받기) → 경기 → 끝나면 고르기 창(직전 쌍에 커서).
// 시험판(fighter/waitfight.ts)과 플러그인이 같이 쓴다. 자료는 대전 공용 팩 vs-common + 인물 팩 vs-<번호> (tools/build_vs_packs.py).
import { mountGame } from '../action/main';
import { prepareCharPacks, loadChar, charArt, charRoster } from '../action/art/charPacks';
import { playerFactory } from '../action/engine/player';
import { FighterPlayer } from '../action/fighter/player';
import { view } from '../action/engine/view';
import { versus, newMatch, fighterOf } from '../action/engine/versus';
import type { Game } from '../action/engine/game';
import type { GameAssets } from '../bridge';
import { openSelect, showVs, type SelectResult } from './select';

export interface VersusHandle {
  /** 멈추고 숨기기 (다음에 resume 하면 이어서) */
  pause(): void;
  resume(): void;
  destroy(): void;
}

export function startVersus(box: HTMLElement, assets: GameAssets, opts: { onClose?: () => void } = {}): VersusHandle {
  view.clear = true;
  const packs = prepareCharPacks(assets, 'vs-common');
  let game: Game | null = null;
  let unmount: (() => void) | null = null;
  let sel: { close(): void } | null = null;
  let last: SelectResult | null = null;
  let dead = false;
  /** 서바이벌 다음 상대: 미리 받아 둔다 (판이 끝나고 2.5초 안에 나와야 하므로) */
  let queued: string | null = null;
  const all = () => charRoster().map((r) => r.name);
  const queueFoe = () => {
    const names = all().filter((n) => n !== fighterOf(0) && n !== fighterOf(1));
    queued = names[Math.floor(Math.random() * names.length)] ?? null;
    if (queued) void loadChar(queued);
  };
  versus.nextFoe = () => {
    const n = queued && charArt(queued) ? queued : fighterOf(1);
    queueFoe();
    return n;
  };

  /** 고르기·VS 화면 동안 경기 그림은 숨긴다 (뒤에 멈춘 인물이 비치지 않게) */
  const showGame = (on: boolean) => { const g = box.querySelector<HTMLElement>('.goei-engine'); if (g) g.style.visibility = on ? '' : 'hidden'; };
  const select = () => {
    versus.hold = true;
    showGame(false);
    sel = openSelect(box, {
      last,
      onPick: (r) => { sel = null; void play(r); },
      onClose: () => { sel = null; opts.onClose?.(); },
    });
  };

  const play = async (r: SelectResult) => {
    last = r;
    const foe = r.mode === 'survival' ? [all().filter((n) => n !== r.me[0])[Math.floor(Math.random() * (all().length - 1))]] : r.foe;
    await showVs(box, r, () => Promise.all([...r.me, ...foe].map((n) => loadChar(n))));
    if (dead) return;
    newMatch(r.mode, r.me, foe);
    showGame(true);
    if (r.mode === 'survival') queueFoe();
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
    pause: () => { versus.hold = true; box.style.visibility = 'hidden'; },
    resume: () => { box.style.visibility = ''; if (!sel && game) versus.hold = false; },
    destroy: () => {
      dead = true;
      sel?.close();
      unmount?.();
      packs.dispose();
      versus.onMatchEnd = null;
      versus.nextFoe = null;
    },
  };
}
