---
name: goei-icon-bulk-draw-1110
description: 11-10 thread 픽셀랩 아이콘 뽑기 — bulk item-icon generation plan (993 items / 63 batches from 237), user rules on duplicates and variety, where files are
metadata:
  type: project
  modified: 2026-11-10T03:19:17.895Z
---
Thread 「픽셀랩 아이콘 뽑기」 (cmsg_01SMy6spzkHA3Ttz9fg54ZY8CVZkWhGZeZWyby4YV2PFVQ), repo leepc25/goei-plugin, my branch `claude/project-thread-k9buwt` (based on xq6d97 = matcher-fix thread 「릴리스본 버그 고치기 2」, cmsg_01SMy6spzkHA3Ttz9fg54ZY8UfZDvv8xtD57xBEqwSmdV8). Handoff doc: branch `handoff` 인수인계/PixelLab_그림뽑기_인수인계.md (API create-1-direction-object size 85, 16 cells, $0.11/batch, gate .pixellab_ok, prefix/suffix cell text).

**User rules 11-10 (furious when broken):**
- NO duplicates with the existing table. Matcher MISS is NOT proof of absence (spacing/synonyms). Must read the table names (icons.json, ~2,800) and compare each candidate; I shipped a list containing 내장/잘린 손/장기판 that already existed → 「중복 검사는 하고 뽑는거냐」.
- 「중복」 = the same object. Variants of one kind are WANTED (알: 타조알·메추리알; famous products: 핫식스, 신라면, 포카칩; fish/mushroom kinds). Don't drop things merely for looking similar.
- Wants wide coverage: 다나와 categories, 판타지·괴이·SF·공포·서브컬쳐·게임, 동물·식물·어류·조류, 식품·과자·요리, 학용품·컴퓨터·주방·욕실·가구·조명·스포츠·취미·사무·유아·완구·패션잡화, 흥미 물건(똥 등). 20+ batches at once is fine (「훌떡 넘어도 상관없어」).
- 백일몽 masks: existing 토끼/고양이/여우/까마귀 가면 are NOT the 백일몽 half-mask style; pre-draw missing animals with req_batch_229 dark prompt, change only the animal hint line (32 animals planned).
- Not-found now shows the box (no kind-base picture) — user decision in the matcher thread.

**State:** list = /mnt/project-files/소지품그림_1110/뽑기_목록.md (993 items, 63 batches, ≈$6.93; balance $20.31 at 12:00 KST). Waiting for 「뽑아」. Draft req_batch_237~244.json on branch are OLD drafts (commit 383b30306) — rewrite from the final list before sending. Don't touch matcher code; mismatches where a picture exists go to the matcher thread. New rows: only game-src/items/icons.json, icons/, raw/, req_batch_*.
**11-10 12:30:** user asked 「기괴하거나 징그럽거나 괴이한 물건들은?」 → +112 기괴 items (theme 기괴, kind 괴이), list now 1,105 items / 70 batches ≈ $7.70, file work/final6.json. Still waiting 「뽑아」.
**11-10 12:45:** user 「문화, 예술, 성인쪽도 더 찾아봐」 → +160 (미술·음악·공연·문화 98, 성인 62 incl. matcher-thread wants 단추·클리너·발목 보호대·진공포장기·DVD·요실금 패드). List = work/final7.json.
**11-10 12:55:** user wants more 벌레, SF horror (에일리언 알·페이스허거류 — describe generically), hardcore adult gear → +196; list = work/final8.json (1461 items, 92 batches).
**11-10 12:42 「뽑아」「20개씩 돌려」:** 237~328 (92 batches) sent, xargs -P 20; results gallery https://claude.ai/artifact/W25qANKbLuY1h2RYm8Zp3o (/tmp gal.py rebuilds from raw). Pending 「뽑아」 for NEXT set: 옷 144 (new/wear_keep.json, en/v.txt done), 전투·특수복 112 + 치킨·패스트푸드·낚시 64 (new/cf_keep.json) = 320 items / 20 batches from 329. Inspection notes: /mnt/project-files/소지품그림_1110/work/살펴본_메모.txt.
**Table insert rules (matcher thread 11-10 13:00):** each new row `head` = generic upper word (꼬막→조개, 타조알→알, 신라면→라면); set head_rep[upper]=plainest picture; never put 1-char/generic words in adult/body keywords. Tell matcher thread the commit. 312·322 FAILED (status failed, likely filter; adult items) — ask user before resending. Rep pictures 48 (new/rep_keep.json) pending 「뽑아」 too.
**How to apply:** after results, show each batch large, be honest about bad cells, add only user-picked cells with keywords, test with match_icon.mjs. See [[goei-icon-matcher-redesign-1109]].
