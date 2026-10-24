---
name: pixellab-web-ui-2026-10-23
description: What the PixelLab web UI actually offers for animation (user's hands-on look 2026-10-23 11:45) — trust this over doc-based claims
metadata:
  type: reference
---
User checked the PixelLab site directly (2026-10-23). Claude's doc-based info was often wrong there, so trust what the user saw.
- **Free motion:** v3 and PixMiniMax. You pick one of walking, running, pull, sprint or idle, and it draws automatically.
- **Template motion:** skeleton v3 (recommended) or standard legacy. You choose the motion yourself.
  - **Idle:** Breathing Idle and Fight Stance Idle. The user wants both.
  - **Jumps:** Jumping (Alt 1) = jump in place. Jumping (Alt 2) = jump with a direction key. running-jump. two-footed-jump = jump in place with legs straight.
  - **Running:** 4, 6 or 8 frames.
  - **Walking:** crouched (stealth), sad (injured; user wants it), scary (scared civilian or debuff). There are both "walk" and "walking" (difference unknown), and 9 variants by gender and body type.
  - **Flips:** back-flip and front-flip, for the double jump depending on direction.
  - **Other motions:** crouching (unclear), getting-up, slide (maybe a dash attack).
  - **Kicks:** flying (air attack), high, leg-sweep, roundhouse (combo or strong attack), hurricane (a skill, like Chun-Li).
  - **Punches:** lead-jab (front/left hand), cross-punch (rear/right straight), surprise-uppercut (rear hand).
  - **Reactions:** falling-back-death and taking-punch. Also fireball (palm-blast pose) and 5 interactions.
- **Motion settings** apply per animation to every direction:
  - Arm swing and Stride (0 = still).
  - Advanced: Leg extension (straightens the legs on reach and push-off) and Posture (uses the template's stance instead of the character's own).
  - "Describe your own" lets you describe a motion in text.
- Proposed (not yet applied to the guide): per-agent walk style = walk variant + arm swing/stride values instead of a text description.
- **Unmeasured claim proven wrong:** the "256 takes 25–30 min" claim. See [[pixellab-256-cost-weapons]].
See [[agent-motion-list]].
- **API check (openapi 2026-10-23 11:47):** all of these templates exist in the API, including walk-1/2, walking-2..10, sad-walk, scary-walk, backflip, front-flip, fight-stance-idle-8-frames, high-kick and flying-kick. Mode `skeleton-v3` is available. Arm swing, Stride, Leg extension and Posture are NOT in the API request (web only).
- There is no held crouch/squat idle template, only `crouching`. Hold its last frame if it ends crouched, otherwise use a v3 text clip.
- User 11:47: `crouching` is only a quick flinch and never reaches a crouch, so it's useless. Proposed instead: crouch-down via v3 with end_frame = first frame of crouched-walking. Crouch idle = hold that frame or a short v3 breathing clip. Stand-up = play it reversed.
- **Camera view (user 11:53):** the game is belt-scroll (DNF style), so the PixelLab character view should be LOW TOP-DOWN, not side-scroller. Claude wrongly said side-scroller. The guide still needs this fix, and the GPT bg floor angle should match.
- User 15:21 leaning to: produce ONE direction per agent = south-east (flip for left), via 8-dir registration. Guide's 'side view only' needs updating to this when the user says so.
