# GPT 요청서 · 아이템·무기·든 물건·상인 물건 (2026-10-21)

주인: 「아이템과 무기」 스레드(Claude). 도트화·자르기·손잡이 기준점(grip) 측정은 「게임 타일과 배경」 스레드가 한다.
지금 게임 안의 무기·아이템·물건은 코드로 그린 회색 아이콘(`src/game/action/items/icons.ts`의 `drawItemIcon`)이다. 이 그림들로 바꾼다.
**사람·캐릭터·적·동료는 그리지 않는다.** 손도 그리지 않는다. 물건만.

## GPT에게 (작업 방법)

- 이 저장소(`leepc25/goei-plugin`)에 바로 올린다. 저장 경로: **`game-src/art/items/raw/<파일 이름>.png`** (아래 목록 이름 그대로). 장마다 바로 커밋해 main에 올린다. 다 끝나면 `game-src/art/items/raw/README.md`에 받은 파일 목록을 적는다.
- 목록 1번부터 8번까지 쉬지 않고 순서대로 전부 만든다. 묻지 않는다. 한도에 걸리면 멈춘 번호부터 이어 한다. 끝나면 docs/GPT_요청_목록.md의 이 줄 상태를 「받음 N장」으로 바꾼다.
- 도트(픽셀아트)로 그리지 않는다. 깨끗한 평면 채색 그림으로 그린다. 도트화는 Claude가 한다.
- 한 장 = 물건 9개 모음, 1536×1024, 3×3 칸, 칸마다 하나.

## 공통 스타일 (모든 요청문 맨 앞에 붙인다)

```
STYLE (same for every image)
Game item art for a 2D side-scrolling beat-'em-up, like a 1990s arcade brawler (Capcom's Dungeons & Dragons: Shadow over Mystara) but set in present-day South Korea. Clean flat cel shading with 2-3 tone steps, crisp hard edges, bold dark outlines (about 6-8 px thick at this size) around every object, few large simple shapes (each object will be shrunk to a small pixel sprite, about 16-60 pixels), no painterly texture, no noise, no film grain, no blur, no tiny details, no scratches smaller than a finger. NOT pixel art (it will be pixelated later). Slightly muted colors, but each object must read clearly on a dim background. NO people, no hands, no characters, no creatures, no text, letters, numbers, logos or brand marks anywhere (labels stay blank).

SHEET RULES
One sheet of 9 separate objects, 1536x1024, transparent background (if transparency is not possible, a perfectly flat #FF00FF magenta background with no shadows on it). 3x3 grid, one object per cell, numbered left-to-right, top-to-bottom (cell 1 top-left, cell 9 bottom-right). Each object fully inside its cell with a clear margin, not touching other cells. Make each object fill most of its cell (relative size between objects does not matter; it is resized per object later). No cast shadows, no glow spilling outside the outline, no background props.
```

## 시점 규칙 두 가지 (요청문에 해당하는 것을 STYLE 뒤에 붙인다)

```
HELD VIEW (weapons and things held in one hand)
Pure side view (profile), lying horizontally, pointing to the RIGHT: the handle/grip end on the LEFT, the business end (muzzle, blade tip, pipe end) on the RIGHT. The camera looks exactly at the side, no 3/4 angle, no perspective, no tilt. The handle must be clearly visible as a separate shape (a hand will be placed there later).
```

```
STANDING VIEW (things that stand on the floor or are shown as an icon)
Every object faces the viewer squarely, front side parallel to the image, NOT rotated left or right (no 3/4 angle), seen from slightly above so only a thin strip of the top shows; the same camera for all nine. Standing upright on its base (base at the bottom of the cell).
```

## 목록 (각 줄이 GPT 대화 한 번 / 이미지 한 장)

### 1. items_weapons_temp · 임시 무기 (HELD VIEW)

