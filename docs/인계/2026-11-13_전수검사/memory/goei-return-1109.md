---
name: goei-return-1109
description: 2026-11-09 user came back from another account; where the newest handoffs are (other account worked 11-06~11-09 in a different project)
metadata:
  type: project
  modified: 2026-11-09T10:48:43.536Z
---
2026-11-09 user returned from another Claude account. That account worked 11-06~11-09 in a DIFFERENT project (chan_01Gx6YT…); its shared folder (작업_1108, 작업_1109, 눌러보기_1108) is NOT visible here. Only the repo carries its work.
- main = v0.21.4 (PR #47, 11-09 16:05 KST). Releases since 0.20.6: #42 0.21.0 (리수폿 A~J, 라이트보드), #43 0.21.1 (소지품·상점, 첫 장면은 이면의 주민들 13편만, 42편은 docs/인계/첫장면_보관_1107), #45 0.21.2, #46 0.21.3, #47 0.21.4.
- Unmerged lines at switch time (newest handoffs):
  - 눌러보기 전수점검 도구: branch claude/project-thread-5aw6ui, docs/인계/2026-11-09_눌러보는_전수점검_도구_인계.md; adds CLAUDE.md rule 「전수점검은 눌러 보기부터」(11-08 user). Left: item 17 (뒤로 단추 34/40) + ~95 unclicked actions.
  - 대기 대전(격투) 새로 짜기: claude/project-thread-oke0n4 (newest, from weeuq9), docs/인계/2026-11-08_대전_새로짜기_인계.md + _대전_새코드_시험결과.md. Standalone, not in release flow.
  - 망상홈쇼핑·쇼핑몰 팝업: claude/project-thread-9nl4nq, docs/인계/쇼핑몰_팝업_홈쇼핑_1108/쇼핑몰_팝업_홈쇼핑_계획_인수인계.md. Waiting: show body/hand clip results, A·B·C choice; no implementation before 「해」.
**How to apply:** for any of these, read that branch's handoff first; ask the user for files from the other project's shared folder if needed.
- 11-09 10:49 USER: CURRENT work = exactly 4 handoffs the other account put in ITS shared folder /mnt/project-files/인수인계/ (not visible here): 대전_돌진필살기_킹오파급_인수인계.md, 쇼핑몰_팝업_홈쇼핑_계획_인수인계.md, 릴리스_스레드_인수인계.md, 눌러보는_전수점검_도구.md. Asked user to upload them to this thread.
- 11-09 10:56 The 4 current handoffs are on repo branch `handoff`, folder `인수인계/` (대전_돌진필살기_킹오파급_인수인계.md + 롬도구/, 쇼핑몰_팝업_홈쇼핑_계획_인수인계.md (§7~9 newer than 9nl4nq copy), 릴리스_스레드_인수인계.md (release procedure: GOEI_VS=1 npm run release:prep, copy dist/vs→release/vs, release.yml must be dispatched by hand), 눌러보는_전수점검_도구.md + 눌러보기_결과_0.21.4.md). READ THESE FIRST for those 4 lines of work. Memories they cite (goei-wait-fight, goei-ui-control-standard, goei-v0211-release, goei-release-test-rule) are NOT in this project's memory.
- 11-09 10:58 USER: priority now = fixing the release build (v0.21.4), NOT 대전 (on hold). Run 4 threads: 전수점검, 메인 수정, 릴리스, 망상홈쇼핑. Asked coordinator to open them.
- 11-09 10:59 Threads opened: 릴리스본 전수점검하기, 릴리스본 버그 고치기, 수정본 릴리스하기, 망상홈쇼핑 팝업 만들기, 대전 돌진 필살기 다듬기 (user: keep 대전 open too).
