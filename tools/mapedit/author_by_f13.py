"""백일몽 본사 13층 복도 장면 원본 만들기 (2026-11-02 13:48 사용자 「일단 이걸로 픽스한다, 따고 상호작용 연결하고. 화장실이랑 휴게실은 관리국거 일단 쓰고」).
그림: game-src/art/pixellab-baekilmong/by_f13_hall_g4_full_fix.png (1448×424, 확정). 배경 2배 = 2896×848.
물건은 전부 뒷벽에 붙어 있고(벽등·판넬·엘리베이터 단추) 바닥 한가운데 물건이 없어 가림·막힘 없음(사용자 규칙: 가림은 바닥 한가운데 물건만).
바닥 윗선 = 뒷벽 걸레받이 밑 검은 줄(y328, 4배로 읽음) 바로 아래 y330 — 모든 문짝 밑(y327~328)과 기둥 받침 밑도 이 위.
문(1x, 3배 확대 눈금으로 읽은 값): 화장실(남) 문짝 83~170·y122~328, 화장실(여) 357~443·y120~328, 사무실 유리 양문 639~802·y118~327(이음 721),
엘리베이터 문짝 1000~1118·y127~327(이음 1059), 휴게실(커피잔 표지) 1273~1363·y118~328.
15층(사용자 13:50 「아래층거 그대로 써도 되지 않냐」)도 이 그림을 그대로 쓴다: painted.ts에서 PAINTED.by_f15 = PAINTED.by_f13 (문 이름·연결은 map.ts에서 층마다 다름).
출력: game-src/mapedit/by_f13/ → python3 tools/mapedit/import.py game-src/mapedit/by_f13 by_f13"""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/art/pixellab-baekilmong/by_f13_hall_g4_full_fix.png'
K = 2
im = Image.open(SRC).convert('RGB')
W, H = im.width * K, im.height * K
FLOOR_Y = 330 * K
def door(x0, x1, y0, y1, **kw): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'behind': 'dark', **kw}
LABELS = {'by_f13': {'wc_m': '화장실(남)', 'wc_f': '화장실(여)', 'office': '일반조 사무실', 'rest': '휴게실'}}
for sid, lb in LABELS.items():
    out = ROOT / 'game-src/mapedit' / sid; out.mkdir(parents=True, exist_ok=True)
    im.save(out / f'{sid}.png')
    doors = {
        'wc_m': {'kind': 'door', 'x': 126 * K, 'y': FLOOR_Y + 10, 'label': lb['wc_m'], 'door': door(83, 170, 122, 328, anim='none')},
        'wc_f': {'kind': 'door', 'x': 400 * K, 'y': FLOOR_Y + 10, 'label': lb['wc_f'], 'door': door(357, 443, 120, 328, anim='none')},
        'office': {'kind': 'glass', 'x': 721 * K, 'y': FLOOR_Y + 10, 'label': lb['office'], 'door': door(639, 802, 118, 327, anim='none')},
        'elev': {'kind': 'elevator', 'x': 1059 * K, 'y': FLOOR_Y + 10, 'label': '엘리베이터', 'door': door(1000, 1118, 127, 327, anim='slide2', seam=1059 * K, behind='car')},
        'rest': {'kind': 'door', 'x': 1318 * K, 'y': FLOOR_Y + 10, 'label': lb['rest'], 'door': door(1273, 1363, 118, 328, anim='none')},
    }
    m = {'file': sid, 'bgScale': K, 'w': W, 'h': H, 'under': False,
         'floor': [[0, FLOOR_Y], [W, FLOOR_Y], [W, H], [0, H]], 'lane': [FLOOR_Y, H - 12],
         'blocks': [], 'doors': doors, 'lamps': [], 'spots': [], 'objects': []}
    (out / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
    print(sid, W, H, list(doors))
