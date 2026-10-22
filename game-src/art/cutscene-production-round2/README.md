# PixelLab 환경 컷 round2 · 생성 전 차단 및 제작 인계

2026-10-22 (Asia/Seoul). 브랜치 `codex/pixellab-cutscene-round2`.
`origin/codex/metroidvania-run-system`을 명시적으로 fetch한 뒤
`0d43a4496bff1cdc7c0122e273a43475c9134356`에서 독립 worktree를 만들었다.

**요청한 신규 환경 컷은 미완료다.** 실제 PixelLab 호출 도구와 인증이 없고,
확인한 애니메이션 모델은 640×360 전체 화면을 지원하지 않아 생성 전에 중단했다.
대체 도구·축소·기존 그림 재활용으로 우회하지 않았다. 유료 호출 0회, 실제 차감 0회.
이 폴더는 제작 설계와 검증 인계이며 승인된 컷씬 자산 팩이 아니다.

## 공식 도구·인증·과금 확인

- 활성 도구 목록에 PixelLab 없음. 플러그인 검색 `PixelLab` 결과도 `plugins=[]`.
- 클라우드 환경의 현재 관측에서 secret, runtime variable, outbound identity 모두 없음.
  PixelLab 계정 잔액·구독은 확인하지 못했다. 비밀 파일을 찾거나 인증값을 출력하지 않았다.
