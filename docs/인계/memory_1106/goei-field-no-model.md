---
name: goei-field-no-model
description: User 2026-11-01 — field game logic must never depend on model output; model is called only when the user chooses to talk. Exceptions: follow/wait/return, permit (pass), alarm-threat, all as results of a user-started chat
metadata:
  type: feedback
  modified: 2026-11-01T06:16:40.164Z
---
2026-11-01 user (thread 필드 기능 확인 사항 정하기): 「모든 동작은 모델을 쓰지 않는걸 전제로 만들어야해」「모델 요청은 유저가 대화를 하고싶을때만 하는거라고」. Anything in the field that moves because a model said so is wrong.
Allowed exceptions, each only as the outcome of a chat the user opened: [[동행]]/[[기다림]]/[[복귀]] (companion), [[허가]] (one-visit pass from a guard or that site's named character), [[경보]] (guard threatened → that guard attacks, not a site alarm). Threat is also judged from actions (drawing a weapon near a warning guard, hitting).
Also decided same day: guard warns only after spotting the player within 400px; no timers — entering an inner room/floor after a warning = guard attacks; site alarm only when a KO/kill is witnessed; companion of that site's character passes; weapon reaction lasts while the weapon is out.
**Why:** model calls cost and the user wants deterministic field behavior.
**How to apply:** before adding any field feature, check it runs with no model. Decisions logged in docs/필드기능_결정_1031.md (11-01 section). See [[goei-merge-1101]], [[goei-no-unasked-work]].
