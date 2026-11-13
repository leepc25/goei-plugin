---
name: pixellab-clip-qa-process
description: Required QA order for PixelLab skeleton clips after the user found many anatomically wrong 쟈알디 clips (2026-10-21)
metadata:
  type: feedback
  modified: 2026-10-21T15:04:45.594Z
---
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
