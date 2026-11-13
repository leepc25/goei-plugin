### shop#7 (r3/None, fixed)
DONE: The core talkPrompt change was done in round 2. Applied the recommended optional safety net in src/ui/malls.ts ask(), talk branch. For site 'cos', every unsold item that the talk reply newly added (id not in st0.items) and that has no truth gets truth '?', the same as fixedItem. The ad copy then never becomes the item's real effect. This sets a data value only and changes no wording.
REMAINING CHANGE: tests/guide-out.test.mjs is not mine. Its test '기본 지침으로 만든 요청문 = 옮기기 전 코드가 만들던 요청문' fails for 'shop.talk.cos.secret' because of the round-2 talkPrompt change: {line} gains '|진실' and the SHELF_SECRET paragraph is added. Either refresh calls['shop.talk.cos.secret'] in tests/fixtures/guide-out-old.json to the current calls(M) output, or skip that key in the loop and assert BASE['shop.talk.cos.secret'].includes('이름|값|쓰임|그림|무게|설명|효과|구분|진실'). Separately, 'shop.shelf.cos.*' and 'shop.talk.cos.secret' also differ because of another agent's edit to src/core/guides.ts (Cos guide drops 'Prices should feel like real Korean prices…' and the haggling sentence). That diff does not come from my files. The current first failure in that test is gnet.refresh.sm, which is not mine either.

### wording#4 (r3/None, fixed)
DONE: Shop part only, done as a pure move with byte-identical default output. Added four sections to the end of src/data/guides/shop.txt, each holding the full header text verbatim: HEAD_REFS, HEAD_ASSIGN, HEAD_ORDERS, HEAD_NOTES. Cos and Bm inherit them through mallGuide. In src/core/shop.ts, material() takes a guide parameter and reads the three headers with guideOr(guide, 'HEAD_…', old literal). talkPrompt reads the notes header with guideOr(guide, 'HEAD_NOTES', old literal). shelfPrompt and talkPrompt pass their guide. The home-shopping callers (programPrompt, broadcastMaterial) pass 'Hs', which has no such sections, so they keep the old literal unchanged. Default request text is identical: the guide-out comparison shows shop.rule/guide and malls.assign unchanged, and fix3-shop.test.mjs checks that the default headers appear verbatim, that an edited section changes the request, and that a missing section falls back to the old text.
REMAINING CHANGE: The rest of wording#4 is in files I do not own. Move the same way, verbatim, with guideOr and the old literal as fallback: src/core/bmdesk.ts:178 '[최근 상담사 — 겹치지 말 것]' (BmDesk; bmdesk.txt:6 quotes it by exact text), src/core/wiki.ts:291/293/589 '[이전 위키 — 원본 사실과 최근 확인된 본문을 우선]', '[사용자 작성 지침 — 이 문서만, 공통 지침과 부딪치면 이쪽을 우선]', '[이미 쓴 문서 — 되도록 피하고, 최근 이야기로 내용이 크게 달라졌을 때만]' (Wiki), and src/core/gnetPrompt.ts:108 '[참고 자료 — 작중 인물에게 자동 공개되지 않음]' (Common or GNet; tests/gnet.test.mjs:173 asserts that prefix). Optional: add the four new Shop HEAD_* sections to the 'sections' list in tests/fixtures/guide-out-old.json so guide-out test 1 pins them.

### world#8 (r3/None, fixed)
DONE: In tags.ts, added SLOT = /^<[^<>]*>$/ and unslot(). scanAnomalies now skips a tag whose name or region is a <…> placeholder, so the entry stays 발생대기, and placeholder deploy/situation become ''. scanSites (IN/MS) does the same: it skips placeholder name or region and maps the rest cells through unslot, so deploy/visitors/situation become ''. reports(), the guide text, validName, normGrade and the AG scanner are unchanged.
REMAINING CHANGE: The plan also wanted the test in tests/world.test.mjs. It is in the new tests/fix3-world.test.mjs instead, because only that file was allowed.

### images#5 (r3/None, fixed)
DONE: Did the helper-model part. src/core/asset.ts: ImageData has a new `userName?: string`. assetPrompt replaces {{user}} in the NO_TAG / NO_TAG_USER text with that name when it is given, and leaves it as is otherwise. That one line is the only difference. src/host/asset.ts: supplementAssets and previewAsset build data as `{ ...(assetPlayer ? withUser(...) : tuned), userName: userInfo().name || undefined }`. asset.txt keeps the literal {{user}}. The main-model part is in src/body.ts, which I do not own, so it is still to do.
REMAINING CHANGE: src/body.ts withImgPrompt (about line 408): change `return appendImgPrompt(out, buildImgPrompt(cfg, names, s.assetPlayer));` to `return appendImgPrompt(out, buildImgPrompt(cfg, names, s.assetPlayer, userOrTag()));`. buildImgPrompt already takes the 4th userName parameter (round 2). This is the same change as pipeline#11.

### images#8 (r3/None, fixed)
DONE: src/ui/update.ts upd-apply: when pictures were added or dropped, it now calls forgetImages() and then `await loadModuleAssets().catch(() => false)`, imported from '../host/assets'. src/host/install.ts: after forgetImages() it calls `void loadModuleAssets().catch(() => false)`, imported from './assets'. The reload when the character changes belongs in body.ts startWatcher, which I do not own, so it is still to do.
REMAINING CHANGE: src/body.ts startWatcher: keep the previous tick's character index in a module variable. When this tick's index differs from it, or when next.changed && next.fabVisible, call `void loadModuleAssets();`, then store the new index. Do not call it on every tick.

### images#6 (r3/None, fixed)
DONE: Pure move, so the default output is byte-identical. (a) src/data/guides/asset.txt gets new sections MAIN_USER_RULE ('- Do not create tags for {{user}}.') and MAIN_USER_SKIP ('{{user}}'). buildImgPrompt reads them with guideOr('Asset', 'MAIN_USER_RULE', <old literal>), and with `${guideOr('Asset', 'MAIN_USER_SKIP', '{{user}}')}, `, since the section is trimmed and the code adds the ', '. (b) src/data/guides/gnet.txt gets PICS_NONE, PICS_PEOPLE ('People (may add _expression): {list}'), PICS_EXPR ('Expressions: {list}') and PICS_THINGS ('Anomalies, people and places (no expression): {list}'), placed after ATTACHMENTS. sitePicList(char, sec?) fills {list} with fillVars and falls back to the old literals. gnetBooks passes each site's own guide sections (k) => g[k], so Gal, Wpf and Salmon edits apply too. Tests check that the default and old-guide (no section) outputs equal the old text, and that an edited section changes the output.
REMAINING CHANGE: Optional, not needed for any test to pass: if the owner of tests/fixtures/guide-out-old.json wants these new sections covered by the per-section 'edit changes request' test, add Asset MAIN_USER_RULE and MAIN_USER_SKIP and GNet PICS_* and DM.QUOTE_UNKNOWN to its sections list. The test asserts moved.length === 95, so that count would also need updating. guide-out.test.mjs test 3 shows no difference from these changes. Its current failures (gnet.refresh.sm tone text, shop.shelf.cos.*, shop.talk.cos.secret) come from other agents' guide edits, not from this one.

### pipeline#11 (r3/None, deferred)
DONE: The whole fix is in src/body.ts, which I do not own. buildImgPrompt already takes an optional userName (round 2) and resolves {{user}} itself. The text it reads now comes from the Asset MAIN_USER_* sections, with the same default.
REMAINING CHANGE: src/body.ts withImgPrompt: change `return appendImgPrompt(out, buildImgPrompt(cfg, names, s.assetPlayer));` to `return appendImgPrompt(out, buildImgPrompt(cfg, names, s.assetPlayer, userOrTag()));`. userOrTag() returns undefined when the name is unknown, and then {{user}} stays.

### guides#7 (r3/None, fixed)
DONE: Did the parts in my files, as byte-identical moves. (b) The imgprompt.ts sentence '- Do not create tags for {{user}}.' is now read from the Asset section MAIN_USER_RULE, with the literal as fallback (same change as images#6). I used asset.txt rather than the suggested main.txt 'IMAGE.NO_TAG_USER' because I do not own main.txt. (c) src/core/gnetPrompt.ts dmPrompt: '[not retained; do not attribute to the contact]' is now orOld(b, 'DM.QUOTE_UNKNOWN', <literal>), with the new section DM.QUOTE_UNKNOWN in gnet.txt after DM.NO-ORIGIN. Parts (a) and (d) are in files I do not own.
REMAINING CHANGE: (a) main.txt sections and rhythm.ts RHYTHM.METHOD, as in the hardcode#4 deferred_change (names PEOPLE.TASTE_NOTE, PEOPLE.OPENNESS_NOTE, RHYTHM.HEAD, RHYTHM.CLOCK_HEAD, which inject.ts already reads). (d) Optional: shop.ts:908-910/969 and bmdesk.ts:178 material headers, either moved to shop.txt / bmdesk.txt with literal fallbacks or left as labels. This waits on the owner's decision. Leave gnetPrompt.ts:82 and updater.ts:382 alone.

### images#5 (r3/None, fixed)
DONE: Main path: src/body.ts withImgPrompt now runs the image-tag text through evaluate(...) with user = me?.name || userOrTag(), so {{user}} becomes the player's name. This is the same edit as gmain#10's FINAL and does the same job as the planned buildImgPrompt(..., userOrTag()) change, while also using the played agent's name. If the name is unknown, {{user}} stays as it is. buildImgPrompt and the guide text are unchanged. The aux path is in files I do not own and is still to do (see deferred_change).
REMAINING CHANGE: Aux path, for the owner of src/core/asset.ts and src/host/asset.ts. (1) src/core/asset.ts: add `userName?: string` to interface ImageData. In assetPrompt, after the `noTag` line, add `const noTagText = d.userName ? noTag.replace(/\{\{user\}\}/g, () => d.userName!) : noTag;` and use noTagText wherever noTag is inserted. (2) src/host/asset.ts, where `data` is built (lines ~45 and ~90): `const data = { ...(s.assetPlayer ? withUser(tuned, agent ? undefined : userInfo().name) : tuned), userName: (agent?.name || userInfo().name) || undefined };`. Using agent?.name first keeps it in line with the main path in body.ts. Do not change asset.txt or ui/imgprompt.ts.

### images#8 (r3/None, fixed)
DONE: body.ts part: startWatcher keeps the last character index (lastChar). When the character changes, or when next.changed && next.fabVisible, it calls `void loadModuleAssets().catch(() => false)`. It skips the first tick, because the asset list is already read at startup, and it skips charIndex -1, so it does not reload on every tick. The update.ts and install.ts parts are in files I do not own.
REMAINING CHANGE: 1) src/ui/update.ts upd-apply: after `if (pics.get.length || pics.drop.length) forgetImages();` add `await loadModuleAssets().catch(() => false);` plus `import { loadModuleAssets } from '../host/assets';`. 2) src/host/install.ts: after `forgetImages();` (~line 141) add `void loadModuleAssets();` (import from './assets').

