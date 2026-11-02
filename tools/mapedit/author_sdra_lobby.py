"""특수재난대응협회 1층 로비 장면 원본 만들기 (2026-11-02, 사용자 「로비 확정, 상호작용 붙이고 문 작업해」).
그림: game-src/art/pixellab-hq-20261031/sdra_f1_keep.png (= p4, 632×424: 왼쪽 옆벽 유리 정면·정문 양문, 뒷벽 가운데 큰 엘리베이터, 천장 없음).
배경 2배 = 1264×848. 좌표는 4배·3배 격자로 그림을 보고 읽은 1x 값(±1px).
- 정문: 옆벽(원근) 유리 양문 → quad + glow(비스듬한 문은 문짝 대신 바깥 빛이 번진다, hqField.ts). 나가면 거리.
- 엘리베이터: 문짝 안쪽 281~379 · y139~300, 가운데 이음 330 → slide2(두 짝 미닫이) + 칸(car). 협회 건물 층만 고른다(map.ts ELEVATOR bldg 'sdra').
- 바닥 윗선: 옆벽 유리 아랫선(0,394)→(182,302), 뒷벽 밑선 y303. 벽에 붙은 물건(쓰레기통·우산꽂이·키오스크)은 바닥선이 그 앞 모서리+2 밑을 옆 ±12px 여유로 돈다(가림 없음, 사용자 11-01 규칙).
출력: game-src/mapedit/sdra_lobby/ → python3 tools/mapedit/import.py game-src/mapedit/sdra_lobby sdra_lobby"""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'game-src/art/pixellab-hq-20261031'
OUT = ROOT / 'game-src/mapedit/sdra_lobby'
OUT.mkdir(parents=True, exist_ok=True)
K = 2
orig = Image.open(ART / 'sdra_f1_keep.png').convert('RGB')
W, H = orig.width * K, orig.height * K
orig.save(OUT / 'sdra_f1.png')

WALL = 303  # 뒷벽 밑선(1x)
floor = [
    [0, 394], [171, 308],            # 옆벽 유리 아랫선, 쓰레기통 왼쪽 여유까지
    [171, 310], [272, 310], [272, WALL],  # 쓰레기통(183~260, 앞 모서리 308)
    [388, WALL], [388, 310], [459, 310], [459, WALL],  # 우산꽂이(400~447, 앞 308)
    [548, WALL], [548, 312], [627, 312], [627, WALL],  # 키오스크(560~615, 앞 310)
    [632, WALL], [632, 424], [0, 424],
]
def door(x0, x1, y0, y1, **kw): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, **kw}
MAIN_QUAD = [(53, 92), (150, 121), (150, 318), (53, 360)]  # 옆벽 정문 유리 양문 바깥 틀(왼위·오위·오아래·왼아래)
doors = {
    'main': {'kind': 'glass', 'x': 105 * K, 'y': 345 * K, 'to': 'street', 'toDoor': 'sdra', 'label': '정문',
             'door': door(53, 150, 92, 360, anim='glow', quad=[[x * K, y * K] for x, y in MAIN_QUAD])},
    'elev': {'kind': 'elevator', 'x': 330 * K, 'y': 312 * K, 'label': '엘리베이터',
             'door': door(281, 379, 139, 300, anim='slide2', seam=330 * K, behind='car')},
}
m = {'file': 'sdra_f1', 'bgScale': K, 'w': W, 'h': H, 'under': False,
     'floor': [[x * K, y * K] for x, y in floor], 'lane': [WALL * K, 423 * K],
     'blocks': [], 'doors': doors, 'lamps': [], 'spots': [], 'objects': []}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H)
