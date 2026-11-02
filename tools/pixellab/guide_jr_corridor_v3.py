"""중림 통로 칸 원근 가이드 v3(선만, 사용자 10-31).
뒷벽·가게는 눈높이 정면(벨트스크롤 배경), 바닥(필드)만 내려다봄 — 가이드에는 바닥 선을 긋지 않는다.
v2(소실점 그림 위 멀리)는 가게 안 바닥이 보여 필드의 연장처럼 됨(사용자 지적) → 가게 안 깊이는 눈높이 점(316,132)으로 모이는 안쪽 옆벽·천장으로만,
입구 아래는 허리 높이 카운터(뒷벽 앞 사람 142 기준 약 70)가 가로로 막아 가게 안 바닥은 안 보임.
천장 선 y26, 뒷벽 아래 선 y262(바닥 약 38%), 가게 입구 x126~506 y66~262(사람의 약 1.4배)."""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
VX, VY = 316, 132
im = Image.new('RGB', (W, H), (255, 255, 255)); d = ImageDraw.Draw(im); K = (0, 0, 0)
CY, FY = 26, 262
d.line([(0, CY), (W, CY)], fill=K)
d.line([(0, FY), (W, FY)], fill=K)
def toward(x, y, t):
    return (x + (VX - x) * t, y + (VY - y) * t)
x0, x1, y0, y1 = 126, 506, 66, FY
d.rectangle([x0, y0, x1, y1], outline=K)                 # 가게 입구
cy = FY - 70                                              # 카운터 윗면 높이
t = 0.22                                                  # 가게 안 깊이
tl, tr = toward(x0, y0, t), toward(x1, y0, t)            # 안쪽 뒷벽 위 모서리
d.line([(x0, y0), tl], fill=K); d.line([(x1, y0), tr], fill=K); d.line([tl, tr], fill=K)   # 안쪽 천장
bl, br = toward(x0, cy, t), toward(x1, cy, t)            # 카운터 높이에서 안쪽 뒷벽 모서리
d.line([(x0, cy), bl], fill=K); d.line([(x1, cy), br], fill=K)                             # 안쪽 옆벽 아래(카운터에 가려지는 높이)
d.line([tl, bl], fill=K); d.line([tr, br], fill=K)                                         # 안쪽 뒷벽 양 모서리
d.rectangle([x0, cy, x1, FY], outline=K)                 # 입구를 막는 허리 높이 카운터 앞면
im.save(P + '/jr_corridor_guide_v3.png')
g = im.convert('RGBA').resize((W * 2, H * 2), Image.NEAREST)
e = Image.open('tools/mapedit/eileen_stand.png').convert('RGBA'); F = 1.5 * 848 / 890
for x, foot, k in [(1150, FY * 2, 0.85), (1050, 840, 1.0)]:
    s = F * k; ee = e.resize((round(60 * s), round(234 * s)), Image.NEAREST); g.alpha_composite(ee, (x - ee.width // 2, foot - ee.height))
g.save(P + '/jr_corridor_guide_v3_with_eileen.png')