### hardcode#4 (r3/None, fixed)
DONE: main.txt gets new sections whose text is the old code text copied exactly: PEOPLE.EXPRESS_0..3, PEOPLE.TASTE_NOTE, PEOPLE.OPENNESS_NOTE, RHYTHM.HEAD, RHYTHM.CLOCK_HEAD, RHYTHM.METHOD ({method}) and FACTION.HEAD ({user}). rhythm.ts rhythmClockLines reads 'Previous staging method' through guideOr('Main','RHYTHM.METHOD', old literal, {method}). faction.ts factionsBlock reads its header through guideOr('Main','FACTION.HEAD', old literal, {user}). Default output is byte-identical with and without the sections (tested). Every people.*/status.* call in guide-out matches the fixture.
REMAINING CHANGE: Optional, owned by nobody: add the new Main sections to tests/fixtures/guide-out-old.json 'sections' (Main file list) and raise `assert.equal(moved.length, 95)` to match, so guide-out also checks them. The test passes without this. src/ui/editor/guides.ts Main description does not mention RHYTHM.* (UI wording, not mine).

### hardcode#5 (r3/None, fixed)
DONE: Stage sentences moved to Main sections, text generated from the types.ts tables so it matches exactly: PEOPLE.AFFINITY.0..7 (STAGES behavior), PEOPLE.TASTE.-3..3 (TASTE_STAGES en), PEOPLE.OPENNESS.0..4 (contraceptionEn), PEOPLE.AXIS.<axis>.0..4 (AXIS_BANDS_EN, 30 sections), FACTION.STAGE.friendly/favorable/neutral/wary/hostile (behavior, keeps {{user}}). Readers use guideOr with the table string as fallback: inject.ts stageBehavior/tasteText/contraceptionText, axes.ts axesLinesEn (also feeds the Director), faction.ts stage line (the {{user}} replace still runs after). Numbers, ids, Korean labels, cell, mob and ko stay in types.ts. The updater-*.txt paraphrases are untouched.
REMAINING CHANGE: Optional: list the new sections in tests/fixtures/guide-out-old.json sections (Main) and raise the moved.length count.

### pipeline#13 (r3/None, fixed)
DONE: Added the STATUS.RECENT_CASH and STATUS.RECENT_POINT sections to main.txt right after STATUS.FIRST, text copied exactly ('Recent cash transactions (oldest first): {list}' and 'Recent Baekilmong point transactions (oldest first): {list}'). statusctx.ts already reads them through guideOr (round 2), so it needed no change.
REMAINING CHANGE: Optional, owned by nobody: in tests/fixtures/guide-out-old.json, add ["STATUS.RECENT_CASH","Recent cash transactions (oldest first): {list}"] and ["STATUS.RECENT_POINT","Recent Baekilmong point transactions (oldest first): {list}"] to the 'sections' list of the file that holds STATUS.FIRST. Then in tests/guide-out.test.mjs change assert.equal(moved.length, 95) to 97, or to 95 plus however many sections are added there in total. The calls fixture stays as it is.

### gupdd#3 (r3/None, fixed)
DONE: updater.ts buildUpdate: data.cues is now filled when affinity is numeric OR faction_rep is on and numeric (!factionQual). The guards that apply person cues and faction cues are untouched.
REMAINING CHANGE: tests/people-qual.test.mjs (not mine), test '갱신기: 정성 모드면 자료에 계기·단계·숫자가 없고…' at about line 64: change `const s = St.peopleSettings(qualState);` (the one inside that test) to `const s = St.peopleSettings({ ...qualState, $pp_num_faction_rep: '0' });` so `assert.deepEqual(input.data.cues, [])` holds again. The guide wording follow-up was not applied (text rule, and the files are not mine); see text_before_after.

### gphone#7 (r3/None, fixed)
DONE: In phonePrompt.ts rules(), DIRECT_ROOMS is no longer added when the request answers the owner's own text: `if (direct && body.room?.action?.type !== 'send')`. Refresh, invite and room-refresh requests are unchanged, and phone.txt was not touched. My new test checks that a send reply leaves the section out and a refresh keeps it.
REMAINING CHANGE: tests/phone.test.mjs line 102 (test 'reply prompt picks sections and carries the room packet', which uses action send): change `assert.match(sys, /### Direct rooms/);` to `assert.doesNotMatch(sys, /### Direct rooms/);`. It reads dist-test, so it will fail only after the next build.

### gshop#6 (r3/None, fixed)
DONE: In guides.ts DEFAULTS, the Cos guide is now `mallGuide(COS_COMMON).replace(" Haggling: ... written in words.", '')`, which drops only the haggling sentence from the 우주 쇼핑몰 default. Shop and Bm keep it, and shop.txt was not changed. No sentence was reworded. The test checks Cos has no 'Haggling:' while Shop and Bm do.
REMAINING CHANGE: tests/guide-out.test.mjs: append to LATER (JS source, as written): [" Haggling: the owner may refuse, counter, or accept; accept only when it makes sense for this owner, and then change that item's price: a lower figure, or another payment the owner agrees to take instead, written in words.", ""]. Only shop.talk.cos.secret contains it. Separately, that call still differs by '|진실' after '구분' in the partial line. That comes from another group's change, not mine.

### wiki#7 (r3/None, deferred)
DONE: Core part done. WikiRequest.images items accept `subject?: boolean`, and the filter is now `(x.subject ?? i === 0) || (x.label && pool.includes(x.label))`. A subject flag decides, and only old calls without the flag fall back to the item-0 rule, so nothing regresses before the ui change. The guide text and the 30-image cap are unchanged. The test checks subject:false is filtered, subject:true passes, and an unflagged item 0 behaves as before.
REMAINING CHANGE: src/ui/wiki.ts articlePrompt (~line 181), not my file: give EVERY image item an explicit boolean so core stops using position. Build `[...(subject && subject.cat !== 'ag' && subject.photo ? [{ e: subject, subject: true }] : []), ...entries(ctx).filter((e) => e.cat !== 'ag' && e.photo && e !== subject).map((e) => ({ e, subject: false }))]`, then `.filter((x, i, arr) => arr.findIndex((y) => y.e.photo === x.e.photo) === i)` and `.map(({ e, subject }) => ({ name: e.photo.replace(/#.*$/, ''), label: e.name, subject }))`. It must set subject: false on non-subject items, not leave it undefined, or core falls back to the old item-0 rule.

### items#7 (r3/None, fixed)
DONE: Applied the wallet part. readWallet no longer cuts the log with slice(-400). Added compactWallet(w, alive?). Once the log passes 400 rows it drops the oldest rows: first entries whose response is gone, then live entries after adding their amount to start, so the balance stays the same. The row just added is never dropped. Without alive it does not trim. addWalletEntry takes an optional 3rd argument alive. Inside wallet.ts, adjustWallet and syncWalletToStatus pass their alive. walletBalance and the id scheme are unchanged. The items.ts part was already done in round 2.
REMAINING CHANGE: Outside my files: these addWalletEntry callers should pass the alive set as a 3rd argument, otherwise the ledger grows past 400 (the cap is soft without alive): src/host/people.ts:399 and :404 (report.wallet / report.points loops: `addWalletEntry(w, {...e, src:'story'}, aliveAnchors(chat))`), src/ui/shop.ts:351 and :606, src/ui/malls.ts:118, :286, :418, :442, src/core/points.ts:104 (syncPoints, which already has the chat). Use aliveAnchors(chat) from core/wallet on the chat they already hold. tests/wallet.test.mjs uses dist-test, so it was not run here (no build allowed).

### wiki#8 (r3/None, deferred)
DONE: Not applied. The whole fix is in src/host/install.ts (installWikiPack, checkInstall, dropWikiPack), which I do not own. After that change, src/ui/editor/install.ts:163 (`if (!s?.wikiPack)`) and manage.ts need no change: they re-download on their own once checkInstall reports wikiPack=false for a stale pack.
REMAINING CHANGE: src/host/install.ts: (1) In installWikiPack, add `digest?: unknown` to the index type. After the existing length/head checks and the setItemItem(WIKI_KEY, text), add `if (typeof index.digest === 'string') await risuai.pluginStorage.setItem('goei:wikibase-digest', index.digest);`. (2) Add `async function wikiPackStale(): Promise<boolean>`. It returns false when !storedWikiPack() or !UPDATE_BASE. Otherwise, inside try/catch: `const idx = JSON.parse((await getText('wiki-base.json')).replace(/^﻿/, ''));`. If typeof idx.digest !== 'string', return false. `const saved = await risuai.pluginStorage.getItem('goei:wikibase-digest');` and return `saved !== idx.digest`. On any error, return false. (3) In checkInstall, change line 61 to `wikiPack: packInLore || (!!storedWikiPack() && !(await wikiPackStale())),`. (4) In dropWikiPack, also `await risuai.pluginStorage.removeItem('goei:wikibase-digest').catch(() => {});`. Compare against the release index digest, not the card manifest's wiki.digest. Optional, needs the owner's OK for any new badge text: manage.ts row 218 could reuse the stale flag so the 받기 button shows.

