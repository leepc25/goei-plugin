# GPT 요청서 · 절차 생성 방 타일 세트 (2026-10-22)

주인: 「차원 승강기 절차 생성」 스레드(Claude).

차원 승강기의 층은 이제 매번 새로 만들어지는 방들의 미로다. 방은 위·아래·좌·우로 이어지고, 방 폭과 문·계단·잠긴 셔터·균열 벽의 위치가 방마다 다르다. 그래서 방 하나를 통그림으로 그리지 않는다. 장소마다 **타일 세트**(좁은 벽 조각, 바닥 타일, 앞 가림막) 하나를 받고, 코드가 방의 폭과 문 위치에 맞춰 조각을 이어 붙인다. 변형과 장식 배치는 시드로 매번 다르게 고른다.

이미 받은 벽 칸 4장(`<장소>_wall_1~4.png`)과 바닥, 물건 모음은 그대로 쓴다. 넓은 장식 칸으로 쓰고, 이번 조각은 그 사이와 방 끝, 문, 계단 자리를 채운다. **같은 장소의 이미 받은 벽 칸과 마감·기둥·색·조명이 똑같아야 한다.** 그리기 전에 `game-src/art/bg/raw/<장소>/`의 기존 그림을 열어 보고 맞춘다.

## GPT에게 (작업 방법)

- 순서대로 전부 만든다. 묻지 않는다. **한 장마다 커밋·푸시한다.** 이미 있는 파일은 건너뛴다.
- 저장: **`game-src/art/bg/raw/<장소>/<파일 이름>.png`** (아래 이름 그대로). 다 끝나면 `game-src/art/bg/raw/README.md` 파일 목록에 덧붙인다.
- 도트로 그리지 않는다. 평면 채색 그림으로 그리면 도트화는 Claude가 한다(`tools/bg_pixelize.py`).
- 글씨·숫자·로고, 사람·괴이·피는 어디에도 그리지 않는다.
- 장소마다 3장(벽 조각, 바닥 타일, 앞 가림막) × 11곳 = 33장. 여기에 공통 2장을 더해 **모두 35장**이다.

## 붙여 넣을 공통 머리말 (모든 그림 맨 앞에)

```
Use exactly the STYLE and the CORRECTION from docs/GPT요청_게임배경.md: 1990s arcade beat-'em-up background art, clean flat cel shading with 2-3 tone steps, bold dark outlines (6-8 px), few large simple shapes, no texture, no noise, no blur. NOT pixel art. NO text, letters, numbers or logos (plates stay blank). NO people, NO monsters, NO blood. Match the wall finish, pillars, colors and lighting of the existing images in game-src/art/bg/raw/<place>/ exactly; these new pieces must sit next to them without any visible change of style.
These are TILE PIECES for a procedural room builder: the code cuts the sheet by the exact grid below and places the pieces side by side, so every measurement below is exact.
```

## 1. 벽 조각 (MODULE SHEET) 규칙 · `<장소>_mod.png`

```
MODULE SHEET RULES
Canvas 1536x1024, fully opaque. A grid of 6 columns x 2 rows; every cell is exactly 256 px wide and 512 px tall (cell (c,r) starts at x=256*c, y=512*r). Draw nothing across cell borders; each cell is its own piece.
Every cell is a straight-on front elevation of a narrow vertical strip of the same interior wall (camera facing the wall exactly, no vanishing point, no ceiling plane, no floor plane). Scale inside a cell: the cell height (512 px) is the full 2.9 m wall. The BASEBOARD/FOOT LINE is exactly y=492 inside every cell (20 px from the cell bottom): the floor starts there, draw only the baseboard color below it, identical in every cell. The ceiling trim is the top 24 px, identical in every cell. A door opening is 2.1 m = 370 px tall, its bottom on the foot line.
SEAM RULE: in cells marked [tile], the left edge and the right edge must match each other exactly (same colors at the same heights) so the cell can repeat endlessly and sit next to any other [tile] cell. Every cell's left and right 16 px are the plain wall finish (no objects touching the edges), except cells 7 and 8.
Row 1 (y 0-511):
 1 [tile] plain wall A, completely plain finish with baseboard and ceiling trim only.
 2 [tile] plain wall B, same finish with ONE large simple wall detail for that place (listed per place).
 3 [tile] a structural pillar/column of this place, centered, about 140 px wide, plain wall on both sides.
 4 [tile] plain wall C, worn or stained version of A (one large stain or crack shape, not tiny scratches).
 5 [tile] an empty dark doorway hole (no door leaf), 170 px wide x 370 px tall, centered, sitting on the foot line, with this place's door frame.
 6 [tile] a stair opening going UP: inside a dark doorway-sized hole, the first steps of a staircase rising to the right into darkness; same frame as cell 5.
Row 2 (y 512-1023):
 7 LEFT ROOM END: the room's left end wall seen exactly edge-on as a thick solid bulkhead/corner, filling the left 120 px of the cell dark and solid, the plain wall continuing to the right edge (right edge matches cell 1).
 8 RIGHT ROOM END: mirror of cell 7 (solid bulkhead on the right 120 px, plain wall on the left, left edge matches cell 1). Draw it, do not just flip it; lights and shadows come from the same side as all other cells.
 9 [tile] a stair opening going DOWN: a dark doorway-sized hole with the top steps going down to the right into darkness; same frame as cell 5.
10 [tile] a BREAKABLE wall: plain wall with one big cracked patch (large jagged plates, a few chunks fallen at the foot), clearly weaker than the rest, no hole yet.
11 [tile] the same patch BROKEN OPEN: a rough hole about 180 px wide x 300 px tall, sitting on the foot line, dark passage behind it, rubble chunks on the foot line.
12 [tile] a low ventilation grille: a metal vent cover about 150 px wide x 110 px tall, bottom on the foot line, slats dark behind, screws at the corners.
```

