# 최신 검수 결과 · 2026-10-22 실제 납품

아래 이전 인증 대기 기록 대신 현재 결과는 `DELIVERY.md`와 `evidence/pixel-check.json`, `evidence/integration-check.json`, `review/browser-check.json`을 따른다. 원본1장/차감1회, 닫힘·절반·열림96×144, 고정 영역9단계 동일성, PC·모바일 모의검사 통과. 사용자 시각 승인·물리 모바일 기기 검수·최종 게임 반영은 미완료다.

---

# 검증 기록 · PixelLab 본부 출입구 round2

## 재개 검수 · 2026-10-22 (현재 상태)

최신 통합 소스 `7f8fdfb0c5a6cef096d412d3d872aec6eae7de81`를 별도 worktree에서 빌드하고 실제 키보드로 office → f2까지 이동해 현재 화면을 보존했다. 문만 제외한 배경은 같은 게임의 `drawBackground`를 offscreen canvas에 호출해 얻었으며 원본 본부 그림을 덧칠하지 않았다.

- 독립 검수판 `review/index.html`: 현재 문 + 새 기하 표식 시안. PixelLab 새 문 PNG는 아직 없고 닫힘/열림 버튼은 비활성화다. `review/browser-check.json`의 빈 `doorStates`가 이 한계를 표시한다.
- Chromium PC 1280×800, 모바일 가로 844×390, 세로 390×844에서 가로 넘침·pageerror·외부 이미지 요청 없음. 모바일은 Playwright tap 이벤트로 표식/기준선 토글과 캔버스 픽셀 변화를 확인했다. 물리적 휴대폰 검수는 아니다.
- 표식 48×16, RGBA, 외부 alpha=0 확인. 표시 y=448~480은 문턱 440 아래, 도착 발 486 위다. 원본 코드/앵커/해시를 레이어 manifest에 보존했다. 사용자 시각 승인 전 시안이다.
- `npm run typecheck`, `npm run build` 통과. `node --test tests/hub-doors.test.mjs tests/hq-layout.test.mjs tests/hq-walls.test.mjs`: 9검사 통과, 문 28개 전환 확인. 공용 소스는 변경하지 않았다.
- 공개 MCP 스키마에 기존 요청 JSON 검증 통과. `get_balance`, `list_jobs(include_recent=true)`, `search_help`는 실제 호출했으나 인증 누락 401. 계정 잔액/작업 수/조회 과금 정책은 미확인이다. 생성 호출 0회, 생성 차감 0회.
- 미완료: PixelLab 실제 인증, 기존 문 작업 존재 여부의 서버 확인/회수, 신규 문 원본과 두 상태/레이어, 실제 과금 증거, 문 상태 동일 프레임 검증, 새 문 PC/모바일 합성 검수, 실행 가능한 자산 연결 패치.

## 이하: 이전 준비 검증 기록

기준: `0d43a4496bff1cdc7c0122e273a43475c9134356`. 2026-10-22 한국 시간.
**신규 그림 검수가 아니라 현행 출입 동작·제작 기준 조사 결과다.**

## 결과

| 검사 | 결과 | 한계 |
| --- | --- | --- |
| `npm run typecheck` | 통과 | 게임 소스 변경 없음 |
| `npm run build` | 통과 | 별도 `/tmp/goei-pixellab-doors-round2-build`에서 실행. 릴리스/HTML 커밋 없음 |
| `node --test tests/hub-doors.test.mjs tests/hq-layout.test.mjs tests/hq-walls.test.mjs` | 3개 파일 통과 | 문 앞 상태를 구성하는 회귀 검사와 전체 보행은 다름 |
| Chromium 1280×720 | 실제 키보드로 office → f2 → office 왕복 통과 | 아래 지정 경로 한 곳 |
| Chromium 844×390 | 같은 왕복 통과 | 작은 viewport에서 키보드 입력. 모바일 터치 검증 아님 |
| 기존 컷 지연 fixture | 3컷 순서·자막 대기·중복 draw 방지·skip 1회 통과 | 합성 이미지 fixture, 실제 영상 원본의 매끄러움 검증 아님 |
| PixelLab 생성 | 실행하지 않음 | 연결된 도구/계정 인증 확인 불가 |

문 열기 무반응을 실제로 재현하려 했지만 이 기준 커밋의 첫 출입 경로에서는 재현되지 않았다. 생성 도구가 없는 상태에서 억지로 게임 코드를 수정하지 않았다. 새로운 문 그림·열림 상태의 품질 결함을 검증했다는 뜻도 아니다.

