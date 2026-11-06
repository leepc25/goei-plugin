---
name: goei-dont-ask-lookups-1103
description: 확인·조사 거리(해체 코드 보기 등)는 사용자에게 「할까요?」 묻지 말고 바로 PC 스레드에 맡긴다
metadata:
  type: feedback
  modified: 2026-11-03T16:01:24.012Z
---
11-03 16:01 코디네이터 전달: 사용자는 「다 찾아야지」라고 했으므로, 데드셀 코드 확인 같은 조사 요청을 사용자에게 묻지 않는다.
**Why:** 사용자 시간을 쓰는 불필요한 질문. 조사는 이미 허락된 일.
**How to apply:** 확인 안 된 사실이 나오면 「확인 안 됨」으로 답하고, 같은 턴에 PC(해체) 스레드에 message_thread로 바로 요청한다. 사용자에게는 「확인 중」이라고만 알린다. See [[goei-no-hallucinated-claims-1103]].
