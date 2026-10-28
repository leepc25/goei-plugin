# QC 06 · 저장소 전체 정적 감사 · 성능 · 보안 · Risu 호환 · 최적화

- 판: 0.17.8 (버전은 올리지 않음), 브랜치 `worktree-agent-a40dbeac6ec6c0ae7`, 2026-10-28
- 앞 요원(사용량 한도로 중단)이 커밋 2개(d9b04c0e, 7dff09af)를 남겼고, 미커밋 수정(전역 상태 캐시)을 이어받아 완성했다.
- 브라우저 시험 fixture: 경량 카드 `lite.charx` → `tests/make_fixture.py` 로 만든 `fixture.json` (공통 지시서의 경로).

## ① 점검한 항목 전체 표

| 항목 | 경우 | 방법 | 결과 |
|---|---|---|---|
| Risu API 선언 대조 | 코드가 부르는 `risuai.*` 45종 | grep 목록 ↔ `src/risuai.d.ts` 선언 대조 | 전부 선언됨 (선언 밖 내부 API 없음. `risuFetch` 는 있을 때만 쓰는 옛 경로로 타입 우회, 없으면 nativeFetch) |
| SafeElement 속성 | 본 화면(getRootDocument) 요소의 setAttribute/getAttribute | grep (host/·main·body) + 가짜 SafeElement 가 `x-` 아니면 던짐 (모든 브라우저 시험) | x- 아닌 속성 0건, 시험 중 예외 0 |
| SafeElement 이벤트 | addEventListener 가 document 전체에 걸림 | overlay 클릭은 좌표 hit 판정 (chatclicks.ts) | 맞게 씀. 성능 시험에서 리스너 누적 없음 |
| form 제출 | iframe 에 allow-forms 없음 | 모든 입력은 data-take·data-enter·data-submit 리스너, 시험 틀은 submit 을 막아 둔 상태로 통과 | 제출 의존 0 |
| eval·new Function | 전체 src | grep | 0건. 본체 실행은 nonce 붙인 `<script>` (loader/body.ts) |
| blob URL | 7곳 | 쓰임 확인 | 전부 플러그인 iframe 안의 그림·내보내기 파일용. 본 화면으로 넘기지 않음 → 허용 (결정 1) |
| try/catch 없는 risuai 호출 | 비게임 src 88곳 | TypeScript AST 스크립트(호출이 try 안인지·.catch/.then 이 붙었는지) | 대부분 호출자에서 잡힘(본체 요청 단계는 `.catch(step)`). **시작기 top-level 등록 4곳은 하나가 던지면 시작기 전체가 멈춤 → 버그 4** |
| innerHTML 전수 | 비게임 34곳(+본 화면 setInnerHTML 1) | 앞 요원의 `tests/qc-static-xss-browser.mjs` 29곳·display 9건에 `<img onerror>`·`<svg onload>`·`$&` 주입 | 전부 글자로만 남음 (재실행 PASS) |
| String.replace 치환 패턴 | 모델·사용자 글이 치환 문자열로 들어가는 곳 | 앞 요원 7dff09af | 6곳 함수 치환으로 수정됨 (버그 1) |
| 외부 fetch 응답 검증 | 본체 조각, 카드 업데이트 조각, 사진, 게임 팩 | 코드 확인 | 본체: 판·전체 길이 확인, 사진: SHA-1 지문 확인, 게임 팩: 지문. 본체는 해시 확인 없음 → 개선 제안 |
| JSON.parse 예외 | 비게임 62곳 중 try 밖 11곳 | AST | 7곳은 직접 만든 JSON 복제·정렬, 4곳은 「던지는 파서」(호출자가 잡음). 문제 없음 |
| 번들 분석 | 시작기·본체 | esbuild metafile (일회용 스크립트) | 시작기 10.2KB(입력 5개), 본체 3.40MB(입력 187개). 큰 순서: anomalies.json 558K, greetings.json 395K, style.css 252K, agents.json 215K, pictures.json 94K. minify 해도 2.83MB(-17%) |
| 본체 시작 시간 | 시작기 주입 → 플로팅 버튼 보임 | qc-static-perf-browser | 시작기 등록 9~49ms, 본체 실행·start·첫 감시까지 409ms |
| display 처리기 1000건 | 평문·상태창·이미지+상태창·다른 봇 글 섞어서 | qc-static-perf-browser + CDP 프로파일 | **수정 전 2134~4094ms (상태창 한 건 2.2ms, 그중 음력 계산이 대부분) → 수정 후 48ms** (최적화 1) |
| 1초 감시 루프 비용 | 가만히 10초 | 가짜 risuai 호출 수 | 10초에 getCurrentCharacterIndex 10·getCurrentChatIndex 10·본 화면 querySelector 10 = 초당 postMessage 3번. 캐릭터 전체는 캐릭터가 바뀔 때만 |
| CSS 재주입 | 창 열고 닫기 100번 | `<style>` 개수 | 3 → 3 (재주입 없음) |
| savePrefs 빈도 | 열고 닫기 100번, 채팅 전환 100번 | pluginStorage `goei:prefs` setItem 횟수 | 둘 다 0 |
| heap·DOM·리스너 | 열고 닫기 100번 / 채팅 전환 100번 | CDP GC 뒤 JSHeapUsedSize·Nodes·JSEventListeners | 9.7→10.1MB / 10.1→10.2MB, 노드 521 고정, 리스너 80 고정 (누수 없음, 결정 2) |
| strict 추가 옵션 | noFallthroughCasesInSwitch · noImplicitReturns · noUnusedLocals · noUnusedParameters 등 | `tsc --noEmit --<옵션>` | 실제 버그 없음 (fallthrough 1건은 주석 달린 의도, implicitReturns 25건은 게임 AI·이벤트 처리기). 죽은 코드 목록은 ⑤ |
| 버그 숨기는 catch | `.catch(() => …)` 68곳, catch 블록 208곳 | 목록 + 요청 조립 단계 | 본체 요청 조립 9단계가 까닭 없이 삼켜졌다 → 로그 남김 (버그 6) |
| 로그 없는 void Promise | 비게임 89곳 | AST(type checker 로 Promise 판정) | 클릭·Enter·Esc·끌기 콜백의 `void handle()` 30곳 → `run()`(실패 로그) (버그 6) |
| 해제 누락 | 감시 루프·설치 훅·리스너 | onUnload·stopWatcher 확인, 리스너 수 측정 | 누락 없음 (removeEventListener 는 Risu SafeElement 가 무시하므로 리스너를 한 번만 검) |
| 채팅 전환 때 전역 상태 | 같은 봇의 채팅 A↔B, 지침 편집 | qc-static-cache-browser (재현 후 수정) | **버그 2·3** |
| 빌드 재현성 | 같은 커밋 두 번 빌드 | dist 78개 파일 sha256 비교 | 완전히 같음 |
| 플러그인 머리 주석 | @name·@display-name·@api·@version·@update-url | d.ts 머리 규격 대조 | 맞음 (@update-url 은 raw.githubusercontent: CORS·Range 지원) |
| charx 규격 | 경량 카드 | zip 검사 스크립트 | chara_card_v3 / 3.0, card.json+module.risum, 에셋 1752(icon 1), embeded:// 경로 빠짐 0, 이름 중복 0, 압축 방식 정상, 93.5MB |
| README 대 실제 | 설치·업데이트·개발 절 | 코드·파일 대조 | 틀린 곳 5 → 고침 (⑥) |
| 시험 인프라 | skipped 15, fixture 없던 브라우저 시험 | 실행 | skipped 15 → 0 (앞 요원 d9b04c0e). 새 브라우저 시험 4개는 공통 fixture 규약(`<fixture.json>`)을 따름 |

