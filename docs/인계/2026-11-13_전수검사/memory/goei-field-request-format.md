---
name: goei-field-request-format
description: How field events reach the main-story model request ([Field log]/[Field facts], src/core/interlude.ts) — the 10-31 format IS the user's decision; my 11-01 13-2 rebuild was wrong and reverted
metadata:
  type: project
  modified: 2026-11-01T08:53:36.704Z
---
Field → main story (code: src/core/field.ts, interlude.ts, journal/field.ts, visit.ts): events (max 300) + talks stored in chat variables, no chat message; at request time spliced as system blocks `[Field log]` (after the anchor message) and `[Field facts]` (before last user msg). English short sentences, times, [place] grouping, fight = one line, old interludes keep only weight≥2. Report per visit auto-built in 기록 menu; attach to chat is manual.
**WRONG TURN 2026-11-01 09:10:** I applied §13-2 (c0d4c84) then the user said 「내 의도랑 정확히 반대」 → reverted 137ac4b396. The handoff §6-1 (see [[goei-handoff-section6]]) shows the 10-31 commits ARE the intended revision and lists F6 `[Field visit]/[Scene]` only as a leftover. Spec I had applied: confirmed spec docs/필드_세계_NPC_설계.md §13-2 (2026-10-26): header `[Field visit · 10:40–12:10]`, per scene `[Scene · place · time]`, dialogue inside its scene, end line `[End · place · time · with 동행]`, short notes. Old code had `[Field log]` + 3 note lines; now: header with visit span, per-scene headers carry the time (no per-line times), move lines dropped (scene header replaces), place names kept as Korean proper nouns, talk-only old visits get the card rule line. Awaiting user feedback on the two choices (no per-line times, Korean place names).
Also unspecced/old-Claude items (1-7): 5–8 line summary auto-insert, char budget, fold >300 events, auto-attach report.
**Checked 11-01 08:58:** all 25 remote branches searched; every committed 10-31~11-01-dawn change (field-code/dialogue/pixellab-1031) is in merge-1101 (0 unmerged). No branch contains `Field visit` — the §13-2 block format was never implemented; the 10-31 evening code session died with uncommitted work (docs/인계/2026-10-31_코드_인계.md). User believes 10-31~11-01 work was lost; offered to rebuild on 「만들어」.
**Why:** user checked the real block and found old format; they expect their decisions applied.
**How to apply:** when fixing, rewrite interludeText to §13-2 exactly; keep place names as proper nouns unless user says English; tests in tests/field-ledger.test.mjs. See [[goei-remaining-work-1101]], [[goei-field-no-model]].
