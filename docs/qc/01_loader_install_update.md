# QC 보고 · 시작기 · 본체 로딩 · 설치 · 업데이트 · 카드 빌드·릴리스 도구 (2026-10-28)

범위: `src/main.ts`, `src/loader/{body,card,panel}.ts`, `src/body-entry.ts`, `src/body.ts`(start·redrawAfterLoad·startWatcher), `src/core/watch.ts`, `src/host/{install,prefs,picpack,container,hooks,overlay,assets}.ts`, `src/core/{install,update,pictures,sharedpics,asset,tokenizer}.ts`, `src/ui/{update,editor/install,editor/manage}.ts`, `scripts/build.mjs`, `tools/build_lite_card.py`, `tests/verify_lite_card.py`, `.github/workflows/release.yml`, `release/`, `package.json goei.*`, `src/risuai.d.ts`.

실제 Risu 동작을 알기 위해 RisuAI 저장소(`kwaroran/RisuAI`, 2026-10-23 커밋)를 읽어 `src/ts/plugins/apiV3/{v3.svelte.ts,factory.ts,pluginPermissionCache.ts}`, `src/ts/process/{pluginStorageStore.ts,coldstorage.svelte.ts}`, `src/ts/plugins/pluginSafeClass.ts` 와 대조했다.

## ① 점검한 항목

