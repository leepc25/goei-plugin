"""기둥 장(5개)을 자르고 정면만 남긴다(옆면이 왼쪽이든 오른쪽이든). 사용자 10-31: 기둥 원근 — 정면만.
기둥마다 세로줄 평균 밝기(위 300줄)에서 외곽선 줄(가운데값의 55% 미만)을 찾고, 외곽선 사이 가장 넓은 구간 = 정면. 양쪽 외곽선 한 줄씩 붙여 자른다.
사용: python3 tools/pixellab/pillar_front_face.py <장 이름...>"""
import sys
from PIL import Image
import numpy as np
D = 'game-src/art/pixellab-test-20261028/'
for n in sys.argv[1:]:
    p = Image.open(D + n + '_632x424.png').convert('RGBA')
    a = np.asarray(p)[:, :, 3] > 0
    xs = np.where(a.sum(0) > 200)[0]
    runs, s, prev = [], xs[0], xs[0]
    for x in xs[1:]:
        if x != prev + 1: runs.append((s, prev + 1)); s = x
        prev = x
    runs.append((s, prev + 1))
    for i, (x0, x1) in enumerate(runs, 1):
        im = p.crop((x0, 0, x1, 424)); w = im.width
        L = np.asarray(im).astype(float)[:300, :, :3].mean(2).mean(0)
        dark = L < np.median(L) * 0.55
        segs, st = [], None
        for c in range(w):
            if not dark[c] and st is None: st = c
            if (dark[c] or c == w - 1) and st is not None:
                segs.append((st, c if dark[c] else w)); st = None
        a0, a1 = max(segs, key=lambda t: t[1] - t[0])
        out = im.crop((max(0, a0 - 1), 0, min(w, a1 + 1), 424)); out.save(D + f'{n}_front_{i}.png')
        print(n, i, w, '→', out.width, (a0, a1))
