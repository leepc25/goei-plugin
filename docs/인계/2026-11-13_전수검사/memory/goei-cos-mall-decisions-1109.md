---
name: goei-cos-mall-decisions-1109
description: 11-09 user decisions on 우주 쇼핑몰 (Cosmic Shopping Mall) + 백일몽 포인트몰: no hardcoding, 왈도체 tone, hidden effects, 주문 조회, icon matching
metadata:
  type: project
  modified: 2026-11-09T14:27:59.422Z
---
Decisions by the user on 2026-11-09 (thread 릴리스본 버그 고치기, branch claude/project-thread-swxqg6; thread hit the 24-attachment cap after 00b229f8e → next fixes go in a NEW thread on the same branch):
- **No hardcoding**: shelf roll (genres, tiers, draw method, weights, useful slots) and signature items live in 설정 → 우주 쇼핑몰 (`$cos_roll_*`, `$cos_fixed`). Draw method visible/configurable with a sample draw.
- **왈도체 tone = old Lua card tone**: light machine-translated accent, readable, 반말 only, first person 「우리」. Stiff -합니다 tone DISCARDED.
- **Effects never shown to the player, not even in 소지품**: visible 효과 = catalogue claim; hidden `truth` (ShopItem/Item). MIX: 진실 may be `?` (story decides at first use). Setting 「진실 미리 정하기」 전부/섞음(default)/안 함 (`$cos_truth`).
- **Hidden truth goes to the main model ONLY on the use turn (or worn gear)** as a 「Really」 list under [Inventory].
- **상담원 features** all DONE: 내 물건 팔기 (c1afe8dba, lowball buyer), 정보 사기 (2bc843aba: note content readable ONLY in 소지품), 정보 팔기 DROPPED by user, **맞춤 주문** (00b229f8e: quote in 상담 창 → 선납 → left-menu 「주문 조회」; due judged by status-line [▣] in-world time each turn, no model call; item incl. truth fixed at quote time; no status line → ready after next reply).
- 설명 fields stay 2 (설명=출처·사용법, 효과=claim). Sign 「물건을 보겠습니다」 is the user's lorebook text; keep.
- Body-size guard tests/qc-loader-build.test.mjs 3.0MB → 3.2MB (self-imposed).
- **백일몽 포인트몰 (5ced8617d)**: icon matcher head = last word; trailing number+unit (30ml, 2L) now dropped, grade tokens (C급·S등급·F) moved to modifiers (iconmatch.ts + game-src/items/match_icon.mjs, tests/itemicons). 소원권 asset = anomaly_015, matches fine when named 소원권; model had renamed it 「소원의 병」 → BM_COMMON now: keep exact Korean names from reference (소원권), 그림 column = plain object word, reference price examples = kinds only, never relist as-is or lightly varied. The 복지몰 price-example list is in the user's card lorebook, NOT in repo wiki-base.json.

**Why:** user dislikes fixed values and wants to tune behaviour themselves; the original card's humour depends on the light tone; hidden effects keep items fun.
**How to apply:** never add fixed product lists or tone rules in code; put knobs in settings; guide text is editable in 설정. Related: [[goei-homeshop-thread-1109]], [[goei-return-1109]].
- 11-09 15:2x thread 「릴리스본 버그 고치기 2」(cmsg_01SMy6spzkHA3Ttz9fg54ZY8F1Gq7d51nA3sVUcqaVB1yx, same branch swxqg6) continues. Asked: 포인트몰 상담사 채팅? User REJECTED features: 포인트몰 1:1 상담 = chat-only fun, counselors are 백일몽 employees, a DIFFERENT persona every 상담 (anti-parrot: no example lines/topic lists in guide; code rolls dice axes from settings `$bm_desk_axes`, model makes a stored card once, card sent every turn; recent N counselors passed to avoid). Window must match 포인트몰 design tone (not 우주몰 copy) and be draggable/closable like 우주몰. DONE 53dd05e23 (core/bmdesk.ts, guide BmDesk = src/data/guides/bmdesk.txt, ui/malls.ts bmDesk·bmDeskWinSpec). Also 798e88583: drop highlight = top-layer ::after 2px (inset shadow was hidden under cells).
