"""대변기 칸(문 열림) 다듬기 (2026-11-01 사용자 「전부 지운 다음 제대로 배치, 높이 좀 낮아」)
1) 화풍 그림에서 베껴 온 벽 물건(함·배관·버튼·벽 줄) 지움 — 기둥·윗판·문·안쪽 판·변기·휴지걸이만 남김
2) 높이: 기둥·문만 지나가는 가로 띠(y76~81)를 4번 더 넣어 +24px
3) 투명 여백 잘라 저장"""
from PIL import Image
import numpy as np
SRC = 'game-src/art/pixellab-hq-20261031/hq_restroom_m_stall_open.png'
OUT = 'game-src/art/objects/restroom/stall_open.png'
a = np.array(Image.open(SRC).convert('RGBA'))
h, w = a.shape[:2]
A = a[..., 3]
A[:31, :] = 0                      # 윗판 위 전부(함·배관)
A[:, :58] = 0; A[:, 212:] = 0      # 칸 바깥 좌우
for y in range(38, 61):            # 윗판 밑~문 위: 버튼·벽 줄 지우고 기둥만
    for x in range(w):
        keep = (62 <= x <= 74 or 168 <= x <= 180) if y < 57 else (61 <= x <= 77 or 158 <= x <= 182)
        if 183 <= x <= 211 and y >= 57 + (x - 165) * 16 / 43: keep = True
        if not keep: A[y, x] = 0
a[..., 3] = A
band = a[76:82]
a = np.concatenate([a[:82]] + [band] * 4 + [a[82:]], axis=0)
im = Image.fromarray(a); im = im.crop(im.getchannel('A').getbbox()); im.save(OUT)
print(im.size)