| 항목 | 경우 | 방법 | 결과 |
| --- | --- | --- | --- |
| 시작기·받기 | 본체 저장 없음 → 괴이 카드 → 목록+조각 17개 받기 → 저장 → 실행 → 플로팅 버튼 | `tests/qc-loader-browser.mjs` 1 (sandbox iframe + nonce CSP, eval·blob 막힘) | 통과. 받기 18회, 저장 길이 = 본체 길이 |
| 시작기·받기 | 받은 뒤 이미지 태그가 있는 괴이 채팅을 한 번 다시 저장(redrawAfterLoad) | 같은 시험 1 | 통과 (setChat 1회) |
| 시작기·감시 | 본체가 뜨면 시작기 감시는 멈추고 본체 감시만 1초마다 | 같은 시험 1 (getCurrentCharacterIndex 호출 수) | 통과 |
| 시작기·받기 실패 | 404 → 받기 창(fullscreen), 버튼 없음 | 시험 2 | 통과 |
| 시작기·재시도 억제 | 실패 뒤 1분 안 표시·요청으로 다시 받지 않음, 1분 뒤(Date.now 조작) 조용히 다시 시도, 창은 하나 | 시험 2 | 통과 |
| 시작기·다시 받기 | 조각 하나 404 · 목록 판 불일치 · 조각 잘림(길이) · 글자 바뀜(지문) · 성공 | 시험 2 | 통과. **지문 검사는 새로 넣음(버그 2)** |
| 시작기·파일로 넣기 | 다른 판 · 깨진 파일(실행 안 됨) · 맞는 판 | 시험 3 | 통과. **깨진 파일은 창을 유지하고 까닭 표시(버그 1)** |
| 시작기·닫기 | 창 제거·hideContainer, 표시만으로는 다시 안 뜸, 다른 봇에 갔다 돌아오면 다시 창 | 시험 3 | 통과 |
| 시작기·저장 본체 깨짐 | 판은 맞는데 실행 안 되는 저장 본체 → 지우고 받기 창에 까닭 → 다시 받기 | 시험 4 | 통과 (**버그 1**) |
| 시작기·저장 실패 | setItem 이 QuotaExceeded 로 실패 → 받은 본체로 그대로 뜸, 다음에 다시 받음 | 시험 5 | 통과 (**버그 3**) |
| 다른 봇 | 받기·표시·요청 손질·버튼 전부 없음(햄버거 설치 단추만) | 시험 6 | 통과 |
| 봇 전환 | 다른 봇 → 괴이 카드: 받기·버튼·접속 효과 / 괴이 → 다른 봇: 버튼 숨김 / 다시: 접속 효과 | 시험 6 | 통과 |
| 언로드 | 처리기 4개 해제, 버튼 제거, 감시 멈춤. 햄버거·채팅 단추는 Risu 가 플러그인 언로드 때 스스로 지움(`addPluginUnloadCallback`) | 시험 7 + Risu 소스 | 통과 |
| mainDom 거부 | 채팅 메뉴 단추로 대체, **감시가 돌아 liteNow 판정·요청 손질이 됨** | 시험 8 (권한 있음/없음 결과 동일) | 통과 (**버그 4**) |
| risuFetch | 옛 길이 있으면 그 길로만 받음 | 시험 9 | 통과 |
| CSP·nonce | 모든 시험이 Risu factory.ts 와 같은 CSP(`script-src 'nonce-…'`, connect-src none)의 sandbox srcdoc 안에서 돈다. `document.querySelectorAll('script')[].nonce` 로 nonce 를 얻어 inline script 실행 | 시험 전체 | 통과 |
| pluginStorage 용량 | 본체 3.16M자 + 위키 묶음 0.97M자 + 토크나이저 2.33M자 = 6.15M자. 게임 코드 2.09M자, 게임 팩(base64) 9.12M자(jr-field 5.54) → 전부 받으면 약 17.4M자. Risu 는 256KB 넘는 값을 저장 데이터 밖 cold storage 에 압축해 따로 두므로(pluginStorageStore largeThreshold 256KB, indexBudget 8MB) 저장 파일이 커지지 않음. setItem 실패는 `Failed to write plugin storage item` 예외 | 시험 10 MEASURE + Risu 소스 | 통과 |
| 설치(깡통봇) | 햄버거 단추 → 패널+설치 창 → 로어북·인사말·봇 이름·사진 1,751장·아이콘·위키 묶음·토크나이저 → 점검 전부 ✓ → 두 번째는 로어북만 다시 맞춤(받기 없음) → 설정 내보내기의 저장소 사용량 → 상태 점검 o200k_base → 이전 아이콘으로 → 창 닫으면 플로팅 버튼 | 시험 10 (3~4초) | 통과. **저장소 사용량의 게임 팩 키 오류(버그 5)** |
| 설치·부분 실패 | 사진 지문 불일치(보안 컨텍스트, sha1) → 첫 묶음부터 실패, 카드 사진 0장, 다른 단계 계속 / 지문 못 내는 환경 + 두 번째 묶음 404 → 100장까지 저장, 「100/1751장까지」 안내 / 고치고 다시 누르면 1,651장 이어서 | 시험 11 | 통과 |
| 설치된 카드 | 점검 화면(빠진 것 2개: 위키·토크나이저), 사진·인사말은 안 건드림, 지우기 → 어림값·없음 | 시험 12 | 통과 |
| 토크나이저·위키 다시 읽기 | 저장소에 있으면 본체가 뜰 때 올림(받기 없음), 깨진 값은 어림값·없음 | 시험 13 | 통과 |
| 업데이트 | 새 버전 안내·점·건너뛰기 기억 | 시험 14 | 통과 |
| 업데이트 | version.json minPlugin 높음 → 준비 단추 없음·안내 / 받은 파일 minPlugin 높음 → 준비 실패 안내 | 시험 14 | 통과 |
| 업데이트 | 조각 404 → 안내, 계획 없음, 카드 그대로 | 시험 14 | 통과 |
| 업데이트 | 준비를 두 번 눌러도 한 번만 받음, 받는 동안 창을 닫았다 열어도 계획이 남음 | 시험 14 | 통과 |
| 업데이트·적용 | 지문 바뀐 사진·새 사진만 받음(2장), 직접 넣은 사진·로어북·고친 명부·이름·채팅 보존, 첫 안내 바뀜, **옛 자리 항목 4개 제거(결정 2)** | 시험 14 | 통과 |
| 업데이트·사진 실패 | 사진 하나라도 못 받으면 카드도 안 바꿈(setChar 1회뿐) | 시험 14 | 통과 |
| 플로팅 버튼 끌기 | 리스너가 요소에만 걸리는 2026-10 Risu / 문서 전체에 걸리는 옛 Risu 둘 다: 상자를 벗어나도 끌림, 놓으면 자리 저장, 그냥 누르면 창, 버튼 밖 누르면 안 열림 | 시험 15 | 통과 (**버그 6**) |
| 카드 빌드 | `tools/build_lite_card.py` → `tests/verify_lite_card.py` 19항목 | 직접 실행 | 전부 PASS. 결과 card-update.json·조각 3개·version.json·wiki-base·icon.png·pic 1,751장이 `release/` 와 sha 동일 |
| release = dist | goei-plugin.js·goei-body.json·조각 17개·tok-o200k·game/ 전부 sha 동일(0.17.8) | sha256 대조 | 동일 (이번 QC 수정 전 기준. 수정 뒤 dist 는 당연히 다름 → 릴리스 때 복사) |
| 빌드 재현 | `npm run build` 두 번 → dist 전체 sha 동일 | sha256sum diff | 동일 |
| 조각 왕복 | 본체·게임 코드·팩·토크나이저·위키 조각 이어 붙이기 = 원본, 조각마다 200KB(팩 512KB) 이하, 서로게이트 쌍 안 가름, 길이·지문 | `tests/qc-loader-build.test.mjs` | 통과 |
| release 짜임새 | 시작기 //@version = goei-body.json 판 = 본체 첫 줄 = version.json = card-update.json = game/index.json | 같은 시험 | 통과 |
| release.yml | npm ci → build → 카드 빌드 → zip(플러그인+본체+카드) → 릴리스 생성/갱신. version.json 변경 때만 | 읽기 | 문제 없음 |
| risuai.d.ts | 상류 최신과 diff: 주석 3곳만 다름. 쓰는 권한 이름(replacer·mainDom·sendChat)은 실제 `PluginPermission` 에 있음. `unregisterUIPart`·`onUnload`·`keys()` 실재 | diff + 소스 | 일치 |

