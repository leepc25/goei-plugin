# 지도·탐색 UI 인계 · 2026-10-22

> **⚠ Claude 반성 · 2026-10-31 (사용자 지시로 문서마다 남김)**
> 2026-10-31 Claude는 다음 잘못을 저질렀다. 이 문서를 읽는 모든 Claude는 같은 짓을 하지 않는다.
> 1. **사용자 결정을 무시했다.** 콘쥬스는 사용자가 10-26에 20세로 정했고 인계서에도 적혀 있었는데, 옛 Claude 문장(teenage high school girl)을 근거로 화장실·샤워 그림을 거부하고, 사용자가 직접 뽑은 화장실 줄까지 팩에서 뺐다. 옷도 제복인데 교복이라고 단정했다.
> 2. **사용자 말에 토를 달고 같은 주장을 되풀이했다.** 사용자가 여러 번 지적했는데도 근거를 다시 확인하지 않아 몇 시간을 허비하게 했다.
> 3. **허락 없이 문서를 지웠다.** 「지침을 지우라」는 말만 듣고 목록을 보여 주지도 않고 96개를 지웠다가 되살렸다(결과물 삭제 금지 규칙 위반).
> 4. **문장을 덧대기만 하며 PixelLab을 낭비했다.** 이성해 점프 공격 5번 연속 실패, 이어폰 음악 120줄을 못 쓰게 만듦.
> 5. **답을 미루고 일을 멈춰 두었다.** 백그라운드로 돌릴 일을 돌리지 않고 대화만 했다.
>
> 지킬 것: 사용자 결정·위키가 근거다. 옛 Claude 자료는 근거가 아니다. 사용자 말에 토 달지 않는다. 무엇이든 지우기 전에 목록을 보여 주고 허락받는다. 실패하면 덧대지 말고 다시 쓰거나 바꾼다.


기준: `codex/metroidvania-run-system`의 `b674c09f130242f780f444d80c8c5ba78401c90a`.
작업 브랜치: `codex/exploration-ui`. 기존 쟈알디 및 캐릭터 자산은 변경하지 않았다.

## 구현

- `src/game/action/stage/runmap.ts`: 현재 깊이 전체 지도와 현재 방 중심 3×3 미니맵. 노란 테두리·마름모로 현재 방, 점선·물음표로 미탐색, 초록 체크로 정리 완료, 붉은 점으로 미정리 표시. 연결은 네 방향과 순환을 표시하며 잠금 번호를 양 끝에서 중복 그리지 않는다.
- 잠김(붉은 번호), 열쇠 보유(노란 번호), 열린 길(초록 체크)을 구별한다. 보유 열쇠, 보상 `+`/수령 `−`, 패널 `P`, 정비 입구 `S`, 다락방 로프 `R` 범례와 다음 행동을 분리했다. 정비 격자는 위층 점검문 `↑`와 발견한 연결·미탐색 칸을 표시한다.
- `ui/mapLayout.ts`: CSS 변형 후 실제 캔버스 표시 크기로 배율 산정. 전체 지도는 캔버스 전체 크기와 터치 안전 여백을 사용한다.
- `ui/hud.ts`: 전체 지도 모드 갱신과 모바일 보스 체력 표시 이동(미니맵과 분리).
- `ui/touch.ts`, `ui/ui.css`: 전체 지도 중 조이스틱·전투 버튼을 숨기고 해당 터치 판정을 막는다. 지도·메뉴 버튼은 유지하며 닫으면 전투 조작이 복원된다.
- `tests/exploration-browser.mjs`: 실제 Chromium에서 지도 입력, 정지·재개, 실제 정비 진입과 표시 전용 밀집 상태를 검증한다.
- `release/demo/goei-action-game.html`: 위 변경을 포함한 단일 HTML 검수판. 플러그인 릴리스 또는 main 배포는 하지 않았다.

## 검증

통과:

```sh
npm run typecheck
npm run build
node --test tests/run-system.test.mjs tests/ui-input.test.mjs
python3 -m http.server 8765 --bind 127.0.0.1
PLAYWRIGHT_MODULE=/tmp/goei-browser/node_modules/playwright CHROMIUM_PATH=/usr/bin/chromium node tests/exploration-browser.mjs
git diff --check
git apply --check docs/verification/exploration-ui/map-provider.patch
```

