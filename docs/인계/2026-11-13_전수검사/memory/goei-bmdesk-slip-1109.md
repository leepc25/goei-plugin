---
name: goei-bmdesk-slip-1109
description: 11-09 USER furious over 포인트몰 상담원 「몰래 흘림」 — FINAL: leave dice & guide as is; only hide card in failure raw view
metadata:
  type: feedback
  modified: 2026-11-09T16:56:24.757Z
---
11-09 16:50~16:56 KST. Check thread read dice 「몰래 흘림」 + manual line 1 (no real name) as "counselor may leak own real name"; release thread passed it on unchecked and then sent the fix thread 3 different drafts mixing real name vs company secrets → user furious (「실명이랬다가 비밀이랬다가」「누더기 되고 있잖아」「교차검증 안 하냐」).
- FINAL (user 「그렇게 해」 16:56): DESK_AXES_DEFAULT (src/core/bmdesk.ts) and bmdesk.txt MANUAL stay unchanged. 「몰래 흘림」 = leaks company secrets, not own name. Only code fix: hide <card> (실명·직급·부서) in failed-consultation 「받은 글 보기」.
**Why:** unverified premise + flip-flopping drafts patched the guide into a mess.
**How to apply:** cross-check a checker's PREMISE, not just the code line, before asking the user; settle a wording before sending a fix thread, send once. Related: [[goei-cos-mall-decisions-1109]] [[goei-guide-minimal-1109]].