## ② 발견한 버그 (전부 고침)

1. **저장된 본체가 깨지면 영영 안 뜸** — 판 머리줄은 맞는데 실행이 안 되는 본체(조각 한 글자 깨짐·부분 저장)가 pluginStorage 에 남으면 시작기가 매번 그 본체를 꺼내 실패하고 다시 받지 않았다(판이 바뀔 때까지). 파일로 넣기도 깨진 파일을 저장하고 창을 조용히 닫았다. 원인: `main.ts load()` 가 판만 보고 저장본을 믿고, `start()` 실패를 구분하지 않음. 수정: 코드 자체가 실행되지 않으면(`runBody` 예외) 저장본을 지우고 받기 창에 까닭을 띄움, 파일로 넣기는 실행이 된 뒤에만 창을 닫고 실패면 까닭을 창에 남김. `install()` 이 실패하면 `loading` 이 null 로 돌아가도록(전에는 null 을 주는 promise 가 남아 그 뒤 `ensure()` 가 영영 null). 시험 3·4.
2. **조각 길이만 보고 글자 깨짐을 못 잡음** — `goei-body.json` 에 `hash`(UTF-16 단위 FNV-1a) 를 넣고(`scripts/build.mjs`), 시작기가 이어 붙인 뒤 맞춰 본다(`loader/body.ts bodyHash`). 옛 release 목록(hash 없음)은 그대로 통과. 조각 이름도 `goei-body.N.txt` 꼴만 받는다. 시험 2, `qc-loader-build.test.mjs`.
3. **본체 저장 실패(QuotaExceeded)면 받았는데도 못 씀** — `setItem` 예외가 받기 실패로 처리돼 받기 창이 떴다. 수정: 저장 실패는 적기만 하고 받은 본체로 실행. 시험 5.
4. **mainDom 권한 거부 시 요청 손질이 전부 꺼짐** — `createFab` 실패 경로에서 감시(`startWatcher`)를 아예 안 돌려 `liteNow` 가 늘 false → 로어북 고르기·상태 블록·인물 기록·방문 기록 등 요청 손질과 입력 처리가 전부 건너뛰어졌다. 수정: fab 없이도 감시를 돌리고(채팅 화면 여부는 모르니 떠 있는 것으로), 채팅 단추 등록 실패도 삼킴. 시험 8.
5. **저장소 사용량 표의 게임 팩 키가 틀림** — `manage.ts STORE` 의 `goei:game-pack:action-normal-v4` 는 쓰는 곳이 없는 옛 키라 늘 「없음」. 본체(`goei:body`)·게임 코드(`goei:game:code`)도 안 보였다. 수정: 실제 키로, 게임 팩은 `pluginStorage.keys()` 에서 `goei:game:pack:*` 를 모아 합산. 시험 10.
6. **플로팅 버튼 끌기가 2026-10 Risu 에서 끊김** — 상류 Risu 가 `SafeElement.addEventListener` 를 문서가 아니라 그 요소에 걸도록 바꿨다(`v3.svelte.ts #eventTarget`, d.ts 주석 「for document-wide listening, use the SafeDocument」). 버튼 상자(48px)에 move·up 을 걸어 두면 손가락이 상자를 벗어나는 순간 끌기가 멈춘다. 수정: pointermove·pointerup·pointercancel 은 `getRootDocument()`(SafeDocument, 늘 문서) 에, pointerdown·click 은 상자에. 옛 Risu(문서 전체)에서는 동작이 같다. 시험 15 (두 방식 모두).
7. (작음) 사진 받기 일꾼 4개 중 하나가 실패해도 나머지가 남은 수백 장을 계속 받으려 했다(요청 낭비). 실패 깃발로 멈춤. `host/picpack.ts`.
8. (작음) 시작기·설치의 받기에 시간 제한이 없어 프록시가 응답을 안 주면 시작기가 조용히 죽은 채(`loading` 영영 대기), 설치 화면은 「받는 중」으로 굳었다. 40초 제한(`ui/update.ts`·`host/game/fetch.ts` 와 같은 방식). `loader/body.ts`, `host/install.ts`.
9. (작음) 아이콘 설치가 길이만 확인했다. `icon.json digest`(sha1) 도 본다(지문을 못 내는 환경이면 길이만). `host/install.ts installIcon`.

