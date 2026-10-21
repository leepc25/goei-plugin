# GPT 요청서 · 게임 배경·바닥·원경·물건 (2026-10-21)

주인: 「게임 타일과 배경」 스레드(Claude). 컷신용 한 장 그림은 여기 없다(「대사와 컷신」 요청서).
GPT가 그리고, Claude가 도트화(쟈알디와 같은 2배 격자, 장소별 색 줄임)·이음새·원근·기준점 작업을 해서 통합본에 넣는다. PixelLab은 쓰지 않는다.

## GPT에게 (작업 방법)

- 이 저장소(`leepc25/goei-plugin`)에 바로 올린다. 저장 경로: **`game-src/art/bg/raw/<장소>/<파일 이름>.png`** (아래 목록 이름 그대로). 다 올린 뒤 `game-src/art/bg/raw/README.md` 에 받은 파일 목록을 적고 main에 커밋한다.
- 목록을 쉬지 않고 순서대로 전부 만든다. 묻지 않는다. 한도에 걸리면 멈춘 번호부터 이어 한다.
- 도트(픽셀아트)로 그리지 않는다. 깨끗한 평면 채색 그림으로 그린다. 도트화는 Claude가 한다.
- 크기: 벽 칸·원경 1536×1024, 바닥 무늬 1024×1024, 물건 모음 1536×1024.

## 공통 스타일 (모든 요청문 맨 앞에 붙는 문단)

```
STYLE (same for every image)
2D side-scrolling beat-'em-up game background art, like a 1990s arcade brawler (Capcom's Dungeons & Dragons: Shadow over Mystara) but set in present-day South Korea. Clean flat cel shading with 2-3 tone steps, crisp hard edges, bold dark outlines, few large simple shapes (it will be shrunk to a small pixel-art screen), no painterly brush texture, no noise, no film grain, no blur, no depth of field. NOT pixel art (it will be pixelated later), but keep shapes simple and readable at small size. Muted, slightly desaturated colors, dim indoor night lighting; the playable characters must stand out in front of it, so avoid pure white and strong saturated colors except the noted accent. NO people, no silhouettes, no text, letters, numbers, logos or signs with writing anywhere (sign plates stay blank).
```

## 벽 칸 (WALL) 공통 규칙

```
WALL BAY RULES
Straight-on front elevation of ONE section of an interior wall, camera facing the wall exactly (no vanishing point, no visible side walls, no ceiling plane, no floor plane). 1536x1024 landscape. The wall fills the whole image from top to bottom; the bottom 4% is the baseboard line where the floor will start (draw nothing below it). The left and right edges of the image are each the center of a structural pillar/column of the same design in every bay of this place, so the bays can be placed side by side. Scale: the wall is 2.9 m high (full image height), a door is 2.1 m (72% of the image height), a desk top is 0.75 m (26%). Doors and openings are drawn as an empty dark doorway hole of exactly the door size; the door leaf itself is NOT drawn (it is a separate object). Furniture that stands on the floor is NOT drawn (separate objects); only built-in things attached to the wall (windows, boards, shelves fixed to the wall, pipes, vents, switches, lamps on the wall).
```

## 바닥 (FLOOR) · 원경 (FAR) · 물건 (OBJECTS) 공통 규칙

```
FLOOR RULES
Seamless tileable floor texture seen straight from above (top-down orthographic), 1024x1024. The left edge must continue into the right edge and the top into the bottom with no visible seam. Even lighting, no shadows of objects, no objects, no stains larger than a hand.

FAR RULES
Distant background that is seen through windows or open space, 1536x1024, very low contrast and darker than the walls, slightly hazy. The left and right edges must continue into each other (horizontally tileable). Horizon at 55% height.

OBJECT SHEET RULES
A sheet of separate game objects, 1536x1024, transparent background (if transparency is not possible, a perfectly flat #FF00FF magenta background with no shadows on it). Arrange them in a 3x3 grid, one object per cell, each fully inside its cell with a margin, not touching others. Camera: every object faces the viewer squarely (front side parallel to the image, NOT turned left or right, no 3/4 rotation), seen from a little above so only a thin strip of the top surface shows, the same camera for all 9. Size inside the sheet does not matter (it is resized per object later); make each object fill most of its cell. No cast shadows on the ground. Doors closed. Drawers and lids closed.
```

