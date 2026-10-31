# 검토서 jr_alley_p1_v4

방 corridor · 분위기 worn · 문 1 · 원근 corridor · 바닥 the lower 30 percent · 양옆 left · 채우기 packed+

## 점검 결과

- WARN 설명이 김(29낱말): far left 20 percent of the image: a solid end wall closes the walkway from floor to ceiling, a lowered rusty shutter in it, equipment cases piled against it
- WARN 설명이 김(45낱말): back wall, centered: a big pawn shop filling the middle 80 percent of the width, recessed like a deep lit room, a heavy wooden door, lit display windows crammed with jewelry, watches, porcelain and odd objects, a dark wooden board with gold letters reading "헐값매입"

## 근거

- 위키: 중림 뒷골목
- 설계안: GPT 의뢰문 뒷골목 칸 구성
- 사용자: 사용자 10-31: ②③④ 그대로, ⑥ 보류, ①⑤⑦ 다시. ①⑦은 왼쪽 벽·오른쪽 벽 처리 주의 → 끝 칸만 그쪽 옆벽 문장, 끝은 바닥부터 천장까지 막힘. 가게 줄은 앞골목 틀, 소품은 가게 왼쪽·오른쪽에 나눠
- 사용자: v3: 왼쪽 막이를 허락 없이 오브젝트로 빼서 뚫림(사용자) → 배경에 끝벽으로

## 설계안·위키 항목 대조

- 0번 줄 근거 → 0번
- 1번 줄 근거 → 1번
- 2번 줄 근거 → 2번
- 3번 줄 근거 → 3번
- 4번 줄 근거 → 4번
- 5번 줄 근거 → 5번
- 6번 줄 근거 → 6번
- 7번 줄 근거 → 7번
- 8번 줄 근거 → 8번
- 9번 줄 근거 → 9번

## 1차 상세안 → 2차 정제

| # | 1차 (상세) | 근거 | 남길 낱말 | 2차 (실제) | 뺀 낱말(이유) |
|---|---|---|---|---|---|
| 0 | far left 20 percent of the image: a dead-end wall with a lowered rusty shutter, military equipment cases and boxes piled in front of it | 의뢰문 ① 왼쪽 끝 셔터 막다른 벽·장비 케이스, 사용자 왼쪽 벽 처리 주의 | end wall, lowered rusty shutter, equipment cases | far left 20 percent of the image: a solid end wall closes the walkway from floor to ceiling, a lowered rusty shutter in it, equipment cases piled against it | dead-end(**이유 없음**); military(**이유 없음**); boxes(**이유 없음**) |
| 1 | back wall, centered: a big pawn shop filling the middle 80 percent of the width, recessed like a deep lit room, a heavy old wooden door in the middle and lit display windows crammed with small jewelry, watches, porcelain and nameless odd objects, an old dark wooden board with carved gold letters reading "헐값매입" | 위키 헐값 매입, 앞골목 가게 틀 | pawn shop, wooden door, display windows, reading "헐값매입" | back wall, centered: a big pawn shop filling the middle 80 percent of the width, recessed like a deep lit room, a heavy wooden door, lit display windows crammed with jewelry, watches, porcelain and odd objects, a dark wooden board with gold letters reading "헐값매입" | small(**이유 없음**); nameless(**이유 없음**); carved(**이유 없음**) |
| 2 | clear empty floor in front of the wooden door | 게임 출입구 앞 비움 | clear empty floor | clear empty floor in front of the wooden door |  |
| 3 | left of the shop: a caged wall lamp with a dim amber glow, a rusted trash can, a burst trash bag | 소품 왼쪽 | caged wall lamp, trash can | left of the shop: a rusted trash can, a burst trash bag | caged(**이유 없음**); wall(**이유 없음**); lamp(**이유 없음**); dim(**이유 없음**); amber(**이유 없음**); glow(**이유 없음**) |
| 4 | right of the shop: a caged wall lamp, tangled cables hanging down, stacked boxes, a torn blank poster | 소품 오른쪽 | tangled cables, stacked boxes, blank poster | right of the shop: stacked boxes, a torn blank poster | caged(**이유 없음**); wall(**이유 없음**); lamp(**이유 없음**); tangled(**이유 없음**); cables(**이유 없음**); down(**이유 없음**) |
| 5 | wall base: collapsed cardboard, broken bottles, each a different shape | 사용자 쓰레기 제각각 | broken bottles, each a different shape | wall base: collapsed cardboard, broken bottles, each a different shape |  |
| 6 | a small CCTV camera over the door | 암시장 경계 | CCTV camera | a CCTV camera over the door | small(**이유 없음**) |
| 7 | a caged wall lamp with a dim amber glow | 앞 판 물건 유지 | caged wall lamp | a caged wall lamp | dim(**이유 없음**); amber(**이유 없음**); glow(**이유 없음**) |
| 8 | tangled cables hanging down the wall | 앞 판 물건 유지 | tangled cables | tangled cables down the wall |  |
| 9 | right 10 percent of the image: only bare back wall and floor, no side wall | 사용자 이음매: 앞 기둥 자리 | right 10 percent | right 10 percent of the image: only bare back wall and floor, no side wall |  |

