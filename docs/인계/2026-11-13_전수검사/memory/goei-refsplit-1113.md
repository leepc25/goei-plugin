---
name: goei-refsplit-1113
description: 11-13 user-approved build — 「넘길 내용」/양 split per board and per function (인터넷·괴담톡·상점), 상시 로어북 picker; branches, decisions, what waits on 망상홈쇼핑
metadata:
  type: project
---
Thread 「관제 화면·상담 창 이어가기」 (cmsg_01SMy6spzkHA3Ttz9fg54ZY82y6Q3688VycLFKLTLca5TK), branch claude/project-thread-9rc8hb (on w7tu9e c7335a484). 2026-11-13 00:09 KST user 「그래」 + 「병렬로 최대한 돌려서 빨리 완성해」. Release only on 「릴리스해」.

**User's complaint:** 「같이 쓰는 값」(넘길 내용·양)이 메뉴 안 모든 기능·게시판에 똑같이 넘어간다 → 기능별로 분리. 설정 통일이 엉망이라고 크게 화냄.

**Approved final plan:**
1. 상시 로어북: ONE row on 「호출 › 로어북 호출」 (「N개 선택」 + 「로어북 선택」 checklist of card lorebooks, default 📜Faction·🙂Roster). Chosen list must be wired to every feature. NO per-feature lists (「상시 로어북은 더이상 건들지마」).
2. 인터넷: 「넘길 내용」 row → 게시판 표 (rows 괴담넷/괴담갤/세정게/연어 마켓 × 6 chips, per board) + 기능 표 (rows 새로고침/글 쓰기/댓글/쪽지 × 6 chips, shared by 4 boards); sent = on in both. 양 표 per function only (챗로그·지난 기록·요청 토큰 상한); boards share amounts.
3. 괴담톡: 기능 표 rows 답장/새 메시지 확인/보기 전용 방; 「인물 로어북」 stays ONE column; 양 표 same shape.
4. 상점: 가게 표 + 기능 표 (진열/문의/1:1 상담) with 6 chips + 「맥락 반영」 column (user: 「1번은 그렇게해」); 양 표 (챗로그·참조 로어북); make 「참조 로어북」 count really limit (it did nothing: refs.ts:119,144-151).
5. 위키: unchanged. Defaults everywhere = current behaviour.
6. 망상홈쇼핑: NOT now. User: its settings window itself is the problem; when 망상홈쇼핑 thread finishes it hands over to THIS thread and this thread rebuilds the 망상홈쇼핑 settings window (incl. 채팅 반응 row, $hs_read row, $hs_main* / $hs_say_* vars, 상점 「메인 요청에 붙이는 것」 grid row; kinds show/chat/say/buy).

**Rejected (never re-propose):** grid of 상시 로어북 × 기능; 3-row per-feature scheme (공통/따로/안 넘김 + 대상 로어북 + 관련 로어북) = 「너무 복잡」; 16-row board×function table not chosen.

**Build layout:** shared core src/core/reffn.ts (c0ebb7cce). Worktrees: /home/user/wt-net branch build-net-fn (인터넷+괴담톡), /home/user/wt-shop branch build-shop-fn (상점); picker built in main checkout /home/user/goei-plugin. Merge all on 9rc8hb; add new vars to PREF_VAR (core/settings.ts) at merge; then old thread's w7tu9e merges (shopctx grid, itemstate, 2차 합치기) must be combined. Sheets go to /mnt/project-files/settings_redesign_1111/step56/ (상시로어북_선택_PC폰.png, 기능별표_인터넷_괴담톡_PC폰.png, 가게표_기능표_상점_PC폰.png).

**Other pending user answers (do not raise until current work is done — user: 「지금 하는 작업만 해」):** 우주 쇼핑몰 own 「팔기」 check in 메인 요청 grid; item-structure 3 confirmations (도구·기기 = 장착 only? remove word safety-net? no temp C-grade picture?); 괴담톡 habit memo view/delete screen; 괴담갤 leak check; older list in [[goei-handoff-1112-night]].

