"""특수재난대응협회 2층 복도 장면 원본 만들기 (2026-11-02, 사용자 「화장실만 이은걸로 이층은 마무리 하자」).
그림: game-src/art/pixellab-hq-20261031/sdra_hall_p3_ext2R.png (952×424 = p3 + 오른쪽 잇기 2: 화장실 남·여 금속문). 배경 2배 = 1904×848.
관리국 3층(author_hq_f3.py)과 같은 방식: 물건은 전부 뒷벽에 붙어 있어 가림 없음, 바닥 윗선 = 물건 밑(소화기·정수기·분리수거함·사물함·상자 y312~314)보다 아래 y315.
문(1x, 4배 확대로 읽은 값): 창구 유리 양문 틀 31~194·y61~305(가운데 이음 115), 엘리베이터 문짝 260~375·y129~303(이음 318),
화장실(남) 문짝 682~743·y148~305, 화장실(여) 849~910·y148~305.
창구 안쪽 방 그림은 아직 없음 → 유리문은 잠금(덜컹). 화장실은 관리국 화장실 그림을 그대로 쓴다(map.ts sdra_wc_m·sdra_wc_f).
출력: game-src/mapedit/sdra_f2/ → python3 tools/mapedit/import.py game-src/mapedit/sdra_f2 sdra_f2"""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/art/pixellab-hq-20261031/sdra_hall_p3_ext2R.png'
OUT = ROOT / 'game-src/mapedit/sdra_f2'; OUT.mkdir(parents=True, exist_ok=True)
K = 2
im = Image.open(SRC).convert('RGB'); im.save(OUT / 'sdra_f2.png')
W, H = im.width * K, im.height * K
FLOOR_Y = 315 * K
def door(x0, x1, y0, y1, **kw): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'behind': 'dark', **kw}
doors = {
    'office': {'kind': 'glass', 'x': 113 * K, 'y': FLOOR_Y + 10, 'label': '협회 창구', 'door': door(31, 194, 61, 305, anim='none')},
    'elev': {'kind': 'elevator', 'x': 318 * K, 'y': FLOOR_Y + 10, 'label': '엘리베이터', 'door': door(260, 375, 129, 303, anim='slide2', seam=318 * K, behind='car')},
    'wc_m': {'kind': 'door', 'x': 713 * K, 'y': FLOOR_Y + 10, 'to': 'sdra_wc_m', 'toDoor': 'out', 'label': '화장실(남)', 'door': door(682, 743, 148, 305, anim='none')},
    'wc_f': {'kind': 'door', 'x': 880 * K, 'y': FLOOR_Y + 10, 'to': 'sdra_wc_f', 'toDoor': 'out', 'label': '화장실(여)', 'door': door(849, 910, 148, 305, anim='none')},
}
m = {'file': 'sdra_f2', 'bgScale': K, 'w': W, 'h': H, 'under': False,
     'floor': [[0, FLOOR_Y], [W, FLOOR_Y], [W, H], [0, H]], 'lane': [FLOOR_Y, H - 12],
     'blocks': [], 'doors': doors, 'lamps': [], 'spots': [], 'objects': []}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, list(doors))
