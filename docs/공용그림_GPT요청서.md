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

## 특수 (8장) · 참고 그림: Situation Mystic

특수는 아무 데나 나타나는 가게·공간이라 장소가 아니라 **무엇인지**(가게, 책방, 공방, 장터, 자판기, 방, 물건, 문)로 고릅니다.

```
Make 8 background illustrations for a Korean urban-horror roleplay app, ONE image per reply, in this order. Name each file exactly as given (.png).

STYLE (same for every image)
Semi-realistic anime background art, cinematic, highly detailed, soft volumetric light. Present-day South Korea. NO readable text, letters, numbers, logos or brand names anywhere. NO people, no faces, no foreground silhouettes. Night or heavy overcast, muted desaturated blue-grey palette, wet surfaces, light fog. Eye-level wide shot, landscape 3:2 (1536x1024). Keep the main subject inside the middle horizontal band (the app crops to a thin wide strip). Keep the lower-left area calm and darker for white caption text. Match the style of the attached reference image exactly.

KIND: MYSTIC
Exactly ONE cold cyan/blue light. Quiet, otherworldly, slightly dreamlike calm. The place itself is the subject.

IMAGES
1. Situation Mystic Shop — A tiny mysterious shop squeezed between ordinary buildings on a night street, warm-dark window display of odd objects, one cyan lamp over the door.
2. Situation Mystic Bookshop — Inside a cramped old bookshop at night, towering shelves, a reading desk, a cyan glow from one open book.
3. Situation Mystic Workshop — A craftsman workshop full of tools, half-finished strange objects and a small furnace glowing cyan instead of orange.
4. Situation Mystic Market — A night market of covered stalls under a bridge or in a back lane, lanterns glowing cyan, wares wrapped in cloth, no shoppers.
5. Situation Mystic Vending — A lone vending machine at the end of a dark alley, its panel glowing cyan, products behind the glass blurred and unidentifiable.
6. Situation Mystic Room — A cozy consultation room with two armchairs and a low table with tea, a paper screen, one cyan floor lamp, feels like a dream.
7. Situation Mystic Object — A single small mysterious object (a gift box, a keyring, a seed packet) resting on a wet street bench at night, softly glowing cyan.
8. Situation Mystic Door — A plain door standing where no door should be, in an alley wall or a stairwell, cyan light leaking around its edges.
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

## 공용 거점 (6장) · 참고 그림: assets/wiki/Factions/Management Bureau

거점 사진은 영문명 사진 → 연결 조직 사진 순서라, 이 그림은 **조직이 없는 거점**이나 사진 없는 조직의 거점에만 나옵니다. 거점 이름 낱말로 고릅니다(본부·본사·사무소 → Office, 상점·가게·샵 → Shop, 성당·교회·성원·절 → Religious, 지하·상가·역 → Underground, 의원·병원·약국 → Clinic, 그 밖 → Hideout). 정사각 832×832, 거점 띠로 잘려도 보이게 건물을 가운데 둡니다.

```
Make 6 illustrations for a Korean urban-horror roleplay app, ONE image per reply, in this order. Name each file exactly as given (.png).

STYLE (same for every image)
Korean webtoon (manhwa) illustration style matching the attached reference image exactly: clean ink line art, cel shading, muted desaturated colors, dramatic lighting. Present-day South Korea. NO readable text, letters, numbers, logos or brand names anywhere. Square 1:1 (1024x1024). Keep the main subject in the center (the app also crops it to a thin wide strip and to a small square).

KIND: BASE. Exactly ONE teal-green light somewhere in the scene; a place that looks ordinary but quietly watchful. No people.

IMAGES
1. Shared Base Office — An ordinary mid-rise office building on a Seoul street at night, lobby lights on, one teal light at the entrance, calm but watchful.
2. Shared Base Shop — A small storefront on a quiet Seoul side street at night, shutters half down, warm light inside.
3. Shared Base Religious — A small church or mosque-like religious building on a Seoul hillside at night, generic architecture without symbols of a specific faith, soft lights in the windows.
4. Shared Base Underground — A stairway descending into an old underground shopping arcade at night, flickering fluorescent lights below.
5. Shared Base Clinic — A shabby private clinic entrance in an alley, frosted glass door, a cross-shaped light without text.
6. Shared Base Hideout — A worn-out villa apartment building at night, one window lit on the top floor, laundry on a balcony.
```

## 기본 거점 외부 (7장) · 참고 그림: assets/wiki/Factions/Management Bureau

세력 사진은 내부라서, 거점은 거리에서 본 **외부**로 만듭니다. 파일 이름은 「Base 영문명」입니다 (거점 영문명이 세력 영문명과 같아 겹치지 않게). 가짜 관리국으로 시작한 이야기에서는 관리국 본부 자리에 Base Fake Management Bureau가 나옵니다.

```
Make 7 illustrations for a Korean urban-horror roleplay app, ONE image per reply, in this order. Name each file exactly as given (.png).

