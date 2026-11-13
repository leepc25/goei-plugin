---
name: goei-shop-judge-1109
description: 11-09 shop detection (상점 판단 main/updater), single shared shop rule, 고유 상점 table (web malls open standalone internet window) — read before touching shop guides
metadata:
  type: project
  modified: 2026-11-09T16:34:21.532Z
---
Built 11-09 (commit f70ec8596, branch claude/project-thread-swxqg6), user asked to release after it.
- Setting 설정 → 상점 「상점 판단」 `$sh_judge`: auto(default: updater if people on & when=turn, else main) / main / updater (falls back to main with notice). core/shop.ts shopJudgeBy.
- User rule 16:11 KST: 「상점 지침을 수정할때는 꼭 양쪽을 동시에」. So shop.txt SHOP_RULE is the ONE shared criteria text: MAIN_TAG embeds it via {rule}; updater guides get it via <<SHOP_RULE>>. Updater additionally gets SHOP_JUDGE (user asked for a more detailed updater guide). Never write shop judgment wording in only one side.
- 고유 상점 = lore shops with their own screen, user-editable table `$sh_own` (no hardcoding; user: may be 10+ later, 망상홈쇼핑 coming). Row: on, name, alias, web site id (cos/bm), visit window ('shop' basic / '' none; designed skins later). Online access → tag `[shop: name|@web]` → settled to `@web:site` → chat card 「접속하기」 → internet window only (netSolo in ui/app.ts). In-person pop-up store → basic shop window. Mere mention must NOT open (OWN_SHOPS section).
- Ordinary shops (편의점 etc.) not in table still open the basic shop window.
- 11-09 release-check batch fixed on swxqg6 92f918dc7 (orders/quotes/money lock, deskRawSafe hides <card> in failed raw, progress 응답 없음/watchdog, icon match stays inside given kind). User decided 상담원 dice & bmdesk.txt guide stay AS IS (no leak-wording change).
- 11-09 02:27 KST own 전수점검 → 5b6590c7d: purchase flags (sold/bought/accepted/taken) now carry the buying response key and revive when it dies (reviveShop in readMall, liveOrders takenKey); freshWalletId for re-purchase ids; raw `@web` tag = no card. f5825c846: progwin (root doc, z45) covered 상황판 close X in harness → hidden while appShown() (ui/app.ts onAppShown). USER (furious) lost trust: never hand to release without own edge-case check (delete/reroll/double-click) of every touched feature; no click-audit sweeps; stay under 1h.
See [[goei-cos-mall-decisions-1109]].
