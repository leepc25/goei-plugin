---
name: pixellab-256-cost-weapons
description: PixelLab costs at 256 canvas and the official/industry way to add weapons (checked 2026-10-23 from api.pixellab.ai/mcp/docs)
metadata:
  type: reference
---
- Templates (animate_character) bill 1 generation PER FRAME at 256px (128px: walking 6fr = 2). The "30+ min per direction" doc claim is WRONG per user hands-on test 2026-10-23 11:15 — never quote unmeasured times as fact.
- create_character_state: 10–25 gens. Official weapon path = a state with the weapon (override_width/height for big items).
- edit-animation-pro ("add a sword to all frames"): 171–256px = up to 4 frames per call, 25 gens; 129–170px = 15 gens.
- No weapon-swing templates (only punch/kick/throw-object/picking-up etc.); weapon attacks via text v3.
- Asset-pack industry practice (PixelFight, Admurin): motion groups + weapon drawn on a separate layer per frame.
- No Reddit/user reports found on PixelLab weapon workflows.
See [[pixellab-usage-tips]], [[character-art-rules]].
