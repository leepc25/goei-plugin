---
name: goei-branches-1112
description: 11-13 00:30 KST final state of the old release thread — all 11-12 builds merged and pushed to claude/project-thread-w7tu9e dfff7be17 (tsc only, untested), disk/clone constraint, thread-routing lessons
metadata:
  type: project
  modified: 2026-11-12T15:22:56.054Z
---
Old thread 「관제 화면·상담 창 만들어 릴리스」 (cmsg_01SMy6spzkHA3Ttz9fg54ZY87G74Edqf9Upsz6fwZLSd3m) is finished and handed to 「관제 화면·상담 창 이어가기」 (cmsg_01SMy6spzkHA3Ttz9fg54ZY82y6Q3688VycLFKLTLca5TK). Nothing released since v0.21.11; release only on 「릴리스해」.

**GitHub claude/project-thread-w7tu9e = dfff7be17** (11-13 ~00:30 KST, normal push). On v0.21.11 it holds: 상담 all-settings expansion, 칸 입력 (값 등급 table, 주사위 칸, 그림 대체 말 fold), settings spec fixes + spec test, menu 「호출」/「표시」, 가계부 into 소지품, lore call names, 사용 bar, gesture, 폰 서랍 (.gx-cdr), 기록 「더 보기」 30 rows, 괴담톡 NPC 사진 빼기, 전수점검 폰 고침, 소지품 띠 8칸 + 팔기 두 상자, 망상홈쇼핑 up to 50a3d6d7e, 상점 「컨텍스트 포함」 격자, 괴담톡 기본값 (dae243a9f), 물건 구조 (2236b46ee), 손전등 icon fix.

**Tests:** final head = `tsc --noEmit` 0 errors ONLY (user ordered no tests at hand-off). Full suite once right before release. Earlier head 6577ec9e3: unit 750/751; two browser failures never verified (qc-pipeline 5-1 「첫 응답의 괴이 반영」 49/50; qc-settings-morph 「land: 스크롤 유지 37 !== 40」); game group 7 failures are old (dist/game not built).

**Merge fork's own changes, not confirmed by user:** tests/qc-loader-build.test.mjs body-size limit 3.4→3.6MB; `$it_rules`/`$it_left_words`/`$it_off_words` added to PREF_VAR + tests/inv-settings.test.mjs; `$hs_drop*` into 기본값 저장; GOEI_SHOT_SCALE.

**Conflicts resolved keeping both sides:** src/core/items.ts, src/core/shop.ts.

**Outputs / patches:** /mnt/project-files/bugs_1112/, injury_1112/, release_check_1112b/, settings_redesign_1111/step56/ and fields/. Local folders /home/user/goei-* of that session are obsolete.

**Disk:** session allowance small. A plain clone of goei-plugin = ~10G → never clone; use `git init` + objects alternates + sparse checkout, or `git archive <rev> … | tar -x`. Sparse checkouts miss game-src/art → 2 unit tests fail with ENOENT (not real). Folders with symlinked big dirs → never `git add -A`.

**Lessons:** don't open a side thread just to carry attachments while the original still works (user closed 「설정 고침 합쳐 릴리스 준비」: 「왜 스레드가 분리됐냐」); never route one thread's images into an unrelated thread — give /mnt/project-files paths. Avatar idle mixing lives in thread 「아바타 대기 동작 섞기」. Details of the night: [[goei-handoff-1112-night]], items [[goei-item-state-1112]], 소지품 band / injury hold [[goei-injury-1112]].
