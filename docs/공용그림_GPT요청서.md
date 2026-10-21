# 공용 상황 그림 GPT 요청서 (2026-10-21)

상황 카드·커스텀 목록·위키·요원 칸에서 사진이 없을 때 쓰는 공용 그림입니다 (괴이·사건·특수 상황, 조직, 거점, 요원). 지금은 종류마다 1장뿐이라 맥락이 안 맞아서, 장소별로 여러 장을 만들고 플러그인이 상황의 발생 지점·상황 글의 낱말로 맞는 그림을 고릅니다.

## 쓰는 법

- 종류마다 GPT 대화를 따로 열고, 아래 요청문 하나를 통째로 붙여 넣으세요. 참고 그림 1장을 같이 첨부합니다 (`assets/wiki/Situations/` 의 그 종류 그림).
- GPT가 한 장씩 만들게 하고, 파일 이름은 목록의 영어 이름 그대로 png로 받으세요. 이름이 그대로 에셋 이름이 됩니다.
- 받은 뒤 Claude가 720×480 AVIF로 바꾸고 꼬리표를 붙여 카드에 넣습니다.

## 괴이 (12장) · 참고 그림: Situation Anomaly

```
Make 12 background illustrations for a Korean urban-horror roleplay app, ONE image per reply, in this order. Name each file exactly as given (.png).

STYLE (same for every image)
Semi-realistic anime background art, cinematic, highly detailed, soft volumetric light. Present-day South Korea. NO readable text, letters, numbers, logos or brand names anywhere. NO people, no faces, no foreground silhouettes. Night or heavy overcast, muted desaturated blue-grey palette, wet surfaces, light fog. Eye-level wide shot, landscape 3:2 (1536x1024). Keep the main subject inside the middle horizontal band (the app crops to a thin wide strip). Keep the lower-left area calm and darker for white caption text. Match the style of the attached reference image exactly.

KIND: ANOMALY
Exactly ONE red light accent (signal lamp, exit sign, red glow). Uncanny emptiness; something is subtly wrong but no monster is shown.

IMAGES
1. Situation Anomaly Apartment — Long outdoor corridor of an old Korean apartment block at night, identical doors, one flickering red light at the far end.
2. Situation Anomaly School — Empty school hallway at night, rows of classroom doors, a red emergency light glowing at the end, faint fog on the floor.
3. Situation Anomaly Hospital — Dim hospital ward corridor, empty beds behind curtains, a red exit-light glow, one wheelchair left in the middle.
4. Situation Anomaly Subway — Deserted subway platform after midnight, screen doors closed, tunnel darkness, a single red signal light deep in the tunnel.
5. Situation Anomaly Road — Empty two-lane mountain road at night in fog, guard rail, a red warning lamp blinking beside the road.
6. Situation Anomaly Tunnel — Inside a long road tunnel, orange ceiling lamps mostly dead, one red light ahead, wet asphalt.
7. Situation Anomaly Forest — Dark forest path in a Korean hillside, wooden stairs going up into fog, a red ribbon tied to a branch catching faint red light.
8. Situation Anomaly Amusement — Closed amusement park at night, a carousel standing still, one red bulb still lit, mist between the rides.
9. Situation Anomaly Lodging — Narrow motel hallway, patterned carpet, numbered doors without readable numbers, red light leaking under one door.
10. Situation Anomaly Ruin — Abandoned concrete building interior, peeling walls, broken windows, a red glow from a stairwell below.
11. Situation Anomaly Elevator — Old apartment elevator with doors half open into darkness, the floor indicator glowing red with no readable digits.
12. Situation Anomaly Village — Rural Korean village alley at night, low stone walls, persimmon tree, one red light in a window.
```

## 사건 (12장) · 참고 그림: Situation Incident

```
Make 12 background illustrations for a Korean urban-horror roleplay app, ONE image per reply, in this order. Name each file exactly as given (.png).

STYLE (same for every image)
Semi-realistic anime background art, cinematic, highly detailed, soft volumetric light. Present-day South Korea. NO readable text, letters, numbers, logos or brand names anywhere. NO people, no faces, no foreground silhouettes. Night or heavy overcast, muted desaturated blue-grey palette, wet surfaces, light fog. Eye-level wide shot, landscape 3:2 (1536x1024). Keep the main subject inside the middle horizontal band (the app crops to a thin wide strip). Keep the lower-left area calm and darker for white caption text. Match the style of the attached reference image exactly.

KIND: INCIDENT
Blue and amber emergency lights, police tape or barricades. A realistic public emergency; nothing supernatural visible.

IMAGES
1. Situation Incident Street — Downtown street at night after rain, police car with blue lights, yellow tape across the sidewalk (closest to the reference).
2. Situation Incident Apartment — Korean apartment complex parking lot at night, ambulance and police lights reflecting on wet ground, tape around one building entrance.
3. Situation Incident Subway — Subway station entrance stairs taped off, police barricade, amber warning light, wet tiles.
4. Situation Incident Hospital — Hospital emergency entrance at night, ambulance bay, blue and amber lights, empty stretcher.
5. Situation Incident School — School gate at night, playground behind, police tape on the gate, police car lights.
6. Situation Incident Port — Container terminal at night, stacked containers, smoke in the distance, amber and blue lights.
7. Situation Incident Factory — Industrial warehouse district, rolling shutters, fire-truck red and amber lights, light smoke.
8. Situation Incident Market — Traditional Korean market alley closed for the night, shutters down, tape across the alley, police light glow.
9. Situation Incident Mountain — Hiking trail entrance at the foot of a mountain at dusk, rescue vehicle lights, barrier across the trail.
10. Situation Incident River — Riverside park under a large bridge at night, rescue boat lights on the water, tape along the railing.
11. Situation Incident Highway — Elevated highway at night, traffic cones and a closed lane, amber flashing arrow board, distant city lights.
12. Situation Incident Residential — Narrow residential alley with villas and parked scooters, police car lights at the end, tape across the alley.
```

