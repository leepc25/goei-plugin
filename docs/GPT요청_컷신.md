> **폐기 (2026-10-21 17:00).** 사용자가 컷신을 「도트 영상」으로 정했다. 이 요청서는 GPT에 넘기지 않는다. 새 의뢰서: `docs/GPT요청_컷신영상.md`.

# GPT 요청서 · 오프닝과 시네마틱 컷신 레이어 (2026-10-21 최종판)

주인: 「대사와 컷신」 스레드(Claude). 이전 판(한 장 그림 14장, 장소 배경 4곳)은 **모두 취소**한다. 이미 만든 그림은 쓰지 않는다.

## 정한 것 (사용자 2026-10-21)

- **컷신 = 시네마틱 컷신.** 오프닝(코인 넣고 스타트 전 영상)과 컷신 9개(첫 투입, 이벤트 중간) 모두 오락실 시절 도트 연출로 만든다: 연출된 컷 구성(설정 컷 → 인물 → 클로즈업 → 반응), 여러 층 시차 스크롤, 화면을 크게 채우는 인물 레이어의 움직임(숨쉬기, 머리카락, 옷자락, 고개, 팔), 카메라 이동·줌, 레터박스, 빠른 컷 전환과 번쩍임.
- 게임 화면 안에서 작은 스프라이트만으로 하는 장면은 따로 「이벤트씬」이라 부르고, 컷신을 대신하지 않는다.
- 그림은 컷마다 **레이어를 나눠 투명 배경**으로 받는다. Claude가 「게임 타일과 배경」의 B판 도구로 도트화하고, 엔진의 컷신 재생기가 움직인다.
- 컷신 안 대사는 기존 대본(`src/game/action/story/scripts/cutscenes.ts`)이 화면 위 대화창으로 띄운다. 그림에 글자를 넣지 않는다.

## GPT에게 (작업 방법)

