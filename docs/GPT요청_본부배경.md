# GPT 요청서 · 본부 장면 배경·물건 (2026-10-22)

주인: 「게임 타일과 배경」 스레드(Claude). 근거: 본부 평면도 `/mnt/project-files/game/본부_평면도.md` (15장면).
규칙은 `docs/GPT요청_게임배경.md` 그대로다: 공통 STYLE, WALL BAY RULES, FLOOR RULES, FAR RULES, OBJECT SHEET RULES, 그리고 「정정」 절의 CORRECTION(적고 큰 형태, 굵은 외곽선, 물건은 정면 평행). 방 이름 글씨·간판 글씨는 그리지 않는다. 사람은 없다. 대신 **자리 물건**(켜진 모니터, 컵, 의자에 걸친 카디건·외투)으로 누가 있는 자리인지 보이게 한다.

## GPT에게 (작업 방법)

- 저장: **`game-src/art/bg/raw/<장소>/<파일 이름>.png`** (아래 이름 그대로). 다 올린 뒤 `game-src/art/bg/raw/README.md` 목록에 덧붙이고 main에 커밋한다.
- 목록을 쉬지 않고 순서대로 전부 만든다. 묻지 않는다. 한도에 걸리면 멈춘 번호부터 이어 한다.
- 크기: 벽 칸·원경·물건 모음 1536×1024, 바닥 1024×1024.
- 이 건물은 종로 뒷골목의 낡은 5층 사무 건물이다. 관리국이 3층과 지하 2개 층을 쓴다. 지상(1~3층)은 낡았지만 손질된 관공서 느낌, 지하는 콘크리트와 철문의 비밀 시설 느낌이다. 모든 장면이 밤이다.

## 장면 이름 (hq/map.ts의 look) → 그림 장소

street → hq_street · lobby → hq_lobby · corridor → hq_corridor · clinic → hq_clinic · interview → hq_interview · office → hq_office + hq_jaemtri · chief → hq_chief · pantry → hq_pantry · supply → hq_workshop + hq_supply · training → hq_training · containment → hq_containment · appraisal → hq_appraisal · lab → hq_lab (+ hq_jaemtri_wall_4) · tooth → hq_tooth · pasta → hq_pasta.
한 장면 안의 벽 칸은 이어지게 그리고(같은 마감·같은 조명), 칸 사이에 검은 기둥을 넣지 않는다. 기둥은 건물 구조(창 사이 기둥)로만 그린다.

## 이미 받은 그림에서 다시 쓰는 것 (새로 그리지 않음)

| 장면 | 다시 쓰는 그림 |
| --- | --- |
| 종합대응팀 사무실 | `hq_office` 벽 4·바닥·원경·물건, `hq_jaemtri` 벽 4·물건(재요청분) |
| 탕비실 | `hq_pantry` 전부 |
| 정비·보급실 | `hq_workshop` 벽 4·바닥·물건 |
| 1층 로비 | `lobby_wall_1`(유리 정문), `lobby_floor` |
| 엘리베이터 홀 | `el_hall` 벽 (층마다) |
| 격리 연구실 | `hq_jaemtri_wall_4`(서버 벽) |

## 붙여 넣을 공통 머리말 (장소마다 맨 앞에)

```
Use exactly the STYLE, WALL BAY RULES, FLOOR RULES, FAR RULES and OBJECT SHEET RULES from docs/GPT요청_게임배경.md, plus its CORRECTION: few large simple shapes (at most 5-8 items per wall), bold dark outlines, flat colors with 2-3 tone steps, no fine texture; object sheets: every object faces the viewer squarely (no 3/4 rotation), thin top strip only, transparent background, each object fills most of its cell. NO text, letters, numbers or room names anywhere (signs and plates stay blank). NO people; show who uses a place only through their belongings. Night. The building: an old 5-storey office building in a back alley of Jongno, Seoul; floors 1-3 are worn but tidy government-office style, basements are bare concrete and steel secret facility style.
```

## 장소 목록

### 1. hq_street · 종로 거리 (바깥, 1.5화면)

