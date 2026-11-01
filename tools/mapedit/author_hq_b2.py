"""관리국 본부 지하 2층(b2) 장면 원본 만들기 (2026-11-01, 사용자 「지하 2층 저걸로 확정」).
그림: game-src/art/pixellab-hq-20261031/hq_b2_v3_ext2L.png (1206×424 = 첫 판 p21 + 왼쪽 잇기 1(복도) + 잇기 2(격리실 큰 문, 겹침 60px 다시)). 배경 2배 = 2412×848.
그림 아래 y≈390부터는 바닥 없는 어두운 띠 → 걷는 띠는 y328~386(1x).
문(1x, 격자 확대로 읽은 틀 바깥선): 격리시설 방폭문 55~256·y129~326, 격리팀 사무실(의무실·연구실) 철문 650~742·y157~318, 엘리베이터 835~945·y160~318.
심문실·창고·서고는 없앰(인계 결정 10-31 본부 최소화).
출력: game-src/mapedit/b2/ → python3 tools/mapedit/import.py game-src/mapedit/b2 b2"""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/art/pixellab-hq-20261031/hq_b2_v3_ext2L.png'
OUT = ROOT / 'game-src/mapedit/b2'; OUT.mkdir(parents=True, exist_ok=True)
K = 2
im = Image.open(SRC).convert('RGB'); im.save(OUT / 'hq_b2_strip.png')
W, H = im.width * K, im.height * K
FLOOR_Y = 328 * K
LANE_BOT = 386 * K
X0, X1 = 10 * K, 1200 * K
def door(x0, x1, y0, y1, anim='none'): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'anim': anim, 'behind': 'dark'}
doors = {
    'isolation': {'kind': 'cell', 'x': 156 * K, 'y': FLOOR_Y + 10, 'to': 'tooth', 'toDoor': 'out', 'label': '격리시설', 'door': door(55, 256, 129, 326)},
    'clinic': {'kind': 'steel', 'x': 696 * K, 'y': FLOOR_Y + 10, 'to': 'clinic', 'toDoor': 'out', 'label': '격리팀 사무실', 'door': door(650, 742, 157, 318)},
    'elev': {'kind': 'elevator', 'x': 890 * K, 'y': FLOOR_Y + 10, 'label': '엘리베이터', 'door': door(835, 945, 160, 318)},
}
# 11-01 09:12 사용자 「벽·바닥 연결선·못 가는 곳을 픽셀 단위로」: 바닥 윗선 = 기둥마다 위로 올라가 처음 만나는 검은 윤곽선(벽·벽에 붙은 기계 아래 끝),
# 바닥 아랫선 = 그림 아래 어두운 띠(53,46,47)가 시작하는 y 바로 위. tools/mapedit/outline_trace.py
import sys; sys.path.insert(0, str(ROOT / 'tools/mapedit'))
from outline_trace import floor_line
line = floor_line(im, 360, thr=45)
px = im.load()
band = [next(y for y in range(360, im.height) if px[x, y] == (53, 46, 47)) for x in range(im.width)]
LANE_BOT = (min(band) - 2) * K
top = [(x, line[x]) for x in range(10, 1200)]
pts = [top[0]]
for i in range(1, len(top)):
    if top[i][1] != top[i - 1][1]: pts += [(top[i][0], top[i - 1][1]), top[i]]
pts += [(1200, line[1199]), (1200, min(band) - 1), (10, min(band) - 1)]
FLOOR = [[x * K, y * K] for x, y in pts]
m = {'file': 'hq_b2_strip', 'bgScale': K, 'w': W, 'h': H, 'under': False,
     'floor': FLOOR, 'lane': [min(line[10:1200]) * K, LANE_BOT],
     'blocks': [], 'doors': doors, 'lamps': [], 'spots': [], 'objects': []}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, list(doors))