## 정정 (2026-10-21 16:15, 첫 그림 도트화 시험 후 · 최종본)

정비실 벽 1번과 잼트리 물건 모음을 도트화해 봤다(`/mnt/project-files/game/bg_test_1021/`). 벽 320도트 안에 공구 수십 개 같은 잔 디테일은 들어가지 않아 뭉개지고, 물건은 비스듬한 3/4 시점이 섞였다. 그래서 아래 정정을 모든 다음 그림(벽·바닥·원경·물건)에 붙인다. 크기 비율은 Claude가 물건마다 실제 높이로 맞추므로 GPT는 신경 쓰지 않는다. 이미 만든 그림은 다시 그리지 않아도 된다.

```
CORRECTION (applies to every image from now on, walls, floors, far backgrounds and object sheets):
1. These images will be shrunk to a small pixel-art game (a whole wall becomes only 320x220 pixels). Draw for that: FEW, LARGE, simple shapes. At most 5-8 distinct items per wall, each item big; no rows of dozens of small things (no 30 tools, no rows of tiny bottles, no small text-like marks). Large flat color areas, 2-3 tone steps, no fine texture, no noise, no scratches smaller than a hand.
2. Bold, dark outlines (about 6-8 px thick at this size) around every object and every major shape, like 1990s arcade sprites.
3. Object sheets: every object faces the viewer squarely, front side parallel to the image, not rotated left or right (no 3/4 angle), seen from slightly above so only a thin strip of the top shows; the same camera for all nine. Do not worry about relative size between objects; make each one fill most of its cell. Keep the transparent background.
4. Everything else in the original request stays the same.
```

## 장소 목록

각 장소는 GPT 대화 하나: 공통 스타일 + 해당 규칙 + 아래 목록을 붙인다. 같은 장소의 칸 4개는 같은 기둥·같은 벽 마감·같은 조명으로 그리되 내용은 확실히 다르게.

### 1. hq_office · 본부 사무실 (지상)

분위기: 낡은 관공서형 소규모 사무실, 밤 야근. 회녹색 벽, 베이지 블라인드, 형광등. 강조색 없음(따뜻한 스탠드 노란빛 약간).

```
PLACE: a small run-down Korean government agency office at night (wall: grey-green painted plaster with a dark wooden wainscot, pillars: square concrete columns painted the same grey-green).
1. hq_office_wall_1 — two tall windows with half-closed beige blinds, faint city lights outside, a wall clock without numbers between them.
2. hq_office_wall_2 — wall-mounted whiteboard (blank, a few magnets) and a cork notice board with blank papers pinned.
3. hq_office_wall_3 — empty doorway to a dark corridor in the middle, light switch and a fire extinguisher box on the wall.
4. hq_office_wall_4 — built-in wall shelves with binders and boxes (no readable spines), an air-conditioner unit high on the wall.
5. hq_office_floor — worn grey-green vinyl office floor tiles, 4x4 tiles per image.
6. hq_office_far — night city skyline of a Korean city in light fog, apartment blocks and a few lit windows.
7. hq_office_objects — 1 office desk with a flat monitor and papers, 2 office chair, 3 grey steel filing cabinet, 4 two-seat worn leather sofa, 5 low coffee table, 6 water dispenser, 7 potted rubber plant, 8 metal coat rack, 9 office door leaf (grey steel door with small window, closed).
```

### 2. hq_jaemtri · 잼트리 자리 (임무 게시판)

분위기: 사무실 한 구석의 정보 담당 자리. 모니터 빛(푸른색) 강조.

```
PLACE: the information desk corner of the same office (same grey-green wall and pillars as hq_office), lit mostly by blue-white monitor glow.
1. hq_jaemtri_wall_1 — a large cork mission board with blank cards, string and pins connecting them.
2. hq_jaemtri_wall_2 — three wall-mounted monitors showing only abstract blue glow and graphs without text.
3. hq_jaemtri_wall_3 — a window with closed blinds and stacked document boxes on a wall shelf beneath.
4. hq_jaemtri_wall_4 — a small server cabinet built into the wall with blinking green lights and bundled cables.
5. hq_jaemtri_objects — 1 L-shaped desk with two monitors and a keyboard, 2 gaming chair, 3 printer on a stand, 4 stack of cardboard boxes, 5 mini fridge with stickers (no text), 6 desk lamp, 7 trash bin full of paper, 8 floor fan, 9 tall bookshelf with binders.
```
(바닥·원경은 hq_office 것을 쓴다.)

