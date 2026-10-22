# GPT 요청서 · 본부 욕실·쓰는 집기 (2026-10-22)

주인: 「본부 다시 만들기」 스레드(Claude). 사용자 지적: 본부 집기가 전부 벽에 붙은 장식이고, 침대·의자·책상을 쓸 수 없고, 욕실이 없다.
본부 집기는 이제 바닥 앞·중간·뒤 줄에 따로 세우고 쟈알디가 그 위에 앉고 눕는다. 그래서 **쟈알디가 앉는 높이·눕는 높이가 맞는 옆모습 집기**와 **욕실 한 곳**이 필요하다.

규칙은 `docs/GPT요청_게임배경.md` 그대로다: 공통 STYLE, WALL BAY RULES, FLOOR RULES, OBJECT SHEET RULES, 그리고 CORRECTION(적고 큰 형태, 굵은 어두운 외곽선, 평면 채색 2~3단, 물건은 정면 평행·윗면은 얇은 띠만). 글씨·숫자 없음. 사람 없음. 밤.

## GPT에게 (작업 방법)

- 저장: **`game-src/art/bg/raw/<장소>/<파일 이름>.png`** (아래 이름 그대로). 순서대로 묻지 말고 전부, 한 장마다 커밋·푸시, 이미 있으면 건너뛰기.
- 크기: 벽 칸·물건 모음 1536×1024, 바닥 1024×1024. 물건 모음은 투명 배경(안 되면 그림자 없는 #FF00FF 단색), 3×3 칸에 하나씩.
- 다 올린 뒤 `game-src/art/bg/raw/README.md` 목록에 덧붙이고 이 문서 목록 표(docs/GPT_요청_목록.md)의 상태를 「받음」으로 고친다.
- 크기 기준: 사람 키 1.65 m. 아래 괄호의 높이·길이를 꼭 지킨다(쟈알디가 그 높이에 앉고 눕는다).

## 붙여 넣을 공통 머리말 (장소마다 맨 앞에)

```
Use exactly the STYLE, WALL BAY RULES, FLOOR RULES and OBJECT SHEET RULES from docs/GPT요청_게임배경.md, plus its CORRECTION: few large simple shapes, bold dark outlines, flat colors with 2-3 tone steps, no fine texture; object sheets: every object faces the viewer squarely (front side parallel to the image, no 3/4 rotation), only a thin strip of the top surface shows, transparent background, each object fills most of its cell, no cast shadow. NO text, letters or numbers anywhere. NO people. Night. The building: an old 5-storey office building in a back alley of Jongno, Seoul, used by a secret government agency; floors 1-3 are worn but tidy government-office style.
Keep real proportions: a person is 1.65 m tall. Respect every size given in brackets.
```

## 1. hq_bath · 3층 샤워실·욕실 (새 장소)

```
PLACE: the staff shower and bath room on the 3rd floor of the same building (wall: small white square tiles up to 1.6 m, pale grey-blue paint above, a thin dark-blue tile border line; clean, a little old; cool white light).
1. hq_bath_wall_1 — plain tiled wall with a row of chrome towel hooks (two hanging white towels) and a small frosted high window, night outside.
2. hq_bath_wall_2 — plain tiled wall with a long rectangular mirror (reflection only a soft blue-grey gradient, no people) and a small wall lamp above it.
3. hq_bath_wall_3 — an empty doorway (door hole, white frame, 2.1 m high) on the left third, plain tiled wall on the rest, a small blank plate beside the door.
4. hq_bath_wall_4 — plain tiled wall with a chrome shower pipe, a round shower head at 2.0 m and a single tap at 1.1 m on the right half, a small tiled shelf niche on the left half.
5. hq_bath_floor — small grey-white square anti-slip floor tiles with one round steel drain, seamless.
6. hq_bath_objects — 1 white enamel bathtub seen from its long side (1.7 m long, rim at 0.55 m, chrome tap at the left end, the inside is NOT visible, only the front wall of the tub and a thin rim), 2 open shower stall seen from the front (two white tiled side walls 1.9 m high, a white shower curtain pushed to the left on a rail, a low tray step on the floor, the back is open so it stands in front of the wall), 3 washbasin vanity (counter 0.85 m high, 1.2 m wide, white basin, chrome tap, small cupboard doors below), 4 a closed toilet stall (grey partition walls and a closed door, 2.0 m high, 0.9 m wide), 5 chrome towel rack on legs with two folded white towels (1.0 m), 6 woven laundry basket (0.5 m), 7 wooden locker-room bench seen from the front (0.45 m high, 1.4 m long), 8 small steel shelf with three plain shampoo bottles and a soap dish, no labels (1.0 m), 9 a plastic bath stool with a basin on it (0.35 m).
```

## 2. hq_furniture · 쓰는 집기 1 (앉고 눕는 것)

```
PLACE: furniture that a person actually sits on, lies on or works at, for the same agency building. Side-facing items face RIGHT.
hq_furniture_objects — 1 hospital bed seen from its LONG side (2.0 m long, mattress top at 0.6 m, white sheet and a pillow at the LEFT end, steel frame, small wheels, a short steel headboard at the left), 2 a three-seat brown leather sofa seen from the front (2.0 m wide, seat at 0.45 m, back at 0.85 m, long enough to lie on), 3 a black office chair seen exactly from the SIDE facing right (seat at 0.48 m, back 1.05 m, five-star base), 4 a plain wooden chair seen exactly from the SIDE facing right (seat at 0.45 m, back 0.9 m), 5 an office desk seen from the front (1.4 m wide, top at 0.75 m) with one lit monitor (screen soft blue, no text), keyboard, a stack of papers and a mug, and a low grey fabric partition panel rising behind it to 1.15 m, 6 a long dining table for six seen from the front (2.4 m wide, 0.75 m high, white tablecloth hanging down), 7 an L-shaped security reception counter seen from the front (2.0 m wide, 1.1 m high, dark wood front panel, two small lit CCTV monitors and a desk lamp on top, screens show grey blurry rooms, no text), 8 a waist-high steel security turnstile gate seen from the front (1.0 m high, card reader with a small green light), 9 a waiting bench with three plastic seats on a steel frame seen from the front (seat at 0.45 m, 1.6 m wide).
```

## 3. hq_furniture · 쓰는 집기 2 (빛·안내·앞쪽 가림)

```
PLACE: same building, lights, signs and big foreground things.
hq_furniture_objects_2 — 1 a long ceiling fluorescent light fixture seen from slightly below (1.2 m long, glowing white tube in a steel housing), 2 a hanging pendant lamp with a dark metal shade and a warm glowing bulb (0.5 m), 3 a wall-mounted CCTV camera on a short bracket (0.4 m), 4 a floor directory board on two legs (1.7 m high, 0.9 m wide) with five horizontal colored bands for five floors and small plain pictogram squares, NO letters or numbers, 5 a rolling whiteboard on wheels (1.8 m high, 1.4 m wide) with marker scribbles, arrows and stuck notes, NO letters, 6 a heavy standing punching bag on a round base (1.7 m), 7 a shooting booth seen from the front (waist-high counter 1.1 m, two side panels 1.9 m high, a pair of ear-muffs on the counter), 8 a tall potted indoor plant (rubber tree, 1.6 m), 9 a square concrete building column segment with a thin dark baseboard (2.6 m high, 0.5 m wide).
```

## 높이 표 (tools/bg_pixelize.py heights.json에 Claude가 넣는다)

| 시트 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| hq_bath_objects | 0.6 | 2.0 | 0.85(+거울 없음) | 2.0 | 1.0 | 0.5 | 0.45 | 1.0 | 0.5 |
| hq_furniture_objects | 0.75 | 0.85 | 1.05 | 0.9 | 1.15 | 0.95 | 1.25 | 1.0 | 0.85 |
| hq_furniture_objects_2 | 0.25 | 0.9 | 0.4 | 1.7 | 1.8 | 1.7 | 1.9 | 1.6 | 2.6 |
