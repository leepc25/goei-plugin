---
name: goei-observation-game
description: 관찰형 미니게임 「관리국 순찰」(src/game) 현황, 그림 팩 방식, 플러그인 시작기(본체 분리) 검토 결과
metadata:
  type: project
  modified: 2026-10-18T14:24:29.859Z
---
- 2026-10-18 GPT 결과는 사용자가 "엉망"이라 해서 Claude가 새로 작성. 범위: 「순찰 관찰만」(편성·기록·기술 탭). 성장 요소는 나중에.
- 그림: game-src/ (GPT 원본) → tools/game_assets.py → game-pack/patrol/ (PNG 19장 + atlas.json). 크기 변경 금지, 기기 픽셀 정수 배율.
- 그림은 플러그인·카드에 넣지 않음 (사용자: 게임은 선택이라 카드·플러그인 용량 키우면 안 됨). build가 release/goei-game-patrol.pack 한 파일(GOEIPACK 바이너리, ~720KB)로 묶고, 게임 창에서 처음 열 때 받거나 「파일로 넣기」. 저장은 pluginStorage 'goei:game-pack:patrol' (src/host/gamepack.ts). 팩 모양 바뀌면 src/game/assets.ts PACK_VERSION 올림.
- 창 연결: 상단 아이콘 / 모바일 메뉴 「순찰」 (src/ui/game.ts), 응답 대기 중 빨라짐 (src/host/waiting.ts). browser.mjs 마지막 테스트가 팩 받기 흐름 검사.
- 브랜치 claude/project-thread-9b85bm (v0.16.28 위로 rebase, 3bed822). 릴리스 안 함.
- 2026-10-18 사용자 결정 「나누기」: goei-plugin.js = 시작기(src/main.ts, ~10KB), 본체 = src/body.ts → dist/goei-body.js(첫 줄 `// goei-body 판`), pluginStorage 'goei:body'. 괴이 카드 열 때만 본체 실행(플러그인 스크립트 nonce로 script 주입; Risu 칸은 eval·blob 막힘). 없거나 판 다르면 release/goei-body.json + goei-body.N.txt(200KB 조각) 받음, 실패 시 다시 받기·파일로 넣기 창(src/loader/panel.ts). 처리기(beforeRequest·output·display)는 시작기가 걸고 본체로 넘김. 이전 main.ts 내용은 body.ts로 옮김 (다른 스레드의 main.ts 수정은 body.ts에 반영해야 함). 게임 팩도 pluginStorage(base64)로 (에셋 저장소는 다시 받으면 쌓임). 브랜치 040a57a. v0.16.29(2026-10-18)로 ogrf03 브랜치와 합쳐 릴리스됨.
- 2026-10-18 v0.16.29 써 본 사용자: 게임이 GPT 판보다 "허접". GPT 인물·효과 시트는 전부 버리고 배경만 남김(사용자). 다시 넣을 것: 갈림길·학생 구조·해방 게이지·상점/보급권·소리/CRT/배속 + 출동·귀환 장면(품질 좌우, 공들일 것) + 보급. 생존 수치(포만·수분·내구)는 버림. 보급 아이디어(확답 전): 가방 보급품이 갈림길 문 열쇠. 타격감은 코드로(히트스톱·넉백·흔들림·번쩍임·파편). 사용자는 던파2·천지를먹다2 같은 큰 벨트스크롤 도트를 원함. 시험(2026-10-18, /mnt/project-files/game/dot_test_1018/): 손으로 찍는 32×48 SD는 깔끔하나 작음; Blender 스크립트 3D→도트는 마네킹 수준이라 실패. 사용자는 VRoid·Mixamo 직접 작업 불가. 사용자 선택 「작은 도트」. Claude 코드 리그 쟈알디(dot_test_1018/)도 거절 → Claude는 그림 그리지 않음. 2026-10-18 사용자: 게임 보류(대기). 재개 시 「순찰」 버튼 숨김 여부 물어볼 것.
- 2026-10-19 GPT가 main에 docs/관리국_괴이탐사_게임_상세기획서.md 올림 (1인 벨트스크롤 로그라이트, 8명+NPC, 14키, 자동 AI, 절차 맵). Claude 검토: 설정 고증은 좋으나 그림 문제 미해결·범위 과대·PC 정수배율 불가·배속 폐기. 검토 /mnt/project-files/goei-plugin/docs/게임기획서_검토_1019.md.
- 2026-10-19 사용자: 에셋(캐릭터 도트 포함)은 GPT가 전부 해결 가능. 그림 확보를 막힘으로 보지 말 것; Claude는 그림을 그리지 않고 규격·검수·코드 담당.
- 2026-10-20: 게임 작업은 Codex(GPT)와 공유. 최신 인계: AGENTS.md, docs/JYALDI_CONSOLIDATION.md, docs/다음방_작업인계_캐릭터전면재제작.md (v4 그림 반려, 기존 그림 재사용 금지, 128px 정자세·2배 표시 확정). Codex 작업 브랜치 codex/jyaldi-consolidation (PixelLab 체험 시험, main 미합침). Claude 검토: docs/JYALDI_PIXELAB_REVIEW_CLAUDE_2026-10-20.md (브랜치 claude/project-thread-7rtjwh) — 걷기 결함 주원인은 3/4 입력→옆모습 몸 회전; 게임 시점 정자세 1장 먼저 승인 권고; 쟈알디 고유 클립 약 40~45개, 1단계 전투 20개.
- 2026-10-20 사용자 결정: PixelLab 생성은 Claude가 직접 해도 됨. 클라우드 환경 `goei-pixellab`(네트워크 전체, 네트워크 시크릿 = api.pixellab.ai Authorization Bearer 자동 첨부; 키는 Claude가 못 봄) 생성. 체험 잔액 36(GPT와 공유 계정, 한 쪽만 생성). 첫 시험: 게임 시점 정자세 → 같은 조건 걷기 재생성 (검토서 6장).
- See [[goei-bot-plugin-project]].
