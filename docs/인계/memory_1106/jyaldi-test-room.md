---
name: jyaldi-test-room
description: 2026-10-24 Jyaldi-only test room artifact (46 PixelLab clips, GPT lobby/street bg, day/night) — where it is and what it showed
metadata:
  type: project
---
User 2026-10-24 10:42: all characters registered 8-dir in PixelLab (character list via API GET /v2/characters; Jyaldi id 5a76e1de-d1c9-4051-97c8-1deb5b58ab71, 46 animations). Asked for a Jyaldi-only test room to find missing/unneeded motions and settle the final set. Also gave 2 GPT bgs (본부 로비, 종로 본사 앞 거리) and asked whether to skip pixelizing and use AVIF.
- Artifact: https://claude.ai/artifact/3jQqcbGmwSYoVimizf954R (source = thread scratchpad, builder data not in repo). Keys, clip inspector with 판정/메모 copy, bg original AVIF q65 / 도트 2px / 도트 3px, 낮·저녁·밤 computed from day image.
- Findings: AVIF q65 = 2.5MB → ~150–180KB. User says custom (text) clips are clean, presets leave gray specks. Most presets were made facing west (side), emotes south-west, only breathing-idle south-east — mixed with SE spec. GPT bg is drawn smaller than spec (door ~200px), so char scale ~0.86 fits, not 1.5. Missing vs plan: jumping-1, two-footed-jump, front/back flip, surprise-uppercut, hurricane-kick, leg-sweep.
- Weapons on hold (user 10:42).
- User feedback on v1: the core complaint is MK1-style flailing (uniform frame timing, no action speed). Facing/SE mixing does NOT matter. Shadows not at the feet make chars float. The 0.73× nearest downscale caused the mush.
- v2 (artifact Version 2, same URL) has:
  - action timing: fast startup, held hit frame, hitstop, cancelable recovery; plus a 균일 toggle to compare.
  - a thug enemy dummy, and the repo audio synth (SFX/BGM).
  - rebindable keys and 9 digit emote slots.
  - 1× sharp char with bg zoom, per-frame feet shadow, per-clip foot anchor.
  - Builder: /tmp/claude-0/room/build2.py + template2.html (ephemeral).
- **User 2026-10-24 11:22 after v2: presets (견본) are unusable; all 23 preset clips are bad.** Claude proposed replacing all 23 + 7 missing (~30 clips, ~240 gens at 256×8) with text-v3 clips, prompts first, no generation until approved.
- 11:24 user: list all Jyaldi motions, find cuts, missing, preset-OK; **walk/run are better in PixMiniMax than v3**. Claude Doc https://claude.ai/artifact/Spgomo2yVXCBSzxdkvpxSj has the verdicts (keep 29, PixMiniMax 2, redo jab/high-kick/pickup, new uppercut/front-flip/dodge/block, drop 4, hold 4). Awaiting the user's edits.
- **User decisions 11:46:**
  - Drop injured walk (injury shown by code). Drop crouch and crouch-walk. Drop flips.
  - 3 distinct jumps: in-place SE, directional E, running E. Jumps must be high. Need jump attack and double jump.
  - Dash attack and dodge are required. Block goes with dodge (dodge = press for an auto 'shik' evade).
  - Presets are banned for combos: per-character light ×3 + heavy ×1. Heavy alone launches/stuns with a big delay. Uppercut goes inside a character's light/heavy set.
  - Preset knockdown is bad. Need fly-back knockdown, a lying state, and a stun (dizzy) state.
  - Skill and charge share one key. Merge eat and drink into one 섭취.
  - Emotes are for NPC auto behavior.
- Claude's answers live in doc v2 (same URL). They cover: 2 attack buttons, the light→heavy finisher rule, jump height from code, double jump via code, super armor via FX, 섭취 = existing 먹기 clip + overhead icon, 12 emotes. Jyaldi needs 15 new text clips (~120 gens). All 55 ≈ 11k gens, about equal to the balance.
See [[pixellab-text-prompts]], [[agent-motion-list]].
