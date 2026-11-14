# 괴이봇 플러그인 개발
- Owner YoungZ, KST. Korean; threads use 존댓말, plain short words. Terms: 퀵슬롯, 능력.
- 괴이봇 = Anomaly Sim 2.4, RisuAI 괴담 RP bot. Plugin calls user's model via runLLMModel. leepc25/goei-plugin = DEPLOY repo; leepc25/goei-plugin-v2 private.
- **EVERY NEW THREAD: read this memory first and obey it.** Default model claude-fable-5-2 (never switch to Opus).
- **11-13 user: 「호출 흐름」 screen is THE core of the plugin — alpha and omega; most people only look at this. Give it top care/polish. User hated grid lines (바둑판), messy indents; show whole-screen picture, not words.**

## Workflow
- ALL work in BACKGROUND; foreground answers user instantly. 「멈춰」 = stop all at once.
- No unrequested work. 「뽑아」 = generate (「그래」≠뽑아). 「릴리스해」 = release. 「합쳐」 = PR. 「기다려봐」 stop. 「계속 가」 finish. 「확정」 do follow-up. 「닫아」 resolve, 「치워」 replace.
- Design talks: propose, wait for explicit OK; never build on own reading. **11-14 (furious): never rename buttons/labels on your own (e.g. invented 들기/내려놓기).**
- Before release: 전수점검 of touched parts by feature → [[goei-audit-method-1109]]. Release flow: branch `handoff` 인수인계/릴리스_스레드_인수인계.md §3 → [[goei-return-1109]].
- Threads full at 24 attachments. Attach sparingly (one contact sheet); link /mnt/project-files paths, never attach docs. start_thread rejects agent message ids. **11-12: user angry when 망상홈쇼핑 images were routed to another thread without asking — ask the user before sending a thread's images elsewhere.**
- **11-13: user annoyed at too many scattered release threads. Keep ONE release thread; don't open parallel ones.**
- **TEST RULE (11-13 00:25 KST, user furious; replaces all older test rules):** tests/browser-suite.json (full browser list) was DISCARDED on user order; never recreate it or run "everything". Merge/handoff: typecheck + unit (`npm test`) only. Before release: + browser tests of screens touched this time only (run `node tests/<name>-browser.mjs` directly), once; open touched screens PC+phone yourself. Never run tests of untouched parts or of things that no longer exist (game/legacy). On failure fix and rerun only that test. Rule also in repo CLAUDE.md.
- Pending approvals: project chat with notify unless user is in that thread. Questions: answer first in one line; options + recommendation.
- Tests in parallel; screens 1920x1080, phone 390x844.

