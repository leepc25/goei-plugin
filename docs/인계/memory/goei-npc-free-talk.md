---
name: goei-npc-free-talk
description: 게임 NPC 모델 호출 자유 대화 — 승인·구현 완료 상태, 브랜치, 조작 변화(E 두 번), 남은 일
metadata:
  type: project
  modified: 2026-10-22T03:34:42.859Z
---
- 2026-10-22 스레드 「NPC 모델 호출 대화」. 사용자가 설계 승인("그러면 일단 반영하고"). 기본값: 주 모델(보조 선택 가능), 본편 최근 채팅 보내기 끔.
- 구현 완료: 브랜치 claude/project-thread-voh5j8, 최종 커밋 149d2bace014f50c59da12be2fbb967d381cd7eb (독립 검수 3차 지적 반영). 「게임 마무리 한 곳에서」에 합치기 요청함 (2026-10-22 03:50). 문서 docs/NPC_자유대화.md.
- 조작 변화: 말 걸 수 있는 사람 앞 E = 대화창 먼저, E 한 번 더 = 원래 하던 일(임무 창구·거래·인사). 브라우저 시험(engine-browser, game-loop, story-game, final-shots)은 E 두 번으로 고쳤다. 새 시험 tests/npc.test.mjs, tests/npc-browser.mjs.
- 행동은 게임 코드 상태(평소·경계·동행·적대·떠남·거래). 모델 태그는 계기일 뿐이고 decide()가 판정한다. 호감 -3..3, 적대는 호감 ≤-2.
- 플러그인 실제 경로 확인: 본편 로어북 시트(CBS 풀림) 읽음, runLLMModel allowPlugins, 실패하거나 25초가 지나면 미리 쓴 대사.
- 남은 일: 동료 요원 동행은 쟈알디 외 그림이 없어서 꺼 둠(canJoin false). 블라렛·살라딘·아벤샤·브라우니·탐미주의·이도형·곽성주는 게임에 들어오는 모듈이 npc.talkTo(id)로 붙인다.
- 콘쥬스 미성년 안전 줄이 프롬프트에 늘 붙는다.
