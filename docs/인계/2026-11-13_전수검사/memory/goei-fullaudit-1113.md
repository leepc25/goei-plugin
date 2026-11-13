---
name: goei-fullaudit-1113
description: 11-13 01:33 KST user orders for release thread 전수검사하고 릴리스하기 — ultracode whole-bot audit, FULL test this once, release authorized after fixes; work state
metadata:
  type: project
  modified: 2026-11-12T16:35:17.306Z
---
Thread 「전수검사하고 릴리스하기」 (cmsg_01SMy6spzkHA3Ttz9fg54ZY8CaV8MmZNJMr6i4WjnuBNit). Work branch claude/project-thread-kyw9bz (fast-forwarded to 9rc8hb 1a6828bd7 = unreleased batch on v0.21.11).

**User orders (11-13 01:30–01:33 KST):**
- 「철저하게 검증한다 / 이 봇의 모든 부분을 / 까뒤집어 문제점을 찾아내 개선한다」, with 울트라코드 (multi-agent workflow explicitly opted in).
- 01:33: checklist line 「타입 검사·단위 시험, 이번에 건드린 화면만 브라우저 시험」 is WRONG for this job: 「울트라코드 시험이라 전체 검사 해야해」 = this ONE time run the full inspection (my reading: every plugin screen test, not only touched screens; game/legacy tests still not run because the game does not exist). The normal test rule in MEMORY.md stays for later work.
- 01:33: 「호출 흐름 화면 보여 주기는 빼고」 (he already said 「일단 이대로 해」 for 고침5 at 01:32) and 「검사 완료되고 수정할거 수정한뒤에 릴리스까지 해」 = RELEASE AUTHORIZED for this batch once audit + fixes + full test are done. No further 「릴리스해」 needed for this one release.

**How to apply:** fix functional bugs directly; anything that changes a user decision, guide wording, UI design, or deletes things → do not change, list for the user. Release flow: branch `handoff` 인수인계/릴리스_스레드_인수인계.md §3, [[goei-release-thread-1109]] gotchas, [[goei-release-update]].

Live code = 252 files reachable from src/main.ts + src/body-entry.ts (~67k lines); src/game, src/host/game, core/field*.ts are NOT in the bundle (dead, do not audit or test).

**01:34 KST user:** 「난 자러 갈테니 작업 완료 해놔」 (finish autonomously incl. release) and 「브라우저 시험은 마냥 몇시간씩 그렇게 잡고 있으라는게 아니야 예전처럼」 = browser tests must NOT hold the work for hours: run them in the background alongside the audit, once, rerun only failed ones.

**State 01:50 KST:** audit = 9 Workflow runs (groups W1–W9, 27 finders, each finding verified) from script /root/.claude/projects/-home-user/fb38b32c-3736-56bb-8fbc-7150cb3e7742/workflows/scripts/goei-full-audit-wf_70ae0ec2-648.js (transcripts beside it under subagents/workflows/wf_*; journal.jsonl holds results). Baseline logs in repo .scratch/base/. Next: collect confirmed findings → fix (bugs only) → full test once → release.

**01:41 KST user (scope widened):** 「이번에 검사할것은 각종 기능 오류 등 뿐만 아니라 로어북 및 지침까지 봐서 고쳐야 한다. 지침간 모순, 불일치, 불합리, 부적절, 비효율, 과토큰 등등」 = audit AND FIX lorebooks + guides too (contradictions between guides, mismatch, unreasonable, inappropriate, inefficient, too many tokens). This is explicit permission to edit guide/lorebook text in this job; keep edits minimal and leave a before/after record for the user (old rule 「never rewrite a working prompt, show diff」 → satisfied by the diff record).

**State 01:55 KST:** second audit = 6 Workflow runs (groups T1–T6, guides 9 + lore 8 finders) from script .../workflows/scripts/goei-text-audit-wf_c164a3e9-3fd.js. Fact: the "lorebook" text now lives in src/data/world/{agents,anomalies,orgs,sites,appendices,relations}.json + src/data/guides/faction-original.txt, roster-original.txt (the built card lorebook holds only Directory + Plugin manifest); dumps for reading under /tmp/audit_1113/lore/world/. Browser tests: runner .scratch/run-browser.mjs (44 plugin tests, conc 2, results .scratch/base/browser/result.json; qc-loader only after release prep).

**State 08:30 KST 11-13:** usage limit stopped audit: 39/44 finders, 499 findings, 116 confirmed. All findings in /mnt/project-files/release_check_1113/audit_results/검사결과_499건.json (+ show.py, both scripts). Fable blocked until 11-16 05:00 KST (rate limit), session runs Opus. Verify-rest workflow wf_2282e34a-428 (script goei-plugin/.scratch/wf/verify-rest.js, 118 batches) on Opus for 389 unverified. 5 missing finders (loader, gupdp, gtoken, lorg, lan3): user to choose Opus now or Fable on 11-16. Fix commit 1 e21c62409 pushed on claude/project-thread-kyw9bz. Unit fail qc-loader-build #600 = stale release/ packs, clears after release:prep. 송진섭 high-school (lagA#6, lscene#9) left for user decision.
**08:28 KST user:** finish everything except the 5 missing finders, RELEASE, then hand off to ANOTHER ACCOUNT (memory/project files do not carry over) → put handoff doc + memory copy + audit results + scripts INSIDE the GitHub repo, CLAUDE.md top line points to it. 5 missing finders to run on Fable after 11-16 05:00 KST in the new account.
