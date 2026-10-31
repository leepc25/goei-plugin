"""중림 통로 칸 원근 가이드 v6(사용자 10-31 「도로 선이랑 가게 크기를 그리라니까」): 투명 바탕에 선만.
천장 선 y26, 통행로(바닥)가 시작하는 뒷벽 아래 선 y262(바닥 약 38%), 가게 크기 사각형 x126~506 y66~262(가로 60%, 사람의 약 1.4배). 그 밖의 선 없음."""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
CY, FY = 26, 262
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (0, 0, 0, 255)
d.line([(0, CY), (W, CY)], fill=K)
d.line([(0, FY), (W, FY)], fill=K)
d.rectangle([126, 66, 506, FY], outline=K)
im.save(P + '/jr_corridor_guide_v6.png')
g = Image.new('RGBA', (W * 2, H * 2), (255, 255, 255, 255)); g.alpha_composite(im.resize((W * 2, H * 2), Image.NEAREST))
e = Image.open('tools/mapedit/eileen_stand.png').convert('RGBA'); F = 1.5 * 848 / 890
for x, foot, k in [(1150, FY * 2, 0.85), (1050, 840, 1.0)]:
    s = F * k; ee = e.resize((round(60 * s), round(234 * s)), Image.NEAREST); g.alpha_composite(ee, (x - ee.width // 2, foot - ee.height))
g.save(P + '/jr_corridor_guide_v6_with_eileen.png')
