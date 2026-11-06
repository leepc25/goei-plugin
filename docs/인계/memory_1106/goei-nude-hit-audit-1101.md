---
name: goei-nude-hit-audit-1101
description: 2026-11-01 nude-hit rows (125 chars × G,H1–H6) audited, 44 regenerated, wired into packs/testroom on branch claude/project-thread-655bxw
metadata:
  type: project
---
Thread 「맨몸 피격 동작 연결하기」, branch `claude/project-thread-655bxw` (off merge-1101, not merged). Doc: `docs/인계/2026-11-01_맨몸피격_전수점검.md` (incl. 「11-01 결과」).
- Done 11-01: 44 regenerations (H5×40, 곽성주 H4, 게슈간 H1, 에일린·데쥬레 H6) all OK; H5 prompt rewritten (no end pose in text). `shower_fix.py` now: H1/H2 frame0 = G last, H3 frame0 = H2 peak, residue-laden frame1 → frame2, specks, floor pin. 이연화·제이 G restored from _old.
- Wired: build.py SHOWER G/H1–H6, SH_G loop from frame 2, charPacks/core ground sets (SH_H3 fall, SH_H4/H5 lie), testroom menu 「맨몸 피격」. Packs rebuilt (--all needed; Eileen sources live in `_old/에일린_라이브판_2026-10-29/`, build.py falls back there). npm test 547 pass.
- Known: `npm run test:browser` fails on this branch at start (hq build-demo.mjs deleted 10-31) — unrelated.
**Why:** user wanted every row checked before linking; gate rule applied (44 approved, now 0 left).
**How to apply:** next = user review / merge into merge-1101; any new PixelLab gen needs a fresh 「뽑아」 count. See [[goei-merge-1101]], [[pixellab-concurrency]].
