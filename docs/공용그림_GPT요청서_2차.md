# GPT 요청서 · 공용 괴이 그림 2차 (32장, 2026-10-21)

> **⚠ Claude 반성 · 2026-10-31 (사용자 지시로 문서마다 남김)**
> 2026-10-31 Claude는 다음 잘못을 저질렀다. 이 문서를 읽는 모든 Claude는 같은 짓을 하지 않는다.
> 1. **사용자 결정을 무시했다.** 콘쥬스는 사용자가 10-26에 20세로 정했고 인계서에도 적혀 있었는데, 옛 Claude 문장(teenage high school girl)을 근거로 화장실·샤워 그림을 거부하고, 사용자가 직접 뽑은 화장실 줄까지 팩에서 뺐다. 옷도 제복인데 교복이라고 단정했다.
> 2. **사용자 말에 토를 달고 같은 주장을 되풀이했다.** 사용자가 여러 번 지적했는데도 근거를 다시 확인하지 않아 몇 시간을 허비하게 했다.
> 3. **허락 없이 문서를 지웠다.** 「지침을 지우라」는 말만 듣고 목록을 보여 주지도 않고 96개를 지웠다가 되살렸다(결과물 삭제 금지 규칙 위반).
> 4. **문장을 덧대기만 하며 PixelLab을 낭비했다.** 이성해 점프 공격 5번 연속 실패, 이어폰 음악 120줄을 못 쓰게 만듦.
> 5. **답을 미루고 일을 멈춰 두었다.** 백그라운드로 돌릴 일을 돌리지 않고 대화만 했다.
>
> 지킬 것: 사용자 결정·위키가 근거다. 옛 Claude 자료는 근거가 아니다. 사용자 말에 토 달지 않는다. 무엇이든 지우기 전에 목록을 보여 주고 허락받는다. 실패하면 덧대지 말고 다시 쓰거나 바꾼다.


주인: 「괴이 플러그인 세부 수정 10」 스레드(Claude). 1차(괴이 30장·사건 12장·특수 등)는 `docs/공용그림_GPT요청서.md`.

괴이 공용 그림이 장소 15곳뿐이라 영화관·목욕탕·편의점 같은 괴이가 엉뚱한 그림(지하철 등)으로 나왔다. 장소 16곳을 더해 2장씩 만든다. 플러그인은 이미 새 장소를 알아보고, 그림이 아직 없으면 비슷한 원래 장소 그림을 쓴다 (`src/core/sharedpics.ts` 의 `FALLBACK`). 그림이 들어오면 Claude가 720×720 AVIF로 바꿔 `assets/wiki/Situations/` 에 넣고 카드에 싣는다.

## GPT에게 (작업 방법)

- 이 저장소(`leepc25/goei-plugin`)에 바로 올린다. 저장 경로: **`assets/gpt/공용괴이_2차/<파일 이름>.png`** (아래 목록 이름 그대로, 예: `assets/gpt/공용괴이_2차/Situation Anomaly Theater 1.png`). 다 올리면 main에 커밋하고 `docs/GPT_요청_목록.md` 의 이 줄 상태를 「완료」로 바꾼다.
- 참고 그림: `assets/wiki/Situations/Situation Anomaly Subway 1.avif` 와 `Situation Anomaly Ruin 1.avif`. **그리는 솜씨(화풍)만 따르고 색·조명은 따르지 않는다.** 1차 30장은 전부 「밤·비·푸른 회색·빨간 불 하나」라서 다 똑같아 보였다 (2026-10-21 사용자: "왜 전부 빨간불이지"). 2차는 그림마다 시간·날씨·색·이상한 점을 아래에 따로 정했다. 빨간 불은 32장 중 3장만.
- 목록을 쉬지 않고 순서대로 전부 만든다. 묻지 않는다. 한도에 걸리면 멈춘 번호부터 이어 한다. 길면 1~16, 17~32 두 번으로 나눠도 된다.
- 크기 1024×1024 정사각형.

## 요청문 (통째로 붙여 넣기)

