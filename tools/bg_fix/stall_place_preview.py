"""대변기 칸 배치 미리보기: 확정 남자 화장실 배경에 칸 3개(기둥 겹침, 간격 106) + 에일린(2배 화면)"""
import sys
from PIL import Image
bg = Image.open('game-src/art/pixellab-hq-20261031/hq_restroom_m_final_984x424.png').convert('RGBA')
st = Image.open('game-src/art/objects/restroom/stall_open.png').convert('RGBA')
FOOT, RIGHT, PITCH, N = 360, 390, 106, 3
x0 = RIGHT - 119
xs = [x0 - PITCH * i for i in range(N)]
for x in xs: bg.alpha_composite(st, (x, FOOT - st.height))  # 오른쪽부터: 왼쪽 칸의 열린 문이 위에 오게
big = bg.resize((bg.width * 2, bg.height * 2), Image.NEAREST)
if len(sys.argv) > 2:
    e = Image.open(sys.argv[2]); big.alpha_composite(e, (int(sys.argv[3]), 840 - e.height))
big.crop((0, 0, 1100, 848)).save(sys.argv[1]); print(xs)
