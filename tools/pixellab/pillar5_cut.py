"""기둥 5개 장 두 개(앞골목·뒷골목)를 기둥마다 자르고 오른쪽 옆면 띠를 떼어 정면만 남긴다(사용자 10-31: 중간 굵기, 원근).
옆면 경계 = 기둥 가로 35~90% 안에서 가장 어두운 세로줄(위 300줄 평균). 그 줄까지 남긴다."""
from PIL import Image
import numpy as np
D = 'game-src/art/pixellab-test-20261028/'
import sys
for n in (sys.argv[1:] or ('jr_pillar5_front_v1', 'jr_pillar5_alley_v1')):
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
        lo, hi = int(w * .35), int(w * .9)
        c = lo + int(np.argmin(L[lo:hi]))
        out = im.crop((0, 0, c + 1, 424)); out.save(D + f'{n}_front_{i}.png')
        print(n, i, w, '→', out.width)