## 2. 바닥 타일 (FLOOR TILES) 규칙 · `<장소>_tiles.png`

```
FLOOR TILE RULES
Canvas 1024x1024, fully opaque. A grid of 2x2 cells, each exactly 512x512 (cell (c,r) starts at x=512*c, y=512*r). Seen straight from above (top-down orthographic), even lighting, no object shadows. Every cell uses the same base floor material as the existing <place>_floor.png.
 1 (top-left) [seamless both ways] plain variant A of the floor.
 2 (top-right) [seamless both ways] variant B: the same floor with one or two large wear patches or a large pattern change; any edge must match any edge of cell 1.
 3 (bottom-left) [seamless left-right only] a DOOR THRESHOLD strip: the floor with a doormat or a metal threshold plate running left to right across the middle third (y 171-341 of the cell), the top and bottom thirds plain floor that match cell 1.
 4 (bottom-right) a PIT EDGE: the left half is the floor, the right half is a dark void; the border between them runs top to bottom near x=256 as a broken, jagged floor edge with a thick visible slab edge. The top edge matches the bottom edge (seamless vertically). The code mirrors it for the other side of a pit.
```

## 3. 앞 가림막 (FRONT LAYER) 규칙 · `<장소>_front.png`

```
FRONT LAYER RULES
Canvas 1536x1024, transparent background (if not possible, flat #FF00FF with nothing else on it). A grid of 3x2 cells, each 512x512. These are things very close to the camera, IN FRONT of the playable characters, drawn about 1.5x larger than the wall pieces and a little darker, so they frame the view without hiding the action. Each object touches its cell's bottom edge (it comes up from below the screen) except the ones marked "top", which touch the cell's top edge and hang down. Objects are front-facing, no 3/4 turn, no cast shadows, nothing outside its cell.
 1 the lower half of a near pillar of this place (bottom), about 200 px wide, full cell height.
 2-5 four near objects for this place (listed per place), each filling most of its cell.
 6 a hanging element for this place (top), filling the upper 60% of the cell.
```

## 장소 목록

각 장소마다 공통 머리말 + 세 규칙 + 아래 PLACE 줄 하나를 붙이고 세 장을 차례로 만든다.

### 1. lobby · 로비 층 → `raw/lobby/lobby_mod.png`, `lobby_tiles.png`, `lobby_front.png`
```
PLACE lobby: ground-floor lobby and corridors of an ordinary Korean office building late at night; wall light grey panels with dark grey skirting, pillars square columns clad in grey stone; cold white ceiling light. Cell 2 detail: a large blank framed notice board. Door frame: brushed aluminium. Front objects: 2 a waiting bench back, 3 a big potted plant, 4 a stanchion post with a rope, 5 a low reception counter corner; 6 (top) a hanging ceiling light panel.
```

