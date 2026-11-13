---
name: goei-icon-bulk-draw-1110b
description: 11-10 13:10 픽셀랩 아이콘 뽑기 state — pending batches 329~372 awaiting 「뽑아」, failed 312/322/327, 백일몽 mask redo rule (outline not pattern)
metadata:
  type: project
  modified: 2026-11-10T04:12:13.978Z
---
Continuation of [[goei-icon-bulk-draw-1110]] (thread 픽셀랩 아이콘 뽑기, branch claude/project-thread-k9buwt, commit 514fac41c).

**Pending 「뽑아」 (nothing sent):** req_batch_329~351 (옷·전투복·치킨·낚시·대표 368) + 352~371 (320: RP·증거 58, 위키·로어북 54, 편의점 음식 24, 표·권 27, 세균·바이러스 28, 벌레 54, 기생 18, 독·뱀·해파리 57; source /tmp n2/set2.json, copy in /mnt/project-files/소지품그림_1110/work/) + 372 (백일몽 가면 윤곽판 16) = 44 batches ≈ $4.84; balance $9.03 at 13:10 KST.

**Failed (status failed, adult items, likely filter):** 312, 322, 327. Ask user before resending.

**User 11-10 13:05 on 백일몽 masks 288·289:** 「대부분 엉망, 전부 같은 모양에 무늬만 다르고」. Cause: my animal hint lines were engraved patterns only. Fix: keep req_batch_229 base text, write each animal hint as OUTLINE differences (edge tips, eye-hole shape), 1 test batch first. Old 32 kept, not inserted.

**User wants (11-10 13:05):** re-read lorebook/wiki for items; convenience foods; tickets (기차표·버스표); exotic/parasitic/dangerous/venomous bugs, snakes, jellyfish; bacteria/virus hazard items. Wiki review method: card/wiki-base.json (141 docs, 1M chars) → cue-sentence extract /tmp new/w_cue.txt.

**Still owed:** inspect 326·328, rebuild gallery (gal.py range → 372), report bad cells, user picks cells, then insert rows (head/head_rep rules) and notify matcher thread.

**11-10 13:40:** user 「일단 뽑고 실패한것들은 원인 분석해봐」 → 329~372 all 44 done (commit fca9380e5+), gallery v4 = 133 batches. Inspection notes appended to 살펴본_메모.txt (logos 346-02/08/15, 360-09/10; garbled text list; mask 372: half kept 7, head-masks 6). Failure analysis posted: all 3 died at 2% (prompt stage), suspects masturbator / panties / chastity / used condom fluid / infected forearm; resend needs 「뽑아」 with reworded cells shown first. Asked user which mask style (half-mask vs head) — awaiting. Matcher thread handed 4 items: 대포·칼·전등 in rep set; 성인 패드→요실금 패드, 성인 집게→니플 클램프, 신체 내장→소장 as head_rep at insertion.

**11-10 13:42 USER on masks:** 372회 방식 approved — 「이번 버전이 훨씬 좋군. 반가면 형태이되 동물을 형상화한 것」. Only 말 가면 is wrong (covers whole face, not a half mask). Standard from now: half mask (eyes + upper nose only), animal shown by outline. req_batch_373 = remaining 16 animals in that style (adds "never the muzzle, mouth or jaw" line), not sent; 말 redo pending. Needs 「뽑아」.

**11-10 14:10:** 373 (masks 16) + 374 (6 mask redo + 10 problem-cell redo) done. User verdicts 13:52: logos, garbled Korean (except 나무 명패), English text, IP-like, face-like = OK; added-extras cells = problem (redone 374). Failed 3 batches: user 「실패한거 빼고 묶어서 보내고 나머지는 프롬프트 바꿔서」 → 375~387 by bisecting; ALL 48 out (reworded only 외계 기생 포자 버섯·요도 플러그·소프트 패커·신던 스타킹 in 387). Commit 38861ac4e, gallery v5 through 387, balance $3.12. **Awaiting go:** masks 사자·개구리·고래 redo, 지문 카드 3rd try, 슬라이드 글라스. Old 32 masks (288·289): user wants a different name so they never match 백일몽 가면 — proposed 「○○ 문양 반마스크」, kind 옷, no reply yet. Rep for 신체/내장 = new 내장 (374). Table insertion still owed.

**11-10 14:50:** user: 엉덩이 오나홀 (380-04) wrong (looked like a chest mold); 「6개만 뽑을수가 없어 16개 채워야해」 → ALWAYS fill 16 cells per batch (use spare cells for second takes of hard items). 388 done ($0.11, balance ≈$3.01): good = 엉덩이 오나홀 01/11, 개구리·고래 masks, 슬라이드 글라스 07/13, 정조대 08/09, 소프트 패커, 지문 카드 12 (clipboard version), 모발 앰플, 내의. Bad = 너구리 mask (full raccoon face with ears), 사자 02 (beak-like nose; 14 is the better one), 지문 카드 06 (no paper, 3rd failure — use the clipboard one).

**11-10 15:10:** user: most-used items = 재생 물약 등급별 (F~S, wiki 꿈결용액 grades), 탈모약, 탈모 앰플, 재생 앰플; 소프트 패커 DROPPED (「버려」); multiple takes of one item in a batch = 「낭비」 → fill spare cells with other needed items/masks. 389 done ($0.11; balance ≈$2.66): potions F~S (colour ladder grey/yellow-green/green/teal/blue/violet/gold), 재생 앰플, 탈모 앰플, 탈모약 알약 통 all good; masks 악어·거미 good half masks; 사자 = now clearly a lion but FULL face with nose/muzzle; 너구리 = band but ears remain; 문어 = whole octopus head; 펭귄 owl-like with beak.

**11-10 15:25 WRAPPED UP:** user 「걍 저거 전부 쓴다 마무리 하고 버그 고치기 스레드랑 협의한뒤 작업해서 넘겨」. Inserted 2,197 rows from 237~389 (commit a8a055cae on k9buwt, merged on top of xq6d97 be9e2fc4b; table 5,031 rows, 4,449 webp 5.7MB; script /tmp insert.py: latest redo wins, old masks → 「X 문양 반마스크」, 소프트 패커 dropped, 반지 skipped as name clash). Handed to matcher thread, which now OWNS icons.json (윗말·head_rep·tests; 8 of 17 itemicons tests changed, not fixed by me). Do NOT edit icons.json from this thread any more; new drawings after this need coordination with that thread first.

**11-10 15:30:** matcher thread merged a8a055cae and finished 윗말 work (xq6d97 37298cf7a). Table baseline = xq6d97. To add new pictures later: pull xq6d97 latest, follow docs/물건그림_윗말_규칙.md 「새 그림을 넣을 때」 (row in icons.json → name into game-src/items/upper/종류.txt → python3 tools/icon_upper.py check, --apply → node --test tests/itemicons.test.mjs).
