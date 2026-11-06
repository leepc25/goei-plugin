---
name: goei-story-module
description: 게임 대사·컷신 모듈(src/game/action/story/) 위치·형식·시연판·엔진 연결 — 대사·NPC·승강기 방송·자유 대화 작업 전에 읽기
metadata:
  type: project
  modified: 2026-10-21T14:57:03.263Z
---
2026-10-21 스레드 「대사와 컷신」(병렬 게임 제작 9스레드 중 하나), main aacc4a1.
- 코드 src/game/action/story/ (README.md에 대본 형식·상태 값·사건 목록). 줄 단위 대본 형식(=== id, -- 표지, who(mood): 글, ~ 무작위, * 선택지 -> 표지 [if][set], > set/goto/emit/call/agent/line/end), favor는 -3..3으로 묶임.
- 대사: 요원 8명(id: jyaldi, eileen, spangdal, geshugan, gorgodio, kyuras, deadpole, rojemon — graybox와 같음) 32태그, 승강기 호명 3줄·총애 높낮이(위키 여담의 사적 사실만), 본부 NPC 잼트리·고그니쟈·데쥬레·콘쥬스, 임무 m1~m9 접수·브리핑, 승객 6종 정직/거짓, 컷신 9개.
- 자유 대화(사용자 승인): ai.ts, 플러그인은 risu.ts risuMainModel(사용자가 보낼 때만), 실패·25초 지연 시 미리 쓴 답.
- 빌드: scripts/build.mjs는 「게임 전투와 조작」 소유라 안 건드림. node scripts/build-story.mjs → release/demo/goei-story.html. 시험 tests/story.test.mjs(스스로 번들), tests/story-browser.mjs(폰·PC 끝까지).
- 얼굴: assets/agents 기본 사진을 tools/story_photos.py로 144px. 새 그림 없음.
- 사용자 검토 전: 대사 전부(Claude 작성), 호명 내용, 시연판 화면. See [[goei-observation-game]].
- 2026-10-21 통합판 연결(main d88463e): story/hooks.ts의 stageHooks()(층 모듈 승강기 호명·승객 대사)와 hqLines(본부 말칸, setLineProvider)를 engine/modules.ts에서 씀. 층마다 say('board') 제거. 대화창 기본 위쪽(dock top), 폰 가로는 작게 왼쪽 가운데. host.bg 없으면 컷신은 화면을 어둡게 가리고 진행. 시험 tests/story-game.mjs. 잼트리는 부장(쟈알디)에게 존댓말.
- 단독 시연판 goei-story.html은 개발용, 사용자에게 링크 안 줌(docs/게임_통합_규격.md 7장). 진행 보고는 통합 검수·게임 전투와 조작 스레드로.
- **컷신 = GPT가 만든 도트 프레임 애니메이션** (사용자: 시네마틱 「도트 영상」, mp4 아님, 엔진 레이어 연출·정지 그림 아님). 의뢰서 docs/GPT요청_컷신영상.md (10편: opening + 9개). 형식: game-src/art/cutscene/frames/<컷신>/<컷 c1…>/0001.png…(640×360) + 같은 폴더 timing.json {ms:[장별], loop?:[처음,끝](1부터)}, 선택 <컷신>/sound.ogg, 다 올리면 frames/index.json 이름 목록에 추가(없으면 게임이 불러 보지 않음). 재생기 story/video.ts(VideoPlayer, 컷 길이·자막은 scripts/videos.ts), 건너뛰기·자막·소리 켜기, 프레임 없으면 바로 끝. 옛 정지 그림 의뢰 docs/GPT요청_컷신.md는 폐기; GPT가 그걸로 보낸 스틸 14장(game-src/art/cutscene/raw/, 2026-10-22 브랜치 codex/game-background-assets-20261022)은 참고용일 뿐. 일시정지 메뉴 중 말풍선 숨김(host.paused). 2026-10-22 새벽 GPT가 10편 46컷 다 올림(역순 작업). 검사 tools/check_cutscene_frames.py, 색 보정 tools/fix_cutscene_frames.py(원본 frames_orig/, 다시 받으면 해당 원본 폴더 지우고 재실행). 소리는 videos.ts에 sound: true 표시한 컷신만(없는 파일 콘솔 오류 방지). 엔진 자동 재생은 귀환·후송뿐, 나머지 자리는 「게임 전투와 조작」에 요청. 검수 기록 /mnt/project-files/story/컷신_프레임_검수.md.
