# GPT 요청서 · 컷신 그림 (2026-10-21)

주인: 「대사와 컷신」 스레드(Claude). 걷는 장면의 벽·바닥·물건은 여기 없다(`docs/GPT요청_게임배경.md`).
GPT가 그리고, Claude가 검수·정리(자르기, 색 맞추기)해서 통합본 컷신에 넣는다. PixelLab은 쓰지 않는다.

컷신 대본은 `src/game/action/story/scripts/cutscenes.ts`. 사무실·엘리베이터 홀·승강기 안·로비·다락방처럼 걸어 다니는 곳의 컷신은 게임 배경을 그대로 쓰고, 여기서는 **걷는 장면에 없는 곳(배경형 6장)** 과 **한 장 그림(8장)** 만 그린다.

## GPT에게 (작업 방법)

- 이 저장소(`leepc25/goei-plugin`)에 바로 올린다. 저장 경로: **`game-src/art/cutscene/raw/<파일 이름>.png`** (아래 목록 이름 그대로, 확장자 `.png`). 다 올린 뒤 `game-src/art/cutscene/raw/README.md` 에 받은 파일 목록을 적고 main에 커밋한다. `docs/GPT_요청_목록.md`의 이 요청 줄 상태를 「받음」으로 바꾼다.
- 목록 14장을 쉬지 않고 순서대로 전부 만든다. 한 답변에 여러 장 만들어도 된다. 묻지 않는다. 한도에 걸리면 멈춘 번호부터 이어 한다.
- 크기: **모두 1:1, 1024×1024.**
- 도트(픽셀아트)로 그리지 않는다. 깨끗한 평면 채색 그림. 도트화·색 줄이기는 Claude가 한다.
- 글자 금지: 간판·버튼·서류·벽 낙서에 글자·숫자·로고를 쓰지 않는다(빈칸으로). 숫자와 문장은 게임이 그 위에 띄운다.

## 게임 화면에 넣는 법 (그릴 때 지킬 구도)

게임 화면은 1280×720(16:9) 하나다. 1:1 그림을 두 가지로 쓴다.

| 쓰임 | 넣는 법 | 그릴 때 |
| --- | --- | --- |
| **배경형** (`cs_bg_*`) | 그림 가운데 가로 띠 1024×576(위에서 224px ~ 800px)만 잘라 1.25배 → 1280×720 전체를 채운다. 그 위로 엔진이 요원(쟈알디 도트)을 걷게 한다 | 위 22%·아래 22%는 잘린다. 중요한 것은 가운데 띠 안에. 사람을 그리지 않는다. 바닥(사람이 설 자리)은 그림 높이의 62~76% 사이에 평평하게 |
| **한 장 그림** (`cs_key_*`) | 그림 전체를 720×720으로 줄여 화면 가운데(가로 280~1000)에 놓고, 좌우는 검정. 자막은 그림 아래쪽, 대화창은 그림 위쪽 16% 근처에 겹친다 | 주인공·주제는 가운데 50% 안에. 맨 위 20%는 대화창에 가려도 괜찮은 벽·하늘·어둠으로 |

## 공통 스타일 (모든 요청문 맨 앞에 붙인다)

게임 배경 요청서와 같은 문단을 쓴다. 화면이 서로 이어져 보이게 하려는 것이다.

```
STYLE (same for every image)
2D side-scrolling beat-'em-up game art, like a 1990s arcade brawler (Capcom's Dungeons & Dragons: Shadow over Mystara) but set in present-day South Korea. Clean flat cel shading with 2-3 tone steps, crisp hard edges, no painterly brush texture, no noise, no film grain, no blur, no depth of field. NOT pixel art (it will be pixelated later), but keep shapes simple and readable at small size. Muted, slightly desaturated colors, dim lighting. No text, letters, numbers, logos or signs with writing anywhere (sign plates, buttons and papers stay blank). Square 1:1, 1024x1024.
```

## 쟈알디 (사람이 나오는 그림에 붙인다)

```
CHARACTER: JYALDI
A tall Korean woman in her late 20s, the chief of a secret anomaly-response team. Long straight jet-black hair down to her waist, worn loose. Red eyes (the only strong color on her, clearly red even when small). Expressionless, calm face; upright, straight posture. Black pantsuit (jacket and trousers, never a skirt), white dress shirt, black necktie, black leather gloves. Curvy full-chested figure that the shirt buttons strain against, drawn plainly, not exaggerated. Carries a black handgun in a holster under the jacket (not drawn in hand unless stated). Palette: hair #15141a, suit #1c1d24/#2d2f3a, shirt #e8e6e0, skin #f0d6c4, eyes #d12b3a, gloves #111115.
```

## 장소 색감 (게임 배경 요청서와 맞춘 것)

- 엘리베이터 홀: 옅은 베이지 대리석 벽, 놋쇠 테두리, 짙은 테라초 바닥, 빨간 표시등 하나만.
- 승강기 안: 은색 헤어라인 철판, 아래쪽은 나무무늬 판, 둥근 버튼 줄, 작은 스피커 망.
- 정비 구역·다락방: 녹슨 갈색 리벳 철판과 낡은 콘크리트, 철 I빔 기둥, 철망 씌운 주황 작업등, 아주 어두움.
- 로비 층: 연회색 벽 판, 회색 돌 기둥, 차가운 흰 천장등.

## 목록 (14장)

### 배경형 6장 (사람 없음)

