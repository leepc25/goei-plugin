# GPT 요청서 · 관리국 본부 3판 (2026-10-22)

주인: 「본부 다시 만들기」 스레드(Claude). 지금 본부 벽·바닥·집기 그림은 전부 버리고 새로 만든다.
배치는 `docs/본부_설계_2판.md`(3판 구조)와 그림 배치도 `/mnt/project-files/game/본부/본부_배치도.html`을 따른다.

방식: **벽·바닥은 이어 붙이는 타일, 집기는 하나씩 따로 그린 조각, 문은 문틀과 문짝을 따로**(열리는 그림용). 건물 정면 외관만 한 장으로 그린다.
엔진이 위에서 본 배치도 자리에 집기를 세우고, 사람 앞뒤 가림과 막는 판정을 맞춘다.

## GPT에게 (작업 방법)

- 이 저장소(`leepc25/goei-plugin`)에 바로 올린다. 저장 경로는 **`game-src/art/bg/raw/<묶음>/<파일 이름>.png`**이고, 이름은 아래 목록 그대로 쓴다.
- 순서대로 묻지 말고 전부 만든다. 한 장마다 커밋·푸시하고, 이미 있으면 건너뛴다.
- 다 올린 뒤 `game-src/art/bg/raw/README.md`에 목록을 적고, `docs/GPT_요청_목록.md`의 이 줄 상태를 「받음」으로 고친다.
- 도트(픽셀아트)로 그리지 않는다. 깨끗한 평면 채색 그림으로 그린다. 도트화와 크기 맞춤은 Claude가 한다.
- 크기:
  - 벽 타일·외관: 1536×1024
  - 바닥 타일: 1024×1024
  - 조각 모음: 1536×1024, 3×3 칸에 하나씩, 투명 배경(안 되면 그림자 없는 #FF00FF 단색)
- 이 그림을 그리는 사람은 맨 앞에 STYLE, 종류별 RULES를 붙인 뒤 각 항목 문단을 쓴다.

## 붙여 넣을 공통 문단

```
STYLE (same for every image)
2D side-scrolling beat-'em-up game art in the spirit of 1990s arcade brawlers, set in present-day Seoul. Subject: the headquarters of a secret government agency that handles supernatural anomalies. It must look SLEEK, MODERN, CLEAN AND HIGH-TECH, refined and expensive, like a new government intelligence building. Never old, never shabby, never a factory, never a cheap small company, no stains, no rust, no peeling paint, no clutter.
Above-ground finish: deep navy and charcoal walls, warm walnut wood panels, satin brushed-metal trims, frosted glass with a clear band, thin cool-white LED cove lights, light grey stone or polished floor.
Underground finish ("the other world"): white composite wall panels with thin seams, glowing cyan light lines, black glass, automatic sliding doors, clean SF laboratory look.
Night shift, moderately dark overall so the characters stand out; no pure white areas, no big saturated areas except the cyan/amber accent lights.
Clean flat cel shading with 2-3 tone steps, crisp hard edges, bold dark outlines about 6-8 px thick around every object and major shape, FEW LARGE simple shapes (it will be shrunk to a small pixel-art screen), no fine texture, no noise, no grain, no blur. NOT pixel art.
NO people, no silhouettes of people, NO text, letters, numbers or readable logos anywhere (signs use colored bands and simple pictograms only).
```

```
WALL TILE RULES
Straight-on front elevation of a section of interior wall, camera facing the wall exactly: no vanishing point, no side walls, no ceiling plane, no floor plane. 1536x1024 landscape. The wall fills the image from top to bottom: the top 6% is a dark ceiling edge with one thin LED cove light line under it, the bottom 9% is the baseboard panel where the floor starts. The image must tile seamlessly left-right (the left edge continues into the right edge). Scale: full image height = 2.9 m, a door is 2.1 m. Draw ONLY things built into the wall (windows, wall screens, panels, lights). NO doors, NO furniture, nothing standing on the floor.
```

```
FLOOR TILE RULES
Seamless tileable floor texture seen straight from above, 1024x1024, tiles left-right and top-bottom with no seam. Large calm pattern (big tiles or long planks), even lighting, no objects, no shadows, no stains.
```

```
PIECE SHEET RULES
A sheet of separate game pieces, 1536x1024, transparent background (or a perfectly flat #FF00FF magenta background with nothing on it). 3x3 grid, one piece per cell, each fully inside its cell with margin, filling most of the cell. No cast shadows on the ground.
CAMERA for every piece (very important): the front of the piece is parallel to the image (never turned left or right, no 3/4 view), and the camera looks down from above at a steep angle, so the TOP surface is visible as a band ABOVE the front face. The top band's height is about 0.3 x the real depth of the piece, measured on the same scale as its width (a 1 m wide, 1 m deep, 0.75 m tall desk = front face 0.75 tall, top band 0.3 tall above it, 1 wide). Sizes are given as W (left-right) x D (depth, front-to-back) x H (height) in meters; keep those proportions.
Chairs and anything a person sits on sideways are drawn in exact SIDE PROFILE facing RIGHT (the sitter would look to the right).
```

## 1. 벽·바닥 타일 (묶음마다 3장)

```
hq3_office (above-ground offices: response team office, suppression team office, administration office) — WALL TILE RULES
hq3_office_wall_1 — plain wall: navy wall, walnut panel band from 0.9 m to the baseboard, one slim brushed-metal vertical trim at the center.
hq3_office_wall_2 — full-width window wall: a big floor-to-near-ceiling window with thin dark mullions every 1.5 m, outside is an EMPTY quiet Seoul street at night (office buildings with a few lit windows, no cars, no people), walnut sill.
hq3_office_wall_3 — situation wall: a large wall-mounted black display (4 m wide, from 0.9 m to 2.4 m) showing a dark teal city map with glowing cyan lines and three amber dots, slim metal frame, navy wall around it.
hq3_office_floor — FLOOR TILE RULES: light warm-grey polished stone floor, large 60 cm tiles, very subtle joints.
```

```
hq3_hall (above-ground corridors and the lobby core) — WALL TILE RULES
hq3_hall_wall_1 — plain corridor wall: charcoal wall, walnut lower panel, a thin cyan-white LED line along the baseboard, one small round wall light.
hq3_hall_wall_2 — lobby wall: dark stone wall with a large blank brushed-metal emblem plate (a simple geometric shape like an eye inside a door frame, NO letters), warm downlights.
hq3_hall_floor — FLOOR TILE RULES: dark grey polished stone, long 120x60 cm tiles.
```

```
hq3_life (rest room & pantry, interview room, restroom) — WALL TILE RULES
hq3_life_wall_1 — warm plain wall: dark taupe wall with a walnut slat panel band, warm white cove light.
hq3_life_wall_2 — window wall: a wide window with the empty night street outside, light linen curtains tied open at both sides.
hq3_life_wall_3 — interview wall: closed light wooden blinds over a window, a warm wall lamp on each side.
hq3_life_floor — FLOOR TILE RULES: warm oak wooden planks, wide and long, matte.
```

```
hq3_bath (staff public bath, underground) — WALL TILE RULES
hq3_bath_wall_1 — plain tiled wall: large pale grey-blue square tiles (40 cm) with dark grout lines, a slim dark-blue tile band at 1.2 m.
hq3_bath_wall_2 — shower wall: the same tiles with ONE shower position in the middle of the image: a chrome vertical pipe, a round rain shower head at 2.0 m, a single chrome lever at 1.1 m, a small tiled niche shelf beside it. (It is repeated side by side, so keep the shower exactly centered.)
hq3_bath_wall_3 — the same tiles with a long frosted high window strip at 2.0-2.5 m, soft warm light behind it.
hq3_bath_floor — FLOOR TILE RULES: small anti-slip grey-white square tiles (10 cm), clean.
```

```
hq3_lab (underground: isolation laboratory, infirmary, training hall) — WALL TILE RULES
hq3_lab_wall_1 — plain SF wall: white composite panels 1.2 m wide with thin dark seams, one glowing cyan horizontal light line at 2.3 m, a dark grey lower panel.
hq3_lab_wall_2 — observation window: a wide black-glass window (3 m wide, 0.9-2.3 m high) in a thick white frame, inside it a dim cyan-lit empty containment cell with a dark shapeless shadow in it (an anomaly, not a person).
hq3_lab_wall_3 — training wall: the same white panels with a large dark record display (blank bars and dots, no text) and a horizontal black safety stripe.
hq3_lab_floor — FLOOR TILE RULES: grey epoxy floor with large square panels and thin cyan inset guide lines.
```

```
hq3_labhall (underground corridors, half-lit) — WALL TILE RULES
hq3_labhall_wall_1 — the same white SF panels but HALF-LIT: only every other ceiling light is on, deep shadows between them, a dim cyan floor-level light line.
hq3_labhall_floor — FLOOR TILE RULES: dark grey epoxy with faint cyan guide line along one direction.
```

## 2. 문·코어 조각 (PIECE SHEET RULES, 정면만, 위에서 내려다보지 않음)

문은 벽에 붙으므로 윗면 띠가 없다. 문틀(가운데 어두운 구멍)과 문짝을 따로 그린다. 엔진이 문짝을 옆으로 밀어 여는 그림을 만든다.

```
hq3_doors_objects (doors are flat on the wall: draw them straight-on, NO top band). Door opening height 2.1 m.
1 glass door frame: brushed-metal frame around an EMPTY dark opening (1.6 m wide), a small card reader with a green light on the right side of the frame.
2 one frosted glass sliding door leaf (0.8 m wide, 2.1 m tall) with a clear horizontal band at eye height, metal edge.
3 SF door frame: thick white frame with cyan light strip around an EMPTY dark opening (1.7 m wide), status light on the right.
4 one SF sliding door leaf: white panel 0.85 m wide, 2.1 m tall, with a thin cyan vertical light line.
5 elevator frame: brushed-metal frame around an EMPTY dark opening (1.6 m wide), amber floor indicator above (dots, no numbers), call button panel on the right.
6 one elevator door leaf: brushed steel, 0.8 m wide, 2.1 m tall.
7 stairwell opening going UP: a dark opening (1.2 m wide) with the first steps of a modern stair rising to the right inside, metal handrail, lit from above.
8 stairwell opening going DOWN: a dark opening (1.2 m wide) with steps going down to the left inside, metal handrail.
9 containment cell door: heavy closed dark-grey sliding door (1.5 m wide) with yellow-black hazard edge, a round status light and a small blank plate, in a white frame.
```

```
hq3_doors_objects_2
1 wooden door (restroom / interview room): walnut door, closed, 0.9 m wide, 2.1 m tall, brushed-metal handle, in a slim frame.
2 main entrance: a double glass entrance door with a metal canopy edge above, 2.4 m wide, closed, inside dark.
3 floor directory sign mounted on the wall beside the stairs: a vertical panel 0.6 m wide, 1.6 m tall, with four colored horizontal bands (one per floor: 2F, 1F, B1, B2) each with a small simple pictogram (desk, badge, dumbbell, flask), NO letters or numbers.
4 sealed vault door for the deepest containment room: massive round-cornered steel door 1.8 m wide with three heavy locking bars and a red light.
5 security gate post: waist-high (1.0 m) brushed-steel turnstile post with a black glass top and a green light, seen from the front, D 0.6.
6 tall potted plant (rubber tree, 1.6 m) in a dark square pot.
7 wall-mounted CCTV dome camera (0.3 m).
8 slim floor lamp, warm light (1.6 m).
9 large wall clock without numbers (0.5 m), metal ring.
```

## 3. 집기 조각 (PIECE SHEET RULES: 앞면 + 위에서 본 윗면 띠)

크기는 W×D×H (m). 의자는 오른쪽을 보는 옆모습.

```
hq3_office_objects (response team / suppression team / administration)
1 desk island end view: two pairs of office desks back to back (W 1.6 x D 2.0 x H 0.75), a low frosted-glass divider down the middle of the top, two slim monitors back to back on top, a convenience-store coffee cup and a few papers on each side.
2 operator desk: L-shaped desk with three monitors and a headset (W 0.8 x D 1.6 x H 0.75), cable tray, walnut top, dark front.
3 chief's desk: larger walnut desk with one monitor, a desk lamp and neat files (W 0.9 x D 1.8 x H 0.75).
4 office chair, SIDE PROFILE facing right: black mesh back 1.05 m, seat 0.48 m, five-star base.
5 meeting table (W 1.4 x D 1.2 x H 0.75), walnut top, metal legs, a tablet and a water bottle on it.
6 high reception counter (W 0.6 x D 2.2 x H 1.1), walnut front with a metal band, a small monitor and a document tray on top.
7 standing gear bench (W 1.0 x D 1.6 x H 0.95): steel work bench with a body-armor vest, a helmet and a holster laid out neatly.
8 locker bank seen from its side end (W 0.3 x D 4.2 x H 2.0): dark grey metal lockers, the long top band shows the row.
9 low cabinet (W 0.3 x D 2.2 x H 1.0) walnut, closed.
```

```
hq3_life_objects (rest room & pantry, interview room, restroom)
1 pantry island counter (W 1.4 x D 1.6 x H 1.0): quartz top with a coffee machine, a box of instant mix coffee sticks, a kettle and a few mugs; walnut front.
2 small two-person cafe table (W 0.8 x D 0.8 x H 0.75), round-cornered, with two snacks.
3 long sofa seen from the front, long side to the camera (W 4.0 x D 0.9 x H 0.85), dark teal fabric, a throw cushion at the left end, long enough to lie on.
4 vending machine (W 0.6 x D 1.6 x H 1.8), lit front with rows of drinks drawn as simple colored blocks, no text.
5 soft armchair, SIDE PROFILE facing right (seat 0.45 m, back 0.95 m), warm brown fabric.
6 low coffee table (W 0.8 x D 0.7 x H 0.45) with a tissue box and a cup of warm tea with steam.
7 tea trolley (W 0.8 x D 0.6 x H 0.9) with a teapot and cups.
8 washbasin island (W 0.6 x D 1.6 x H 0.85) with a double-sided mirror panel standing on it up to 1.8 m, two basins, chrome taps.
9 restroom stall row seen from its side end (W 1.9 x D 4.4 x H 2.1): three grey partition stalls with doors facing left, all closed.
```

```
hq3_bath_objects (staff public bath)
1 big bath tub seen from its LONG side (W 9.0 x D 3.0 x H 0.55): tiled outer wall, wide stone rim, calm water with light reflections visible in the top band, a few steps of rising steam.
2 shower stool and basin (stool H 0.35, basin on it), light grey plastic.
3 changing-room bench seen from its end (W 0.5 x D 1.5 x H 0.45), wooden slats.
4 bath locker column seen from its side end (W 0.5 x D 3.2 x H 1.9), light wood lockers.
5 frosted glass low partition seen end-on (W 0.12 x D 3.0 x H 2.0).
6 towel shelf with folded white towels (W 1.0 x D 0.4 x H 1.2).
7 laundry basket (0.5 m).
8 hair dryer counter with a round mirror (W 1.2 x D 0.5 x H 0.85).
9 water bucket and wooden dipper (0.4 m).
```

```
hq3_lab_objects (isolation laboratory, infirmary)
1 supply counter (W 0.6 x D 2.2 x H 1.05): white counter with a cyan light edge, a small parts tray and a scanner pad on top.
2 tall equipment shelf seen from its side end (W 0.3 x D 3.0 x H 1.9): white metal shelf with grey equipment cases.
3 research bench (W 2.0 x D 1.6 x H 0.9): white lab bench with a microscope, a sample rack and a glowing tablet.
4 appraisal bench (W 1.4 x D 1.6 x H 0.9) with a laser scanner arm shining a thin cyan line onto a small wooden box of teeth (the box closed).
5 lab stool, SIDE PROFILE facing right (seat 0.65 m), white with a chrome base.
6 coffee cart (W 0.9 x D 0.6 x H 0.95) with a big mug and a box of instant mix coffee sticks.
7 infirmary bed seen from its LONG side (W 2.0 x D 0.9 x H 0.6): white sheet, pillow at the LEFT end, steel frame, the head of the bed at the left.
8 medicine cabinet seen from its side end (W 0.3 x D 2.6 x H 1.8), white with glass doors.
9 tooth-box shelf seen from its side end (W 0.3 x D 3.6 x H 1.9): white shelf with rows of small closed wooden boxes.
```

```
hq3_training_objects (training hall)
1 heavy punching bag hanging from a ceiling chain (bag 1.2 m tall, bottom at 0.5 m), black leather.
2 weight bench with a barbell on the rack (W 1.6 x D 0.6 x H 0.5).
3 low obstacle wall seen end-on (W 0.35 x D 5.1 x H 0.9): padded orange-and-black block wall, the long top band shows it crossing the hall.
4 shooting range counter seen end-on (W 0.4 x D 5.1 x H 1.1) with ear muffs and dividers between four lanes.
5 paper target on a rail stand (1.8 m), a plain round target, no numbers.
6 rubber floor mat (W 3.0 x D 2.0), flat, only the top surface (a dark blue square with a border).
7 equipment rack with gloves and pads (W 1.2 x D 0.4 x H 1.4).
8 water dispenser (0.4 x 0.4 x 1.2).
9 kettlebell set on a low rack (W 1.0 x D 0.4 x H 0.4).
```

## 4. 건물 정면 외관 (한 장)

```
hq3_facade — STYLE only (no wall rules). 1536x1024 landscape, straight-on front elevation of the building seen from the street at night, no vanishing point.
A large modern office building in Jongno, Seoul, 6 storeys, filling the image width; its ground floor sits at the bottom 15% of the image with the sidewalk line at the very bottom.
Make it UNMISTAKABLY a secret government agency headquarters: a dark granite and black-glass facade, a large brushed-metal emblem on the facade above the entrance (the same simple geometric eye-inside-a-door-frame shape, NO letters), a wide canopy over a double glass entrance in the center, two slim security bollards, a flagpole without a readable flag, discreet security cameras, cyan-white LED lines along the floor slabs.
Only the 1st and 2nd floors are lit (warm white offices behind glass); the upper floors are dark. A faint shimmering translucent veil effect over the whole building (the perception veil that hides it from ordinary people), very subtle.
NO people, no cars, no text anywhere.
```

## Claude가 하는 일 (받은 뒤)

- 벽·바닥 타일 도트화(같은 팔레트), 조각 자르기와 크기 맞춤(W·D·H 표 기준), 문짝 여는 그림 연결.
- 엔진: 배치도 자리에 조각을 세우고 막는 상자와 맞춤, 정면 외관을 거리 장면 건물 자리에 넣는다.
- 작은 흠은 다시 의뢰하지 않고 코드로 고친다.
