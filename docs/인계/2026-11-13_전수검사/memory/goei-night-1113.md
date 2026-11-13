---
name: goei-night-1113
description: 11-13 00:30–01:10 KST work on claude/project-thread-9rc8hb — user decisions (item rules, flow page design, points ledger, guide defaults) and lessons
metadata:
  type: project
---
Thread 「관제 화면·상담 창 이어가기」, branch claude/project-thread-9rc8hb (all pushed). NOT released; release moves to a new thread after ultracode 전수검사 ([[goei-refsplit-1113]]).

**User decisions (11-13):**
- 선톡·선쪽지·단톡 초대: never "always send"; only over-discouraging guide sentences were trimmed (phone.txt, gnet.txt, joint.ts).
- 소지품: red trash 「삭제」 button left of close in item popup (purge list+log, no record). Weights to the gram (guide phrase), shown to 10g.
- 「물건으로 만드는 범위」 setting `$it_scope` 좁게/보통/넓게 + free text 「만들지 않을 것」 `$it_skip` (user wanted rough levels, NOT 16 kind chips).
- Item judgement (approved 「그래」): 소모 = anything spent by use MUST get a count (medicine, gauze, food, ammo, tape, batteries, one-use talisman; sets count all); 장비 = only worn/strapped (clothes, armor, bags, accessories), things merely carried are not gear; 무기 unchanged. Edited in updater-detailed/compact + shop.txt.
- 갱신기 지침 default = 간결 (PP_DEFAULTS.prompt 'compact').
- 세계 menu: 시작 화면 at bottom. 점검: update address text hidden. 호출 기록: no truncation (400k chars) — save/open time still to be measured.
- 가계부·포인트 rows show story time like 소지품 기록. Points double count fixed (re-sync after 갱신기 entries; dropDoubleSync heals old +x/−x sync pairs).
- 망상홈쇼핑 joined shop tables: 가게 표 row (`$hs_sh_give_*`, `$hs_sh_ctx`), 기능 표 row 「채팅 반응」 (fn 'say'), 메인 요청 grid row with 방송 내용/시청자 채팅/내 채팅 (column names were Claude's choice, not confirmed).

**호출 흐름 page (user: 「호출흐름이 기능의 핵, 알파이자 오메가, 대부분 이것만 본다. 디자인 잘 해라」):**
- User HATES dark grid lines crossing (「바둑판」) and equally hated removing vertical lines outright (「구분선 없이 뭘 어쩌라는거야」). What he asked for step by step (head 3136c5a28, 고침5, NOT yet approved): 호출·예상·지난 턴 as ONE tinted band running down each box, band outline + inner separators as FAINT vertical lines (「세로선 좀 흐리게」), 호출 column is the core → inside the band, count big/bold (green when a call goes), condition as small text below, column narrow (116px; 「호출이 왜 저렇게 길어」), help text never enters the band; row name / 호출 / numbers / 설정 → all on the first line; label column (「방식」「모델」) so stacked controls align left.
- Top bar: 호출 | 보조 예상 | 보조 지난 턴 with left text 「이번 턴 예상: 메인 + 보조 = 합」; keep 예상; fixed-column titles must stay short so numbers don't shift. No per-table header rows.
- Lesson: on this page never patch piece by piece or explain in words; redo whole screen, show full-window PC+phone picture. When the user vents, answer short.

**Done after 01:10:** hardcoded-instruction sweep merged (95 texts → guide sections; new guides 본편에 붙는 글 / 요청 공통 / 갱신기(덧붙임·정리) / 이미지 태그 넣기), close buttons common centering, call-log timing measured (JSON 1.39→2.26MB, open time unchanged), 가계부 day totals coloured. Handoff doc for the audit thread: /mnt/project-files/release_check_1113/넘김_1113_전수검사.md.

**01:25–01:30 KST:** user: NEVER use the word 「본편」 on screen (→ 「메인 요청」; 5 visible strings fixed); guide titles must be short (were cut off). 지침 menu regrouped like 기능 tab: 추가 규칙 / 기본 / 이미지 [이미지(메인 모델), 이미지(보조 모델) — names OK'd] / 인터넷 / 괴담톡·위키 / 상점 / 인물 기록 / 설정 창 (grouping shown as picture, no explicit OK). Head 1a6828bd7, unit 816 pass.

**01:30 user 「넘겨」「울트라코드로 할거니까」** → coordinator asked for the new 전수검사+릴리스 thread (ultracode). 호출 흐름 고침5 never got a verdict; carried in the handoff doc. This thread does no more release work.

**01:30 audit scope (user):** 「철저하게 검증한다 / 이 봇의 모든 부분을 / 까뒤집어 문제점을 찾아내 개선한다」 = the new thread audits the WHOLE bot with ultracode (not only this batch), finds problems and fixes them, then releases.

**01:32 user on 호출 흐름 고침5: 「일단 이대로 해」** = keep current design for now (provisional OK).
