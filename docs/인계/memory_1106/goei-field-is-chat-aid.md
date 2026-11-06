---
name: goei-field-is-chat-aid
description: User rule 2026-11-01 09:44 — the field game is a chat AID, never the main thing; relations/standing change ONLY by actions, never by time; reports live in the 기록 tab only, never attached to chat
metadata:
  type: feedback
---
2026-11-01 09:43–09:44 (thread 필드 기능 확인 사항 정하기): user said (1) 「이건 어디까지나 채팅 보조라 필드가 주가 되서는 절대 안되는데」 — the field is an aid to the main chat; (2) 「모든건 행동에 따라가야지 시간에 따라 풀리는게 어딨어」 — affinity, guard, mood, faction standing must never recover/decay with time, only through actions; (3) 「채팅에 도대체 보고서를 왜 붙이냐」 — visit reports exist only in the plugin's 기록 tab; the model gets `[Field log]`/`[Field facts]` in the request; never put a report into the chat as a message (the 10-21 old-Claude 「보고서 붙이기」 button in src/host/game/card.ts is NOT a user decision; removal pending the user's word).
Facts checked: `decay`/`cool` in src/core/fieldrel.ts are unused old-Claude functions (only tests/field-logic.test.mjs calls decay); nothing in the game decays by time. Events: 300 cap in src/core/field.ts drops oldest regardless of weight; request keeps last 60 per interlude, older interludes weight≥2 only (10-31 user decision).
**Why:** old-Claude candidate items were being presented as real work; the user wants the field subordinate to chat.
**How to apply:** never propose time-based recovery, chat-attached reports, or field systems that steer the main story. See [[goei-field-request-format]], [[goei-remaining-work-1101]], [[goei-field-no-model]].
