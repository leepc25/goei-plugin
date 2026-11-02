"""앞 기둥에서 오른쪽 옆면 띠를 떼어 정면만 남긴다(사용자 10-31: 기둥 원근 — 이음선은 양쪽 칸의 소실점이 반대라 옆면이 보이면 한쪽과 어긋남).
기둥 오른쪽 절반에서 처음 나오는 어두운 외곽선 세로줄(평균 밝기 < 15)까지 남기고 그 오른쪽(옆면)을 자른다. 외곽선 줄은 남겨 오른쪽 테두리로 쓴다."""
import sys
from PIL import Image
import numpy as np
D = 'game-src/art/pixellab-test-20261028/'
for i in range(1, 9):
    im = Image.open(D + f'jr_pillar8_v1_{i}.png').convert('RGBA')
    L = np.asarray(im).astype(float)[:300, :, :3].mean(2).mean(0)
    x = next(c for c in range(im.width // 2, im.width) if L[c] < 15)
    out = im.crop((0, 0, x + 1, im.height)); out.save(D + f'jr_pillar8_front_{i}.png')
    print(i, im.width, '→', out.width)
