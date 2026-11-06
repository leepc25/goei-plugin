---
name: goei-field-bg-spec
description: Field background spec agreed with user 2026-10-23 for GPT whole-scene art (900px tall, floor 40%, no perspective, 72px per depth metre)
metadata:
  type: project
  modified: 2026-10-23T09:17:28.259Z
---
2026-10-23 thread 「본부 필드 이어가기」. User has GPT draw each field scene as ONE image with furniture painted in; code cuts out furniture regions for depth/collision. Spec Claude gave (user OK'd 08:22):
- Height 900px fixed, width = room length, min 1950px; long rooms by outpainting (feed previous image, "continue to the right").
- Top 60% wall+ceiling (ceiling ~90px), bottom 40% floor; wall/floor line exactly y=540.
- Scale: person 1.65m = 256px; door ~330×140 (1.3× person), desk ~115px, seat ~70px, ceiling 450px above y540.
- No perspective: same size front/back; floor band 540–900 = 5m depth, 72px per metre; floor lines strictly horizontal/vertical; furniture top band = depth(m)×72px.
- Furniture painted in but separated (no overlaps) for cutouts; seats face sideways. No people/text/logos (sign plates blank, code overlays text). Same style/night lighting as current office.
Game side NOT yet changed: still 720 internal height; v0.16.48 fills window height (field fit 'height', engine/view.ts crop). Planned: internal height 900 so scale ≈1× on PC (user agreed in principle, not yet ordered). Pixelization quality critique: 64 colours too few, ink outline step made noise → use 128–256 colours, no ink. See [[goei-no-unasked-work]].

**08:44 v0.16.49 (test build, user asked "2배로 맞춰서 릴리스"):** field sets engine PIXEL=2 (contract.ts now `let PIXEL` + setPixelScale; combat restores 2.75) and stage 'height' mode uses integer device-pixel scale k=floor(bh*dpr/720)/dpr (fallback to plain height-fit if <75% of height, e.g. phones). On PC 1040×890 → 1:1, 85px bars top/bottom, agents ~198px (smaller vs room art drawn for 272). Not final; user still deciding agent source size (96 vs ~135/180 in 256 canvas).
**09:30 v0.16.50 (f6845e71):** field canvas fills the whole box (stage 'height' + box ≥600 tall: canvas = box at integer device px; engine view.zoom = canvas.height/720 scales world; sprites use PIXEL*spr(y) so dots stay 2 screen px; perspective view.persp 0.85 back→1 front over world.lane). Bg stretched temporarily. Bottom-right test label shows box size (.gs-size) — remove later.
**09:38 user DECIDED:** non-integer scaling shows no visible distortion on their screen → drop the exact-integer-scale rule. Field fills the window and scales freely (bg + agents); bg height need not match the box exactly.

**09:45 v0.16.52 (82cca592):** walking shake fixed (crop from interpolated cam/player, snapped to screen px; sprites snapTo device px). User asked base scale 1.5× of 256 canvas → field PIXEL 2.625 (front ~255px, back ~217). Size readout removed.**09:49 user: 1.5× is the BASE** (256 canvas ~170-dot body → ~255px front at 890 box). User says bg spec must follow the BACK perspective size (back = 0.85 → ~217px); GPT bg spec not yet rewritten.
**10:00 user:** current 부장실 art is a failure (1900s Sherlock look) — field rooms must look like a modern Korean office (facility floors may add concrete/security doors). Agents: GPT draws a front-facing reference sprite → user confirms → PixelLab registers it.

**10:29 FINAL so far:** 256 canvas dropped (too slow/costly) → agents 180 canvas (body ~117), screen front ~255px (~2.2×), back 0.85. Spec doc https://claude.ai/artifact/6BmPY49d9Dq468KYhqLaAo: bg 480 tall (wall/floor y288, walk 288–459, door 150×65, 1m=71px at back). Attacks = own basic + own ranged only; what they are must be discussed with the user before making. Picked-up weapons on hold.