"""중림 통로 칸 원근 가이드 v4(선만, 사용자 10-31).
v3: 벽·카운터가 한 평면이라 바닥이 끝나는 곳에서 벽이 수직으로 서 있는 느낌이 안 남(사용자) →
벽선에 붙어 서서 바닥 위로 튀어나온 것들로 바닥(내려다봄)과 벽(수직)의 꺾임을 보인다:
 - 허리 높이 카운터가 통로 쪽으로 튀어나옴: 윗면(위에서 보이는 띠)·앞면, 앞면 아래가 바닥에 닿는 선
 - 가게 입구 양옆 기둥(벽에서 튀어나온 각기둥): 앞면 아래가 벽선보다 앞쪽 바닥에 닿음
가게 안 깊이는 눈높이 점(316,132)으로 모이는 안쪽 옆벽·천장, 가게 안 바닥은 카운터에 가려 안 보임. 통로 바닥에는 선을 긋지 않는다.
천장 선 y26, 뒷벽 아래 선 y262(바닥 약 38%), 가게 입구 x126~506 y66~262."""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
VX, VY = 316, 132
im = Image.new('RGB', (W, H), (255, 255, 255)); d = ImageDraw.Draw(im); K = (0, 0, 0)
CY, FY = 26, 262
DK = 0.5                                                  # 바닥 깊이 1을 화면 세로 0.5로(내려다보는 바닥)
def toward(x, y, t):
    return (x + (VX - x) * t, y + (VY - y) * t)
d.line([(0, CY), (W, CY)], fill=K)
x0, x1, y0 = 126, 506, 66
# 뒷벽 아래 선: 기둥·카운터 앞을 빼고
# 양옆 기둥(폭 18, 튀어나옴 깊이 16)
pd = 16 * DK
for a, b in ((108, 126), (506, 524)):
    d.rectangle([a, CY, b, FY + pd], outline=K)          # 기둥 앞면(아래가 벽선보다 앞쪽 바닥에 닿음)
d.line([(0, FY), (104, FY)], fill=K); d.line([(528, FY), (W, FY)], fill=K)
# 가게 안(눈높이 점으로 모임), 카운터 높이 아래는 가려짐
ch = 70; cy = FY - ch
t = 0.22
tl, tr = toward(x0, y0, t), toward(x1, y0, t)
bl, br = toward(x0, cy, t), toward(x1, cy, t)
d.line([(x0, y0), (x1, y0)], fill=K)
d.line([(x0, y0), tl], fill=K); d.line([(x1, y0), tr], fill=K); d.line([tl, tr], fill=K)
d.line([tl, bl], fill=K); d.line([tr, br], fill=K)
d.line([(x0, cy), bl], fill=K); d.line([(x1, cy), br], fill=K)
# 통로로 튀어나온 카운터(깊이 48 → 화면 24): 윗면 띠 + 앞면
cd = 48 * DK
cx0, cx1 = 134, 498                                      # 앞쪽이 아주 조금 넓음(소실점이 그림 위 멀리, 바닥은 앞으로 갈수록 살짝 벌어짐)
d.polygon([(136, cy), (496, cy), (cx1, cy + cd), (cx0, cy + cd)], outline=K)   # 윗면(입구 안쪽 폭, 앞으로 아주 조금 벌어짐)
d.rectangle([cx0, cy + cd, cx1, FY + cd], outline=K)                         # 앞면, 아래가 바닥에 닿음
im.save(P + '/jr_corridor_guide_v4.png')
g = im.convert('RGBA').resize((W * 2, H * 2), Image.NEAREST)
e = Image.open('tools/mapedit/eileen_stand.png').convert('RGBA'); F = 1.5 * 848 / 890
for x, foot, k in [(1150, FY * 2 + 4, 0.85), (1050, 840, 1.0)]:
    s = F * k; ee = e.resize((round(60 * s), round(234 * s)), Image.NEAREST); g.alpha_composite(ee, (x - ee.width // 2, foot - ee.height))
g.save(P + '/jr_corridor_guide_v4_with_eileen.png')
