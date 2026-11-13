---
name: rojemon-build
description: 로제몬 도트 제작 상태 — 설계서, 규칙, 외형, 비용, 생성·GPT·시연판 진행 (스레드 「로제몬 도트 제작」)
metadata:
  type: project
---
2026-10-22 스레드 「로제몬 도트 제작」(cmsg_01SMy6spzkHA3Ttz9fg54ZY8ACjQ6M5zSMTjTbQ3THbqPR), 브랜치 claude/project-thread-z50bom.
- 설계서 docs/캐릭터제작서/동작설계_rojemon.md (08_로제몬.md 대체), 목록 원본 tools/rojemon_defs.py (234행, PixelLab 171클립: 본체 147·꼬마 인형 12·마네킹 12, 기본 클립 조합 58, GPT 4클립 20장).
- 외형은 assets/agents/Rojemon_default.avif: 라벤더 웨이브 긴 머리, 일자 앞머리, 검은 정장·흰 셔츠·검은 넥타이·검은 펜슬 스커트.
- 핵심 규칙: 본체 판정 0(인형·실만), A 3박 지휘(3박은 적을 끌어옴), S 최면 50%, D 실 걸기(그릇 → 아군 인형), 가드 = 웅크림 + 꼬마가 대신 맞음, 회피 = 실에 끌려감, 잡기 = 노려보기 → 확정 최면, 벽 기대기 수동 능력.
- 사용자 승인 2026-10-22 01:50 「일단 만들어봐」(상한 712회). 생성: game-src/action/rojemon/scripts/gen.py(spend.log에서 이어받음), 결과 clips/<클립>/NN.png, 검수 시트 scripts/qa_sheet.py.
- GPT 탈의·샤워·목욕 의뢰 main에 있음(사용자가 이미 붙여 넣음, 02:10). 받은 흠은 코드로 고침, 재의뢰 금지. 검사 tools/check_rojemon_gpt.py.
- 사용자 결정 03:17: 전투·이동 먼저(남은 생활 클립 목록 game-src/action/rojemon/life_todo.txt, 나중에 `python3 gen.py $(cat ../life_todo.txt)`). PixelLab 동시 작업 2칸까지.
- 2026-10-22 04:20 전투·이동 1차 완료(82클립, 약 330회), 시연판 main acebc005, 결함 목록 docs/캐릭터제작서/로제몬_시연판_결함목록.md.
- 2026-10-22 05:25 사용자: 사용량 초과로 모든 작업 중지, GPT로 이관. 인수인계 조각 /mnt/project-files/game/인수인계/로제몬 도트 제작.md. GPT 씻기 13/20장 받음(시연판 미반영).
- 시연판: tools/build_rojemon_full_demo.py + tools/rojemon_full_template.html + tools/rojemon_fixes.py → release/demo/rojemon-full.html.
See [[jyaldi-full-build]], [[character-art-rules]], [[game-design-feedback]].
