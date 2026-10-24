---
name: character-art-rules
description: 요원 도트 클립 그림 규칙 — 캐릭터만 그리고 가구·물건·무기·효과는 좌표로(2026-10-21 사용자 확정), 품질 절차
metadata:
  type: feedback
  modified: 2026-10-21T16:58:28.866Z
---
- **그림엔 캐릭터만**(2026-10-21, "캐릭만 그려야", "오브젝트를 집었을 때 어쩌라고", "부스까지 그리면 어떻게 배치하라고"): 가구·벽·창·문·사다리·밧줄·기계·든 물건·무기·손전등 빛·불꽃·연기·김 전부 뺀다. 캐릭터는 빈 손(쥔 모양).
  **How to apply:** 장마다 손 좌표·각도(full/final/hands.json = 엔진 형식 {클립:[[x,y,각도]]}, 각도 0=위로 세움·시계 +; manifest anchors에 hand2까지), 좌판·벽·문손잡이 좌표를 남기고 게임이 따로 그린다. 빌더(tools/build_jyaldi_full_demo.py + jyaldi_fixes.anchors)가 rig 뼈대에서 뽑음.
- **사용자가 하나씩 지적하게 두지 않는다**("지적하다 밤 새겠네"): 데모 내기 전 전 클립 장 단위 전수 검사. 2026-10-21 결과 docs/캐릭터제작서/쟈알디_전수검사_2026-10-21.md.
- **팔꿈치 버그**: rig ELB_DOWN IK가 손이 어깨 위면 팔꿈치를 등 뒤로 꺾음. 자동 검사 w[1]<s[1]+2면 e[0]>=s[0]-3. 누운 다리 마름모 금지(곧게 또는 위 무릎 하나만).
- **생성기 한계**: PixelLab은 화면 반대쪽으로 도는 자세(뒤돌아보기)를 못 그림(rig 2번 바꿔도 3/4 정면). 2026-10-21 해법 = 기본 대기 장의 목 위만 코드로 좌우 반전(jyaldi_fixes.lookback_frames, 비용 0). 옆모습에서 뒷팔이 가려 한 팔만 보이는 건 결함 아님.
- **재생성 후엔 그 클립의 코드 보정(jyaldi_fixes 덧그림·ERASE·DROP, 빌더 order/rng)을 반드시 다시 본다.** 2026-10-21 쇠파이프: 옛 덧그림이 새 그림에 겹쳐 파이프 두 자루, 옛 order로 등 돌린 장이 들어가 사용자 격노("손 댈수록 맛이 가").
- **3/4 정면 원인 = rig P()의 s(어깨 회전)**: s -0.8~-1.2면 어깨가 16px 벌어져 정면으로 그림 → 옆모습은 s -0.25 이하(rig.SIDE). 손을 머리 뒤로 넘기면 등을 돌림 → 머리 위 앞쪽으로. 2026-10-21 이걸로 blast·drink·down·getup·collapse 통과(24회). grabknee는 s 고쳐도 정면(잡기 자세 탓 추정).
- **품질 절차**: 실제 동작 자료와 대조 → 자동 검사(팔꿈치, 발 y=136, 옆모습) → 미리보기 → 생성 → 장 단위 검수 → 시연판.
Related: [[game-design-feedback]], [[jyaldi-full-build]]
- **2026-10-23 user:** hand-coordinate weapon attachment "아무리 해도 안된다" → drop it. Weapons get drawn by PixelLab: signature weapons via a character state, swappable (temp) weapons via a state or edit-animation-v2 (untested; test 1 clip only with approval).


- **2026-10-23 10:25 user: picked-up/swappable weapons ON HOLD (not implemented for now).** Own basic/ranged attacks may still draw the agent's own weapon in. Weapon-group ideas (7 groups, guide-stick) were discussed but shelved; see [[pixellab-256-cost-weapons]].