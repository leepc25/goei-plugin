---
name: daydream-sprites
description: 백일몽 게임 도트 — 확정 5명, 공용 탐사원 방식, 설계서 위치, PixelLab 상한·승인 상태 (2026-10-22)
metadata:
  type: project
  modified: 2026-10-22T02:01:36.759Z
---
- 2026-10-22 스레드 「백일몽 등장인물 추리기」. 사용자: 백일몽은 적일 수도 중립 NPC일 수도. 인물표 /mnt/project-files/game/daydream/백일몽_인물표.md (16명, 기본 이미지 전부 있음).
- 사용자 확정(01:50): 이자헌·은하제·박민성·진나솔·이성해 5명. 나머지 현장 인원은 공용 정장 몸 + 머리·가면만 교체. **5명은 플레이어블 요원급**(전투 + 쟈알디 136장면 생활·상호작용 전부) — 나중에 「백일몽 플레이 버전」 예정.
- 설계서 docs/캐릭터제작서/동작설계_백일몽.md (브랜치 claude/project-thread-74u2c4, 048b31b; 사본 /mnt/project-files/game/daydream/). 인물별 다른 규칙: 이자헌 부위 해체·고정물 뜯기, 은하제 수갑 사슬·수첩 해독, 박민성 가방·업기·머플러 위장, 진나솔 손톱 실 덫선·당기기·그네, 이성해 인사 회피·「죄」 판결·격리.
- 가면은 그림에 안 넣고 코드로 머리 점에 얹음(본부 맨얼굴, 현장 가면). 공용 탐사원도 같은 장치, 몸 2종 × 26클립.
- 비용: 상한 2,850 (5명 666클립 + 공용). 잔액 8,369 실측(02:00). 다른 승인 대기 합치면 약 8,490 → 1차(적·중립용 약 2,150) / 2차(생활 약 700, 11-20 리셋 뒤) 분할안 추천. 결정 카드 올림, 승인 전 생성 0회.
See [[goei-npc-sprites]], [[goei-game-enemies]], [[pixellab-usage-tips]], [[pixellab-one-shot-delivery]].
- 02:20 사용자 「그래 전부 진행시켜」 → 전부 생성 승인(상한 2,850). 스크립트 game-src/action/daydream/scripts (gen.py <id> --resume, 로그 ../spend.log). 기준 그림 확정: jaheon=jaheon2 seed914(젊은 얼굴), haje 911, minseong 911, nasol 911(sf0.5), seonghae 914, grunt_m/f 912. 톤 비교 /mnt/project-files/game/daydream/톤비교_A2.png. 가면 masks.py 11종 + anchors.py(뼈대 눈+인물 보정+얼굴 찾기). GPT 씻기 의뢰서 초안 docs/캐릭터제작서/의뢰서_백일몽5인_탈의·샤워·목욕_GPT.md(대기 장 생긴 뒤 목록 등록). 접수 느림: 7몸 동시에 약 1클립/분.
- 03:13 사용자 확정(코디 전달): PixelLab은 요원 7명 최우선, 백일몽은 동시 작업 1개만(scripts/runall.sh, MAXP=1, 몸 순서대로). 요원들 끝나면 MAXP 늘려도 됨. 나솔 구 기준그림 작업 3개는 spend.log에 old-ref로 표시해 버림.
- 03:17 사용자 확정: 1차 = 전투·이동·적/중립 조우(516클립), 2차 = 생활·사교·감정 200클립은 나중(scripts/life.py LATER, `PHASE=2 ./runall.sh`로 이어 받기). 설계서 6.2절.
- 컨테이너가 재시작되면 실행기가 죽음: scripts에서 `nohup ./runall.sh > ../runall.out &`로 다시 켜기(--resume라 이어짐). 몸 하나 끝날 때마다 자동 커밋·푸시. 검수 기록 game-src/action/daydream/검수.md, 접촉 시트 scripts/contact.py.
- 2026-10-22 04:57 사용자: 사용량 초과로 전부 중단, GPT로 이관. 생성 멈춤(1차 71/516 완료, 약 321회). 인수인계 /mnt/project-files/game/인수인계/백일몽 도트 제작.md, 커밋 2871663.
