"""그림을 세로 구간별로 늘이거나 줄여 벽선·바닥선 높이를 다른 그림에 맞춘다.
사용: python3 remap_rows.py 입력 출력 가로배율 원본y:목표y ...
예: remap_rows.py a.webp a2.png 0.89 97:97 530:483  (0과 맨 아래는 자동으로 고정)
"""
import sys
import numpy as np
from PIL import Image

src, dst, sx = sys.argv[1], sys.argv[2], float(sys.argv[3])
im = Image.open(src).convert('RGB')
w, h = im.size
pairs = [(0, 0)] + [tuple(map(int, a.split(':'))) for a in sys.argv[4:]] + [(h, h)]
if sx != 1:
    im = im.resize((round(w * sx), h), Image.LANCZOS)
parts = []
for (s0, t0), (s1, t1) in zip(pairs, pairs[1:]):
    seg = im.crop((0, s0, im.width, s1))
    parts.append(seg.resize((im.width, t1 - t0), Image.LANCZOS) if t1 - t0 != s1 - s0 else seg)
out = Image.new('RGB', (im.width, h))
y = 0
for p in parts:
    out.paste(p, (0, y)); y += p.height
out.save(dst)
print(dst, out.size)
