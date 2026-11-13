---
name: goei-hq-outline-nav-1101
description: 본부 1F·B1·B2 가림·막힘·바닥선을 픽셀 단위로 다시 딴 방법(outline_trace.py)과 NPC 길찾기(nav) — 2026-11-01, 다음은 지하 내부 5곳 요청문 대기
metadata:
  type: project
  modified: 2026-11-01T09:32:59.561Z
---
2026-11-01 09:07~09:30 사용자 격노: 「네모로 대충 딴 가림 → 다리 밑 투명」, 「못 가는 곳·벽과 바닥 연결선·출입구·앞에 보일 사물을 픽셀 단위로」, 「직원이 게이트 위로 지나다님」.
- 고친 것(브랜치 claude/project-thread-hjsvsg, f59188618): `tools/mapedit/outline_trace.py`(기둥마다 검은 윤곽선을 찾아 바닥 윗선·앞 무더기 윗선 자동 읽기), 1층은 8배 격자로 손으로 읽은 다각형+유리는 반투명 세로 띠. 붙어 있는 막힘 다각형은 밀어낼 때 옆 막힘으로 새므로 한 덩어리로 합칠 것.
- NPC: `WorldSim` 옵션 `nav`(painted.ts `walkablePainted`·`clampPainted`) → 막힌 곳이면 격자 BFS 경유점, 막힘에 한 발도 안 들어감. 게이트 유리는 직원이 와도 열림. 로비 안내 직원 자리는 map.json `posts.desk`(새 그림은 데스크가 벽에 붙어 데스크 앞).
- 확인 도구는 scratchpad(mapview·npccheck)라 사라짐 — 다시 만들 땐 map.json 덮어보기 + 300초 step 기록으로 막힘 안 발자국 세기.
- 다음: 지하 내부 5곳(훈련장·샤워실 남/여·격리팀 사무실·격리시설) 요청문 /mnt/project-files/hq-f3/now/내부공간_요청문.md 전달, 「뽑아」 대기(.pixellab_ok 0). See [[goei-pixellab-extend-overlap]].
