---
name: goei-skill-kits
description: 2026-10-23 user ordered 3 skills (고유기술/충전기/필살기) for all 55 🙂요원 characters + DNF-style super cut-ins + GPT dot guides; current field has no combat FX
metadata:
  type: project
---
User 2026-10-23 19:29–19:36 (thread 「봇 수정」):
- Every character in the 🙂요원 lorebook folder (55: 관리국12·가짜14·백일몽16·중립10·개체3; user said "53") gets 3 skills: 고유기술 (C short), 충전기 (C hold), 필살기 (S). Written detailed in docs/요원_기술안.md.
- 필살기 must play a DNF-style cut-in: pixel upper-body portrait in a fighting/characteristic pose (never standing blankly), skill name + line in pixel text (Galmuri, Korean only).
- Cut-in portraits and skill effect sprites are dot art made by GPT → needs GPT output guide (docs/GPT_컷인_이펙트_지침.md).
- Do NOT just restore old 동작설계 docs: characters are now 128×256 7-head, low top-down SE-only, belt-scroll field. Keep what fits, drop, add.
- User asked if current build is final: it is not. Field has no combat/hit FX. Old graybox engine had basic fx (src/game/action/ui/fx.ts, engine/render.ts cutin) not wired to field. Plan told to user: common hit feel in code (hitstop, flash, knockback/launch/bounce, shake, sparks, damage numbers, super darkening/band), signature skill FX as GPT dot sprite sheets.
Also pending in same thread: restore game title screen (visit mode boots straight into game since 4648ab13, modules.ts boot) then restyle; release file rename on branch claude/project-thread-22hjy8 (unreleased).
