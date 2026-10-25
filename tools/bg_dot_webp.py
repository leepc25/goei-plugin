# 시연판 용량 줄이기: game-src/art/bg/dot/**.png 를 무손실 WebP로 game-src/art/bg/dot-webp/ 에 같은 경로로 만든다 (2026-10-25).
# 도트 그대로(무손실). build.mjs는 WebP가 있으면 그것을 넣는다. 원본 PNG가 바뀌면 다시 돌린다.
# 사용: python3 tools/bg_dot_webp.py
from pathlib import Path
from PIL import Image
src, dst = Path('game-src/art/bg/dot'), Path('game-src/art/bg/dot-webp')
n = 0
for f in src.rglob('*.png'):
    o = dst / f.relative_to(src).with_suffix('.webp')
    if o.exists() and o.stat().st_mtime >= f.stat().st_mtime: continue
    o.parent.mkdir(parents=True, exist_ok=True)
    Image.open(f).save(o, 'WEBP', lossless=True, method=4)
    n += 1
print(n, 'files')
