---
name: goei-shared-anomaly-pics-2
description: 공용 괴이 그림 2차 32장 GPT 요청(2026-10-21)과 장소 매칭 수정 상태
metadata:
  type: project
  modified: 2026-10-21T16:06:28.469Z
---
- 2026-10-21 사용자: 공용 괴이 그림 풀이 부족 (영화관 괴이가 지하철 그림). 원인은 '광역시'의 '역' 오매칭 버그 + 장소 15곳뿐.
- 수정(src/core/sharedpics.ts, v0.16.38에 포함): 한 글자 낱말은 낱말 끝에서만, 이름 점수 2배, 새 장소 16곳(Theater·Mall·Restaurant·Church·Bathhouse·Store·Arcade·Library·Parking·Rooftop·Bridge·Police·Military·Restroom·Bus·Lake) + 그림 없을 때 FALLBACK.
- GPT 요청서 docs/공용그림_GPT요청서_2차.md (main 6fde8dd), 저장 경로 assets/gpt/공용괴이_2차/<이름>.png. docs/GPT_요청_목록.md 를 이때 새로 만듦.
- Released in v0.16.38 (2026-10-21, main 954aeca), 32 pics in the card. Redo of Restaurant 2, Church 1 received (a52a509), passed, in card on branch lq1jt8 (ca9fcea) for next release. v0.16.38 also hides the game button (shown only with window.__goeiGame=true or localStorage goei:game=1) until the user says the game is complete.
- **How to apply:** 그림이 들어오면 600×600 AVIF q50으로 바꿔 assets/wiki/Situations/ 에 넣고 카드에 실은 뒤 사용자가 말할 때 릴리즈.
- 2026-10-23 thread 「괴이 플러그인 세부 수정 10」 closed by user. NOT on main (v0.16.55) yet: branch claude/project-thread-lq1jt8 commits ca9fcea (redrawn Restaurant 2 / Church 1 AVIFs) and fea645a (CCTV signal-return effect fx-back, see [[goei-cctv-effects]]). Merge them in the next release.
