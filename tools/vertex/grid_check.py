"""도트 격자 측정: 크기 n·오프셋별로 n×n 칸 안 색 편차(낮을수록 격자에 맞음). 사용: python3 grid_check.py <그림>"""
import sys
import numpy as np
from PIL import Image

a = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float32)
print("size", a.shape[1], "x", a.shape[0])
for n in range(1, 9):
    best = None
    for oy in range(n):
        for ox in range(n):
            b = a[oy:, ox:]
            h, w = (b.shape[0] // n) * n, (b.shape[1] // n) * n
            c = b[:h, :w].reshape(h // n, n, w // n, n, 3)
            err = float(np.abs(c - c.mean(axis=(1, 3), keepdims=True)).mean())
            best = err if best is None or err < best else best
    print(f"n={n} 칸안 평균편차 {best:.2f}")
