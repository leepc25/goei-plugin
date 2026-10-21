# GPT 요청서 · 층별 배경·물건 추가 (2026-10-22 밤)

주인: 「게임 타일과 배경」 스레드(Claude). 지금 침묵·어둠·퍼즐·심층 네 층은 자기 그림이 없어 추격의 층·시험 층·정비 구역 그림을 빌려 쓴다. 재현의 층 하위 변형(붉은 벽·빈집)도 보통 아파트와 똑같이 보인다. 층마다 다르게 보이도록 이 목록을 그린다.
규칙은 `docs/GPT요청_게임배경.md` 그대로다: 공통 STYLE, WALL BAY RULES, FLOOR RULES, OBJECT SHEET RULES, 그리고 「정정」 절의 CORRECTION. 적·사람·괴이는 그리지 않는다(적은 따로 만든다). 글씨·숫자는 어디에도 없다.

## GPT에게 (작업 방법)

- 저장: **`game-src/art/bg/raw/<장소>/<파일 이름>.png`** (아래 이름 그대로). 다 올린 뒤 `game-src/art/bg/raw/README.md` 목록에 덧붙이고 main에 커밋한다.
- 목록을 순서대로 전부 만든다. 묻지 않는다. 장소 하나를 끝낼 때마다 커밋한다(Claude가 장소별로 바로 도트화한다).
- 크기: 벽 칸·물건 모음 1536×1024, 바닥 1024×1024.
- 같은 장소의 벽 칸 4장은 이어지게(같은 마감·같은 조명) 그리고, 칸 양 끝 기둥 중심에서 이어진다.
- 분위기를 하나로 몰지 않는다: 장소마다 주된 색이 다르다(아래 PALETTE 줄).

## 붙여 넣을 공통 머리말 (장소마다 맨 앞에)

```
Use exactly the STYLE, WALL BAY RULES, FLOOR RULES and OBJECT SHEET RULES from docs/GPT요청_게임배경.md, plus its CORRECTION: few large simple shapes (at most 5-8 items per wall), bold dark outlines, flat colors with 2-3 tone steps, no fine texture; object sheets: every object faces the viewer squarely (no 3/4 rotation), thin top strip only, transparent background, each object fills most of its cell. NO text, letters or numbers anywhere (signs, plates and boards stay blank). NO people, NO monsters, NO blood or gore. These are floors inside an uncanny "dimension elevator" building: ordinary Korean places that feel slightly wrong.
```

## 장소 목록 (모두 28장)

### 1. silent · 침묵의 층 (6장)

```
PLACE: a hushed old reading hall of a 1980s Korean public library merged with a quiet traditional house; thick carpets, heavy curtains, everything muffled. PALETTE: deep green and dark wood brown with dull brass, cream paper.
1. silent_wall_1 — tall dark wooden bookcase wall, books as large flat blocks, a brass reading lamp on the bookcase ledge.
2. silent_wall_2 — heavy velvet curtains closed over a tall window, a stopped grandfather clock built into the wall niche.
3. silent_wall_3 — a wooden double door (open dark hole) with a blank brass plate, padded acoustic panels on both sides.
4. silent_wall_4 — wall of old wooden card-catalogue drawers (blank labels) under a row of framed blank paintings.
5. silent_floor — dark green carpet with a worn wine-red runner pattern made of large simple shapes.
6. silent_objects — 1 stopped grandfather clock, 2 long reading table with green lamps, 3 wooden chair, 4 rolled-up carpet, 5 dish rack shelf with plates, 6 book cart, 7 tall bookshelf, 8 gramophone on a stand, 9 stack of books on the floor.
```

### 2. dark · 어둠의 층 (6장)