```
Make 32 background illustrations for a Korean urban-horror roleplay app in this order. Generate them one after another in the same reply without stopping to ask me anything; if you hit a limit, stop and continue from the next number when I say "계속". Name each file exactly as given (.png). Images ending in "1" and "2" of the same place must look clearly different (different spot, angle, time and color), not the same scene redrawn.

STYLE (same for every image)
Semi-realistic anime background art, cinematic, highly detailed. Present-day South Korea. NO readable text, letters, numbers, logos or brand names anywhere (signs stay blank or unreadable). NO people, no faces, no foreground silhouettes. Eye-level shot unless stated, square 1:1 (1024x1024). Keep the main subject in the center (the app shows it as a square when opened and crops it to a thin wide strip when closed). Keep the lower-left area calm for white caption text. Follow ONLY the drawing technique of the attached reference images, NOT their colors or lighting.

VARIETY RULES (important)
Every image has its own TIME, LIGHT and WRONG THING written after it; follow them exactly. Do NOT default to night rain with blue-grey and a red light. Red light is allowed ONLY in images 2, 14 and 26. Many images are daytime, dawn or dusk, and many are dry. The horror comes from the WRONG THING: something quietly impossible or out of place in an otherwise ordinary scene. No monsters, no blood, no gore.

IMAGES
1. Situation Anomaly Theater 1 — Old downtown single-screen movie theater building. TIME/LIGHT: late afternoon, dusty warm sepia sunlight, faded colors. WRONG THING: every blank poster frame shows the same empty seat.
2. Situation Anomaly Theater 2 — Empty cinema auditorium seen from the back row. TIME/LIGHT: dark, only the projector beam, red velvet seats. WRONG THING: the screen shows this same auditorium from the front, and one seat in that image is folded down.
3. Situation Anomaly Mall 1 — Department store atrium with escalators. TIME/LIGHT: bright midday, clean white and cream, sunlight through a glass roof. WRONG THING: completely empty, all escalators running, a shopping cart stopped halfway up the escalator.
4. Situation Anomaly Mall 2 — Underground shopping arcade corridor with shutters. TIME/LIGHT: sickly green-tinted fluorescent light, a few tubes flickering. WRONG THING: the corridor continues far longer than possible, the same shop repeating.
5. Situation Anomaly Restaurant 1 — Narrow food alley with tent bars and plastic stools. TIME/LIGHT: dusk, warm orange sodium streetlamps and steam. WRONG THING: every table is set with steaming food and full glasses, but no one is there.
6. Situation Anomaly Restaurant 2 — Small Korean restaurant interior, low tables. TIME/LIGHT: morning, flat pale daylight, beige and wood tones. WRONG THING: all the chairs face the wall.
7. Situation Anomaly Church 1 — Small hillside church. TIME/LIGHT: overcast winter noon, light snow, nearly black-and-white. WRONG THING: the cross on the roof is upside down and only the church has no snow on it.
8. Situation Anomaly Church 2 — Inside an empty church, pews, tall windows. TIME/LIGHT: early morning, cold blue light through stained glass in pale colors. WRONG THING: the pews have all been turned to face the entrance.
9. Situation Anomaly Bathhouse 1 — Old neighborhood bathhouse with a tall brick chimney. TIME/LIGHT: dawn, pink-lavender sky, steam rising. WRONG THING: the steam from the chimney flows downward to the ground.
10. Situation Anomaly Bathhouse 2 — Inside a public bath, tiled pools, low stools and basins. TIME/LIGHT: warm yellow light, thick steam, aqua tiles. WRONG THING: the pool water is perfectly still and black like ink while everything else is wet and steamy.
11. Situation Anomaly Store 1 — 24-hour convenience store on a corner. TIME/LIGHT: 4 a.m., cold white light spilling from the store onto a dry dark street. WRONG THING: the store is lit and open, but every other building on the street has vanished into flat darkness.
12. Situation Anomaly Store 2 — Inside a convenience store, aisles and fridges. TIME/LIGHT: harsh white fluorescent, slightly overexposed. WRONG THING: every product on the shelves is the same identical item.
13. Situation Anomaly Arcade 1 — Basement entrance of a karaoke and PC room building, stairs going down. TIME/LIGHT: dusk, purple and cyan neon (signs blank). WRONG THING: the stairs go down much farther than one floor, out of sight.
14. Situation Anomaly Arcade 2 — Small karaoke room with sofa and microphones. TIME/LIGHT: dark room, only the screen glow in deep red. WRONG THING: both microphones are hanging in the air by their cords from the ceiling, swaying.
15. Situation Anomaly Library 1 — Old public library or museum building with a lawn. TIME/LIGHT: bright sunny afternoon, green trees, clear blue sky. WRONG THING: all windows are dark, and the building's shadow points toward the sun.
16. Situation Anomaly Library 2 — Library stacks between tall bookshelves. TIME/LIGHT: dim warm amber lamps, dust in the air. WRONG THING: one book floats in midair, open, between the shelves.
17. Situation Anomaly Parking 1 — Underground parking garage, concrete pillars. TIME/LIGHT: dim yellow-green sodium lights, dry concrete. WRONG THING: one car with all doors open in the middle of the lane, headlights on.
18. Situation Anomaly Parking 2 — Top deck of a multi-level parking tower. TIME/LIGHT: hazy daytime, washed-out grey-white sky. WRONG THING: fresh footprints walk to the edge of the deck and stop.
19. Situation Anomaly Rooftop 1 — Apartment rooftop with water tanks and laundry lines. TIME/LIGHT: golden sunset, long shadows, warm orange. WRONG THING: the laundry on the lines blows in the opposite direction from the trees below.
20. Situation Anomaly Rooftop 2 — Office rooftop door slightly open, stairwell behind. TIME/LIGHT: dense morning fog, white and grey, very soft. WRONG THING: the open doorway shows a sunny blue sky instead of a stairwell.
21. Situation Anomaly Bridge 1 — Long river bridge. TIME/LIGHT: dawn, thick pale fog, faint pink. WRONG THING: the bridge disappears into the fog and the far end is not there at all.
22. Situation Anomaly Bridge 2 — Pedestrian overpass above an empty road. TIME/LIGHT: noon, harsh sun, crisp hard shadows, dry. WRONG THING: the road below is completely empty in every direction at midday, and a single shoe sits in the middle of the overpass.
23. Situation Anomaly Police 1 — Small neighborhood police box. TIME/LIGHT: rainy evening, the box lit warm yellow, wet street. WRONG THING: a phone receiver hangs off the hook outside, and the inside is perfectly tidy and empty.
24. Situation Anomaly Police 2 — Detention corridor with cell bars. TIME/LIGHT: cold flat fluorescent, pale green-grey, almost colorless. WRONG THING: every cell door is open except one, which is locked from the inside.
25. Situation Anomaly Military 1 — Military base gate and guard post in the hills. TIME/LIGHT: overcast autumn day, khaki and dull olive. WRONG THING: the gate is wide open and the fallen leaves stop in a straight line at the gate.
26. Situation Anomaly Military 2 — Inside an old concrete bunker, metal door, pipes. TIME/LIGHT: one red emergency lamp, deep shadows. WRONG THING: the heavy metal door is bulging outward from the inside.
27. Situation Anomaly Restroom 1 — Public restroom building in a park. TIME/LIGHT: summer afternoon, bright green trees, cicada-hot light. WRONG THING: the open doorway is pitch black inside despite the bright sun.
28. Situation Anomaly Restroom 2 — Old school restroom, row of stalls, mirror. TIME/LIGHT: one flickering white tube light, pale tiles. WRONG THING: the mirror shows all stall doors closed while in the room they are all open.
29. Situation Anomaly Bus 1 — Rural bus stop shelter by rice fields. TIME/LIGHT: hot summer noon, heat haze, saturated blue sky and green fields. WRONG THING: the shelter casts no shadow, and a bus waits on the road with its doors open and no driver.
30. Situation Anomaly Bus 2 — Inside a city bus. TIME/LIGHT: night, the bus lit cold blue-white, black windows. WRONG THING: through the windows there is nothing outside, only black, and all the stop-request buttons are lit.
31. Situation Anomaly Lake 1 — Reservoir with a wooden fishing deck. TIME/LIGHT: early morning mist, silver and pale teal, mirror-still water. WRONG THING: the reflection in the water shows a pair of shoes on the deck, but the real deck is empty.
32. Situation Anomaly Lake 2 — Old stone well in a village courtyard. TIME/LIGHT: dry autumn afternoon, persimmon tree, warm brown and orange. WRONG THING: a rope goes down into the well and is pulled tight, as if something is holding it.
```

