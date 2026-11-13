---
name: goei-bg-prompt-banned-words
description: PixelLab 배경 요청문 금지 낱말 — government/agency(태극기 나옴), 사람 말(agents in black suits, staff 등), 원하지 않는 물건 이름; 요청문마다 room_items.json으로 검사 (사용자 2026-11-01 09:40 격노)
metadata:
  type: feedback
  modified: 2026-11-01T09:41:23.724Z
---
2026-11-01 09:40 사용자: 「정부기관 하면 태극기 나와서 폐기한 지가 언젠데」, 「검은 정장 요원들이 왜 들어가, 요원 그리면 책임질 거야?」, 「뭐 하나만 점검 안 하면 쓰레기를 만들어 놓네」.
- 금지: government, agency(→ 「modern office in Seoul」), 사람을 부르는 말 전부(agents, black suits, staff, worker, person…; `tools/pixellab/room_items.json` people_words), lobby, 원하지 않는 물건 이름(부정문 포함).
**Why:** 「No people」이 있어도 사람 말이 있으면 사람이 그려지고, 정부기관은 국기를 부른다. 위키 문장을 그대로 옮기면 사람 말이 섞인다.
**How to apply:** 요청문을 보여 주기 전에 매번 room_items.json people_words + 위 목록으로 정규식 검사하고 결과를 같이 보고. 장소 줄은 공간만(「a large indoor training room in the basement of a modern office in Seoul」). See [[goei-pixellab-bg-prompt-rule]], [[goei-hq-f1-bg-lessons]].