## Rules (repeat mistakes)
- Never rewrite a working prompt (show diff). Follow user's words literally. Never claim done without proof; never say "doesn't exist" without checking; answer from live repo with file path else 「확인 안 됨」. Never claim you read what sub-agents summarized. 「전부 읽어」 = every item, by you.
- **11-13 (furious): never change character/lore/guide TEXT during audits without asking first; list proposals instead.**
- Banned words: 정부기관/government; 이면/이면세계 not strictly banned but don't overuse (leave existing uses). UI words only from Risu/original bot (no 본편·채팅·참고 자료; 본편 → 「메인 요청」).
- Pixel art: never edit by code unless 「코드로 고쳐」; dot art only from PixelLab; post images 2x whole; look at pinned spot first. PixelLab balance = subscription + credits. Scene prompts: char height px AND %.
- **11-12 (furious): before ANY PixelLab generation, read the handoff/procedure docs fully, follow the exact past procedure (e.g. enhance-animation-v3-prompt step, start/end frames at registered size 128×256), and show the prompt to the user for review first. Never improvise "same method".**
- **11-12 (furious): every NEW FEATURE must first read other features' settings + body-injection code and match the common format: settings 「컨텍스트 포함」 (사용/붙일 것/개수/토큰 상한), 「참고 기록」 stage in src/body.ts, MAIN_CONTEXT guide section, same row names (맥락 반영/챗로그 포함/참조 로어북). Everything the user sees/types in a feature (incl. NPC/viewer chat) must reach the main model. Feature threads do NOT build settings UI ("설정창은 니가 만들지마"); hand variable lists to the settings thread.**
- Never change settings yourself. No duplicates. Never copy whole repo to project files.
- UI: PC ≠ mobile layouts; mobile bottom bar ≤5; header = ghost icon + menu title; never add unasked UI; fix via 공통 규격 / framework, never case-by-case; when fixing one thing fix all related root causes; compare with mockup and same-kind screens (상점창); build everything in design doc. Menu names must not be truncated.
- Settings: window max 1340px (src/ui/editor/style.css:11), 상황판 1280×950. Mockups real size, per scroll screen, no 2-column unless OK, use existing 공통 규격, self-review whole mockup, no fake values. Place rows by what they change (row table first). No word repeated title/group/row. Descriptions only where name doesn't explain, dim text under control. Same value kind = same control (± everywhere). ± boxes two widths only, height 34. Grids: title above, aligned, strong lines, name column 96px shared by ALL grids. Collapsing only ps-adv title style. Don't over-expand (no chips). Automated 규격 test.
- No hardcoding; mechanics user-editable. Mechanics are PROGRAMMED in plugin, model only voices (「모델무새」 banned); plans = concrete dev plans.
- Never put dialogue examples in guides; write guides by structure of existing ones (src/data/guides/gnet.txt). Guides minimal; 갱신기 may be detailed.
- Never worry about old-chat/save-variable compatibility; only avoid functional bugs.
- Reference games = direction only, no copied layouts, no choice buttons.
- Never re-propose rejected options. Read lorebook/wiki before in-world design.
- **(69) 11-12 22:29 KST (furious; earlier version was WRONG):** item images use the 갱신기 so the picture reflects story CONTEXT (꿈결 수집기 empty→full) instead of one fixed image. The 갱신기's pick is ONLY a picture; it is NOT sent to the main model. 갱신기 must not assign a grade; main model must not be told to judge it (월권) — never touch main model guide. Nobody knows grade until item is taken to 본부; grade only when story establishes it, else 「찼는데 등급 모름」 icon. No inferring grade from adjectives (고농도, 검붉고 찬란한) or source 괴이.
- **Items (11-14 user model, replaces older):** tree = 장비냐 아니냐 → 장비면 손/몸 → 사용 기능 유무; 장비 아니면 사용 가능 → 소모성(횟수) 유무. No ammo counting. Slots: 「손 2」 = ANY item can be held (drag); 장비 6 = worn/strapped only. Buttons 「장착」/「해제」 for both (not 장착 풀기/들기/내려놓기). Equipment's 사용 only active while equipped; hand-type items auto-equip to a free hand on 사용 (full → 「손 칸이 다 찼어요」); non-hand items (약·음식) used directly. Dragging highlights allowed slots, dims others. Slot judged by model guide, NOT hardcoded table (default 판정 표 emptied). Held items → main request [in hand], worn → [worn].

## Lore
- **11-13 08:42 KST user: 콘쥬스 back to original card (17세 고등학생, 교복); 송진섭 18세 고등학생; 브라우니 고등학생·교복 kept. Earlier "all adults / university" change was temporary — do not re-adultify. No extra code block added (user refused); existing guide line 「미성년이면 성향 칸은 미확인」 stays. Claude threads themselves still won't write sexual content for minor characters.** Backgrounds daytime; few locations.
- **11-14: 블라렛's half-vampire blood is SECRET — only 교황청 + very few know; old/high vampires can only sense something. Never state it as known fact in wiki.**
- Teams: 종합대응팀 쟈알디(부장)·에일린·스팡달·잼트리(내근)·데드폴·게슈간·로제몬·콘쥬스; 진압팀 고르고디오·큐라스; 격리팀 고그니쟈·데쥬레. 관리국 종로, 백일몽 강남, 협회 영등포.
- 괴담넷 insiders; 괴담갤 civilian DC; 세정게 conspiracy/survivors. 망상홈쇼핑 viewers mixed; host idle, motions play once.
- Faction start images exactly 5. First scenes: greetings.json 문체, no 여운/forced-choice endings, tag every expression change. Draft 첫장면_1105 NOT approved.
- Icons: exact-name match wins; 윗말 + 대표 그림; batches of 16 (인수인계/PixelLab_그림뽑기_인수인계.md).