```
PLACE: an empty Jongno back street at night, seen from the opposite sidewalk; the "wall" is the row of building fronts (pillars = the narrow concrete gaps/drainpipes between buildings).
1. hq_street_wall_1 — the front of our old 5-storey office building: a glass entrance door with a steel frame (dark inside, door open hole), a small blank plate beside it, the lower 3 m only.
2. hq_street_wall_2 — a closed shop with a lowered metal roller shutter and a dark awning.
3. hq_street_wall_3 — a small Italian pasta restaurant front: warm yellow window, a wooden door hole, a blank hanging sign board, a potted olive tree beside the door is NOT drawn (object).
4. hq_street_wall_4 — a dark alley entrance between two buildings with a blank street-number plate and tangled electric wires above.
5. hq_street_floor — sidewalk of grey square paving blocks with a granite curb line.
6. hq_street_far — the Jongno skyline beyond the rooftops: old low buildings, one tall tower, few lit windows, light fog.
7. hq_street_objects — 1 street lamp post, 2 fire hydrant, 3 trash bag pile, 4 parked scooter, 5 vending machine (blank buttons), 6 potted olive tree, 7 blue public bicycle stand with one bike, 8 traffic cone, 9 stack of beer crates.
```

### 2. hq_lobby · 1층 로비 (1화면)

```
PLACE: the ground-floor lobby of the same old building (wall: beige terrazzo panels up to 1.2 m, cream paint above; pillars: square columns with beige terrazzo).
1. hq_lobby_wall_1 — a wall of small steel mailboxes (blank, no numbers) above a radiator.
2. hq_lobby_wall_2 — a stairwell entrance: an empty doorway showing the first steps going up into the dark, a handrail, a green emergency-exit light box with no text.
3. hq_lobby_objects — 1 empty security desk counter with a small CRT-free monitor and a desk lamp, 2 swivel chair, 3 umbrella stand, 4 standing ashtray, 5 potted rubber plant, 6 short staircase going up seen from the side (concrete steps with a steel handrail), 7 notice board on legs (blank sheets), 8 wooden bench, 9 staircase going down seen from the side (steps sinking into darkness with a handrail).
```

### 3. hq_corridor · 2층 복도 (1화면)

```
PLACE: the short 2nd-floor corridor of the same building (wall: pale green paint over a dark green lower half, clean and maintained; pillars: plaster pilasters).
1. hq_corridor_wall_1 — an elevator frame with a closed steel door pair and a floor indicator without digits.
2. hq_corridor_wall_2 — a fire hose cabinet and one window with a radiator under it, night outside.
3. hq_corridor_wall_3 — an empty doorway with a white frame and a small blank plate (infirmary door), a hand-sanitizer dispenser beside it.
4. hq_corridor_wall_4 — an empty doorway with a wooden frame and a small blank plate (interview room door), a bench-height wall rail.
5. hq_corridor_floor — light grey speckled vinyl floor tiles, 4x4 per image.
```

### 4. hq_clinic · 의무실 (1화면)

```
PLACE: a small first-aid room (wall: white tiles up to 1.2 m, mint-white paint above; pillars: white columns), cool white light.
1. hq_clinic_wall_1 — a ceiling curtain rail with a half-drawn pale green curtain hanging along the wall, an oxygen outlet panel.
2. hq_clinic_wall_2 — a built-in glass-door medicine cabinet with bottles and boxes (no labels), a sink below.
3. hq_clinic_wall_3 — a window with half-closed white blinds and a wall clock without numbers.
4. hq_clinic_wall_4 — an empty doorway and a wall-mounted first-aid box (red cross only, no text).
5. hq_clinic_floor — white vinyl floor with faint grey speckles.
6. hq_clinic_objects — 1 hospital bed with white sheets, 2 IV drip stand, 3 folding privacy screen, 4 rolling instrument tray, 5 wheelchair, 6 stool, 7 small bedside cabinet with a water cup, 8 medical waste bin, 9 oxygen tank on a cart.
```

### 5. hq_interview · 면담실 (0.7화면)

```
PLACE: a small interview room (wall: warm grey acoustic panels; pillars: plain columns), one warm desk lamp light.
1. hq_interview_wall_1 — a window with closed beige blinds and a box of tissues on the sill.
2. hq_interview_wall_2 — a plain wall with a large dark mirror (one-way glass) and a wall clock without numbers.
3. hq_interview_objects — 1 plain square table, 2 chair (survivor side), 3 chair (agent side), 4 small cassette voice recorder, 5 two paper cups of water, 6 tissue box, 7 desk lamp, 8 coat rack, 9 water dispenser.
```

