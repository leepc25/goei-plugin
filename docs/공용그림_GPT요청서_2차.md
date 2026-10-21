# GPT 요청서 · 공용 괴이 그림 2차 (32장, 2026-10-21)

주인: 「괴이 플러그인 세부 수정 10」 스레드(Claude). 1차(괴이 30장·사건 12장·특수 등)는 `docs/공용그림_GPT요청서.md`.

괴이 공용 그림이 장소 15곳뿐이라 영화관·목욕탕·편의점 같은 괴이가 엉뚱한 그림(지하철 등)으로 나왔다. 장소 16곳을 더해 2장씩 만든다. 플러그인은 이미 새 장소를 알아보고, 그림이 아직 없으면 비슷한 원래 장소 그림을 쓴다 (`src/core/sharedpics.ts` 의 `FALLBACK`). 그림이 들어오면 Claude가 720×720 AVIF로 바꿔 `assets/wiki/Situations/` 에 넣고 카드에 싣는다.

## GPT에게 (작업 방법)

- 이 저장소(`leepc25/goei-plugin`)에 바로 올린다. 저장 경로: **`assets/gpt/공용괴이_2차/<파일 이름>.png`** (아래 목록 이름 그대로, 예: `assets/gpt/공용괴이_2차/Situation Anomaly Theater 1.png`). 다 올리면 main에 커밋하고 `docs/GPT_요청_목록.md` 의 이 줄 상태를 「완료」로 바꾼다.
- 참고 그림: `assets/wiki/Situations/Situation Anomaly Subway 1.avif` 와 `Situation Anomaly Ruin 1.avif` (1차 그림과 화풍을 똑같이).
- 목록을 쉬지 않고 순서대로 전부 만든다. 묻지 않는다. 한도에 걸리면 멈춘 번호부터 이어 한다. 길면 1~16, 17~32 두 번으로 나눠도 된다.
- 크기 1024×1024 정사각형.

## 요청문 (통째로 붙여 넣기)

```
Make 32 background illustrations for a Korean urban-horror roleplay app in this order. Generate them one after another in the same reply without stopping to ask me anything; if you hit a limit, stop and continue from the next number when I say "계속". Name each file exactly as given (.png). Images ending in "1" and "2" of the same place must look clearly different (one exterior or wide view, one interior or close view; different angle and composition), not the same scene redrawn.

STYLE (same for every image)
Semi-realistic anime background art, cinematic, highly detailed, soft volumetric light. Present-day South Korea. NO readable text, letters, numbers, logos or brand names anywhere (signs stay blank or unreadable). NO people, no faces, no foreground silhouettes. Night or heavy overcast, muted desaturated blue-grey palette, wet surfaces, light fog. Eye-level shot, square 1:1 (1024x1024). Keep the main subject in the center (the app shows it as a square when opened and crops it to a thin wide strip when closed). Keep the lower-left area calm and darker for white caption text. Match the style of the attached reference images exactly.

KIND: ANOMALY
Exactly ONE red light accent (signal lamp, exit sign, red glow). Uncanny emptiness; something is subtly wrong but no monster is shown.

IMAGES
1. Situation Anomaly Theater 1 — Old downtown single-screen movie theater building at night, blank poster frames, closed ticket booth, one red light above the entrance.
2. Situation Anomaly Theater 2 — Empty cinema auditorium, rows of red-grey seats, the screen glowing faintly, one red exit light by the aisle.
3. Situation Anomaly Mall 1 — Department store atrium after closing, escalators stopped, shutters half down on shops, one red light on an upper floor.
4. Situation Anomaly Mall 2 — Underground shopping arcade corridor, closed shop shutters on both sides, tiled floor, a red light at the far end.
5. Situation Anomaly Restaurant 1 — Narrow food alley at night, closed restaurants with plastic stools stacked outside, a tent bar with one red lamp.
6. Situation Anomaly Restaurant 2 — Inside a small Korean restaurant after closing, low tables, metal chopsticks holders, steam from one pot, a red glow from the kitchen.
7. Situation Anomaly Church 1 — Small hillside church at night, a cross on the roof glowing red, empty stone steps.
8. Situation Anomaly Church 2 — Inside an empty church, wooden pews, pulpit, tall windows, one red candle light at the altar.
9. Situation Anomaly Bathhouse 1 — Old neighborhood bathhouse building with a tall chimney at night, steam rising, one red light by the door.
10. Situation Anomaly Bathhouse 2 — Inside a public bath, tiled pools full of still water, steam, low stools and basins, a red light on the wall.
11. Situation Anomaly Store 1 — 24-hour convenience store on a corner at night, bright windows, empty parking spot, one red light inside.
12. Situation Anomaly Store 2 — Inside a convenience store, aisles of snacks, fridges humming, an empty counter, one fridge glowing red.
13. Situation Anomaly Arcade 1 — Basement entrance of a karaoke and PC room building, narrow stairs going down, neon signs unlit, one red glow below.
14. Situation Anomaly Arcade 2 — Small karaoke room, sofa, table with microphones, the screen showing only red light.
15. Situation Anomaly Library 1 — Old public library or museum building at night, closed glass doors, dark lobby, one red light inside.
16. Situation Anomaly Library 2 — Library stacks between tall bookshelves, reading lamps off, one red lamp at the end of the row.
17. Situation Anomaly Parking 1 — Underground parking garage, concrete pillars, empty spaces, low ceiling lights, a red light at the ramp.
18. Situation Anomaly Parking 2 — Rooftop of a multi-level parking tower at night, one parked car, a red warning light on a pole.
19. Situation Anomaly Rooftop 1 — Apartment building rooftop at night, water tanks, laundry lines, a low railing, a red aircraft warning light.
20. Situation Anomaly Rooftop 2 — Office building rooftop door slightly open, stairwell behind it, city lights below, one red light over the door.
21. Situation Anomaly Bridge 1 — Long river bridge at night in fog, streetlights fading into mist, one red light at the middle.
22. Situation Anomaly Bridge 2 — Pedestrian overpass above an empty road, railings, wet steps, one red lamp on the bridge.
23. Situation Anomaly Police 1 — Small neighborhood police box at night, the window lit, empty patrol bike, a red light on the roof.
24. Situation Anomaly Police 2 — Prison or detention corridor, cell bars on one side, cold fluorescent light, one red light at the end.
25. Situation Anomaly Military 1 — Military base gate and guard post at night, barbed wire fence, searchlight off, one red light in the post.
26. Situation Anomaly Military 2 — Inside an old concrete bunker, metal door, pipes, puddles, a red emergency lamp.
27. Situation Anomaly Restroom 1 — Public restroom building in a park at night, one lamp, door half open, a red light inside.
28. Situation Anomaly Restroom 2 — Inside an old school restroom, row of stalls, cracked tiles, mirror, one stall glowing red.
29. Situation Anomaly Bus 1 — Rural bus stop shelter on an empty road at night, one bench, a red light at the far end of the road.
30. Situation Anomaly Bus 2 — Inside an empty night bus, rows of seats, hand straps, windows fogged, the destination panel glowing red with no readable text.
31. Situation Anomaly Lake 1 — Reservoir at night, still black water, a wooden fishing deck, a red light on the far shore.
32. Situation Anomaly Lake 2 — Old stone well in a village courtyard at night, wooden lid half open, a red glow from inside.
```
