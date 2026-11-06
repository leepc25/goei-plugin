---
name: goei-card-portraits
description: Character expression images now live in the bot card (asset module dropped) — where files, lorebooks and build hooks are
metadata:
  type: project
  modified: 2026-10-22T13:43:46.974Z
---
User 2026-10-22 (thread 에셋 봇카드 내장): the separate asset module is discarded. Everything goes in the card.
- Images: user-converted AVIF set (/mnt/project-files/Asset.zip, 1458 files, 54 chars × 27 expressions). Repo: defaults → assets/agents/<Name>_default.avif (overwrote old), others → assets/portraits/<Name>/<Name>_<kw>.avif. Renamed by folder (zip had Seo Yun-ji_* in Aestheticism/Brownie/Secriem, bare names in Shin Yuri) and embarrased→embarrassed. Yun Ji-a has only the old default.
- Lorebooks: card/image-lore.json (Asset = main-model tag guide, always active; Image tag = aux-model JSON for core/asset.ts). build_lite_card add_image_lore puts them in ⚙️설정 folder. Keyword lists cut to the 27 drawn expressions (user's export listed 60).
- Plugin: host/assets.ts loadModuleAssets also reads current card additionalAssets, so the image-tag picker finds card assets. Aileen crop → 43,21,46 for the new picture.
- Card ≈ 94MB; release/pic grows ~80MB at release; card update downloads all new pictures for existing users. Released v0.16.41 (main 692ad80, 2026-10-22 14:33, minPlugin 0.16.41) incl. Yun Ji-a 27 expressions. tests/browser.mjs Image tag missing-data test now also removes card copy.