**11-13 00:17 망상홈쇼핑 HANDED OVER to this thread** (user in that thread: 「수정 완료되면 전부다 저쪽으로 넘겨」「시험 돌리지 말고 완성되면 바로 넘겨」). Head claude/project-thread-uxn1ej 50a3d6d7e (base 420b30596 = w7tu9e c7335a484 merged); last commit pushed WITHOUT full test → this thread merges it and runs npm test + browser (phone·pcbig·edge·spec·상담 catalog). Handoff doc: /mnt/project-files/망상홈쇼핑_1109/넘김_1113_이어가기.md (all $hs_* values, request builders, open items). To do here: rebuild 망상홈쇼핑 settings window (current def src/core/setdef/homeshop.ts; HOMESHOP_SET rows not all rendered); rows needed for $hs_main / $hs_main_kinds(show,chat,say,buy) / $hs_main_tokens / $hs_say_cue_min·max / $hs_say_chat_min·max / $hs_read; clips row gray placeholder → real default/help; 7 broadcast-flow number rows were added without user OK (place/name ours to decide WITH user); wire 채팅 반응 (src/ui/homeshop.ts say(), broadcastMaterial at end of src/core/shop.ts) into the common 「넘길 내용」 tables (+「채팅 반응」 row) and add 망상홈쇼핑 rows to 가게 표 and to 「메인 요청에 붙이는 것」 grid. Design must be shown to user before building (design talk rule). 망상홈쇼핑 screen-layout open items stay with user (rejected mock: do not delete elements).

**11-13 00:19 user rule:** other threads (old 관제·상담 thread w7tu9e, 망상홈쇼핑 uxn1ej) hand over WITHOUT running tests; THIS thread (9rc8hb) is the single place that merges everything and runs tests once (coordinator: intermediate merges = typecheck + unit + touched-screen browser tests only; full suite once before release). 망상홈쇼핑 settings window: user 「다른거에 준해서 만들어」 = build like 우주 쇼핑몰/포인트몰 pages without asking first (agent in /home/user/wt-hs branch build-hs-set, on c0ebb7cce + uxn1ej 50a3d6d7e; sheet step56/망상홈쇼핑_설정창_PC폰.png).

**11-13 00:20 user: 「니가 작업하는거 완료되면 합치고 그때 최종 테스트 돌리고 그다음에 릴리스해놔」** = RELEASE AUTHORIZED for this batch, once: after all four builds (상시 로어북 picker, 인터넷·괴담톡 표, 상점 표, 망상홈쇼핑 설정창) + old thread's w7tu9e work + 망상홈쇼핑 are merged on 9rc8hb and the final full test passes. If the final test fails → do not release, report. Follow release flow (branch `handoff` 인수인계/릴리스_스레드_인수인계.md §3, [[goei-return-1109]]) and 전수점검 of touched parts ([[goei-audit-method-1109]]). This authorization covers only this batch.
- 11-13 00:20 user went to sleep (「난 자러 간다」). Told user: test failures → Claude fixes, re-runs, releases when green; stop only if a fix would require changing a user decision; the 7 game-group browser failures that also fail on released 782dca17c do not block. Finish autonomously and leave a summary in the thread.
- 11-13 00:20 user: if decisions conflict during this batch → apply the user's MOST RECENT decision and keep going (no stopping); list each such case in the final summary.
- 11-13 00:21 user (angry): 「게임이 없는데 시험을 대체 왜 돌려」 → NEVER run the game group of tests/browser-suite.json (9 tests: qc-game-plugin, qc-mobile, qc-field-world, qc-combat, field-wallet, hq-textures, engine, audio, field-sweep); final test = unit + `--group plugin` (+ the 3 not-in-suite ones if touched). Asked whether to drop the 9 from the suite list (files kept); no answer → leave list untouched.

**11-13 01:06 KST user: RELEASE AUTHORIZATION WITHDRAWN for this thread.** 「작업 끝나면 릴리스 하지 말고 새 스레드로 옮겨서 전수검사 한뒤에 릴리스한다. 울트라코드 돌려서 검사」. → When 9rc8hb work is done: write a handoff doc, ask coordinator for a NEW thread; that thread runs the 전수검사 with ultracode (user opted in) and only then releases. Details of what was built after 00:30: [[goei-night-1113]].
