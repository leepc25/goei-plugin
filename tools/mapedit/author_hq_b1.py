"""관리국 본부 지하 1층(b1) 장면 원본 만들기 (2026-11-01, 사용자 「지하 1층은 확정하고 작업해」).
그림: game-src/art/pixellab-hq-20261031/hq_b1_ext3L.png (1568×424 = 왼쪽 잇기 3회 + 첫 판). 배경 2배 = 3136×848.
문(1x, 격자 확대로 읽은 틀 바깥선): 샤워실(여) 337~415·y160~330, 샤워실(남) 740~825·y160~330, 훈련장 양문 982~1104·y162~330, 엘리베이터 1192~1310·y155~330.
바닥 앞쪽(카메라 쪽)에 상자·수레 4무더기 → 발밑은 막힘(holes), 상자 전체는 가림(cover, 사람보다 앞).
교육장·계단은 새 그림에 없음(인계 결정: B1 = 훈련장·샤워실(남)·샤워실(여)·엘리베이터).
출력: game-src/mapedit/b1/ → python3 tools/mapedit/import.py game-src/mapedit/b1 b1"""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/art/pixellab-hq-20261031/hq_b1_ext3L.png'
OUT = ROOT / 'game-src/mapedit/b1'; OUT.mkdir(parents=True, exist_ok=True)
K = 2
im = Image.open(SRC).convert('RGB'); im.save(OUT / 'hq_b1_strip.png')
W, H = im.width * K, im.height * K
FLOOR_Y = 338 * K
X0, X1 = 10 * K, (1568 - 6) * K
def door(x0, x1, y0, y1, anim='none'): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'anim': anim, 'behind': 'dark'}
doors = {
    'shower_f': {'kind': 'door', 'x': 376 * K, 'y': FLOOR_Y + 10, 'locked': True, 'label': '샤워실(여)', 'door': door(337, 415, 160, 330)},
    'shower_m': {'kind': 'door', 'x': 782 * K, 'y': FLOOR_Y + 10, 'locked': True, 'label': '샤워실(남)', 'door': door(740, 825, 160, 330)},
    'training': {'kind': 'steel', 'x': 1043 * K, 'y': FLOOR_Y + 10, 'to': 'training', 'toDoor': 'out', 'label': '훈련장', 'door': door(982, 1104, 162, 330)},
    'elev': {'kind': 'elevator', 'x': 1251 * K, 'y': FLOOR_Y + 10, 'label': '엘리베이터', 'door': door(1192, 1310, 155, 330)},
}
# 11-01 09:12 사용자 「못 가는 곳·벽과 바닥 연결선·앞에 보일 사물을 픽셀 단위로」: 네모 어림 버리고 그림 윤곽선에서 읽음(tools/mapedit/outline_trace.py)
import sys; sys.path.insert(0, str(ROOT / 'tools/mapedit'))
from outline_trace import floor_line, pile_tops, tops_poly, line_poly, mask_from_tops
for f in OUT.glob('part_*.png'): f.unlink()
# 앞쪽(카메라 쪽) 무더기 4곳: 읽을 x 범위와 바닥 쪽 시작 y
PILES = [(540, 700, 350), (853, 1041, 366), (1400, 1515, 393), (1505, 1568, 362)]
tops = [pile_tops(im, a, b, sy) for a, b, sy in PILES]
# 바닥 윗선: 기둥마다 y370에서 위로(무더기 기둥은 무더기 윗선 위에서 시작)
line = floor_line(im, 370, starts=[(554, 640, 349), (640, 682, 384), (1515, 1568, 364)])
floor1 = line_poly(line, 10, 1562, 424)
blocks = [{'poly': [[x * K, y * K] for x, y in tops_poly(t, 430)], 'h': 999} for t in tops if t]
objects = []
for i, t in enumerate(tops):
    if not t: continue
    mk = mask_from_tops(im.size, t, im.height)
    bb = mk.getbbox(); cut = im.crop(bb).convert('RGBA'); cut.putalpha(mk.crop(bb))
    cut = cut.resize((cut.width * K, cut.height * K), Image.NEAREST); cut.save(OUT / f'part_pile{i}.png')
    objects.append({'id': f'pile{i}', 'file': f'part_pile{i}', 'x': bb[0] * K, 'y': bb[1] * K, 'w': cut.width, 'h': cut.height, 'sortY': H - 12})
m = {'file': 'hq_b1_strip', 'bgScale': K, 'w': W, 'h': H, 'under': False,
     'floor': [[x * K, y * K] for x, y in floor1], 'lane': [min(line[10:1562]) * K, H - 12],
     'blocks': blocks, 'doors': doors, 'lamps': [], 'spots': [], 'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, list(doors))
