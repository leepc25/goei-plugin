---
name: goei-item-state-1112
description: 11-12 user bug reports on 소지품 — item never removed/unequipped by story, picture frozen on state change (꿈결 수집기), wrong 사용 class (손전등), 착한 친구 lorebook not read; requirements and where the investigation lives
metadata:
  type: project
  modified: 2026-11-12T13:33:26.673Z
---
Thread 「관제 화면·상담 창 만들어 릴리스」 (cmsg_01SMy6spzkHA3Ttz9fg54ZY87G74Edqf9Upsz6fwZLSd3m), 2026-11-12 20:35–20:41 KST. User: 「지금 구조가 아예 잘못되었잖아」. Investigation docs (plans, not built): /mnt/project-files/bugs_1112/물건_상태_그림_조사와_고침안.md, /mnt/project-files/bugs_1112/착한친구_로어북_조사.md. Build only after user OK.

**User requirements (literal):**
- R1: when 본문 clearly says an item is discarded / left behind / lost, it leaves 소지품 (「아이템이 한번 들어오면 스스로 없애지를 못해」).
- R2: an equipped item is unequipped when 본문 describes taking it off (now stays equipped).
- R3: after unequip, carried or not decides inventory: kept → inventory; left elsewhere → gone. Case: 「사내용 정장 세트」 left in 탈의실 3번 사물함, still in inventory, 장착 button gone (only 버리기).
- Picture must follow state: 「고순도 꿈결 수집기」 filled but shows empty picture, text only changes.
- 사용 class wrong at creation: 손전등 came out as 「사용」 (it is a held tool).
- 「착한 친구」 lorebook is not read at all when the name appears.

**Facts checked:** pictures exist — 「빈 꿈결 수집기」 anomaly_261, 「꿈결 수집기 F~S등급」 anomaly_262–268, 「꿈결 용액」 medical_176 (game-src/items/icons.json). Keyword 「꿈결 수집기」 points to the EMPTY one. So no drawing needed; matching/pin is the defect. Never say a picture is missing before checking icons.json (user: 「등급별로 뽑아놨는데」).

**Investigation result (code repro, 20:5x KST; no real model run):** NO picture pin exists (earlier guess wrong) — picture recomputed each draw from name + icon word only (src/ui/items.ts:63), desc/state ignored; `$it_edit` does NOT block removal. Remove op `gone`/`destroyed` exists (src/core/people/updater.ts:456, items.ts:770) but guide lists only used up/lost/given/thrown away, and the `update` rule invites rewriting desc; no location field. `update` with `equip: none` wipes equip class + slot → only 버리기 (updater.ts:1327 → items.ts:775, withTraits 254). 손전등=사용 follows guide literally (tool/device → usable; updater-detailed.txt:438, shop.txt:8); all flags model-decided. Re-pick = new item (id/class/weight lost); no tombstone. 고순도/고농도 not in wiki; grade ladder F 그늘·E 황혼·D 땅거미·C 어스름·B 어둠·A 암흑·S 심연.
**Plan told to user (awaiting 「만들어」 + 3 decisions):** class from stored kind + settings table; new ops unequip / left(place), wider gone; removed rows hidden not deleted (restore same item); picture order: grade word → 'filled, grade unknown' picture → empty only when 「빈」 written. Open: use 상황판 괴이 grade as fallback? (Claude recommends no), which 'unknown grade' picture, show left-behind items only in 기록?

Related: [[goei-icon-matcher-redesign-1109]] [[goei-lore-activation]]

**11-12 22:21 KST build started** (user 「만들거 아직도 안만들었어?」): local branch build-itemstate-1112 on integ 817bdfc56; also build-equip8-1112 (소지품 top panel). **22:23–22:27 user decisions on 수집기 등급 (furious at Claude's misreads):** 「어둠」 in 「스웨디시 어둠 현장」 = the 괴이, NOT the grade word (Claude wrongly said B등급). Word tables (농도 말 → 등급) rejected (「저런걸로 매칭이 되겠냐」「고작 저걸로?」). **판정은 메인 모델(본문)이 한다** — not 갱신기, not code: main guide gets one line (state the grade when the collector fills; show diff first), 갱신기 only copies a grade that is written, code verifies the quote and picks the picture; blank → 「찼는데 등급 모름」 picture. Lesson: who JUDGES story facts = main model; never move judgment to 갱신기 or reverse-engineer it from text by code.
**22:33 KST REAL FINAL (user 「그래」; supersedes the 22:28 single-picture scheme below):** one unified 「찼고 등급 전」 picture rejected (「맥락을 반영을 못하잖아」). 갱신기 re-picks the PICTURE word from context whenever an item's state changes (all multi-picture items); the pick is display only — no grade stored as fact, picture word never goes to the main request (itemLine src/core/items.ts:532 sends name/desc/effect/tags only); code drops grade words the 갱신기 puts into name/desc unless 본문 states them (갱신기 stamping a grade = 메인모델 월권); when 본문 later grades it, 갱신기 switches to that grade's picture (본문 wins). Main guide untouched; 갱신기 guide change shown as diff.
**22:28 KST (superseded in part):** user: 「등급을 본부에 가져가지도 않았는데 무슨수로 판정을 해」「메인모델 지침을 건드려?」 → a collector filled in the field has NO grade until it is taken to HQ and graded. States: 빈 / 찼고 등급 전 / 등급 매겨짐. Filled-ungraded = its own picture (none exists yet: reuse vs draw 1 = user decides, 「뽑아」 only). Grade picture only after 본문 explicitly grades it. NEVER touch the main-model guide for this; never guess grade from 묘사/농도/괴이 등급. Lesson: read the wiki's in-world process (rule 44) before designing — Claude burned 5 wrong proposals here.
