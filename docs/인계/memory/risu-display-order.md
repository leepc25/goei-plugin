---
name: risu-display-order
description: Risu processScriptFull order — plugin display handlers run BEFORE CBS parse and card/module regex, so a plugin can emit {{raw::asset}}
metadata:
  type: reference
---
Checked RisuAI main src/ts/process/scripts.ts (2026-10-22): processScriptFull = Lua edit trigger → (editdisplay) display trigger → pluginV2[mode] handlers → risuChatParser (CBS) → preset/char/module regex. Plugin display handler gets text only (no chat index).
Use: image-tag replacement (card regex 🖼️에셋줄바꿈/에셋출력/에셋리퀘제거, module asset list ANOM2) can move into the plugin by emitting `{{raw::name}}` and checking existence with host/assets.ts module index. User asked 2026-10-22 (thread 이미지 태그 치환 플러그인화); answered possible, not implemented yet. See [[risu-plugin-pitfalls]].
Implemented 2026-10-22 on branch claude/project-thread-x36we7 (9551811, unreleased): src/core/imgtag.ts (render + imgCss), prefs imgSize (30–200%, def 100 = 32em) / imgFold (folded height 20–100%, def 68 ≈ square) as sliders (user asked % sliders), 에셋 출력 OFF hides boxes via overlay chatCss. Card regex kept as fallback. tests/browser.mjs fails at ~2182 on main too (pre-existing); fixture = build_lite_card.py → tests/make_fixture.py.