### 3. hq_workshop · 정비실 (지하)

분위기: 지하 장비실. 콘크리트, 노란 안전선, 주황 작업등.

```
PLACE: an underground equipment workshop (wall: bare grey concrete with exposed pipes along the top, pillars: concrete with yellow-black hazard tape at the bottom), warm orange work lamps.
1. hq_workshop_wall_1 — a pegboard full of tools (wrenches, hammers, flashlights) above a fixed workbench shelf.
2. hq_workshop_wall_2 — a row of wall-mounted weapon/gear racks with batons and vests, a locked metal cage panel.
3. hq_workshop_wall_3 — empty doorway with a heavy steel frame, a fuse box and conduit pipes beside it.
4. hq_workshop_wall_4 — large ventilation fan in the wall and a hanging coil of hose and cables.
5. hq_workshop_floor — painted grey concrete floor with faded yellow line fragments and small oil stains.
6. hq_workshop_objects — 1 steel workbench with a vice, 2 rolling tool cart, 3 tall steel locker (doors closed), 4 wooden crate, 5 metal barrel, 6 stack of sandbags, 7 folding stool, 8 floor jack, 9 heavy steel door leaf (closed).
```

### 4. hq_pantry · 탕비실

분위기: 좁고 정겨운 탕비실. 크림색 타일, 따뜻한 형광등.

```
PLACE: a small Korean office pantry room (wall: cream ceramic wall tiles up to 1.2 m and plain cream paint above, pillars: plain cream columns).
1. hq_pantry_wall_1 — a sink counter built into the wall with upper cabinets, a dish rack.
2. hq_pantry_wall_2 — a wall shelf with jars of instant coffee sticks, mugs on hooks, a microwave on a fixed shelf.
3. hq_pantry_wall_3 — a small window with a potted herb on the sill, night outside.
4. hq_pantry_wall_4 — empty doorway, a wall calendar with blank pages, a hanging towel.
5. hq_pantry_floor — light beige checkered vinyl floor.
6. hq_pantry_objects — 1 fridge, 2 espresso/coffee machine on a small cart, 3 round table, 4 two plastic chairs (in one cell), 5 water purifier, 6 trash and recycling bins, 7 vending machine with blank buttons, 8 snack shelf, 9 swinging pantry door leaf (closed).
```

### 5. el_hall · 엘리베이터 홀 (출동 입구)

분위기: 오래된 상가 건물의 엘리베이터 홀. 대리석 벽, 놋쇠 테두리, 빨간 표시등 하나.

```
PLACE: the elevator lobby of an old Korean commercial building at night (wall: pale beige marble panels, pillars: marble with brass trim). Exactly one red accent per image at most (indicator lamp).
1. el_hall_wall_1 — an elevator frame with brass trim around an empty dark rectangular opening (the doors are separate objects), a floor indicator above it with a red lamp but no digits, call buttons beside it.
2. el_hall_wall_2 — plain marble wall with a blank directory board in a brass frame.
3. el_hall_wall_3 — a second elevator frame like 1 but slightly older, its indicator unlit.
4. el_hall_wall_4 — empty doorway to the stairwell with a green emergency-exit light box without text.
5. el_hall_floor — polished dark terrazzo floor with small white chips.
6. el_hall_objects — 1 elevator left door panel (brushed steel, one half of the doors), 2 elevator right door panel, 3 standing ashtray, 4 potted fake plant, 5 wooden bench, 6 caution cone, 7 mop bucket, 8 security desk counter, 9 rope barrier post pair.
```

### 6. el_car · 승강기 안

```
PLACE: the inside of an old elevator car, seen from inside facing the back wall (wall: brushed steel panels with faux-wood lower panels, no pillars: instead the left and right edges of each image are steel panel seams).
1. el_car_wall_1 — the back wall with a full-height mirror with slight stains.
2. el_car_wall_2 — the side wall with the button panel (rows of round buttons without numbers, an alarm button, a small speaker grille).
3. el_car_wall_3 — the back wall with a handrail and a ceiling fan grille near the top.
4. el_car_wall_4 — the inside of the closed doors (two steel panels meeting in the middle) with a tiny emergency phone box.
5. el_car_floor — worn grey rubber floor mat with a raised dot pattern.
```

