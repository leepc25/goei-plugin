---
name: pixellab-clip-qa-process
description: Required QA order for PixelLab skeleton clips after the user found many anatomically wrong 쟈알디 clips (2026-10-21)
metadata:
  type: feedback
  modified: 2026-10-21T15:04:45.594Z
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

2026-10-21 the user found many broken 쟈알디 life clips in the demo (arms bending backward in 머리 넘기기·머리 감기·짜증·이어폰, wrong sink/mop/toothbrush angles, furniture drawn into clips, 45° bathtub) and asked "전체적으로 퀄리티가 왜이래".
**Why:** skeletons were hand-entered fast without real-pose reference. The rig's IK put elbows behind the body when hands went above the shoulder or in front of the chest. Skeletons and outputs were never checked per clip, so the user became the QA.
**How to apply:** for every regenerated clip:
1. Build the skeleton from real movement reference.
2. Auto-check elbow direction, foot contact and profile view in code.
3. Look at the skeleton preview.
4. Generate from a profile base frame (A2 is 3/4 and drifts the body to face front).
5. Review frame by frame before adding to the demo.
Character clips contain only the character, with no furniture. Held props are OK.
See [[jyaldi-full-build]], [[pixellab-usage-tips]], [[game-design-feedback]].