### wording#1 (r3/None, deferred)
DONE: Partly fixed in manage.ts, the part in my files. A board failure is now labelled with the name of the site being viewed, BOARD_NAME[boardSiteNow()], taken from the existing names in core/boards.ts. Before, it was always '괴담넷'. This applies to the status-check row and the 실패 기록 page. The diagnostic bundle now records `failures.gnet` as {site, reason, raw}. So a 연어 마켓 failure is no longer shown as 괴담넷. Still missing: failures saved for sites you are not currently viewing (and clearing them). That needs new exports in src/ui/gnet.ts, which I do not own.
REMAINING CHANGE: src/ui/gnet.ts: add `export function boardFailures(): { site: BoardSite; name: string; reason: string; raw: string }[] { const out = []; for (const s of BOARD_SITES) { const u = s === uiSite ? gnet : uiSaved.get(s); if (u?.failure) out.push({ site: s, name: BOARD_NAME[s], reason: u.failure.reason, raw: u.failure.raw }); } return out; }`. Do not call uiFor, because it creates empty uiSaved entries. Also add `export function clearBoardFailures(): void { gnet.failure = null; for (const u of uiSaved.values()) u.failure = null; }`. Then in src/ui/editor/manage.ts: in statusPage `fails`, replace the gnet term with `...boardFailures().map((f) => `${f.name}: ${f.reason}`)`. In logPage, replace `fail(BOARD_NAME[boardSiteNow()], gnet.failure)` with `boardFailures().map((f) => fail(f.name, f)).join('')`. In diagBundle, set `gnet: boardFailures().map((f) => ({ site: f.site, reason: f.reason, raw: f.raw }))`. In man-clear-fail, call `clearBoardFailures()` instead of `gnet.failure = null`. Then the boardSiteNow/BOARD_NAME imports in manage.ts can go if they are unused. tests/fix3-misc.test.mjs wording#1 asserts the interim `fail(BOARD_NAME[boardSiteNow()], gnet.failure)`, so update that assertion when this lands.

### lplumb#8 (r4/None, fixed)
DONE: 가-11: I removed the four generic keys. 관계자 외 출입금지 and 중앙제어실 came off 남해지사 · 시설, and 쇼룸 and 카탈로그 came off 망상홈쇼핑 · 상품. The matching key lines in the card/extra-lore files are not mine to edit, so that part is deferred.
REMAINING CHANGE: card/extra-lore/부록_남해지사_시설.txt line 3: 'key: Leisure Zone, 휴무 구역, 남해술집, 숙면관리점, 종교활동실, 광차, 작업 대기 구역, 관계자 외 출입금지, 옛 중앙시스템, 중앙제어실' -> 'key: Leisure Zone, 휴무 구역, 남해술집, 숙면관리점, 종교활동실, 광차, 작업 대기 구역, 옛 중앙시스템'. card/extra-lore/부록_망상홈쇼핑_상품.txt line 3: remove ', 쇼룸, 카탈로그' so the line ends at '…, 불운 포스트잇, 계란무드등'.

### lscene#13 (r4/None, fixed)
DONE: 가-68: I put the original key AMUSEMENT THEME PARK back on 유쾌 테마파크. The KEY_EDITS line in tools/build_lite_card.py still strips that key from the card lorebook. That file is not mine, so that part is deferred.
REMAINING CHANGE: tools/build_lite_card.py line 466 in KEY_EDITS: delete the line "    '유쾌 테마파크': (['AMUSEMENT THEME PARK'], [])," so the card build keeps the original key.

### lplumb#5 (r4/None, fixed)
DONE: 나-23, option ① (add it): I added the record '관리국 · 하나의 건물' at the top of the appendix records. Its keys are '관리국, 가짜 관리국, 사장', its title is 'SECRET — no one knows', and its body is the owner's 11-02 text. I left card/extra-lore/비밀_관리국_하나의_건물.txt and directory.json unchanged. Unit tests that pin the appendix count now fail as expected.
REMAINING CHANGE: tests/world-data.test.mjs line 14: assert.equal(worldRecords('appendix').size, 5) -> 6. tests/world-data.test.mjs line 52: '55 + 14 + 63 + 11 + 5' -> '55 + 14 + 63 + 11 + 6'. tests/qc-loader-build.test.mjs line 70: in the expected array '[55, 17, 63, 11, 4, 78]', change 4 to 6 (it was already stale at 5 before this change; it takes effect after a build).

### gcross#3 (r4/None, already_fixed)
DONE: 가-1: the Cos guide already drops the haggling sentence. src/core/guides.ts DEFAULTS has Cos: mallGuide(COS_COMMON).replace(" Haggling: ... written in words.", '') (uncommitted, not my file, applied in an earlier round). shop.txt is unchanged as the item says.
GUIDE-OUT LATER PAIRS: [" Haggling: the owner may refuse, counter, or accept; accept only when it makes sense for this owner, and then change that item's price: a lower figure, or another payment the owner agrees to take instead, written in words.", ""]  (needed for shop.talk.cos.secret; only that call has TALK, so a global pair is safe)

### gshop#3 (r4/None, fixed)
DONE: 가-7: the SHELF_SECRET 설명 wording no longer asks for an origin.
GUIDE-OUT LATER PAIRS: ["where it supposedly comes from and how to use it (출처·사용법)", "what it is and how to use it (사용법)"]

### gshop#7 (r4/None, fixed)
DONE: 가-8: deleted the second sentence of the SHOP_JUDGE bullet (updater only). SHOP_RULE and WHERE_* were not touched. This is the same edit as gcross#5.
GUIDE-OUT LATER PAIRS: none (no pinned call contains SHOP_JUDGE)

### gcross#5 (r4/None, fixed)
DONE: 가-15: same edit as gshop#7. The SHOP_JUDGE sentence about vending machines and online orders is removed.

### gmain#13 (r4/None, fixed)
DONE: 가-24: MAIN_TAG now puts the shop tag before the status line, so [▣] stays last. SHOP_RULE is unchanged. No code fallback holds the old text (grep finds it only in the fixture).
GUIDE-OUT LATER PAIRS: none (no pinned call contains MAIN_TAG; guide-out diff check showed no shop.guide/shop.rule change)

### gupdd#2 (r4/None, fixed)
DONE: 나-3 ①: the default 판정 표 now gives 도구 and 기기 「사용」 only. Tools and devices no longer become gear. The same table drives addItem (updater/story/shop) and shop shelf lines (shelfTraits), so both sides change together. Checked with a scratch bundle: 손전등/라이터/무전기/카메라 → {use:true}, 성냥 → {use:true, uses:10}, story 손전등 addItem → [true, undefined, 'device'].
REMAINING CHANGE: tests/itemstate.test.mjs test '갈래 표 …' (line ~130): change the title phrase '손전등(기기)은 장비·사용' to '손전등(기기)은 사용'. The asserts for 손전등, 라이터, 무전기 and 카메라 become { use: true }. The 성냥 assert becomes { use: true, uses: 10 }. The addItem assert `[s.list[0].use, s.list[0].equip, s.list[0].kind]` becomes [true, undefined, 'device']. Browser test tests/itemstate-browser.mjs:135 (default table row 12) changes ['도구','장비·사용'] to ['도구','사용'], and runs only when the settings screen is released. Note: the unit tests read dist-test/core.mjs, which is stale until the next build.

### items#1 (r4/None, fixed)
DONE: 나-4 ①: a store purchase (from 'store') now always becomes its own row even when a same-name item is owned. It gets its own anchor, price/walletId and a 'get' log, so newlyBought reports 「just bought」 and a reroll removes it together with the refund. Story and manual stacking is unchanged, and the user merges with 「합치기」. Same-turn duplicate ids already get an _n suffix. Probe: 소금 봉지(story,2) + 소금봉지(store,3,c2) → 2 rows, newlyBought(c2)=['소금봉지'], after reroll only 소금 봉지 2 remains.
REMAINING CHANGE: tests/items.test.mjs test '같은 이름이 또 들어오면 새 줄 없이 갱신, 둘 다 소모성이면 횟수를 더한다' (lines 25-33): change the second addItem from from: 'store' to from: 'story' (anchor 'c2') so the stacking asserts (length 1, desc '새로 샀다', uses 5, anchor 'c1') still hold. Optionally add a store case: a story 소금 봉지 plus a store 소금봉지 at anchor 'c2' gives it.list.length === 2 and newlyBought(it.list, 'c2').length === 1.

### shop#1 (r4/None, fixed)
DONE: 나-6 ①: covered by the same items.ts addItem change as items#1. Purchases from shop, mall, custom order and homeshop all go through addItem with from:'store', so each purchase is a separate row that the user can combine with 「합치기」.
REMAINING CHANGE: Same test edit as items#1 (tests/items.test.mjs lines 25-33).

