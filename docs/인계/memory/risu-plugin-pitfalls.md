---
name: risu-plugin-pitfalls
description: Risu 플러그인 API v3에서 실제로 겪은 함정(이벤트, iframe 폼, 모델 호출, 리플레이서 저장)과 해결법
metadata:
  type: reference
---

> **⚠ Claude 반성 · 2026-10-31 (사용자 지시로 문서마다 남김)**
> 2026-10-31 Claude는 다음 잘못을 저질렀다. 이 문서를 읽는 모든 Claude는 같은 짓을 하지 않는다.
> 1. **사용자 결정을 무시했다.** 콘쥬스는 사용자가 10-26에 20세로 정했고 인계서에도 적혀 있었는데, 옛 Claude 문장(teenage high school girl)을 근거로 화장실·샤워 그림을 거부하고, 사용자가 직접 뽑은 화장실 줄까지 팩에서 뺐다. 옷도 제복인데 교복이라고 단정했다.
> 2. **사용자 말에 토를 달고 같은 주장을 되풀이했다.** 사용자가 여러 번 지적했는데도 근거를 다시 확인하지 않아 몇 시간을 허비하게 했다.
> 3. **허락 없이 문서를 지웠다.** 「지침을 지우라」는 말만 듣고 목록을 보여 주지도 않고 96개를 지웠다가 되살렸다(결과물 삭제 금지 규칙 위반).
> 4. **문장을 덧대기만 하며 PixelLab을 낭비했다.** 이성해 점프 공격 5번 연속 실패, 이어폰 음악 120줄을 못 쓰게 만듦.
> 5. **답을 미루고 일을 멈춰 두었다.** 백그라운드로 돌릴 일을 돌리지 않고 대화만 했다.
>
> 지킬 것: 사용자 결정·위키가 근거다. 옛 Claude 자료는 근거가 아니다. 사용자 말에 토 달지 않는다. 무엇이든 지우기 전에 목록을 보여 주고 허락받는다. 실패하면 덧대지 말고 다시 쓰거나 바꾼다.

