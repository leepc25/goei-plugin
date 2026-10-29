"""이어 그리기용 캔버스: 앞 구간 오른쪽 일부를 새 캔버스 왼쪽에 놓고 나머지는 흰색. 사용: python3 make_outpaint_canvas.py <앞 구간> <출력> <겹칠 폭>"""
import sys
from PIL import Image

src, dst, keep = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert("RGB")
c = Image.new("RGB", im.size, (255, 255, 255))
c.paste(im.crop((im.width - keep, 0, im.width, im.height)), (0, 0))
c.save(dst)
