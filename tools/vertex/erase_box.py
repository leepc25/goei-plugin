"""사각 영역을 위아래 줄 색으로 세로 보간해 덮는다(벽 위 글자 지우기). 사용: python3 erase_box.py <입력> <출력> x0 y0 x1 y1"""
import sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = map(int, sys.argv[3:7])
a = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
top, bot = a[y0 - 1, x0:x1], a[y1, x0:x1]
for y in range(y0, y1):
    t = (y - y0 + 1) / (y1 - y0 + 1)
    a[y, x0:x1] = top * (1 - t) + bot * t
Image.fromarray(a.round().astype(np.uint8)).save(dst)
