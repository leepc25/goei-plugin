---
name: jyaldi-independent-review
description: 2026-10-21 independent frame-by-frame review of all 132 쟈알디 demo clips (build 06befb0): 13 broken, 27 minor, method and file locations
metadata:
  type: project
  modified: 2026-10-21T16:14:15.812Z
---

> **⚠ Claude 반성 · 2026-10-31 (사용자 지시로 문서마다 남김)**
> 2026-10-31 Claude는 다음 잘못을 저질렀다. 이 문서를 읽는 모든 Claude는 같은 짓을 하지 않는다.
> 1. **사용자 결정을 무시했다.** 콘쥬스는 사용자가 10-26에 20세로 정했고 인계서에도 적혀 있었는데, 옛 Claude 문장(teenage high school girl)을 근거로 화장실·샤워 그림을 거부하고, 사용자가 직접 뽑은 화장실 줄까지 팩에서 뺐다. 옷도 제복인데 교복이라고 단정했다.
> 2. **사용자 말에 토를 달고 같은 주장을 되풀이했다.** 사용자가 여러 번 지적했는데도 근거를 다시 확인하지 않아 몇 시간을 허비하게 했다.
> 3. **허락 없이 문서를 지웠다.** 「지침을 지우라」는 말만 듣고 목록을 보여 주지도 않고 96개를 지웠다가 되살렸다(결과물 삭제 금지 규칙 위반).
> 4. **문장을 덧대기만 하며 PixelLab을 낭비했다.** 이성해 점프 공격 5번 연속 실패, 이어폰 음악 120줄을 못 쓰게 만듦.
> 5. **답을 미루고 일을 멈춰 두었다.** 백그라운드로 돌릴 일을 돌리지 않고 대화만 했다.
>
> 지킬 것: 사용자 결정·위키가 근거다. 옛 Claude 자료는 근거가 아니다. 사용자 말에 토 달지 않는다. 무엇이든 지우기 전에 목록을 보여 주고 허락받는다. 실패하면 덧대지 말고 다시 쓰거나 바꾼다.

Independent review (thread 쟈알디 클립 독립 검수, 2026-10-21) of release/demo/jyaldi-full.html at 06befb0: 132 clips, 13 broken, 27 minor, 92 OK, none worse than 01dbbfd.
Broken: pipe reload blast grabknee drink down getup walk_shotgun handshead lookback push collapse deskslam.
Report: /mnt/project-files/jyaldi/쟈알디_독립검수_2026-10-21.md; per-clip sheets /mnt/project-files/jyaldi/독립검수_1021/클립별/.
**Why:** user kept finding broken clips that making-threads called "checked"; the 28437a7 steel pipe had two pipes and a back-turned frame.
**How to apply:** check clips from the strips embedded in the built HTML (`const STRIPS =` line), not source PNGs, so code fixes are included. Recurring defects: 3/4 front turn, grey leftover shards, lying faces as blobs, weapon length mismatch between clips. See [[jyaldi-full-build]].
