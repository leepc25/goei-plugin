# 관리국 층 배경 팩 (2026-10-25)

- `lobby·f2·f3·b1·b2·b3.webp`: `game-src/art/field/hq/`의 확정 배경 6장(WebP 품질 85) 그대로 복사.
- `desk.webp`: `game-src/art/field/objects/lobby/desk.webp`(무손실). `tools/cut_lobby_desk.py`로 로비 배경에서 오림.
- 좌표(문·등·창·오브젝트)는 `src/game/action/hq/painted.ts`, 그리기는 `src/game/action/art/hqField.ts`.
- 사용자 시각 승인 전.
