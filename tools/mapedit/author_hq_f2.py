"""관리국 본부 2층(f2) 장면 원본 만들기 (2026-11-01).
그림: game-src/art/pixellab-hq-20261031/hq_f2_ext1L.png (1174×424 = 왼쪽 잇기 312 + 첫 판(3층 밑그림 inpaint) 512 + 화장실(남) 오른쪽 잇기 350). 배경 2배 = 2348×848.
물건은 전부 뒷벽에 붙어 있어 바닥(걷는 곳)보다 위 → 가림 없음. 바닥 윗선 y338(1x) = 676(2x), 3층과 같음.
문(1x, 격자 확대로 읽은 틀 바깥선): 진압팀 철제 이중문 305~459·y146~326, 엘리베이터 508~622·y128~326, 화장실(남) 나무문 1025~1103·y173~326.
출력: game-src/mapedit/f2/ (장면 id = f2 = PAINTED 열쇠) → python3 tools/mapedit/import.py game-src/mapedit/f2 f2"""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/art/pixellab-hq-20261031/hq_f2_ext1L.png'
OUT = ROOT / 'game-src/mapedit/f2'; OUT.mkdir(parents=True, exist_ok=True)
K = 2
im = Image.open(SRC).convert('RGB'); im.save(OUT / 'hq_f2_strip.png')
W, H = im.width * K, im.height * K
FLOOR_Y = 338 * K
X0, X1 = 70 * K, (1174 - 6) * K  # 왼쪽 끝 = 구석 상자·분리수거함(x0~69, 바닥까지 내려옴) 오른쪽부터
def door(x0, x1, y0, y1, anim='none'): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'anim': anim, 'behind': 'dark'}
doors = {
    'swat': {'kind': 'steel', 'x': 382 * K, 'y': FLOOR_Y + 10, 'to': 'swat', 'toDoor': 'out', 'label': '진압팀', 'door': door(305, 459, 146, 326)},
    'elev': {'kind': 'elevator', 'x': 565 * K, 'y': FLOOR_Y + 10, 'label': '엘리베이터', 'door': door(508, 622, 128, 326)},
    'wc': {'kind': 'door', 'x': 1064 * K, 'y': FLOOR_Y + 10, 'to': 'wc', 'toDoor': 'out', 'label': '화장실(남)', 'door': door(1025, 1103, 173, 326)},
}
m = {'file': 'hq_f2_strip', 'bgScale': K, 'w': W, 'h': H, 'under': False,
     'floor': [[X0, FLOOR_Y], [X1, FLOOR_Y], [X1, H], [X0, H]], 'lane': [FLOOR_Y, H - 12],
     'blocks': [], 'doors': doors, 'lamps': [], 'spots': [], 'objects': []}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, list(doors))