수정 커밋: 아래 ⑥ 커밋 목록.

## ③ 최적화

- 사진 받기 실패 시 남은 요청 중단(버그 7). 그 밖에 측정 가능한 이득이 있는 변경은 없음. 설치 1,751장 흉내 환경 3~4초, 저장소 6.15M자.

## ④ 스스로 내린 결정

1. **결정: 깨진 저장 본체는 지운다, 단 「코드가 실행되지 않을 때」만.** 근거: 본체는 돌았는데 `start()` 안에서 실패한 경우(권한·Risu API 문제)는 다시 받아도 같으니 지우지 않고 창에 까닭만 보인다. 코드 자체가 안 도는 것은 저장 손상이라 다시 받아야 한다.
2. **결정: 카드 업데이트에서 옛 자리 항목(`📚Lore slot · …` 4개)은 새 카드에 없으면 뺀다** (`core/update.ts renamed`). 근거: 카드가 낸 항목이지 사용자가 넣은 것이 아닌데 「직접 넣은 항목 유지」로 남아, 업데이트한 0.17 카드가 계속 옛 경로(채팅 변수로 자리 채우기)로 돌고 로어북 목록에 쓸모없는 상시 항목 4개가 남았다. 업데이트하지 않은 옛 카드는 인계서대로 옛 경로가 그대로 산다(`body.ts hasSlots`). `tests/qc-loader-update.test.mjs`.
3. **결정: 본체 저장 실패는 치명 아님.** 받은 본체로 이번 세션은 돌리고 다음에 다시 받는다(용량이 부족한 기기에서도 쓸 수는 있게). 근거: 저장은 다시 받기를 아끼는 수단일 뿐.
4. **결정: mainDom 거부 시에도 감시를 돌린다.** 채팅 화면 여부(`.default-chat-screen`)는 본 화면 DOM 없이는 알 수 없어 「떠 있음」으로 본다 → 설정 화면 같은 데서도 liteNow 가 true 로 남지만, 그 영향은 요청·입력 손질뿐이라 안전하다.
5. **결정: `release/` 와 `dist/` 가 같은지는 단위 시험으로 강제하지 않는다.** 소스를 고치면 당연히 달라지고 릴리스 때 사람이 복사하므로, 시험은 release 폴더 자체의 짜임새(판 일치·조각 왕복)만 본다. dist 대조는 이 보고서에 적었다(수정 전 기준 동일).
6. 시험 환경: 바깥 문서를 `http://127.0.0.1` 로 띄운다. `about:blank` 안의 sandbox srcdoc 은 보안 컨텍스트가 아니라 `crypto.subtle` 이 없어 사진 지문 확인이 꺼진 채 지나간다(실제 Risu 는 https·tauri 라 켜짐). 시험 10 은 지문 계산을 일부러 끄고(가짜 바이트), 시험 11 은 켠 채 불일치를 확인한다.

## ⑤ 고치지 못했거나 사용자 확인이 필요한 것