### 2. chase · 추격의 층 → `raw/chase/chase_mod.png`, `chase_tiles.png`, `chase_front.png`
```
PLACE chase: endless institutional corridor of an old public building; old pale green paint over plaster, dark green lower half, plain plaster pilasters; flickering fluorescent tubes, worn but not destroyed. Cell 2 detail: a wall-mounted fire hose cabinet (blank). Door frame: painted steel. Front objects: 2 a tipped-over metal chair, 3 a stack of old cardboard boxes, 4 a mop bucket, 5 a steel railing section; 6 (top) a fluorescent tube fixture hanging crooked on chains.
```

### 3. test · 시험 층 → `raw/test/test_mod.png`, `test_tiles.png`, `test_front.png`
```
PLACE test: clean sterile test facility; white square ceramic tiles with grey grout, white columns with a thin black stripe; bright, slightly greenish light. Cell 2 detail: a large observation window (dark glass, no figures). Door frame: white with a black stripe. Front objects: 2 a lab cart with covered trays, 3 a test-subject chair with straps (empty), 4 a tall clipboard stand (blank), 5 a waist-high white partition; 6 (top) a ceiling camera on an arm.
```

### 4. apt · 재현의 층 → `raw/apt/apt_mod.png`, `apt_tiles.png`, `apt_front.png`
```
PLACE apt: outdoor corridor of an old 1990s Korean corridor-type apartment block at night; cream painted concrete, concrete columns. Cell 2 detail: a gas meter box with pipes. Door frame: the heavy steel apartment door frame (hole only). Front objects: 2 a corridor parapet wall section with a potted plant on it, 3 a bicycle leaning (front-facing side view of the bike is fine), 4 a stack of kimchi jars, 5 a folded drying rack; 6 (top) a bare bulb corridor lamp.
```

### 5. apt_red · 재현의 층 붉은 벽 → `raw/apt_red/apt_red_mod.png`, `apt_red_tiles.png`, `apt_red_front.png`
```
PLACE apt_red: the same apartment corridor as apt, but the walls painted deep dull red and the light slightly reddish; uneasy, not gory. Cell 2 detail: a dark hand-shaped mark (one flat simple shape, not blood). Door frame: red-painted steel. Front objects: 2 a red plastic stool, 3 a pile of red-wrapped bundles, 4 a red fire bucket, 5 a parapet wall section; 6 (top) a red-tinted bulb lamp.
```

### 6. apt_vacant · 재현의 층 빈집 → `raw/apt_vacant/apt_vacant_mod.png`, `apt_vacant_tiles.png`, `apt_vacant_front.png`
```
PLACE apt_vacant: the same apartment corridor as apt, abandoned for years; peeling grey paint, dust, dim. Cell 2 detail: a window taped over with a dust sheet. Door frame: rusted steel. Front objects: 2 a dust-covered shoe rack, 3 an unplugged old fridge, 4 a pile of old newspapers tied with string (no print visible), 5 a broken chair; 6 (top) a dead bulb hanging on its cord.
```

### 7. silent · 침묵의 층 → `raw/silent/silent_mod.png`, `silent_tiles.png`, `silent_front.png`
```
PLACE silent: hushed old reading hall of a 1980s Korean public library merged with a quiet traditional house; thick carpets, heavy curtains, everything muffled. PALETTE deep green and dark wood brown with dull brass, cream paper. Cell 2 detail: a closed heavy curtain panel. Door frame: dark carved wood. Front objects: 2 a reading table edge with a green lamp, 3 a tall stack of books, 4 a wooden chair back, 5 a book cart; 6 (top) a heavy curtain swag.
```

### 8. dark · 어둠의 층 → `raw/dark/dark_mod.png`, `dark_tiles.png`, `dark_front.png`
```
PLACE dark: abandoned basement office floor with every light dead, only cold emergency light; draw it readable, mid-dark, NOT pitch black (code darkens it). PALETTE cold navy and slate grey with one sick green emergency light. Cell 2 detail: exposed pipes with a valve wheel. Door frame: grey steel. Front objects: 2 a knocked-over office chair, 3 water-damaged boxes, 4 an office partition panel, 5 a metal bucket; 6 (top) a dangling dead fluorescent fixture with loose cables.
```

### 9. puzzle · 퍼즐과 선택의 층 → `raw/puzzle/puzzle_mod.png`, `puzzle_tiles.png`, `puzzle_front.png`
```
PLACE puzzle: too-clean, repeating corridor of identical doors, like a building copied many times; slightly wrong symmetry. PALETTE pale mint and off-white with mustard yellow doors, black trims. Cell 2 detail: one framed plain landscape picture (the same picture as in puzzle_wall_2). Door frame: black trim (hole only, the mustard door leaf is separate). Front objects: 2 a pedestal with a cube, 3 an identical pair of stools, 4 a blank direction sign on a stand, 5 a potted plant; 6 (top) a hanging round lamp.
```

