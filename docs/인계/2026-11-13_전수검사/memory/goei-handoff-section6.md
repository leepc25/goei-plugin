---
name: goei-handoff-section6
description: 2026-11-01 — the final handoff on merge-1101 gained a §6 (10-29~11-01 dawn work, 578 commits) that all 8 project-thread sessions missed; read §6 before touching field ledger/request format, money, KO/death, perks, stats, NPC ecology, combat
metadata:
  type: project
  modified: 2026-11-01T09:13:08.177Z
---
`docs/인계/2026-11-01_반성문_빠뜨린것_수습.md` + `docs/인계/2026-11-01_최종_전체_인계.md` §6 (both on `claude/merge-1101`, commits 8c77180151·04e20f0039, merged into claude/project-thread-1h1kah 11-01 09:15). The first handoff (05458eadd4) omitted two days of work; the 8 sessions forked from it never saw §6. Code was already in every branch — only the document was missing.
§6 contents: 6-1 field ledger → model text (English short sentences, [Field log], place headers, merged moves/money, old interludes = big events only; F6 `[Field visit]/[Scene]` block format explicitly listed as REMAINING/partial), 6-2 money settle + field close on send (user 10-30/31), 6-3 KO/death/named-fight, 6-4 perks/roguelike (no stat screen; unique perks abolished; HUD perk chips), 6-5 stats/damage (sum-25 random, crit 5%/200%), 6-6 NPC ecology (streets, police patrol, visit response, mob talk), 6-7 dialogue prep decisions, 6-8 combat engine/motion, 6-9 UI/release 0.18.2, 6-10 tools, 6-11 misc.
**11-01 09:08 incident:** I rebuilt the request block to the 10-26 §13-2 format (`[Field visit · …]`) assuming the 10-31 work was lost; the user said it was the exact opposite of their intent. Reverted (137ac4b396); the 10-31 format is live again. Do NOT change the request format again without the user's one-line statement of intent.
**Why:** acting on an incomplete handoff produced work contrary to the user's decisions.
**How to apply:** for anything in the §6 areas, read §6 first and treat 10-29~10-31 commits marked [사용자] as decisions. See [[goei-field-request-format]], [[goei-remaining-work-1101]], [[goei-merge-1101]].
