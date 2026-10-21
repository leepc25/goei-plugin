// 단독 시연판 (release/demo/goei-action-game.html). 그림은 빌드가 window.__GOEI_ENGINE_ART__로 내장한다.
import { mountGame } from '../main';

const box = document.getElementById('box')!;
mountGame(box);
