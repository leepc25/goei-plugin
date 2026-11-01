"""남자 화장실 왼쪽 잇기3 코드 손질(2026-11-01 사용자 「코드로 손질해봐」, 생성 없음)
1) 위쪽 창 띠(y101~153)를 오른쪽 유리 한 칸+창살(x600~666)로 왼쪽 끝까지 반복
2) 이음에서 잘린 첫 소변기 왼쪽 칸막이 판을 원본 p1(x46~70)에서 되살림 + 왼쪽 끝 검은 테두리"""
import sys
from PIL import Image
import numpy as np
D = 'game-src/art/pixellab-hq-20261031/'
r = np.array(Image.open(D + 'hq_restroom_m_ext3L.png').convert('RGBA'))
p1 = np.array(Image.open(D + 'hq_restroom_m_p1_632x424.png').convert('RGBA'))
OFF = 352  # r x = p1 x + 352
Y0, Y1 = 101, 154
tile = r[Y0:Y1, 600:667].copy()  # 유리 61 + 창살 6
x0 = 429 - tile.shape[1]
while x0 + tile.shape[1] > 0:
    a, b = max(x0, 0), x0 + tile.shape[1]
    r[Y0:Y1, a:b] = tile[:, a - x0:]
    x0 -= tile.shape[1]
# 칸막이 판
PY0, PY1 = 228, 332
r[PY0:PY1, 46 + OFF:71 + OFF] = p1[PY0:PY1, 46:71]
edge = p1[PY0:PY1, 44:46].min(axis=1)  # p1 판 왼쪽 그림자 색 대신 진한 테두리
r[PY0:PY1, 45 + OFF] = [40, 40, 44, 255]
Image.fromarray(r).save(D + 'hq_restroom_m_ext3L_fix.png')
print('ok')

# 3) 12:02 사용자 지적 「여기 어쩔거야」: 이음 x400~415, y154~229에 남은 옛 창틀 기둥 조각·파이프 토막 → 왼쪽 빈 콘크리트 벽(x370~385)으로 덮음
r = np.array(Image.open(D + 'hq_restroom_m_ext3L_fix.png').convert('RGBA'))
r[154:230, 400:416] = r[154:230, 370:386]
Image.fromarray(r).save(D + 'hq_restroom_m_ext3L_fix.png')
print('ok3')

# 4) 12:02 사용자 지적: 창 띠 반복에 딸려 온 창 아래 턱(y146~153)의 꺾쇠·점선이 토막토막 → 그 줄은 생성된 빈 콘크리트 벽으로 되돌림
o = np.array(Image.open(D + 'hq_restroom_m_ext3L.png').convert('RGBA'))
r = np.array(Image.open(D + 'hq_restroom_m_ext3L_fix.png').convert('RGBA'))
r[146:154, 0:400] = o[146:154, 0:400]
r[146:154, 400:416] = o[146:154, 370:386]
Image.fromarray(r).save(D + 'hq_restroom_m_ext3L_fix.png')
print('ok4')
