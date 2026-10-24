---
name: goei-bg-consistency-problem
description: 2026-10-24 user: GPT failed field backgrounds — can't draw long images and can't keep style consistent across separate images; options proposed
metadata:
  type: project
  modified: 2026-10-24T04:15:46.345Z
---
2026-10-24 thread 「필드 남은 작업 이어가기」. User: GPT mostly failed the field backgrounds. It cannot generate long images (GPT sizes are only 1:1, 3:2, 2:3; spec is 700 tall × ≥1600 wide), and when split into parts (wall/floor/props) it cannot keep art style consistent across images, even with the office reference.
Claude proposed (04:15), no decision yet:
1. (recommended) PixelLab with the office image as style reference for wall/floor tiles + props, code assembles rooms. Costs balance, needs user approval; test lobby first.
2. Keep GPT, code forces shared palette/pixel grid/lighting — reverses the "Claude doesn't pixelize" rule, can't hide line-style differences.
Existing assembler code: drawHqWall in src/game/action/art/bg.ts (10-21 wall-bay approach).
See [[goei-field-bg-spec]], [[goei-game-backgrounds]].
**PixelLab bg capabilities (openapi checked 2026-10-24):** generate-with-style-v2 (1–4 style images, square, max 512), generate-image-v2 (style_image, max 512² / ~688×384 wide), map-objects (transparent props, background_image for style matching, inpainting), create-tiles-pro (tilesets, style_images, low top-down view, building kits wall/floor), target_palette on most. No whole-room output; bg would be half size ×2 in code. Cost untested. Claude offered a lobby test (2–3 wall sections, 3–4 props, 1 floor tileset) — waiting for user go.
**2026-10-24 lobby test DONE (user said 「일단 해보자」):** generate-image-v2 with style_image = game-pack/start-room/room.png (640x360) works: wall slice 640x352 ~25-35 gens, props (no_background, size e.g. 224x112) 10-20 gens, 4 variants for small props. Style/palette consistent across wall+props; slice repeats 3x with acceptable seam. Files in /mnt/project-files/pixellab-lobby-test/. Balance after ~10,950 (Tier 3). Script lived in scratchpad (gen.py). Next: user decides to roll out to other scenes or put lobby in game first. Weakness: repetition, props slightly small, tone bluer than office.
**2026-10-24 DECISIONS (later in thread, supersedes the options above):** day art only, night by code; 관리국=가짜관리국 same art, differ by layout; Korean office floor NOT carpet, lineless smooth light-grey, depth by brightness; walls ultra-simple bright (no pillars); doors drawn as separate props; floor/wall painted by code; PixelLab lobby test cost ~360 gens total and user was angry (use small sizes, one at a time, report cost per image). User then chose GPT for art: Claude designed 'parts sheet' method (GPT draws only props, 3:2 sheets on magenta, P1–P8) in docs/필드_그림_통합_지침.md 「0-1」 via PR #29 (unmerged at 07:38); paste text /mnt/project-files/gpt/필드배경_GPT_붙여넣기.md; next = GPT draws P1 only, user checks. Handoff doc: /mnt/project-files/handoff/필드작업_인수인계_2026-10-24.md (user will add a new Claude account to the SAME project).