## 특수 (6장) · 참고 그림: Situation Mystic

```
Make 6 background illustrations for a Korean urban-horror roleplay app, ONE image per reply, in this order. Name each file exactly as given (.png).

STYLE (same for every image)
Semi-realistic anime background art, cinematic, highly detailed, soft volumetric light. Present-day South Korea. NO readable text, letters, numbers, logos or brand names anywhere. NO people, no faces, no foreground silhouettes. Night or heavy overcast, muted desaturated blue-grey palette, wet surfaces, light fog. Eye-level wide shot, landscape 3:2 (1536x1024). Keep the main subject inside the middle horizontal band (the app crops to a thin wide strip). Keep the lower-left area calm and darker for white caption text. Match the style of the attached reference image exactly.

KIND: MYSTIC
Exactly ONE cold cyan/blue light (lantern, moonlight, glow). Quiet, otherworldly, slightly dreamlike calm.

IMAGES
1. Situation Mystic Hanok — Hanok village lane under the moon, closed shutters, a small stall with a cyan lantern (closest to the reference).
2. Situation Mystic Temple — Mountain Buddhist temple courtyard at night, stone pagoda, paper lanterns, one cyan glow.
3. Situation Mystic Shrine — Small old shrine in a forest clearing, rope with paper strips, moonlight, cyan will-o'-the-wisp.
4. Situation Mystic Sea — Rocky seashore at night, calm water, a cyan light floating above the waves, distant lighthouse dark.
5. Situation Mystic Underground — Old underground passage with tiled walls, an unexpected doorway glowing cyan, dust in the air.
6. Situation Mystic Rooftop — City rooftop at night with water tanks, the skyline below, a strange cyan glow hanging in the air.
```

## 공용 조직 (8장) · 참고 그림: assets/wiki/Factions 의 그림 아무거나 (예: Freelancer)

사진이 없는 조직의 대표 사진. 정사각 832×832로 씁니다. 사람은 넣지 않거나 아주 작게.

```
Make 8 illustrations for a Korean urban-horror roleplay app, ONE image per reply, in this order. Name each file exactly as given (.png).

STYLE (same for every image)
Korean webtoon (manhwa) illustration style matching the attached reference image exactly: clean ink line art, cel shading, muted desaturated colors, dramatic lighting. Present-day South Korea. NO readable text, letters, numbers, logos or brand names anywhere. Square 1:1 (1024x1024). Keep the main subject in the center (the app also crops it to a thin wide strip and to a small square).

KIND: ORGANIZATION. A place that represents the organization, no people in focus.

IMAGES
1. Shared Org Office — A plain secret-organization office at night: rows of desks, monitors, case files and a corkboard of photos connected by string, nobody present.
2. Shared Org Corporate — A sleek corporate headquarters lobby with glass walls and a cold reception desk, polished floor, an air of quiet menace.
3. Shared Org Religious — A candle-lit chapel interior with wooden pews and a tall stained-glass window with abstract patterns, solemn and protective.
4. Shared Org Cult — A hidden underground ritual hall, chairs in a circle, a raised seat, a single purple light beam falling from above.
5. Shared Org Criminal — A smoky back room of a gambling den, poker table with chips, a heavy safe in the corner, a dim lamp.
6. Shared Org Military — An armory briefing room: weapon racks, a tactical map table under a hanging lamp, black cases stacked by the wall.
7. Shared Org Research — A research lab corridor with sealed glass observation rooms, sample jars, cold white light.
8. Shared Org Underground — A hidden meeting place in a rundown building: mismatched sofas, old TV, maps taped to the wall, a crowded but cozy hideout.
```

## 공용 거점 (8장) · 참고 그림: assets/wiki/Factions/Management Bureau

사진도 연결 조직 사진도 없는 거점의 그림. 정사각 832×832, 거점 띠로 잘려도 보이게 건물을 가운데 둡니다.

