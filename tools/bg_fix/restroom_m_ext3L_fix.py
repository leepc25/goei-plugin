"""남자 화장실 왼쪽 잇기3 코드 손질 — 사용자가 짚은 이음 자리 두 곳만 (2026-11-01 12:03 「여기만 수정하라니까」)
창 띠 반복 같은 다른 손질은 하지 않는다.
1) x400~415, y154~229: 이음에 남은 옛 창틀 기둥 조각·파이프 토막 → 바로 왼쪽 빈 벽(x370~385)으로 덮음
2) 첫 소변기 왼쪽 잘린 칸막이 판 → 원본 p1(x46~70)에서 그대로 되살림 + 판 왼쪽 끝 테두리"""
from PIL import Image
import numpy as np
D = 'game-src/art/pixellab-hq-20261031/'
r = np.array(Image.open(D + 'hq_restroom_m_ext3L.png').convert('RGBA'))
p1 = np.array(Image.open(D + 'hq_restroom_m_p1_632x424.png').convert('RGBA'))
OFF = 352
r[154:231, 396:416] = r[154:231, 366:386]
r[231:332, 46 + OFF:71 + OFF] = p1[231:332, 46:71]
r[231:332, 45 + OFF] = [40, 40, 44, 255]
Image.fromarray(r).save(D + 'hq_restroom_m_ext3L_fix.png')
o = np.array(Image.open(D + 'hq_restroom_m_ext3L.png').convert('RGBA'))
ch = np.argwhere((r != o).any(2)); print('바뀐 범위 x', ch[:,1].min(), ch[:,1].max(), 'y', ch[:,0].min(), ch[:,0].max())
