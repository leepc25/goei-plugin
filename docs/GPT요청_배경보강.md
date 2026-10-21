# GPT 요청서 · 배경 보강 (2026-10-22, 검수 12차 결함)

담당: 「게임 타일과 배경」 스레드(Claude). 검수에서 계속 떨어진 부분은 그림 자체가 비어 있거나 번진 것들입니다. 지금은 코드로 땜질해 둔 상태라, 진짜 그림으로 바꿉니다. 명패, 게시판·액자 속 내용, 표지판, 엘리베이터 문, 탕비실·거리 바닥, 낮은 단 자리의 소품, 층 소품 몇 가지입니다.
규칙은 `docs/GPT요청_게임배경.md`를 그대로 따릅니다. 공통 STYLE, FLOOR RULES, OBJECT SHEET RULES와 그 문서 「정정」 절의 CORRECTION이 모두 적용됩니다. **사람·적·괴이·피는 그리지 않습니다. 글자·숫자도 어디에도 넣지 않습니다**(방 이름과 호수는 게임이 그림 위에 따로 적습니다). 뜻은 그림 기호로만 나타냅니다.

## GPT에게 (작업 방법)

- 저장 경로는 **`game-src/art/bg/raw/<장소>/<파일 이름>.png`**이고, 파일 이름은 아래에 적힌 그대로 씁니다. 한 장을 끝낼 때마다 main에 커밋합니다(Claude가 장마다 바로 도트화합니다).
- 목록은 순서대로 전부 만듭니다. 중간에 묻지 않습니다. main을 새로 받았는데 그 파일이 이미 있으면 건너뜁니다.
- 크기: 물건 모음은 **1536×1024, 투명 바탕, 3×3 칸에 9개**(칸 순서는 왼쪽 위부터 1~9)입니다. 바닥은 **1024×1024, 이음매 없이 반복되는 위에서 본 무늬**입니다.
- 물건은 정면을 보고 섭니다(3/4 회전 금지). 윗면은 얇게만 보이고, 각 물건이 자기 칸을 거의 채웁니다. 굵고 어두운 외곽선, 평평한 색에 2~3단 명암, 잔 질감은 넣지 않습니다.
- 다 올린 뒤에는 `game-src/art/bg/raw/README.md` 목록에 덧붙이고, `docs/GPT_요청_목록.md`의 이 줄 상태를 「받음 N장(커밋)」으로 바꿉니다.

## 붙여 넣을 공통 머리말 (장마다 맨 앞에)

```
Use exactly the STYLE, FLOOR RULES and OBJECT SHEET RULES from docs/GPT요청_게임배경.md, plus its CORRECTION: few large simple shapes, bold dark outlines, flat colors with 2-3 tone steps, no fine texture or blur, no soft gradients. Object sheets: 1536x1024, transparent background, 3x3 grid, one object per cell filling most of it, every object faces the viewer squarely. NO letters, NO numbers, NO words anywhere: meaning only through simple pictograms. NO people, NO monsters, NO blood. Ordinary Korean buildings that feel slightly wrong.
```

## 목록 (모두 8장)

### 1. 표지판 모음 — `signs/signs_objects.png`
입간판 「안내·점검·표지」 대신 쓸 진짜 표지판입니다. 층마다 다른 것을 골라 세웁니다.
```
PLACE: signage of a Korean office / apartment building. PALETTE per sign as in real life (green exit, yellow caution, blue info, white boards).
1 floor guide map board on a metal stand: simple room blocks and a red dot, no text.
2 green emergency exit sign box mounted on a short wall bracket (running figure pictogram and door).
3 yellow A-frame wet-floor caution stand (slipping figure pictogram).
4 blue elevator notice plate on a stand (elevator doors pictogram with up/down triangles).
5 inspection clipboard board on a stand: grid of boxes with green tick marks and a red round stamp, lines as plain bars.
6 red no-entry sign on a weighted post (white bar on red circle).
7 lost-and-found cork board on a stand with pinned paper notes and one pinned photo (photo shows only an empty room).
8 old wooden notice frame on legs with a faded paper poster of a simple building drawing.
9 standing ashtray-bin combo with a small no-smoking pictogram plate.
```

### 2. 문 옆 명패 모음 — `plates/plates_objects.png`
문 옆에 붙이는 작은 판입니다. 글자 대신 방 기호를 넣고, 모두 같은 크기·같은 비율(가로가 세로의 2배)로 그립니다.
```
PLACE: small door plaques beside office doors, brushed metal or plastic, screwed to the wall, wide 2:1 shape, a simple pictogram on the left half and two plain grey bars on the right half (no text).
1 wrench pictogram (machine room). 2 stacked books (archive). 3 bed (night-duty room). 4 two people at a table (meeting room).
5 box (storage). 6 telephone handset (counselling). 7 cross (first aid). 8 key (manager's office). 9 apartment door plate: dark grey plate with a small doorbell button and a blank light strip.
```

