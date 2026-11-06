---
name: goei-never-block-on-pixellab
description: PixelLab 생성은 항상 백그라운드로 돌리고 기다리는 동안 다른 작업·즉답 (사용자 2026-11-01 08:18 「다중작업이 안 돼?」「재깍재깍 대답」)
metadata:
  type: feedback
  modified: 2026-11-01T08:19:06.735Z
---
2026-11-01 08:16~08:18: 생성 2분을 전경에서 기다리는 동안 답이 끊겨 사용자 격노(「뭐하냐」「재깍재깍 대답 안 하냐」「기다리는 동안 아무것도 안 할 거야?」).
**Why:** 사용자는 쉬지 않고 말을 건다. 전경 대기 = 무응답.
**How to apply:** extend_*.py 등 생성은 Bash run_in_background로 보내고, 사용자 메시지엔 즉시 한 줄 상태로 답하고, 기다리는 동안 다른 일(게임 탑재 등)을 한다. 결과 나오면 바로 첨부. See [[goei-bg-attach-immediately]].
