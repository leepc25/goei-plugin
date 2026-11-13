---
name: goei-control-screen-1112
description: 관제 화면 (호출 흐름) + AI 상담 창 — built and RELEASED in v0.21.11 (11-12); user rules for this screen, open follow-ups
metadata:
  type: project
  modified: 2026-11-12T07:54:58.585Z
---
Thread 「관제 화면·상담 창 만들어 릴리스」 (cmsg_01SMy6spzkHA3Ttz9fg54ZY87G74Edqf9Upsz6fwZLSd3m), 2026-11-12.

**Released v0.21.11** (PR 54, main 782dca17c, 14:49 KST): 호출 흐름 관제 화면 (src/ui/editor/flowpage.ts, fl-do actions in ui/app.ts), AI 상담 창 (src/ui/editor/consult.ts, core/consult.ts, guides/consult.txt), plus 설정창 개편 5 fixes. release.yml ran by itself on the main merge this time (no manual dispatch needed). Follow-ups: restart branch from main.

**User rules for 관제 (keep):**
- Holds ONLY rows that change 호출 횟수 or 모델; size-only rows stay on menu pages via 「설정 →」.
- Before a mockup, compare ALL setting rows with the screen, tracing each value to the reading code.
- Router is never "off": 코드가 고름 / 모델이 고름 seg.
- No 「사용」 label before a switch when the row name is the feature.
- No fixed empty middle column; count text sits right after the controls on the same line; never one text under every control.
- Row names never wrap (관제 name column 128px; 인터넷·상점 grids 96).
- All number boxes one kind: `.st-step` 「− 1회 +」 114×34 (생성 공통 page still uses `.adv-step` — unify some day).
- Explanations: first sentence = what the thing IS/does, then call cost in one fixed form; reuse released help text; only on rows whose name is unclear. Beside-control text = count only.
- 다시 보기: only the common row on 관제. Group name 「괴담톡 · 인터넷 · 위키」.
- A scroll page is one continuous area; shoot real max scroll, never pad. When the user points at something vague, look at their crop / ask; don't guess.

**Open after release (told user, awaiting answers):** AI 상담 never run with a real model (fake responder only); limit of 10 changes per 상담 is hardcoded (rule 45) → proposed a settings row, needs OK; 상담 model chip toggles 보조/메인 (not in 시안; remove if user says); 상담 scope = the 50 관제 controls only; Director first-sentence wording slightly broad for 사실형; 형식 오류 재시도/재시도 모델 do not apply to 인물 갱신기·정리 (host/people.ts 334·507 fixed 1 retry). Base tests failing before our change too: browser §11 지도 그림, qc-modules 위성 지도 핀, 게임 7묶음, shop-judge.

**AI 상담 follow-ups:** see [[goei-consult-expand-1112]].

**11-12 20:22 KST user on RELEASED 호출 흐름 (「엉망」「개 잡탕」):** (1) text and buttons mixed — some rows explanation beside the control, others below; (2) 선톡·초대 sub-row cut the radio grid in the middle; (3) grid lines barely visible; (4) can't tell items apart; (5) nothing aligned, indents differ per row. Rule: control line = controls + count only in ONE fixed x slot; explanation always below; grids uninterrupted (non-grid rows go below); one line color for all grids; one indent; verify x positions by measurement. Fix being made in local clone /home/user/goei-rel (outputs step56/release_check/); not released.
**20:29 user 「빨리 만들어라. 이번이 마지막」 = BUILD APPROVED** for: two stepper sizes, clip sweep, 길이 상한 multi-box rows on a fixed column grid, left menu 「기본」 → 「호출」(호출 흐름·로어북 호출·생성 공통) + 「표시」(화면·캐릭터 이미지·상태창), 가계부 one-row page merged into 소지품 as its own group, spec browser test, 칸 입력 (/home/user/goei-mock2 mock-fields). Three local branches to merge then full test; release only on 「릴리스해」. Details: [[goei-control-spec]] [[goei-consult-expand-1112]].