```
Make 8 illustrations for a Korean urban-horror roleplay app, ONE image per reply, in this order. Name each file exactly as given (.png).

STYLE (same for every image)
Korean webtoon (manhwa) illustration style matching the attached reference image exactly: clean ink line art, cel shading, muted desaturated colors, dramatic lighting. Present-day South Korea. NO readable text, letters, numbers, logos or brand names anywhere. Square 1:1 (1024x1024). Keep the main subject in the center (the app also crops it to a thin wide strip and to a small square).

KIND: BASE. Exactly ONE teal-green light somewhere in the scene; a place that looks ordinary but quietly watchful. No people.

IMAGES
1. Shared Base Office — An ordinary mid-rise office building on a Seoul street at night, lobby lights on, one teal light at the entrance, calm but watchful.
2. Shared Base Shop — A small storefront on a quiet Seoul side street at night, shutters half down, warm light inside.
3. Shared Base Religious — A small church or mosque-like religious building on a Seoul hillside at night, generic architecture without symbols of a specific faith, soft lights in the windows.
4. Shared Base Underground — A stairway descending into an old underground shopping arcade at night, flickering fluorescent lights below.
5. Shared Base Warehouse — A riverside warehouse compound at night, rolling shutters, a single lamp over a side door.
6. Shared Base Clinic — A shabby private clinic entrance in an alley, frosted glass door, a cross-shaped light without text.
7. Shared Base Hideout — A worn-out villa apartment building at night, one window lit on the top floor, laundry on a balcony.
8. Shared Base Hall — A large old public hall or school auditorium building at night, wide steps, tall dark windows.
```

## 공용 요원 (10장) · 참고 그림: assets/agents 의 「영문명_default」 아무거나 (예: Aileen_default)

사진이 없는 요원의 대표 사진. 세로 832×1216, 검은 배경. 여러 인물 대신 쓰는 그림이라 얼굴이 드러나면 안 됩니다.

```
Make 10 illustrations for a Korean urban-horror roleplay app, ONE image per reply, in this order. Name each file exactly as given (.png).

STYLE (same for every image)
Korean webtoon (manhwa) character illustration matching the attached reference image exactly: fine ink line art, soft cel shading, muted colors. Portrait 2:3 (1024x1536). One person, standing, framed from head to mid-thigh, facing slightly to the side, centered, plain pure black background. The face must be ANONYMOUS: hidden by deep shadow, a cap brim, a hood, hair or a mask, so the image can stand in for many different characters. Head near the top quarter of the frame (the app crops a square face icon from there). NO readable text, logos or insignia.

KIND: AGENT

IMAGES
1. Shared Agent Suit Female — Woman in a black suit and black tie, white shirt, long dark hair covering her eyes in shadow, gloved hands.
2. Shared Agent Suit Male — Man in a black suit and black tie, white shirt, face in deep shadow, hands in pockets.
3. Shared Agent Masked Female — Woman in a neat office suit with an employee ID lanyard, wearing an animal mask (fox).
4. Shared Agent Masked Male — Man in a neat office suit with an employee ID lanyard, wearing an animal mask (wolf).
5. Shared Agent Freelancer Female — Woman in a hooded jacket and tactical vest, cargo pants, holding a short baton, hood shadowing her face.
6. Shared Agent Freelancer Male — Man in a worn bomber jacket and cap pulled low, a duffel bag on his shoulder.
7. Shared Agent Civilian Female — Woman in a casual hoodie and long coat, a backpack strap, face turned away under her hair.
8. Shared Agent Civilian Male — Man in a casual shirt and jacket, holding a phone, face hidden by a cap.
9. Shared Agent Religious — Person in a dark cassock-like robe with a hood, a rosary-like string of beads at the wrist, face hidden by the hood.
10. Shared Agent Occult — Person in a long dark cloak with sand-colored trim, faint glowing sigils around the hands, face hidden by the hood.
```

## 플러그인 매칭 (Claude 담당)

- 그림마다 꼬리표 낱말을 둡니다. 예: Subway = 지하철, 역, 승강장, 전철, 선로 / School = 학교, 교실, 기숙학교, 학원.
- 상황의 이름·발생 지점·상황 글에서 꼬리표 낱말을 찾아 점수가 가장 높은 그림을 고릅니다. 모델 호출 없음.
- 점수가 같거나 하나도 안 맞으면 이름으로 정해 같은 상황은 늘 같은 그림이 나옵니다.
- 그림이 하나도 없으면 지금의 Situation Anomaly/Incident/Mystic을 씁니다.
- 조직: 사진이 없으면 유형(조직형·민간형·프리랜서형)과 이름·로어북 낱말(회사·교회·성원·교단·연구·사채 등)로 Shared Org를 고릅니다.
- 거점: 영문명 → 연결 조직 사진 → 이름 낱말(본부·본사 → Office, 상점·가게 → Shop, 성원·성당·교회 → Religious, 지하·상가 → Underground 등)로 Shared Base.
- 요원: 사진이 없으면 소속 조직(관리국 → Suit, 백일몽 → Masked, 프리랜서·협회 → Freelancer, 민간인 → Civilian, 교황청·이슬람 → Religious, 발푸르기스 → Occult)과 로어북의 성별 낱말(여성·Female/남성·Male)로 고르고, 성별을 모르면 이름으로 정합니다.