```
1 long rusty steel pipe (about 90 cm), plain, slightly bent near the right end
2 broken wooden chair leg, thick round wood, splintered on the right end
3 kitchen knife, black handle on the left, wide steel blade
4 black Japanese katana without sheath, black wrapped handle with a dark round guard, long dark blade
5 compact black submachine gun with a short straight magazine underneath and a folded stock
6 black service pistol (police-style semi-automatic), plain
7 pump-action shotgun, dark steel barrel, brown wooden stock on the left and wooden pump grip
8 small cardboard box of pistol ammunition, lid open, brass rounds visible (no text)
9 one straight black rifle magazine full of brass rounds (standing upright in this cell)
```

### 2. items_weapons_signature · 요원 고유 무기 (HELD VIEW, 몸과 따로 그림)

```
1 compact matte black semi-automatic pistol, short slide, small (agent Jyaldi's sidearm)
2 short black carbine rifle with a small optic sight, short barrel, collapsible stock on the left (agent Aileen)
3 black full-size semi-automatic pistol with a slightly longer slide (agent Aileen's sidearm)
4 dark grey semi-automatic pistol with a chunky frame and an extended magazine sticking out under the grip (agent Deadpole)
5 large heavy kitchen cleaver-like chef's knife, thick wooden handle on the left, broad steel blade (agent Gorgodio)
6 the same chef's knife from cell 5 stuck point-down into the floor at an angle (only the knife, no floor drawn)
7 small cube about the size of a fist, three flat colors on its visible faces (dark blue, grey, pale cyan), sharp edges, shown straight-on (agent Geshugan's floating cube)
8 small handmade rag doll about 30 cm, stitched cloth body, button eyes, no expression, no mouth, standing upright, purple thread tied to its head (agent Rojemon's carried doll; an object, not a character)
9 spare black pistol magazine (standing upright)
```

### 3. items_consumables · 소모품 1~4칸 (STANDING VIEW)

```
1 green first-aid kit box with a white cross, closed, small handle on top
2 roll of white compression bandage with a loose end hanging
3 small glass bottle of clear teal liquid with a cork stopper (purifying medicine)
4 cloth pouch of coarse white salt, tied with string, a few salt grains spilling at the base
5 cylindrical flashbang grenade, orange body, grey top with a pin and ring
6 cylindrical smoke grenade, grey body, a puff of grey smoke drawn on top as a simple shape
7 vertical paper talisman (bujeok), yellow paper with red brush strokes that are NOT letters (abstract swirl and lines)
8 tall energy drink can, purple with a yellow lightning shape, no text
9 medical syringe with red liquid (adrenaline), lying horizontally with needle to the right
```

### 4. items_pickups · 바닥에 떨어지는 것 (STANDING VIEW)

```
1 small bundle of folded green Korean-style banknotes (no numbers, no faces), held with a rubber band
2 small pile of three gold-colored coins (blank faces)
3 glowing purple crystal shard, jagged, about the size of a finger (anomaly shard)
4 small round green glowing healing orb with a white plus shape inside
5 handful of loose brass pistol rounds (4 rounds)
6 crumpled scrap of grey metal equipment with a broken bolt (equipment scrap)
7 a large golden coin standing on its edge, slightly wrong-looking: the rim is twisted (upside-down coin)
8 old rusty iron elevator key with a round bow and a big bit
9 single human tooth, slightly yellowed (a relic, not gory)
```

### 5. items_relics · 회수물 (STANDING VIEW)

```
1 old instant photo with the person's face area blank and smudged pale (no visible face), standing upright
2 small glass jar with a brass lid holding a swirling pale violet mist and tiny star specks (dream collector)
3 orange and black rugged flight-recorder style box with a carrying handle (elevator black box)
4 strange brass device with dials and a small antenna, purpose unclear (unknown equipment)
5 worn canvas backpack, closed, standing upright
6 old leather wallet, closed
7 cracked hand mirror, round, wooden handle at the bottom (the mirror shows only a pale grey blur)
8 small wooden music box, lid closed
9 stack of three old cassette tapes with blank labels
```

### 6. items_vendor · 중림 상인·의사·사채·자판기 물건 (STANDING VIEW)

