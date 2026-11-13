---
name: goei-audit-method-1109
description: 11-09 USER (furious) — 전수점검 방식 바꿈: 눌러보기 도구(click-audit 전체 누르기) 폐기, 바뀐 곳만 기능 단위로 코드 따라가기 + 1분 시험, 찾는 즉시 넘김
metadata:
  type: feedback
  modified: 2026-11-09T11:49:42.371Z
---
2026-11-09 11:47 USER: 「이거 테스트 한세월 돌릴수 없어」「매번 수정때마다 이지랄 할거야?」「결과적으로 제대로 잡지도 못하잖아」「점검방식 완전히 뜯어고쳐 효율적이고 빠르게」「빨리 건드린 부분만 점검해」「너때문에 지금 모든 작업이 다 밀려있어」.
Rule (replaces 11-08 「전수점검은 눌러 보기부터」):
1. Do NOT run click-audit.mjs sweeps (whole-screen clicking, 20min+ per run, only catches layout, missed real bugs like 호출 흐름 missing 5 sites).
2. Scope = what was touched (git diff of the change / the feature the user names) + what reads the same settings/state (연계).
3. Per feature trace end to end in code: 설정 화면 → 저장 키 → 읽는 곳(파일:줄) → 모델에 가는 글/화면/저장. Check: 정말 따로인지(같은 키·같은 객체 공유), 설정이 실제로 읽히는지(허당), 목록·흐름·요약 화면에 빠진 것.
4. Only if code is unclear: one ≤1-minute harness test (boot, one action, read window.__calls.llm / scriptstate, one capture).
5. Send each finding IMMEDIATELY to the fix thread (「릴리스본 버그 고치기」 cmsg_01SMy6spzkHA3Ttz9fg54ZY87h4WoyKA1zbvRj5NtnxCx5) and one line to user. Never batch.
6. Re-check after a fix = only that spot, ≤1 min.
7. No long agent swarms that report nothing for 40 min; first result within ~10 min.
**Why:** 40 minutes of 7 agents produced 1 finding; user's whole pipeline stalled.
**How to apply:** every 전수점검/점검 request. Related: [[goei-click-audit-1109]].

**11-13 00:15 KST (user, angry: 「이런걸 말해줘야 아냐」):** when work is handed on to another thread/branch that will merge more on top, do NOT run the full browser suite at each hand-off. Merge everything first, run only tsc + unit + the browser tests touching conflicted files, push at once; run the full suite ONCE right before release. List the tests not run.
