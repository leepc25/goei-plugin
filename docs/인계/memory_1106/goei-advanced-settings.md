---
name: goei-advanced-settings
description: 괴이 플러그인 「고급 설정」 구조(원본 세부 설정 복원) — read before adding or changing per-feature settings
metadata:
  type: project
---
- 사용자 결정(2026-10-18, 스레드 「원본 대비 설정 비교」): 원본의 세부 설정은 되살리되 설정창이 복잡해지지 않게, 기능 설정 맨 아래 기본 닫힌 「고급 설정」에 원본 기본값으로. 손대지 않아도 돌아가야 함.
- 코드: src/core/advanced.ts(ADV 표 하나에 항목·기본값·범위, applyAdvanced가 gnet/phone LIMITS·HISTORY·CONTEXT·COOLDOWN을 채팅 값으로 맞춤), src/core/budget.ts(요청 토큰 상한, 넘치면 이전 위키→2차→관련→본편 턴 절반), src/ui/advanced.ts(칩·숫자 직접 입력·바꾼 줄 점+되돌리기·모두 기본값으로 확인). 변수: $lb_cfg_lb-gn.adv_*, $ph_adv_*, $nw_adv_*, $gen_*(메인 설정 「생성 공통」).
- 새 세부 항목은 ADV 표에 넣으면 화면·저장·기본값 덮어쓰기가 따라온다. 위쪽(펼친) 설정에는 자주 바꾸는 것만.
- 원본 비교 문서: /mnt/project-files/goei-plugin/docs/원본대비_설정비교.md. 재시도는 형식 오류에만. 페르소나는 parseRisuChat('{{persona}}').
- 원본 로직 개선(v0.16.27 릴리스 2026-10-18): 본편 반영은 src/core/focus.ts가 최근 본편 3턴 이름(termPresent, 조사 허용)으로 관련 기록 먼저 + 최근 몇 개, 위키는 본편에 나온 문서를 전문으로, 칩 「로어북 있는 문서」(기본 끔)·「창작 문서」(기본 켬)로 따로 고름(사용자: 로어북 주제도 창작으로 바뀔 수 있음), 기록은 마지막 user 메시지 앞에 붙임. 괴담톡 응답은 틀린 항목만 뺌(keepValid). 자동 확인은 수동/창을 열 때(open)/매 턴, 괴담톡 기본 수동, 사용자가 N턴마다는 뺌. Roster 줄이기(5번)는 실제 2,838토큰이라 보류. 검토 문서: docs/원본로직_검토.md. 토큰 어림셈(tokens(), 한글 1자=1)은 실제보다 약 1.2배 큼.
