---
name: agent-motion-list
description: 요원 동작 목록 결정 상태(2026-10-23 11:13) — 견본 확정분, 글 동작 미정, 앉기 제외, 동작 태그 방식
metadata:
  type: project
  modified: 2026-10-23T11:13:16.767Z
---
2026-10-23 thread 「본부 필드 이어가기」, table in guide doc https://claude.ai/artifact/6BmPY49d9Dq468KYhqLaAo section 「4-1. 동작 목록」 (180 canvas, side view one direction, costs per agent).
- **Sitting removed** (user 10:47): chair/desk matching unsolved; all motions standing. Revisit later.
- **Confirmed templates (확정):** walking-8-frames (only walk), running-8-frames, running-jump, running-slide, crouched-walking (stealth: anomaly notices less — future feature), jumping-1, jumping-2, two-footed-jump (in-place jump), front-flip (= 2nd hop of double jump), crouching, drinking, picking-up, pushing, pull-heavy-object, throw-object, taking-punch, falling-back-death, getting-up. Combo test for first agent: lead-jab→cross-punch→surprise-uppercut→roundhouse-kick→hurricane-kick, plus leg-sweep (crouch+kick) and fireball (skill cast pose, effect via vfx). User 11:00: "한명만 뽑아볼거니까 넣어" even though it conflicts with the per-agent-unique rule.
- Jump clips are cut into takeoff/air loop/landing segments by code.
- Walk style per agent: same template, different action_description written by the producing AI from the wiki, shown to user before generating.
- **Open (next thread):** which text-v3 motions to make. Candidates in table: 17 talk/emotion (손짓, 손 인사, 목례, 끄덕, 고개 젓기, 먹기, 기지개, 놀람, 웃음, 머리 긁기, 생각, 팔짱, 한숨, 화냄, 주먹 불끈, 박수, 떨기). Claude suggested adding 막기, 회피, 문 열기, 조사하기; own-weapon basic/ranged attack still to be discussed per agent.
- **Correction (user 11:14):** the model is called ONLY for dialogue lines, never for everyday behaviour. Everyday motions (greeting on approach: 목례 vs 손 인사 from a fixed relationship table per agent×visitor; idle motions picked at random by code from per-agent list) are decided by game code. Tags apply only inside model-written dialogue.
- Motion trigger plan (dialogue only): model adds one tag per line from a fixed list (e.g. `[목례]`), plugin strips it and plays the clip; fallback = 말하며 손짓. Not built yet.
See [[goei-field-bg-spec]], [[pixellab-usage-tips]].
- 2026-10-23 15:30: repo guide docs/필드_그림_통합_지침.md rewritten (main 0e4f02d1) to: 128×256, low top-down, 8-dir, SE only, 1.5x, template table, Jyaldi-only test first (Breathing Idle + running SE, record real cost). The bg person-size numbers are marked as outdated. The guide artifact 6BmPY49d9Dq468KYhqLaAo was NOT updated; the repo file is the source of truth.
- 2026-10-23 15:30 bg spec rescaled (main 8a44fd41): bg 700px tall, wall/floor y420, walk y420–669, back person 235px (1m=142px), front 276, door 300×130, desk 106, seat 64, sofa back 121, bookcase 283, top thickness depth×82, furniture band y420–560, min width 1600. This supersedes the 480px numbers in [[goei-field-bg-spec]].
- **2026-10-23 15:37 user furious:** repo copy docs/필드_그림_통합_지침.md 3-2 truncated the doc's 47-row 「4-1. 동작 목록」 (lost text-motion candidates + costs); doc still has old 180 numbers. Fix (only on user's word): update the Claude Doc to 128×256 and mirror it to repo verbatim — never shrink content when copying. Repo bg section also lacks a room list and contradicts docs/본부_설계_2판.md mood/layout.
- **15:40 merged (main 9a922361):** docs/필드_그림_통합_지침.md is now the ONLY guide (full motion table, body-proportion rule: 7등신, crotch ≈ half height, generator stretches legs; 17-scene HQ bg list with widths, mood/layout from 본부_설계_2판). Claude Doc 6BmPY49d9Dq468KYhqLaAo is obsolete — never point users/GPT to it.
- User 15:42: give docs as an ATTACHED file from /mnt/project-files (copy at /mnt/project-files/goei-plugin/docs/), not just a GitHub link — the app can't open external links. GitHub URL only inside GPT paste lines.
