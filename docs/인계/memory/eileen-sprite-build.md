---
name: eileen-sprite-build
description: 에일린(eileen) 도트 제작 스레드 상태 — 설계서·기준 그림·생성 스크립트·빌더 위치, 전투 규칙 요지, 진행
metadata:
  type: project
  modified: 2026-10-22T02:04:46.632Z
---
2026-10-22 스레드 「에일린 도트 제작」(branch claude/project-thread-45iwer). 사용자 지시: 쟈알디와 같은 장면 전부, 동작·기본 공격·스킬·필살기 규칙까지 전부 달라야 함("모양만 다른 주먹질 금지"), 위키 시트 + 기본 이미지(assets/agents/Aileen_default.avif) 기준, 그림체(톤)는 쟈알디와 같게, 몸·키·옷은 에일린 자기 것.
- 설계서 docs/캐릭터제작서/동작설계_eileen.md: 4-4 엔진 신규 기능 12개는 「게임 마무리 한 곳에서」로 넘김. 138클립, 상한 약 510회.
- 사용자 승인 01:4x "일단 만들어봐"(7명 합계 약 3,800). 승인 전 시험 생성 4회는 보고 때 따로 밝힐 것.
- 기준 그림: game-src/action/eileen/base/H·F(A2를 pixen으로 바꿈) → 옆모습 H-side(idle/00)·F-side(fstand/00)·R-side(guard/00) + side.json(뼈대). 키 약 91px(쟈알디 98). 쟈알디 비교 /mnt/project-files/characters/에일린_기준그림_쟈알디비교.png.
- 스크립트 game-src/action/eileen/scripts: erig.py(뼈대, 0.92 축소, TAIL=버릴 끝 장), gen.py(생성, --resume), qa_sheet.py(검수 묶음). 빌더 tools/build_eileen_demo.py + tools/eileen_full_template.html → release/demo/eileen-full.html, final/manifest(muzzle 기준점 포함)·hands.json.
- 씻기 4클립(탈의·돌아서기·샤워·목욕 20장) GPT 의뢰 docs/캐릭터제작서/의뢰서_에일린_씻기_GPT.md (main d27ad36), 붙여 넣을 줄 코디네이터에 전달, 사용자가 이미 GPT에 붙여 넣음(02:10). 보강판(c76bf20)은 새 줄 안 보냄. 납품 오면 흠은 코드로 고침, 같은 장면 재의뢰는 사용자 승인 때만.
- PixelLab 동시 작업: 요원 스레드당 최대 2개(사용자 2026-10-22 03:12 확정, gen.py MAXP 기본 2). 요원 7명 최우선.
- 02:0x 전 클립 생성 중(백그라운드 gen-rf.out·gen-h.out). 다음: 장 단위 검수 → 고치기 → 결함 목록 → 휴대폰 링크 보고. See [[jyaldi-full-build]], [[character-art-rules]].
- 2026-10-22 05:2x 사용자 지시로 중단·GPT 이관. 90/142클립(전투·이동 전부), PixelLab 332회. 인수인계 /mnt/project-files/game/인수인계/에일린 도트 제작.md + docs/캐릭터제작서/에일린_인수인계_2026-10-22.md. 시연판 87347a28c504b3490651df2cfb74d96fb820f806.