### 6. hq_office · 종합대응팀 사무실 추가분 (2.5화면, 기존 hq_office·hq_jaemtri와 같은 벽)

```
PLACE: the same team office as hq_office (grey-green plaster wall, dark wooden wainscot, grey-green square columns). These are additional bays and belongings.
1. hq_office_wall_5 — the inner wall with TWO empty doorways side by side: a dark wooden door frame (chief's office) and a plain frame (pantry), a blank plate beside each.
2. hq_office_wall_6 — a window corner with two tall windows and a radiator, night city outside, curtains tied back.
3. hq_office_objects_2 — 1 team desk with an OFF monitor, papers and a mug (empty seat), 2 team desk with an ON monitor and a coat hanging on the chair (someone's seat), 3 office chair with a beige cardigan draped over it, 4 wheeled whiteboard (blank, magnets and pinned cards), 5 large photocopier, 6 meeting table (long, low), 7 condensed-milk coffee cup with a straw on a coaster (small object, fill the cell), 8 tin of instant coffee sticks (small object, fill the cell), 9 stack of case files with paper clips.
```

### 7. hq_chief · 부장실 (0.8화면)

```
PLACE: the department chief's office (wall: dark wood panelling up to 1.2 m, cream wallpaper above; pillars: dark wooden pilasters), one green banker's lamp glow.
1. hq_chief_wall_1 — a wall-to-wall built-in bookshelf with binders and old books (no readable spines).
2. hq_chief_wall_2 — a window with dark red curtains, a framed landscape painting beside it, a wall clock without numbers.
3. hq_chief_objects — 1 large executive desk with piles of documents to approve and a green banker's lamp, 2 high-back leather chair, 3 two-seat guest sofa, 4 low coffee table with a tea set, 5 steel safe, 6 potted orchid, 7 filing cabinet, 8 coat stand with a long coat, 9 standing globe.
```

### 8. hq_supply · 정비·보급실 추가분 (1.5화면, 기존 hq_workshop과 같은 벽)

```
PLACE: the same basement workshop as hq_workshop (bare grey concrete, pipes along the top, columns with yellow-black hazard tape). Additional bays and belongings for the supply side.
1. hq_supply_wall_1 — a wide metal roller shutter (closed) of a loading bay with hazard stripes on the frame.
2. hq_supply_wall_2 — an empty heavy steel doorway (to the training range) with a red warning lamp above it (unlit) and a fire extinguisher.
3. hq_supply_objects — 1 tall steel shelf unit with supply boxes, 2 tall steel shelf unit with ammo cases and med kits, 3 flat cargo cart with crates (the supply officer's cart), 4 gear locker with a vest hanging on its open door, 5 green ammo box, 6 first-aid kit case, 7 stack of plastic supply bins, 8 clipboard on a hook stand, 9 hand truck dolly.
```

### 9. hq_training · 훈련장·사격장 (B1, 2화면)

```
PLACE: an underground training hall and shooting range (wall: grey concrete with dark green padded panels up to 2 m; pillars: concrete columns with padding), bright but cold light.
1. hq_training_wall_1 — padded wall with a blank record board (big black board with empty rows, no text).
2. hq_training_wall_2 — padded wall with hooks holding ear protectors and protective vests.
3. hq_training_wall_3 — the shooting range: three lane openings with separating booth walls, paper targets far at the back of each lane, a yellow line.
4. hq_training_wall_4 — concrete wall with a big ventilation grille and a water fountain.
5. hq_training_floor — dark green rubber training mat tiles with faint seams.
6. hq_training_objects — 1 training dummy on a stand, 2 hanging punching bag, 3 shooting booth partition with a small shelf, 4 paper target on a stand, 5 weight rack with dumbbells, 6 bench, 7 stack of floor mats, 8 rack of training batons, 9 ammo crate.
```

### 10. hq_containment · 격리 구역 복도 (B2, 2화면)