## 이미 그리던 대화에 붙일 정정문 (2026-10-21)

이 요청서의 첫 판(전부 밤·비·빨간 불)으로 이미 그리기 시작했다면, 그 대화에 아래를 붙여 넣고 1번부터 다시 그린다. 첫 판으로 그린 파일은 쓰지 않는다.

```
Correction: stop and restart from image 1 with the updated list below. The earlier images all looked the same (night, rain, blue-grey, one red light), so discard them. New rules: follow only the drawing technique of the reference images, not their colors or lighting. Each image now has its own TIME, LIGHT and WRONG THING; follow them exactly. Red light is allowed only in images 2, 14 and 26. Many images are daytime, dawn or dusk, and many are dry. The horror is one quietly impossible detail in an ordinary scene, no monsters. Same file names and save path as before.
```
(정정문 뒤에 위 「요청문」 전체를 이어 붙인다.)

## 받은 뒤 검수 (2026-10-22, Claude)

32장 받음 (GPT 커밋 4b904ee). 장소·시간·색은 요청대로 다양하고 글자·사람 없음, 빨간 불은 2·14·26번만. 600×600 AVIF로 바꿔 `assets/wiki/Situations/` 에 넣음.
이상한 점이 빠진 2장은 다시 요청한다. 저장 경로·파일 이름은 같음 (덮어쓰기).

```
Redo 2 images with the same style rules as before (same file names and save path, overwrite the old files). The earlier versions missed the WRONG THING; it must be clearly visible at a small size.
6. Situation Anomaly Restaurant 2 — Small Korean restaurant interior, low tables with floor cushions and a few wooden chairs. TIME/LIGHT: morning, flat pale daylight, beige and wood tones. WRONG THING: every chair and every floor cushion is turned to face the bare wall, neatly, as if an audience is watching the wall. Make this obvious.
7. Situation Anomaly Church 1 — Small hillside church. TIME/LIGHT: overcast winter noon, light snow, nearly black-and-white. WRONG THING: the cross on the roof is clearly upside down, and the church roof and steps have no snow at all while everything around is covered in snow. Make both obvious.
```