STYLE (same for every image)
Korean webtoon (manhwa) illustration style matching the attached reference image exactly: clean ink line art, cel shading, muted desaturated colors, dramatic lighting. Present-day South Korea. NO readable text, letters, numbers, logos or brand names anywhere. Square 1:1 (1024x1024). Keep the main subject in the center (the app also crops it to a thin wide strip and to a small square).

KIND: BASE EXTERIOR
The building seen from the street outside, the whole facade readable at a glance, no people.

IMAGES
1. Base Management Bureau — A large, completely ordinary office building in central Jongno, Seoul at dawn. The wide street in front is eerily EMPTY of people and cars while traffic lights still change. Plain glass entrance, one soft teal light by the door. It should feel forgettable and quietly guarded.
2. Base Fake Management Bureau — A big imposing company building in Jongno, Seoul at night. A row of identical black sedans parked in front, harsh white lights, many dark windows, an auditorium-like wing. Disciplined, cold and military.
3. Base Baekilmong corporation — A sleek glass-curtain high-rise pharmaceutical headquarters on a wide Gangnam boulevard at night, a lower annex building attached at the side, bright lobby, an air of polished menace.
4. Base Special Disaster Response Association — A plain 10-storey mid-rise office building in Yeongdeungpo, Seoul at night, posing as a disaster-consulting company: fire-safety posters visible through the lobby glass (no readable text), a few lit floors.
5. Base Vatican — A small Christian goods shop in a narrow alley of Seodaemun, Seoul at night: shop window full of crosses, rosaries and religious icons, warm candle-like light, a little bell over the door.
6. Base Islam — A mosque on a hillside in Itaewon, Seoul at night: white dome, two slender minarets, steps leading up, quiet residential street below, soft light from the arched windows.
7. Base Jungrim Underground Shopping Center — The street-level stair entrance down to a decaying underground shopping arcade in Jungnim-dong, Seoul at night: half-dead fluorescent lights below, closed shops visible at the bottom of the stairs, wet pavement.
```

## 공용 요원 (30장) · 직접 제작 (GPT 아님: 기존 요원 그림 톤을 맞춰야 함)

사진이 없는 요원의 대표 사진. 기존 요원 그림과 같은 도구·톤으로 직접 만듭니다. 아래 목록은 장면 설명이고, 쓰는 도구 형식(태그 등)으로 바꿔 쓰면 됩니다. 세로 832×1216, 검은 배경. 여러 인물 대신 쓰는 그림이라 얼굴이 드러나면 안 됩니다. 옷차림(소속)과 성별마다 3장씩 두고, 플러그인이 요원 이름으로 그중 하나를 골라 같은 요원은 늘 같은 그림이 나옵니다. 성별을 모르면 후드 차림(Religious·Occult)을 씁니다.

```
Make 30 illustrations for a Korean urban-horror roleplay app, ONE image per reply, in this order. Name each file exactly as given (.png). Variants of the same outfit must look like DIFFERENT people (different hair, build, pose, accessory).

STYLE (same for every image)
Korean webtoon (manhwa) character illustration matching the attached reference image exactly: fine ink line art, soft cel shading, muted colors. Portrait 2:3 (1024x1536). One person, standing, framed from head to mid-thigh, facing slightly to the side, centered, plain pure black background. The face must be ANONYMOUS: hidden by deep shadow, a cap brim, a hood, hair or a mask, so the image can stand in for many different characters. Head near the top quarter of the frame (the app crops a square face icon from there). NO readable text, logos or insignia.

KIND: AGENT

