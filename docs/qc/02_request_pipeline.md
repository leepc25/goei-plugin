# QC 02 · 본편 요청·응답·표시 파이프라인 (2026-10-28, v0.17.8 기준)

범위: `src/body.ts`의 `onBeforeRequest`·`onInput`·`onOutput`·`onDisplay`/`displayNow` 와 거기서 부르는 `core/{lore,request,dispatch,statusctx,interlude,field,visit,visitPrompt,player,imgprompt,imgtag,budget,focus,guides,cbs,seed,start,refs,settings,advanced,factions}`, `core/world/*`(상황판 엔진), `core/people/{request,store,settings,identity}`, `host/{statusview,openinghint,unsent,user,asset,joint,llm,send,waiting,chatclicks}`.

시험 도구(모두 커밋):
- `tests/qc-host.mjs` — `tests/browser.mjs`의 가짜 Risu 를 복사해 **읽기·저장 횟수 세기**(`window.__counts`), 읽기 실패·지연 주입(`__chatFail`·`__chatDelay`), 부팅 때 기기 설정 주입(`prefs`)을 더한 공용 틀.
- `tests/qc-pipeline-browser.mjs` — Chromium 에서 채팅을 실제로 시작한 뒤 `replacers[0](messages,'model')`·`listeners[0]({…})`·`handlers.display(text)` 를 직접 불러 **결과 메시지 배열을 검사** (30묶음).
- `tests/qc-pipeline.test.mjs` — 순수 로직 회귀·극값 (11개).

## ① 점검한 항목

