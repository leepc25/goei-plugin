# 게임 코드 (필드)

플러그인 본체와 따로 받는 게임 코드 팩이다 (빌드: `dist/game/goei-game.js`).

- `entry.ts`: 코드 팩 진입점. `globalThis.__goeiGame = { version, mount }`를 남긴다.
- `play.ts`: `mountPlay(box, bridge)` → 통합 엔진(`action/main.ts`의 `mountGame`).
- `bridge.ts`: 게임 ↔ 플러그인 다리 타입. 플러그인 쪽 구현은 `src/host/game/`.
- `action/`: 엔진·본부·적·이야기·화면 등 게임 본체.

옛 「이전 시험판」(관리국 순찰 · 1인 전투 검증판)은 2026-10-26에 지웠다.