```
PLACE: the secret containment corridor two floors underground (wall: smooth grey concrete with steel bands; pillars: steel-clad columns), dim cold light with red emergency lamps.
1. hq_containment_wall_1 — a heavy security door frame (open dark hole) with a card reader and yellow-black stripes.
2. hq_containment_wall_2 — a wall with two built-in glass display cases (empty shelves inside, soft light), a red emergency lamp between them.
3. hq_containment_wall_3 — an empty doorway with a steel frame (appraisal room) and a small blank plate, a pipe running along the wall.
4. hq_containment_wall_4 — an empty doorway with a thick airlock-style frame (isolation lab), a pressure gauge without numbers.
5. hq_containment_wall_5 — the corridor end: a massive rusted steel door with rivets and a small barred window (the tooth fairy cell), chains on the floor are NOT drawn.
6. hq_containment_floor — dark grey epoxy floor with a yellow guide line.
7. hq_containment_objects — 1 free-standing glass display case (empty), 2 pedestal display case (empty), 3 red emergency lamp on a stand, 4 security camera on a pole, 5 caution sign stand (blank), 6 steel bench, 7 fire extinguisher cabinet, 8 coiled chain, 9 sealed specimen crate.
```

### 11. hq_appraisal · 감정실 (B2, 1화면)

```
PLACE: an appraisal room for anomalous artifacts (wall: dark grey lab panels; pillars: steel columns), blue-white light.
1. hq_appraisal_wall_1 — a wall of small steel storage drawers (no labels).
2. hq_appraisal_wall_2 — a plain wall with a large dark screen (off) and a lamp arm mounted above a counter.
3. hq_appraisal_objects — 1 appraisal table with a lit magnifier lamp, 2 holographic projector on a stand with a faint blue cone of light, 3 pair of white gloves on a tray (small object, fill the cell), 4 artifact case with foam inserts, 5 tall stool, 6 small safe, 7 specimen jars on a cart, 8 scale, 9 rolling drawer cabinet.
```

### 12. hq_lab · 격리 연구실 (B2, 1.5화면)

```
PLACE: an isolation research lab (wall: white lab panels gone slightly grey, steel trim; pillars: steel columns), green-white light.
1. hq_lab_wall_1 — a big glass isolation chamber window set into the wall, dark inside with a faint shape-less mist.
2. hq_lab_wall_2 — a lab counter built into the wall with cabinets and a fume hood.
3. hq_lab_objects — 1 lab bench with test tubes and a microscope, 2 specimen refrigerator, 3 lab stool with a white coat draped over it, 4 centrifuge, 5 messy desk with notes and a tin of instant coffee sticks, 6 rolling whiteboard (blank with drawn arrows only), 7 gas cylinder on a cart, 8 biohazard bin, 9 server rack (small).
```

### 13. hq_tooth · 이빨 요정 격리실 (B2 끝, 1화면)

```
PLACE: a strange containment cell (wall: old red brick behind steel bars; pillars: steel columns), warm candle-like light, eerie but cute.
1. hq_tooth_wall_1 — a wall of thick steel cage bars with darkness behind and tiny glints like teeth hanging from strings.
2. hq_tooth_wall_2 — brick wall with a steel slot box built in (a gift-box intake slot with a flap), a small brass bell.
3. hq_tooth_objects — 1 small tree made of white teeth (no gore, cute and odd), 2 wrapped gift box, 3 stack of gift boxes, 4 brass candle stand, 5 steel cage (small), 6 jar of teeth, 7 velvet cushion, 8 old wooden stool, 9 pile of ribbons.
```

### 14. hq_pasta · 파스타집 (바깥, 1화면)

```
PLACE: the inside of a small warm Italian pasta restaurant across the street (wall: cream plaster with dark wood trim; pillars: wooden posts), warm yellow light.
1. hq_pasta_wall_1 — a kitchen pass-through window with a steel counter and warm light from the kitchen.
2. hq_pasta_wall_2 — a wall with a wine bottle shelf and a framed picture of an Italian village.
3. hq_pasta_floor — dark wooden floor boards.
4. hq_pasta_objects — 1 long dining table with a checkered cloth, 2 wooden chair, 3 wooden chair (other side), 4 plate of pasta (small, fill the cell), 5 bottle and glasses (small), 6 potted basil, 7 coat rack, 8 menu stand (blank), 9 bread basket.
```

## 장수

벽 칸 33, 바닥 6, 원경 1, 물건 모음 13 = **53장**. 다시 쓰는 그림은 위 표.