## 3차 자가 검토

- 이 방에 안 맞는 물건이 2차 문장에 있나? 줄마다 확인한 결과
  - 뒷골목 이 칸의 가게·소품, 의자·사람 없음
- 손님 물건이 직원 쪽에 있거나, 캐릭터가 못 다가가는 자리에 꼭 필요한 것이 있나?
  - 가게 가운데, 소품은 가게 왼쪽·오른쪽, 문 앞 비움
- 큰 가구·문 크기가 서 있는 사람 150px(에일린) 기준으로 맞나? 숫자로
  - 크기 숫자 없음(느슨한 틀)
- 위키·설계안·사용자 결정 중 빠진 것이 있나? 있으면 왜 뺐나
  - 칸 내용 대응, 빠진 것 없음
- 2차로 줄이며 1차 뜻이 바뀌거나 중요한 세부(기구·재질·잠금 등)가 빠졌나?
  - 1차=2차(느슨한 틀)
- 이유 없는 채움 물건·같은 물건 두 번·쓸데없이 긴 설명이 있나?
  - 같은 물건 두 번 없음, packed+
- 원근·바닥 몫·양옆 벽·문·채우기가 이 장면에 정한 대로인가?
  - 구조 문장은 앞골목과 같음(끝 칸만 그쪽 옆벽), 가이드 v6

## 2차 요청문 (1992자)

```
Pixel art game background of a run-down 1990s Seoul underground arcade corridor, low ceiling right above the sign, night. Camera at standing eye height, about 20 degrees above the floor, looking slightly down. One-point depth, but the back wall runs straight and level across the full width. The floor fills the lower 30 percent of the image. Only the left side wall is visible; on the right the room continues past the image edge.
FLOOR: smooth dark poured concrete like one wet sheet, mottled grime, oil stains, many puddles, wet stains, varied litter all over the walkway, light pool, shadows under objects.
VERY CLUTTERED: every wall, shelf and corner packed with small props: far left 20 percent of the image: a solid end wall closes the walkway from floor to ceiling, a lowered rusty shutter in it, equipment cases piled against it; back wall, centered: a big pawn shop filling the middle 80 percent of the width, recessed like a deep lit room, a heavy wooden door, lit display windows crammed with jewelry, watches, porcelain and odd objects, a dark wooden board with gold letters reading "헐값매입"; clear empty floor in front of the wooden door; left of the shop: a rusted trash can, a burst trash bag; right of the shop: stacked boxes, a torn blank poster; wall base: collapsed cardboard, broken bottles, each a different shape; a CCTV camera over the door; a caged wall lamp; tangled cables down the wall; right 10 percent of the image: only bare back wall and floor, no side wall.
WALL: grimy concrete, peeling paint, exposed brick, rust streaks, mold, cracks; ceiling strip, tangled cables, fluorescent tubes, most dead, one flickering.
LIGHT: strong contrast, amber lamp pools, dark patches, black shadow under objects.
STYLE: dense, highly detailed pixel art, crisp pixel clusters, selective dark outline, rich medium-to-detailed shading, dark cold blue-grey, amber lamp light accents, no dithering, no blur. No people, chairs, sofas, benches, coffee tables, clocks or other doors.
```
