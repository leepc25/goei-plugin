---
name: goei-gpt-image-prompts
description: Rules for writing GPT image-request prompts for the user (shared pictures, 2026-10-21)
metadata:
  type: feedback
---
Never tell GPT "ONE image per reply" or make it wait between images. Ask it to generate the whole list in order in one go and resume from the next number on 「계속」.
**Why:** 2026-10-21 the user was furious that the shared-image request forced one image per answer (30+ round trips).
Before fixing an image ratio, check EVERY place the image is shown (grep aspect-ratio in src/ui/style.css): situation images show as a square when a card is opened and in the CCTV view, not only as the wide strip. All GPT shared images are 1:1 1024 (card 600×600); NAI agents 832×1216.
**How to apply:** docs/공용그림_GPT요청서.md (괴이 30 = 15 places x 2, 사건 12, 특수 8, 조직 8, 거점 6, 기본 거점 외부 7). Agent images are made by the user in NAI (docs/공용요원_NAI프롬프트.md), not GPT. Give all prompts at once, never mark parts as deferrable. Matching code src/core/sharedpics.ts.

2026-10-21: user delivered all 71 (/mnt/project-files/공용그림_71종_PNG.zip), names exact. Converted to assets/wiki/{Situations,Shared,Bases} AVIF q50, commit d7f3c79; then user chose ALL wiki+shared pictures at 600px (commit e2b871a, wiki re-encoded from codex q90 originals; card 11.8MB). Do not use 720 for GPT shared pictures anymore on branch claude/project-thread-z8xi3i (handed to lq1jt8 to merge). Minor off-brief: Shared Org Religious shows a cross, Shared Base Religious is church-like.
