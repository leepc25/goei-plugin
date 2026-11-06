---
name: goei-npc-placement-audit-1102
description: 2026-11-02 필드 인물 배치·경보·화장실·건물별 소속 고치기 진행 기록(①~⑦ 완료, merge-1101) + 「관리국은 하나의 건물」 설정·정류장 결정
metadata:
  type: project
---
사용자 15:42~15:45 (필드 기능 이어서 스레드): 릴리스판 입장하면 「온갖 사람들이 우르르」; 입장 순간 제자리; 관리국·협회·백일몽·중림 옳은 사람; 중림 행인 프리랜서 위주; 가게 4곳·협회 창구 NPC 실제 이용; 경보가 층 넘어 안 옴; 화장실 문 뚫림. 점검 문서 /mnt/project-files/field/인물배치_점검_1102.md.
**사용자 결정:** 경고는 모든 세력 거점에서 그 세력 소속 아닌 주인공에게 평판 무관(15:49) → 무시하면 층 넘어 추적+경보. 출입증·동행 통과 유지. **16:46: 정류장은 종로 하나**, 가짜관리국(B00) 소속만 뒷면(fb_street)으로, 관리국·제3세력은 쟈알디 쪽 관리국. **16:37: 관리국·가짜관리국은 원래 하나, 건물도 하나가 평행 차원에 겹침, 사장 동일인물, 구성원 기억 삭제** → 로어북 영어 비밀 문단 `card/extra-lore/비밀_관리국_하나의_건물.txt`(사용자 「이대로 써」, 다음 릴리스에 카드 반영). 넘어가기는 계획만 `docs/필드_하나의_건물_계획.md`(16:41 「계획에만」). 지도 핀은 「관리국」 하나.
**완료 (merge-1101):** ① 화장실 문 526dec7 ② 입장 예열 WorldSim.warmup(180초) 3f01962 ③ 건물 표 BUILDINGS(world/hq.ts; fb_=B00, by_=C00, sdra_·jr_=중립) 1d0b765 ④ 경고 소속 기준 playerFaction + guardAttack→raiseAlarm 07ece4d/8946f67 ⑤ 원형(프리랜서·협회 직원/경비·백일몽 직원/경비·가짜 관리국 검사/진압) + ROLES(건물별) + STREET_SWAP(중림 프리랜서 6:시민 3:세력 1 = Claude 제안, 사용자 확정 아님) 38ea3cb ⑥⑦ RESIDENTS(가게 주인 문혜란·마덕희·신유리·고연지·윤지아, 창구 서윤지·차여진, fb 9, by 10) + SpawnRule.visit 손님 + 좌석 통합(map.ts floorHall) + HQ_KINDS d1eb165. 합침: xocyxl(fb_ 20장면), wv3dal(백일몽 17층), vtzx6i(강남 거리·버스 d.bus 복구).
**v0.20.1:** 상주 인물 29명 팩 입장 때 미리 받기 → 되돌림(인물 팩은 절대 한꺼번에 미리 받지 않는다). **진짜 멈춤 원인 → v0.20.2 (18:00):** 손으로 픽셀 단위로 딴 걷기 다각형(장면당 점 최대 1,850, 전체 23,715)을 308명이 매 틱 inPolygon 검사 → 한 틱 100ms, 입장 46초, 1fps. painted.ts walkablePainted 를 장면별 1px 비트맵(주사선 채움, 처음 물을 때 1회)으로 → 입장 7초, 60fps. 교훈: 세밀한 다각형 마스크를 추가할 때 핫패스(NPC nav)는 반드시 브라우저에서 프로파일(tests/_prof2_tmp.mjs 식 CDP Profiler). node 벤치는 nav 훅이 빠져 있어 1.4ms/step 으로 속였다. 중림 dens 0.35는 Claude 추정. 캡처 /mnt/project-files/field/{entry_warmup,building_split,archetypes,residents}_1102.png.
See [[goei-scene-zoom-unify-1102]], [[goei-field-no-model]].

**11-02 18:21 사용자 「요원이 하나도 안 나와(청소부·경비뿐)」「격리팀 사무실 회색박스」:** 원인 1 = 10-31 퇴근 규칙(stepCommute) + 입장 예열 → 밤엔 이름 인물 전부 퇴근함. 565f98167: 카드가 그 방에 있다고 한 요원(present)은 ActorDef.card=true로 퇴근 제외(1번 안, 결정 카드 답 대기), 상주 인물만 퇴근. 원인 2 = 관리국 B2 격리팀 사무실(장면 id clinic)이 옛 room() 회색 방이었음 → hq_b2_lab_p20(1703px) 장면 연결(tools/mapedit/author_hq_lab.py, 왼쪽 옆벽 문=b2 복도, 오른쪽 끝 옆벽 문=의무실, 작업대·카트·콘솔 막힘, 가림 없음). 격리시설(tooth)은 배경 없음 그대로. v0.20.3로 릴리스(11-03 04:27, PR #33).
