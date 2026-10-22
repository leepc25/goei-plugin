// 게임 코드 팩 진입점 (빌드: dist/game/goei-game.js → release/game/goei-game.N.txt). 본체와 따로 받아 실행되며
// globalThis.__goeiGame을 남긴다(src/host/game/code.ts). 본체의 모듈과 상태를 나누지 않으므로 응답 대기 등은 다리로 받는다.
import type { GameModule } from './bridge';
import { mountPlay } from './play';
import { mountLegacy } from './legacy';

declare const __PLUGIN_VERSION__: string;

// Risu 플러그인 iframe은 allow-same-origin이 없어 localStorage를 읽기만 해도 SecurityError가 난다.
// 게임 모듈 곳곳이 localStorage를 바로 쓰므로, 막혀 있으면 창이 열려 있는 동안만 쓰는 메모리 저장소로 대신한다.
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(String(k)) ?? null,
    setItem: (k, v) => void m.set(String(k), String(v)),
    removeItem: (k) => void m.delete(String(k)),
    clear: () => m.clear(),
  };
}
try {
  void globalThis.localStorage?.length;
} catch {
  for (const name of ['localStorage', 'sessionStorage']) {
    try { Object.defineProperty(globalThis, name, { value: memoryStorage(), configurable: true }); } catch { /* 못 바꾸면 그대로 */ }
  }
}

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
