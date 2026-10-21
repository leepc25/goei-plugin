# GPT 요청서 · 화면 표시 (HUD 얼굴·메뉴 테두리) (2026-10-21)

주인: 「화면 표시와 터치 조작」 스레드(Claude). 코드: `src/game/action/ui/`.
GPT가 그리고, Claude가 도트화(게임 2배 격자, 색 줄임)하고 9칸 자르기를 해서 HUD·메뉴에 넣는다. PixelLab은 쓰지 않는다.

왜 필요한가: 지휘자 품질 검수(2026-10-21 64bc12e)에서 HUD가 「웹 관리 화면 같다」는 지적을 받았다. 코드로 오락실식 묶음(얼굴·체력·필살·탄)까지는 바꿨다. 남은 것은 두 가지다.
- HUD 얼굴 칸에 그림이 없어 「쟈」 글자가 들어가 있다.
- 일시정지·설정·확인 창이 둥근 웹 상자다.
오락실 벨트스크롤(섀도우 오버 미스타라)은 얼굴 그림이 맞을 때·위급할 때 바뀌고, 창에는 금속 테두리가 있다. 이 둘을 그림으로 채운다.

로고는 요청하지 않는다. 한글 글자를 그림으로 받으면 획이 틀리기 쉬워서, 제목 로고는 코드가 도트 글자로 그린다.

## GPT에게 (작업 방법)

- 이 저장소(`leepc25/goei-plugin`)에 바로 올린다. 저장 경로: **`game-src/art/ui/raw/<파일 이름>.png`** (아래 목록 이름 그대로). 다 올린 뒤 `docs/GPT_요청_목록.md` 의 이 줄 상태를 「받음」으로 바꾸고 main에 커밋한다.
- 목록을 쉬지 않고 순서대로 전부 만든다. 묻지 않는다. 한도에 걸리면 멈춘 번호부터 이어서 한다.
- 도트(픽셀아트)로 그리지 않는다. 깨끗한 평면 채색으로 그린다. 도트화는 Claude가 한다.
- 배경은 투명. 투명이 안 되면 그림자 없는 완전한 평면 #FF00FF 자홍색.
- 글자·숫자·기호는 어디에도 넣지 않는다.

## 공통 스타일 (모든 요청문 맨 앞에 붙는 문단)

```
STYLE (same for every image)
1990s arcade beat-'em-up game UI art (like Capcom's Dungeons & Dragons: Shadow over Mystara character portraits and menu frames), but for a present-day Korean paranormal agency. Clean flat cel shading with 2-3 tone steps, crisp hard edges, bold dark outlines (6-8 px at this size), few large simple shapes (it will be shrunk to a tiny pixel-art screen), no painterly texture, no noise, no film grain, no blur. NOT pixel art (it will be pixelated later). Transparent background (if impossible, perfectly flat #FF00FF magenta with no shadow). NO text, letters, numbers or symbols anywhere.
```

## 1. 쟈알디 HUD 얼굴 4장 — `jyaldi_face_sheet.png` (1장, 1024×1024, 2×2 칸)

HUD 왼쪽 위 얼굴 칸에 76×76px로 들어간다(도트 38×38칸 × 2배). 아주 작아지므로 얼굴이 칸을 꽉 채우고, 붉은 눈과 검은 생머리가 작아져도 읽혀야 한다.

```
CHARACTER: Jyaldi, a Korean woman in her 30s, head of a paranormal response team. Long straight jet-black hair falling past the shoulders with straight-cut bangs, deep red eyes, pale skin, calm expressionless face by default, sharp tired eyes. Black trouser suit jacket, white shirt, black necktie, black leather gloves. Palette: hair #15141a/#2a2833, suit #1c1d24/#2d2f3a, shirt #e8e6e0, skin #f0d6c4/#d4b09a, eyes #d12b3a.

SHEET: one 1024x1024 image split into a 2x2 grid of equal square cells (512x512 each), one portrait per cell, the SAME character, SAME camera, SAME size and position in every cell, so the four can swap in place like an arcade HUD face.
Camera: head-and-shoulders bust, face turned 3/4 toward the viewer's RIGHT (she looks into the stage), eyes at 40% of the cell height, the head fills about 70% of the cell height, shoulders cut by the bottom edge of the cell. No background inside the cells (transparent), no frame, no border.
Cell 1 (top-left), NORMAL: calm, expressionless, mouth closed.
Cell 2 (top-right), HIT: wincing in pain, eyes squeezed half shut, teeth gritted, head jerked slightly back, a few strands of hair flying.
Cell 3 (bottom-left), DANGER (low health): exhausted and hurt, a thin line of blood from the temple down the cheek, a bruise on the cheekbone, hair messy over one eye, breathing through the mouth, still glaring.
Cell 4 (bottom-right), POWER (super move ready): cold intense stare, red eyes glowing brightly with a faint red light around them, a few hair strands lifting as if from heat, slight smirk at one corner of the mouth.
```

## 2. 메뉴·HUD 테두리 모음 — `ui_frame_sheet.png` (1장, 1536×1024)

일시정지·설정·확인·선택지 창과 HUD 얼굴 칸·체력 막대·아이템 칸 테두리. 9칸 자르기(모서리는 그대로, 변은 늘림)를 하므로 **모서리 장식은 모서리 안에만**, 변은 길이 방향으로 같은 무늬가 이어지게 그린다.

```
SHEET: one 1536x1024 image with these separate pieces, each fully inside its own area, not touching others, all facing the viewer flat (no perspective, no rotation). Theme: an old Korean government building's elevator hall at night: dark brushed brass and gunmetal steel, small rivets, a thin warm amber inner line. Dark, low-key, so white game text stays readable on the panel center.
Piece A (left half, about 700x700): a large rectangular MENU PANEL frame. Thick dark steel border with brass corner caps and rivets; the inside is a flat, very dark blue-grey (#141b20) solid area with NO texture and NO decoration (text will be printed on it). Corners decorated only within the corner squares; the four straight edges are a plain repeatable pattern so they can be stretched.
Piece B (top right, about 640x96): a horizontal SELECTED ROW plate for the focused menu item: a dark bar with a glowing amber edge on top and bottom and a small brass arrow-shaped cap on the left end only. Middle part plain and stretchable.
Piece C (right, about 200x200): a square PORTRAIT FRAME for the HUD face: thick brass-and-steel square frame, empty transparent center (the face is drawn behind it), small rivets at the four corners.
Piece D (right, about 640x80): a long HEALTH BAR frame: a thick dark steel tube-like frame with brass end caps, empty transparent inside (the bar is drawn by code), the middle stretchable.
Piece E (right, about 150x150): a square ITEM SLOT frame: smaller steel frame with brass corners, flat very dark inside (#141b20).
```

## 받은 뒤 (Claude)

- `tools/` 의 도트화 도구로 2배 격자에 맞춰 줄이고 `game-src/art/ui/dot/` 에 둔다.
- 얼굴: 체력 1/4 아래면 3번, 맞은 직후 0.35초 2번, 필살 게이지가 차면 4번, 나머지 1번. HudState.agent.portrait 대신 얼굴 묶음을 받는 칸을 만든다.
- 테두리: 9칸 자르기로 일시정지·설정·확인·선택지 창과 HUD 얼굴 칸·체력 막대·아이템 칸에 씌운다. 그림이 없을 때는 지금 코드 그림으로 그대로 돈다.
