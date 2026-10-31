"""지하 2층 앞 기둥 색 보정(사용자 10-31 「일단 보정해봐」): 뒷골목 기둥 v3(정면) 5개를 지하 2층 벽 색으로.
지하 2층 벽 평균 RGB(②③④ 양끝 10% 빈 벽, y60~320)를 재고, 기둥 평균 RGB가 그 색 × 0.88(뒷골목에서 기둥/벽 밝기 비율)이 되게 채널마다 곱한다.
출력: jr_pillar5_b2_tone_front_<n>.png"""
from PIL import Image
import numpy as np
A = 'game-src/art/pixellab-test-20261028/'
wall = []
# 붉은 등·계단 빛이 비치는 띠(② 오른쪽, ④ 오른쪽, ⑤ 오른쪽)는 뺀다 — 처음엔 넣어서 기둥이 갈색이 됨
STRIPS = [('jr_b2_p1_v10', 'R'), ('jr_b2_p2_v3', 'L'), ('jr_b2_p3_v2', 'L'), ('jr_b2_p3_v2', 'R'), ('jr_b2_p4_v2', 'L'), ('jr_b2_p5_v2', 'L')]
for n, side in STRIPS:
    a = np.asarray(Image.open(A + n + '_632x424.png').convert('RGB')).astype(float)
    wall.append((a[60:320, 0:63] if side == 'L' else a[60:320, 569:]).reshape(-1, 3))
wall = np.concatenate(wall).mean(0)
target = wall * 0.88
print('벽 RGB', wall.round(1), '목표', target.round(1))
for k in range(1, 6):
    p = np.asarray(Image.open(A + f'jr_pillar5_alley_v3_front_{k}.png').convert('RGBA')).astype(float)
    m = p[:, :, 3] > 0
    cur = p[:, :, :3][m].mean(0)
    p[:, :, :3] = np.clip(p[:, :, :3] * (target / cur), 0, 255)
    Image.fromarray(p.astype(np.uint8), 'RGBA').save(A + f'jr_pillar5_b2_tone_front_{k}.png')
    print(k, '전', cur.round(1), '후', p[:, :, :3][m].mean(0).round(1))