| 항목 | 경우 | 방법 | 결과 |
| --- | --- | --- | --- |
| 로어북 · 새 카드(자리 항목 없음) | 첫 전송: 덩어리 하나, 순서 RP→Tag→Status 절→Faction→Roster→세력(시드)→특수→괴이→요원, 인사말 앞 | browser 1-1 | **버그 3·4·5·6 수정** 뒤 통과 |
| | 시드: 첫 전송·그 다시 굴리기만, 두 번째 전송부터 없음 | browser 1-2 | 통과 |
| | RP 지침이 description 에 있을 때 중복 없음 | browser 1-6 | 통과 |
| | 괴이 공통 머리말 한 번만 | browser 1-6 | 통과 |
| | `lore_mode` plugin / risu | browser 1-7, unit computeLore | **버그 7 수정** 뒤 통과 |
| | 사용자가 카드에 직접 넣은 폴더 항목: 줄 동기화·요청 포함·Risu 직접일 때 제외 | browser 1-8 | **버그 8 수정** 뒤 통과 |
| | 부록 해금 `[🔓|…]`: 해금 전 조건만, 해금 뒤 본문·표시에서 제거 | browser 1-9 | 통과 |
| | Roster 한 줄 소개에서 전체 로어 인물 제거(trimRoster) | browser 1-1 | 통과 |
| 로어북 · 옛 카드(자리 항목 있음) | 입력 때 변수 저장(sameVars 면 저장 안 함), 요청 직전 patchSlots, 깊이 밖이면 제거, 덩어리 안 끼움 | browser 2-1 | 통과 |
| 상태창 블록 `withStatusBlock` | 지난 줄 제거·마지막만, 마지막 사용자 앞, 잔고 = 장부 | browser 1-3 | 통과 |
| | 칸 구성 on/hide/off 10칸, 장부 거래(사라진 기준 제외), 신분 보충 | browser 1-4 | 통과 |
| | 깨진 태그: 6칸·12칸·전각 구분자·닫는 괄호 없음·한 응답에 둘·없음·날짜 못 읽음 | browser 1-5, unit | 통과 |
| 상황판 `processOutput` | 다시 굴리기(같은 index) 되돌림, 같은 응답 재처리 없음 | browser 5-1 | 통과 |
| | `Math.random` 0 / 0.999 / 0.5 × 확률 0 · 상한 0 · 상한 99 · TTL 0 × 6턴: 상한 초과 없음·예외 없음 | unit | 통과 |
| | `cleanOutput`: 코드 블록·HTML·이모지·`|` 본문 보존, 상태창 끝으로 | unit | 통과 |
| 설정 조합 | 에셋 on/off × main/aux × 주인공 에셋 × 캐릭터 플레이 → 이미지 지침·명단 | browser 3-1·3-2 | 통과 |
| | 캐릭터로 플레이: 페르소나 교체·이름 치환·주인공 로어 제외·태그 명단 제외 | browser 3-2 | **버그 6(시드 중복)** 수정 뒤 통과 |
| | imgSend 0/2/6, imgShow 0/1 | browser 3-3·7 | 통과 |
| | 인물 기록 on/off × inject split/append/record/off × director off/facts/scene(보조 호출 1회·실패 시 생략) | browser 3-4 | **버그 9 수정** 뒤 통과 |
| | 괴담넷·괴담톡·위키 참고 기록 각각 on/off, `ctx_total` 총 상한 | browser 3-5, unit fitTotal | 통과 |
| | 방문 기록(막간은 기준 메시지 뒤)·필드 사실(사라진 기준 제외) 있음/없음 | browser 3-6 | 통과 |
| 표시 | 지시문·시작·전화 카드, 상태창 위치·목표, 이미지 태그에 `<script>`·`"`·`'`·`<img onerror>` → 모두 escape | browser 4-2 | **버그 10 수정** 뒤 통과 (XSS 없음) |
| | Lite 판정 전 상태창 표식 글은 그림, 다른 봇 글은 그대로 | browser 4-1 | 통과 |
| | 랜딩·전송 대기·첫 행동 안내(첫 전송 전만) | browser 1-0·4-3 | 통과 |
| 응답 처리 | 옛 채팅 보강(missingBasicVars·staleFactionVars), 전송 대기 표시 제거 | browser 5-2 | 통과 |
| | 같은 자리 다른 본문(편집/다시 굴리기), 다른 봇 무시 | browser 5-3 | 통과 (⑤ 참고) |
| | 보조 모델 이미지 태그 보충: 성공 시 태그·상태창 유지, 실패 시 본문 그대로·안내 변수 | browser 5-5 | 통과 |
| | 입력(로어 변수 저장)과 응답 처리(상황판 저장)가 겹칠 때 `updateChat` 큐 — 둘 다 남음 | browser 2-2 (읽기 지연 40ms) | 통과 |
| | 채팅 읽기 실패: 요청은 원문 그대로 나감, 응답 처리는 예외 전파 없음 | browser 3-7 | 통과 |
| 비용·성능 | 요청 1회 `getChatFromIndex`·`getCharacterFromIndex` 횟수 | browser 1-1·6-1 | **9·3 → 1·1** (③) |
| | 응답 처리 1회 읽기·저장 횟수 | browser 5-4 | chat 2·char 1·저장 1 (③) |
| | 긴 채팅 500개×2KB: `beforeRequest` 186ms, `display` 0.85ms/메시지 | browser 6-1 | 통과 |
| CBS | 중첩 if/else, 미지 변수(null), `{{user}}` 모름/앎, `#when vis`, `{{? 식}}`(띄어쓰기 글 비교), and/or/not, 모르는 태그·안 닫힌 블록·깨진 `{{` | unit | 통과 |

## ② 발견한 버그 (모두 수정, 커밋 `c446257e`·`815b871c`)