### 7. lobby · 로비 층

분위기: "평범해 보이는" 사무 건물 로비·복도·휴게실. 차가운 백색 조명, 아주 약간 어긋난 것(시계 바늘 둘다 거꾸로 같은 것은 Claude가 코드로).

```
PLACE: the ground-floor lobby and corridors of an ordinary Korean office building late at night (wall: light grey wall panels with a dark grey skirting, pillars: square columns clad in grey stone), cold white ceiling light.
1. lobby_wall_1 — tall glass curtain wall looking out to the dark street (outside drawn very dark and simple; it will be replaced by the far layer).
2. lobby_wall_2 — reception area back wall with a blank logo plate and a wall clock without numbers.
3. lobby_wall_3 — corridor wall with two empty office doorways side by side and blank room number plates.
4. lobby_wall_4 — break-room wall with a bulletin board with blank notices and a framed abstract painting.
5. lobby_floor — large light grey polished stone floor tiles, 2x2 tiles per image.
6. lobby_far — a quiet night street in fog: street lamps, parked cars, a convenience store glow, no readable signs.
7. lobby_objects — 1 reception counter, 2 lobby sofa, 3 vending machine with blank buttons, 4 potted tall plant, 5 water cooler, 6 standing sign with blank board, 7 waiting chairs row, 8 security gate turnstile, 9 office door leaf (wood veneer, closed).
```

### 8. chase · 추격의 층

분위기: 끝없이 이어지는 관공서 복도. 깜빡이는 형광등, 낡은 녹색 페인트. 깊이별 손상은 Claude가 색·얼룩을 코드로.

```
PLACE: an endless institutional corridor of an old public building (wall: old pale green paint over plaster, dark green lower half, pillars: plain plaster pilasters), flickering fluorescent tubes, worn and scuffed but not destroyed.
1. chase_wall_1 — an empty doorway in the middle with a blank number plate.
2. chase_wall_2 — a row of three small high windows with frosted glass, a radiator under them.
3. chase_wall_3 — fire hose cabinet and a blank evacuation map frame.
4. chase_wall_4 — a long wall with scratch marks and a dead fluorescent lamp hanging loose.
5. chase_floor — old speckled terrazzo floor with long hairline cracks.
6. chase_objects — 1 corridor door leaf (dark green steel, closed), 2 overturned chair, 3 metal trolley, 4 stack of chairs, 5 cardboard boxes, 6 low barricade of desks, 7 trash can on its side, 8 fallen ceiling panel, 9 wheelchair.
```

### 9. test · 시험 층

분위기: 하얗고 깨끗한 시험실. 타일 벽, 빈 표지판(목표 글은 Claude가 코드로 씀).

```
PLACE: a clean, sterile test facility (wall: white square ceramic tiles with grey grout, pillars: white columns with a thin black stripe), bright but slightly greenish ceiling light.
1. test_wall_1 — a large blank black sign panel at eye level (the goal text will be added later), a small speaker above.
2. test_wall_2 — a dark observation window of one-way glass in a steel frame.
3. test_wall_3 — a closed steel roller shutter door with yellow-black hazard stripes on its frame (shutter part of the wall).
4. test_wall_4 — plain tiled wall with three round lamps (unlit) in a row and a drain grate at the base.
5. test_floor — white floor tiles with grey grout and a few faint marks.
6. test_objects — 1 white pedestal, 2 steel cage crate, 3 lever on a post, 4 floor pressure plate, 5 white box with handle, 6 rolling trolley with a covered tray, 7 traffic cone, 8 stool, 9 steel test-chamber door leaf (closed).
```

### 10. apt · 재현의 층 · 아파트 단지

분위기: 1990년대 복도식 아파트. 밤, 노란 복도등. `docs/스테이지설계서_명일아파트.md`의 복도·실내.

