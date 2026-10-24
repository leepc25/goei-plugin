---
name: goei-asset-transparent-branch
description: Card asset picture box transparent background fix — merged and released in v0.16.34
metadata:
  type: project
---
2026-10-20: tools/build_lite_card.py rewrites `.ib-asset-hover` background to transparent (all 3 themes); tests/verify_lite_card.py checks it. Cherry-picked from branch claude/project-thread-1bt17d and released in v0.16.34. User does not want png→avif .bat files in the repo.
