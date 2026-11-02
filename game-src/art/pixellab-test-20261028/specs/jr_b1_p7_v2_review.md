# 검토서 jr_b1_p7_v2

방 corridor · 분위기 worn · 문 1 · 원근 corridor · 바닥 the lower 30 percent · 양옆 none · 채우기 packed+

## 점검 결과

- WARN 설명이 김(39낱말): back wall, centered: an unlicensed clinic front, a cloudy frosted glass door in the middle, frosted windows, a faded old hospital sign, a green cross light box sticking out, a white lit sign board with green letters reading "손길의원"
- WARN 설명이 김(33낱말): far right 20 percent of the image: a rectangular stairwell cut into the floor at the right edge, steps going down to the back into darkness, a waist-high railing on its walkway edge
- WARN 같은 낱말 4번: floor

## 근거

- 위키: 손길 의원: 바랜 옛 병원 간판이 붙은 무면허 의원
- 설계안: GPT 의뢰문 ⑦ 손길의원·B2 계단
- 사용자: 사용자 10-31 「다시 뽑아」: ②③④와 같은 가이드 v6·같은 고정 문장(place·floor·walls·palette 등), 가게 내용·간판 낱말만 다르게
- 사용자: 계단은 옆벽 문장 없이 물건 줄로

## 설계안·위키 항목 대조

- 손길의원 → 1번
- 문 앞 비움 → 2번
- B2 계단·판 → 3번, 4번
- 쓰레기 → 6번
- 쓰레기통·포스터·공조·우산통 → 7번, 8번, 9번, 10번
- 왼쪽 이음 비움 → 0번
- 위키: 반쯤 꺼진 형광등 → 칸:walls dead
- 계단 첫 단 앞 비움 → 5번

## 1차 상세안 → 2차 정제

| # | 1차 (상세) | 근거 | 남길 낱말 | 2차 (실제) | 뺀 낱말(이유) |
|---|---|---|---|---|---|
| 0 | left 10 percent of the image: only bare back wall and floor, no side wall | 사용자 이음매: 앞 기둥 자리 | left 10 percent | left 10 percent of the image: only bare back wall and floor, no side wall |  |
| 1 | back wall, centered: an unlicensed clinic front, a cloudy frosted glass door in the middle, frosted windows, a faded old hospital sign, a green cross light box sticking out, a white lit sign board with green letters reading "손길의원" | 위키 손길 의원, GPT 의뢰문 ⑦, 사용자 간판 다르게 | clinic, frosted glass door, green cross light box, reading "손길의원" | back wall, centered: an unlicensed clinic front, a cloudy frosted glass door in the middle, frosted windows, a faded old hospital sign, a green cross light box sticking out, a white lit sign board with green letters reading "손길의원" |  |
| 2 | clear empty floor in front of the glass door | 게임 출입구 앞 비움 | clear empty floor | clear empty floor in front of the glass door |  |
| 3 | far right 20 percent of the image: a rectangular stairwell cut into the floor at the right edge, steps going down to the back into darkness, a waist-high railing on its walkway edge | GPT 의뢰문 B2 계단 구멍·난간, 게임 출입구 down | rectangular stairwell, going down, railing, clear floor | far right 20 percent of the image: a rectangular stairwell cut into the floor at the right edge, steps going down to the back into darkness, a waist-high railing on its walkway edge |  |
| 4 | a "B2" plate with a down arrow and a flickering lamp above the stairwell | GPT 의뢰문 B2 판·등 | "B2", flickering lamp | a "B2" plate with a down arrow and a flickering lamp above the stairwell |  |
| 5 | clear floor before the first step | GPT 의뢰문 계단 첫 단 앞 비움 | clear floor | clear floor before the first step |  |
| 6 | wall base: collapsed cardboard, burst trash bag, bottles, each a different shape | 사용자 쓰레기 제각각 | burst trash bag, each a different shape | wall base: collapsed cardboard, burst trash bag, bottles, each a different shape |  |
| 7 | a dented metal trash can | 설계안 쓰레기통 | trash can | a dented metal trash can |  |
| 8 | a torn blank poster | 사용자 벽 종이 몇 군데만 | blank poster | a torn blank poster |  |
| 9 | a rusty air conditioner unit | 설계안 공조 | air conditioner | a rusty air conditioner unit |  |
| 10 | an umbrella stand | 설계안 우산통 | umbrella stand | an umbrella stand |  |

## 3차 자가 검토

- 이 방에 안 맞는 물건이 2차 문장에 있나? 줄마다 확인한 결과
  - 10줄: 의원·유리문·B2 계단·소품
- 손님 물건이 직원 쪽에 있거나, 캐릭터가 못 다가가는 자리에 꼭 필요한 것이 있나?
  - 왼쪽 10% 비움, 의원 가운데, 계단 오른쪽 20%, 문 앞 비움
- 큰 가구·문 크기가 서 있는 사람 150px(에일린) 기준으로 맞나? 숫자로
  - 크기 숫자 없음(느슨한 틀)
- 위키·설계안·사용자 결정 중 빠진 것이 있나? 있으면 왜 뺐나
  - 위키·설계안·의뢰문 항목 대응, 빠진 것 없음
- 2차로 줄이며 1차 뜻이 바뀌거나 중요한 세부(기구·재질·잠금 등)가 빠졌나?
  - 1차=2차(느슨한 틀)
- 이유 없는 채움 물건·같은 물건 두 번·쓸데없이 긴 설명이 있나?
  - 같은 물건 두 번 없음, packed+
- 원근·바닥 몫·양옆 벽·문·채우기가 이 장면에 정한 대로인가?
  - ②③④와 같은 가이드 v6·고정 문장, 가게 내용·간판만 다름

## 2차 요청문 (1918자)

```
Pixel art game background of a run-down 1990s Seoul underground arcade corridor, low ceiling right above the sign, night. Camera at standing eye height, about 20 degrees above the floor, looking slightly down. One-point depth, but the back wall runs straight and level across the full width. The floor fills the lower 30 percent of the image. No side walls: the room keeps going past both image edges.
FLOOR: smooth dark poured concrete like one wet sheet, mottled grime, oil stains, puddles, varied litter all over the walkway, light pool, shadows under objects.
VERY CLUTTERED: every wall, shelf and corner packed with small props: left 10 percent of the image: only bare back wall and floor, no side wall; back wall, centered: an unlicensed clinic front, a cloudy frosted glass door in the middle, frosted windows, a faded old hospital sign, a green cross light box sticking out, a white lit sign board with green letters reading "손길의원"; clear empty floor in front of the glass door; far right 20 percent of the image: a rectangular stairwell cut into the floor at the right edge, steps going down to the back into darkness, a waist-high railing on its walkway edge; a "B2" plate with a down arrow and a flickering lamp above the stairwell; clear floor before the first step; wall base: collapsed cardboard, burst trash bag, bottles, each a different shape; a dented metal trash can; a torn blank poster; a rusty air conditioner unit; an umbrella stand.
WALL: grimy concrete, rust, mold, cracks; ceiling strip, tangled cables, fluorescent tubes, one dead, one flickering.
LIGHT: strong contrast, bright shop, dark edges, black shadow under objects.
STYLE: dense, highly detailed pixel art, crisp pixel clusters, selective dark outline, rich medium-to-detailed shading, dark grey, beige, warm orange and red, no dithering, no blur. No people, chairs, sofas, benches, coffee tables, clocks, other doors or side walls.
```