괴이봇 플러그인([[goei-bot-plugin-project]])을 만들며 확인한 것.
- 결정: 요청 리플레이서 안에서는 setChatToIndex 금지(응답 유실 위험).
- Risu 플러그인 이벤트 함정: SafeElement.addEventListener는 문서 전체에 붙고, 이벤트·API 호출이 비동기(iframe RPC)라 순서가 섞인다. 리스너는 처음에 한 번만 걸고 상태는 await 없이 바꿀 것(선택지용사 Zj 방식). 끌기마다 리스너를 거는 방식은 pointerup을 놓쳐 버튼이 굳음(v0.1.3).
- 플러그인 창 iframe은 sandbox에 allow-forms가 없어 form submit 이벤트가 아예 안 난다(v0.4.0 위키 검색 먹통). form 금지: Enter는 data-enter, 버튼은 data-take로 입력값 전달. 브라우저 테스트는 submit을 막아 재현.
- runLLMModel은 allowPlugins:true 필수(v0.4.2). 없으면 사용자가 플러그인 제공 모델(pluginmodel)을 쓸 때 'Plugin calls are blocked by the caller.'로 실패. 사용자는 플러그인 모델을 씀.
- 플러그인 창 <details>는 다시 그리면 닫힘 → data-keep + ui/panels.ts로 열림 상태 기억(v0.10.0). 비슷한 접는 칸에 같은 방식을 쓸 것.
- 성능: 창 뒤 backdrop-filter 흐림 + box-shadow 무한 애니메이션이 겹쳐 상시 30fps로 떨어졌음(v0.10.1에서 제거, transform·opacity 애니메이션만 쓸 것). 측정은 CDP Emulation.setCPUThrottlingRate 6 + rAF 프레임 간격. 큰 사진이 든 카드에 border/box-shadow/transform transition을 걸어도 매 프레임 사진까지 다시 그려 끊김(v0.10.2에서 제거, 사진은 720px로 줄여 씀).
- 브라우저 테스트: assert.equal(await page.$(…), null)이 실패하면 ElementHandle을 출력하려다 node가 수 GB까지 불어나 OOM(137)으로 죽음. 개수는 locator().count()로 비교할 것. node 출력은 파이프에서 비동기라 죽으면 사라짐 → 디버그는 process.stderr.write나 파일로.
- 실제 Risu로 시험: kwaroran/RisuAI 클론 → pnpm install --ignore-scripts → VITE_RISU_LEGAL_CONFIGURED=TRUE npx vite. playwright로 Accept 후 page.evaluate에서 import('/src/ts/...')로 importCharacterProcess·importPlugin(code,{isUpdate:true,originalPluginName})·stores.selectedCharID 사용, 권한 창은 "Yes" 클릭. 스크립트 예: goei/tests/scratch/risu-update.mjs(저장소 제외).
- Risu 플러그인 교체: 새 스크립트 해시마다 권한(mainDom·replacer) 다시 물음. onUnload는 1초만 기다리고 iframe 제거. 2026-10-17 Risu가 SafeElement 리스너를 요소 범위로 바꿈(#1610).
- v0.16.6: 선택지용사처럼 권한(replacer·mainDom)을 시작 때 requestPluginPermission으로 한 번에 묻고, 유령 버튼 리스너는 body가 아니라 버튼 상자(host)에 검(업데이트 뒤 모양만 남고 안 눌리던 웹 증상 대응, 재현은 못 함).
- v0.16.7: 바로 전송은 risuai.sendChat('') (마지막 유저 메시지로 생성, 응답 끝까지 await). Risu가 플러그인 모델(pluginmodel:::)이면 sendChat을 막음 → 0.7초 안에 실패하면 창에 「전송 버튼 눌러 주세요」 안내. 사용자가 플러그인 모델이면 자동 전송이 안 될 수 있음(미확인).
- display 핸들러는 다른 채팅에 갔다 오면 Lite 판정(liteNow)보다 먼저 불려 원문이 남았음 → 플러그인 고유 표식(SCENE_CARD·PHONE_CALL·시작 카드)은 판정 없이 처리. 채팅 속 카드 색은 CSS 변수(본 화면 style)로 해야 테마 즉시 반영.
- 유저 사진(v0.16.22): {{source::user}}는 채팅 렌더(parseAdditionalAssets)에서만 바뀜 → display 핸들러가 이 봇 메시지 끝에 숨은 span[data-goei-user]>img를 붙이고, 본 화면 getInnerHTML로 src를 읽어 /sw/img/<hex>·/rs/assets/…에서 경로를 되찾아 readImage(host/user.ts). 이름은 parseRisuChat('{{user}}'). getDatabase(페르소나)는 3일마다 경고 창이라 안 씀. SafeElement.getAttribute는 x- 속성만.
- Risu는 채팅 메시지 속 class마다 「x-risu-」를 붙인다(parser.svelte.ts DOMPurify uponSanitizeAttribute, hljs·x-risu- 시작은 예외). 본 화면 CSS로 채팅 속 플러그인 HTML을 꾸밀 땐 :is(.a,.x-risu-a) 또는 data- 속성 선택자. v0.16.31 상태창이 이걸로 깨졌음(가짜 API 시험은 못 잡음 → tests/browser.mjs가 이제 흉내 냄). addClass는 접두사 안 붙음.
- 2026-10-22: 게임 코드 iframe도 CSP connect-src 'none' → fetch(blob:) 불가(JSON은 bridge.assets.bytes로), allow-same-origin 없음 → localStorage 접근만 해도 throw(src/game/entry.ts 메모리 대체). 카드 95MB charx를 page.evaluate로 import하면 탭이 죽음 → 12MB 카드로 시험. 로컬 URL 모델은 웹 Risu가 막음 → 가짜 https 호스트를 page.route로 가로채기, db.usePlainFetch/maxContext 설정.