| # | 증상 | 원인 | 수정 | 시험 |
| --- | --- | --- | --- | --- |
| 1 | 요청 하나에 채팅을 9번, 캐릭터를 3번 읽고 세계 로어를 3번 조립(각 ~25ms)·`managedEntries` 캐시가 매번 빗나감 | 단계마다 `getChatFromIndex`/`getChar` 를 따로 호출 | `onBeforeRequest` 가 `loadContext()` 한 번으로 읽어 모든 단계에 넘김. 각 단계는 `safe()` 로 감싸 실패해도 요청은 나감 | browser 1-1·6-1 (횟수 1·1) |
| 2 | 상태창 지침·명부에 「`'s current encounter`」처럼 유저 이름 자리가 **빈 글** | `userInfo().name` 이 '' 일 때(새로고침 뒤 창을 열지 않고 전송) CBS `{{user}}` 가 '' 로 풀림 | 이름을 모르면 `{{user}}` 를 그대로 둠(`userOrTag`), 요청 전 `readUser()` 로 이름 읽기 | browser 1-1, unit cbs |
| 3 | 첫 전송 시드에 `@@dont_activate` 줄과 안 풀린 CBS(`{{#if …st_faction…}}`)가 그대로 모델에 감 | `$seed_lore` 가 로어 원문 그대로 저장되고 요청 때 표식만 뗐음 | `seedBody()`: 장식 줄 제거 + CBS 풀기 | unit seedBody, browser 1-1 |
| 4 | 첫 전송에 같은 요원 글이 두 번(시드 + 키워드로 고른 로어) | 시드와 고른 로어를 따로 붙임 | 시드에 있는 글은 고른 로어에서 뺌 | browser 1-1 |
| 5 | 로어 덩어리가 인사말(첫 장면) **뒤**에 들어감 | 자리 열쇠가 `chat.message[0]`(유저 글)뿐 — Risu 는 인사말을 `chat.message` 에 두지 않음 | `insertLoreBlock` 이 열쇠 여러 개(인사말 → 첫 글 → system 아닌 첫 메시지) | unit insertLoreBlock, browser 1-1 |
| 6 | 캐릭터로 플레이 첫 전송에 주인공 요원 글이 시드로 또 들어감(주인공 글과 중복) | 시드가 주인공을 모름 | 시드에서 주인공 요원 글 제거 | browser 3-2 |
| 7 | `lore_mode = risu` 에서 새 카드(자리 항목 없음)는 **세계 로어가 하나도 안 감** | 가상 항목은 카드에 없어 Risu 가 켤 수 없는데 플러그인도 자리를 비움 | 자리 항목 없는 카드는 Risu 방식(`pickLoreRisu`)으로 고른 **가상 항목만** 플러그인이 끼움(진짜 항목은 Risu 몫) | unit computeLore, browser 1-7·1-8 |
| 8 | 사용자가 카드에 직접 넣은 요원 항목의 `@@dont_activate` 줄이 새 카드에서 영영 안 붙음 | `updateCharacterLore` 가 가상 항목을 뗀 로어를 주는데 `syncDecorators` 는 자리/가상 항목이 있어야 동작 | 저장 함수 안에서 `withWorldLore` 로 다시 붙여 판정하고 진짜 항목만 돌려줌 | browser 1-8 |
| 9 | 인물 기록 split/record 모드가 시트 원문을 요청에서 못 빼거나(중복) **엉뚱한 범위를 지움** | ① `bookText` 가 `@@dont_activate` 를 남기고 `{{user}}`를 「주인공」으로 풀어 로어 글과 한 번도 같지 않았음 ② `stripSheets` 의 공백 차이 대체 경로가 「첫 `###` ~ 시트 끝 낱말」을 잘라 RP 지침 일부를 지움 | ① `withPeople` 의 `sheetOf` 를 로어 덩어리와 같은 변환으로 ② `stripSheets` 를 낱말 사이 `\s+` 정규식으로 | unit stripSheets, browser 3-4 |
| 10 | 상태창 값에 `$&`·`$'` 가 있으면 그린 상자가 깨짐(원문이 끼어듦) | `renderStatus` 가 `String.replace` 에 문자열 치환을 써 `$` 패턴이 해석됨 | 함수 치환으로 | browser 4-2 |
| 11 | `moduleContext` 의 지침·명부 캐시가 캐릭터 번호로만 키 → 지침·명부를 고쳐도 옛것이 남음 | 캐시 무효화 없음 | 캐시 제거(명부 읽기·registry 는 요청당 10ms 안쪽) | browser 3-5 |

## ③ 최적화 (동작 같음, 측정)

- 요청 1회: 채팅 읽기 9→1, 캐릭터 읽기 3→1, 세계 로어 조립 3→1 (`loadContext` 한 번). 빈 채팅 요청 238ms → 164ms, 500개×2KB 채팅 요청 186ms.
- 응답 처리 1회: `storeLore`·`refreshStatusContext` 에 리스너가 준 캐릭터·채팅을 넘겨 다시 읽지 않음. 남은 읽기(chat 2·char 1)는 `updateChat` 의 최신 읽기와 `host/people.ts requestPeopleUpdate` 의 `loadContext`(인물 기록이 꺼져 있어도 설정을 보려고 읽음 — 다른 영역, 보고만).
- 자리 항목 없는 카드는 `$goei_lore_*` 변수를 저장하지 않음 (턴마다 채팅 저장 1회와 변수 수십 KB 절약. 이 카드에서는 아무도 읽지 않았다: `lorecheck.ts` 는 매번 새로 계산).
- 첫 전송 덩어리 54.7KB → 49.5KB (시드 중복·장식 줄 제거).

## ④ 스스로 내린 결정