## ② 발견한 버그

| # | 증상 | 원인 | 수정 커밋 | 시험 |
|---|---|---|---|---|
| 1 | 상태창 태그·입력 글에 `$&`·`$'` 가 있으면 원문 태그가 두 번 들어가거나 뒷글이 끼어듦 | `String.replace(x, 글)` 의 치환 패턴 해석 (6곳) | 7dff09af (앞 요원) | tests/qc-static-replace.test.mjs, qc-static-xss-browser display #8 |
| 2 | 같은 봇 안에서 채팅만 바꾸면 앞 채팅의 배색·상태창 칸 구성(숨긴 칸)·시작 안내가 그대로 | 감시 루프가 「버튼 보임/숨김이 바뀔 때」만 readTheme·refreshStatusContext·refreshOpeningHint 를 불렀다 | 97c19e01 (body.ts startWatcher: 캐릭터:채팅 번호가 바뀌면 다시 읽음) | qc-static-cache-browser 2절 (수정 전 `'paper' !== 'light'` 로 실패 확인) |
| 3 | 지침(괴담넷·괴담톡·위키 MAIN_CONTEXT)을 고쳐도 캐릭터를 바꿀 때까지 옛 규칙이 본편 요청에 들어감 | `rulesCache` 가 캐릭터 번호만 보고 규칙 글까지 기억. 규칙은 이 기기 지침(prefs)에서 온다 | 97c19e01 (캐시는 등록부만, 규칙은 요청마다. 로어북 저장·설치 때 캐시 비움 `onLoreSaved`) | qc-static-cache-browser 1절 |
| 4 | 편집 창 「지침」 절 글칸에 써도 초안이 안 쌓이고 「지침 저장」이 계속 꺼져 있음 (지침 편집이 사실상 불가능) | 입력 처리 순서에서 `recordInput` 이 열쇠 `GNet|0` 을 「종류|이름」으로 읽다 없는 종류로 `worldRecords` 가 TypeError → 뒤의 guideInput 까지 안 감. 단추 disabled 도 그릴 때만 정해짐 | 97c19e01 (ui/editor/record.ts 이름 확인 먼저, ui/editor/index.ts 입력 뒤 단추 켬) | qc-static-cache-browser 1절 (CDP 로 스택 확인 `worldRecords ← recordInput`) |
| 5 | Risu 가 처리기 등록 하나를 거부(권한 거부·옛 Risu)하면 시작기 top-level await 이 멈춰 표시·응답 처리기와 감시가 모두 안 켜짐 | main.ts 의 등록 4줄이 try 없이 연속 await. 떼기(onUnload)도 하나 실패하면 나머지 안 뗌 | 7b0470f2 (하나씩 걸고 실패는 로그) | qc-static-risu-browser (수정 전 시작기로 실패 확인: `addRisuReplacer 거부에도 시작기가 끝까지 돈다`) |
| 6 | 조작이 실패해도 아무 흔적이 없음 / 요청 조립 단계(로어북·막간·참고 기록 등)가 실패하면 왜 빠졌는지 모름 | 리스너의 `void handle()` 30곳, onBeforeRequest 의 `.catch(() => messages)` 9곳 | 97c19e01, 7b0470f2 (`run()` 이 `[goei] 조작 실패(…)` 로그, 단계별 `[goei] 요청 조립 … 실패`) | 동작은 같음(로그만). typecheck·전체 시험 |
| 7 | (안전망) 본체 display 가 던지면 Risu 메시지 그리기가 막힐 수 있음 | main.ts onDisplay 에 예외 처리 없음 | 7b0470f2 (원문 반환 + 로그) | 1000건 퍼즈에서 예외 0, 회귀 없음 |

