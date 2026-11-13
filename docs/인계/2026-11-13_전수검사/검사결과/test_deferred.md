## shop#7
tests/guide-out.test.mjs is not mine. Its test '기본 지침으로 만든 요청문 = 옮기기 전 코드가 만들던 요청문' fails for 'shop.talk.cos.secret' because of the round-2 talkPrompt change: {line} gains '|진실' and the SHELF_SECRET paragraph is added. Either refresh calls['shop.talk.cos.secret'] in tests/fixtures/guide-out-old.json to the current calls(M) output, or skip that key in the loop and assert BASE['shop.talk.cos.secret'].includes('이름|값|쓰임|그림|무게|설명|효과|구분|진실'). Separately, 'shop.shelf.cos.*' and 'shop.talk.cos.secret' also differ because of another agent's edit to src/core/guides.ts (Cos guide drops 'Prices should feel like real Korean prices…' and the haggling sentence). That diff does not come from my files. The current first failure in that test is gnet.refresh.sm, which is not mine either.

## wording#4
The rest of wording#4 is in files I do not own. Move the same way, verbatim, with guideOr and the old literal as fallback: src/core/bmdesk.ts:178 '[최근 상담사 — 겹치지 말 것]' (BmDesk; bmdesk.txt:6 quotes it by exact text), src/core/wiki.ts:291/293/589 '[이전 위키 — 원본 사실과 최근 확인된 본문을 우선]', '[사용자 작성 지침 — 이 문서만, 공통 지침과 부딪치면 이쪽을 우선]', '[이미 쓴 문서 — 되도록 피하고, 최근 이야기로 내용이 크게 달라졌을 때만]' (Wiki), and src/core/gnetPrompt.ts:108 '[참고 자료 — 작중 인물에게 자동 공개되지 않음]' (Common or GNet; tests/gnet.test.mjs:173 asserts that prefix). Optional: add the four new Shop HEAD_* sections to the 'sections' list in tests/fixtures/guide-out-old.json so guide-out test 1 pins them.

## lplumb#10
If the owner approves: in faction.ts delete `const legend = …` and change `}\nFactions: ${legend}\n${head}` to `}\n${head}`. Then tests/world-guides.test.mjs:39 must drop the `\nFactions: 1 .*Management Bureau.*` part of its regex. tests/guide-out.test.mjs ('기본 지침으로 만든 요청문 = 옮기기 전 코드가 만들던 요청문') needs a LATER pair that removes the legend from the old faction.assemble call, e.g. ['\nFactions: 1 Management Bureau · 2 Fake Management Bureau · 3 Baekilmong · 4 Civilian · 5 Freelancer', ''], with the exact text taken from tests/fixtures/guide-out-old.json calls['faction.assemble']. Do not edit the fixture.

## world#8
The plan also wanted the test in tests/world.test.mjs. It is in the new tests/fix3-world.test.mjs instead, because only that file was allowed.

## images#6
Optional, not needed for any test to pass: if the owner of tests/fixtures/guide-out-old.json wants these new sections covered by the per-section 'edit changes request' test, add Asset MAIN_USER_RULE and MAIN_USER_SKIP and GNet PICS_* and DM.QUOTE_UNKNOWN to its sections list. The test asserts moved.length === 95, so that count would also need updating. guide-out.test.mjs test 3 shows no difference from these changes. Its current failures (gnet.refresh.sm tone text, shop.shelf.cos.*, shop.talk.cos.secret) come from other agents' guide edits, not from this one.

## hardcode#4
Optional, owned by nobody: add the new Main sections to tests/fixtures/guide-out-old.json 'sections' (Main file list) and raise `assert.equal(moved.length, 95)` to match, so guide-out also checks them. The test passes without this. src/ui/editor/guides.ts Main description does not mention RHYTHM.* (UI wording, not mine).

## hardcode#5
Optional: list the new sections in tests/fixtures/guide-out-old.json sections (Main) and raise the moved.length count.

## pipeline#13
Optional, owned by nobody: in tests/fixtures/guide-out-old.json, add ["STATUS.RECENT_CASH","Recent cash transactions (oldest first): {list}"] and ["STATUS.RECENT_POINT","Recent Baekilmong point transactions (oldest first): {list}"] to the 'sections' list of the file that holds STATUS.FIRST. Then in tests/guide-out.test.mjs change assert.equal(moved.length, 95) to 97, or to 95 plus however many sections are added there in total. The calls fixture stays as it is.

