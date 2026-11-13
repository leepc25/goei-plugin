---
name: goei-control-spec
description: 설정창 조작 공통 규격 (높이 34px 등) — every mockup/new UI must reuse the existing controls, never invent new sizes
metadata:
  type: feedback
  modified: 2026-11-11T15:29:52.820Z
---
All controls in the settings window follow ONE spec, already built: `src/ui/editor/style.css` block 「조작: 전부 같은 높이·모서리·선·글자」 (`.gw { --h: 34px; --r: 8px }`): height 34px, radius 8px, 1px line, 13px text. Number = one box 「− 값 +」 (`.st-step` / `.adv-step`, −/+ buttons 34px wide). On/off = switch (`setSeg` with ON/OFF → `onOffSwitch`). Choices = `.gx-segs`, chips = `.gx-chip`.

**Why:** 2026-11-12 user furious: Claude had unified all control sizes earlier, then drew step-4 grid mockups with a new small ± (26px high, 18–22px buttons, vertical stack on phone) that broke the spec. 「그거 규격 지켰어?」「메모리라는게 없나」.

**How to apply:** before drawing or building any settings UI, open that CSS block and reuse the existing classes as they are, in grids too. If a control does not fit (e.g. 8 steppers across a phone), change the LAYOUT (stack per menu), never shrink or restyle the control. Before posting any mockup, check every control against the spec and say so. Related: [[goei-settings-step4-1111]], MEMORY rule 43 (공통 규격).

Help text (11-12 user): inside help, term names must NOT be white/bold like row labels (white = row label only; help all dim, term = same dim + weight). Help sentences were 「제각각」 (different openings, mixed content, 4 layouts, mixed endings) → proposed one rule (1st sentence = what it does: 「켜면 …해요」/「…의 수예요」; 2nd = cost in fixed wording; option list only for 3+ choices, one layout; 0's meaning shown in the control; no help for self-evident rows). Awaiting OK in thread 설정창 개편 5.

Mockup basis (11-12 user 「무슨 기준으로 그리는거냐, 실제 설정창 사이즈는 아냐」): real settings window at 1920×1080 = ~1727×971, right content pane visible 1466×918; phone 390×844 → pane 665px high. NEVER shoot mockups with a stretched tall viewport; capture the real window screen by screen (script step4/m_real.mjs) and state how many screens of scroll. NEVER use a 2-column layout for settings rows (user: 「누가 2열 구조로 만들래?」; proposed ≠ approved).

**11-12 00:50 user decision: settings window max width = 1340px (「가로 1340이 최대로 해」; height doesn't matter, stays 90%).** Code had no cap (`src/ui/editor/style.css:11` width var(--gw-width,90%)) while 상황판 is capped 1280×950 (`src/ui/style.css:74`). Supersedes the 1727/1466 numbers above: at 1920 wide the window is 1340, content pane 1340−260 tree = 1080. Applied only in local mock tree + step4 patch; must go into the real build. All mockups from now at 1340 max.
User's real screenshot (11-12 00:50, 「실질적으로 대략 이정도 사이즈」): settings window ≈1342×1320 (설정 창 폭 70%, theme 페이퍼), left menu 260, content pane ≈1080 wide × ≈1260 high. Mockup basis from now: window 1340 wide, tall (~1320), NOT 1728×972.

**11-12 20:28 KST user decision (number boxes):** exactly TWO 「− 값 +」 sizes in the whole app — 작은 것 (fits the 8-across 인터넷 「양」 grid, short values) and 큰 것 (fits the longest value with unit, e.g. 「제한 없음 토큰」). Both 34px high, width never changes with digits, no third size, no content-sized boxes, never widen everything. Released v0.21.11 broke this (3 sizes on 생성 공통, 「안 함」/「제한 없음」 clipped, grid boxes growing per digit) → user furious (「규격화 규격화 했는데 들은 척도 안 하지」). Enforce by a browser spec test, not by promise.
