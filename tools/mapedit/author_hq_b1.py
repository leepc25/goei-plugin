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
# 앞쪽 상자 무더기(1x): x0, x1, 위 y, 발밑 시작 y — 아래 끝은 그림 끝(424)
PILES = [(559, 680, 350, 395), (855, 1040, 375, 400), (1420, 1505, 402, 410), (1515, 1568, 368, 395)]
def rect(x0, x1, y0, y1): return [[x0 * K, y0 * K], [x1 * K, y0 * K], [x1 * K, y1 * K], [x0 * K, y1 * K]]
blocks = [{'poly': rect(x0, x1, fy, 424), 'h': 999} for x0, x1, _, fy in PILES]
objects = [{'id': f'pile{i}', 'cover': [rect(x0, x1, y0, 424)], 'sortY': H - 12} for i, (x0, x1, y0, _) in enumerate(PILES)]
m = {'file': 'hq_b1_strip', 'bgScale': K, 'w': W, 'h': H, 'under': False,
     'floor': [[X0, FLOOR_Y], [X1, FLOOR_Y], [X1, H], [X0, H]], 'lane': [FLOOR_Y, H - 12],
     'blocks': blocks, 'doors': doors, 'lamps': [], 'spots': [], 'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, list(doors))
