---
name: goei-bg-attach-immediately
description: 생성 결과는 한 장 나올 때마다 즉시 그 답글에 그림 파일로 첨부 — 모아서 붙이기·링크 페이지 금지 (사용자 2026-11-01 07:35~07:45 격노)
metadata:
  type: feedback
  modified: 2026-11-01T07:46:01.463Z
---
2026-11-01 사용자: 「1~2분 뒤가 아니라 뽑히는 대로 보여줘야지」「지금 뽑은 거 내놔」「왜 내가 물어봐야만 나온 거 줘」. 옛 스레드는 첨부 한도(24장)가 차서 링크 페이지로 대체했다가 「바뀐 게 하나도 없다」로 끝남. 새 스레드에서도 6장 중 4장을 모아 붙이다 질책.
**Why:** 사용자는 링크를 열지 않고 글에 붙은 그림만 본다. 모아서 붙이면 사용자는 아무것도 안 나온 줄 안다.
**How to apply:** PixelLab 잡을 동시에 보낸 뒤, `until [ -s log ]` 식으로 기다려 한 장 완료될 때마다 `post_message`에 에일린 비교 x2 그림을 바로 첨부. 첨부 한도가 차면 새 스레드로 넘긴다(지휘자에 요청). 사용자가 「밑그림 넣지 말고」라 하면 inpaint 없이 generate-image-v2로 새로 뽑는다. See [[goei-pixellab-bg-prompt-rule]], [[pixellab-concurrency]].