### 10. deep · 심층 → `raw/deep/deep_mod.png`, `deep_tiles.png`, `deep_front.png`
```
PLACE deep: the deepest floors where remembered places blur together; a corridor wall that turns into house wallpaper, doors at wrong heights. Calm and eerie, NOT gory. PALETTE dusty violet and ash grey with faded old-photo sepia. Cell 2 detail: a blank old photo frame. Door frame: an old wooden frame slightly tilted. Stair cells 6 and 9 may lead into impossible directions (steps on the wall), still inside the doorway hole. Front objects: 2 a lone old wardrobe edge, 3 a pile of identical shoes, 4 an empty birdcage on a stand, 5 a stack of old suitcases; 6 (top) a staircase underside hanging from above and ending in the air.
```

### 11. service · 정비 구역 → `raw/service/service_mod.png`, `service_tiles.png`, `service_front.png`
```
PLACE service: the maintenance zone between elevator shafts; rusty brown riveted steel plates and old concrete, steel I-beam columns; very dark with a few orange caged work lamps. Cell 2 detail: a caged orange work lamp on the wall. Door frame: a riveted steel hatch frame. Stair cells: steel grating stairs. Front objects: 2 a steel railing with chain, 3 a cable drum, 4 an oil drum, 5 a toolbox on a crate; 6 (top) hanging chains and a pulley hook.
```

## 공통 2장 (모든 층에서 쓰는 방 역할 물건)

저장: `raw/props/room_roles_1.png`, `raw/props/room_roles_2.png`. 위의 OBJECT SHEET RULES(`docs/GPT요청_게임배경.md`, 1536×1024 투명, 3×3, 정면, 윗면 얇게)를 따른다. 물건은 칸 아래 변에 닿게 세운다(발 줄 = 칸 바닥).

```
room_roles_1 (things the procedural rooms need):
 1 a heavy fire shutter, CLOSED: a steel roll-down shutter in its frame, door-sized, with a red blank plate and a keyhole box at the side, a yellow-black hazard band at the bottom.
 2 the same fire shutter OPEN: rolled up into its top box, empty dark opening below, frame and keyhole box unchanged.
 3 a key card on a lanyard hanging from a hook stand (the key pickup), shown large.
 4 a supply backpack with a strap and a canteen (the reward pickup), standing upright.
 5 a small lockbox/strongbox, closed.
 6 the same lockbox, open, empty inside.
 7 a free-standing vertical ladder (for going up through a ceiling hatch), straight front view.
 8 a ceiling hatch frame seen from below (square dark opening with a frame), drawn flat to the viewer.
 9 a floor hatch (square steel lid with a handle) seen from slightly above.

room_roles_2 (rest stop and guard post):
 1 a small camp: a folding stool, a camping lantern (lit warm) and a sleeping mat rolled up, as one group.
 2 a first-aid wall cabinet, closed, red cross shape only (no text).
 3 a guard post barricade: overturned desks and sandbags piled as one waist-high block.
 4 a low dark crawl-space opening frame (for vents), 150 wide x 110 tall proportion.
 5 a rope hanging down from above (for the deep floors), full cell height.
 6 a collapsed floor edge piece: a broken slab tilted down into darkness.
 7 a lamp post-like elevator call panel on a stand: plain metal box with two round buttons (no arrows, no text).
 8 a pile of rubble chunks.
 9 a large crate with metal corners.
```

## 받은 뒤 Claude가 할 일

- 격자 그대로 잘라 도트화한 다음 발 줄(y=492 → 도트 높이에 맞춤)을 맞추고, 칸 양 끝 이음새 오차는 코드로 섞는다.
- 방 생성기의 문·계단·균열·환풍구·잠긴 셔터 위치에 1·5·6·9·10·11·12번 칸을 놓고, 나머지 폭은 1·2·3·4번 칸과 기존 벽 칸 4장으로 시드에 따라 채운다. 방 양 끝에는 7·8번을 놓는다.
- 바닥은 1·2번을 섞어 깔고, 문 앞에 3번, 구덩이 가장자리에 4번을 놓는다.
- 앞 가림막은 방마다 0~3개를 화면 맨 앞에 띄엄띄엄 놓는다.
