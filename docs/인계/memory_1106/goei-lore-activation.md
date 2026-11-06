---
name: goei-lore-activation
description: 본편 로어북을 플러그인이 고르는 구조(src/core/lore.ts)와 Risu 키 매칭 사실 — read before touching lorebook keys, lore injection, slot entries or request token budgets
metadata:
  type: project
---
- 구현됨(2026-10-19, 브랜치 claude/project-thread-swd4qg, 미출시): 🌆세력·🎁파밍·🚧괴이·🙂요원 폴더 항목 본문 첫 줄 @@dont_activate. 늘 켜진 자리 항목 4개 「📚Lore slot · Faction/Mystic/Anomaly/Agent」(순서 200/400/500/600, ⚙️설정 폴더) 본문 {{getvar::goei_lore_org|site|anomaly|agent}}. 플러그인이 input 처리기(보낼 때)·응답 뒤에 골라 채팅 변수에 쓰고, beforeRequest에서 다시 골라 다르면 요청 속 글을 바꿈(다시 굴리기). Risu가 변수 글을 세므로 넘치면 오래된 채팅을 지움. @@dont_activate 없는 항목은 Risu가 켬.
- 사용자: 로어북 예산(카드 90,000) 건드리지 말 것. 플러그인은 그 예산에서 늘 켜진 항목 몫을 뺀 90% 안에서만(넘치면 점수 낮은 것부터 뺌).
- 고급 설정(생성 공통) 「로어북 보내기」: 플러그인이 고름 / Risu가 직접 (사용자 요청). 플러그인이 방식에 맞게 네 폴더 키 있는 항목의 @@dont_activate 줄을 붙이고 뗌(syncDecorators, 보낼 때·옵션 바꿀 때). 사용자가 새로 넣은 항목도 자동으로 붙임(사용자가 직접 넣게 하지 말 것). Risu가 직접이면 자리 변수는 비움. 설정 맨 아래 「본편 로어북 확인」에 켤 항목·까닭·반대 방식과 차이.
- 카드 빌드 tools/build_lite_card.py lore_activation: KEY_EDITS(흔한 낱말 키 삭제·추가), 요원 넷 순서 600, 매니페스트 keys = {로어북: [원래 키 지문, 정리 키 지문]}; 카드 업데이트(core/update.ts keepUserKeys)는 지금 키가 그 지문과 다르면 사용자 키를 남김. 출시 때 package.json goei.minPlugin을 그 판으로 올려야 함(옛 플러그인 + 새 카드면 로어북이 안 켜짐).
- Risu 사실(v2026.8.250): 보통 키 = 소문자+띄어쓰기 제거 후 포함, 메시지별. 정규식 키는 릴리스에서 고장 → 쓰지 말 것. editinput 처리기는 사용자 메시지를 넣기 전에 돌고, 채팅 저장해도 Risu가 message 배열을 다시 덮어 안전.
- 규칙 표·바꾼 점: /mnt/project-files/goei-plugin/docs/호출키_검토_1019.md (6절). 백일몽·붙여 쓴 헐값매입/대박알선은 확증 없이 켬.

- v0.16.32 출시됨(2026-10-19, main dd20e05): 로어북 고르기 포함, minPlugin 0.16.32. main의 액션 게임 검증판(Donghun Lee)도 합쳐져 같이 나감(게임 창 기본이 1인 전투 검증판; 사용자: 게임은 한참 멀었음).
