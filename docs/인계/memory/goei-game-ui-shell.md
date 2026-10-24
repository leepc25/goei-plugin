---
name: goei-game-ui-shell
description: Game UI shell (src/game/action/ui/) — HUD, touch stick/buttons, gamepad, menus, screen fx, title bg; merged to main; read before touching game HUD/controls
metadata:
  type: project
  modified: 2026-10-21T15:51:23.438Z
---
Built 2026-10-21 in thread 화면 표시와 터치 조작 (branch claude/project-thread-afckf1); merged to main (4ca2591). The engine thread (게임 전투와 조작) wires it in src/game/action/engine/modules.ts; conductor 게임 통합 검수 owns docs/게임_통합_규격.md and is the only one to post links to the user.
- mountGameShell(box, opts) bundles stage (1280×720 contain fit; fill mode exists but OFF because engine SCREEN_W is fixed), InputHub (touch/pad press same KeyboardEvent.code; synth:true re-dispatches to window), TouchPad, PadReader, Hud, Fx (onGameEvent: hit y is foot depth, screen y = y − z), Menu. Esc owned by shell (pause). Extra keys: R reload, H hitbox view.
- Upright coarse-pointer phones auto-rotate the root 90° (no prompt); convert pointers via shell.stage.toGame / toLocal. Risu bridge may pass its own toLocal.
- Landscape touch layout = layoutSide: buttons in the 75px side bars, floor centre empty, semi-transparent (touchAlpha 0.55). One layout in every scene.
- Title: drawTitleBg(c,t) in ui/title.ts draws dot el_hall art (window.__GOEI_BG_ART__) + pixel logo; HTML menu sits in the open door, arcade style (▶ blink, 「무료 플레이」). No English PRESS START (Korean-only rule).
- HUD (conductor review 2026-10-21, main 8597630): arcade style = top-left face + thick HP + super gauge + ammo only; money/favor/rules NOT on screen (pause menu statusHtml + change toasts); items icon-only (setHudItemIcon(drawItemIcon) + items[].id from engine). Don't bring back web-panel HUD.
- Dot kit (main 69d6b0f): tools/ui_pixelize.py turns GPT raw (game-src/art/ui/raw) into dot pieces + kit.gen.ts (data URLs, Galmuri11 Bold OFL font 'GoeiPixel'). ui/kit.ts: ensureKit(), classes .gk-panel/.gk-btn(.on/.f)/.gk-face/.gk-slot/.gk-font; HQ dialogs reuse it. Pixel font only crisp at 11px multiples (HUD pfont snaps). HUD face swaps 4 expressions (agentFaces).
- Phone landscape: ALL 16 touch buttons inside the side bars (right 8, left 8), resting stick hidden (.tp-float).
- 2026-10-22: user moved ALL game fixes to one thread 「게임 마무리 한 곳에서」; this thread stopped at main 7c9ed04. Pending GPT art for UI: docs/GPT요청_터치버튼.md (touch buttons, quickslot icons, keycaps) not yet wired. 「GO →」 is now pixel 「전진 ▶」 (drawGoSign).
- One HUD only: other threads' HudState field requests get drawn through drawHud, never their own HUD.
- Do not edit scripts/build.mjs (engine thread). Our build is scripts/build-ui.mjs; asked engine to call build-ui.mjs + build-enemy.mjs from build.mjs (missing dist-test files caused ERR_MODULE_NOT_FOUND).
- Tests: tests/ui-input.test.mjs, tests/ui-browser.mjs. Unverified: real phone, real gamepad, inside Risu.
Related: [[goei-observation-game]], [[goei-reply-language]]
