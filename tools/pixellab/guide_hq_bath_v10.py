"""본부 B1 샤워실 선 가이드 v10(사용자 15:24 「샤워기 1개만 달아서 1개씩만 있는 거 아니야? 가이드를 더 작게」).
v9에서 바꾼 것: 방 높이를 더 낮춤(천장선 y100 → y140), 칸막이 벽 위 y130 → y175, 문도 그만큼 작게,
샤워기 표시를 면마다 3개(시안 v4처럼 앞·가운데·뒤 = 높이를 조금씩 달리한 꺾쇠 3개)로.
벽 자리(x70·330)·뒷벽 밑선 y286·오른쪽 옆벽 기울기·앞 통로는 v9 그대로.
사용: python3 guide_hq_bath_v10.py <출력폴더>"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (0, 0, 0, 255)
BX, CT, FB = 548, 140, 286
RT, RB = 92, 420
d.line([(0, CT), (BX, CT)], fill=K); d.line([(0, FB), (BX, FB)], fill=K); d.line([(BX, CT), (BX, FB)], fill=K)
d.line([(BX, CT), (W - 1, RT)], fill=K); d.line([(BX, FB), (W - 1, RB)], fill=K)
fy = lambda x: FB + (x - BX) * (RB - FB) / (W - 1 - BX)
ty = lambda x: CT + (x - BX) * (RT - CT) / (W - 1 - BX)
dh = lambda x: (fy(x) - ty(x)) * 0.72
a, b = 552, 580
d.polygon([(a, fy(a)), (a, fy(a) - dh(a)), (b, fy(b) - dh(b)), (b, fy(b))], outline=K)
for cx in (70, 330):
    d.rectangle([cx - 5, CT + 1, cx + 5, 360], fill=(0, 0, 0, 0))
    d.rectangle([cx - 6, 175, cx + 6, 360], outline=K)
    for i, y in enumerate((196, 206, 216)):          # 면마다 샤워기 3개(뒤·가운데·앞)
        L = 8 + i * 3
        d.line([(cx - 6, y), (cx - 6 - L, y), (cx - 6 - L, y + 5)], fill=K)
        d.line([(cx + 6, y), (cx + 6 + L, y), (cx + 6 + L, y + 5)], fill=K)
im.save(P + '/hq_bath_guide_v10.png')
v = Image.new('RGBA', (W, H), (235, 235, 230, 255)); v.alpha_composite(im); v = v.resize((W * 2, H * 2), Image.NEAREST)
e = Image.open(Path(__file__).resolve().parents[1] / 'mapedit/eileen_stand.png').convert('RGBA')
for fx, fy2, hh in ((300, 640, 250), (560, 640, 250), (460, 846, 334)):
    s = e.resize((max(1, round(e.width * hh / e.height)), hh), Image.NEAREST)
    v.alpha_composite(s, (fx - s.width // 2, fy2 - hh))
v.save(P + '/hq_bath_guide_v10_x2_view.png')
