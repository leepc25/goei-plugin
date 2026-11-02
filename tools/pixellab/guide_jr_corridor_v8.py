"""중림 통로 가이드 v8(사용자 10-31 「80%로 해」): v6과 같은 천장 선 y26·통행로 선 y262, 투명 바탕에 선만.
가게 사각형만 넓힘: 가운데 칸 x63~569(가로 80%, 양끝 10% 비움 사이 전부), 왼쪽 끝 칸 x126~569(왼쪽 20%는 옆벽), 오른쪽 끝 칸 x63~506(오른쪽 20%는 계단)."""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
CY, FY = 26, 262
for tag, (x0, x1) in {'': (63, 569), '_left': (126, 569), '_right': (63, 506)}.items():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (0, 0, 0, 255)
    d.line([(0, CY), (W, CY)], fill=K); d.line([(0, FY), (W, FY)], fill=K)
    d.rectangle([x0, 66, x1, FY], outline=K)
    im.save(P + f'/jr_corridor_guide_v8{tag}.png')
