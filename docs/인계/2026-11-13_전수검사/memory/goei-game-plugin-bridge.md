---
name: goei-game-plugin-bridge
description: 게임을 괴이 플러그인 창에 싣는 다리(시작 화면·코드 팩·자산 팩·저장 칸·본편 연동·돌려 보기) 구조와 남은 일
metadata:
  type: project
---
2026-10-21 스레드 「리스 플러그인 탑재」, 브랜치 claude/project-thread-6tyjal (커밋 cf80051, 미병합·미릴리스). 상세 docs/게임_플러그인_탑재.md.
- 진입: 창 머리 게임 버튼(옛 순찰 자리) → 시작 화면. 게임 코드는 본체 밖 코드 팩(src/game/entry.ts → dist/game/goei-game.N.txt, pluginStorage goei:game:code). 릴리스 때 dist/game/ → release/game/ 복사 필수.
- 다리 타입 src/game/bridge.ts (엔진·본부 스레드와 합의). 엔진 들어오면 src/game/play.ts만 action/main.ts mountGame으로 교체.
- 자산 팩: game-pack/<폴더>/pack.json. 효과음 스레드는 WebAudio 합성이라 sound 팩 만들지 말 것(요청).
- 결과는 버튼으로만: 보고서 붙이기(채팅에 전송 대기) / 「관리국 훈련 기록」 로컬 로어북. 요원 상태는 안 바꿈(기획서 22.3).
- 미확인: 실제 Risu iframe의 requestFullscreen·AudioContext·blob 이미지, 실제 폰.