## gupdd#3
tests/people-qual.test.mjs (not mine), test '갱신기: 정성 모드면 자료에 계기·단계·숫자가 없고…' at about line 64: change `const s = St.peopleSettings(qualState);` (the one inside that test) to `const s = St.peopleSettings({ ...qualState, $pp_num_faction_rep: '0' });` so `assert.deepEqual(input.data.cues, [])` holds again. The guide wording follow-up was not applied (text rule, and the files are not mine); see text_before_after.

## gphone#7
tests/phone.test.mjs line 102 (test 'reply prompt picks sections and carries the room packet', which uses action send): change `assert.match(sys, /### Direct rooms/);` to `assert.doesNotMatch(sys, /### Direct rooms/);`. It reads dist-test, so it will fail only after the next build.

## gshop#6
tests/guide-out.test.mjs: append to LATER (JS source, as written): [" Haggling: the owner may refuse, counter, or accept; accept only when it makes sense for this owner, and then change that item's price: a lower figure, or another payment the owner agrees to take instead, written in words.", ""]. Only shop.talk.cos.secret contains it. Separately, that call still differs by '|진실' after '구분' in the partial line. That comes from another group's change, not mine.

## gshop#9
tests/guide-out.test.mjs: append to LATER (JS source): ["\\nPrices should feel like real Korean prices for that kind of shop.", ""]. Only the four cos calls contain it.

## ggnet#7
tests/guide-out.test.mjs: append to LATER (JS source): ["not story readers or game players.\\n\\n### Tone and manner\\n\\nDefault to Korean DCInside-style anonymous-community speech: informal, casual, slang, memes, blunt skepticism, rough jokes, occasional profanity and arguments; casual comments often omit final periods. ", "not story readers or game players.\\n\\n### Tone and manner\\n\\n"]. This context matches only gnet.refresh.sm (gal has a different preceding sentence). I checked all three new pairs with a scratch run: every remaining diff is the unrelated '|진실' one.

## items#7
Outside my files: these addWalletEntry callers should pass the alive set as a 3rd argument, otherwise the ledger grows past 400 (the cap is soft without alive): src/host/people.ts:399 and :404 (report.wallet / report.points loops: `addWalletEntry(w, {...e, src:'story'}, aliveAnchors(chat))`), src/ui/shop.ts:351 and :606, src/ui/malls.ts:118, :286, :418, :442, src/core/points.ts:104 (syncPoints, which already has the chat). Use aliveAnchors(chat) from core/wallet on the chat they already hold. tests/wallet.test.mjs uses dist-test, so it was not run here (no build allowed).

## mainreach#6
After the owner approves the sentence: add droppedNow to src/core/items.ts as written above. If any guide-out fixture covers inventoryText with a manual drop at lastBotKey, it would gain this line (no current fixture is known to).

## wording#1
src/ui/gnet.ts: add `export function boardFailures(): { site: BoardSite; name: string; reason: string; raw: string }[] { const out = []; for (const s of BOARD_SITES) { const u = s === uiSite ? gnet : uiSaved.get(s); if (u?.failure) out.push({ site: s, name: BOARD_NAME[s], reason: u.failure.reason, raw: u.failure.raw }); } return out; }`. Do not call uiFor, because it creates empty uiSaved entries. Also add `export function clearBoardFailures(): void { gnet.failure = null; for (const u of uiSaved.values()) u.failure = null; }`. Then in src/ui/editor/manage.ts: in statusPage `fails`, replace the gnet term with `...boardFailures().map((f) => `${f.name}: ${f.reason}`)`. In logPage, replace `fail(BOARD_NAME[boardSiteNow()], gnet.failure)` with `boardFailures().map((f) => fail(f.name, f)).join('')`. In diagBundle, set `gnet: boardFailures().map((f) => ({ site: f.site, reason: f.reason, raw: f.raw }))`. In man-clear-fail, call `clearBoardFailures()` instead of `gnet.failure = null`. Then the boardSiteNow/BOARD_NAME imports in manage.ts can go if they are unused. tests/fix3-misc.test.mjs wording#1 asserts the interim `fail(BOARD_NAME[boardSiteNow()], gnet.failure)`, so update that assertion when this lands.