## 실제 보행 재현

기존 `tests/door-video-browser.mjs`를 별도 복사하여 screenshot 경로를 변경하고 왕복/viewport 검사를 추가했다. `goto()`, `jump()`, `movePlayer()`로 출입을 우회하지 않았다. `__goeiStory.skip()`은 첫 연출만 건너뛴다.

1. 새로 시작 → 첫 연출 건너뛰기 → `hq:office` 및 blocking 해제 대기.
2. `ArrowUp`으로 y≤486 → `ArrowRight`로 x≥`office.out.x+78` → `ArrowDown`으로 y≥676 → `ArrowLeft`로 x≤`office.out.x+20`.
3. E 1회 → `hq:f2` 확인. 실제 도착 `(1364,486)`.
4. 오른쪽 400ms 이동으로 입력 재개 확인 → 왼쪽으로 x≤1384까지 복귀 → E 1회.
5. `hq:office` 도착 `(3255,676)` 확인. 양 viewport에서 pageerror 없음.

실행에 사용한 임시 스크립트/원시 로그/화면은 아래에 있다. 저장소에 HTML·기존 캐릭터 스크린샷을 새 자산으로 추가하지 않았다. 임시 파일은 이 세션의 로컬 증거이며 영구 호스팅 URL이 아니다.

- `/tmp/pixellab-doors-round2-review/door-video-browser.mjs`
- `/tmp/pixellab-doors-round2-review/pc-roundtrip.log`
- `/tmp/pixellab-doors-round2-review/mobile-roundtrip.log`
- `/tmp/pixellab-doors-round2-review/pc-office-exit-existing.png`
- `/tmp/pixellab-doors-round2-review/pc-corridor-existing.png`
- `/tmp/pixellab-doors-round2-review/pc-return-existing.png`
- `/tmp/pixellab-doors-round2-review/mobile-office-exit-existing.png`
- `/tmp/pixellab-doors-round2-review/mobile-corridor-existing.png`
- `/tmp/pixellab-doors-round2-review/mobile-return-existing.png`
- `/tmp/pixellab-doors-round2-build.log`
- `/tmp/pixellab-doors-round2-regression.log`

빌드 경로에는 원본 소스/의존성을 symlink로 연결하고 `release`, `dist`, `dist-test`는 연결하지 않았다. 빌드 스크립트가 출력하는 파일은 임시 경로 안에서만 생성했다. 의존성 설치는 `npm ci --ignore-scripts --cache /tmp/pixellab-doors-round2-npm-cache`; Chromium은 `/usr/bin/chromium`, Playwright는 `/opt/codex/cua_node/lib/node_modules/playwright`를 사용했다. 최초 기본 권한 fetch는 proxy 연결 오류였고 추가 네트워크 권한으로 정상 fetch했다. 최초 npm 설치는 기본 cache 쓰기 경로 오류였고 `/tmp` 전용 cache로 해결했다.

## 요청 정적 확인

`glass-n-closed.request.json`은 MCP 인자만 담는다. 96/144는 4의 배수, 각각 32 이상, 면적 13,824는 투명 허용 상한 65,536 이하, `no_background=true`. 참조 이미지/캐릭터 ID 필드는 없다. API 명세의 `image_size`와 MCP의 `width`/`height` 차이도 확인했다. 실제 PixelLab 서버 호출로 수락 여부를 확인한 것은 아니다.

## 남은 문제와 연결

- PixelLab MCP 연결, 무료 도움말 확인, 잔액/실패 차감 정책 확인이 필요하다. 준비된 JSON으로 첫 생성 1회만 진행한다.
- 결과 PNG가 없으므로 실제 alpha·문턱 위치·프레임 크기·색·시각 품질·사용자 승인은 모두 미확인이다.
- 닫힘 1장 승인 뒤 문틀/문짝 분리·열림 중간 상태·남쪽 표식의 후속 제작이 남는다.
- 현재 생성/승인 자산이 없어서 공용 연결 patch는 없다. `engine/hub.ts`의 연결 위치는 제작 기준 문서에 남겼다. 기존 공용 파일·본부 그림은 변경하지 않았다.
- 전체 본부 방의 수동 왕복·잠금 해제별 상태·모바일 터치·통합 브랜치 최신 tip은 이번 Chromium 검증 범위 밖이다.
