---
name: goei-progress-panel-1109
description: 호출 진행 창 (pipeline progress window) — approved 11-09 12:49, BUILT & pushed on branch claude/project-thread-swxqg6 (commit 5a3f71851); spec summary
metadata:
  type: project
  modified: 2026-11-09T13:12:59.035Z
---

**Status 11-09 13:12:** DONE in code (src/core/progress.ts, core/progplan.ts, host/progwin.ts, hooks in trace.ts/llm.ts/body.ts, setting 설정→화면→「호출 진행 창」). Not yet released; user has not seen it live in Risu — needs real-screen check after next release.

Spec the user agreed to (do not drift):
- PC: top-right 300px card, auto-expands at turn start, collapses 5s after end (10s on failure) into a 48px round button identical to the ghost FAB size; header drag moves it (position remembered); outside click collapses only when not running; button re-opens last turn. Rows: stage dot · name · model(메인/보조) · req→resp tokens · seconds. No progress bar.
- Phone (≤760px): NO new floating button, NOT inside 상황판, NOT top-center, NOT over the ghost button, no long-press. Fixed 5-dot vertical bar at right edge below Risu top bar (라우터·디렉터·본편·갱신기·인터넷); tap → same card as PC. Below 상황판 (z 45).
- Model names: Risu API gives no model names → show 메인/보조/전용ID only.
- Turn plan fixed at turn start; manual (button) calls make their own turn.

**Why:** user wanted Yumi-provider-manager-like live view; many phone designs rejected (see transcript 11-09).
**How to apply:** when fixing, keep the shared design tokens (--panel/--line/--signal, radius 14).

**11-10:** released in v0.21.5 but invisible in real Risu (leading <style> stripped by DOMPurify); fixed on branch claude/project-thread-xq6d97, see [[goei-fix-thread-1110]].

**11-11 (v0.21.9, PR 52):** Risu setInnerHTML also strips `class` and `style` attributes → inner markup must use data-* (data-p / data-s / data-mono) like overlay.ts/usebox.ts; test mocks now strip class/style too. USER 11-11: the window must stay visible ABOVE 상황판 (most aux features are used with 상황판 open) — supersedes the 11-09 「below 상황판 z45」 rule; z now 60, default top 76, collapsed button draggable too. Check: tests/progwin-browser.mjs. Open question to user: remove the top stage strip (names appear twice) — unanswered.
