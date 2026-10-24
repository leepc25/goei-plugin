---
name: goei-action-engine
description: Action game engine (src/game/action) integration facts as of 2026-10-21: entry, modules wiring, demo link, known gaps
metadata:
  type: project
  modified: 2026-10-21T15:07:08.757Z
---
Engine lives in src/game/action/engine (contract.ts, player/world/render/game/modules.ts); entry mountGame(box, bridge) in src/game/action/main.ts. Wiring doc: docs/게임_모듈_연결.md. Demo: release/demo/goei-action-game.html (built by npm run build, test tests/engine-browser.mjs).

modules.ts joins ui shell, audio, hq, items (itemsLink.ts), stage (createElevatorStage = main 출동), enemy (createEnemy; unknown kinds fall back to Thug with console warn), story (mountStory; say('board') on each new floor, isBlocking pauses combat, flags in localStorage goei-game-story).

Gotchas: story CSS prefix renamed gs → gst (2026-10-21) because ui shell also uses .gs and the story's pointer-events:none broke HQ clicks. Knockback side is decided in World.applyHit from attacker/target x, not attacker facing.

Held objects (user rule 2026-10-21): character clips never include the carried object; engine draws it separately. Format: final/hands.json per-frame [x,y,deg] → frames.json `hand`; props drawn over head, weapons at hand (docs/게임_모듈_연결.md 2-1). E pick/lift/drop, A throw/swing, S temp gun wired via itemsLink.ts.

Integration (2026-10-21): one game only = release/demo/goei-action-game.html; status doc docs/게임_통합_현황.md (this thread maintains), binding spec docs/게임_통합_규격.md (owned by thread 「게임 통합 검수」, which alone posts demo links to the user). HQ is an engine belt scene (engine/hub.ts) + hq DOM menu (walk:false). ?start= tags for module demos. Full-loop test tests/game-loop.mjs. Project-wide limit: 60 inter-thread messages/hour.

Not done yet: grab-mash escape, most enemy debuffs, real enemy art (graybox). See [[goei-observation-game]].