## lplumb#5
tests/world-data.test.mjs line 14: assert.equal(worldRecords('appendix').size, 5) -> 6. tests/world-data.test.mjs line 52: '55 + 14 + 63 + 11 + 5' -> '55 + 14 + 63 + 11 + 6'. tests/qc-loader-build.test.mjs line 70: in the expected array '[55, 17, 63, 11, 4, 78]', change 4 to 6 (it was already stale at 5 before this change; it takes effect after a build).

## gupdd#2
tests/itemstate.test.mjs test '갈래 표 …' (line ~130): change the title phrase '손전등(기기)은 장비·사용' to '손전등(기기)은 사용'. The asserts for 손전등, 라이터, 무전기 and 카메라 become { use: true }. The 성냥 assert becomes { use: true, uses: 10 }. The addItem assert `[s.list[0].use, s.list[0].equip, s.list[0].kind]` becomes [true, undefined, 'device']. Browser test tests/itemstate-browser.mjs:135 (default table row 12) changes ['도구','장비·사용'] to ['도구','사용'], and runs only when the settings screen is released. Note: the unit tests read dist-test/core.mjs, which is stale until the next build.

## items#1
tests/items.test.mjs test '같은 이름이 또 들어오면 새 줄 없이 갱신, 둘 다 소모성이면 횟수를 더한다' (lines 25-33): change the second addItem from from: 'store' to from: 'story' (anchor 'c2') so the stacking asserts (length 1, desc '새로 샀다', uses 5, anchor 'c1') still hold. Optionally add a store case: a story 소금 봉지 plus a store 소금봉지 at anchor 'c2' gives it.list.length === 2 and newlyBought(it.list, 'c2').length === 1.

## shop#1
Same test edit as items#1 (tests/items.test.mjs lines 25-33).

## gupdc#6
Same test edits as gupdd#2 (tests/itemstate.test.mjs '갈래 표' block; tests/itemstate-browser.mjs:135).

## items#14
Same test edits as gupdd#2.

## mainreach#3
src/ui/famtable.ts line 249 helpBox text: replace '켜면 그 상점에서 한 일을 다음 메인 요청에 한 번 붙여요. 본문을' with '켜면 그 상점에서 한 일을 다음 메인 요청에 한 번 붙여요. 망상홈쇼핑은 다음 편성을 받기 전까지 본 방송 기록을 메인 요청마다 붙여요. 본문을'. No test pins it. Check the table foot at 390px phone width.

## pipeline#14
Browser test tests/usebar-browser.mjs (run only at release for this screen) expects chips hidden after sending. Change: line ~118 `if (s.shown !== 0)` after send → expect s.shown === 1 with label '보내는 중' (add a label read to bar() if needed); step 2 (~137) and step 3 (~149) `s.shown` → expect shown with label 보내는 중; step 5 (~170) `if (s.shown) bad('실패 시험: 보낸 직후엔 숨어야 한다')` → expect shown with label 보내는 중; header comment line 2 「보내면 바로 숨음」 → 「보내면 이름표가 보내는 중」. Step 4 (added while waiting shows only the new one) is unchanged.

## ggnet#10
tests/gnet.test.mjs line 166 (real-card refresh test) asserts the removed heading. Replace `assert.ok(sys.includes('## User-controlled protagonist (narrator reference only)'));` with `assert.ok(!sys.includes('## User-controlled protagonist') && !sys.includes('End of the log'));`. I checked this against a fresh core bundle built in scratch, and gnet.test.mjs passes with it.

## pipeline#9
src/core/advanced.ts:130: `chips: [chip('ctx_focus', '장면 관련 먼저', 1), chip('ctx_messages', '메시지', 1, '$ph_context_messages'), chip('ctx_notices_on', '공지', 1, '$ph_context_announcements')],` -> `chips: [chip('ctx_focus', '장면에 나온 것만', 1), chip('ctx_messages', '메시지', 1, '$ph_context_messages'), chip('ctx_notices_on', '공지', 1, '$ph_context_announcements')],`. Leave line 90 (the gn chip) as the FINAL says. No unit test asserts the label.