### 3. 게시판·액자 모음 — `boards/boards_objects.png`
벽에 거는 판입니다. 안이 빈 회색 블록이면 안 되고, 칸마다 내용이 꽉 찬 그림이어야 합니다.
```
PLACE: things hung on corridor walls, front view, each fully detailed inside (never empty grey blocks).
1 cork board crowded with pinned paper notices of different sizes, colored pins, one red string between two notes. Notice "writing" = thin grey bars.
2 missing-person style poster board: a photo of an empty hallway, grey bars, a tear-off fringe at the bottom.
3 framed landscape painting: evening mountains and a lake.
4 framed old family photo: only an empty living room with a sofa (no people).
5 framed certificate: ornate border, a gold seal, grey bars.
6 whiteboard with marker diagrams: boxes, arrows, a circled spot, a few sticky notes.
7 small framed floor plan of the building with a red dot.
8 round wall clock with hands stopped at an odd time.
9 framed blank-faced corporate portrait: just a dark suit and tie on a grey backdrop, the head area hidden behind a light reflection on the glass (no face drawn).
```

### 4. 엘리베이터 문 — `el_hall/el_hall_objects_2.png`
지금 쓰는 엘리베이터 문짝은 번진 세로 그라데이션입니다. 아래 칸 1·2는 기존 `el_hall_objects_1`의 1번(왼쪽 문짝)과 2번(오른쪽 문짝)을 같은 크기·같은 문틀 위치로 다시 그린 것입니다.
```
PLACE: elevator of an old Korean office lobby, brushed stainless doors in a bronze frame, matching el_hall_wall_1..4 (beige marble wall).
1 left elevator door leaf with the left half of the bronze frame (frame on the LEFT edge), closed, flat brushed metal with 2-3 hard tone bands and one vertical highlight stripe. NO blurry gradients, NO yellow streaks.
2 right elevator door leaf, mirror of 1 (frame on the RIGHT edge).
3 the whole closed elevator: both doors + bronze frame + floor indicator box above (arrows only).
4 the same elevator half-open, dark-but-readable cabin inside with a handrail.
5 call button panel (up/down buttons, one lit).
6 floor indicator box (two triangle lamps, one lit, no numbers).
7 service elevator with scratched steel doors and a yellow-black floor edge.
8 elevator doors with an "out of order" chain and a cone in front (no text).
9 old cage-style freight elevator gate, closed.
```

### 5. 탕비실 바닥 — `hq_pantry/hq_pantry_floor.png` (기존 파일 덮어쓰기)
```
FLOOR (1024x1024, seamless, top-down): office pantry vinyl floor of LARGE square tiles (each tile = 1/4 of the image width), two very close beige tones, thin darker grout, a few soft scuff marks. NOT a small checkerboard, NOT high contrast.
```

### 6. 거리 보도 — `hq_street/hq_street_floor.png` (기존 파일 덮어쓰기)
```
FLOOR (1024x1024, seamless, top-down): Korean back-alley sidewalk of rectangular concrete pavers in running bond (each paver = 1/4 width, 1/8 height), 3-4 cool grey tones mixed, dark grout, one drain grate, a few stains. NOT a checkerboard.
```

### 7. 낮은 단 자리 소품 — `props/props_objects.png`
층 바닥을 가로지르는 「낮은 단」(점프로 넘는 30~45cm 장애물) 자리에 놓을 소품입니다. 모두 **가로로 길고 낮게**(가로가 높이의 3~5배), 정면에서 본 모습으로 그립니다.
```
PLACE: low obstacles lying across a building floor, front view, wide and low.
1 low concrete curb step with a chipped edge and a yellow-black edge stripe.
2 row of wooden pallets stacked two high.
3 black rubber cable protector ramp with yellow lids.
4 long low planter box with dry shrubs.
5 fallen metal shelf lying on its side.
6 row of sandbags.
7 two plastic step stools and a toolbox in a row.
8 low steel barrier bench bolted to the floor.
9 raised floor panel frame with one panel lifted.
```

### 8. 층 소품 추가 — `props/props_objects_2.png`
층마다 같은 물건만 반복되지 않도록 추가하는 소품입니다(로비·아파트·사무층 공용).
```
PLACE: everyday objects on floors of a Korean building, front view.
1 water cooler with a blue bottle. 2 coat rack with one coat. 3 umbrella stand with umbrellas. 4 red fire extinguisher cabinet (wall). 5 shoe cabinet with slippers.
6 mop bucket with mop. 7 stack of folding chairs. 8 office trolley with boxes. 9 tall potted rubber plant.
```

## Claude가 하는 일 (받은 뒤)

장소마다 도트화하고(방법 B, 32색), 물건을 잘라 실제 높이에 맞춥니다. 그다음 할 일:
- 입간판·명패·게시판은 새 그림으로 바꾸고, 코드로 그리던 포스터와 명패 글씨 땜질은 지웁니다.
- 엘리베이터 문의 코드 금속칠, 탕비실·거리의 코드 타일은 지우고 GPT 그림을 씁니다.
- 낮은 단은 props 소품 그림으로 그립니다(「게임 전투와 조작」과 합침).
