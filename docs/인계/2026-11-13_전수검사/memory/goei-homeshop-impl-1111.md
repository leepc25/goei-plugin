---
name: goei-homeshop-impl-1111
description: 망상홈쇼핑 방송화면 구현 1차 상태 (컷 A+B, 브랜치·자료 묶음·규격·남은 일)
metadata:
  type: project
---

2026-11-11 망상홈쇼핑 방송화면 1차 구현 (스레드 「망상홈쇼핑 방송화면 구현하기」).

- 브랜치 `claude/project-thread-uxn1ej` (leepc25/goei-plugin), 기준 = 버그 고치기 브랜치 xq6d97 08f02f0cc. 1차 커밋 8a5c97524. 릴리스 전에 xq6d97 새 커밋 합치기.
- USER 지시: 독자 규격 금지, 「릴리스본 버그 고치기 2」 스레드와 협업. 인터넷 즐겨찾기와 독립 창 둘 다. 그림은 webp (무손실이 가장 작음 → 「그대로 둬」).
- 실제 그림 규격은 512×384 (설계서의 592×444 아님). 컷 A 진행자 (-6,65), y≥297 진열대 덮기, 회전판 윗면 y302. 컷 B 진행자 (70,40), 아래 끝 y296 은 아래 띠로 가림.
- 자료 묶음 `goei-data-homeshop` (game-src/homeshop, 만들기 tools/homeshop/build_sheets.py). 사이트 id `hs`, 변수 `$hs_*`, 동작 `hs-*`, 지침 이름 `Hs`.
- 코드: src/core/homeshop.ts, src/host/homeshop.ts, src/ui/homeshop.ts, src/ui/hsplayer.ts. 독립 창 = 기존 고유 상점 `[shop: 망상홈쇼핑|@web:hs]` 카드 (새 표식 없음).
- 확인: `node tests/_br_homeshop.mjs <폴더>` (GIF=150 이면 움직임 캡처), tests/homeshop.test.mjs.
- 11-11 01시 USER 격분: 1차가 도트 시안 틀 그대로라 「네모칸 찍찍, 성의 없다」. 목업 기획 C안(09_C안_PC_인터넷_망상홈쇼핑.png)을 **바탕으로 제대로 디자인**하라고 함(C안 그대로 베끼기도 금지). 「아직 없는 것」을 나열하고 묻지 말고 설계서 기능은 전부 만들 것. 다 되면 버그 고치기 2 스레드에 넘겨 점검받고 릴리스(USER 지시).
- 2차 커밋 5065b7220: C안 바탕 사이트 틀 + 전화 주문·맞교환·택배 상자(소지품 열기)·할부 장부($hs_orders, 호출 턴에만 본편 한 번)·주문 조회·방청 신청($hs_aud)·채팅 보내기·스티커 들추기. 폰 방송 칸 기본 = 폭 맞춤. 버그 고치기 2 에 점검·릴리스 요청 보냄. 실제 모델 호출 미확인.
- (옛 메모) 남은 일: 전화 주문·할부 장부·택배 상자·방청 신청·주문 조회·채팅 보내기·본편 턴 넘어가면 편성 넘기기. 컷 F 는 보류, 그림·도구 건드리지 않음.

**Why:** 다음 스레드가 같은 것을 다시 묻지 않게.
**How to apply:** 이어서 할 때 이 브랜치에서, 공용 파일은 버그 고치기 스레드에 알리고 고친다. [[goei-homeshop-thread-1109]]
- 11-11 01:46 망상홈쇼핑이 v0.21.6 으로 릴리스됨 (PR 49, main). 이어서 할 때는 main 또는 xq6d97 e6820b220 기준. 버그 고치기 2 가 택배 상자 이름 번호 붙이기·시험 2개 추가. 미결: 응답을 다시 굴리면 편성이 한 칸 넘어감 (USER 답 대기).

