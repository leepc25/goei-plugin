# 인수인계: 가짜 관리국 적 도트 (2026-10-22 05:30, 사용량 초과로 중단)

## 위치
- 설계서: docs/캐릭터제작서/동작설계_가짜관리국.md (규칙 차이, 125클립 표, 엔진 메모 8절)
- 작업 폴더: game-src/action/fake_bureau/ (브랜치 claude/project-thread-ld4f3d)
  - base/<대상>/base.png = 기준 그림 5종(이도형·곽성주·검사·진압·소각), 쟈알디 A2 톤에 맞춤
  - clips/<대상>/<클립>/NN.png = 생성 원본 장, final/<대상>/<클립>.png = 정리된 가로 스트립 + manifest.json(장 수, 손 좌표·아래팔 각도, 발바닥 y=136, 오른쪽을 봄)
  - final/{sword,riot,burn}/v<n>/ = 일반 요원 얼굴 변형(코드로 머리색·수염·반창고·흉터 등, 생성 0회)
  - scripts/clips.py = 클립별 동작 문장과 뼈대, fixes.py = 장 빼기 목록, qa/notes.md = 검수 메모
- 시연판: release/demo/fake-bureau.html (이도형 39, 곽성주 21, 일반 3타입 대기 동작만)

## 진행
- 다 됨 62클립: 이도형 39/39, 곽성주 21/29, 검사·진압·소각 각 1/19(대기만)
- 남음 63클립:
  - 곽성주 8: kneel_up down getup shove laugh super_ready super_fire flee
  - 검사 18: alert walk run burstin chat salute hit stagger down getup grabbed die zigzag stance iai twocut deflect parry
  - 진압 18: alert walk run burstin chat salute hit stagger down getup grabbed die aim burst kneelfire flash butt reload
  - 소각 18: alert walk run burstin chat salute hit stagger down getup grabbed die aim flame sweep toss vent burst_die
  - 각 클립의 동작 설명은 설계서 4장과 scripts/clips.py에 있음.
- PixelLab 사용: 약 218회 (승인 상한 530회). 대기열은 비움(jobs.json 상태 cancelled).

## 알려진 결함
- 이도형 grab·grabslam: 생성기가 잡힌 상대 몸을 그려 넣음 → 다시 그려야 함(캐릭터만).
- 이도형 down 4–6: 누운 몸 위로 칼·칼집이 X자로 솟음. bulletcut 2·aircut 2: 칼날이 흐린 잔상. hamster: 재킷 안감 꾸러미가 안 보임. jump: 공중 장에서만 칼을 뽑아 듦.
- 이도형 cut4·super_ready 마지막 장은 검은 실루엣이라 뺐음(fixes.py).
- 곽성주 swing 1–2·doubleswing 1–7: 미니건이 뭉개진 잔상 덩어리. rage 0: 총구에 흰 불꽃. turn: 실제로 몸이 돌지 않음. 키는 쟈알디 대비 약 1.3배, 미니건은 한 정.
- 소각 노즐이 짧음.

## GPT에 맡길 남은 그림
- 위 남은 63클립 + 이도형 grab·grabslam 다시 그리기 + 곽성주 swing·doubleswing 미니건 다시 그리기.
- 규격: 기준 그림 base/<대상>/base.png와 같은 얼굴·옷·톤, 검은 정장 + 선글라스 필수, 오른쪽을 봄, 투명 배경, 캐릭터와 무기만(불·연기·총구 불꽃·피·상대는 그리지 않음, 게임 코드가 그림).
- 캔버스: 일반 192×144, 네임드 256×144, 발바닥 y=136. 결과는 final/<대상>/<클립>.png 가로 스트립으로 저장하고 manifest.json에 장 수 추가.