## ③ 최적화

| 항목 | 전 | 후 | 근거 |
|---|---|---|---|
| 상태창 그리기 (새 날짜) | 2.19ms/건 | 0.11ms/건 | CDP 프로파일: 500건에 `lunar()` 1018ms. 대체공휴일 판정이 하루에 같은 날을 30번쯤 다시 묻고 매번 `Intl.formatToParts`. 날짜별 기억(최대 4096, 넘치면 비움). 결과 같음 (tests/calendar.test.mjs 통과) |
| display 1000건 (혼합) | 2134~4094ms | 48ms | 위 수정의 결과 (qc-static-perf-browser) |

적용하지 않은 것: 본체 minify(-17%, 3.40→2.83MB)는 이득이 작고 오류 위치·릴리스 diff 가 나빠져 보류 → 개선 제안.

## ④ 스스로 내린 결정

1. 결정: blob URL 은 그대로 둔다. 근거: 7곳 모두 플러그인 iframe 안 `<img>`·내보내기 다운로드용이고 본 화면 DOM 으로 넘기지 않는다. Risu 가 막는 것은 blob 으로 **스크립트**를 실행하는 것(README·loader/body.ts 주석)이다.
2. 결정: 첫 성능 시험에서 보인 「열고 닫기마다 DOM 242개·리스너 5개 누적」은 버그가 아니다. 근거: 힙 스냅숏 보유 경로가 `(Global handles) / DevTools console` — Playwright `page.click`·`waitForSelector` 가 잡은 요소 핸들이었다. 페이지 안에서 직접 누르면 노드 521·리스너 80 으로 고정. 시험을 그렇게 고쳤다.
3. 결정: 본체 요청 처리기(onBeforeRequest)의 예외 안전망은 넣지 않았다. 근거: 실패 시 표식이 남은 원문을 보낼지 요청을 막을지는 요청 조립 영역(영역 2) 결정이고, 그 영역이 같은 함수를 고치고 있다. 이번엔 단계별 `.catch` 에 로그만 붙였다(동작 같음).
4. 결정: 지침 규칙 글을 캐시하지 않는다(매 요청 다시 읽음). 근거: 지침 3개 절 읽기는 문자열 정규식 몇 번이라 비용이 작고(display 측정 범위에서 보이지 않음), 캐시 무효화 경로를 늘리는 것보다 안전하다. 등록부(로어북 1MB에서 만듦)만 캐릭터별 캐시 + 로어북 저장 시 비움.
5. 결정: 채팅 전환 감지는 `WatchState.update` 반환 모양을 바꾸지 않고 body.ts 감시 루프의 지역 변수로 했다. 근거: core.test.mjs 가 반환 모양을 deepEqual 로 고정하고 있고 버튼 보임/접속 효과 판정은 그대로여야 한다.
6. 결정: `tests/qc-static-cache-browser.mjs` 의 날씨 칸 판정을 고쳤다(앞 요원 초안). 근거: `gst-wx` 칸에는 날씨 아이콘과 기온이 함께 들어 있어 날씨를 숨겨도 기온 때문에 칸이 남는다. 「☀️ 가 없고 4°C 는 있음」으로 판정.

