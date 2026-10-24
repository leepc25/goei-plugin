---
name: geshugan-sprite-build
description: 게슈간 도트 제작(2026-10-22) 설계서 위치·게임 규칙 요점·비용 상한·승인 상태 — 게슈간 또는 다른 요원 도트 작업 전에 읽기
metadata:
  type: project
  modified: 2026-10-22T01:33:31.337Z
---
스레드 「게슈간 도트 제작」(2026-10-22 01:22 시작). 사용자 지시: 7명 각자 스레드, 쟈알디와 같은 씬 전부, 동작은 캐릭터마다 전부 달라야 함("모양만 다른 주먹질 금지", 기본 공격·스킬·필살기 규칙부터), 기획 먼저, 카드 캐릭터 시트와 assets/agents/<이름>_default.avif 기본 이미지를 근거로.
- 설계서 docs/캐릭터제작서/동작설계_geshugan.md (맨 앞 「쟈알디·다른 요원과 다른 점」 표, 엔진 새 기능 14개 목록), 데이터 game-src/action/geshugan/plan.py (123클립, 122 생성, 686장, 367회). 브랜치 claude/project-thread-ozjnfr commit 1bd9705.
- 원작 시트 위치: 위키 card/wiki-base.json 키 「게슈간」, 로어북 analysis/extracted/module.json lorebook[42].
- 요점: 주먹질 없음(스냅다운 → 지정 → 내려찍기), 집중 3칸(탄약 없음), 고정→던지기, 쳐내기 가드(유지 없음), 염동 도약 회피(데드폴 앞구르기와 구분), 무기·큰 물건 공중에 띄움.
- 비용 상한 500회. 01:40 사용자 승인 요청, 답 대기. 넥타이: 기본 이미지엔 없음, 공통 규칙대로 매기로 하고 사용자에게 물음.
- 다른 요원 스레드도 같은 형식(설계서 + plan.py + 다른 점 표)을 쓰면 겹침 확인이 쉬움. See [[jyaldi-full-build]], [[character-art-rules]].
- 2026-10-22 02:10: GPT 샤워·목욕 의뢰(첫 붙여넣기 줄)는 사용자가 이미 GPT에 넣음. 의뢰서는 장별 손동작·외곽선 #000000·G0 팔레트로 보강했지만 새 붙여넣기 줄은 보내지 않음(사용자 격노). 납품 오면 보강한 규격대로 Claude가 코드로 고침, 재의뢰 금지.
- 생성 진행: PixelLab 동시 작업 20개 한도를 다른 요원 스레드와 공유 → gen.py가 자리 날 때까지 대기. 잔액 수치는 다른 스레드 사용분이 섞이므로 내 사용량은 spend.log 클립 장 수로 계산.
- 2026-10-22 03:40 1차 납품(main f622d66): 전투 43 + 이동(turn·fall·land) + 미리 나온 stepup·stepover·liesit, 시연판 release/demo/geshugan-full.html(빌더 tools/build_geshugan_demo.py, 보정 game-src/action/geshugan/fixes.json), 결함 목록 docs/캐릭터제작서/게슈간_결함목록_2026-10-22.md. 약 169회 사용. 생활·사교·감정·지형 73클립은 사용자 지시(03:17 "전투·이동 먼저")로 미룸 → gen.py <이름…> --par=2로 이어서. PixelLab 동시 작업은 요원 스레드당 2개(사용자 03:13).
- 교훈: 동작 글(action 100자)에 적·사람·물건 이름을 쓰면 생성기가 상대를 그려 넣음 → 몸 자세만. 기준 그림은 쟈알디 장을 머리→옷 두 단계 pixen 편집하면 톤이 그대로 맞음.
- 2026-10-22 03:55 2판(main 3ec2d19): 독립 검수(f622d66, /mnt/project-files/game/agents/게슈간_독립검수_f622d66.md) 망가짐 12 반영. 다시 그림 lowmark·parry·pickup·drink·eat·bandage(grig.py 끝 「2차 수정」), 코드 보정은 game-src/action/geshugan/fixes.json(align·compose·drop·outline). GPT 20장 받음, 외곽선만 코드로. 약 190회. 남은 판단: 넥타이(사용자 03:57 "있으면 그냥 둬", 다시 그리지 않음), 숙인 장 턱 회색(앞머리), 작은 동작(설계).
- 2026-10-22 05:25 사용자 지시로 전 작업 중단·GPT 이관. 인수인계 조각 /mnt/project-files/game/인수인계/게슈간 도트 제작.md (남은 73클립 목록, 결함, 시연판 3ec2d19). 생성 멈춤, 자료 main에 다 있음.