IMAGES
1. Shared Agent Suit Female 1 — Woman in black suit and black tie, white shirt; long dark hair falling over the eyes, gloved hands.
2. Shared Agent Suit Female 2 — Woman in black suit and black tie, white shirt; short bob haircut, face in shadow, holding a pistol pointed down.
3. Shared Agent Suit Female 3 — Woman in black suit and black tie, white shirt; hair tied back, sunglasses, arms crossed.
4. Shared Agent Suit Male 1 — Man in black suit and black tie, white shirt; face in deep shadow, hands in pockets.
5. Shared Agent Suit Male 2 — Man in black suit and black tie, white shirt; sunglasses and short hair, adjusting a cuff.
6. Shared Agent Suit Male 3 — Man in black suit and black tie, white shirt; holding a black umbrella, face hidden under it.
7. Shared Agent Masked Female 1 — Woman in neat office suit with an employee ID lanyard (no readable text); fox mask, long hair.
8. Shared Agent Masked Female 2 — Woman in neat office suit with an employee ID lanyard (no readable text); cat mask, short hair, holding a clipboard.
9. Shared Agent Masked Female 3 — Woman in neat office suit with an employee ID lanyard (no readable text); rabbit mask, ponytail, collector cylinder at the hip.
10. Shared Agent Masked Male 1 — Man in neat office suit with an employee ID lanyard (no readable text); wolf mask, standing straight.
11. Shared Agent Masked Male 2 — Man in neat office suit with an employee ID lanyard (no readable text); owl mask, sleeves rolled up.
12. Shared Agent Masked Male 3 — Man in neat office suit with an employee ID lanyard (no readable text); bear mask, heavy build, carrying a metal case.
13. Shared Agent Freelancer Female 1 — Woman in practical streetwear with a tactical touch; hooded jacket and tactical vest, short baton, hood shadowing the face.
14. Shared Agent Freelancer Female 2 — Woman in practical streetwear with a tactical touch; leather jacket, cap pulled low, knife sheath on the thigh.
15. Shared Agent Freelancer Female 3 — Woman in practical streetwear with a tactical touch; long coat and scarf over the mouth, gloves.
16. Shared Agent Freelancer Male 1 — Man in practical streetwear with a tactical touch; worn bomber jacket, cap pulled low, duffel bag.
17. Shared Agent Freelancer Male 2 — Man in practical streetwear with a tactical touch; hoodie under a utility vest, face mask, bandaged knuckles.
18. Shared Agent Freelancer Male 3 — Man in practical streetwear with a tactical touch; trench coat, turned-up collar hiding the face, crowbar in hand.
19. Shared Agent Civilian Female 1 — Woman in ordinary casual clothes; hoodie and long coat, backpack strap, face turned away under her hair.
20. Shared Agent Civilian Female 2 — Woman in ordinary casual clothes; school-style cardigan and skirt, face hidden by a surgical mask and bangs.
21. Shared Agent Civilian Female 3 — Woman in ordinary casual clothes; office worker blouse and slacks, holding a phone up so it hides her face.
22. Shared Agent Civilian Male 1 — Man in ordinary casual clothes; casual shirt and jacket, cap hiding the face.
23. Shared Agent Civilian Male 2 — Man in ordinary casual clothes; delivery rider jacket with helmet on, visor down.
24. Shared Agent Civilian Male 3 — Man in ordinary casual clothes; college hoodie, hood up, earphones, looking down at a phone.
25. Shared Agent Religious 1 — Person of unclear gender in a dark cassock-like robe with a hood; rosary-like string of beads at the wrist; face hidden by the hood.
26. Shared Agent Religious 2 — Person of unclear gender in a dark cassock-like robe with a hood; veil and long robe, hands folded; face hidden by the hood.
27. Shared Agent Religious 3 — Person of unclear gender in a dark cassock-like robe with a hood; wide-sleeved robe, holding a small lantern; face hidden by the hood.
28. Shared Agent Occult 1 — Person of unclear gender in a long dark cloak; sand-colored trim, faint glowing sigils around the hands; face hidden by the hood.
29. Shared Agent Occult 2 — Person of unclear gender in a long dark cloak; tattered cloak, a staff with charms; face hidden by the hood.
30. Shared Agent Occult 3 — Person of unclear gender in a long dark cloak; layered cloak with talisman papers, face hidden by a hood; face hidden by the hood.
```

## 플러그인 매칭 (Claude 담당)

모델 호출 없이 낱말로 고르고, 점수가 같거나 하나도 안 맞으면 이름으로 정해서 같은 대상은 늘 같은 그림이 나옵니다. 그림이 없으면 지금의 Situation Anomaly/Incident/Mystic을 씁니다.

- **괴이·사건:** 상황의 이름 + 발생 지점 + 상황 글에서 장소 낱말을 찾습니다. 예: Subway = 지하철, 역, 승강장, 전철, 선로 / School = 학교, 교실, 기숙학교, 학원 / Hospital = 병원, 의원, 병동, 응급실.
- **특수:** 장소가 아니라 특수 이름에서 종류 낱말을 찾습니다. 예: 「달빛 타투샵」·「우주 쇼핑몰」 → Shop, 「이정 책방」 → Bookshop, 「도깨비 공방」 → Workshop, 「얼굴 없는 장터」 → Market, 「무엇이든 자판기」 → Vending, 「여우 상담실」 → Room, 「친절한 씨앗 키트」·「착한 친구 키링」 → Object, 안 맞으면 Door.
- **조직:** 사진이 없으면 유형(조직형·민간형·프리랜서형)과 이름 낱말(회사·주식회사 → Corporate, 교회·성원·교단 → Religious, 교 → Cult, 연구 → Research, 사채·조직 → Criminal 등)로 Shared Org.
- **거점:** 「Base 영문명」(외부) → 거점에 고른 사진 → 연결 조직 사진 → 이름 낱말로 Shared Base (외부).
- **요원:** 소속 조직(관리국·가짜 관리국 → Suit, 백일몽 → Masked, 프리랜서·협회·중림 → Freelancer, 민간인 → Civilian, 교황청·이슬람 → Religious, 발푸르기스 → Occult)으로 옷, 성별로 남녀를 고르고, 같은 묶음 3장 중 하나를 요원 이름으로 정합니다 (같은 요원은 늘 같은 그림).
  - 성별: 명부 요원의 「성별」 칸(여·남·미정, 2026-10-21 추가). 비어 있으면 요원 로어북의 `Gender: Female/Male` 줄을 읽습니다 (지금 카드 요원 55명 모두 이 줄이 있음). 그래도 모르면 성별이 드러나지 않는 Religious·Occult(후드) 그림을 씁니다.
