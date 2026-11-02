"""사무실 p9R2 창 오른쪽 틀(이음 자리 x1086~1097) 손질 — 사용자 11-02 07:38 「여기 왜이래」(74%,29%).
y85~207 줄마다: x1086~1087 갈색 점선 → 같은 줄 x1085 유리 색, x1093(틀 바깥 윤곽) → x1093 y100 윤곽 색, x1094~1097 흰 띠 → 같은 줄 x1099 기둥 색(y190까지, 그 밑은 물건).
x1098 기둥 윤곽과 그 밖 픽셀은 그대로. 사용: python3 office_p9R2_window_fix.py <in> <out>"""
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA'); px = im.load()
OUTL = px[1093, 100]; n = 0
for y in range(85, 208):
    for x in (1086, 1087): px[x, y] = px[1085, y]; n += 1
    px[1093, y] = OUTL; n += 1
    if y < 191:
        for x in range(1094, 1098): px[x, y] = px[1099, y]; n += 1
im.save(sys.argv[2]); print(n, 'px')
