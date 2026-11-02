"""사무실 p7b 나무 장(x420~477, 바닥 y301) 밑 바닥 반사 손질 — 사용자 11-02 07:33 「여기 코드로 고쳐 정밀하게」(p8 47%,70%).
이음 자리에서 반사가 각진 덩어리로 끊겨 세로선이 보임 → 그 칸(x420~477, y302~379)만 다시 만든다:
바닥 = 같은 줄 왼쪽 빈 바닥(x413~419) 중간값, 그 위에 장을 위아래로 뒤집어 비춘 그림을 옅게(0.30→0, 50줄) 얹는다. 그 밖 픽셀은 그대로.
사용: python3 office_p7b_floor_fix.py <in> <out> [x 밀기]"""
import sys
import numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]; dx = int(sys.argv[3]) if len(sys.argv) > 3 else 0
im = np.asarray(Image.open(src).convert('RGBA')).copy()
X0, X1, FL, Y1, FADE, A0 = 420 + dx, 478 + dx, 301, 380, 50, 0.30
for y in range(FL + 1, Y1):
    base = np.median(im[y, 413 + dx:420 + dx, :3], axis=0)
    k = y - FL; src_y = FL - k
    a = A0 * max(0.0, 1 - (k - 1) / FADE) if src_y > 0 else 0
    for x in range(X0, X1):
        c = base * (1 - a) + im[src_y, x, :3] * a
        im[y, x, :3] = np.round(c).astype(np.uint8)
Image.fromarray(im).save(out); print('changed x', X0, X1 - 1, 'y', FL + 1, Y1 - 1)
