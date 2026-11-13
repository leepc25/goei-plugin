---
name: goei-open-items
description: Plugin open items after v0.16.36 (thread 세부 수정 10, branch claude/project-thread-lq1jt8, 2026-10-21) — read when the user asks what's left
metadata:
  type: feedback
  modified: 2026-10-21T10:54:19.059Z
---
When the user asks for leftovers, read ONLY the just-closed thread, not old memory lines (2026-10-21 user got angry at a stale list).
**Why:** memory lines lag behind; the closed thread is the source of truth.
**How to apply:** state as of 2026-10-21 (thread 괴이 플러그인 세부 수정 10):
- v0.16.37 RELEASED 2026-10-21 (main a8a261b) incl. everything below marked unreleased. Earlier: v0.16.36 RELEASED (main ab97448): all 13 u8cnnm commits from thread 상황판 수정 (사건 배치 칸, joint 넷·톡 call, 거점 띠, 위키 백일몽 본사/관리국 본부, 거점↔세력, B00 swap, 공용 그림 매칭 src/core/sharedpics.ts, 명부 성별). Old handoff: /mnt/project-files/goei-plugin/docs/handoff/상황판수정_인수인계_2026-10-21.md.
- Unreleased on branch lq1jt8: registry alias filter (src/core/world/registry.ts: org/department/rank names, aliases shared by 2+ entries, other entries' names dropped; agent 2-syllable given names need honorific) — fixed 괴담넷·톡·위키 related lore pulling 26 agents on 「관리국」; AG tag tolerant parsing (spaces, parens, 「중」, Korean/English names); MS state parens; IN deploy-only tag; GNet JSON repair like phone.
- Report doc (Claude Doc) https://claude.ai/artifact/Q8DapMfhRJjhmupciwWvph. User said apply all (2026-10-21, except 마도사 stays a normal key). Done on branch lq1jt8 (unreleased): Jay/브라우니/Yu-ri/Route 16/Red Lady confirm keys; Tag AG states Korean-only + gloss line, 배치 spacing, description typos (DESC_PATCHES in build_lite_card); trimRoster (drop Roster one-liners when full lore is in request); wiki answer-section folding for anomaly docs until 클리어 (world.cleared); 명부 alias cleanup 289 defaults via src/core/world/alias-drop.json (dropDefaultAliases in build + card update, user aliases kept); 캐릭터로 플레이 ($st_player agent id, src/core/player.ts, picker 「주인공」 section, opening scenes hidden, w.player excluded from rosterFor, lore exclude, phone contacts, ID card). Merged GPT shared pictures branch z8xi3i (71 AVIF, card 13.2MB).
- 임무 tab card shape: leave as is (user). In-plugin 사용법: on hold (user).
- Still unverified on a real phone: mobile 상황판 log scroll, swipe pan-y.
- User making common images (GPT 1:1 docs/공용그림_GPT요청서.md, NAI 832×1216 docs/공용요원_NAI프롬프트.md) → convert to AVIF (720×720 / 832×1216) into assets/wiki/ and rebuild card when uploaded.
- 600px images (z8xi3i e2b871a) merged into lq1jt8 and card rebuilt (11.8MB), 2026-10-21. Ready to release when user says.
- z8xi3i 5511e54 (outside-folder place cleanup via dropOldOutsidePlaces gated on card version < 0.16.37, image style tweaks) merged into lq1jt8 + card rebuilt (6958044). Next release MUST be 0.16.37 (or fix that number in update.ts).
- z8xi3i final 94af1dc (CCTV anomaly effects, user-confirmed) merged into lq1jt8 (0710d1c). Re-check z8xi3i once more before release.
- After v0.16.37 (branch lq1jt8, unreleased): board 「선택」 jumps to 임무 map with place selected (app.ts pick-event when tab != map); stronger target mark effect (red blink, ring, lock flash).
