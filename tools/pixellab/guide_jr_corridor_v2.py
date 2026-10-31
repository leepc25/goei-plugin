"""중림 통로 칸 원근 가이드 v2(선만). 게임 사람 배율(뒷벽 앞 0.85 → 맨 앞 1.0)에 맞춰 소실점을 그림 위 멀리(316,-650)에 둔
약한 원근(사용자 10-31: v1 소실점 y132는 뒷벽 사람 0.45배가 돼 게임과 안 맞음).
천장 선 y26, 뒷벽 아래 선 y262(바닥 약 38%), 가게 입구 x126~506 y66~262(사람의 약 1.4배).
가게 안: 옆벽은 거의 수직으로 살짝 모이고, 안쪽 바닥이 보이며 안 천장은 안 보임. 바닥 선·천장 모서리 사선은 긋지 않는다."""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
VX, VY = 316, -650
im = Image.new('RGB', (W, H), (255, 255, 255)); d = ImageDraw.Draw(im); K = (0, 0, 0)
CY, FY = 26, 262
d.line([(0, CY), (W, CY)], fill=K)
d.line([(0, FY), (W, FY)], fill=K)
def toward(x, y, t):
    return (x + (VX - x) * t, y + (VY - y) * t)
x0, x1, y0, y1 = 126, 506, 66, FY
d.rectangle([x0, y0, x1, y1], outline=K)
t = 0.045                                      # 가게 깊이(안쪽 바닥 약 41도트가 보임)
bl, br = toward(x0, y1, t), toward(x1, y1, t)  # 안쪽 바닥 뒤 모서리
d.line([(x0, y1), bl], fill=K); d.line([(x1, y1), br], fill=K); d.line([bl, br], fill=K)
d.line([bl, (bl[0], y0)], fill=K); d.line([br, (br[0], y0)], fill=K)   # 안쪽 뒷벽 양 모서리(입구 위 테두리에 가려짐)
im.save(P + '/jr_corridor_guide_v2.png')
g = im.convert('RGBA').resize((W * 2, H * 2), Image.NEAREST)
e = Image.open('tools/mapedit/eileen_stand.png').convert('RGBA'); F = 1.5 * 848 / 890
for x, foot, k in [(1150, FY * 2, 0.85), (1050, 840, 1.0)]:
    s = F * k; ee = e.resize((round(60 * s), round(234 * s)), Image.NEAREST); g.alpha_composite(ee, (x - ee.width // 2, foot - ee.height))
g.save(P + '/jr_corridor_guide_v2_with_eileen.png')
