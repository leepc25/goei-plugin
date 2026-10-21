// 게임 코드 팩 진입점 (빌드: dist/game/goei-game.js → release/game/goei-game.N.txt). 본체와 따로 받아 실행되며
// globalThis.__goeiGame을 남긴다(src/host/game/code.ts). 본체의 모듈과 상태를 나누지 않으므로 응답 대기 등은 다리로 받는다.
import type { GameModule } from './bridge';
import { mountPlay } from './play';
import { mountLegacy } from './legacy';

declare const __PLUGIN_VERSION__: string;

const mod: GameModule = {
  version: __PLUGIN_VERSION__,
  mount: (box, bridge) => mountPlay(box, bridge),
  // 이전 시험판: 저장 키와 그림 팩은 예전 그대로 (goei:game · goei:game-action:v1)
  legacy: {
    patrol: (box, bridge) => mountLegacy(box, bridge, 'patrol'),
    action: (box, bridge) => mountLegacy(box, bridge, 'action'),
  },
};

(globalThis as unknown as { __goeiGame?: GameModule }).__goeiGame = mod;
