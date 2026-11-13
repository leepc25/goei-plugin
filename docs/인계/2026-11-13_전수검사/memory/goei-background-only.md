---
name: goei-background-only
description: User 2026-11-12 — all work must run in the background only, so every user message gets an immediate answer
metadata:
  type: feedback
---
2026-11-12 00:46 KST (thread 설정창 개편 5) user: 「너 이제부터 무조건 백그라운드로만 작업해」.

**Why:** Claude kept working through a long foreground turn (reverting layout, re-shooting mockups, writing memory) while the user wrote 「대답」 twice and pressed the stop button about 10 times; no answer came for ~10 minutes.

**How to apply:** every build, capture, test, generation or other long command runs with run_in_background; the turn ends right away so the next user message is answered at once. Never chain many foreground tool calls in one turn. When a user message arrives, answer it first, before any other tool. 「멈춰」/stop = stop everything immediately and say so. Related: [[goei-no-unasked-work]], MEMORY rule 2.
