"""중림 통로 양끝 칸 가이드(v6과 같은 천장 선 y26·통행로 선 y262, 투명 바탕).
① 왼쪽 끝(계단): 가게 사각형 x190~560 → jr_corridor_guide_left.png
⑦ 오른쪽 끝(B2 계단): 가게 사각형 x72~442 → jr_corridor_guide_right.png"""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
CY, FY = 26, 262
for name, (x0, x1) in (('left', (190, 560)), ('right', (72, 442))):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (0, 0, 0, 255)
    d.line([(0, CY), (W, CY)], fill=K); d.line([(0, FY), (W, FY)], fill=K)
    d.rectangle([x0, 66, x1, FY], outline=K)
    im.save(f'{P}/jr_corridor_guide_{name}.png')
