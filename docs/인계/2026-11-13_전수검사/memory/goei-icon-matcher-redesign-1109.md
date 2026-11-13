---
name: goei-icon-matcher-redesign-1109
description: 11-09 item icon matcher REDESIGNED (ad1fd4682) — 그림 column = 「종류/물건말」, kind-scoped matching, alias table setting, miss log; points follow the story; chat cards centered
metadata:
  type: project
  modified: 2026-11-09T14:55:49.665Z
---
Thread 릴리스본 버그 고치기, branch claude/project-thread-swxqg6 (thread hit the 24-attachment cap; next fixes → new thread, same branch).
**Matcher redesign DONE (ad1fd4682, user 「해」 14:44 KST):** model writes 그림 as `종류/물건말` (옷/코트); 16 kinds = icons.json `kind` (옷·음식·도구·기기·의료·소모품·부적·무기·서류·귀중품·열쇠·봉인·괴이·성인·신체·잡동사니, ICON_KIND_LABEL in src/core/iconmatch.ts). Order: name head exact → within kind (물건말, then name head) → global → kind-nearest by fragments (KIND_MIN 0.25) → kind base picture; misc box only when kind unknown. Korean name head beats an English icon word that matched head-only. Alias table (설정 → 소지품 「그림 대체 말」, `$it_icon_alias`, default ICON_ALIAS_DEFAULT: 외투→코트, 안정수→안정제, 캡슐→알약, 영양 바→에너지바, 내의→팬티…) loaded in host/risu.ts loadContext. Miss log readIconMisses() shown in 설정 「그림 못 찾은 말」 (session only). Mirrored in game-src/items/match_icon.mjs (parity test tests/itemicons.test.mjs). Guides updated: shop.txt 그림 rule, updater-compact/detailed `icon`, BM_COMMON.
User REJECTED sending the 2,000-head vocabulary to the model (tokens + fixation). User OK with drawing more assets (「용량 크지 않으니」) but agreed order: matcher first → collect misses → one batch, each needs 「뽑아」. Known missing pictures: 세탁기, 탈모약/모발 앰플, 내의(속옷 상의).
**Points:** user first said 「무조건 0 시작」, then saw the story text granted 900 → 「본문 따라 가야지」. Final: ledger starts 0 and follows the status line incl. the first one (cc3fc2b5e); guide says never invent an ungranted balance; examples 0/250.
**포인트몰 진열 배정 DONE (231da3b1c, user 「1번은 해」 15:03):** mallRoll(vars, site), `$bm_roll_*`, BM defaults 10 categories + 5 point tiers (30–9,999p), request line uses CATEGORY and `p`. Item icon drawing happens in a SEPARATE thread with a 16-per-batch guideline (user 15:03) — never generate icons from the bug-fix thread. 복지몰 double route ([shop: 사내 복지몰] generic shop + 인터넷 포인트몰) stays as is (user's call).
**UI:** all chat cards (상점 열기·장면·보고서, cardStyle in src/body.ts) centered like the status box (user reversed 11-08 left-align). 우주몰 완성 주문 card: centered 240px, no grey frame.
**Why:** lexical head-word matching cannot bridge synonyms; user wants no box with ~2,800 pictures.
**How to apply:** don't patch the matcher per item; extend the alias table or draw assets from the miss log. See [[goei-cos-mall-decisions-1109]], [[goei-main-fix-1109]].
