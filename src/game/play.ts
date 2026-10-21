// 플러그인 창에서 돌릴 게임 = 통합 엔진 (게임 전투와 조작 스레드의 src/game/action/main.ts). 시연판 goei-action-game.html과 같은 코드다.
import type { GameBridge } from './bridge';
import { mountGame } from './action/main';

export const mountPlay = (box: HTMLElement, bridge: GameBridge): (() => void) => mountGame(box, bridge);
