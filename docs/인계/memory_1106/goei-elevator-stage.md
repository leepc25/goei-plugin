---
name: goei-elevator-stage
description: 차원 승강기 층 생성 모듈(src/game/action/stage) 현황, 통합판 규칙, 대사 모듈 연결 훅
metadata:
  type: project
  modified: 2026-10-21T16:16:11.274Z
---
- 2026-10-21 thread 「차원 승강기 층 생성」, branch claude/project-thread-jk7a76, main ecd66b3에 합침.
- 통합 규격(docs/게임_통합_규격.md) 반영: lane [440,690], 벽 0~440, 원근 바닥, 소품 y=440. 자체 시연판·build-stage·stage-browser 삭제됨. 화면은 통합판 release/demo/goei-action-game.html 하나뿐. 사용자에게 시연 링크 직접 올리지 말고 「게임 통합 검수」·「게임 전투와 조작」 스레드에 보고.
- 시험: node --test tests/stage.test.mjs (대역 엔진 stage/testing/harness.ts). main 올리기 전 npm run build, tests/engine-browser.mjs, tests/game-loop.mjs(엔진 소유).
- 배경 그림: 「게임 타일과 배경」의 art/bg.ts를 plan.ts drawBack이 부름(그림 없으면 단색).
- StageHooks: 대사 모양 elevator.callout/reaction, passenger.talk (story/hooks.ts stageHooks()가 씀) + 선택형 콜백 board/announce/mirror/deal/meetPassenger (결과는 다음 tick, 총애 기준값은 층 모듈 meta.favor). 상세: /mnt/project-files/game/층생성_보고_2026-10-21.md.
- 남은 일(엔진 몫): modules.ts의 per-floor story.say('board')를 board 훅으로 바꾸기, game-loop이 선택지에서 Digit1 누르기·철수 버튼 찾기.
- 상점 창은 아이템 모듈(merchant 소품 E). See [[goei-observation-game]].
