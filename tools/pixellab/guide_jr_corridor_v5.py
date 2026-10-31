"""중림 통로 칸 원근 가이드 v5: 원근만(사용자 10-31 「원근만 알려주라니까」). 물건·가게·기둥·카운터 없음.
천장 선 y26, 뒷벽 아래 선 y262(바닥 약 38%).
바닥: 소실점 (316,-650)(그림 위 멀리, 게임 사람 배율 0.85→1.0과 같은 약한 원근)으로 모이는 선.
벽: 바닥 선이 벽선에 닿은 자리에서 곧게 위로 서는 수직선 → 바닥이 끝나는 곳에서 벽이 수직으로 꺾여 서 있음."""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
VX, VY = 316, -650
CY, FY = 26, 262
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (0, 0, 0, 255)   # 투명 바탕에 선만(사용자 10-31)
d.line([(0, CY), (W, CY)], fill=K)
d.line([(0, FY), (W, FY)], fill=K)
for bx in range(-84, W + 120, 79):                 # 그림 아래 가장자리의 점들
    t = (H - FY) / (H - VY)                         # 아래(y424)에서 벽선(y262)까지 소실점 쪽으로
    wx = bx + (VX - bx) * t
    d.line([(bx, H), (wx, FY)], fill=K)             # 바닥: 소실점으로 모이는 선
    d.line([(wx, FY), (wx, CY)], fill=K)            # 벽: 수직선
im.save(P + '/jr_corridor_guide_v5.png')
g = Image.new('RGBA', (W * 2, H * 2), (255, 255, 255, 255)); g.alpha_composite(im.resize((W * 2, H * 2), Image.NEAREST))   # 보기용만 흰 바탕
e = Image.open('tools/mapedit/eileen_stand.png').convert('RGBA'); F = 1.5 * 848 / 890
for x, foot, k in [(1150, FY * 2, 0.85), (1050, 840, 1.0)]:
    s = F * k; ee = e.resize((round(60 * s), round(234 * s)), Image.NEAREST); g.alpha_composite(ee, (x - ee.width // 2, foot - ee.height))
g.save(P + '/jr_corridor_guide_v5_with_eileen.png')