### gshop#4 (r4/None, already_fixed)
DONE: 나-14 (1): talkPrompt already uses `const v = { line: lineOf(guide) };` and `SHELF_RULES(g, s, st, guide, src.truthMode ?? 'mix', …)`, done in an earlier round. Cos talk now carries the 진실 column, SHELF_SECRET and TRUTH.
GUIDE-OUT LATER PAIRS: ["+ 이름|값|쓰임|그림|무게|설명|효과|구분\\\"", "+ 이름|값|쓰임|그림|무게|설명|효과|구분|진실\\\""] ; ["one item per line (이름|값|쓰임|그림|무게|설명|효과|구분).", "one item per line (이름|값|쓰임|그림|무게|설명|효과|구분|진실)."] ; ["One item per line, exactly: 이름|값|쓰임|그림|무게|설명|효과|구분. ", "One item per line, exactly: 이름|값|쓰임|그림|무게|설명|효과|구분|진실. "]  — written as JS/JSON string literals. The real text in the fixture is `+ 이름|…|구분\"` (backslash-quote), so in the test file the first pair reads ["+ 이름|값|쓰임|그림|무게|설명|효과|구분\\\"", ...] like the existing {\\\"posts entries. The SHELF_SECRET insertion for talk is in the combined pair under gshop#8.

### gshop#8 (r4/None, fixed)
DONE: 나-16 (1): talk requests no longer repeat the shelf 구분 rules (SHELF_FEATURE/SHELF_PLAIN). Only TALK_FEATURE/TALK_PLAIN speak about 구분 in talk. Shelf, mall shelf and homeshop calls are unchanged. SHELF_RULES got a trailing `talk = false` parameter. I combined it with the guide/truthMode arguments that gshop#4 already passes.
GUIDE-OUT LATER PAIRS: One pair specific to shop.talk.cos.secret. Its context 'goods).\\n구분' occurs only there, because the shelf calls have SHELF_SECRET in between. It removes SHELF_FEATURE and adds the SHELF_SECRET + TRUTH_MIX text that gshop#4 brought in. As a JSON string pair: ["leave empty for ordinary goods).\\n구분: leave empty for ordinary goods. Mark exactly ONE item 「희귀」 — the single most special thing this shop has right now (a rare find, a one-off, the owner's pride), still something this shop sells; it may cost far more than the rest, and give it a vivid 설명. Mark 1 to 3 items 「특가:원래값」 (원래값 = the usual price as an integer) — goods the owner is selling below their usual price today, where 값 is the reduced price and 원래값 the usual price; give a reason in 설명 if it fits (재고 정리, 흠집, 유통기한). The 희귀 item is never also 특가.", "leave empty for ordinary goods).\\nFor this mall the 설명 column carries the catalogue's own account of the thing — what it is and how to use it (사용법), in the mall's voice; it never carries limits, side effects or warnings. Two effect columns, written independently. 효과 (≤ 40 chars) is what the CATALOGUE CLAIMS, in the mall's own voice — the only thing the buyer will ever see. Vary it from item to item across the whole shelf: a vague hint, a censored blank (???, 검열됨, [기밀], █████), a flat lie, a non-sequitur that has nothing to do with the thing, a wildly understated or overstated version — and now and then the plain truth. Never state a limit, side effect, danger or origin here: those are trade secrets. 진실 (≤ 60 chars, plain Korean, not 왈도체) is what the item REALLY does when used, including its catch or side effect if it has one; it is hidden from the player and read only by the story model, so write it precisely and concretely — it may match the claim, twist it, or contradict it outright. Write ? instead when even the catalogue does not know: then the story decides what happens the first time it is used. MIX the two: give roughly half the items a concrete 진실 and write ? for the rest, varying which ones. Among the concrete ones, at least one genuinely does what it claims and at least one does something else entirely."]. Apply it AFTER the 가-7 and 나-35 pairs (it already uses their new wording). The \\n in it is the two-character backslash-n, as in the existing LATER entries. Verified: with the full set of 7 pairs (the gshop#3, gcross#12, gcross#3 and gshop#4 pairs plus this one), every shop.* call matches. The remaining guide-out diffs (gnet.*, status.section, items.text, lore.locked) come from other agents' files.

### gupdc#6 (r4/None, fixed)
DONE: 나-17 ①: same edit as gupdd#2. The 도구/기기 rows are now 「사용」 only.
REMAINING CHANGE: Same test edits as gupdd#2 (tests/itemstate.test.mjs '갈래 표' block; tests/itemstate-browser.mjs:135).

### gcross#12 (r4/None, fixed)
DONE: 나-35 (1): the shelf 설명 no longer asks for a quantity, because quantity lives in 소모N. SHELF is shared by 상점, 우주 쇼핑몰, 포인트몰 and 망상홈쇼핑.
GUIDE-OUT LATER PAIRS: ["설명 ≤ 60 chars (what it is, condition, quantity).", "설명 ≤ 60 chars (what it is, condition)."]

### items#14 (r4/None, fixed)
DONE: 나-58 ①: same edit as gupdd#2. Tools and devices now get 「사용」 only by default.
REMAINING CHANGE: Same test edits as gupdd#2.

### mainreach#3 (r4/None, deferred)
DONE: 나-74 ①: fix the help text so it matches what happens. The text is only in src/ui/famtable.ts:249, which I do not own. hslog.ts needs no change under option ①.
REMAINING CHANGE: src/ui/famtable.ts line 249 helpBox text: replace '켜면 그 상점에서 한 일을 다음 메인 요청에 한 번 붙여요. 본문을' with '켜면 그 상점에서 한 일을 다음 메인 요청에 한 번 붙여요. 망상홈쇼핑은 다음 편성을 받기 전까지 본 방송 기록을 메인 요청마다 붙여요. 본문을'. No test pins it. Check the table foot at 390px phone width.

### malls#11 (r4/None, deferred)
DONE: 나-76 ①: 「폭 맞춤」 should fit the column width with no height cap. My part (owned): scaleOf in src/ui/homeshop.ts now returns -1 for 'fit' (0 stays 'auto'). Until hsplayer handles -1, the player treats it like auto (feed.scale > 0 is false, so fitScale runs), which is today's behaviour, so nothing breaks. The player part is in src/ui/hsplayer.ts, which I do not own.
REMAINING CHANGE: src/ui/hsplayer.ts: (1) After fitScale(), add: `/** 폭 맞춤(-1): 높이 제한·정수 맞춤 없이 칸 폭에 꼭 맞춘다 */\nfunction widthScale(w: number): number {\n  const wrap = stage?.closest<HTMLElement>('.hs-wrap');\n  const page = stage?.closest<HTMLElement>('.hs');\n  if (!wrap || !page) return 1;\n  const phone = page.classList.contains('hs-m');\n  const cs = getComputedStyle(wrap);\n  const inner = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);\n  const roomW = (phone ? inner : inner - 274) - 2;\n  return Math.max(0.25, roomW / w);\n}`. (2) In layout() (line ~211), replace `const k = feed.scale > 0 ? feed.scale : fitScale(w, h);` with `const k = feed.scale > 0 ? feed.scale : feed.scale === -1 ? widthScale(w) : fitScale(w, h);` and update the comment above it to '0 = 자동(보이는 자리에 맞춤), -1 = 폭 맞춤'.

### pipeline#14 (r4/None, fixed)
DONE: 나-83 ①: after a send, the 「사용」 chips are no longer hidden. They stay visible with the label 「보내는 중」 until the response settles them (then ITEM_USE_AT_VAR hides the box as before) or the 180 s late timer resets the label. If the user adds new items while waiting, only those show, with the normal 「다음 메시지에 사용」 label (the old behaviour for that case). waiting.ts is unchanged.
REMAINING CHANGE: Browser test tests/usebar-browser.mjs (run only at release for this screen) expects chips hidden after sending. Change: line ~118 `if (s.shown !== 0)` after send → expect s.shown === 1 with label '보내는 중' (add a label read to bar() if needed); step 2 (~137) and step 3 (~149) `s.shown` → expect shown with label 보내는 중; step 5 (~170) `if (s.shown) bad('실패 시험: 보낸 직후엔 숨어야 한다')` → expect shown with label 보내는 중; header comment line 2 「보내면 바로 숨음」 → 「보내면 이름표가 보내는 중」. Step 4 (added while waiting shows only the new one) is unchanged.

### shop#14 (r4/None, already_fixed)
DONE: 나-86 ①, shop side: already done in the working tree (uncommitted, earlier round). shop.txt has HEAD_REFS/HEAD_ASSIGN/HEAD_ORDERS/HEAD_NOTES sections with today's text. core/shop.ts material() and talkPrompt read them with guideOr(guide, …, old text), so the sent text is unchanged. The 1:1 consult (BmDesk) side is in files I do not own and is not done. (See the conflict note under hardcode#7.)
REMAINING CHANGE: BmDesk side, in files I do not own. (1) src/data/guides/bmdesk.txt: add `@@SECTION HEAD_REFS\n[참고 자료 — 백일몽에 대해 이 상담사가 알 수 있는 것]\n@@END` and `@@SECTION HEAD_PAST\n[최근 상담사 — 겹치지 말 것]\n@@END`. Add a note that the MAKE section (line 6) quotes [최근 상담사 — 겹치지 말 것] and must stay identical. (2) src/core/bmdesk.ts:168: `[참고 자료 — 백일몽에 대해 이 상담사가 알 수 있는 것]\n${src.refs}` -> `${guideOr('BmDesk', 'HEAD_REFS', '[참고 자료 — 백일몽에 대해 이 상담사가 알 수 있는 것]')}\n${src.refs}`. Line 178: `\n\n[최근 상담사 — 겹치지 말 것]\n${past}` -> `\n\n${guideOr('BmDesk', 'HEAD_PAST', '[최근 상담사 — 겹치지 말 것]')}\n${past}` (import guideOr from './guides').

### ggnet#6 (r4/None, fixed)
DONE: 가-4: Moved the views/upvotes scale line out of the LB section (sent to post/comment/refreshOne) and appended it unchanged as the last line of BOARD.GUIDELINE (read only by refresh). Covers GNet/Gal/Wpf/Salmon, which all come from gnet.txt.
GUIDE-OUT LATER PAIRS: Pairs are given in call form: each string equals the substring as it appears in OLD.calls/BASE strings, i.e. json.dumps(text, ensure_ascii=False)[1:-1]. Pair A must come BEFORE pair B in LATER. A: ["\\nThis is an active public community with many silent readers, not a nearly empty board. Typical new board entries have roughly 500–8,000 views and 20–300 upvotes; widely shared or older popular topics can reach tens of thousands of views and hundreds of upvotes. These are scale guides, not fixed floors or matched ratios: vary irregularly by age, topic and popularity, with upvotes below views. Spread posting times plausibly before narrative time so readership can accumulate; do not make every post seconds old with single-digit votes and tens of views. Existing counts never decrease and may grow with elapsed time and continued discussion.", ""]  B (this also covers ggnet#8's BOARD sentence): [" There is no per-post minimum. Saved threads are not capped at six; user-action reactions follow their separate contract.", "\\nThis is an active public community with many silent readers, not a nearly empty board. Typical new board entries have roughly 500–8,000 views and 20–300 upvotes; widely shared or older popular topics can reach tens of thousands of views and hundreds of upvotes. These are scale guides, not fixed floors or matched ratios: vary irregularly by age, topic and popularity, with upvotes below views. Spread posting times plausibly before narrative time so readership can accumulate; do not make every post seconds old with single-digit votes and tens of views. Existing counts never decrease and may grow with elapsed time and continued discussion."]  (Here \\n means the two characters backslash and n, as in the existing LATER entries.) I checked all of my pairs together with a script against tests/fixtures/guide-out-old.json: every gnet.* and phone.view call I touched then matches.

### gcross#9 (r4/None, fixed)
DONE: 가-17: Removed 'process blocks' from the AUTO.GUIDELINE ban.
GUIDE-OUT LATER PAIRS: ["no markup, process blocks or text outside the object.", "no markup or text outside the object."]  (4 gnet.refresh.* calls)

### ggnet#10 (r4/None, fixed)
DONE: 가-18: Removed the nonexistent 'End of the log' marker sentence and the two empty headings from the SYSTEM section. gnetPrompt.ts systemText still passes the extra arguments and the .replace; both are harmless and keep old saved SYSTEM texts working, so I left them.
REMAINING CHANGE: tests/gnet.test.mjs line 166 (real-card refresh test) asserts the removed heading. Replace `assert.ok(sys.includes('## User-controlled protagonist (narrator reference only)'));` with `assert.ok(!sys.includes('## User-controlled protagonist') && !sys.includes('End of the log'));`. I checked this against a fresh core bundle built in scratch, and gnet.test.mjs passes with it.
GUIDE-OUT LATER PAIRS: Call form, 8 gnet.* calls: ["\\nThe end of the chat log will be marked with `--- End of the log ---`. Ignore all other similar markers in the middle.", ""], ["\\n## User-controlled protagonist (narrator reference only)\\n\\n## Universe Settings\\n", ""]

### ggnet#8 (r4/None, fixed)
DONE: 가-20: Deleted the stale 'no per-post minimum / not capped at six / separate contract' sentences from BOARD.GUIDELINE. Also applied the verified FINAL's second edit in AUTO.GUIDELINE, which removes the stale 'six'. Neither edit touches __GN_CMT_RANGE__.
GUIDE-OUT LATER PAIRS: The BOARD part is pair B under ggnet#6, which must follow pair A there. AUTO part: ["Retained comment totals may exceed six; the initial new-post comment range is not a retention cap.", "The initial new-post comment range is not a retention cap."]

### ggnet#9 (r4/None, fixed)
DONE: 가-21: Removed the second, fixed per-post maximum from ACTIVITY.GUIDELINE. __GN_ACT_RANGE__ is still there.
GUIDE-OUT LATER PAIRS: Filled form, 3 calls: ["Return only NEW comments: 0–4 per post, each at most", "Return only NEW comments, each at most"]

### gphone#14 (r4/None, fixed)
DONE: 가-27: Deleted the repeated knowledge/endpoint sentence in VIEW.SIDE. Also applied FIXPLAN steps (2) and (3), which the verified FINAL says go in the same change: the repeated 'leave unresolved' sentences in VIEW.SIDE.SPEAK.1 and VIEW.MIND. VIEW.COMMON is untouched.
GUIDE-OUT LATER PAIRS: phone.view (plain text, no escaping): [" Limit each speaker to established knowledge and keep the exchange within the narrative's current endpoint.", ""]

### ggnet#5 (r4/None, fixed)
DONE: 나-11 option ①: The DM reply request now starts its guideline with the current board's own '## About the board' paragraph, taken from the evaluated LB section. Each site gets its own text and no new guide text is added. gnet.dm grows by about 150–320 tokens depending on the site.
GUIDE-OUT LATER PAIRS: gnet.dm, call form: ["\\nROLE BINDING identifies speaker (the NPC correspondent)", "\\n## About the board\\n괴담넷 is a closed forum used only by people inside the anomaly trade: Bureau agents, employees of the rival organizations, freelancers and association members, brokers, salvagers, cleanup crews. There are no ordinary civilians, no curious outsiders, no cranks; everyone here is in the business and knows everyone else is, so nobody explains basics or asks 「이게 뭐예요?」. Aliases hide real names and affiliations, but a user's side is often guessable from jargon and gripes. The board reads like a trade's internal forum: site warnings, 회수물 and salvage trades, 의뢰 offers and pricing, pay and rank complaints, equipment talk, gossip about the other organizations, drinks after a cleanup, veterans correcting rookies. Treat users as people in this world, not story readers or game players. Perspective rule: the world events and reports supplied to every board are the same; what differs is who sees them and how. Write every post and comment as what THIS board's users could actually know and how they would frame it, never as a neutral report of the event.\\n\\nROLE BINDING identifies speaker (the NPC correspondent)"]

### gnet#12 (r4/None, deferred)
DONE: 나-43 option ①: The guide part (removing the fixed maximum of 4) is done, using the same edit as ggnet#9. The help-text part is in files I do not own.
REMAINING CHANGE: Drop 「새로고침이나」 and name the flows that actually use the setting. (1) src/core/setdef/gnet.ts:27 help: `새로고침이나 답장 때 지난 글에 새로 붙는 댓글 수예요(${COUNT_RANGE.act[0]}~${COUNT_RANGE.act[1]}). 바뀐 글마다 이 안에서 붙어요` -> `새 글·댓글·답장 때 지난 글에 새로 붙는 댓글 수예요(${COUNT_RANGE.act[0]}~${COUNT_RANGE.act[1]}). 바뀐 글마다 이 안에서 붙어요`. (2) src/ui/famtable.ts:88: ['활동 댓글 수', '새로고침이나 답장 때 지난 글에 새로 붙는 댓글의 수예요.'] -> ['활동 댓글 수', '새 글·댓글·답장 때 지난 글에 새로 붙는 댓글의 수예요.']
GUIDE-OUT LATER PAIRS: Same pair as ggnet#9: ["Return only NEW comments: 0–4 per post, each at most", "Return only NEW comments, each at most"]

### gphone#9 (r4/None, fixed)
DONE: 나-46 option (가): VIEW.SIDE now asks for the names as written in the settings, so face photos match.
GUIDE-OUT LATER PAIRS: phone.view: ["use recognizable character nicknames for participant names", "use each character's name as written in the universe settings for participant names"]

### pipeline#10 (r4/None, deferred)
DONE: 나-82 option ① (show 'tokens the plugin added' in the call log). The change lies entirely in src/body.ts and src/host/trace.ts, which I do not own. Nothing was changed in lore.ts.
REMAINING CHANGE: (1) src/host/trace.ts: add `added?: number;` to interface TraceMain (next to totalTokens). Give traceMain an optional third parameter `added?: string[]` (the plugin-inserted texts). Inside the existing setTimeout, after totalTokens, set `if (added) main.added = added.reduce((n, t) => n + tokens(t), 0);`. (2) src/body.ts onBeforeRequest (the liteNow/ctx block): in each step that inserts plugin text, collect the inserted strings into an array: the lore block from fixLore, mctx from moduleContext, the status/inventory/homeshop/people/img-prompt system blocks. The simplest way is to diff the message contents before and after the block of steps ('로어' through '이미지 지침') and sum the new/grown parts. Pass that array to the existing traceMain call. (3) Show `플러그인이 더한 토큰 N` next to totalTokens wherever the call log renders main.totalTokens. Do not auto-trim anything, and do not change loreOptions.

### pipeline#9 (r4/None, deferred)
DONE: 나-84 option ①: Rename only the 괴담톡 chip label; the behaviour stays the same. The label is in src/core/advanced.ts, which I do not own. src/core/focus.ts is untouched, as the plan requires.
REMAINING CHANGE: src/core/advanced.ts:130: `chips: [chip('ctx_focus', '장면 관련 먼저', 1), chip('ctx_messages', '메시지', 1, '$ph_context_messages'), chip('ctx_notices_on', '공지', 1, '$ph_context_announcements')],` -> `chips: [chip('ctx_focus', '장면에 나온 것만', 1), chip('ctx_messages', '메시지', 1, '$ph_context_messages'), chip('ctx_notices_on', '공지', 1, '$ph_context_announcements')],`. Leave line 90 (the gn chip) as the FINAL says. No unit test asserts the label.

### wiki#14 (r4/None, fixed)
DONE: 나-88 option ①: Wiki request labels now carry names only. The instructions moved to the editable wiki guide: the per-document priority went into NW.GUIDE 'INPUTS AND PRIORITY', and avoiding already-written docs went into NW.AUTO_TITLE. The previous-article priority is already in NW.PREVIOUS. The '[이전 위키' and '이미 쓴 문서' prefixes are kept.
REMAINING CHANGE: tests/wiki.test.mjs:193: change `u.endsWith('[사용자 작성 지침 — 모든 문서 공통]\n무섭게')` to `u.endsWith('[사용자 작성 지침: 모든 문서 공통]\n무섭게')`. Checked: it passes against a fresh scratch bundle. Browser test, to update before release only: tests/qc-modules-browser.mjs:960 '[사용자 작성 지침 — 모든 문서 공통]\n존댓말로 쓸 것' -> '[사용자 작성 지침: 모든 문서 공통]\n존댓말로 쓸 것'; :961 '[사용자 작성 지침 — 이 문서만, 공통 지침과 부딪치면 이쪽을 우선]\n출구를 자세히' -> '[사용자 작성 지침: 이 문서만]\n출구를 자세히'.

### gcross#7 (r4/None, fixed)
DONE: 가-3: Removed the duplicate {style} vocabulary paragraph from SEXUAL.PROMPT_RULES. The vocabulary rule now goes out once, in the per-person line of SEXUAL.WRITER (checked: the rendered section has 자지 exactly once). The code fallback and tests are in files I don't own, so they are deferred. The '{style}' var is left unused but harmless.
REMAINING CHANGE: (1) src/core/people/sexual.ts:63, in the sexualPromptRules fallback template literal, delete `${explicit ? explicitStyle() : plainStyle()} ` (with its trailing space) so it reads '...each naming something specific. Paraphilia is chosen from this closed list...'. The `{ style: ... }` vars object can stay. Without this, guide-out test 4 fails. (2) tests/fixtures/guide-out-old.json sections.UpdaterExtra entry 'SEXUAL.PROMPT_RULES': in its body, change 'each naming something specific. {style} Paraphilia' to 'each naming something specific. Paraphilia' (test 1 compares bodies directly and has no LATER mechanism). (3) tests/people-sexual.test.mjs:60 currently asserts `/자지/.test(Sx.sexualPromptRules(true)) && !/자지/.test(Sx.sexualPromptRules(false))`. Replace it with `assert.ok(!/자지/.test(Sx.sexualPromptRules(true)) && !/자지/.test(Sx.sexualPromptRules(false)) && (sec.match(/자지/g) ?? []).length === 1, '어휘 규칙은 인물별 문장에 한 번만');`. I verified that sec has exactly 1 match.
GUIDE-OUT LATER PAIRS: ["each naming something specific. Vocabulary rule, mandatory: write like adults talking dirty in private. Name body parts and acts with the crude Korean words actually used (`자지`, `보지`, `젖`, `엉덩이`, `박다`, `빨다`, `싸다` and similar), and name positions and play plainly. Euphemism, medical or academic terms, poetic wording, and softened phrasing are errors; if a sentence could appear in a romance novel, rewrite it cruder. Paraphilia is chosen", "each naming something specific. Paraphilia is chosen"], ["each naming something specific. Use the 0.10.7 style: blunt everyday sex words and slang, crude terms included, with no euphemism, clinical vocabulary, literary wording, or psychological analysis. Keep it direct but do not force the stronger explicit vocabulary examples. Paraphilia is chosen", "each naming something specific. Paraphilia is chosen"]  (verified: with these pairs, sexual.writer.both/desire/paraphilia and sexual.rules equal the fixture)

### gupdd#4 (r4/None, fixed)
DONE: 가-9: Same edit as gcross#7 (one {style} removal in SEXUAL.PROMPT_RULES).
REMAINING CHANGE: Same as gcross#7: sexual.ts:63 fallback, guide-out-old.json SEXUAL.PROMPT_RULES body, people-sexual.test.mjs:60.
GUIDE-OUT LATER PAIRS: Same two pairs as gcross#7.

### gcross#10 (r4/None, fixed)
DONE: 가-13: Removed {knowledge_rule} from the Director MAIN_NOTE head. The People records block already carries this rule.
REMAINING CHANGE: (1) src/core/people/director.ts:239, directorBlock fallback template: delete `${knowledgeRule()} ` so it reads '...not events, not lines to say. Keep the roleplay's established output language...'. The knowledge_rule var and knowledgeRule import can stay (the import is still used for vars). Without this, guide-out test 4 fails. (2) tests/fixtures/guide-out-old.json sections.Director entry 'MAIN_NOTE': in its body, change 'not lines to say. {knowledge_rule} Keep' to 'not lines to say. Keep'.
GUIDE-OUT LATER PAIRS: ["not lines to say. Do not have a character mention or act on a secret or fact they have not witnessed, learned, or otherwise demonstrably known. Never invent how they acquired information. Keep facts, beliefs, guesses, and misunderstandings distinct. A missing record does not prove ignorance: actual evidence in the conversation may establish knowledge. Keep the roleplay's", "not lines to say. Keep the roleplay's"]  (verified: director.block then equals the fixture)

### gmain#11 (r4/None, fixed)
DONE: 가-22: Same edit as gcross#10 (Director MAIN_NOTE {knowledge_rule} removed).
REMAINING CHANGE: Same as gcross#10: director.ts:239 fallback and the guide-out-old.json Director MAIN_NOTE body.
GUIDE-OUT LATER PAIRS: Same pair as gcross#10.

### gupdc#9 (r4/None, fixed)
DONE: 나-18, option ① (recommended): drop the duplicate vocabulary paragraph. This is the same {style} removal as gcross#7/gupdd#4, already applied.
REMAINING CHANGE: Same as gcross#7 (sexual.ts:63 fallback, guide-out-old.json SEXUAL.PROMPT_RULES body, people-sexual.test.mjs:60).
GUIDE-OUT LATER PAIRS: Same two pairs as gcross#7.

### gupdd#5 (r4/None, fixed)
DONE: 나-19, option A (recommended): the code now follows the guide's closing rules. 확인 → score at least 80, 해소 → 0, 묻음 keeps the score, a reopen keeps the old score, and closing no longer hides the last clue's weight. CONFLICT: A also said to change the guide's clue numbers to the code's +10/+25/+40, but 나-53 ① and 나-77 ① (also approved as recommended) say the opposite: set the code to the guide/original values +2/+5/+10 and leave the guide unchanged. Two of the three items agree, so I set the code weights to +2/+5/+10 and left the guide numbers as they are; the guide's closing text stays too, since it is now true. Verified scores: [시작]+[단서·강] = 20; adding [해소·확인] gives 80 closed; [시작]+[단서·중]+[해소·해소] gives 0; reopen after 묻음 gives 15 (the start +10 counts only on the first open).
REMAINING CHANGE: tests/people-updater.test.mjs:206 (test '문서·의심: 종류 검사, 꺼진 기능, 의심 해소는 접는다') now fails on purpose because close no longer replaces the last clue. Change the line to: assert.deepEqual(su.map((e) => e.text), ['[시작] 유저가 명단을 봤다는 말을 의심', '[단서] 비밀번호를 알고 있었다', '[해소] 오해로 밝혀짐'], '해소는 앞 항목을 대체하지 않는다 (점수 유지)'); The test title can become '... 의심 해소는 앞 항목을 남긴다'.

### gupdc#7 (r4/None, fixed)
DONE: 나-53, option ① (recommended): the code now uses the original/guide values (약 +2, 중 +5, 강 +10 and the negatives; 확인 at least 80; 해소 0). Guide text unchanged. This is the same updater.ts change as gupdd#5.
REMAINING CHANGE: Same test edit as gupdd#5 (tests/people-updater.test.mjs:206).

### hardcode#14 (r4/None, deferred)
DONE: 나-54, option (나) (recommended): keep the 6,000 clamp and add one line to the hypa cap help text. That text is in src/core/setdef/people.ts, which I do not own, so nothing changed in rhythm.ts and the edit is deferred.
REMAINING CHANGE: src/core/setdef/people.ts:94, key 'hypa_cap': help: '요약 전체 글자 상한' → help: '요약 전체 글자 상한. Director 는 최대 6,000자'

### peoplecore#12 (r4/None, fixed)
DONE: 나-77, option ① (recommended): code changed to match the guide (+2/+5/+10, 확인 at least 80, 해소 0, reopen keeps the score, close does not drop the last clue's weight). Same updater.ts change as gupdd#5/gupdc#7. Comments updated. npx tsc --noEmit is clean.
REMAINING CHANGE: Same test edit as gupdd#5 (tests/people-updater.test.mjs:206).

### gcross#4 (r4/None, fixed)
DONE: 가-2: removed ', as the final line' from STATUS.RULE.ONE_LINE in main.txt, exactly as approved.
REMAINING CHANGE: src/core/world/statuscols.ts:201 (twin fallback, not my file): guideOr('Main', 'STATUS.RULE.ONE_LINE', '- Output exactly one [▣] at the very end of every response, as the final line.') -> '- Output exactly one [▣] at the very end of every response.' (tests/guide-out.test.mjs test 3b needs it). tests/fixtures/guide-out-old.json sections.Main STATUS.RULE.ONE_LINE body: make the same edit (test 1 compares section bodies directly, a LATER pair does not cover test 1).
GUIDE-OUT LATER PAIRS: ["- Output exactly one [▣] at the very end of every response, as the final line.", "- Output exactly one [▣] at the very end of every response."]

### gmain#6 (r4/None, fixed)
DONE: 가-6: removed the 'points are spent only at the Welfare Mall' clause from STATUS.RULE.POINTS in main.txt.
REMAINING CHANGE: src/core/world/statuscols.ts:183 (twin fallback 'points:', not my file): same edit, 'points and won never convert, and points are spent only at the Baekilmong point shop (Welfare Mall).' -> 'points and won never convert.' (test 3b). tests/fixtures/guide-out-old.json sections.Main STATUS.RULE.POINTS body: same edit (test 1).
GUIDE-OUT LATER PAIRS: ["points and won never convert, and points are spent only at the Baekilmong point shop (Welfare Mall).", "points and won never convert."]

### gmain#12 (r4/None, fixed)
DONE: 가-23: deleted the 'If a "Really" list follows...' sentence (with its leading space) from INVENTORY.NOTE in main.txt.
REMAINING CHANGE: src/core/items.ts:774 (INVENTORY_NOTE fallback, not my file): delete ' If a "Really" list follows, those items\' real effects differ from or go beyond their labels: what happens follows the Really line, nobody knew it beforehand, and the protagonist learns it only through what happens.' so the fallback reads '... A broken item does not work. Never print this list back.' (test 3b). tests/fixtures/guide-out-old.json sections.Main INVENTORY.NOTE: same deletion (test 1).
GUIDE-OUT LATER PAIRS: [" If a \"Really\" list follows, those items' real effects differ from or go beyond their labels: what happens follows the Really line, nobody knew it beforehand, and the protagonist learns it only through what happens.", ""]

### lplumb#14 (r4/None, fixed)
DONE: 가-66: LORE.LOCKED in main.txt now says to put the unlock tag 'on its own line after the prose'.
REMAINING CHANGE: src/core/lore.ts:523 unlockHint fallback (not my file): '... write [🔓|${e.name}] on its own line at the very end.' -> '... write [🔓|${e.name}] on its own line after the prose.' (test 3b). tests/fixtures/guide-out-old.json sections.Main LORE.LOCKED body: same edit (test 1).
GUIDE-OUT LATER PAIRS: ["on its own line at the very end.", "on its own line after the prose."]

### gmain#7 (r4/None, fixed)
DONE: 나-12, option 1 (shorten). In unwrapScenes (src/core/request.ts), a scene card that already has an assistant reply after it keeps only the last blank-line-separated chunk of its card body (CONTEXT: Subject/Companions). Only the text between the %%SCENE_CARD%% markers is cut, so text outside the card and the Situation/extra merge are kept. The latest unanswered card is sent in full. Checked with a quick bundle run: an answered card gives 'Subject: X\nCompanions: Y\n\nSituation:\nextra note', and an unanswered card stays complete. Existing unwrapScenes tests still pass.
REMAINING CHANGE: tests/core.test.mjs (not my file): add a unit test next to the existing unwrapScenes tests. An answered card ('%%SCENE_CARD:7b7d%%\nCOMMON\n\nCreate an opening.\n\nSubject: X\nCompanions: Y\n%%/SCENE_CARD%%', then an assistant message) becomes 'Subject: X\nCompanions: Y'. The last card with no assistant reply after it stays complete.

### gmain#9 (r4/None, fixed)
DONE: 나-41, option ①: in the POSITIVE example of the asset.txt PROMPT section, paragraph [2] now names the character ({first}) instead of 'She'.
REMAINING CHANGE: src/core/asset.ts:190 fallback in assetPrompt (not my file): "'[2] She glanced at the figure standing by the desk, her expression hardening into something sharper.'," -> "`[2] ${first} glanced at the figure standing by the desk, her expression hardening into something sharper.`," (test 3b). tests/fixtures/guide-out-old.json sections.Asset PROMPT body: '[2] She glanced' -> '[2] {first} glanced' (test 1).
GUIDE-OUT LATER PAIRS: ["[1] Lee Ha-neul walked into the room with a quiet smile.\n[2] She glanced", "[1] Lee Ha-neul walked into the room with a quiet smile.\n[2] Lee Ha-neul glanced"], ["[1] Eileen walked into the room with a quiet smile.\n[2] She glanced", "[1] Eileen walked into the room with a quiet smile.\n[2] Eileen glanced"]

### gshop#12 (r4/None, fixed)
DONE: 나-48, option (1): removed the three sample 왈도체 lines from COS_COMMON in src/core/guides.ts. The Waldo line and the how-to sentences are kept. src/ui/malls.ts banners are untouched.
GUIDE-OUT LATER PAIRS: [" Like: 「굉장하고 강한 상품, 만일 우리에게 물어보면」, 「입금 확인되면 상품 간다, 즉시」, 「환불 다음 기회」 — do not reuse these or the Waldo line.", " Do not reuse the Waldo line."]

### guides#3 (r4/None, fixed)
DONE: 나-51, option A: the fallback behaviour is unchanged (a blank section still sends the default text). Core part done: src/core/guides.ts now exports blankUsesDefault(name, section). It returns true for every section of Common/Main/UpdaterExtra/Asset. For the other guides it returns true only for sections read with a fallback: Director SEARCH/PASS2/OUTPUT/APPLY.*/REPAIR/MAIN_NOTE; Shop/Cos/Bm TRUTH_*/SECRET_NOTE/WHERE_*/ASSIGN_*/HEAD_*; the GNet family (GNet/Gal/Wpf/Salmon) LANGUAGE, IMPORTANT_NOTE, POST.TAG_RULE, POST.TAG_FORMAT, COMMENT.TIME_RULE, KEYFIGURES.FORMAT, SAMPLING, ACTION.COMMENT, ACTION.POST_REFRESH, PUBLIC.ACCESS, RETRY.FORMAT, DM.QUOTE_UNKNOWN; Phone LANGUAGE/RETRY.REFRESH; Hs MAIN_CONTEXT. Each was checked in the readers (guideOr, guideSec, orOld or `read() || old`). The on-screen note itself is in the editor file, which I do not own, so it is listed as a deferred change.
REMAINING CHANGE: src/ui/editor/guides.ts (not my file): add blankUsesDefault to the import from '../../core/guides'. In guidePage rows, replace `<span class="gw-ftok">${tokens(p.body) ? `${tokens(p.body).toLocaleString()}토큰` : ''}</span>` with `<span class="gw-ftok">${tokens(p.body) ? `${tokens(p.body).toLocaleString()}토큰` : blankUsesDefault(name, p.title) ? '비우면 기본 글이 쓰여요' : ''}</span>`.

### guides#4 (r4/None, fixed)
DONE: 나-52, option A: sections that no request reads are no longer in that guide's default text (no section text was changed). New dropSections() in src/core/guides.ts. Shop drops the mall-only sections: SHELF_SECRET, SECRET_NOTE, INFO, ORDER, TALK_OUTPUT_INFO, TALK_OUTPUT_ORDER, TRUTH_ALL/MIX/NONE, ASSIGN_ROLE_USEFUL/BROAD, ASSIGN_RULE, HEAD_ASSIGN, HEAD_ORDERS. Cos drops SHOP_RULE, OWN_SHOPS, SHOP_JUDGE, WHERE_ANY, WHERE_SHOP. Bm drops those five plus TALK*, KICK_ON/OFF, SELL, TALK_OUTPUT*, INFO, ORDER, THOUGHTS_TALK/SELL, SHELF_SECRET, TRUTH_*, SECRET_NOTE, HEAD_NOTES, HEAD_ORDERS. Each drop was checked by grep: shop.ts whereLine/shopRule/shopJudgeGuide/ownShopsLine read 'Shop' only; INFO/ORDER/TALK_OUTPUT_INFO/ORDER/SHELF_SECRET are used only when guide==='Cos'; {truth_rule} appears only in SHELF_SECRET; src.assign and src.orders are set only in ui/malls.ts (orders only for cos); Bm talk goes to deskRun and the mall talk path is cos-only (ui/malls.ts:540). shop.txt itself is unchanged, so SHOP_RULE stays shared by the main model and the updater, and HS_FROM_SHOP still reads the raw file. The request texts did not change: none of the guide-out calls differ because of this. No file was moved.
REMAINING CHANGE: Intentionally broken tests (not my files): (1) tests/fix3-text.test.mjs:77 `assert.match(bm, /Haggling:/);` must change, because Bm no longer has a TALK section. Replace it with `assert.doesNotMatch(bm, /@@SECTION TALK\n/);`. (2) tests/guide-out.test.mjs tests 1 and 4 (and the GUIDES_OF use in tests/guide-out-calls.mjs) loop over Shop/Cos/Bm for every section from the Shop file. Add a per-section guide map and use `(IN[name] ?? GUIDES_OF[file])` in tests 1, 3b and 4. The map: `const IN = { TRUTH_ALL: ['Cos'], TRUTH_MIX: ['Cos'], TRUTH_NONE: ['Cos'], SECRET_NOTE: ['Cos'], WHERE_ANY: ['Shop'], WHERE_SHOP: ['Shop'], ASSIGN_ROLE_USEFUL: ['Cos', 'Bm'], ASSIGN_ROLE_BROAD: ['Cos', 'Bm'], ASSIGN_RULE: ['Cos', 'Bm'] }`. Current failures are 'Shop / TRUTH_ALL' (test 1) and '절 없음: TRUTH_ALL' (test 4).

### wording#8 (r4/None, fixed)
DONE: 나-96: the BudgetError message in budget.ts now points to 생성 공통's 요청 토큰 상한. No test pins it. The second notice (manage.ts) is in a file I do not own, so it is listed as a deferred change.
REMAINING CHANGE: src/ui/editor/manage.ts:221 (not my file): '설정 → 고급 → 로어북 보내기' -> '설정 → 로어북 호출 → 로어북 보내기'.

### wording#9 (r4/None, fixed)
DONE: 나-97: the 생성 공통 hints in advanced.ts now list the 상점, 쇼핑몰 and 망상홈쇼핑 screens, which also use these values. Done as the FIXPLAN says: lang and concurrent list 상점·쇼핑몰·망상홈쇼핑, user_msgs adds 상점 only. Only text changed. The ctx_total hint was handled by mainreach#10. The page description that should mention 재시도 / AI 상담 is in editor/index.ts, which I do not own, so it is listed as a deferred change.
REMAINING CHANGE: src/ui/editor/index.ts:491 (not my file): adv desc '괴담넷·괴담톡·위키 생성에 공통으로 쓰는 값이에요.' -> '괴담넷·괴담톡·위키·상점(쇼핑몰·망상홈쇼핑 포함) 생성에 공통으로 쓰는 값이에요(재시도는 AI 상담도).' Leave the rest of the sentence as it is.

### css#2 (r4/None, deferred)
DONE: 나-8 ① (scroll sideways): The CSS half is done. The PC grid's .ps-rows now scrolls sideways and each .ck-line keeps at least its content width. The column-minimum half is in src/ui/setrow.ts, which I do not own. Until it lands, number columns are still minmax(0,1fr), so header and body lines can misalign when scrolled.
REMAINING CHANGE: src/ui/setrow.ts: in ckGrid (line ~257), stop deciding by group kind and decide per flat column from the rows: hasNum[i] = rows.some(r => r.marks[i] !== null && typeof r.marks[i] === 'object'); lg[i] = rows.some(r => typeof r.marks[i] === 'object' && (r.marks[i] as any)?.lg). Change ckCols to return, for a num column, 'minmax(calc(var(--step-lg) + 6px), 1fr)' when lg, else 'minmax(calc(var(--step-sm) + 6px), 1fr)'. Keep 'minmax(126px, 1.35fr)' for num columns when wide (checks outnumber nums), and keep check columns at 'minmax(0, 1fr)'. Do not change --step-sm/--step-lg. Check unit tests that pin ck-cols or minmax(0, 1fr).

### editor#10 (r4/None, fixed)
DONE: 나-9 ①: The UI half is done. 지우기/삭제 on a record (both the record header and the 명부에만 있음 view) now asks 「정말 지우기/삭제」 · 「취소」 first. The confirm state is cleared when the selection changes. 되살리기 now removes only the deleted flag (local restoreDeleted), so kept edits come back once removeRecord keeps them. That removeRecord change is in core/world/draft.ts, which I do not own.
REMAINING CHANGE: src/core/world/draft.ts removeRecord: change `if (defaultRecord(kind, name)) bucket[name] = { deleted: true };` to `if (defaultRecord(kind, name)) bucket[name] = { ...(bucket[name] ?? {}), deleted: true };`. Optionally add a world-draft test: edits, then remove, then restore give the edits back (record.ts restore already strips only the flag). tests/qc-settings-world-browser.mjs lines 91, 114 and 201 click `[data-action="ed-delete"]` once and expect deletion. They now also need a click on `[data-action="ed-delete-yes"]`.

### shell#6 (r4/None, deferred)
DONE: 나-25 ①: My half is done in progwin.ts. ProgWin.setPanel(open) now exists, and onChange no longer opens the PC card by itself while panelOpen is true (the button still opens it). Nothing calls setPanel yet. The call belongs in src/body.ts, which I do not own.
REMAINING CHANGE: src/body.ts, line ~925, right after `else if (prog && pShow) await prog.setVisible(true).catch(() => {});`, add: `if (prog) await prog.setPanel(appShown()).catch(() => {});` (appShown is already imported from './ui/app'). This one line covers shell#6 and shell#7.

### shell#7 (r4/None, deferred)
DONE: 나-26 ①: My half is done in progwin.ts. While the 상황판 is open on a phone, the host gets x-goei-panel="true", and the phone bar moves to top:160px, below the address and bookmarks rows. It needs the same body.ts setPanel call as shell#6.
REMAINING CHANGE: src/body.ts: the same line as shell#6, `if (prog) await prog.setPanel(appShown()).catch(() => {});` after the setVisible lines (~925).

### asyncl#10 (r4/None, deferred)
DONE: 나-27 (1): My half is done in waiting.ts. New export passWaiting(): while waiting it blocks the first press and lets a second press within 5 s through. When not waiting it always passes. The 180 s timer and waitNotBusy are untouched. The cancel handler that should call it is in src/host/unsent.ts, which I do not own.
REMAINING CHANGE: src/host/unsent.ts: line 8 `import { isWaiting } from './waiting';` → `import { passWaiting } from './waiting';`; line 38 `if (!on || isWaiting()) return false;` → `if (!on || !passWaiting()) return false;`

### dirstatus#10 (r4/None, deferred)
DONE: 나-29 ① (remove the 보임/숨김 segment from play-organisation rows on the start screen) is only in src/ui/editor/start.ts, which I do not own. Nothing to change in directory.ts.
REMAINING CHANGE: src/ui/editor/start.ts slotRow (line ~37): change `${seg('dir-start-show', s.code, !s.hidden, '보임', '숨김')}` to `${s.kind === 'extra' ? '' : seg('dir-start-show', s.code, !s.hidden, '보임', '숨김')}`. The expanded panel still has 「시작 칸에서 빼기」. Builtin and group rows are unchanged.

### dirstatus#11 (r4/None, fixed)
DONE: 나-30 ①: The 거점 지우기 button now sends ask|name and shows 「「name」 거점을 지울까요? [지우기][취소]」. It deletes only on yes|name while dirUi.confirmDel matches (dirUi.confirmDel is new and is reset in resetDirectory). The dir-scene-del handler now takes ask|code|fm, yes|code|fm and no|code|fm. The old value form code|fm still deletes at once until the start.ts button is changed (start.ts is not mine).
REMAINING CHANGE: src/ui/editor/start.ts scenesBlock line ~54: import dirUi from '../directory' and replace `${r.custom ? `<button class="gx-mini danger" data-action="dir-scene-del" data-value="${esc(`${code}|${r.fm}`)}">지우기</button>` : ''}` with `${r.custom ? (dirUi.confirmDel === `scene|${code}|${r.fm}` ? `<span class="gx-hint">이 장면을 지울까요? <button class="gx-mini danger" data-action="dir-scene-del" data-value="${esc(`yes|${code}|${r.fm}`)}">지우기</button><button class="gx-mini" data-action="dir-scene-del" data-value="${esc(`no|${code}|${r.fm}`)}">취소</button></span>` : `<button class="gx-mini danger" data-action="dir-scene-del" data-value="${esc(`ask|${code}|${r.fm}`)}">지우기</button>`) : ''}`. tests/qc-settings-world-browser.mjs:300-301 selects `[data-action="dir-base-del"][data-value="시험 거점 2"]`. It now has to click data-value="ask|시험 거점 2" and then "yes|시험 거점 2".

### editor#13 (r4/None, deferred)
DONE: 나-33 (가): The approved change is in src/ui/editor/flow.ts line 200, which I do not own. flowpage.ts (saidParts) must not change.
REMAINING CHANGE: src/ui/editor/flow.ts line 200 (node '포인트몰 1:1 상담'): `calls: '상담사 연결 1회 + 보낼 때마다 1회'` → `calls: '보낼 때마다 1회 (상담사 연결 1회 더)'`

### wording#13 (r4/None, fixed)
DONE: 나-91 ①: Removed the 리수폿 tails from the four visible strings in people.ts (taste, openness, rhythm, the sexual-profile card title). The two in src/core/setdef/people.ts are not mine. Note: people.ts:234 FEATURE_HELP.axes still ends with '리수폿 People'. It is not one of the six approved places, so I left it.
REMAINING CHANGE: src/core/setdef/people.ts line 24: '갱신기도 되짚어요 (리수폿 자동 추적). 기록에 있는' → '갱신기도 되짚어요. 기록에 있는'; line 26: '중대위반(−50)은 늘 한도 밖. 리수폿 기본 ±10.' → '중대위반(−50)은 늘 한도 밖. 기본 ±10.'

### wording#2 (r4/None, fixed)
DONE: 나-92 ①: The tab title is done in browser.ts, but with 「수상한 중고거래」, following the conflicting 나-42 recommendation (this item recommends 「괴이 중고거래」); the owner should confirm. The Brownie first-scene sentence is in src/data/world/scenes.json, which I do not own.
REMAINING CHANGE: src/data/world/scenes.json line 123 (인물.P055.ko): '이면세계 냄새가 났다.' → '괴이 쪽 냄새가 났다.' (en unchanged). Check that the card build (tools/build_lite_card.py first-scene and start lore) picks up the same sentence at release. If the owner prefers 나-92's 「괴이 중고거래」, change browser.ts:23 to '연어 마켓 | 괴이 중고거래'.

### wording#7 (r4/None, fixed)
DONE: 나-95: Fixed the wallet empty-state text and the people.ts 세력 pointer (the same edit as peopleui#11). The guides.ts Tag pointer was fixed with guides#13's text 「상태창 → 칸」. This item suggested 「표시 → 상태창」 for the same string; both name the same page. The 고유 상점 and 명부 pointers are in files I do not own.
REMAINING CHANGE: src/core/setdef/homeshop.ts line 43: '(설정 → 소지품 → 고유 상점)' → '(설정 → 상점 → 고유 상점)'. src/core/world/directory.ts line 1006: '플러그인 창 「설정 → 카드 명부」에서 고치세요. ' → '플러그인 창 「세계」 탭에서 고치세요. ' (this text goes into the card's 명부 lorebook content, so check tests that snapshot the directory content).

