---
name: elevator-world-structure
description: 차원 승강기 = 주머니 차원, 층 = 각기 다른 세상(건물 층 아님). User 2026-10-22 corrected the floor design.
metadata:
  type: feedback
  modified: 2026-10-22T04:10:47.175Z
---

User (2026-10-22 04:09) was angry that the game treated 차원 승강기 like "건물 안의 엘리베이터". The first build made each floor one office-corridor belt and the elevator a "next floor" door.

Original lore is in card/wiki-base.json → 「차원 승강기」:
- It is a pocket dimension (주머니 차원). Every floor is a different world with its own rules.
- Below the lobby, human architecture disappears: endless repeating corridors, stairs at right angles to gravity, rooms inside rooms, spaces bigger than their containers. B-12 is darkness stretching endlessly in every direction.
- The elevator is ONE consciousness, and all elevators are it. It changes which floors you can reach. The wiki itself calls the place a "수직형 미궁".
- 정비 구역 is the gap outside the floors' structure.

The user also said I "fundamentally misunderstand metroidvania". A metroidvania needs one interconnected map (rooms linked up, down, left and right, with branches, dead ends and loops), plus backtracking. As a roguelike, that map must be procedurally regenerated on every run.

**Why:** Repeated failures came from reading the design docs literally ("층 = 벨트스크롤 가로 구간") instead of the source lore.

**How to apply:** Read the original card lore before designing any stage structure. Proposed direction, awaiting user confirmation at 04:12:
- floor = procedurally generated maze world of its type;
- several elevator doors in each floor, all the same consciousness;
- 정비 구역 = the gap between worlds;
- room combat stays belt-scroll.

See [[goei-observation-game]].

Implementation (2026-10-22): src/game/action/stage/gen/world.ts generates the room grid (path, locks/keys, loops, secret, roles); rooms are built by buildFloor room mode. Room art = TILES, not one image per room (user asked 04:25, decided tiles): GPT request docs/GPT요청_방타일.md (e3d555d, 35 sheets: <place>_mod 6×2 cells 256×512 foot y=492, _tiles 2×2, _front 3×2, props/room_roles_1~2).

User confirmed structure (2026-10-22 04:32): depth = difficulty; anomaly (환경) per floor random from a depth pool; the ant-nest layout random; the next floor opens ONLY after the whole floor is cleared; repeat with rising difficulty. Asked how the roguelike is done; answered: run = one seed, death loses run gains, in-run upgrades, rule flips per run, rope extraction vs deeper, meta (rulebook, favor, records; HQ unlocks still missing). Clear rule I chose: guardian + all fight rooms cleared; reward/secret optional.