- `tests/browser.mjs` 는 main 그대로도 141줄(「시작 전에도 세계 편집 트리」, 설정 창 `ed-node agent`) 에서 멈춘다(인계서에도 적힌 별건, 설정 창 영역). 그 뒤의 시작기·업데이트 절이 안 돌므로 이 영역의 경우는 전부 `tests/qc-loader-browser.mjs` 로 옮겨 돌렸다(기존 절보다 넓음). 설정 창 영역 담당이 141줄을 고치면 뒤 절도 다시 돌려 볼 것.
- `release/` 는 고치지 않았다. 이번 수정으로 `dist/goei-plugin.js`·`goei-body.*`·`goei-body.json`(hash 추가) 이 release 와 달라졌다 → 다음 릴리스에서 복사하면 된다. 옛 release 목록(hash 없음)도 새 시작기가 그대로 받는다.
- Risu 가 `risuFetch` 를 곧 없앤다고 경고한다(deprecated). 지금은 있으면 쓰고 없으면 `nativeFetch` 로 가므로 동작엔 문제 없다. 없어진 뒤 웹 Risu 프록시 5분 캐시 문제(ui/update.ts 주석)가 다시 생길 수 있는데, 이건 실제 웹 Risu 에서만 확인할 수 있다.
- 실제 Risu 에서 플러그인 칸의 `crypto.subtle` 유무(보안 컨텍스트)는 코드로 확인한 것이 아니라 https·tauri 전제다. 없으면 사진·아이콘 지문 확인이 꺼지고 길이만 본다(기존 설계대로).

## ⑥ 실행한 시험과 수치

- `npm ci && npm run build`: 성공(두 번 빌드 sha 동일). `npm run typecheck`: 통과.
- `npm test`: 기준선 630 통과 · 15 건너뜀 · 0 실패 → 이번 추가 뒤 **637 통과 · 15 건너뜀 · 0 실패** (`qc-loader-build.test.mjs` 5, `qc-loader-update.test.mjs` 2).
- `node tests/qc-loader-browser.mjs <fixture>`: 15 절(끌기 2방식 포함 16 페이지) 전부 PASS, 약 5분. MEASURE 설치 `{"installMs":약 3000~4100,"storageChars":{"goei:body":3160333,"goei:icon":76,"goei:wikibase":967542,"goei:tok-o200k":2325547},"totalMB":6.15}`.
- `node tests/install-browser.mjs <fixture>`: PASS.
- `node tests/browser.mjs <fixture>`: 141줄에서 실패(별건, ⑤). 기준 브랜치 `claude/qc-release-2026-10-28` 를 따로 빌드해 돌려도 같은 줄에서 실패함을 확인(이 영역 수정과 무관).
- `python3 tools/build_lite_card.py card/원본_봇카드.jpeg <scratch>/lite.charx` → `python3 tests/verify_lite_card.py …`: 19/19 PASS. 결과물 sha 가 `release/` 와 동일(card-update.json·1~3.txt·version.json·wiki-base.*·icon.png·pic 1,751장).
- `src/data/install/*.json` 은 카드 빌드 뒤에도 변경 없음(git status 깨끗).

### 이어받은 요원의 재실행 (2026-10-28, 같은 worktree)

- `npm run build` 성공, 다시 빌드해 dist 78개 파일 sha256 동일(재현성). `npm run typecheck` 통과.
- `npm test`: 652 중 **637 통과 · 15 건너뜀 · 0 실패**.
- `node tests/qc-loader-browser.mjs <fixture>`: 15절(끌기 2방식 포함 17줄) **ALL PASS**. MEASURE 설치 `installMs 5474`, 저장소 6.15MB.
- `node tests/install-browser.mjs <fixture>`: PASS.
- `node tests/browser.mjs <fixture>`: 141줄 실패(기준 브랜치에서도 같음, ⑤).
- 지시서 영역 목록(시작기 받기 성공/실패/파일 넣기/다른 봇/전환/언로드/mainDom 거부/CSP, pluginStorage 용량·실패, 깡통봇 설치, 카드 업데이트 전 흐름·부분 실패·minPlugin, 토큰 순위표(o200k)·위키 팩, 카드 빌드 검증·release 와 dist 일치, 빌드 재현성)과 ① 표를 대조해 빠진 항목 없음.
