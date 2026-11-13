---
name: goei-audit-decisions-1113
description: 11-13 08:4x–09:10 KST user answers to the 17 audit decisions + state of the release thread after them (commits 55c9c084e, 8a17178b2)
metadata:
  type: project
  modified: 2026-11-13T00:14:44.828Z
---
Thread 전수검사하고 릴리스하기. Answers recorded in /mnt/project-files/release_check_1113/사용자_결정_답.md (all 17 answered by 09:05 KST).
Key ones: 7 = (가) app judges "first contact" for manually added 괴담톡 contacts (relationshipToOwner "none…") and evidence step + 4 phone.txt sections removed (user first said 지워, then worried, then chose (가)); 13-1 pinned report journal rows kept past cap, 13-2 (다) report cap ≤ journal cap; 15 서사 리듬 stays default ON (user asked tokens ≈1–2k/turn, OK'd); 16-1 reset clears walletStart/img names, keeps 추가 규칙 with notice; 17-1 trace per-turn 3M chars cap.
Pushed: 55c9c084e (fix batch 5 + decisions), 8a17178b2 (first-scene spelling incl. build_lite_card FIRST_MES_SPELL, 화요퀴즈쇼 부록 card/extra-lore file).
**Gotcha:** card build (tools/build_lite_card.py, run by release-prep) regenerates src/data/install/directory.json and src/data/world/greetings.json from the original card → hand edits there are lost unless the build gets a patch. Unasked edits 선임 요원 and 특수재난대응협회 in directory.json would revert.
Open: decision card "묻지 않고 고친 글 1~7" (cmsg_01SMy6spzkHA3Ttz9fg54ZY86yRPRGWnbB3VKWnjQGXmyk), before/after doc release_check_1113/묻지않고_고친_글_전후.md. Running: verify-rest workflow resumed (wf_2282e34a-428), translation of 13 first scenes (wf_0c5f6456-b1a → .scratch/tr/P0xx.en.txt), browser-failure diagnosis (wf_bd963bc9-818).
Docs not updated (user not asked): docs/인물기록_프롬프트_설계.md:200, 인물기록_구현현황.md:122 still describe the removed word check.