```
1. cs_bg_street — Jongno, central Seoul, at 8:40 on a weekday morning, completely empty: no people, no cars, no birds. A wide six-lane road and sidewalk seen from the side, old office buildings and shuttered shops behind, traffic lights on, soft grey morning light, an eerie stillness. The sidewalk (where a person would stand) is flat across the 62-76% height band.
2. cs_bg_shaft — inside a deep vertical elevator shaft, seen from the side: rusty brown riveted steel walls, guide rails, thick steel cables, one rope hanging straight down in the center from a faint warm light far above, darkness below. Orange caged work lamps at two heights. (A character will be shown climbing the rope.)
3. cs_bg_lobby_real — the real ground-floor lobby of an ordinary old Korean office building at early morning: light grey wall panels, grey stone columns, glass entrance doors on the right with pale morning sunlight streaming in, a closed elevator with brass trim on the left. Calm and safe-feeling, warmer than the night scenes. Flat floor in the 62-76% band.
4. cs_bg_medbay — a small infirmary room in the team headquarters: one hospital bed with white sheets (empty), a bedside table with a paper coffee cup, a folding screen, a drip stand, fluorescent ceiling light, pale green walls. Quiet. Flat floor in the 62-76% band.
5. cs_bg_exit_car — outside the old office building entrance at dawn: the building's glass doors behind, and at the curb a plain black government sedan with its engine running (exhaust vapor, headlights on, back door open, no driver visible). Empty street. Flat sidewalk in the 62-76% band.
6. cs_bg_pasta — inside a small cozy neighborhood pasta restaurant near Jongno in the evening: warm yellow pendant lights, wooden tables, one long table pushed together with many plates of pasta, glasses and a bottle, chairs empty and slightly pulled out as if people just sat down. Brick wall and a chalkboard menu with no writing.
```

### 한 장 그림 8장

```
7. cs_key_first_day — JYALDI (see CHARACTER) standing alone in the middle of the completely empty Jongno road at morning, seen from slightly behind and to the side, her long black hair moving a little in the wind, buildings towering on both sides, no people or cars anywhere. Lonely, eerie, cinematic.
8. cs_key_checklist — close-up of an old elevator inspection checklist in a clear plastic sleeve fixed to a beige marble wall next to brass-framed elevator call buttons: rows of empty boxes and lines with NO writing, and the signature box at the bottom clearly empty. A black-gloved hand (JYALDI's) touches the empty signature box. Dim light, one red indicator lamp glowing above.
9. cs_key_panel — close-up of the inside elevator button panel (brushed steel, faux-wood below): far too many round buttons in a long column going down off the bottom of the image, all faces blank (no numbers), a few glowing faintly, the lowest ones dark and scratched. A small speaker grille at the top. Unsettling.
10. cs_key_intercom — extreme close-up of the small round speaker grille of an old elevator intercom on brushed steel, a faint warm light glowing behind the holes as if someone is about to speak. Nothing else.
11. cs_key_attic — the "attic" hidden between elevator shafts where former agents rested: a cramped space of rusty brown steel plates and ducts, one hanging orange work lamp, an abandoned backpack and a sleeping mat, old chalk tally marks and a hand-scratched map of floors on the steel wall made only of lines and boxes (no letters), a coiled rope. Nobody there. Warm lamp in cold darkness.
12. cs_key_passenger — in a dim elevator lobby with beige marble and brass trim, a thin middle-aged Korean man in a worn, outdated grey suit and loosened tie stands facing the viewer with a kind, tired smile, one hand pointing to the side toward a door out of frame. Half of his face in shadow. He looks friendly, and that is what feels wrong.
13. cs_key_rope — JYALDI (see CHARACTER) climbing a single rope hand over hand up a dark vertical elevator shaft, seen from below and to the side, her long black hair hanging, jacket dusty, a faint warm light far above her. Rusty steel walls and cables around.
14. cs_key_medbay — JYALDI (see CHARACTER) lying in a hospital bed in a small infirmary, jacket off (white shirt and black tie loosened), one bandage on her forehead, eyes just opened (red), looking at the ceiling, expressionless. A paper cup of black coffee on the bedside table. Fluorescent light, pale green wall.
```

## Claude가 받은 뒤 하는 일

1. 14장 검수: 글자가 들어갔는지, 쟈알디 외형(검은 긴 머리·붉은 눈·바지 정장·넥타이·장갑), 배경형의 바닥 높이와 사람 없음, 한 장 그림의 주제가 가운데 50% 안에 있는지.
2. 고칠 것은 이 문서 아래 「수정 요청」에 번호별로 적고 GPT에 다시 맡긴다.
3. 통과한 그림은 배경형은 1280×720, 한 장 그림은 720×720 AVIF로 줄여 `assets/game/cutscene/`에 넣고, 컷신 대본(`cutscenes.ts`)의 장면 이름에 연결한다. 엔진 쪽 그리기 자리는 「게임 전투와 조작」과 맞춘다.

| 컷신 | 쓰는 그림 |
| --- | --- |
| 첫 출근 (first_day) | 7 → 1 → (사무실은 게임 배경) |
| 첫 투입 (first_entry) | 8 → 9 → (로비는 게임 배경) |
| 첫 호명 (first_call) | 10 |
| 다락방 (attic) | 11 |
| 삼 년째 승객 (three_years) | 12 |
| 귀환 (return) | 13 → 2 → 3 |
| 후송 (evac) | 14 → 4 |
| 출구 (exit) | 9 → 5 |
| 회식 (dinner) | 6 |
