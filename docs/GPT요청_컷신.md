# GPT 요청서 · 오프닝과 클로즈업 레이어 (2026-10-21 최종 정정판)

주인: 「대사와 컷신」 스레드(Claude). 이전 판(한 장 그림 14장, 장소 배경 4곳)은 **모두 취소**한다. 이미 만든 그림은 쓰지 않는다.

## 정한 것 (사용자 2026-10-21)

- 컷신 9개는 **이벤트씬**이다. 게임 화면 안에서 게임 배경(`docs/GPT요청_게임배경.md`)과 쟈알디 등 기존 도트 클립이 대본대로 걷고, 마주 보고, 놀라고, 문을 연다. GPT 그림이 필요 없다.
- GPT 그림은 **오락실식 도트 오프닝**(CPS2·네오지오 시절: 여러 층 스크롤 배경, 화면을 크게 채우는 인물이 실제로 움직임, 얼굴·눈 클로즈업, 빠른 컷 전환과 번쩍임, 마지막 로고)과 **꼭 필요한 클로즈업 3컷**에만 쓴다.
- 그림은 컷마다 **레이어를 나눠 투명 배경**으로 받는다. Claude가 「게임 타일과 배경」의 B판 도구로 도트화하고, 엔진에서 레이어 시차·카메라·흔들림·번쩍임과 인물 레이어 움직임(숨쉬기, 머리카락, 옷자락, 고개, 팔)으로 움직인다.

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

## 클로즈업 3컷 (이벤트씬 안에 잠깐 끼우는 것)

```
cu_intercom — elevator intercom speaker grille on brushed steel, extreme close-up (첫 호명).
  cu_intercom/bg.png   — brushed steel panel with the round grille (full).
  cu_intercom/glow.png — warm light behind the grille holes only.

cu_attic_wall — the scratched wall of the agents' "attic" between elevator shafts: rusty brown steel plate, old chalk tally marks and a hand-scratched map of floors made only of lines and boxes (no letters), an orange caged work lamp (다락방).
  cu_attic_wall/bg.png   — the wall (full).
  cu_attic_wall/lamp.png — only the lamp and its warm light pool (transparent elsewhere), for flickering.

cu_rope_hands — JYALDI's two black-gloved hands gripping a single rope, seen from above, the dark elevator shaft dropping away below with tiny orange lamps (귀환).
  cu_rope_hands/far.png   — the shaft depth with small lamps far below (full).
  cu_rope_hands/rope.png  — the rope (transparent elsewhere).
  cu_rope_hands/hands.png — the two gloved hands and wrists on the rope (transparent elsewhere).
```

합계: 오프닝 47장(op1~op7 29장 + op8 18장) + 클로즈업 7장 = 54장.

## Claude가 받은 뒤 하는 일

1. 검수: 글자 없음, 레이어끼리 자리가 맞는지, 쟈알디 외형, 따로 그린 부분의 겹침 여유.
2. B판 도구로 도트화(인물은 화면에서 커지므로 도트 크기를 게임과 같은 2배로), 엔진 오프닝·이벤트씬에 연결.
3. 고칠 것은 이 문서 아래 「수정 요청」에 적고 GPT에 다시 맡긴다.
