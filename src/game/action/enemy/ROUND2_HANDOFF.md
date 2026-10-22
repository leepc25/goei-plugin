# 일반 적 AI 2차 인계

기준: `0d43a449` / 브랜치: `codex/enemy-ai-round2`.
`origin/codex/metroidvania-run-system`을 명시적으로 fetch한 뒤 독립 worktree에서 작업했다.
원본 `/workspace/goei-plugin`의 작업 상태와 공용 소스는 변경하지 않았다.

## 재현한 결함과 수정

실제 `engine/World`에 `createEnemy`로 적을 만들고 `World.step`을 실행했다. 기존 별도 ArenaWorld의 성공을 실제 게임 엔진의 성공으로 대신하지 않았다.

- **백일몽 탐사원 정지:** 플레이어 x=400, 적 x=950에서 600틱 후 적이 x=620에 멈추고 공격 0회. 스케일 적용 후 선호 거리 220이 실제 차기 사거리 165보다 길었다. 공격권이 있는 일반 적의 대기 거리를 조건에 맞는 공격의 사거리 안으로 제한했다. 후열 사격수의 줄 간격에도 같은 문제가 있어 함께 검증했다. HP·피해·속도·드랍·공격 프레임은 변경하지 않았다.
- **천장 적 영구 공중 상태:** 매달린 crawler를 띄우면 `cling=true`, z=280, state=air가 300틱 이상 유지됐다. 피격/다운/구속에서는 천장 고정과 상승을 해제해 공통 중력과 기상을 진행한다. 다시 오를 때는 중력을 잠시 막고 수직 속도를 정리한다. 착지→재상승→두 번째 덮치기를 확인했다.
- **인사한 주민 무한 피격 상태:** 인사 후 피격하면 greeted 분기가 공통 경직/다운 처리를 계속 건너뛰었다. 피격은 인사보다 우선해 적대화하고, 이미 시작된 피격 반응을 별도 등장 경직으로 덮어쓰지 않는다.
- **가구 끼임:** 플레이어 (400,565), hollow (1000,565), 탁자 (720,565,w=180)에서 900틱 후 (829.0875,515)에 묶였다. `navigation.ts`가 기존 `itemsLink.solidsNow`를 읽어 가구 모서리를 돌아가는 경로를 계산한다. 레인·방 경계와 가구 여유 폭을 지키며 실제 이동 속도로 걷는다. 탁자 양쪽/레인 위·아래, 바닥 추격형, 도주형을 검증했다. 수호자의 기존 approach 이동은 유지한다.

## 통합 담당이 적용할 공용 패치

`enemy-ai-round2-integration.patch`는 **제안 파일**이다. 이 브랜치의 `world.ts`에는 적용하지 않았다. `enemy.ts`, `kinds.ts`, `guardians.ts`도 수정하지 않았다.

적용 위치: `src/game/action/engine/world.ts`

1. `World.resolveHits`: 프레임 맵의 키를 숫자 ID에서 Body 객체로 변경한다. 새 World의 플레이어와 첫 Enemy가 독립 카운터로 모두 ID=1을 받아, 적 공격이 플레이어 공격으로 읽혔다. 빈 입력으로 crawler를 100틱 돌렸는데 HP 50→36이 되는 재현이 있다. 이 패치는 프레임 오인식을 해결하며 전역 ID 발급 체계를 통합하는 변경은 아니다.
2. `World.separateFromPlayer`: `toucher`를 바닥 접촉형처럼 몸 분리 대상에서 제외한다. 이 적의 선호 거리 상한은 스케일 후 41.25라 기존 `<30` 예외에 못 들어간다. 분리 처리가 약 107px로 밀어내는데 AI 접촉 시작 조건은 50px라 500틱 동안 공격이 한 번도 시작되지 않았다. 적의 수치를 낮추는 대신 접촉형의 실제 사거리를 보존한다.

```sh
git apply --check src/game/action/enemy/enemy-ai-round2-integration.patch
git apply src/game/action/enemy/enemy-ai-round2-integration.patch
```

검증 번들에만 두 변경을 적용하는 명령:

```sh
ENEMY_AI_ROUND2_SHARED_PATCH=1 node --test tests/enemy-ai-round2.test.mjs
```