## ⑤ 고치지 못했거나 사용자 확인이 필요한 것

- `tests/browser.mjs` 15절(이동 지시문 요청 길이)부터 실패 (`4 !== 2`, 838행). 1~14절 통과. 요청 조립이 바뀐 탓으로 영역 2(요청) 쪽 확인 필요 — 시험이 틀렸는지 코드가 틀렸는지 이 영역에서 판정하지 않음.
- `release/goei-game-patrol.pack`·`goei-game-action*.pack` 은 지금 코드 어디서도 안 씀(게임 팩은 `release/game/`). release 폴더는 손대지 않음 — 릴리스 때 정리할지 결정 필요.
- 게임 영역(src/game/) 죽은 코드·의심: `hq/view.ts` `const can = canDeploy(s, id)` 를 계산만 하고 단추에 안 씀(부상 요원 선택 가능?), `stage/module.ts`·`plan.ts`·`touch.ts` 미사용 지역 변수. 영역 밖이라 보고만.
- 비게임 죽은 import/선언(동작 영향 없음): body.ts `readManifest`, ui/app.ts `WorldState`·`isMarked`·`agentInner`·`CARD_FILE`·`openWikiSettings`, ui/editor/index.ts `WORLD_KIND_LABEL`·`GUIDE_NAMES`·`crumb`, ui/gnet·phone·wiki `saveVarDefaults`, ui/settings `gnetLabel`·`keepOpen`, core/world/catalog `strList`·`worldRows`, registry `list`·`json`, virtual.ts `dir0`(readDirectory 결과를 버림 — 같은 배열 캐시를 데우는 효과만), ui/field `placeName`, ui/directory `SIDO_NAME`. 여러 영역 파일이라 합칠 때 충돌을 피하려고 지우지 않음 (개선 제안 1).
- 실제 Risu 에서 처리기 등록 거부가 어떤 모양(던짐/false)인지는 가짜 환경으로만 재현했다.

## ⑥ README 고친 곳

- 설치 2: 「확인 창 두 개」 → 권한 확인 창(요청 처리·본 화면·채팅 보내기, main.ts 가 3개를 묻는다) 모두 허용
- 「순찰 게임 그림(goei-game-patrol.pack)」 → 게임 코드 `game/goei-game.N.txt`·그림 팩 `game/*.pack`
- 카드 업데이트 경로: 설정 → **점검** → 업데이트 (편집 창 탭 이름)
- 개발: 지워진 「1인 전투 검증판·tests/game/action.html」 → 게임 본체 README·`release/demo/`
- `npm run build` 결과물에 `dist/game/`·`dist-test/real-module.json` 추가