```
PLACE: an old 1990s Korean corridor-type apartment block at night. Bays 1-2 are the outdoor corridor (wall: cream painted concrete, pillars: concrete columns), bays 3-4 are the inside of one apartment (wall: faded floral wallpaper, pillars: wooden door-frame-like trims).
1. apt_wall_1 — corridor: an empty doorway for a unit door with a blank number plate, a milk/newspaper box and a small window with a grille.
2. apt_wall_2 — corridor: the outer railing side seen from inside the building is not shown; instead a wall with a gas meter box, a hanging umbrella, a small window with lace curtain glowing yellow.
3. apt_wall_3 — inside: living room wall with a framed family photo (faces not visible, blurred), a wall clock without numbers, an old TV cabinet built in.
4. apt_wall_4 — inside: kitchen wall with a counter, a rice cooker on it, an empty doorway to a dark room.
5. apt_floor — yellowish oiled-paper style vinyl floor (jangpan) with a subtle pattern.
6. apt_far — the opposite apartment block across the courtyard at night, rows of corridor lights, most windows dark.
7. apt_objects — 1 apartment steel door leaf (closed, peephole), 2 shoe rack with shoes, 3 low dining table (bapsang), 4 cushion seats, 5 old TV, 6 standing fan, 7 wardrobe, 8 bicycle, 9 laundry drying rack.
```

### 11. service · 정비 구역

분위기: 승강기 통로 사이의 덕트·지지대 공간. 어둡고 녹슨 갈색, 주황 작업등 몇 개.

```
PLACE: the maintenance zone between elevator shafts (wall: rusty brown riveted steel plates and old concrete, pillars: steel I-beam columns), very dark with a few orange caged work lamps.
1. service_wall_1 — large square ventilation duct running across the wall with an access hatch.
2. service_wall_2 — bundles of cables and pipes with valves, a pressure gauge without numbers.
3. service_wall_3 — an empty dark doorway into a crawlspace with a steel frame.
4. service_wall_4 — scratched wall with old chalk tally marks and a hanging lamp (the "attic" of former agents).
5. service_floor — steel grating floor over darkness.
6. service_far — the inside of a deep vertical elevator shaft seen across, cables and counterweights fading into darkness, for a vertical cell (also 1024x1536 portrait version named service_far_tall).
7. service_objects — 1 steel ladder segment (tileable top and bottom), 2 hanging rope coil, 3 toolbox, 4 sleeping bag on a mat, 5 camping lantern (unlit), 6 backpack, 7 stack of supply crates, 8 broken elevator motor part, 9 steel hatch cover.
```

### 12. guardian · 수호자 방

```
PLACE: three different boss rooms. Each bay is its own room; still use pillars at both edges.
1. guardian_guard_wall — a building security room: a wall of small CCTV monitors showing only static, a key cabinet, a blank shift board.
2. guardian_guard_wall_2 — the same security room, other section: lockers built into the wall, a barred window.
3. guardian_legs_wall — a machine room at the dead end of a corridor: big gears and elevator hoist machinery, cables going up, scratch marks high on the wall.
4. guardian_legs_wall_2 — the same machine room, other section: a large dark hole torn in the wall, broken pipes.
5. guardian_405_wall — apartment unit 405 dining room: old wallpaper, a shrine-like shelf with candles, a wall clock stopped.
6. guardian_405_wall_2 — the same dining room, other section: a sliding door with paper panels, an old calendar with blank pages.
```

## Claude가 하는 일 (받은 뒤)

1. `tools/bg_pixelize.py`: 1536×1024 → 도트 격자(벽 칸 320×220 도트 = 화면 640×440), 장소별 32색, 칸마다 다수결 색(번짐 없음), 명도 조금 낮춤, 마젠타 배경 제거, 물건 덩어리 자르기·실제 높이 맞춤.
2. 바닥: 무늬를 코드에서 원근(앞줄 넓게, 뒷줄 좁게)으로 바닥 띠 440~690에 깔고 타일 줄·그림자.
3. 벽 칸 이어 붙이기: 기둥 가운데에서 이음, 칸 순서는 층 생성(`stage/`)의 조각 표에 맞춤. 깊이별 손상은 팔레트·얼룩 덧칠(코드).
4. 물건: 바닥 접점·문손잡이·앉는 높이 기준점 표(`art/bg/objects.json`).
5. 결과는 통합본(`release/demo/goei-action-game.html`)에만 넣고 「게임 통합 검수」에 알린다.