## wiki#14
tests/wiki.test.mjs:193: change `u.endsWith('[사용자 작성 지침 — 모든 문서 공통]\n무섭게')` to `u.endsWith('[사용자 작성 지침: 모든 문서 공통]\n무섭게')`. Checked: it passes against a fresh scratch bundle. Browser test, to update before release only: tests/qc-modules-browser.mjs:960 '[사용자 작성 지침 — 모든 문서 공통]\n존댓말로 쓸 것' -> '[사용자 작성 지침: 모든 문서 공통]\n존댓말로 쓸 것'; :961 '[사용자 작성 지침 — 이 문서만, 공통 지침과 부딪치면 이쪽을 우선]\n출구를 자세히' -> '[사용자 작성 지침: 이 문서만]\n출구를 자세히'.

## gcross#7
(1) src/core/people/sexual.ts:63, in the sexualPromptRules fallback template literal, delete `${explicit ? explicitStyle() : plainStyle()} ` (with its trailing space) so it reads '...each naming something specific. Paraphilia is chosen from this closed list...'. The `{ style: ... }` vars object can stay. Without this, guide-out test 4 fails. (2) tests/fixtures/guide-out-old.json sections.UpdaterExtra entry 'SEXUAL.PROMPT_RULES': in its body, change 'each naming something specific. {style} Paraphilia' to 'each naming something specific. Paraphilia' (test 1 compares bodies directly and has no LATER mechanism). (3) tests/people-sexual.test.mjs:60 currently asserts `/자지/.test(Sx.sexualPromptRules(true)) && !/자지/.test(Sx.sexualPromptRules(false))`. Replace it with `assert.ok(!/자지/.test(Sx.sexualPromptRules(true)) && !/자지/.test(Sx.sexualPromptRules(false)) && (sec.match(/자지/g) ?? []).length === 1, '어휘 규칙은 인물별 문장에 한 번만');`. I verified that sec has exactly 1 match.

## gupdd#4
Same as gcross#7: sexual.ts:63 fallback, guide-out-old.json SEXUAL.PROMPT_RULES body, people-sexual.test.mjs:60.

## gcross#10
(1) src/core/people/director.ts:239, directorBlock fallback template: delete `${knowledgeRule()} ` so it reads '...not events, not lines to say. Keep the roleplay's established output language...'. The knowledge_rule var and knowledgeRule import can stay (the import is still used for vars). Without this, guide-out test 4 fails. (2) tests/fixtures/guide-out-old.json sections.Director entry 'MAIN_NOTE': in its body, change 'not lines to say. {knowledge_rule} Keep' to 'not lines to say. Keep'.

## gupdc#9
Same as gcross#7 (sexual.ts:63 fallback, guide-out-old.json SEXUAL.PROMPT_RULES body, people-sexual.test.mjs:60).

## gupdd#5
tests/people-updater.test.mjs:206 (test '문서·의심: 종류 검사, 꺼진 기능, 의심 해소는 접는다') now fails on purpose because close no longer replaces the last clue. Change the line to: assert.deepEqual(su.map((e) => e.text), ['[시작] 유저가 명단을 봤다는 말을 의심', '[단서] 비밀번호를 알고 있었다', '[해소] 오해로 밝혀짐'], '해소는 앞 항목을 대체하지 않는다 (점수 유지)'); The test title can become '... 의심 해소는 앞 항목을 남긴다'.

## gupdc#7
Same test edit as gupdd#5 (tests/people-updater.test.mjs:206).

## peoplecore#12
Same test edit as gupdd#5 (tests/people-updater.test.mjs:206).

## gcross#4
src/core/world/statuscols.ts:201 (twin fallback, not my file): guideOr('Main', 'STATUS.RULE.ONE_LINE', '- Output exactly one [▣] at the very end of every response, as the final line.') -> '- Output exactly one [▣] at the very end of every response.' (tests/guide-out.test.mjs test 3b needs it). tests/fixtures/guide-out-old.json sections.Main STATUS.RULE.ONE_LINE body: make the same edit (test 1 compares section bodies directly, a LATER pair does not cover test 1).

