# 관리국 층 배경 6장에서 엘리베이터 문짝(왼·오)을 투명 오브젝트로 오린다 (2026-10-25).
# 좌표는 src/game/action/hq/painted.ts의 elev와 같다. 게임은 배경에서 같은 자리를 떠서 쓰고, 이 파일은 기록·검수용.
# python3 tools/cut_hq_elevators.py
import json
from PIL import Image, ImageDraw
ELEV = {  # x0, x1, y0, y1, seam, quad(옆벽 원근)
    'lobby': (1580, 1765, 117, 415, 1674, None),
    'f2': (886, 1091, 114, 431, 988, None),
    'f3': (820, 1014, 133, 430, 916, None),
    'b1': (829, 1028, 132, 432, 929, None),
    'b2': (886, 1091, 126, 432, 990, None),
    'b3': (1724, 1849, 130, 552, 1784, [(1724, 165), (1849, 130), (1849, 552), (1724, 510)]),
}
meta = {}
for n, (x0, x1, y0, y1, seam, quad) in ELEV.items():
    im = Image.open(f'game-src/art/field/hq/{n}.png').convert('RGBA')
    m = Image.new('L', im.size, 0)
    d = ImageDraw.Draw(m)
    if quad: d.polygon(quad, fill=255)
    else: d.rectangle((x0, y0, x1 - 1, y1 - 1), fill=255)
    im.putalpha(m)
    out = f'game-src/art/field/objects/{n}'
    import os; os.makedirs(out, exist_ok=True)
    for side, (a, b) in (('left', (x0, seam)), ('right', (seam, x1))):
        im.crop((a, y0, b, y1)).save(f'{out}/elevator_{side}.png')
    meta[n] = {'x0': x0, 'x1': x1, 'y0': y0, 'y1': y1, 'seam': seam, 'quad': quad}
json.dump(meta, open('game-src/art/field/objects/elevators.json', 'w'), ensure_ascii=False, indent=1)
print('ok')
