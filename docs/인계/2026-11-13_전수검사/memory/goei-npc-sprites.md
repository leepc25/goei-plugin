---
name: goei-npc-sprites
description: 게임 NPC 도트(본부 4명·상인·민간인·직원·승객) — 2026-10-22 GPT로 이관됨, 인수인계서 위치·남은 양·확정 범위
metadata:
  type: project
  modified: 2026-10-22T05:27:04.894Z
---
- **현재 상태 (2026-10-22 05:24):** 사용자 지시로 PixelLab 사용을 멈추고 NPC 작업 전부를 GPT로 넘김. 인수인계서는 /mnt/project-files/game/인수인계/본부 NPC 도트 제작.md, 사본 game-src/action/npc/인수인계.md (브랜치 claude/project-thread-3svcza, df0c9d6).
- 받은 클립은 72개(game-src/action/npc/clips/<id>/<클립>/NN.png). 잼트리 35개 중 12개는 던전 이동 동작이라 안 씀.
- 남은 일:
  - 1단계 321클립 (PixelLab으로 치면 약 960회)
  - 직원 기준 그림 4장
  - GPT 씻기 의뢰 60장 (docs/GPT요청_본부NPC_씻기.md)
  - 민간인·직원에 덧씌울 부품
- 이 스레드에서 쓴 PixelLab은 약 505회. 시연판은 만든 적 없음. 결함은 game-src/action/npc/결함목록.md.
- 설계서는 docs/캐릭터제작서/NPC_목록과_동작.md. 클립 이름과 장마다 관절은 game-src/action/npc/scripts/npc_set.py에 있음: phase1(id)는 남은 1단계 목록, clips(id)는 관절.
- 사용자가 확정한 범위:
  - 본부 넷(잼트리·고그니쟈·데쥬레·콘쥬스): 전투 없음, 던전 이동 동작 없음. 1단계 목록은 npc_set.HQ1이고, 2단계에서 생활 동작 전체(사람마다 100개 이상)를 각자 다르게.
  - 상인 다섯(마덕희·문혜란·고연지·윤지아·신유리): 상호작용 28클립씩.
  - 민간인: 공용 몸 6종 × 겁먹은 동작 17. 사용자가 "간소화하고 나중에 추가"라고 함. 옷·머리·소품은 코드로 얹음.
  - 관리국 일반 직원: 공용 몸 4종 × 생활 13, 전투는 하나도 없음.
  - 승객: 2종 × 5.
- 톤은 쟈알디에 맞춤(192×144, 발 y≈136, 키 93, 외곽선 1px 검정). 색만 바꾼 복제는 금지.
- **콘쥬스(17세)는 탈의·샤워·목욕을 수건 차림 포함 어떤 형태로도 만들지 않음.** 대신 옷 입은 3클립(bathin_k, bathout_k, handwash)으로 바꿈.
- 윤지아 설명에 'nurse'를 넣으면 간호사 모자가 생김 → 'clinic assistant'로 씀.
See [[character-art-rules]], [[pixellab-usage-tips]].