## gmain#6
src/core/world/statuscols.ts:183 (twin fallback 'points:', not my file): same edit, 'points and won never convert, and points are spent only at the Baekilmong point shop (Welfare Mall).' -> 'points and won never convert.' (test 3b). tests/fixtures/guide-out-old.json sections.Main STATUS.RULE.POINTS body: same edit (test 1).

## gmain#12
src/core/items.ts:774 (INVENTORY_NOTE fallback, not my file): delete ' If a "Really" list follows, those items\' real effects differ from or go beyond their labels: what happens follows the Really line, nobody knew it beforehand, and the protagonist learns it only through what happens.' so the fallback reads '... A broken item does not work. Never print this list back.' (test 3b). tests/fixtures/guide-out-old.json sections.Main INVENTORY.NOTE: same deletion (test 1).

## lplumb#14
src/core/lore.ts:523 unlockHint fallback (not my file): '... write [🔓|${e.name}] on its own line at the very end.' -> '... write [🔓|${e.name}] on its own line after the prose.' (test 3b). tests/fixtures/guide-out-old.json sections.Main LORE.LOCKED body: same edit (test 1).

## gmain#7
tests/core.test.mjs (not my file): add a unit test next to the existing unwrapScenes tests. An answered card ('%%SCENE_CARD:7b7d%%\nCOMMON\n\nCreate an opening.\n\nSubject: X\nCompanions: Y\n%%/SCENE_CARD%%', then an assistant message) becomes 'Subject: X\nCompanions: Y'. The last card with no assistant reply after it stays complete.

## gmain#9
src/core/asset.ts:190 fallback in assetPrompt (not my file): "'[2] She glanced at the figure standing by the desk, her expression hardening into something sharper.'," -> "`[2] ${first} glanced at the figure standing by the desk, her expression hardening into something sharper.`," (test 3b). tests/fixtures/guide-out-old.json sections.Asset PROMPT body: '[2] She glanced' -> '[2] {first} glanced' (test 1).

## guides#4
Intentionally broken tests (not my files): (1) tests/fix3-text.test.mjs:77 `assert.match(bm, /Haggling:/);` must change, because Bm no longer has a TALK section. Replace it with `assert.doesNotMatch(bm, /@@SECTION TALK\n/);`. (2) tests/guide-out.test.mjs tests 1 and 4 (and the GUIDES_OF use in tests/guide-out-calls.mjs) loop over Shop/Cos/Bm for every section from the Shop file. Add a per-section guide map and use `(IN[name] ?? GUIDES_OF[file])` in tests 1, 3b and 4. The map: `const IN = { TRUTH_ALL: ['Cos'], TRUTH_MIX: ['Cos'], TRUTH_NONE: ['Cos'], SECRET_NOTE: ['Cos'], WHERE_ANY: ['Shop'], WHERE_SHOP: ['Shop'], ASSIGN_ROLE_USEFUL: ['Cos', 'Bm'], ASSIGN_ROLE_BROAD: ['Cos', 'Bm'], ASSIGN_RULE: ['Cos', 'Bm'] }`. Current failures are 'Shop / TRUTH_ALL' (test 1) and '절 없음: TRUTH_ALL' (test 4).

## css#2
src/ui/setrow.ts: in ckGrid (line ~257), stop deciding by group kind and decide per flat column from the rows: hasNum[i] = rows.some(r => r.marks[i] !== null && typeof r.marks[i] === 'object'); lg[i] = rows.some(r => typeof r.marks[i] === 'object' && (r.marks[i] as any)?.lg). Change ckCols to return, for a num column, 'minmax(calc(var(--step-lg) + 6px), 1fr)' when lg, else 'minmax(calc(var(--step-sm) + 6px), 1fr)'. Keep 'minmax(126px, 1.35fr)' for num columns when wide (checks outnumber nums), and keep check columns at 'minmax(0, 1fr)'. Do not change --step-sm/--step-lg. Check unit tests that pin ck-cols or minmax(0, 1fr).

