---
name: goei-rogue-plan-1104
description: 11-04 새 게임 구현기획서 위치·요점(데드셀 구조, Risu 판정, 단계 S0~S8, 예산), 사용자 결정 대기 5개
metadata:
  type: project
  modified: 2026-11-03T15:36:21.422Z
---
구현기획서: v2 repo branch claude/project-thread-hq1jae `docs/구현기획서_1104.md` (+ /mnt/project-files/v2/구현기획서_1104.md). Thread "Write the full game implementation plan" cmsg_01SMy6spzkHA3Ttz9fg54ZY8V2Z8ZFsq3YJoBr7GoFX3uq. Branch is based on sj5jhv (M1 demo code).
- 11-03 night proofs (Risu-condition iframe, software WebGL): Phaser 1,187KB min / 327KB gzip; tilemap+4 parallax layers+Eileen anim+10~40 enemies 54~60fps; Light2D 57fps; postFX bloom 27fps → don't use. 64×64 frame ≈1.1KB in strip PNG. Files tests/proof-stress-browser.mjs, docs/proof_1103/.
- PixelLab balance 11-03 night: credits $26.63, subscription Tier 3 44,069/month but 0 left (reset date unknown).
- Dead Cells extra teardown: rooms have only col/lnk/markers layers (art from biome autotile); biome 8 draw layers; level.parallax[] (PrisonStart 0 layers); no hitstop/shake fields; mob fields (Zombie life 120, pfCost 0.5…). /mnt/project-files/v2/데드셀_추가측정_1103.md.
- 11-03 night: plan audited (A 117 sourced, B 33 proposals, C 11 open, G 21 lore conversions; DC names only in source cols; commit 7b6b2e7). DC code: 2 weapon slots, no per-slot type limit, only dual weapons (crossbows/lantern/hardlight/tick scythe/snake sword) take 2 slots, BOWS TAKE 1 (differs from user's recollection). User picks B32 option (①pistol+defense ②dual pistols ③two pistols). My earlier 체술 guess was WRONG and removed.
- 11-03 15:58 USER DECIDED weapon slots: 2 slots, flexible per weapon (1 or 2 slots, data-driven like DC) long-term; NOW = 권총 + 체술 (A-U16).
- 11-03 16:02 USER DECIDED: tile 16px + more tile variety (B34, DC tile-variant count asked to PC = C13); Risu real test AFTER prototype (field game already runs in Risu); PixelLab = keep using credits.
- 11-03 16:03 G-14 = 중상 회수 (provisional, changeable; user: prototype first). DC skill slots fixed per hero (Beheaded 2, Richter 1), no 2-slot skills (A-D55~57).
- Waiting user: B1 skill content, G name proposals, 「뽑아」 for S1 6 anims (~18 gens).
- 11-03 15:45 plan updated w/ DC exe code measure (/mnt/project-files/v2/데드셀_코드측정_1103.md): default keys adopted as-is, 60fps, times in seconds, air jump 1, dive >1.5 tiles, PrisonStart graph (tube→flask→cross→3 exits + 9 combat + treasure/shop probs) = our generator skeleton.
- S1 gen tool ready tools/gen_rogue_s1.py (6 anims ≈18 gens), nothing generated.
See [[deadcells-teardown-structure-1103]], [[goei-no-hallucinated-claims-1103]].
