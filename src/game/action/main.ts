// 게임 진입점. 플러그인(코드 팩)과 시연판이 모두 이것 하나를 부른다: mountGame(box, bridge) → 정리 함수.
import type { GameBridge } from '../bridge';
import { loadArt } from './engine/art';
import { Game } from './engine/game';
import { engineModules } from './engine/modules';
import { mountTouch } from './engine/touch';

const CSS = `
.goei-engine{position:relative;width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}
.goei-engine-canvas{display:block;max-width:100%;max-height:100%;aspect-ratio:16/9;width:100%;height:auto;image-rendering:pixelated;touch-action:none}
.goei-engine-stage{position:relative;width:min(100%, calc(100dvh * 16 / 9));aspect-ratio:16/9;max-height:100%}
.goei-engine-hq{position:absolute;inset:0;overflow:auto}
.goei-engine-loading{color:#8e9aa1;font:16px sans-serif}
`;

export function mountGame(box: HTMLElement, bridge?: Partial<GameBridge>): () => void {
  const st = document.createElement('style');
  st.textContent = CSS;
  const root = document.createElement('div');
  root.className = 'goei-engine';
  const stage = document.createElement('div');
  stage.className = 'goei-engine-stage';
  stage.innerHTML = '<div class="goei-engine-loading">불러오는 중…</div>';
  root.appendChild(stage);
  box.append(st, root);
  let game: Game | null = null;
  let offTouch: (() => void) | null = null;
  let dead = false;
  const urlOf = bridge?.assets ? (f: string) => bridge.assets!.url('jyaldi', f) : undefined;
  void loadArt(urlOf).then((art) => {
    if (dead) return;
    stage.innerHTML = '';
    game = new Game(stage, art, engineModules());
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (coarse || /[?&]touch=1/.test(location.search)) offTouch = mountTouch(stage, game.input);
    game.start();
    (globalThis as { __goeiEngine?: Game }).__goeiEngine = game;
  });
  return () => {
    dead = true;
    offTouch?.();
    game?.destroy();
    root.remove();
    st.remove();
  };
}
