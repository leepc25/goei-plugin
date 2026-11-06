---
name: goei-game-hq
description: 게임 본부·임무 흐름 모듈(src/game/action/hq/) 현황, 정한 규칙 수치, 다른 게임 스레드와의 경계
metadata:
  type: project
  modified: 2026-10-21T15:55:00.000Z
---
- 2026-10-21 사용자가 "캐릭터 그만 만들고 다른 거 개발" 지시 → 게임을 스레드 9개로 나눠 병렬 개발(전투와 조작=엔진·통합 주인, 층 생성, 적, 아이템, 대사, 화면·터치, 소리, 리스 탑재, 본부). 연결 약속: main docs/게임_모듈_연결.md + src/game/action/engine/contract.ts.
- 본부 스레드 결과: 브랜치 claude/project-thread-feaea1 (b376e80), 시연판 release/demo/goei-hq.html (출동은 graybox sim 임시, hq/demo-run.ts). 시험 tests/hq.test.mjs(8건), tests/hq-browser.mjs. 빌드 node src/game/action/hq/build-demo.mjs (공용 build.mjs는 엔진 스레드가 합침).
- 본부 소유: 저장 데이터 모양(state.ts, schema 'goei-hq/1'), 재화 정산, Esc 가방 UI, MissionLaunch/RunResult(hq/contract.ts). 아이템 표는 items/ 스레드(SUPPLY_CATALOG, drawItemIcon, bag {id,name,value,research}), 대사 글은 story/ 스레드(setLineProvider), pluginStorage 슬롯·본편 card/report는 리스 탑재 스레드(bridge.saves 슬롯 0=자동, 1~3 수동).
- Claude가 정한 수치(사용자 확인 전): 현금→예산 귀환·철수 50%, 후송 0; 후송 시 회수물·미송신 규칙 절반, 아이템 잃음; 피로 출동마다 +1(최대 3, 시작 체력 -6%씩), 하루 쉬면 0; 영구 부상 후송 15%+위험단계×5%, 1일 휴식 또는 의무실 예산 150; 숙련 경험 20+층×10+성공30+처치(최대30), 단계 경계 0/80/200/360/560/800/1080/1400/1760/2160; 이빨 상자 3개; 위험 단계 결재 300×단계; 이빨 요정·격리 복도·파스타집은 '첫 진압' 후(기획서는 '첫 공략').
- 2026-10-21 15:35 사용자: 게임 스레드들이 따로 노는 것 지적 → 모든 스레드는 「게임 전투와 조작」의 합친 게임 release/demo/goei-action-game.html 안에서만 작업. hq 단독 시연판(goei-hq.html)은 더 키우지 않는다. hq는 main에 통합돼 있음(engine/modules.ts hqAdapter). 아이템 id는 아이템 모듈 것(medkit·bandage·flash…), 임무 판정은 RunResult.notes(stage.*)로 본부가 함(9d5f8f2).
- 15:55 커밋 838e3ea: 엔진 걷기 장면용 메뉴 창 전용 모드 mount(root,host,{walk:false}) — DOM은 메뉴 창만, 키 듣기·raf 없음. API places()/openPlace(id)/openMenu()/isOpen()/close(), host.closed?()/goto?(id). MissionLaunch.runId → RunResult.runId로 두 번 정산 막음. 규격 docs/게임_통합_규격.md: 본부 걷기는 엔진 벨트 장면, 시연 링크는 사용자에게 직접 올리지 않고 지휘자(게임 통합 검수)·전투와 조작 스레드에 보고.
- 17:00 사용자 격노: 통합본 본부가 "지하상가·아케이드·고시원"(같은 폭 칸 한 줄, 벽 글씨, 색 바꾼 쟈알디 복제 NPC, 검은 기둥). 재설계: docs/본부_평면도.md(=/mnt/project-files/game/본부_평면도.md) 15장면(거리·1F 로비·2F 복도/의무실/면담실·3F 큰 사무실/부장실/탕비실·B1 정비실/훈련장·B2 격리 복도/감정실/연구실/이빨실·파스타집), 문 E→암전→방, 엘리베이터·계단. 기능은 방 안 물건(자리)에 붙음. 화면 글씨 금지(방 이름은 입장 때 1초 제목만). 동료 사람 그림은 나중에 PixelLab; 지금은 자리 물건 + 목소리만. 자료 hq/map.ts, API map()/bark(); 그리기는 engine/hub.ts(전투와 조작), 배경은 「게임 타일과 배경」. 잼트리 임무·브리핑 = 화면 아래 대화창(얼굴 사진은 story/demo-photos.json).
- 본부 스레드는 main에 직접 push 못 함(권한 분류기가 막음). 수정은 브랜치 claude/project-thread-feaea1에 올리고 「게임 전투와 조작」에 해시를 보내 합치게 한다. 검수는 「게임 통합 검수」(지휘자) 스레드에 보고.
- 2026-10-22 검수 23(ed581d2): 본부 벽 겹침 자동 시험 tests/hq-walls.test.mjs — 15장면에서 문·계단·엘리베이터·벽 가구 ↔ 벽 장식 겹침, 칸 이음매 장식 잘림 0건이어야 올린다. 장식 도트 구간표 src/game/action/hq/wallDeco.ts(벽 그림 바뀌면 같이 고침). bg.ts drawHqWall: 문 칸 없는 방은 이웃 방 문 칸 빌림(HQ_WALLS), 덧그림 뒤·잘린 장식은 민벽 띠(plainOf)로 덮음. 검수 지휘자는 이제 「게임 통합 검수 2」(cmsg_01SMy6spzkHA3Ttz9fg54ZY8MThHFyM5TbXzxHkMZ5w9nJ).
- 2026-10-22 01:15 사용자 지시: 게임 수정은 이제 새 스레드 「게임 마무리 한 곳에서」 하나가 전부 맡는다. 본부 스레드는 멈춤(ed581d2 합치기도 그쪽).
