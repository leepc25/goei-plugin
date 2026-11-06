---
name: goei-dialogue-rules-1101
description: 2026-11-01 dialogue rules (comma, honorifics, shift/alert, expel cells) + reader-code status and how to feed cells from game code
metadata:
  type: feedback
  modified: 2026-11-01T05:53:18.765Z
---
User answers 2026-11-01 (thread 새 대사 게임에 연결하기, work branch claude/project-thread-naojjo off merge-1101). Recorded in docs/대사_칸_결정_1031.md 「11-01 사용자 답」.
- **No comma proliferation:** user "really hates" commas multiplying. Max 1 comma per line, short lines none. Checker `tools/check_dialogue2.py --commas 1` (default). ~24k existing lines elsewhere have 2+ commas; user chose to fix only 로제몬 (11-01), leave others.
- Title/rank-guess ban applies ONLY to addressing the player. Characters may call each other 선배·부장님 etc.
- Superior honorifics (김조학→국장님, 도필헌→사장님) OK.
- Fill 사장 shower, 브라우니/프리랜서 chars+mate. Keep 박민성 동생 병원 lines, keep 김성진·청달래.
- New cells situation.shift_on/shift_off/alert for all named chars + faction NPCs.
- User dislikes bare questions: always show the actual lines/examples when asking about dialogue.
**Why:** user said "저렇게 물어보면 알 수가 없는데" when asked abstractly.
**How to apply:** every dialogue write/review; ask with concrete quoted lines. See [[goei-merge-1101]].
- **No model-driven game behavior (user 2026-11-01, field thread):** every action/feature must work without the model. Model is called ONLY when the user wants to talk. Exceptions (user 06:10): when the user talks to someone, model reply tags may give threat judgment (in addition to code), and entry permission (pass) and follow/companion come ONLY via model talk. Everything else is decided by code. Dialogue reader: follow_yes/no cells only matter around model talk.
- **Reader-code split agreed with field thread (11-01):** dialogue thread builds the reading module (speech/lines side); field thread inserts calls in actors.ts (stepPlayerVisit·guardAttack·raiseAlarm this.say sites, permitPlayer, visitor code ~711-750). Pass fac + this.stance(fac) + target '{user}' or other visitor. Hand over function name + args when ready. Guard cells: expel.<fac>.<rep>.{warn,attack,attack_weapon,attack_threat,pass_companion,pass_permit,alarm}, expel_other.*.
- **Reader code DONE 11-01 (branch claude/project-thread-naojjo):** docs/대사_연결.md. Pack game-pack/dialogue (tools/build_dialogue2_pack.py, gzip, required) → src/game/world/dialogue2.ts → speech.ts Chatter (cue events) → talk.ts. Old dialogue.json kept only for mob voice. Rebuild pack + commit whenever dialogue files change. Not merged to merge-1101/main yet.
- 11-01 07:16: field thread merged dialogue branch into `claude/project-thread-1h1kah` and wired expel cues in actors.ts (commit 0b0e45af1). That branch now holds BOTH parts; further dialogue code fixes should be based on it.