## editor#10
src/core/world/draft.ts removeRecord: change `if (defaultRecord(kind, name)) bucket[name] = { deleted: true };` to `if (defaultRecord(kind, name)) bucket[name] = { ...(bucket[name] ?? {}), deleted: true };`. Optionally add a world-draft test: edits, then remove, then restore give the edits back (record.ts restore already strips only the flag). tests/qc-settings-world-browser.mjs lines 91, 114 and 201 click `[data-action="ed-delete"]` once and expect deletion. They now also need a click on `[data-action="ed-delete-yes"]`.

## dirstatus#11
src/ui/editor/start.ts scenesBlock line ~54: import dirUi from '../directory' and replace `${r.custom ? `<button class="gx-mini danger" data-action="dir-scene-del" data-value="${esc(`${code}|${r.fm}`)}">지우기</button>` : ''}` with `${r.custom ? (dirUi.confirmDel === `scene|${code}|${r.fm}` ? `<span class="gx-hint">이 장면을 지울까요? <button class="gx-mini danger" data-action="dir-scene-del" data-value="${esc(`yes|${code}|${r.fm}`)}">지우기</button><button class="gx-mini" data-action="dir-scene-del" data-value="${esc(`no|${code}|${r.fm}`)}">취소</button></span>` : `<button class="gx-mini danger" data-action="dir-scene-del" data-value="${esc(`ask|${code}|${r.fm}`)}">지우기</button>`) : ''}`. tests/qc-settings-world-browser.mjs:300-301 selects `[data-action="dir-base-del"][data-value="시험 거점 2"]`. It now has to click data-value="ask|시험 거점 2" and then "yes|시험 거점 2".

