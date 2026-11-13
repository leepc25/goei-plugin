---
name: goei-release-1113
description: v0.21.12 (PR #55, 11-13 ~12:00 KST) = whole-bot audit release; in-repo handoff for account switch; what is left
metadata:
  type: project
---
- PR #55 squash-merged to main a2b825b7d (branch claude/project-thread-kyw9bz). release.yml now runs on push to main by itself (a manual dispatch made a duplicate run; I cancelled the dispatch run). Do not dispatch by hand any more if a push run starts.
- Content: audit fixes 1–9 (499 findings verified), 17 user decisions, 165 approved guide/lore text edits, phone shop-settings 「인터넷 접속」 seg kept 34px one line (padding 0 4px on phone; audit's 2-row wrap broke the 34px rule).
- Tests: typecheck, unit 969/969 after release:prep, all 45 plugin browser tests pass (8 fixed tests, 1 CSS fix).
- Handoff for the user's NEW account: docs/인계/2026-11-13_전수검사/인계_다음계정_시작.md (CLAUDE.md top line points there; memory copy in memory/). Left: 5 missing finders (loader, gupdp, gtoken, lorg, lan3) on Fable after 11-16 05:00 KST via scripts' group MISS; questions in 검사결과/notes_for_user.md (나-20 kept 11-05 text, 나-2 vs 나-3/17/58 majority, gshop#9 & ggnet#7 reverted, lplumb#10 ~95 tok, dropped-item sentence, pipeline#10 added-token display, wiki#8 stale badge).
- tools/build_lite_card.py:114 still says 「설정 → 카드 명부」 in card HTML (not in approved list).
Related: [[goei-fullaudit-1113]] [[goei-audit-decisions-1113]]
