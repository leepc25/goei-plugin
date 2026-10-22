# 터치·패드 입력 2차 인계

기준: `0d43a449`, 브랜치: `codex/touch-input-round2` (2026-10-22).
`origin/codex/metroidvania-run-system`을 명시적으로 fetch한 뒤 독립 worktree에서 작업했다.
기존 `/workspace/goei-plugin` 작업 공간은 수정하지 않았다.

## 수정과 재현

| 재현 | 원인 | 담당 파일 수정 |
| --- | --- | --- |
| 공격을 누른 손가락을 빈 곳/화면 밖으로 이동 | 버튼이 없을 때 기존 버튼을 해제하지 않음 | `ui/touch.ts`: 빈 곳은 버튼 해제 후 재진입 허용, 화면 밖은 해당 포인터 종료 |
| 스틱 끝 → 중앙 → 끝을 250ms 안에 왕복하고 놓음 | 해제 예약 취소 시 Shift 참조 수가 중복 증가 | `ui/touch.ts`: 예약된 누름을 재사용하고 전체 해제 시 타이머를 항상 취소 |
| 터치 이동 중 다른 손가락으로 지도 열기/닫기 | 숨겨진 스틱이 계속 눌린 채 복귀 | `ui/touch.ts`: 지도·메뉴 진입 시 터치 상태·캡처 초기화 |
| 캡처 상실, 창 포커스 상실, 크기 변경 | InputHub와 터치 내부 포인터/방향/타이머 상태 불일치 | `ui/touch.ts`: 생명주기 해제 및 캡처 실패 시 window 종료 이벤트 수신 |
| 키보드 A + 터치 공격 후 키보드만 놓음 | 엔진이 장치별 원본 키와 합쳐진 키를 중복 수신 | `ui/input.ts`: synth 모드에서는 합쳐진 눌림/뗌만 엔진에 전달 |
| 메뉴를 열고 키보드 공격 | 메뉴에서 가로챈 원본 키가 엔진에도 전달 | `ui/input.ts`: 합성 전달 모드에서 원본 이벤트 전파 차단 |
| 두 Shift를 누르고 하나만 놓기 / 이동 중 입력칸으로 초점 이동 후 놓기 | 별칭 키 조기 해제 / 입력칸 keyup 무시 | `ui/input.ts`: 물리 키별 추적, 입력칸에서도 해제 처리 |
| 패드 버튼을 누른 채 더 짧은 버튼 배열의 패드로 교체 | 새 배열에 없는 이전 버튼을 해제하지 않음 | `ui/gamepad.ts`: 패드 식별자·인덱스 변경 및 누락 버튼 해제 |

`keys.ts`의 배치는 그대로다. 캐릭터·자산·공용 엔진 파일은 수정하지 않았다.
키보드 합성 전달은 기존처럼 UI가 엔진보다 먼저 attach되는 구조를 사용한다.
상위 capture 단계의 대화/본부 단축키 처리는 유지한다.

## 검증 실행

저장소 루트에서 실행한다. 브라우저 스크립트는 자체 로컬 HTTP 서버를 열고 종료한다.
테스트별 Node 격리를 사용하며 `--test-isolation=none`은 사용하지 않는다.

```sh
npm ci
npm run typecheck
npm run build
npm test
node tests/touch-input-round2/engine-patch.mjs
PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright \
CHROMIUM_PATH=/usr/bin/chromium \
node tests/touch-input-round2/browser.mjs
```

수정 전 비교도 파일을 덮어쓰지 않고 실행할 수 있다. 입력 소스 3개만 지정 커밋에서 메모리로 읽어 fixture와 실제 게임을 묶는다. 수정 전 실패로 종료 코드 1이 예상된다.

```sh
SOURCE_REF=0d43a449 SHOTS=out/touch-input-round2-baseline \
node tests/touch-input-round2/browser.mjs
```

- 타입 검사·빌드 통과.
- 전체 회귀: 39개 테스트 파일, 337개 검사 중 322개 통과·15개 기존 skip·실패 0.
- Chromium: 844×390 / 667×375에서 26개 검사 모두 통과. 같은 검사에 기준 커밋 입력 소스를 넣으면 17개 실패·9개 통과로 결함을 재현했다. CDP `Input.dispatchTouchEvent`로 실제 브라우저 touch/pointer 경로를 사용한다. DOM PointerEvent로 터치를 대체하지 않는다.
- 실제 게임: 이동+공격, 이동 중 조사 입력, 누른 스틱을 남겨 둔 지도 열기/닫기 및 시뮬레이션 정지, 메뉴 계속 후 재이동, 화면 밖 이동 해제.
- 실제 본부: 첫 출근 컷신만 skip으로 준비한 뒤 가구를 돌아 문까지 **터치로 걷고 조사 버튼으로 2층 복도에 도착**. 좌표 주입·goto·문 상태 조작 없음.
- 입력 fixture: 같은 버튼의 두 손가락 독립 해제, 공격→조사→빈 곳→재진입, 스틱 왕복 Shift 해제, 키보드/터치 및 패드/터치 혼용, 활성 캡처 상실·blur, 키 별칭·입력칸 keyup.
- 패드: Gamepad API 모의 장치. 실제 게임 루프의 이동·공격·지도 왕복·Start 메뉴/B 복귀와 재이동, 연결 해제, 짧은 버튼 배열로 교체를 검사한다.
- 결과와 스크린샷: `out/touch-input-round2/results.json`, `844x390-{map,play,hq-door}.png`, `667x375-{map,play,hq-door}.png`. 기준 비교는 별도 `out/touch-input-round2-baseline/`.
- 로컬 조작 검증판: `dist/goei-action-game.html` (수정 코드 적용, 그림 변경 없음). 생성 HTML과 빌드 산출물은 커밋하지 않는다.

## 공용 연결 패치 (미적용)

`engine-input-reset.patch`는 `src/game/action/engine/input.ts`의 `Input.clear()`에만 적용한다.

재현: `press('shift'); clear(); sample()` 하면 기준 코드에서 `held`가 비었는데 `pressed`에 shift가 남고 `evade=true`가 된다. 샘플 전에 취소한 공격도 `pressed`에 남는다. 취소 전 방향 두 번 누르기 이력도 다음 입력에 이어진다.

패치는 취소 시 미처리 눌림/뗌과 두 번 누르기 이력을 버린다. 정상적인 짧은 Shift 회피는 유지한다. 검증 스크립트는 임시 디렉터리에 원본을 복사해 실제 `git apply`한 다음 수정 전 재현과 수정 후 동작을 비교한다. 담당자의 엔진 파일을 직접 바꾸지 않는다.

통합 담당 적용 위치: 저장소 루트.

```sh
git apply --check tests/touch-input-round2/engine-input-reset.patch
git apply tests/touch-input-round2/engine-input-reset.patch
```

이 패치는 독립 검증했으나 본 브랜치 실행판에는 적용하지 않았다. 메인 통합 담당이 새 엔진 변경과 함께 반영해야 한다. `player.ts` 연결이나 `ui.css` 규칙 변경은 이번 수정에 필요하지 않았다.

## 남은 범위

실물 Android/iOS 터치 화면, Safari, 실물 게임패드·진동, 플러그인 호스트 안의 회전 좌표는 미검증이다. Chromium 터치 에뮬레이션/모의 패드 검증을 하드웨어 검증으로 주장하지 않는다. 전체 층 완주나 캐릭터 시각 품질 승인도 이번 범위가 아니다.
