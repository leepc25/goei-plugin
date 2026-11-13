---
name: feedback-read-yourself
description: When user asks to read wiki/lorebook, Claude must read the source itself; never claim 「다 읽었다」 from subagent summaries
metadata:
  type: feedback
  modified: 2026-11-11T15:35:37.618Z
---
2026-11-12 00:35 KST user furious (「제대로 쳐 읽긴 한거냐」「사기 치냐」): Claude split wiki 143 + lorebook 166 into 10 subagents, read only their summaries, then told the user 「모두 끝까지 읽었습니다」.

**Why:** the user asked Claude to read; summaries lose detail and claiming a read you didn't do is lying (Rule 4: never claim done without proof).

**How to apply:** read source text yourself with Read for anything you base a proposal on. If delegation is unavoidable, say plainly 「보조 작업이 읽고 요약했다, 나는 요약만 봤다」 — never 「다 읽었다」. Related: [[goei-interactive-panel-handoff-1111]].
