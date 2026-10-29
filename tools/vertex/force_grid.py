"""코드로 도트 격자 강제: n×n 칸 평균으로 줄였다가 칸 그대로 키움, 선택적으로 색 수 축소. 사용: python3 force_grid.py <입력> <출력> <n> [색수]"""
import sys
from PIL import Image

src, dst, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
colors = int(sys.argv[4]) if len(sys.argv) > 4 else 0
im = Image.open(src).convert("RGB")
small = im.resize((im.width // n, im.height // n), Image.BOX)
if colors:
    small = small.quantize(colors, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGB")
small.resize((small.width * n, small.height * n), Image.NEAREST).save(dst)