## wording#7
src/core/setdef/homeshop.ts line 43: '(설정 → 소지품 → 고유 상점)' → '(설정 → 상점 → 고유 상점)'. src/core/world/directory.ts line 1006: '플러그인 창 「설정 → 카드 명부」에서 고치세요. ' → '플러그인 창 「세계」 탭에서 고치세요. ' (this text goes into the card's 명부 lorebook content, so check tests that snapshot the directory content).

## pipeline#10
Show the number in the UI (files I do not own). Wherever the call log shows main.totalTokens, add `플러그인이 더한 토큰 N` when main.added !== undefined. src/ui/editor/trace.ts:57 meta line, after `${tok(m.totalTokens)}`, e.g. `${m.added !== undefined ? ` · 플러그인이 더한 토큰 ${m.added.toLocaleString('ko-KR')}` : ''}`. Optionally also src/ui/editor/flow.ts:215, src/ui/editor/consult.ts:115 and src/ui/editor/flowpage.ts:273/366. Tests: the existing tests/fix2-pipe.test.mjs:94 traceMain call with two arguments still works. A test could check that traceMain(msgs, [], ['abc']) sets main.added > 0.

## gmain#9
Tests (not my files): in tests/fixtures/guide-out-old.json, the sections Asset/PROMPT body changes '[2] She glanced' -> '[2] {first} glanced' (test 1). Add the guide-out LATER pairs: ["[1] Lee Ha-neul walked into the room with a quiet smile.\n[2] She glanced", "[1] Lee Ha-neul walked into the room with a quiet smile.\n[2] Lee Ha-neul glanced"], ["[1] Eileen walked into the room with a quiet smile.\n[2] She glanced", "[1] Eileen walked into the room with a quiet smile.\n[2] Eileen glanced"]. Then run node --test tests/guide-out.test.mjs.

## hardcode#4
Optional: add the new Main sections (PEOPLE.EXPRESS_0..3, PEOPLE.TASTE_NOTE, PEOPLE.OPENNESS_NOTE, RHYTHM.HEAD, RHYTHM.CLOCK_HEAD, RHYTHM.METHOD, FACTION.HEAD) to tests/fixtures/guide-out-old.json 'sections' (Main file list) and raise `assert.equal(moved.length, 95)` to match. Wording for the guides.ts Main description (RHYTHM.*) has no approved text, so it was not changed.

## wording#1
tests/fix3-misc.test.mjs wording#1 asserts the interim `fail(BOARD_NAME[boardSiteNow()], gnet.failure)`. Update it to the new `boardFailures().map((f) => fail(f.name, f)).join('')` (and clearBoardFailures() in man-clear-fail).

## dirstatus#11
tests/qc-settings-world-browser.mjs:300-301 selects `[data-action="dir-base-del"][data-value="시험 거점 2"]`. It must now click data-value="ask|시험 거점 2" and then "yes|시험 거점 2". Any test that clicks dir-scene-del with `code|fm` must now use ask|… and then yes|….

## wording#7
The directory HELP text goes into the card's 명부 lorebook content. Any test that snapshots directoryContent and contains '설정 → 카드 명부' must now expect '「세계」 탭'.

## editor#10
Tests: (1) world-draft test: edits, then removeRecord, then restore (record.ts restoreDeleted) give the edits back. (2) tests/qc-settings-world-browser.mjs lines 91, 114 and 201 click `[data-action="ed-delete"]` once. They now also need a click on `[data-action="ed-delete-yes"]`.

## css#2
No test pins ck-cols, minmax(0, 1fr) or minmax(126px (I searched tests/). The release check should look at the settings → 인터넷 「양」 grid at 1280, 1366 and 390×844.

## items#7
The only remaining call without alive is src/core/wallet.ts:157 (the field-trade helper, which returns addWalletEntry(w, {..., src:'field'})). wallet.ts is not my file; pass alive there if its caller has one. Also run tests/wallet.test.mjs after a build.

## shop#7
tests (later agent): in tests/fixtures/guide-out-old.json refresh calls['shop.talk.cos.secret'] to the current calls(M) output, or skip that key in test 3 and assert BASE['shop.talk.cos.secret'].includes('이름|값|쓰임|그림|무게|설명|효과|구분|진실'). The 'shop.shelf.cos.*' keys also differ because the Cos guide in src/core/guides.ts drops the haggling sentence; refresh those fixture calls too. Separately, guide-out test 5 currently fails with '절 없음: TRUTH_ALL' because the Shop guide now drops the MALL_ONLY sections. The test's moved-section loop has to use the Cos guide for the MALL_ONLY sections or skip the Shop guide for them. My edits did not cause this.

## wording#4
src/data/guides/common.txt (not mine): add `@@SECTION HEAD.REFS\n[참고 자료 — 작중 인물에게 자동 공개되지 않음]\n@@END` so the GNet header shows in the guide menu. The code already reads it, and Common is already blank-default. Optional, tests: add BmDesk HEAD_REFS/HEAD_PAST, Common HEAD.REFS and the Shop HEAD_* sections to the 'sections' list in tests/fixtures/guide-out-old.json.

## gcross#7
tests: in tests/fixtures/guide-out-old.json sections.UpdaterExtra 'SEXUAL.PROMPT_RULES', change 'each naming something specific. {style} Paraphilia' to 'each naming something specific. Paraphilia'. Add the two LATER pairs listed in the finding (explicit and plain style paragraph → removed) to guide-out test 3. In tests/people-sexual.test.mjs:60, replace the assertion with `assert.ok(!/자지/.test(Sx.sexualPromptRules(true)) && !/자지/.test(Sx.sexualPromptRules(false)) && (sec.match(/자지/g) ?? []).length === 1, '어휘 규칙은 인물별 문장에 한 번만');`.

## gcross#10
tests: in tests/fixtures/guide-out-old.json sections.Director 'MAIN_NOTE', change 'not lines to say. {knowledge_rule} Keep' to 'not lines to say. Keep'. For call director.block, add the LATER pair from the finding (the full KNOWLEDGE_RULE sentence removed).

## gcross#4
tests: in tests/fixtures/guide-out-old.json sections.Main STATUS.RULE.ONE_LINE, remove ', as the final line'. Add the LATER pair ['- Output exactly one [▣] at the very end of every response, as the final line.', '- Output exactly one [▣] at the very end of every response.'].

## gmain#6
tests: apply the same edit to tests/fixtures/guide-out-old.json sections.Main STATUS.RULE.POINTS. Add the LATER pair [old sentence, 'points and won never convert.'].

## gmain#12
tests: make the same deletion in tests/fixtures/guide-out-old.json sections.Main INVENTORY.NOTE. Add the LATER pair [' If a "Really" list follows, … only through what happens.', ''].

## lplumb#14
tests: make the same edit in tests/fixtures/guide-out-old.json sections.Main LORE.LOCKED. Add the LATER pair ['on its own line at the very end.', 'on its own line after the prose.'].