"""중림 통로 칸 원근 가이드(선만, 사용자 10-31 「그림 말고 선으로만 원근을 잡아서 첨부」).
흰 바탕에 검은 1px 선: 천장 선 y36(사용자: 천장이 너무 큼 → 얇게), 뒷벽 아래 선 y300(수평), 소실점 (316,170)=뒷벽 앞 사람(142) 눈높이,
가운데 가게 입구(x126~506, y92~300, 사람의 약 1.5배)와 그 안쪽으로 들어간 방(소실점으로 모이는 선).
천장 모서리 사선은 옆벽을 부르므로 긋지 않는다.
바닥에는 선을 긋지 않는다(바닥 판 선이 그려짐)."""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
VX, VY = 316, 170
im = Image.new('RGB', (W, H), (255, 255, 255)); d = ImageDraw.Draw(im); K = (0, 0, 0)
CY, FY = 36, 300
d.line([(0, CY), (W, CY)], fill=K)            # 천장과 뒷벽이 만나는 선
d.line([(0, FY), (W, FY)], fill=K)            # 뒷벽 아래 선
def toward(x, y, t):                           # (x,y)에서 소실점 쪽으로 t만큼
    return (x + (VX - x) * t, y + (VY - y) * t)
x0, x1, y0, y1 = 126, 506, 92, FY             # 가게 입구
d.rectangle([x0, y0, x1, y1], outline=K)
t = 0.25                                       # 가게 안 깊이
b = [toward(x0, y0, t), toward(x1, y0, t), toward(x1, y1, t), toward(x0, y1, t)]
for p, q in zip([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], b): d.line([p, q], fill=K)
d.polygon(b, outline=K)
d.ellipse([VX - 2, VY - 2, VX + 2, VY + 2], outline=K)
im.save(P + '/jr_corridor_guide_v1.png'); im.resize((W * 2, H * 2), Image.NEAREST).save(P + '/jr_corridor_guide_v1_x2.png')
