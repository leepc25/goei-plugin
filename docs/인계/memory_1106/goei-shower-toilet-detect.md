---
name: goei-shower-toilet-detect
description: 2026-11-01 user decisions for opposite-sex intrusion into showers AND toilets — no NPC-vs-NPC intrusion, no reaction on door entry, per-person detection with front 700px / behind 300px / wall-facing 200px, run doubles behind range; code deferred until the shower feature is built
metadata:
  type: project
---
Thread 필드 기능 확인 사항 정하기, 11:39–11:43. Recorded in docs/샤워_결정.md (section 2026-11-01) and docs/할일_정리_2026-11-01.md 2-2 (commit b895180dec on claude/project-thread-1h1kah).
- User: 「NPC끼리 잘못 들어가는 일은 없고」; 「문에 들어가자마자 감지범위도 없이 냅다 저러는게 말이 안돼」; 「정면에 있을때랑 후면에 있을때랑 감지범위도 명백히 달라야」; 「일단 반영 해놓고, 똑같은 케이스로 남녀 화장실도」.
- Table: wall-facing (washing/urinal/sink, north motions) behind 200px; standing/covering/dressing/walking facing side 700px (= WITNESS_PX), behind 300px; closed stall = no detection. Running intruder doubles behind range. Shout → same-sex within 700px follow 1–3s later. Nobody detects → leaving = nothing.
- Toilets: 2F men / 3F women; motions exist (100/104 north, 101–103 south); toilet intrusion dialogue cells WRITTEN 11-01 (branch claude/project-thread-d5kaiz db01ab9f4d, off 1h1kah): toilet.<fac>.<rep>.intrude/stay1/stay2, 51 named + 16 faction NPCs, GROUPS_24 has toilet; calling code still owed when the feature is built.
- Numbers are Claude's recommendation accepted as 「일단 반영」; the feature itself stays on hold (handoff §5).
**How to apply:** when building the shower feature, implement this table; never trigger on door entry. See [[goei-restroom-motions]], [[goei-field-no-model]].

**14:19 threads:** 화장실 게임에 넣기 cmsg_01SMy6spzkHA3Ttz9fg54ZY8H4XrfCZgMkpaLvdL9fEUnb owns toilet walk/occlusion/stall doors/motion wiring on top of claude/project-thread-1h1kah and will expose a per-person state(칸 안/소변기/세면대/걷기)+face function; field thread (필드 기능 확인 사항 정하기) wires detection table + toilet.* dialogue calls on top of it. 화장실 침입 대사 쓰기 thread is done/resolved.

**14:50 CODE DONE (823b5b14e8 on 1h1kah):** actors.ts `stepIntrude()` + `Actor.intrude {stage:'wait'|0|1|2,due}` + SimEvent 'intrude'; player sex passed from modules.ts (core.has 100/102); ledger line on first detection (kind 'detected', weight 2); 4 tests in tests/fieldfeatures.test.mjs (564 pass). After stay2 nothing happens (user decision pending). Motion stop on detection is the 화장실 thread's side (they can read a.intrude).

**15:17 user decisions (code 19037e83c2 on 1h1kah):** reactions differ per character — 「무시하고 떠나거나 도망쳐 나가거나 공격하거나」, same for showers and toilets. 4갈래 table src/game/world/intrude.ts (당당=lines then leave calmly, 화냄=attack 2~3s after intrude line, 수줍=flee at once, 무심=lines only; unknown/mob=당당). Stalls: player CAN open an occupied stall door (toilet thread 0dc8fde529 playerPeek, door closes when player moves 70px away); occupant notices ONLY when the door is opened (no distance detection through a closed door). Same-sex opener → `toilet.same_open` cue (dialogue cell NOT written yet — needs the dialogue thread); opposite-sex → intrude. Hit while seated on toilet → line:169 roll-off + leaveToilet. Named chars at toilet spots skip namedNotice. Docs: docs/샤워_결정.md 15:17 section. Tests 568 pass.

**16:15:** toilet.same_open cells DONE (bd830b90cb, 51 named + 16 NPCs × 6 factions × 4 reps × 3 lines) and merged into 1h1kah. Toilet intrusion feature is now complete end to end (rooms, stalls, 표시등, detection, 4-temper reactions, opposite/same-sex dialogue). Not yet in merge-1101.
