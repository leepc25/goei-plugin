"""중림 뒷골목(jr_alley) 장면 원본 만들기 (사용자 10-31 「앞뒤 확정하고 작업해」).
확정본 6칸: 헐값매입 v5 · 대한안전 v3 · 동방레저 v1 · 셔터+통로 v2 · 막잔 v2 · 진성약업사 v7b (632×424씩 이어 붙임, 만물상회는 뺌)
+ 이음선 5곳에 뒷골목 앞 기둥 v3(정면만). 배경 2배 = 7584×848.
걷는 바닥은 가게 앞 물건 바닥선보다 앞(y690~848). 왼쪽 끝은 ① 옆벽(셔터), 오른쪽 끝은 진성약업사 철망 앞까지.
출력: game-src/mapedit/jr_alley/ → python3 tools/mapedit/import.py game-src/mapedit/jr_alley jr_alley"""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
A = ROOT / 'game-src/art/pixellab-test-20261028'
OUT = ROOT / 'game-src/mapedit/jr_alley'; OUT.mkdir(parents=True, exist_ok=True)
PANELS = ['jr_alley_p1_v5', 'jr_alley_p2_v3', 'jr_alley_p3_v1', 'jr_alley_p4_v2', 'jr_alley_p5_v2', 'jr_alley_p7_v7b']
PW, K = 632, 2
strip = Image.new('RGB', (PW * len(PANELS), 424))
for i, n in enumerate(PANELS): strip.paste(Image.open(A / f'{n}_632x424.png').convert('RGB'), (PW * i, 0))
strip.save(OUT / 'jr_alley_strip.png')
W, H = strip.width * K, 848
FLOOR_Y = 690
X0, X1 = 60 * K, (PW * 5 + 575) * K          # 왼쪽 옆벽 밑동·오른쪽 철망 앞까지만
objects = []
for i in range(1, len(PANELS)):
    n = (i - 1) % 5 + 1
    pl = Image.open(A / f'jr_pillar5_alley_v3_front_{n}.png'); pl.save(OUT / f'pillar{n}.png')
    w = pl.width * K
    objects.append({'id': f'pillar{i}', 'name': f'앞 기둥 {i}', 'file': f'pillar{n}', 'x': PW * i * K - w // 2, 'y': 0, 'w': w, 'h': H, 'sortY': 9999})
def door(x0, x1, y0, y1): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'anim': 'none', 'behind': 'dark'}
def at(i, x): return PW * i + x
doors = {
    'heolgap': {'kind': 'door', 'x': at(0, 266) * K, 'y': FLOOR_Y + 10, 'to': 'jr_heolgap', 'toDoor': 'out', 'label': '헐값 매입', 'door': door(at(0, 233), at(0, 300), 125, 290)},
    'b1': {'kind': 'door', 'x': at(3, 381) * K, 'y': FLOOR_Y + 10, 'to': 'jr_b1', 'toDoor': 'alley', 'label': '앞골목', 'door': door(at(3, 311), at(3, 452), 128, 312)},
}
m = {'file': 'jr_alley_strip', 'bgScale': K, 'w': W, 'h': H, 'under': True,
     'floor': [[X0, FLOOR_Y], [X1, FLOOR_Y], [X1, H], [X0, H]], 'lane': [FLOOR_Y, H - 12],
     'blocks': [], 'doors': doors, 'lamps': [], 'spots': [], 'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, len(objects), list(doors))
