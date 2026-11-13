---
name: pixellab-text-prompts
description: 2026-10-24 English PixelLab text-v3 prompt list for all 55 agents' skills/supers + 18 common emotes, file location and assumptions
metadata:
  type: project
---
User 2026-10-24 (thread 「필살기·기술 동작 구현 보여주기」): "구현된건 없을거야" — wanted the kinds of PixelLab text (v3) requests incl. skills/supers with English prompts. Delivered /mnt/project-files/pixellab_text/픽셀랩_글동작_요청목록.md (not in repo; generator data in that thread's scratch only).
- Built from docs/요원_기술안.md body-motion lines. 263 text clips for skills (~992 gens by spec formula) + 18 common emotes (60 gens per agent). Nothing generated.
- Rules used: SE only; charge pose = one 8-frame clip (1–4 enter, 5–8 looped); big motions split A/B/C, next clip starts from previous last frame; 256×256 max 8 frames; template clips (taking-punch, throw-object, pushing…) marked 견본; many skills need prop/weapon character states first.
See [[goei-skill-kits]], [[agent-motion-list]], [[pixellab-prompt-no-objects]].