- [공식 MCP 문서](https://api.pixellab.ai/mcp/docs)와
  [공식 OpenAPI](https://api.pixellab.ai/v2/openapi.json)는 공개 GET으로 확인했다.
  내려받은 문서 SHA-256은 `research.json`에 있다. `search_help`와 `get_balance`는
  호출 가능한 도구가 없어 실행하지 못했다. 생성 POST나 유료 인증 시험은 하지 않았다.

| 방식 | 공식 규격 확인 | 이번 판단 |
| --- | --- | --- |
| `create_image_pixen` | 4의 배수 치수, 면적 ≤262,144px; MCP 1 generation | 640×360=230,400px, 불투명 정지 배경은 범위 안 |
| `animate_image` / REST `animate-with-text-v3` | 한 변 ≤256px, 4–16장 짝수, 총 524,288px 이하 | 640×360 전체 화면 불가. 320×180도 가로 초과 |
| `edit_image_pixen` | 입력 각 변 ≤256px, 4의 배수; 1 generation | 새 배경의 작은 문 영역 끝 키프레임 후보만 가능 |

[공식 애니메이션 사용법·차감 표](https://www.pixellab.ai/docs/tools/animate-with-text-new)와
[API 가격표](https://www.pixellab.ai/pixellab-api)도 확인했다.
구독 generation 단위와 API USD credit 단위를 혼동하지 않는다.
전체 화면 애니메이션은 지원 밖이므로 비용 공식을 확장해 실행하지 않는다.

지원 범위 안의 **미실행 제안**은 새 640×360 정지 배경(1회), 그 배경의
128×256 문 영역 끝 장 편집(1회), 시작·끝 장을 고정한 16장 애니메이션
(예상 `ceil(128×256×16/65536)=8회`)이다. 총 **3호출, 예상 10회 차감**이며
추가 프롬프트 확장은 끈다. 호출 수와 차감 수는 다르다. 연결 후 `search_help`와
해당 계정의 정확한 견적을 확인해야 하며, 이는 현재 실제 차감 기록이 아니다.
직사각형 API USD 가격은 확인하지 못했으므로 다른 해상도 가격으로 대체하지 않는다.

문 영역을 원래 픽셀 크기 그대로 새 배경에 합성하는 방법은 전체 화면 생성과 다른
제작 방식이므로 이번에 실행하지 않았다. 문짝·문틀·빛·그림자가 모두 그 영역에
들어가야 한다. 모델이 좌표를 못 지키거나 문 형태가 틀어지면 원인 조사 후 중단하며,
프롬프트만 바꿔 같은 방식으로 다시 생성하지 않는다. 실패 과금/환불도 연결 후 확인 대상이다.

## 동작과 시각 설계

`plan.json`은 실행 입력이 아닌 **제작 계획**이다. `prompts.md`에 제출 전 요청문과
무료 도움말 질문을 보존했다. 과거 캐릭터·이전 컷씬은 신규 생성 입력으로 사용하지 않는다.

- 빈 본부 복도, 오른쪽 사무실 문이 한 번 안쪽으로 열림. 인물·손·실루엣·초상화 없음.
- 640×360 원래 픽셀, 1280×720에서 정수 2배. 벨트스크롤 옆 시점에 얕은 바닥 깊이,
  고정 카메라. 굵은 형태·2~3단계 명암·선택 외곽선. 원본 컷의 다른 시점을 그대로 복제하지 않는다.
- 팔레트 출처는 현행 `src/game/action/engine/hub.ts`의 `LOOKS.hall` 텍스트 값:
  벽 `#1f2733/#2a3544`, 나무 `#4d3a2c`, 조명 `#cfe4ff`, 바닥 `#7f8994/#76808b`.
  이것은 생성 결과의 팔레트 준수를 보장하지 않는다.
- 키프레임 1/5/9/13/16: 닫힘 → 12° → 45° → 75° → 85°.
  나머지 11장은 형태가 실제로 변하는 중간 프레임. API에 고정할 수 있는 것은 시작·끝이며
  내부 키프레임 각도는 검수 목표다.
- 총 2,400ms: 시작 400ms, 가운데 14장×100ms, 끝 600ms. 16개의 서로 다른 그림,
  동작 구간 10fps 목표. 홀드는 의도한 정지이며 복제 프레임으로 부드럽다고 주장하지 않는다.
  본편 `first_day`의 기존 `[4,4,6,4]`초나 자막 시간을 바꾸는 계획이 아니다.

생성 후 필수 검수: PNG 640×360/불투명/번호와 타이밍 일치, 디코딩 픽셀 중복 없음,
문 영역 밖 픽셀 불변, 힌지·문틀·바닥선 고정, 손잡이·문의 재질·색상 유지,
프레임별 문 열림의 연속성, 빛과 그림자가 문과 함께 변하는지 확인.
1배/2배 재생과 프레임 단위 비교, 경계 누출과 색 깜빡임 검수까지 해야 한다.
현재 새 프레임이 없으므로 이 품질 검수는 전부 미실시다.

## 실제 사용 및 회귀 검증

원본을 읽기 전용으로 분석하고 현행 `VideoPlayer`에서 `first_day` 전체를 실제 Chromium 재생했다.
기존 그림은 결함 확인용 열람에만 사용했다. 디코딩 RGBA 해시는 `research.json`에 기록했다.

| 원본 컷 | 장수 / 서로 다른 그림 | 재생 길이 | 장당 유지 |
| --- | --- | --- | --- |
| c1 | 8 / 8 | 4초 | 첫·끝 1,625ms, 나머지 125ms |
| c2 | 24 / 24 | 4초 | 166–167ms (약 6fps) |
| c3 | 36 / 36 | 6초 | 166–167ms (약 6fps) |
| c4 | 8 / 8 | 4초 | 첫·끝 1,625ms, 나머지 125ms |

브라우저에서도 첫 정지 **약 1,627ms**를 재현했다. 4컷 순서·640×360 입력·종료 1회,
콘솔 예외 없음 확인. 정지와 낮은 원본 프레임 간격은 남아 있지만, 이번 범위에서
새 런타임 결함은 찾지 못했다. 따라서 억지 런타임 변경이나 기존 timing 수정은 하지 않았다.

- `npm run typecheck` 통과.
- `npm run build` 통과. 빌드가 만든 추적 중 HTML 두 개의 변경은 되돌렸고 생성 HTML은 커밋하지 않는다.
- `node --test tests/story.test.mjs` 통과 (테스트 파일 1개).
- Chromium: 원본 첫 출근 전체 재생, 설계 HTML의 PC 1280×900 / 가로 모바일 844×390 표시 통과.
- 기존 `tests/door-video-browser.mjs`를 출력 경로만 별도 이름으로 바꾼 복사본으로 실행:
  새로 시작 → 실제 키보드로 가구를 돌아 문 앞 E → 2층 복도 이동 통과.
  컷 로딩 지연 시 화면·자막 대기, 3컷 순서, 중복 draw 제거, 로딩 중 skip 콜백 1회 통과.

검사 실행 (저장소 루트):

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm run build
node --test tests/story.test.mjs
node game-src/art/cutscene-production-round2/build-review.mjs
node game-src/art/cutscene-production-round2/verify-browser.mjs
```

Chromium 검사는 `/usr/bin/chromium`, Playwright는
`/opt/codex/cua_node/lib/node_modules/playwright`를 사용했다.
`PLAYWRIGHT_MODULE`로 Playwright 위치를 지정할 수 있다. 기존 문 회귀 스크립트는
Chromium 경로가 `/usr/bin/chromium`으로 고정되어 있다.
빌드 재실행 시 `release/demo/` 변경을 먼저 확인하고 작업자가 만든 생성물만 제외한다.

로컬 `round2-review.html`은 **미생성 상태와 동작 설계만 보여 주며 재생 가능한 신규 컷이 아니다**.
`build-review.mjs`로 재생성한다. `evidence/round2-browser.log`,
`round2-baseline-playback.json`, `round2-review-pc.png`, `round2-review-mobile.png`,
`round2-hq-door-baseline.png`는 이 작업 전용 로컬 검증 산출물이며 git에서 제외했다.
마지막 본부 스크린샷은 기존 게임 회귀 증거이지 새 컷씬이 아니다.

## 통합 담당 전달

공용 연결 패치 **없음**. 변경은 이 폴더 안의 설계·검수 도구·기록뿐이다.
`engine/`, `world.ts`, `player.ts`, `render.ts`, `stage/`, `hq/`,
`story/video.ts`, 원본 프레임과 runtime timing은 수정하지 않았다.
다른 브랜치 병합, main/공용 브랜치 push, 플러그인 릴리스 없음.

남은 일은 PixelLab MCP/API 인증과 실제 도구 연결, 무료 도움말/계정 견적 확인,
640×360 지원 경로 또는 위 부분 애니메이션 제작 방식 결정, 실제 생성과 품질 검수다.
신규 컷이 통과하기 전에는 `story/scripts/videos.ts`나 자산 패킹 경로에 연결하지 않는다.
16장 설계나 기존 Chromium 검사 통과를 신규 컷의 시각 품질 합격으로 간주하지 않는다.
