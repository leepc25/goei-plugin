---
name: goei-shared-anomaly-pics-2
description: 공용 괴이 그림 2차 32장 GPT 요청(2026-10-21)과 장소 매칭 수정 상태
metadata:
  type: project
  modified: 2026-10-21T16:06:28.469Z
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

- 2026-10-21 사용자: 공용 괴이 그림 풀이 부족 (영화관 괴이가 지하철 그림). 원인은 '광역시'의 '역' 오매칭 버그 + 장소 15곳뿐.
- 수정(src/core/sharedpics.ts, v0.16.38에 포함): 한 글자 낱말은 낱말 끝에서만, 이름 점수 2배, 새 장소 16곳(Theater·Mall·Restaurant·Church·Bathhouse·Store·Arcade·Library·Parking·Rooftop·Bridge·Police·Military·Restroom·Bus·Lake) + 그림 없을 때 FALLBACK.
- GPT 요청서 docs/공용그림_GPT요청서_2차.md (main 6fde8dd), 저장 경로 assets/gpt/공용괴이_2차/<이름>.png. docs/GPT_요청_목록.md 를 이때 새로 만듦.
- Released in v0.16.38 (2026-10-21, main 954aeca), 32 pics in the card. Redo of Restaurant 2, Church 1 received (a52a509), passed, in card on branch lq1jt8 (ca9fcea) for next release. v0.16.38 also hides the game button (shown only with window.__goeiGame=true or localStorage goei:game=1) until the user says the game is complete.
- **How to apply:** 그림이 들어오면 600×600 AVIF q50으로 바꿔 assets/wiki/Situations/ 에 넣고 카드에 실은 뒤 사용자가 말할 때 릴리즈.
- 2026-10-23 thread 「괴이 플러그인 세부 수정 10」 closed by user. NOT on main (v0.16.55) yet: branch claude/project-thread-lq1jt8 commits ca9fcea (redrawn Restaurant 2 / Church 1 AVIFs) and fea645a (CCTV signal-return effect fx-back, see [[goei-cctv-effects]]). Merge them in the next release.
