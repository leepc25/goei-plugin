---
name: goei-game-items-module
description: 게임 아이템·무기 모듈(src/game/action/items/) 위치·규칙·시험판 — 아이템·탄·임시 무기·상인 작업 전에 읽기
metadata:
  type: project
  modified: 2026-10-21T15:15:20.309Z
---
2026-10-21 thread 「아이템과 무기」 built src/game/action/items/ on branch claude/project-thread-uxc8l7 (not merged to main; engine thread 「게임 전투와 조작」 integrates via engine/modules.ts).
- Decisions applied: temp weapons only two bundles (one-hand melee = clip `pipe`, gun = clip `shotgun`), one held at a time, signature weapon never swaps; signature ammo limited (쟈알디 8+16, 에일린 24+72, 데드폴 15+45), auto reload, pity +25% ammo drop when out; no-ammo agents get cash instead of ammo drops.
- Consumables in slots 1–4, bag 6 for 회수물; HQ thread reads run.cash/shards/bag/debt for settlement and draws Esc bag with drawItemIcon.
- Vendors: 마덕희, 고연지·윤지아, 신유리(debt), 무엇이든 자판기.
- Demo: release/demo/goei-items-demo.html built by `node src/game/action/items/build-demo.mjs` (not scripts/build.mjs, engine thread owns that). Tests tests/items.test.mjs (18).
- 2026-10-21 engine wired items into main (7408993): E→interact, A→attack, S→shoot for temp guns; per-floor props/weapon placed temporarily in engine itemsLink.ts. Held items drawn from drawItemIcon with grip at bottom quarter; when real weapon/prop pixel art is made, each image needs `grip: [x, y]` (image px), format in docs/게임_모듈_연결.md 2-1.
- 2026-10-21 later: items wired into the ONE integrated game (main 00b20e7): engine/itemsLink.ts (items thread may edit it, engine thread approved) uses spawnEnemyDrops (custom 'enemyDrop'), strikeProps (player frame hits), furnishFloor, shop panel (items/shopPanel.ts, DOM over stage root, itemsBlocking pauses). Binding rules: docs/게임_통합_규격.md (지휘자 thread 「게임 통합 검수」): no standalone demos/HUD/input; report progress to 지휘자 + 「게임 전투와 조작」 via message_thread, never post demo links to the user. goei-items-demo.html is dev-only.
See [[goei-observation-game]].
