"""본부 B1 샤워실 선 가이드 v9: v8에서 오른쪽 옆벽 문만 안쪽(화면 위쪽)으로 당겨 작게(사용자 15:08). 나머지 v8 그대로.
v6 그대로(뒷벽 밑선 y286, 오른쪽 옆벽 문, 칸막이 벽 2개 x70·330, 앞 통로)에서 높이만 사람 키에 맞춰 낮춤:
- 뒷벽 밑선 y286에 선 어른 키 ≈ 125px(1x) → 천장선 y40 → y100(뒷벽 186px ≈ 어른 1.5배).
- 칸막이 벽 위 y130(뒷벽에서 어른보다 조금 큼, 약 156px), 앞 끝 y360. 샤워기 표시 y170(어른 머리 바로 위).
- 오른쪽 옆벽: 위 (548,100)→(631,76), 밑 (548,286)→(631,352). 문은 옆벽 높이의 72%.
사용: python3 guide_hq_bath_v7.py <출력폴더>"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (0, 0, 0, 255)
BX, CT, FB = 548, 100, 286
RT, RB = 40, 420   # v8: 옆벽 위·밑선을 더 가파르게(v7 76·352 → 40·420, 사용자 15:07 「문이 너무 비스듬히 누워 있어, 더 가파르게 세워봐」)
d.line([(0, CT), (BX, CT)], fill=K); d.line([(0, FB), (BX, FB)], fill=K); d.line([(BX, CT), (BX, FB)], fill=K)
d.line([(BX, CT), (W - 1, RT)], fill=K); d.line([(BX, FB), (W - 1, RB)], fill=K)
fy = lambda x: FB + (x - BX) * (RB - FB) / (W - 1 - BX)
ty = lambda x: CT + (x - BX) * (RT - CT) / (W - 1 - BX)
dh = lambda x: (fy(x) - ty(x)) * 0.72
a, b = 552, 584   # v9: 문을 옆벽 안쪽(위쪽)으로 당김 — v8 566~612는 너무 큼(사용자 15:08 「문을 위쪽으로 땡겨」)
d.polygon([(a, fy(a)), (a, fy(a) - dh(a)), (b, fy(b) - dh(b)), (b, fy(b))], outline=K)
for cx in (70, 330):
    d.rectangle([cx - 5, CT + 1, cx + 5, 360], fill=(0, 0, 0, 0))
    d.rectangle([cx - 6, 130, cx + 6, 360], outline=K)
    d.line([(cx - 6, 170), (cx - 18, 170), (cx - 18, 176)], fill=K)
    d.line([(cx + 6, 170), (cx + 18, 170), (cx + 18, 176)], fill=K)
im.save(P + '/hq_bath_guide_v9.png')
v = Image.new('RGBA', (W, H), (235, 235, 230, 255)); v.alpha_composite(im); v = v.resize((W * 2, H * 2), Image.NEAREST)
e = Image.open(Path(__file__).resolve().parents[1] / 'mapedit/eileen_stand.png').convert('RGBA')
for fx, fy2, hh in ((300, 640, 250), (560, 640, 250), (460, 846, 334)):
    s = e.resize((max(1, round(e.width * hh / e.height)), hh), Image.NEAREST)
    v.alpha_composite(s, (fx - s.width // 2, fy2 - hh))
v.save(P + '/hq_bath_guide_v9_x2_view.png')