## Releases / threads
- v0.21.5–0.21.9 (PR 48–52). v0.21.10 (PR 53) 설정창 개편 1–4 → [[goei-settings-step4-1111]]. v0.21.11 (PR 54) 관제 화면 + AI 상담 창 → [[goei-control-screen-1112]].
- **11-14 15:11 KST: v0.21.14 RELEASED (PR #58) 연어 마켓 말투; v0.21.13 (PR #57) 손 칸.** **11-13 ~12:00 KST: v0.21.12 RELEASED (PR #55) = audit release; handoff for new account in repo docs/인계/2026-11-13_전수검사/ → [[goei-release-1113]]**
- **11-13 09:10 KST: all 17 audit decisions answered → [[goei-audit-decisions-1113]] (card build regenerates directory.json/greetings.json — hand edits lost).**
- **11-13 01:33 KST orders for the release thread (full audit, full test once, release authorized, tests must not hold for hours) → [[goei-fullaudit-1113]].**
- **MAIN (ONLY) release thread now: 전수검사하고 릴리스하기 (cmsg_01SMy6spzkHA3Ttz9fg54ZY8CaV8MmZNJMr6i4WjnuBNit), started 11-13 01:31 KST.** User: ultra code review (울트라코드) of every part of the bot INCLUDING lorebook & guides (모순·불일치·과토큰), fix problems, then release. Branch claude/project-thread-9rc8hb; doc /mnt/project-files/release_check_1113/넘김_1113_전수검사.md; results release_check_1113/audit_results/검사결과_499건.json; user decisions release_check_1113/사용자_결정_17건.md. **11-13 08:28 KST plan (user OK'd):** Fable quota out until 11-16 05:00 KST; finish verify/fix/test with Opus, release WITHOUT 5 missing find-checks (시작기·업데이트, 갱신기 지침 대조, 지침 토큰 측정, 로어북 조직·장소, 괴이 뒷부분); then full handoff INSIDE GitHub repo (doc + memory copy + results + scripts, CLAUDE.md top pointer) because user will switch to a different account (no memory/project files carry over). 호출 흐름 (고침5) not yet user-confirmed. Keep 아바타 & unfake threads open (user). 11-14: post-release fixes (블라렛 wiki, 상점 물가 only 일반 상점, 연어 마켓 DC 말투 removed, 손 칸) on branch, not released; 연어 마켓 new 말투 sentence awaiting user.
- Unreleased: AI 상담 확장, 기본 default text, 값 등급 table, 주사위 row, 그림 대체 말 collapsed, 「호출」/「표시」 menus, 가계부 into 소지품, 규격 test; 소지품 top band; 팔기 화면 split; 물건 구조 fix; 괴담톡 NPC photo removed; 「더 보기」 30 rows; 괴담톡 wordiness fix; 소모·장착 guide; point double-count fix; 가계부 timestamps + colored day totals; 호출 흐름 redesign; 95 hardcoded guides moved to 지침 tab; 지침 menu regrouped like 기능 tab. Open bugs: 「착한 친구」 lorebook never read; 마우스 액션 reverse-ㄱ broken. 부상 ON HOLD.
- Settings table design (11-12/13, OK'd): per-board table (괴담넷·괴담갤·세정게·연어 마켓) × 넘길 내용 cols (봇 설명, 작가 노트, 페르소나, 상시 로어북, 관련 로어북, 2차 참조) + per-feature table (새로고침, 글 쓰기, 댓글, 쪽지), both must be checked; quantity table per feature (챗로그, 지난 기록, 요청 토큰 상한). 괴담톡 features 답장/새 메시지 확인/보기 전용 방; 인물 로어북 one column. 상점 rows 기본 상점·우주 쇼핑몰·백일몽 포인트몰 (망상 later), features 진열·문의·1:1 상담, 맥락 반영 = column. 상시 로어북 = single 「로어북 선택」 picker in 호출 > 로어북 호출, default Faction+Roster; user: don't touch further.
- Avatar idle mixing → 아바타 대기 동작 섞기 (cmsg_01SMy6spzkHA3Ttz9fg54ZY8TY2kbiCpwLwnv7MjG8SDkw), waiting 1 vs 2.
- 망상홈쇼핑 thread (cmsg_01SMy6spzkHA3Ttz9fg54ZY88dXKJb4SbkqKoJeBXd5fwV, FULL): handed off. Doc /mnt/project-files/망상홈쇼핑_1109/넘김_1113_이어가기.md. Layout redesign open → [[goei-homeshop-state-1112]] [[goei-homeshop-impl-1111]]

## Open design
- 설정창 개편 docs /mnt/project-files/settings_redesign_1111/. No 접기 except 그림 대체 말. AI 상담 창 floats beside settings, 보조 model, never in context. 갱신기·Director never in bulk buttons. 「받기」 column don't narrow. 대전 removed from release.
- 메인 요청 넘기기 4 kinds: 이번에 일어날 일 / 이미 끝난 일 / 진행 중인 일 / 참고 기록 (same to 갱신기).
- 공용 대화 패널 (cmsg_01SMy6spzkHA3Ttz9fg54ZY8HR2ug8fmt6Zps86jJQu4DJ): 1 frame + 판 5종; 3 decisions pending; no build until OK. Injury = 부위+내용, stages 멀쩡/가벼운 부상/치명상/쓰러짐.
- On hold: 대전 필살기, 리수폿 옵션.
- Lesson: `pgrep -f 'python3 -I X'` (plain pattern matches itself).
- Legacy: [[goei-skill-kits]] [[pixellab-text-prompts]] [[goei-dialogue-rules-1101]] [[goei-window-decisions-1101b]] [[goei-fix-thread-1110]] [[goei-locker-handoff-1102]] [[goei-persona-faction-1102]] [[goei-settings-redesign-1111]] [[goei-reflect-mode-1111]] [[goei-progress-panel-1109]] [[goei-cutF-no-ref-1110]]
