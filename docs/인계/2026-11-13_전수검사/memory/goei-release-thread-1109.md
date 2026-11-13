---
name: goei-release-thread-1109
description: v0.21.5 RELEASED 11-10 09:12 KST (PR #48); release thread procedure gotchas and what the next release starts from
metadata:
  type: project
  modified: 2026-11-10T00:14:26.590Z
---
- Thread 「수정본 릴리스하기」 (cmsg_01SMy6spzkHA3Ttz9fg54ZY8Vf1rN5VXuVMpiFB8LM4BHT) = only place releases happen.
- **v0.21.5 released** 2026-11-10 09:12 KST: PR #48 squash → main 02fe29f88; https://github.com/leepc25/goei-plugin/releases/tag/v0.21.5. Contains fix branch swxqg6 up to f5825c846 + pre-release audit fixes (20+ bugs). Next work: restart branch from main.
- Flow that the user demanded (11-09, angry when skipped): fixes → 전수점검 of changed parts by the check thread → cross-check each finding (premise too, not just code line) → fix thread fixes → recheck fixed spots → build/tests → merge → release. User cap: inspection ≤1 hour, stop release if bugs keep coming.
- Gotchas: prep's card build rewrites src/data/install/directory.json AFTER build → first `GOEI_VS=1 npm run release:prep` may fail qc-loader-build test; run prep again (no bump). Copy dist/vs→release/vs after. test-browser has no --trace flag. qc-settings-pages ~18 min. items-browser / shop-judge-browser / qc-people-live-browser are NOT in tests/browser-suite.json → run `node tests/<name>.mjs` directly (qc-people-live needs .scratch/fixture/fixture.json arg). release.yml must be dispatched by hand (workflow_dispatch, ref main); release appears ~2 min later as prerelease.
- Settings menu changed in 77deeef37: set:update → install (설치·업데이트), rules → one page rule:all, 인물 갱신 기록 moved to manage:people; browser tests updated accordingly in 0.21.5.
- Local stash on old container ("stale release build") is disposable.
Related: [[goei-return-1109]] [[goei-bmdesk-slip-1109]]
