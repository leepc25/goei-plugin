"""앞 기둥 밝기를 배경에 맞춘다(사용자 10-31: 너무 밝음·밑동이 까맘, 생성 없음).
1) 밑동 검은 띠: 줄마다 평균 밝기를 위쪽(0~280줄) 평균에 가깝게 끌어올림(색 비율은 그대로)
2) 전체: 기둥 평균 밝기를 그 골목 벽 평균 × 0.85로(맨 앞이라 배경보다 조금 어둡게)"""
from PIL import Image
import numpy as np
D = 'game-src/art/pixellab-test-20261028/'
SETS = {'jr_pillar5_front_v1': ['jr_b1_p1_v10', 'jr_b1_p2_v6', 'jr_b1_p3_v2', 'jr_b1_p4_v1', 'jr_b1_p5_v2', 'jr_b1_p6_v2', 'jr_b1_p7_v2'],
        'jr_pillar5_alley_v1': ['jr_alley_p1_v5', 'jr_alley_p2_v3', 'jr_alley_p3_v1', 'jr_alley_p4_v2', 'jr_alley_p5_v2', 'jr_alley_p7_v7b']}
for pre, panels in SETS.items():
    wall = np.concatenate([np.asarray(Image.open(D + n + '_632x424.png').convert('RGB')).astype(float)[60:300].reshape(-1, 3) for n in panels]).mean()
    target = wall * 0.85
    for i in range(1, 6):
        p = np.asarray(Image.open(D + f'{pre}_front_{i}.png').convert('RGBA')).astype(float)
        rgb, a = p[:, :, :3], p[:, :, 3] > 0
        top = rgb[:280][a[:280]].mean()
        for y in range(280, rgb.shape[0]):
            row = rgb[y][a[y]].mean() if a[y].any() else top
            if row > 1: rgb[y] *= min(3.0, top / row)
        cur = rgb[a].mean(); rgb *= target / cur
        p[:, :, :3] = np.clip(rgb, 0, 255)
        Image.fromarray(p.astype(np.uint8), 'RGBA').save(D + f'{pre}_tone_{i}.png')
        print(pre, i, '벽', round(wall), '→ 기둥', round(np.clip(rgb, 0, 255)[a].mean()))