```
1 a small street-market stall: folding table with a cloth, cardboard boxes and goods on it, a striped awning on two poles above (NO person behind it)
2 a black doctor's bag, open at the top, with bandages and a stethoscope showing
3 a thick white envelope stuffed with banknotes (loan money), no writing
4 a slightly creepy old vending machine, front view, glowing pale window with blank packages inside, round blank buttons, a coin slot, no text
5 a wooden crate of goods with straw padding and a few small boxes (merchant stock)
6 a small metal cash box, lid closed, with a lock
7 a folding medical stretcher-side tray with surgical tools laid out (clinic tray)
8 a hanging bare light bulb with a short cord (stall lamp)
9 a blank paper price tag on a string
```

### 7. props_throw_break · 들어 던지는 것·부수는 것 (STANDING VIEW)

```
1 simple wooden chair with a backrest
2 terracotta flower pot with a green leafy plant
3 red fire extinguisher with a black hose
4 old boxy CRT television with two antennas on top, screen dark grey
5 low round Korean folding dining table (bapsang), legs folded out
6 grey metal trash can with a lid
7 wooden shipping crate with cross braces
8 low wooden chest of drawers, three drawers, closed
9 row of six grey apartment mailboxes in one metal unit (blank name plates)
```

### 8. props_break_more · 부수는 것 나머지·부서진 조각 (STANDING VIEW)

```
1 red steel oil drum with a yellow hazard triangle (no text)
2 tall green steel supply locker with a white blank label plate, doors closed
3 a square section of cracked concrete wall (about 1 m), deep cracks spreading from the center (to be placed on a wall)
4 broken wooden crate pieces: a small pile of planks and splinters
5 broken chest of drawers pieces: a fallen drawer and boards
6 bent and dented mailbox door panels, a small pile
7 burst oil drum: torn open, blackened, lid lying beside it
8 broken terracotta pot shards with spilled soil and the plant lying on its side
9 smashed CRT television with a cracked screen and a few glass pieces
```

## 받은 뒤 (Claude: 「게임 타일과 배경」 스레드)

1. 물건 그림 도트화는 배경 물건과 같은 방식(`tools/bg_pixelize.py`, 마젠타·투명 제거, 칸마다 덩어리 자르기). 크기(도트): 손에 드는 무기 길이 16~36, 소모품·줍는 것 12~20, 들어 던지는 물건·부수는 물건은 배경 물건처럼 실제 높이(`heights.json`).
2. **손잡이 기준점 `grip: [x, y]`**(도트 그림 픽셀)를 그림마다 잰다. 규칙:
   - HELD VIEW 무기(1·2번 장): 손잡이(권총·총은 손잡이 가운데, 칼·파이프·의자 다리는 왼쪽 손잡이 부분 가운데).
   - 소모품·줍는 것·회수물(3~6번 장): 그림 가운데 아래 1/3 지점(손에 쥐는 곳).
   - 들어 던지는 물건(7번 장 1~6): 머리 위로 드는 기준이라 **위쪽 가운데**(물건 윗면 가운데).
   - 부수는 물건·조각(7번 장 7~9, 8번 장): grip 없음, 바닥 접점(아래 가운데)만.
3. 결과를 `game-src/art/items/items.json`에 `{ "<아이템 id>": { "file": "...", "w", "h", "grip": [x, y], "foot": [x, y] } }`로 적고, 아이템 id는 `src/game/action/items/data.ts`의 id(pipe, chairleg, kitchenknife, katana, smg, servicepistol, shotgun, medkit, bandage, antidote, salt, flash, smoke, charm, energy, adrenaline, scrap, oddcoin, rustkey, photo, tooth, dreamcatcher, blackbox, chair, pot, extinguisher, tv, table, bin, crate, drawer, mailbox, barrel, locker, crackedwall …)를 쓴다. 고유 무기는 `sig_jyaldi_pistol`, `sig_aileen_carbine`, `sig_aileen_pistol`, `sig_deadpole_pistol`, `sig_gorgodio_knife`, `sig_gorgodio_knife_stuck`, `sig_geshugan_cube`, `sig_rojemon_doll`.
4. 「아이템과 무기」가 `drawItemIcon`을 이 그림으로 바꾸고, 엔진의 `drawHeld`가 grip을 손 앵커에 맞춘다(`docs/게임_모듈_연결.md` 2-1).