Playwright는 저장소 의존성 변경 없이 임시 경로에 설치했다. 다른 환경에서는 `PLAYWRIGHT_MODULE`을 설치 위치로 지정한다. `GAME_URL`로 HTTP 검수 주소, `SHOTS`로 출력 경로를 바꿀 수 있다.

- Chromium PC 1280×720, 가로 모바일 844×390 및 667×375.
- 실제 게임 HTML, 기존 쟈알디, seed 4242 출동. PC Tab / 모바일 지도 버튼 좌표 터치로 열기·닫기, 열린 동안 tick 정지, 닫은 뒤 재개 확인.
- 실제 방의 점검문 앞에 플레이어를 놓고 E 입력 → 정비 구역 진입 확인. 완주 플레이 검증은 아니다.
- 최대 7×5 방 격자와 잠금 3종·보상 2종·로프는 **읽기 전용 mapView 교체 fixture**로 표시 검증. 실제로 모든 방을 돌거나 보상을 획득했다는 증거가 아니다.
- 주요 안내는 실제 표시 크기 12px 이상. 전체 지도 문자 경계 및 주요 문구 겹침 검사. 정비 지도의 문자 경계, 위층 표시·로프도 검사. 브라우저 uncaught error 없음.
- 작은 모바일에서 목표 두 줄이 범례를 밀던 문제와 전체 지도 위 조이스틱 겹침을 발견하고 수정했다.

## 스크린샷과 검수판

- [PC 실제 출동 미니맵](pc-minimap.png), [PC 실제 전체 지도](pc-map.png)
- [가로 모바일 실제 미니맵](mobile-minimap.png), [가로 모바일 실제 정비 구역](mobile-service.png)
- [가로 모바일 최대 방 배치·잠금·보상 fixture](mobile-states.png)
- [작은 가로 모바일 로프·정비 fixture](small-mobile-rope.png)

전체 15개 스크린샷은 검증 실행 시 `out/exploration-ui/`에 생성한다.

플레이 파일: [변경 반영 단일 HTML](../../../release/demo/goei-action-game.html).
저장소 루트에서 위 HTTP 서버를 실행한 뒤 <http://127.0.0.1:8765/release/demo/goei-action-game.html?start=stage=elevator>을 연다. 내려받은 단일 HTML도 열 수 있으나 이 작업의 Chromium 검증은 HTTP로 수행했다.

## 통합 요청과 남은 범위

**미적용 최소 패치: [map-provider.patch](map-provider.patch).** 다른 담당 소유인 `stage/module.ts`에만 2개 표시 필드를 연결한다. 엔진·저장·방 생성은 수정하지 않았고 `engine/modules.ts` 변경도 필요하지 않다.

1. `MapRoom.service`: 이미 방문한 실제 방 계획의 `hatch`/`servicedoor` 유무. 도착 방이라고 추측해서 점검문이 있다고 표시하지 않는다.
2. `RunMap.panelReady`: 해당 깊이가 `clearedFloors`에 있는지. 승강기 패널 켜짐/꺼짐, 정비 구역 아래 점검문의 잠김/하강 가능 표시를 결정한다.

두 필드는 선택 필드로 구현되어 현재 기준에서도 실행된다. **패치 적용 전 실제 게임에는 S 위치와 명시적 패널 ON/OFF가 나오지 않는다.** 패널·하강 가능 여부는 기존 목표 문구를 확인하도록 안내한다. fixture 스크린샷의 S 및 활성 상태는 공급될 데이터의 표시 검증이다. 통합 담당은 패치 적용 후 실제 열쇠 획득·방 정리·패널 활성화·정비 재진입 흐름에서 확인해야 한다.

기준 문서에 기록된 퍼즐 보행 봇 실패, 전 깊이 완주, 저장/복원 및 본부 정산의 최종 통합 판정은 이 UI 작업의 해결 범위가 아니다. 전체 `npm test`와 플러그인 배포 검증은 수행하지 않았다. main 병합·릴리스는 하지 않았다.
