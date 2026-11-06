---
name: goei-remaining-work-1101
description: 2026-11-01 consolidated remaining-work list for the game (docs/할일_정리_2026-11-01.md) incl. the forgotten 캐릭터 통합창 — read before telling the user what is left; code-only field items 1-1/1-2/1-3/1-8/1-9/HUD are DONE
metadata:
  type: project
  modified: 2026-11-01T08:28:47.184Z
---
2026-11-01 the user complained the field thread was confused and had forgotten the **캐릭터 통합창** (character status window: stats·skills·perk grid·inventory, pixel canvas). Status: design draft only `docs/설계_통합창_퍽.md` (10-30); PixelLab frames NOT generated; no code; now owned by thread 「캐릭터 통합창 PixelLab으로 뽑기」.
Clean list: `docs/할일_정리_2026-11-01.md` (branch claude/project-thread-1h1kah, copy /mnt/project-files/field/). Groups: done 11-01 / code-only / needs art first / user decisions / release.
**Code-only items finished 11-01 (user said 「일단 진행해」), all on claude/project-thread-1h1kah, tests 559 pass:** 1-1 nude-hit → field (Actor.nude/setNude, nude_* clips; visible only once the shower feature calls setNude), 1-2 field hit = line 18 + gradual knockback, 1-3 name tags ally green / foe red (defaults, changeable), 1-8 field save/restore via `$fd_state.world` (needs·follow·nude·player spot·clock; offline need decay floored at 30; card clock wins), 1-9 field talk uses living people record + `[[관계 <계기>]]` tag → people cue (TALK_CUES, no 중대위반), skill HUD per character cfg (no gun → no 사격 slot, real cooldowns, skill name caption). Not done: 1-9 faction-rep time recovery (no design), 1-5 combat resist/boss, 1-10 old-logic cleanup.
Stale items in docs/구현_남은것_체크리스트.md: I4 동행 따라 걷기, G7 보안선 외부인, C16 순찰 경찰 are DONE; C15 세력 NPC 배치 needs faction site backgrounds first; C17 취객 비틀걸음 needs motion art.
**Why:** user wants one clean list, not ad-hoc recollection; forgetting a user-known item (통합창) damaged trust.
**How to apply:** when asked "what's left", read this doc + 최종 인계 first, never list an art-dependent item as code-only. See [[goei-merge-1101]], [[goei-field-no-model]].

**2026-11-01 09:45 user:** 1-4 (difficulty setting), 1-5 (combat resist/boss), 1-10 (old-logic cleanup) REMOVED from the list — 「전부 날려 어차피 이건 새로 만들어야해」. 1-9 faction-rep time recovery removed (no time-based change ever, see [[goei-field-is-chat-aid]]). 1-7 narrowed: no chat attach, no summaries; only candidates = keep weight≥2 events when the 300 cap trims, and removing the old 「보고서 붙이기」 button — awaiting user's word.

**09:55:** 1-7 DONE (31f2844343 on 1h1kah, not yet in merge-1101): `trimEvents` in src/core/field.ts keeps weight≥2/fact events when the 300 cap trims; 「보고서 붙이기」 button + postReport removed (src/ui/game.ts, src/host/game/card.ts). The start-screen 「본편 연동」 report rows are dead since 10-28 출동 removal (game never calls bridge.report) — offered removal, awaiting user. All code-only field items in this thread are finished; left = re-merge into merge-1101 + release.

**14:10:** 1h1kah now also holds 정보창 (cxist7+jys7dn) and toilet dialogue (d5kaiz). 560 tests pass. Still not re-merged into merge-1101 since bc7cbf6fcf.

**15:45:** 1h1kah = everything (정보창, toilet dialogue, toilet rooms/stalls/표시등 429aa378b7, intrusion rounds 1–2). User said 「화장실 작업 완료」. 568 tests, field QC pass (first run flaked at the sit-menu wait; rerun passed). Still NOT re-merged into merge-1101 since bc7cbf6fcf — do that before 「릴리스해」. Open: toilet.same_open dialogue cell.
