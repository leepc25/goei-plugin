---
name: goei-fake-bureau-hq-1102
description: 가짜관리국 본부 = 관리국 본부 장면을 fb_ 접두어로 그대로 복사(이름만 검사부대·진압부대) — 가짜관리국 거점 작업 전에 읽기
metadata:
  type: project
  modified: 2026-11-02T15:57:19.127Z
---
사용자 11-02 15:50 「가짜관리국은 관리국걸 그대로 가져다 쓸 것」, 15:51 「종합대응팀→검사부대, 진압팀→진압부대 이렇게만 바꾸면 고대로」.
- 구현: src/game/action/hq/map.ts FB_IDS 20장면을 `fb_` + 관리국 id로 복사(그림 painted 같음), 엘리베이터 bldg 'fb', 거리 버스 정류장 이름 '종로2가'(추천안, 사용자 답 대기), 책상 주인 = 16:00 사용자 「진압부대·검사부대만 연결, 나머지 책상 배정 말고」: fb_office desk1~4 이도형·고영훈·노기균·송주익, fb_swat desk1~5 곽성주·조성춘·윤병수·김성진·송진섭 (068b7916c). 실제 생성·착석은 필드 스레드(actors.ts)에 넘김. 브랜치 claude/project-thread-xocyxl (5bd3efe4e), merge-1101 미병합.
- 건물 소속 판정은 「필드 기능 이어서」 스레드가 world/hq.ts에서 장면 접두어로 함('fb_' = B00). map.ts는 이쪽, hq.ts·actors.ts·modules.ts는 그쪽.
- 미정(사용자에게 물음): 거리 그림 그대로·정류장 이름, (사무실 자리는 해결됨.)
Thread: 가짜관리국 구현 cmsg_01SMy6spzkHA3Ttz9fg54ZY8SRafyctMHHG4WTSZ3CGzWf. See [[goei-merge-1101]], [[fake-bureau-sprite-build]].
- **16:42 사용자 「이후 작업은 필드에 넘겨」 → 가짜관리국 남은 일(합치기·인물 생성·소속·정류장 이름) 전부 「필드 기능 이어서」 스레드 몫.**