이는 esbuild 입력을 메모리에서 바꾸며 공용 소스 파일을 쓰지 않는다. 기본 실행은 패치 대기 3개를 TODO로 표시하고 실제 실패 assertion도 출력한다. 통합 후 이 TODO 표기를 제거한다.

## 검증 결과

- 최초 담당 결함 재현: 정지/인사 뒤 피격/천장 피격/가구 추격 4개 모두 수정 전 실패, 수정 후 통과.
- `npm run typecheck`: 통과.
- `npm run build`: 통과. 생성된 release HTML 3개는 이 worktree의 빌드 변경만 되돌렸으며 커밋하지 않았다.
- `npm test`: **348개 / 330 pass / 0 fail / 기존 15 skip / 공용 패치 대기 3 TODO**. TODO는 해결 완료가 아니다.
- 관련 묶음 `node --test tests/enemy-ai-round2.test.mjs tests/enemy.test.mjs tests/run-system.test.mjs`: 45개 중 42 pass, 3 TODO.
- 공용 패치 검증 모드: 전용 회귀 12개 모두 통과. 사거리·실제 플레이어 피격·화면 밖 복귀·사격 후열·천장 왕복·경직/구속 회복·가구 우회·도주 이벤트 1회·실제 총알로 사망/드랍/필드 아이템 생성 1회를 포함한다.
- Chromium 회색 상자: 공용 패치를 검증 번들에 적용하고 PC 1280×720 / 가로 모바일 844×390에서 실제 키보드 이동, 가구 우회 후 적 공격, 키보드 및 터치 사격을 검증했다. 탄약 8→7, 백일몽 HP 150→143, pageerror 0. 상태 배치는 시험용이며 가구 추격 900틱은 브라우저 안에서 빠르게 실행했다. 실제 새 캐릭터 그림 또는 시각 품질 검수가 아니다.
- 최종 `dist/goei-action-game.html`도 HTTP로 열어 PC/가로 모바일에서 `?start=arena` → 실제 방향키로 로비 표지 접근 → E로 일반 적 2체 소환 → 권총 뽑기/사격을 확인했다. 좌표 주입 없이 x=200→396/378, 탄약 8→7, pageerror/가로 넘침 0. 이 단일 HTML에는 공용 제안 패치를 적용하지 않았다. 별도 `enemy-ai-round2-game-{1280,844}.png`와 `enemy-ai-round2-game-browser.json`에 결과를 남겼다.
- `git apply --check` 및 `git diff --check`: 통과.

Chromium 재실행 (Playwright 경로는 환경에 맞춘다):

```sh
ENEMY_AI_ROUND2_SHARED_PATCH=1 ENEMY_AI_ROUND2_BROWSER=1 \
PLAYWRIGHT_MODULE=/tmp/enemy-ai-round2-browser-tools/node_modules/playwright/index.mjs \
CHROMIUM_PATH=/usr/bin/chromium node --test tests/enemy-ai-round2.test.mjs
```

별도 산출물: `dist-test/enemy-ai-round2-runtime[-integrated].mjs`, `enemy-ai-round2-integrated.html`, `enemy-ai-round2-integrated-{1280,844}.png`, `enemy-ai-round2-integrated-browser.json`. 전부 git 제외 디렉터리이며 재생성 가능하다. HTML은 옆의 runtime 모듈과 함께 HTTP로 열 수 있는 그림 없는 검증 도구다.

## 남은 범위

- 공용 패치 두 지점의 실제 통합이 필요하다. 현재 브랜치만으로 세 공용 회귀가 해결됐다고 주장하지 않는다.
- `solidsNow`를 제공하지 않는 옛 독립 ArenaWorld에서는 기존 직선 이동을 유지한다. 현재 엔진의 아이템 연결에는 이미 제공되므로 추가 연결 패치는 필요 없다.
- 길 전체를 막은 가구 배치에는 우회 경로가 없다. 이 경우 순간 이동/가구 관통을 하지 않는다. 모든 절차적 방 배치의 전투 완주나 난이도 균형을 검증한 것은 아니다.
- 전역 Body ID 발급 체계 자체는 여전히 분리돼 있다. 인계 패치는 재현된 프레임 맵 충돌을 좁게 해결한다.
- 캐릭터/컷씬 자산, 공용 엔진·스테이지·본부, 적 도감 수치, 릴리스는 변경하지 않았다. 다른 작업 브랜치를 병합하지 않았다.