- **결정**: 유저 이름을 모를 때 `{{user}}` 를 빈 글 대신 그대로 둔다. **근거**: 이미지 지침(`buildImgPrompt`)도 `{{user}}` 를 그대로 두는 방식이고, Risu 가 풀어 주면 이름이 되고 아니어도 모델이 「the user」로 읽는다. 빈 글은 문장이 깨진다.
- **결정**: `lore_mode = risu` 에서 새 카드의 가상 항목은 플러그인이 Risu 방식으로 끼운다. **근거**: 사용자가 정한 옵션 의미(「낱말 속 글자에도 걸리는 Risu 방식」)는 지키면서, 카드에 없는 가상 항목을 Risu 가 켤 수 없어 세계 로어가 통째로 빠지던 것을 막는다. 사용자가 직접 넣은 진짜 항목은 전처럼 Risu 가 켠다.
- **결정**: 로어 덩어리는 인사말 앞. **근거**: Risu 가 로어북을 넣는 자리(본 프롬프트 뒤·대화 앞)와 같게. 인사말이 없거나(직접 입력) 요청에서 못 찾으면 전처럼 첫 글 앞.
- **결정**: 시드와 겹치는 고른 로어·주인공 요원 글은 한 번만 보낸다. **근거**: 같은 글을 두 번 보내는 것은 토큰 낭비일 뿐 사용자가 정한 「첫 턴 강제 로어」 기능은 그대로다.
- **결정**: `moduleContext` 캐시를 없앤다. **근거**: 요청당 10ms 미만이고 지침·명부 편집이 바로 반영돼야 한다.
- **결정**: 같은 메시지 자리에 다른 본문이 오면(편집이든 다시 굴리기든) 이전 반영을 되돌리고 새 본문만 반영하는 기존 동작을 유지. **근거**: Risu 가 편집에 output 리스너를 부르는지 실측되지 않았고(인계서 4-1), 다시 굴리기는 되돌리는 것이 맞다.

## ⑤ 고치지 못했거나 사용자 확인이 필요한 것

- `tests/browser.mjs` 는 main 상태 그대로 141줄 「시작 전에도 세계 편집 트리」(`[data-action="ed-node"][data-value="agent"]`) 에서 멈춘다 (인계서 4-2 「별건」, 설정 창 영역). 이 영역의 요청·응답 흐름은 `tests/qc-pipeline-browser.mjs` 가 대신 덮는다.
- 실제 Risu 에서 `beforeRequest` 가 넣은 시스템 메시지의 `{{user}}` 를 Risu 가 풀어 주는지 미확인. 안 풀어 주면 모델은 `{{user}}` 글자를 본다(이미지 지침도 같은 조건).
- `host/people.ts requestPeopleUpdate` 는 인물 기록이 꺼져 있어도 `loadContext` 로 채팅·캐릭터를 한 번 읽는다 (다른 영역, 응답당 ~25ms).
- `fitTotal` 총 상한이 한 기능의 지침 머리글조차 담기 어려울 만큼 작으면 그 기능은 통째로 빠진다 (사용자가 정한 비율 분배 방식 그대로, 보고만). 시험: 전체 1,253토큰 → 상한 751 에서 괴담톡이 빠지고 418토큰.
- 편집한 응답에 Risu 가 output 리스너를 다시 부르면 그 자리의 이전 반영이 되돌려진다(④ 마지막).

## ⑥ 실행한 시험과 결과

```
npm run typecheck                      → 오류 없음
npm test                               → 656 tests · 641 pass · 0 fail · 15 skipped (기준선 645/630/0/15 + 새 11개)
node tests/qc-pipeline-browser.mjs <fixture.json>   → 30/30 통과 (약 25초)
node --test tests/qc-pipeline.test.mjs → 11/11 통과
```
수치: 요청 1회 읽기 chat 1·char 1(전 9·3), 응답 처리 chat 2·char 1·저장 1, 500개×2KB 채팅 beforeRequest 186ms·display 0.85ms/메시지, 첫 전송 덩어리 49.5KB(전 54.7KB).

다른 영역 파일 수정: `src/core/people/request.ts`(`stripSheets`, 인물 기록 영역과 겹침)·`src/host/statusview.ts`(함수 치환·known 인자). 그 밖은 모두 이 영역(`src/body.ts`, `src/core/lore.ts`, `src/core/seed.ts`).