```
PLACE: an abandoned basement office floor with every light dead; only cold emergency light. Draw it readable, mid-dark, NOT pitch black (the game darkens it further in code). PALETTE: cold navy and slate grey with one sick green emergency light.
1. dark_wall_1 — row of dead fluorescent fixtures hanging crooked from the ceiling, office partition panels below.
2. dark_wall_2 — exposed pipes and ducts running along the wall, a valve wheel, a closed steel door.
3. dark_wall_3 — dark office window to an empty room (black), a green emergency exit light box with a blank pictogram.
4. dark_wall_4 — wall with a broken switchboard panel open, cables hanging out, a fallen ceiling tile hole above.
5. dark_floor — dark grey vinyl tiles with a few large dark puddles and stains (simple shapes).
6. dark_objects — 1 knocked-over office chair, 2 dead fluorescent tube fixture lying on the floor, 3 pipe section with valve, 4 steel desk with an old dark monitor, 5 water-damaged cardboard boxes, 6 flashlight lying on its side (off), 7 fallen ceiling tiles pile, 8 metal bucket under a drip, 9 standing floor lamp (off).
```

### 3. puzzle · 퍼즐과 선택의 층 (6장)

```
PLACE: a too-clean, repeating corridor of identical doors, like a hotel or government building copied many times; slightly wrong symmetry. PALETTE: pale mint and off-white with mustard yellow doors, black trims.
1. puzzle_wall_1 — two identical mustard doors (closed) side by side, an identical framed picture between them.
2. puzzle_wall_2 — the same picture frame repeated three times in a row, one hung upside down.
3. puzzle_wall_3 — a big blank sign board on the wall with a blank arrow, a potted plant under it.
4. puzzle_wall_4 — a wall panel with three large switches and three lamps (one lit), a closed mustard door.
5. puzzle_floor — checkerboard of large mint and white tiles.
6. puzzle_objects — 1 framed picture (plain landscape), 2 same framed picture hung upside down, 3 potted plant, 4 blank direction sign on a stand, 5 large wall switch box, 6 pedestal with a cube on it, 7 two identical stools, 8 small table with a bell, 9 hourglass on a stand.
```

### 4. deep · 심층 (6장)

```
PLACE: the deepest floors where several remembered places blur together: a corridor wall that turns into a house wall, a staircase going into the ceiling, doors at wrong heights. Keep it calm and eerie, NOT gory. PALETTE: dusty violet and ash grey with faded old-photo sepia.
1. deep_wall_1 — an apartment corridor wall that changes halfway into old house wallpaper, a door frame with no door.
2. deep_wall_2 — a staircase rising up into the ceiling and ending, a handrail.
3. deep_wall_3 — a door placed too high on the wall, a small window at floor level.
4. deep_wall_4 — a wall of many old family photo frames, all blank, one large empty frame.
5. deep_floor — floorboards that become apartment tiles in large patches.
6. deep_objects — 1 a door frame standing alone, 2 a lone old wardrobe, 3 a pile of identical shoes, 4 a payphone on a post, 5 a child's tricycle, 6 an empty birdcage on a stand, 7 stack of old suitcases, 8 a ring of unlit candles, 9 a melted-looking chair.
```

### 5. apt 하위 변형 · 붉은 벽 / 빈집 (4장)

저장 폴더가 따로다: `raw/apt_red/apt_red_wall_N.png`, `raw/apt_vacant/apt_vacant_wall_N.png` (보통 아파트 벽과 섞이지 않게).

```
PLACE: the same Korean apartment complex corridor as apt_wall_1..4 (same camera, same door spacing), in two variants.
1. apt_red_wall_1 — the corridor painted deep dull red, an apartment door with a red door frame, a dark hand-shaped mark on the wall (simple flat shape, not blood).
2. apt_red_wall_2 — red wallpaper corridor with an empty door frame (no door) and a red fuse box.
3. apt_vacant_wall_1 — an abandoned corridor: door left ajar (dark hole), dust sheets taped over a window, an old shoe rack covered in dust.
4. apt_vacant_wall_2 — peeling grey walls, an unplugged old fridge pushed against the wall, a dusty mailbox row (blank).
```

## Claude가 하는 일 (받은 뒤)

장소별로 도트화(장소 팔레트 32색, 칸 다수결)하고 물건을 잘라 실제 높이로 맞춘 뒤, `art/bg.ts`의 층 → 장소 연결(`placeFor`)과 물건 연결을 바꾼다. 원본은 `raw`에 그대로 둔다.