## 11-11 뒤이은 릴리스·규칙 (버그 고치기 2 스레드)
- v0.21.7 RELEASED (PR #50): 다시 굴리기 때 인터넷 자동 호출·망상홈쇼핑 편성이 넘어가지 않게. 공통 규칙 `turnKey(chat)` (src/core/shop.ts) = 응답 바로 앞 메시지 키. 리롤이면 같고 새 턴이면 다름. USER: 「리롤 때 넘어가면 안 된다」.
- 우주 쇼핑몰 맞춤 주문 완성 알림 (v0.21.8, PR #51 로 릴리스됨): USER 결정 「카드 + 본편에 한 번」(설정 both/card/off). USER 지적: 상태창에 붙이면 안 됨 → 상점 카드처럼 응답 끝 표식 `[shop-ready: cos|이름]` (core/orders.ts settleReady, host/shopcard.ts renderReadyCard). **채팅 카드는 상태창에 붙이지 말고 표식 방식으로.**
- 강제 push 는 막혀 있다: main 기준으로 다시 딴 브랜치는 `git merge -s ours origin/<branch>` 뒤 보통 push.
- 11-11 23시 USER 격분: 릴리스본에서 큰 화면이면 방송 칸 2배로 화면 덮음·사이트 스크롤 안 됨·동작 무한 반복. **동작 규칙(USER): 기본은 대기(idle), 각 동작은 한 번씩 나오고 대기로 돌아온다. 무한 반복 금지.** **릴리스 전 큰 화면(1920)·작은 화면·폰 모두 잘림·스크롤 확인 필수.** 고침 8d511dc92 (fitScale 자동 배율, .br-page > .hs 스크롤, 큐마다 동작 1회). 버그 고치기 2 는 닫힘(거절) → 다음 스레드 「설정창 개편과 버그 고치기 3」(cmsg_01SMy6spzkHA3Ttz9fg54ZY8YDETf34Nis6TNYS6UKxbZE). 릴리스는 USER 「릴리스해」 받은 뒤에만, 그 말을 붙여 넘길 것. dz8je8 에도 미릴리스 커밋 4개 있음.
- 11-12 01시 USER: 시청자 채팅 「개노잼」, 단골처럼 씀. 시청자 = 뭣모르고 접속한 사람 + 진실 아는 극소수 + 관전하는 기괴한 존재 섞기. 지침 한 줄뿐이라 격노 → 괴담넷 지침(gnet.txt: 누가/말투/닉네임/흐름)과 비교해 같은 틀로 「Viewer chat」 초안 제시, OK 대기. 8d511dc92 릴리스는 「릴리스해」 대기.
- 11-12 01:07 USER: 「대화 예시 박지마 매몰된다」 (no example lines in guides). Asked compare whole structure → proposed: own Hs guide (not borrowed shop shelf), viewer section like 괴담넷 (who/tone/nick/flow), chat per item (#n), say-call gets refs+recent chat. Awaiting OK.
- 11-12 01:11 USER: NO code changes now — waiting until 설정창 개편 finishes. Homeshop prompt/chat fix plan is on hold.
- 11-12 22:47 USER: cut C (2x zoom of A) shows host hand sinking into the display counter — cause: occlusion is a straight line (a.over), not traced outline. User: 「가림을 대충 따서 그래」. Fix must follow docs/가림_따기_지침.md; waiting for go. WIP (uncommitted, branch uxn1ej at 4986fa082): Hs own guide (VIEWERS/THOUGHTS_PROGRAM), chat per item, programPrompt in shop.ts; user said 「기다려봐」, merge of main undone at user's word.
- 11-12 22:50 agreed with 관제·상담 thread: work on top of claude/project-thread-w7tu9e head c7335a484 (merge into uxn1ej, push only uxn1ej; setdef/homeshop.ts for settings text). Hand over per bundle (①8d511dc92 fixes ②guide split+per-item chat): branch, head, base, files, test output path, patch under /mnt/project-files/. shop.ts: only append new funcs at file end; style.css only .hs rules. Waiting user go. WIP patch: /mnt/project-files/망상홈쇼핑_1109/구현_1111/작업중_채팅지침_1112.patch
- 11-12 23:10 pushed uxn1ej 1f8c7620d (base w7tu9e c7335a484): Hs own guide+VIEWERS, per-item chat (#n, no repeat, default 12~18/item), say-call gets refs+recent chat, programPrompt/broadcastMaterial at end of shop.ts, 남은 수량 저절로 줄기 ($hs_drop*, $hs_soon_at, $hs_end_lo/hi; user 「그래」). Tests 732 pass, browser pc/pcbig/phone ok. User 「에이전트 병렬로 풀로」 = subagents allowed here. Proposed (awaiting OK): longer parts (cue 14~20), hold part while my chat is answered, 다음 부까지 20s. Cut C hand occlusion fix NOT yet approved.
- 11-12 23:10 USER furious: broadcast (host lines, viewer chat, MY chat + reaction) is NOT passed to main story at all (「그럼 채팅을 왜해」「다른 기능 설정창도 안 보고 기능 만드냐」). Must follow the 괴담넷·괴담톡·위키 frame: settings group 「컨텍스트 포함」(사용/붙일 것 칩/넣을 수/컨텍스트 토큰 상한), body.ts moduleContext 「참고 기록」 step with caps, guide MAIN_CONTEXT section; store watched log per turn. Rename hs rows to match (맥락 반영/챗로그 포함/참조 로어북). Also proposed: manual 「다음 상품」 button (auto via setting; user: 「꼭 자동으로 할 필요가 있을까」), hold part until my chat reaction plays, say line counts to settings. All proposed 23:15, awaiting explicit go. Other thread asked: fix gray placeholder in setdef/homeshop.ts 'clips' row (deftext.ts helper or move to help).
- 11-12 23:14 USER: 「설정창은 니가 만들지마」 → this thread must NOT build settings UI. Build features only (vars+defaults), hand the list of needed setting rows to the settings thread (관제·상담, cmsg_…87G74Edqf9Upsz6fwZLSd3m). The 7 drop rows already added to setdef/homeshop.ts (방송 흐름) → told user; settings thread decides placement. Mockup request was cancelled (「아니」).
- 11-12 23:20 USER: host lines in chat panel (yellow 「진행자」) → 「그냥 두자」 (keep; don't re-propose removal). Mock posted (/mnt/project-files/망상홈쇼핑_1109/시안_1112/): 「다음 상품 ▶」 in broadcast header bar (yellow when cue sheet ended, last part 「방송 마치기」), 「진행자가 채팅을 읽는 중…」 in chat header; code for it is LOCAL uncommitted on uxn1ej (hs-next action, playerHold, $hs_next default 0=manual, tests/_hs_mock_shots.mjs). Proposed: reading motion = B cut 「굳은 응시」 once (new clip only on 「뽑아」). Not yet approved.

Latest state: [[goei-homeshop-state-1112]]
