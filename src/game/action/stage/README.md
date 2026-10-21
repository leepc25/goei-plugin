# 차원 승강기 층 생성 (`stage/`)

작성 2026-10-21 · 근거 `docs/스테이지설계서_차원승강기.md` · 엔진 연결 `docs/게임_모듈_연결.md`

엔진(「게임 전투와 조작」)에는 `createElevatorStage(store, hooks)` 하나가 `StageModule`로 들어간다. 층 자료와 생성은 DOM 없이 돈다.

| 파일 | 하는 일 |
| --- | --- |
| `types.ts` | 조각·고정 방·얹는 것·적 자리(SpawnHook)·층·정비 구역 자료형. 좌표는 엔진과 같음(x, 깊이 y 500~680) |
| `data/chunks.ts` | 조각 세트: 공용 10 + 로비 6 + 유형별 6~7 + 정비 구역 6. 조각 = 반 화면(640px), 지형 모양과 얹을 자리만 가진다 |
| `data/rules.ts` | 규칙서 공통 12줄 + 유형별 줄, 재편 때 바뀌는 문장, 출동마다 뒤집히는 변형(flag) |
| `data/floortypes.ts` | 유형 7종(로비·침묵·어둠·추격·퍼즐·재현·시험) + B-12, 팔레트·방송 힌트·수호자 후보·적 후보, 위협 예산 |
| `gen/floor.ts` | `makeFloor`: 유형 → 조각 나열 → 고정 방(엘리베이터 홀·시험 목표 방·수호자 방·출구 홀) → 장치·규칙 표지·적 자리·승객 → 검증 → 3번 다시 → 고정 배치 A/B. `pickType`(직전 3층과 다르게, 재편 때 섞임) |
| `gen/service.ts` | `makeService`: 정비 구역 세로 미로(칸 격자, 덕트·지지대·틈새), 다락방·로프·입구·아래 점검문 고정, 나갔다 들어오면 다시 짜임 |
| `elevator.ts` | 총애 −3~+3, 버튼 수(1~3)·유형 미리 보기·기억된 버튼·EXIT, 방송·인사·닫힘 연타 문장, 거래 참거짓 |
| `passengers.ts` | 떠도는 승객 5종 기본 대사, 돕기/무시/뺏기 |
| `state.ts` | 영구 기록(규칙서·총애·최저 깊이·재편 횟수)과 출동 상태, 송신, EXIT 재편 |
| `plan.ts` | 층·정비 구역 칸·승강기 안·출구 → 엔진 `FloorPlan` + 회색 상자 배경·전경(어둠·추격 벽·조임) |
| `module.ts` | `StageModule`: 지형 판정(구덩이·단·낮은 천장·좁은 길), 유형별 규칙 tick, 소품 E 처리, 이벤트(소리) |
| `demo/` | 시연판(대역 엔진). `node scripts/build-stage.mjs` → `release/demo/goei-elevator-stage.html` |

## 다른 작업과 나눈 것

- 적·수호자 몸과 행동: 「적과 수호자」. 여기서는 `api.spawn({kind, x, y, boss?, elite?})`와 `FloorPlan.encounters`만 낸다. 쓰는 kind: lurker shooter hum shade crawler charger resident warmth toucher predator thief nothuman, 수호자 guard conductor noise shadow legs shape elder family208 risenhouse touchers.
- 승강기 호명·승객 대사: 「대사와 컷신」. `hooks.elevator.callout(agent, favor, n)`, `hooks.passenger.talk(kind, honest, long)`로 바꿔 끼운다.
- 아이템 효과: 「아이템과 무기」. 층은 줍기 소품(item·pack)과 `item` 이벤트의 `id: 'light'`(손전등 → 어둠의 빛 회복)만 본다.
- 정산: `api.note('stage.*')`로 깊이·가 본 층·발견/송신 규칙·구조·시험 결과·EXIT를 남긴다.

## 시험

- `node --test tests/stage.test.mjs`: 300 씨앗 × 유형 검증, 결정성, 깊이별 예산, 유형 뽑기, 정비 구역(200 씨앗), 승강기 버튼, EXIT 재편, 변형, 그리고 자동 조작으로 25 씨앗이 로비 L1 → 승강기 → 지하 여러 층 → 정비 구역 → 다락방 로프 귀환까지 완주.
- `node tests/stage-browser.mjs`: 시연판 Chromium 연기 시험, PC·폰 스크린샷(`/tmp/stage-shots`).
