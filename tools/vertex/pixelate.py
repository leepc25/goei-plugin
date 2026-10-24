"""코드 도트화: n배 줄이고(칸 평균) → 색 수 축소(이미지 자체 팔레트, 디더링 없음) → 칸 그대로 n배 키움. 사용: python3 pixelate.py <입력> <출력> <n> <색수>"""
import sys
from PIL import Image

src, dst, n, k = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
im = Image.open(src).convert("RGB")
small = im.resize((im.width // n, im.height // n), Image.BOX)
small = small.quantize(k, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert("RGB")
small.resize((small.width * n, small.height * n), Image.NEAREST).save(dst)
