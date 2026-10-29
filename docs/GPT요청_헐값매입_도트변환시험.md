# GPT 요청문 · 헐값매입 (PixelLab image-to-pixelart 변환 시험용, 2026-10-29)

용도: GPT가 그린 큰 그림 한 장을 PixelLab 도트 변환에 넣어 보는 시험. 1차 결과(`game-src/art/pixellab-test-20261028/gpt_heolgap_1536x1024.webp`)는 쓸 만했으나 시계가 2개, 물건이 비슷비슷함. 아래는 그걸 고친 2차 요청문.

```
Game background illustration, 1536x1024, landscape.

SCENE: a cramped, dim pawn shop inside a run-down 1990s Seoul underground shopping arcade, late at night.

CAMERA: beat 'em up view. The camera is slightly above the floor looking a little down, straight at the back wall, no vanishing point, no converging lines. The back wall is low in the frame so that most of the lower part of the image is open floor the characters walk on. Furniture against the back wall stands on the baseboard line.

CONTENTS — every object must look clearly different from the others; do not repeat the same cabinet, the same vase, the same statue:
- Back wall: dark burgundy paint with water stains and peeling patches, a thin dark wooden baseboard. ONE round wall clock. One faded ink-painting scroll. A folding screen standing in one corner.
- Display cabinets, each a different design: (a) a tall narrow brass-and-glass jewellery case with gold rings, necklaces and bracelets on black velvet; (b) a wide wooden-framed glass case with old wristwatches and pocket watches laid in rows; (c) a dark lacquered cabinet with metal crafts: a bronze incense burner, a brass lion, a cracked bronze bell, celadon shards on a tray; (d) a dusty glass case of strange unlabeled curios: a sealed jar with something dark inside, a cracked porcelain doll, a tarnished mask, an odd clockwork device, a small bone.
- Dominating the middle: a heavy old dark wooden appraisal desk, long and wide, front face toward the camera, with a brass balance scale, a magnifying glass on a stand, white appraisal gloves, a seal box, a document tray and a shaded desk lamp. An old wooden armchair behind it (owner), a plain wooden chair in front (customer), facing each other across the desk.
- To one side of the back wall: a dark doorway to a back room covered by a hanging curtain of red-brown wooden beads.
- A small iron safe on the floor, a short stack of old books, a low wooden cabinet with document trays.
- Floor: old dark hardwood planks, scuffed and dull, with warm pools of lamp light and deep shadows under the furniture.

LIGHT: low and warm — the desk lamp and the lit cabinets are the main light; the rest falls into brown-black shadow. Dark, slightly desaturated palette with warm gold highlights.

STYLE: clean painted game art, crisp hard edges, bold readable shapes, moderate detail, no photo texture, no noise, no blur, no lens effects. NOT pixel art. No people, no animals, no text, letters, numbers or logos anywhere.
```

## 3차 (2026-10-29, 2차도 실패 → 다시. 의자 뺌: 캐릭터가 앉는 건 따로 오브젝트)

```
A wide game background painting, 1536x1024. Interior of a cramped, dim pawn shop in a run-down 1990s Seoul underground shopping arcade at night, seen straight on from slightly above, like a side-scrolling beat 'em up stage: the back wall runs across the upper part, and a wide empty stretch of old dark hardwood floor fills the lower part for characters to walk on.

Against the burgundy, water-stained back wall stand four very different display cases: a tall narrow brass jewellery case glowing with gold rings and necklaces on black velvet; a wide low wooden case of old wristwatches in rows; a dark lacquered cabinet of bronze crafts (an incense burner, a lion, a cracked bell, celadon shards); and a dusty glass case of unlabeled oddities (a sealed jar with something dark inside, a cracked porcelain doll, a tarnished mask, a clockwork device). In the middle, a heavy dark wooden appraisal desk faces the viewer, carrying a brass balance scale, a magnifying glass on a stand, white gloves, a seal box, a document tray and a shaded lamp; no chairs. To one side, a doorway hung with a red-brown wooden bead curtain leads to a dark back room. A small iron safe, a short stack of old books, a low cabinet with trays, a folding screen in the corner, and a single round wall clock.

Warm low light from the lamp and the lit cases; everything else sinks into brown-black shadow. Clean painted game art with crisp edges and clear shapes, no photo texture, no blur. No people, no text.
```
