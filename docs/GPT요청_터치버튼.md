# GPT 요청서 · 터치 단추·퀵슬롯 아이콘·키 글자판 (2026-10-21)

주인: 「화면 표시와 터치 조작」 스레드(Claude). 코드: `src/game/action/ui/` (touch.ts, hud.ts).
GPT가 그리고, Claude가 도트화(`tools/ui_pixelize.py`, 4px = 1도트, 색 줄임)해서 폰 터치 단추·HUD 퀵슬롯·조작 안내에 넣는다. PixelLab은 쓰지 않는다.

왜 필요한가: 검수 12에서 폰 터치 단추가 「웹 단추 + 시스템 글꼴」, 퀵슬롯이 「? 회색 네모·매끈한 단색·빨간 점선」이라는 지적을 받았다. 지금은 코드 틀에 글자를 얹은 대역이다. 오락실 게임처럼 단추마다 그림 하나로 무엇인지 보이게 한다.

## GPT에게 (작업 방법)

- 이 저장소(`leepc25/goei-plugin`)에 바로 올린다. 저장 경로: **`game-src/art/ui/raw/<파일 이름>.png`**. 아래 목록 이름을 그대로 쓴다. 한 장 끝날 때마다 커밋하고 push 한다. 다 끝나면 `docs/GPT_요청_목록.md` 의 이 줄 상태를 「받음」으로 바꾼다.
- 세 장을 순서대로 전부 만든다. 묻지 않는다. 한도에 걸리면 멈춘 장부터 이어서 한다.
- 크기는 세 장 모두 **1536×1024**, 배경은 **투명**이다. 투명이 안 되면 그림자 없는 완전한 평면 #FF00FF 로 한다.
- 칸은 **같은 크기의 격자**로 나눈다(장마다 아래 격자). 칸 하나에 물건 하나만 넣고, 칸 안에 여백을 두며 칸끼리 닿지 않게 한다. 칸 순서는 왼쪽 위에서 오른쪽으로, 다음 줄로 이어진다.
- 도트(픽셀아트)로 그리지 않는다. 깨끗한 평면 채색으로 그린다. 도트화는 Claude가 한다.
- 3번(키 글자판)만 글자를 넣는다. 1·2번에는 글자·숫자·기호를 넣지 않는다.

## 공통 스타일 (모든 요청문 맨 앞에 붙는 문단)

```
STYLE (same for every image)
1990s arcade beat-'em-up game UI art (like Capcom's Dungeons & Dragons: Shadow over Mystara), for a present-day Korean paranormal agency. Same look as the existing UI frames: dark gunmetal steel with dark brushed-brass corner caps and small rivets, a thin warm amber inner line. Clean flat cel shading with 2-3 tone steps, crisp hard edges, bold dark outlines (6-8 px at this size), few large simple shapes: everything will be shrunk to about 40x40 pixels, so each icon must read as ONE big bold silhouette. No painterly texture, no noise, no blur, no glow halos outside the shape, no drop shadow outside the cell. NOT pixel art (it will be pixelated later). Transparent background.
```

## 1. 터치 단추 16칸 — `touch_buttons_sheet.png` (1536×1024, 4열×4줄, 칸 384×256)

폰 가로 화면에서 좌우 검은 띠에 세로로 쌓이는 단추이다. 실제 크기는 가로 약 64px × 세로 42px이다. 칸마다 **가로로 긴 금속 단추판(칸의 90%) 하나**를 그리고, 그 가운데에 흰색·크림색 그림 하나를 크게 넣는다. 그림은 단추판 높이의 70%를 채운다. 단추판 테두리와 모서리는 16칸이 모두 같다.

```
SHEET: 1536x1024, a 4x4 grid of equal cells (384x256 each). In every cell draw ONE horizontal rectangular metal button plate filling 90% of the cell (dark steel #1c242a face, brass corner caps, rivets, thin amber inner line), identical frame in all cells. On the plate center, ONE bold cream-white (#efe6cc) pictogram with a black outline, filling about 70% of the plate height. NO letters, NO numbers.
Cell 1 ATTACK: a clenched gloved fist punching forward (side view, knuckles to the right), with 3 short speed lines. Make this plate's face dark red (#5a1a14) instead of steel.
Cell 2 SHOOT: a black semi-automatic pistol in side view pointing right, small muzzle flash.
Cell 3 UNIQUE (explosion power): an open palm with a spiky starburst explosion in front of it.
Cell 4 GUARD: two crossed forearms in front of the face (X block), seen from the front.
Cell 5 SUPER: a single wide-open eye with radiating spikes around it.
Cell 6 INTERACT: a hand reaching to grab, with a small sparkle.
Cell 7 JUMP: a bold upward arrow above two short ground lines.
Cell 8 EVADE: a running leg silhouette with two horizontal dash streaks behind it.
Cell 9 RELOAD: a pistol magazine with a curved circular arrow around it.
Cell 10 SUPPORT: a handheld walkie-talkie radio with two small signal arcs.
Cell 11 MENU: three thick horizontal bars.
Cell 12 MAP: a folded paper map with a pin.
Cell 13 EMPTY ITEM SLOT: the same plate but square-ish (the plate fills a centered square of the cell), empty dark face, no pictogram.
Cell 14 PLAIN BUTTON (normal): the plate only, no pictogram.
Cell 15 PLAIN BUTTON (pressed): the plate only, face slightly brighter and pushed in (darker top inner edge, lighter bottom), amber line glowing brighter.
Cell 16 SUPER READY: the plate only, with the amber inner line replaced by a thick bright gold line and gold corner caps.
```

