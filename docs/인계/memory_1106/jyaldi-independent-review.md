---
name: jyaldi-independent-review
description: 2026-10-21 independent frame-by-frame review of all 132 쟈알디 demo clips (build 06befb0): 13 broken, 27 minor, method and file locations
metadata:
  type: project
  modified: 2026-10-21T16:14:15.812Z
---
Independent review (thread 쟈알디 클립 독립 검수, 2026-10-21) of release/demo/jyaldi-full.html at 06befb0: 132 clips, 13 broken, 27 minor, 92 OK, none worse than 01dbbfd.
Broken: pipe reload blast grabknee drink down getup walk_shotgun handshead lookback push collapse deskslam.
Report: /mnt/project-files/jyaldi/쟈알디_독립검수_2026-10-21.md; per-clip sheets /mnt/project-files/jyaldi/독립검수_1021/클립별/.
**Why:** user kept finding broken clips that making-threads called "checked"; the 28437a7 steel pipe had two pipes and a back-turned frame.
**How to apply:** check clips from the strips embedded in the built HTML (`const STRIPS =` line), not source PNGs, so code fixes are included. Recurring defects: 3/4 front turn, grey leftover shards, lying faces as blobs, weapon length mismatch between clips. See [[jyaldi-full-build]].