## ⑦ 개선 제안 (적용하지 않음)

1. **죽은 코드 정리 PR 하나**: ⑤의 미사용 선언 ~45개(비게임 26)를 영역 합친 뒤 한 번에 지우고 `tsconfig` 에 `noUnusedLocals: true` 를 켠다 (지금 켜면 44건 오류). `noFallthroughCasesInSwitch` 는 1건(의도된 nav-tab→tab)에 `// falls through` 대신 명시 분기로 바꾸면 바로 켤 수 있다.
2. **본체 무결성 확인**: `goei-body.json` 에 sha256 을 넣고 시작기가 `crypto.subtle.digest` 로 확인. 지금은 길이·판만 본다(사진은 이미 지문 확인). 중간 프록시가 같은 길이로 깨뜨린 조각을 걸러 낸다.
3. **브라우저 시험 한 번에 돌리기**: `npm run test:browser` 가 browser.mjs 하나만 부른다. `tests/make_fixture.py` 로 fixture 를 만들고 `tests/*-browser.mjs` 를 모두 도는 스크립트(`scripts/test-browser.mjs`)를 두면 「fixture 가 없어 안 돈 시험」이 없어진다. 공용 가짜 risuai 도 `tests/browser.mjs` 와 `qc-static-harness.mjs` 둘로 갈라져 있으니 하나로.
4. **성능 회귀 감시**: `qc-static-perf-browser.mjs` 의 display 1000건(지금 48ms)에 상한(예: 500ms)을 두고 CI 에 넣기.
5. **요청 처리기 안전망**: 본체 beforeRequest 가 던질 때의 정책(원문 그대로 보냄 vs 요청 중단)을 정해 시작기에서 일관 처리 (영역 2와 합의 필요).
6. **본체 크기**: 데이터 JSON(세계 기록 879K·설치 인사말 395K)을 게임 팩처럼 따로 받는 팩으로 빼면 본체가 절반 가까이 준다. 처음 받기·pluginStorage 용량에 이득. minify 는 -17% 뿐이라 비추천.
7. **감시 루프**: 초당 postMessage 3번(캐릭터·채팅 번호·채팅 화면 확인). 창이 숨겨진 동안(`document.hidden`)엔 간격을 늘릴 수 있다 — 측정상 부담은 작아 우선순위 낮음.

## ⑧ 실행한 시험 명령과 결과

| 명령 | 결과 |
|---|---|
| `npm run build` (두 번, dist sha256 비교) | 성공, 78개 파일 완전히 같음 |
| `npm run typecheck` | 통과 |
| `npm test` | 647 통과 · 0 건너뜀 · 0 실패 (기준선 630·15 건너뜀 → 실제 카드 시험 15개 켜짐 + 새 시험) |
| `node tests/qc-static-cache-browser.mjs <fx>` | PASS 2 (지침 편집→다음 요청, 채팅 A↔B 배색·칸 구성) |
| `node tests/qc-static-perf-browser.mjs <fx>` | PASS. bootMs 9~49, fabVisibleMs 409, display1000Ms 48, 가만히 10초 API 30회, 열고 닫기 100번 heap 9.7→10.1MB·노드 521→521·리스너 80→80·style 3→3·prefs 저장 0, 채팅 전환 100번 heap 10.1→10.2MB·prefs 저장 0 |
| `node tests/qc-static-risu-browser.mjs <fx>` | PASS 3 (등록 3종 각각 거부) |
| `node tests/qc-static-xss-browser.mjs <fx>` | PASS (display 9건, 창 29곳) |
| `node --test tests/qc-static-replace.test.mjs` | 2 통과 |
| `node tests/editor-browser.mjs <fx>` | PASS 2 |
| `node tests/install-browser.mjs <fx>` | PASS 1 |
| `node tests/browser.mjs <fx>` | 1~14절 PASS, 15절 실패(⑤, 영역 2) |
| `tsc --noEmit --noFallthroughCasesInSwitch / --noImplicitReturns / --noUnusedLocals / --noUnusedParameters / --noImplicitOverride / --exactOptionalPropertyTypes / --noUncheckedIndexedAccess` | 1 / 25 / 44 / 23 / 20 / 252 / 1570 건 (뒤 둘은 잡음 수준이라 판정 제외) |