## 2. 퀵슬롯 아이콘 12칸 — `quickslot_icons_sheet.png` (1536×1024, 4열×3줄, 칸 384×341)

HUD 왼쪽 아래 아이템 칸과 폰 아이템 단추에 약 36×36px로 들어간다. **물건만** 그리고 테두리는 그리지 않는다(틀은 코드가 씌운다). 정면 또는 아주 살짝 위에서 보고, 한 칸을 꽉 채운다. 종류별 대표 색: 회복은 초록, 해제는 청록, 투척은 주황, 특수는 보라·금색이다.

```
SHEET: 1536x1024, a 4x3 grid of equal cells (384x341 each), ONE item per cell, each item large (fills ~80% of its cell), front view, no frame, no background, transparent. NO letters, NO numbers, NO labels on bottles or packages (keep them blank).
Cell 1 medkit: a small green first-aid pouch with a white cross shape (shape only, no letters).
Cell 2 bandage: a rolled white compression bandage with one loose end, red stripe.
Cell 3 antidote (purifier): a small teal glass vial with a cork, glowing teal liquid.
Cell 4 salt: a small cloth pouch tied at the top, spilling white salt grains.
Cell 5 flash grenade: a cylindrical stun grenade, orange band, pin ring.
Cell 6 smoke grenade: a grey cylindrical smoke canister with a puff of grey smoke at the top.
Cell 7 charm: a yellow paper talisman strip with red brush-stroke patterns (abstract strokes, not readable characters).
Cell 8 energy drink: a slim purple can with a lightning-bolt shape, no text.
Cell 9 adrenaline: an auto-injector pen with a purple cap and a yellow tip.
Cell 10 unknown item: a sealed clear evidence bag with a dark lump inside and a blank tag.
Cell 11 pistol magazine: a black pistol magazine with brass bullets visible at the top.
Cell 12 empty: a faint thin dashed square outline only (very low contrast grey), nothing else.
```

## 3. 키 글자판 20칸 — `keycaps_sheet.png` (1536×1024, 5열×4줄, 칸 307×256)

PC 화면의 조작 안내(「E 조사」 같은 말풍선, 조작법 화면)에 키 대신 들어가는 작은 글자판이다. 실제 크기는 높이 약 24px이다. 칸마다 **키 하나**를 그린다. 키 위의 글자는 아래 표의 글자 **그대로**, 굵은 고딕 대문자로, 키 윗면 가운데에 크게(키 높이의 55%) 쓴다. 다른 글자는 넣지 않는다.

```
SHEET: 1536x1024, a 5x4 grid of equal cells (307x256 each). In every cell ONE chunky arcade-style keycap seen from the front and slightly above: cream-white top face (#efe6cc), darker beige side (#b8ae96), thick black outline, small brass rim. Print the given label in bold black sans-serif capitals, centered on the top face, 55% of the key height. Exactly these labels and nothing else:
Row 1: A, S, D, Q, W
Row 2: E, R, C, Z, X
Row 3: H, 1, 2, 3, 4
Row 4: ESC, SPACE (draw this keycap 2x wider than the others, still centered in its cell), SHIFT (1.6x wider), a round gamepad face button with letter A (green), a round gamepad face button with letter B (red).
```

## 받은 뒤 (Claude)

- `tools/ui_pixelize.py` 로 칸을 잘라 도트로 바꾸고 `game-src/art/ui/dot/` 와 `kit.gen.ts` 에 넣는다.
- 1번은 폰 가로 띠 단추 16개의 판과 그림으로 쓴다. 아이템 단추는 13번 판에 2번 아이콘을 얹는다. 누름은 15번, 필살이 차면 16번이다.
- 2번은 HUD와 터치 아이템 칸의 아이콘이다. 아이템 모듈 아이콘보다 먼저 쓰고, id 대응은 medkit, bandage, antidote, salt, flash, smoke, charm, energy, adrenaline, 모르는 것, 탄창, 빈 칸 순서이다.
- 3번은 조사 안내와 조작법 화면의 키 표시이다.
- 그림이 없을 때는 지금 코드 그림으로 그대로 돈다.