- 저장: **`game-src/art/cutscene/raw/<컷>/<레이어>.png`** (아래 이름 그대로). 다 올린 뒤 `game-src/art/cutscene/raw/README.md`에 받은 파일 목록을 적고 main에 커밋한다. `docs/GPT_요청_목록.md`의 컷신 줄 상태를 「받음」으로 바꾼다.
- 목록을 쉬지 않고 순서대로 전부 만든다. 한 답변에 여러 장 만들어도 된다. 묻지 않는다. 한도에 걸리면 멈춘 번호부터 이어 한다.
- **한 컷의 레이어는 모두 같은 크기(1536×1024)·같은 구도**로 그려서 겹치면 그대로 한 장면이 되게 한다. 레이어마다 자기 것만 그리고 나머지는 투명(안 되면 완전히 평평한 #FF00FF).
- 배경·원경 레이어는 화면보다 넓게: 1536×1024 전체를 채운다(게임은 그 안의 약 1180×664 창을 움직이며 보여 준다). 중요한 것은 가운데 70% 안에.
- 인물은 **움직일 부분을 따로** 그린다(아래 `char_*` 레이어). 따로 그린 부분은 이어지는 자리 아래까지 조금 더 그려서(겹침 여유) 돌려도 틈이 안 보이게 한다.
- 컷마다 시간과 빛이 다르다. 각 컷 문단을 지킨다.

## 공통 스타일 (모든 요청문 맨 앞)

```
STYLE (same for every image)
Layer art for a 1990s arcade game opening (CPS2 / Neo Geo era, like Capcom's Dungeons & Dragons: Shadow over Mystara or Metal Slug intros), set in present-day Seoul, South Korea. Clean flat cel shading with 2-3 tone steps, crisp hard edges, bold dark outlines (about 6-8 px), few large simple shapes, large flat color areas, no fine texture, no noise, no film grain, no blur, no depth of field. NOT pixel art (it will be pixelated later). Muted night colors with strong single accent lights. No text, letters, numbers or logos anywhere (sign plates, buttons and papers stay blank). Every layer is 1536x1024 with a transparent background except where the layer is a full background; all layers of one cut line up exactly.
```

## 쟈알디 (인물이 나오는 레이어에 붙인다)

```
CHARACTER: JYALDI
A tall Korean woman in her late 20s, chief of a secret anomaly-response team. Long straight jet-black hair down to her waist, worn loose. Red eyes (the only strong color on her). Expressionless, calm face; upright posture. Black pantsuit (jacket and trousers, never a skirt), white dress shirt, black necktie, black leather gloves. Full-chested figure, drawn plainly, not exaggerated. A black handgun in a shoulder holster under the jacket. Palette: hair #15141a, suit #1c1d24/#2d2f3a, shirt #e8e6e0, skin #f0d6c4, eyes #d12b3a, gloves #111115.
```

## 오프닝 (컷 8개)

| 컷 | 길이 | 움직임 (엔진) |
| --- | --- | --- |
| op1_city | 4초 | 세 층 시차로 오른쪽으로 흐름, 빌딩 창 불 몇 개 깜빡 |
| op2_building | 3초 | 위에서 아래로 내려옴(세로 이동), 표시등 빨갛게 깜빡 |
| op3_checklist | 2초 | 천천히 확대, 마지막에 흰 번쩍 |
| op4_jyaldi_back | 4초 | 숨쉬기, 머리카락·옷자락 흔들림, 끝에 머리 레이어를 바꿔 고개만 돌림 |
| op5_eye | 1.5초 | 눈 반짝 빛 레이어가 지나감, 미세 흔들림 |
| op6_draw | 2.5초 | 팔 레이어가 총집에서 앞으로 돌며 뽑힘(두 장 바꿔 끼움), 흰 번쩍 |
| op7_panel | 4초 | 버튼 빛 레이어가 위에서 아래로 빠르게 켜짐, 컷 번쩍 두 번 |
| op8_lineup | 6초 | 엘리베이터 문이 열리고 역광 속에서 8명이 실루엣(인물 레이어를 검게)으로 걸어 나와 일렬로 섬. 한 명씩 발밑 조명이 켜지며 전신이 드러나고, 짧은 고유 동작(레이어 흔들기·자세 두 장 바꿔 끼우기)과 이름표가 쾅 붙음. 한 명 0.6초 |

로고는 그 뒤 엔진이 만든다(GPT 그림 없음). 쟈알디 외 요원은 아직 게임 도트가 없어서 지금은 이 GPT 전신 레이어로 쓰고, 도트가 생기면 바꾼다.

```
op1_city — Seoul skyline at night from a high place, moonless cloudy sky glowing faintly orange from the city.
  op1_city/far.png   — night sky with low clouds and a faint glow at the horizon (full background).
  op1_city/mid.png   — distant high-rise silhouettes with scattered lit windows (transparent above the skyline).
  op1_city/near.png  — close dark rooftops, water tanks and antennas along the bottom third (transparent above).
  op1_city/lights.png — only the lit windows of mid.png as small warm squares (transparent elsewhere), for blinking.

op2_building — an old 1990s six-storey office building in Jongno at night, seen straight from the front, one lit lobby at the bottom.
  op2_building/far.png  — night sky and neighboring buildings (full background).
  op2_building/bg.png   — the building facade, tall: the top of the building at the top of the image, the lit glass lobby entrance at the bottom (transparent sky).
  op2_building/lamp.png — only one small red elevator indicator lamp glow seen through the lobby glass (transparent elsewhere).
  op2_building/fg.png   — a dark street lamp and a railing in the foreground at the left edge (transparent elsewhere).

op3_checklist — close-up: an old elevator inspection checklist in a clear plastic sleeve on a pale beige marble wall, dim light, red lamp glow from above.
  op3_checklist/bg.png   — marble wall with brass trim (full background).
  op3_checklist/paper.png — the checklist sheet: rows of empty boxes and lines with NO writing, the signature box at the bottom clearly empty (transparent elsewhere).
  op3_checklist/hand.png — JYALDI's black-gloved right hand and wrist entering from the lower right, index finger touching the empty signature box (transparent elsewhere).

op4_jyaldi_back — JYALDI seen from behind, full figure filling 80% of the image height, standing in front of closed brass-trimmed elevator doors in a marble lobby at night, one red indicator lamp above the doors.
  op4_jyaldi_back/bg.png         — the elevator doors, marble wall, terrazzo floor (full background).
  op4_jyaldi_back/body.png       — her body from behind without head and hair (suit, gloves, legs).
  op4_jyaldi_back/hair.png       — her long black hair as one separate shape from the crown to the waist, slightly longer at the top so it overlaps the head.
  op4_jyaldi_back/head_back.png  — her head from behind (back of the head, ears hidden by hair).
  op4_jyaldi_back/head_turn.png  — her head turned to look over her right shoulder: profile with one red eye visible, same position as head_back.
  op4_jyaldi_back/coat.png       — the lower part of her suit jacket (hem) as a separate shape that can sway.
  op4_jyaldi_back/glow.png       — only the red lamp light falling on the doors and her shoulder (transparent elsewhere).

op5_eye — extreme close-up of JYALDI's face: from the bridge of the nose to the eyebrows, one red eye looking straight at the viewer, strands of black hair across.
  op5_eye/bg.png    — dark background (full).
  op5_eye/face.png  — the face crop with the red eye open.
  op5_eye/shut.png  — the same eye closed (for a blink), same position.
  op5_eye/glint.png — a single sharp white glint on the eye and a thin red light streak (transparent elsewhere).

op6_draw — waist-up shot of JYALDI from the front-side, drawing her handgun.
  op6_draw/bg.png        — dark elevator hall, red lamp light from the side (full).
  op6_draw/body.png      — her torso, head and hair without the right arm, jacket open showing the shoulder holster.
  op6_draw/arm_holster.png — her right arm with the gloved hand gripping the gun still in the holster.
  op6_draw/arm_aim.png   — her right arm extended toward the viewer's left aiming the handgun, same shoulder position.
  op6_draw/flash.png     — a white light streak along the gun barrel (transparent elsewhere).

op7_panel — close-up of the inside elevator button panel (brushed steel, faux-wood below), far too many round buttons in a long column going down off the bottom edge, all faces blank, the lowest ones dark and scratched.
  op7_panel/bg.png     — the panel (full).
  op7_panel/lights.png — only the button faces glowing warm (transparent elsewhere), for lighting one by one.
  op7_panel/grille.png — the small speaker grille at the top with a faint glow behind the holes (transparent elsewhere).

op8_lineup — the team stepping out of a wide-open old elevator into a dark lobby, backlit by cold white light from inside the elevator car. Eight agents in one row, all full-body, front view, the same scale (feet on the same floor line at 88% of the image height, heads at about 25-30%), evenly spaced left to right in this order. Draw each agent on its OWN layer at its own place in the row, so the layers together make the whole lineup.
  op8_lineup/bg.png        — the open elevator car glowing white in the center back, dark marble lobby, terrazzo floor (full).
  op8_lineup/light.png     — only the light beam from the elevator spilling forward on the floor (transparent elsewhere).
  op8_lineup/a1_jyaldi.png   — JYALDI (see CHARACTER), arms down, calm, gloves.
  op8_lineup/a1_jyaldi_b.png — the same, right hand adjusting the glove at the wrist (signature gesture), same place.
  op8_lineup/a2_eileen.png   — EILEEN: small, solid trained build; faded platinum-blonde high ponytail; dull pale eyes; black suit with a dark olive bulletproof vest over it, handgun holster on the right hip, a rifle slung on the left shoulder.
  op8_lineup/a2_eileen_b.png — the same, both hands checking the rifle on its sling.
  op8_lineup/a3_spangdal.png   — SPANGDAL: slim light build, full chest; wavy purple chin-length bob; pale skin; dull gold unblinking eyes; half-smile; black skirt suit, black stockings, low heels.
  op8_lineup/a3_spangdal_b.png — the same, head tilted slightly, one hand raised in a small wave.
  op8_lineup/a4_geshugan.png   — GESHUGAN: athletic build; short snow-white hair; cold blue eyes; flat expression; loose white shirt with rolled sleeves, black slacks, a small belt bag; a puzzle cube in one hand.
  op8_lineup/a4_geshugan_b.png — the same, cube held up turning it.
  op8_lineup/a5_gorgodio.png   — GORGODIO: huge wrestler build, bald, neat beard, confident face; black jacket over the agent suit, boots; a thick cleaver-like blade inside the jacket.
  op8_lineup/a5_gorgodio_b.png — the same, cracking his knuckles, chest out.
  op8_lineup/a6_kyuras.png   — KYURAS: thin, hollow cheeks, light-green hair slicked back, a constant grin; motorcycle jacket with shoulder and elbow pads over the agent suit, no gloves.
  op8_lineup/a6_kyuras_b.png — the same, spinning a motorcycle key on one finger.
  op8_lineup/a7_deadpole.png   — DEADPOLE: small; long straight black hair to the back with bangs; soft round eyes; neat black suit, white shirt, black stab-proof gloves; holster on the left hip.
  op8_lineup/a7_deadpole_b.png — the same, right hand on the gun grip across the body, eyes narrowed sharp.
  op8_lineup/a8_rojemon.png   — ROJEMON: small with a narrow waist; long wavy purple hair; slightly upturned purple eyes; cute face trying to glare; office blouse, skirt and cardigan; a snack pouch.
  op8_lineup/a8_rojemon_b.png — the same, arms crossed, glaring, eyes glowing faintly purple.
```

## 컷신 9개

인물 외형 (해당 인물이 나오는 레이어에 붙인다):

```
CHARACTER: JAEMTRI — Korean woman in her late 20s, the team's mission desk officer. Long brown wavy hair falling below the shoulders, soft green eyes that crinkle when she smiles, a warm "friendly older sister" smile. Curvy figure. Black office skirt suit, black high heels, always holding a tablet.
CHARACTER: PASSENGER — a thin middle-aged Korean man in a worn, outdated grey suit with a loosened tie, tired kind eyes, three years of stubble, friendly smile that feels wrong.
```

각 컷신은 이 순서로 재생한다. 「다시 씀」은 오프닝 레이어를 그대로 쓴다는 뜻(새로 그리지 않음).

### 1. 첫 출근 (first_day) · 약 16초 · 아침
콘티: 사람 하나 없는 아침 종로를 옆으로 훑고 → 쟈알디가 텅 빈 길을 걸어가는 뒷모습 → 사무실 문이 열리며 잼트리가 화면(신입 시점)을 보고 웃는 얼굴 → 쟈알디 무표정 옆얼굴, 눈 깜빡.
```
cs1_street — empty Jongno at 8:40 on a weekday morning, no people, no cars, no birds, overcast cool grey light, traffic lights on.
  cs1_street/far.png  — grey morning sky and distant high-rises (full).
  cs1_street/mid.png  — old 4-6 storey office buildings and shuttered shops along the street (transparent sky).
  cs1_street/near.png — the empty six-lane road and sidewalk across the bottom third.
  cs1_street/fg.png   — a traffic light pole and a street lamp at the right edge (transparent elsewhere).
cs1_walk — JYALDI seen from behind at mid distance, walking away down the middle of the empty road, buildings on both sides.
  cs1_walk/bg.png   — the empty road in one-point perspective toward the vanishing point (full).
  cs1_walk/body.png — JYALDI from behind, full figure, mid-stride, without hair.
  cs1_walk/hair.png — her long black hair as a separate shape, overlapping the head.
cs1_jaemtri — inside a small run-down government office, morning light through blinds; JAEMTRI at the doorway looks straight at the viewer (the new agent) with a welcoming smile, tablet in hand, waist-up.
  cs1_jaemtri/bg.png       — office interior with blinds, desks, grey-green walls (full).
  cs1_jaemtri/body.png     — JAEMTRI waist-up without head.
  cs1_jaemtri/head.png     — her head with the warm smile.
  cs1_jaemtri/head_talk.png — the same head, mouth open mid-word, same position.
cs1_react — JYALDI's face in side profile, close-up, expressionless, red eye.
  cs1_react/bg.png   — soft blurred-looking office background as flat color shapes (full).
  cs1_react/face.png — her profile from the chin to the top of the head with hair.
  cs1_react/shut.png — the same with the eye closed (blink), same position.
```

### 2. 첫 투입 (first_entry) · 약 18초 · 밤
콘티: 밤의 낡은 건물 외경에서 로비로 내려옴 → 엘리베이터 앞 쟈알디 뒷모습, 고개 돌림 → 빈 서명란을 짚는 장갑 손 → 승강기 안 쟈알디 정면, 문이 양쪽에서 닫힘 → 버튼 패널이 끝없이 이어짐 → 붉은 눈.
```
cs2_building — 다시 씀: op2_building (모든 레이어).
cs2_back      — 다시 씀: op4_jyaldi_back (모든 레이어).
cs2_checklist — 다시 씀: op3_checklist (모든 레이어).
cs2_car — inside an old elevator car (brushed steel, faux-wood lower panels, dim warm ceiling light), JYALDI standing in the center facing the viewer, full figure, the doors closing toward her from both sides in the foreground.
  cs2_car/bg.png      — the car interior back wall with the mirror and handrail (full).
  cs2_car/body.png    — JYALDI front view, full figure, arms down, without hair.
  cs2_car/hair.png    — her long black hair, separate.
  cs2_car/door_l.png  — the left steel door panel only, drawn at its fully open position at the left edge (transparent elsewhere).
  cs2_car/door_r.png  — the right steel door panel only, fully open at the right edge.
cs2_panel — 다시 씀: op7_panel (모든 레이어).
cs2_eye   — 다시 씀: op5_eye (모든 레이어).
```

### 3. 첫 호명 (first_call) · 약 10초 · 승강기 안
콘티: 승강기 안 쟈알디 옆모습, 천장등 깜빡 → 인터폰 스피커 클로즈업, 구멍 뒤로 빛 → 쟈알디 눈만 스피커 쪽으로.
```
cs3_side — JYALDI in side view, waist-up, standing in the elevator car, the ceiling light above flickering.
  cs3_side/bg.png    — car interior side wall with the button panel (full).
  cs3_side/body.png  — JYALDI waist-up side view facing right.
  cs3_side/light.png — only the ceiling lamp and its light cone (transparent elsewhere), for flickering.
cs3_intercom — extreme close-up of the round intercom speaker grille on brushed steel.
  cs3_intercom/bg.png   — the steel panel with the grille (full).
  cs3_intercom/glow.png — warm light behind the grille holes only.
cs3_eye — 다시 씀: op5_eye.
```

### 4. 다락방 (attic) · 약 14초 · 정비 구역
콘티: 덕트 사이 비좁은 공간 설정 컷, 작업등이 흔들림 → 버려진 배낭과 침낭 클로즈업 → 벽에 긁어 쓴 지도와 표시 클로즈업(「여기 오래 있지 마」는 자막) → 쪼그려 앉아 벽을 보는 쟈알디.
```
cs4_attic — the hidden "attic" between elevator shafts: cramped space of rusty brown riveted steel plates and ducts, very dark, one orange caged work lamp hanging from a wire.
  cs4_attic/far.png  — deep darkness of the shaft beyond, a few tiny orange lamps far away (full).
  cs4_attic/bg.png   — the cramped room walls and ducts (transparent where it opens to the shaft).
  cs4_attic/lamp.png — only the hanging lamp and its warm light pool (transparent elsewhere), for swinging.
  cs4_attic/fg.png   — a pipe and a duct edge crossing the foreground (transparent elsewhere).
cs4_pack — close-up on the floor: an abandoned old backpack and a rolled sleeping mat, dust, a coiled rope.
  cs4_pack/bg.png    — steel grating floor (full).
  cs4_pack/items.png — the backpack, mat and rope.
cs4_wall — close-up of the scratched steel wall: chalk tally marks and a hand-scratched map of floors made only of lines and boxes (no letters).
  cs4_wall/bg.png    — the wall (full).
  cs4_wall/light.png — the swinging lamp light falling across it (transparent elsewhere).
cs4_crouch — JYALDI crouching low, three-quarter back view, looking at the wall, lamp light on her side.
  cs4_crouch/bg.png   — the attic corner (full).
  cs4_crouch/body.png — JYALDI crouching, without hair.
  cs4_crouch/hair.png — her hair falling over her shoulder, separate.
```

### 5. 삼 년째 승객 (three_years) · 약 12초 · 엘리베이터 홀
콘티: 엘리베이터 홀 설정 컷, 벽에 기댄 승객 → 승객 얼굴 클로즈업, 반쪽 그림자에 친절한 미소 → 한 문을 가리키는 손가락 → 쟈알디의 가늘어진 붉은 눈.
```
cs5_hall — an old elevator lobby at night (pale beige marble, brass trim, one red indicator lamp), the PASSENGER leaning against the wall far right, small in frame.
  cs5_hall/bg.png        — the lobby (full).
  cs5_hall/passenger.png — the PASSENGER leaning, full figure.
  cs5_hall/lamp.png      — only the red lamp glow (transparent elsewhere).
cs5_face — close-up of the PASSENGER's face, half in shadow, kind smile.
  cs5_face/bg.png   — dark marble background (full).
  cs5_face/face.png — his face and shoulders.
  cs5_face/talk.png — the same face, mouth open mid-word, same position.
cs5_point — close-up of the PASSENGER's hand pointing toward one of two closed doors.
  cs5_point/bg.png   — two doors side by side in the dim hall (full).
  cs5_point/hand.png — his hand and sleeve entering from the left (transparent elsewhere).
cs5_eye — 다시 씀: op5_eye.
```

### 6. 귀환 (return) · 약 14초 · 승강로 → 아침 로비
콘티: 승강로를 아래에서 올려다보면 작은 쟈알디가 로프를 오름 → 로프를 잡은 장갑 손 클로즈업 → 해치가 열리며 빛이 쏟아짐 → 아침 햇살 속 진짜 로비, 쟈알디 뒷모습.
```
cs6_shaft — looking straight up a deep vertical elevator shaft from below: rusty steel walls, cables, guide rails, warm light far above, JYALDI small in the middle climbing a single rope.
  cs6_shaft/far.png   — the light far above and the shaft walls fading (full).
  cs6_shaft/near.png  — cables and rails close to the viewer at both edges (transparent in the middle).
  cs6_shaft/rope.png  — the single rope from top to bottom (transparent elsewhere).
  cs6_shaft/body.png  — JYALDI small, climbing, seen from below (transparent elsewhere).
cs6_hands — JYALDI's two black-gloved hands gripping the rope, seen from above, the dark shaft dropping away below.
  cs6_hands/far.png   — the shaft depth with tiny orange lamps far below (full).
  cs6_hands/rope.png  — the rope.
  cs6_hands/hands.png — the two gloved hands and wrists.
cs6_hatch — a steel maintenance hatch overhead being pushed open, white morning light pouring in.
  cs6_hatch/bg.png   — the dark steel ceiling around the hatch frame (full).
  cs6_hatch/lid.png  — the hatch lid only, closed position (transparent elsewhere), to be rotated open.
  cs6_hatch/rays.png — light rays pouring through the opening (transparent elsewhere).
cs6_lobby — the real ground-floor lobby of an ordinary old office building at early morning, warm sunlight streaming through glass entrance doors; JYALDI from behind, full figure, standing in the light, jacket dusty.
  cs6_lobby/far.png  — the morning street outside the glass doors (full).
  cs6_lobby/bg.png   — the lobby walls and glass doors (transparent through the glass).
  cs6_lobby/body.png — JYALDI from behind, without hair.
  cs6_lobby/hair.png — her hair, separate.
  cs6_lobby/sun.png  — only the sunbeams and dust in the air (transparent elsewhere).
```

### 7. 후송 (evac) · 약 12초 · 어둠 → 의무실
콘티: 암흑 속 팽팽하게 당겨지는 로프, 크게 흔들림 → 누운 시점으로 천장 형광등이 깜빡이며 켜짐 → 의무실 침대의 쟈알디가 눈을 뜸 → 옆 탁자 블랙커피에서 김.
```
cs7_rope — total darkness, a single rope pulled taut diagonally across the frame, a faint light at the top.
  cs7_rope/bg.png   — darkness with faint shaft edges (full).
  cs7_rope/rope.png — the taut rope.
cs7_ceiling — point of view lying on a bed: a white infirmary ceiling with one fluorescent tube light.
  cs7_ceiling/bg.png    — the ceiling (full).
  cs7_ceiling/tube.png  — only the lit tube and its glow (transparent elsewhere), for flickering on.
cs7_bed — JYALDI lying in a hospital bed, jacket off, white shirt, tie loosened, one bandage on her forehead, seen from the side at bed height, pale green wall, fluorescent light.
  cs7_bed/bg.png   — the bed and wall (full).
  cs7_bed/body.png — JYALDI lying, eyes closed.
  cs7_bed/open.png — only her face with the eyes open (red), same position.
cs7_coffee — close-up of a bedside table with a paper cup of black coffee.
  cs7_coffee/bg.png    — the table top and pale wall (full).
  cs7_coffee/cup.png   — the paper cup.
  cs7_coffee/steam.png — a few soft steam curls above the cup (transparent elsewhere).
```

### 8. 출구 (exit) · 약 14초 · 새벽
콘티: 버튼 패널 맨 아래에 EXIT 불이 켜짐 → 문이 열리고 새벽빛 역광 속 쟈알디 실루엣 → 건물 앞에 시동 걸린 관리국 차량 → 승강기 문이 닫히며 표시등이 꺼짐(「또 와요」는 대화창).
```
cs8_panel — 다시 씀: op7_panel, 추가 레이어 하나:
  cs8_panel/exit.png — only one button at the very bottom glowing green-white (transparent elsewhere).
cs8_door — elevator doors opened onto a lobby flooded with pale dawn light, JYALDI as a dark silhouette in the doorway, full figure, seen from inside the car.
  cs8_door/bg.png   — the lit lobby beyond the doors (full).
  cs8_door/frame.png — the dark elevator door frame and car edges around the opening (transparent in the opening).
  cs8_door/body.png — JYALDI's silhouette (dark, rim-lit edges).
cs8_car — the front of the old office building at dawn, a plain black government sedan at the curb with its engine running, headlights on, exhaust vapor.
  cs8_car/far.png     — dawn sky over low rooftops (full).
  cs8_car/bg.png      — the building facade and sidewalk (transparent sky).
  cs8_car/car.png     — the sedan from the side.
  cs8_car/exhaust.png — exhaust vapor puffs (transparent elsewhere).
cs8_close — the elevator doors from outside closing, the floor indicator above with one red lamp.
  cs8_close/bg.png     — marble wall and brass frame around the opening (full).
  cs8_close/door_l.png — left door panel, open position.
  cs8_close/door_r.png — right door panel, open position.
  cs8_close/lamp.png   — the red lamp glow only.
```

### 9. 공략 완료 회식 (dinner) · 약 14초 · 저녁
콘티: 창에 불 켜진 파스타집 외경 → 긴 식탁에 둘러앉은 팀(잼트리, 쟈알디 앞쪽) → 메뉴판을 든 잼트리의 신난 얼굴 → 블랙커피 잔을 드는 쟈알디 손.
```
cs9_outside — a small cozy pasta restaurant near Jongno in the evening, warm yellow light from the front window, dark blue sky.
  cs9_outside/far.png — evening sky and rooftops (full).
  cs9_outside/bg.png  — the restaurant front (transparent sky).
  cs9_outside/glow.png — only the warm window light (transparent elsewhere).
cs9_table — inside: a long table full of pasta plates and glasses, warm pendant lights, exposed brick; JAEMTRI at the near left holding a menu, JYALDI at the near right holding a coffee cup, both waist-up, other seats in the back left as dark warm shapes.
  cs9_table/bg.png      — the restaurant interior and back seats (full).
  cs9_table/table.png   — the table with food in the foreground.
  cs9_table/jaemtri.png — JAEMTRI waist-up with the menu.
  cs9_table/jyaldi.png  — JYALDI waist-up with the cup.
cs9_jaemtri — close-up of JAEMTRI's excited smiling face behind the open menu.
  cs9_jaemtri/bg.png   — warm blurred-looking restaurant as flat shapes (full).
  cs9_jaemtri/face.png — her face, hair and the menu.
  cs9_jaemtri/talk.png — the same, mouth open mid-word.
cs9_cup — close-up of JYALDI's black-gloved hand lifting a small cup of black coffee.
  cs9_cup/bg.png    — the table top (full).
  cs9_cup/hand.png  — the gloved hand with the cup.
  cs9_cup/steam.png — steam curls (transparent elsewhere).
```

## 합계

오프닝 47장 + 컷신 9개 새 레이어 110장 = **157장** (첫 투입·첫 호명·승객 컷신 일부는 오프닝 레이어를 다시 씀).

## Claude가 받은 뒤 하는 일

1. 검수: 글자 없음, 레이어끼리 자리가 맞는지, 쟈알디 외형, 따로 그린 부분의 겹침 여유.
2. B판 도구로 도트화(인물은 화면에서 커지므로 도트 크기를 게임과 같은 2배로), 엔진 오프닝·이벤트씬에 연결.
3. 고칠 것은 이 문서 아래 「수정 요청」에 적고 GPT에 다시 맡긴다.
