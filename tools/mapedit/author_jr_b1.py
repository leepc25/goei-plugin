"""중림 앞골목(jr_b1) 장면 원본 만들기 (사용자 10-31 「앞골목 확정하고 작업해」).
확정본: ① v10 ② v6 ③ v2 ④ v1 ⑤ v2 ⑥ v2 ⑦ v2 (632×424씩 자르지 않고 이어 붙임, 사용자 「좁히지 말고」) + 이음선 6곳에 앞 기둥 1~4번.
배경 2배 = 8848×848. 걷는 바닥은 가게 앞 물건들의 바닥선(그림 y 약 345)보다 앞만 → 물건 가림·막힘이 필요 없음.
기둥은 화면 맨 앞(사람은 항상 기둥 뒤로 지나감).
출력: game-src/mapedit/jr_b1/ (map.json + 그림) → python3 tools/mapedit/import.py game-src/mapedit/jr_b1 jr_b1"""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
A = ROOT / 'game-src/art/pixellab-test-20261028'
OUT = ROOT / 'game-src/mapedit/jr_b1'; OUT.mkdir(parents=True, exist_ok=True)
PANELS = ['jr_b1_p1_v10', 'jr_b1_p2_v6', 'jr_b1_p3_v2', 'jr_b1_p4_v1', 'jr_b1_p5_v2', 'jr_b1_p6_v2', 'jr_b1_p7_v2']
PW, K = 632, 2
strip = Image.new('RGB', (PW * len(PANELS), 424))
for i, n in enumerate(PANELS): strip.paste(Image.open(A / f'{n}_632x424.png').convert('RGB'), (PW * i, 0))
strip.save(OUT / 'jr_b1_strip.png')
W, H = strip.width * K, 848
FLOOR_Y = 690                                   # 그림 y345 × 2: 가게 앞 물건 바닥선보다 앞
objects = []
for i in range(1, len(PANELS)):
    n = (i - 1) % 4 + 1
    pl = Image.open(A / f'jr_pillar4_v1_{n}.png'); pl.save(OUT / f'pillar{n}.png')
    w = pl.width * K
    objects.append({'id': f'pillar{i}', 'name': f'앞 기둥 {i}', 'file': f'pillar{n}', 'x': PW * i * K - w // 2, 'y': 0, 'w': w, 'h': H, 'sortY': 9999})
def door(x0, x1, y0, y1):                       # 그림(632 기준, 칸 i) 좌표 → 게임 좌표
    return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'anim': 'none', 'behind': 'dark'}
def at(i, x): return PW * i + x
doors = {
    'up': {'kind': 'door', 'x': at(0, 50) * K, 'y': FLOOR_Y + 10, 'to': 'jr_entry', 'toDoor': 'down', 'label': '지상으로', 'door': door(at(0, 0), at(0, 100), 60, 330)},
    'daebak': {'kind': 'glass', 'x': at(3, 310) * K, 'y': FLOOR_Y + 10, 'to': 'jr_daebak', 'toDoor': 'out', 'label': '대박 알선', 'door': door(at(3, 275), at(3, 345), 130, 318)},
    'alley': {'kind': 'door', 'x': at(4, 458) * K, 'y': FLOOR_Y + 10, 'to': 'jr_alley', 'toDoor': 'b1', 'label': '뒷골목', 'door': door(at(4, 388), at(4, 528), 95, 305)},
    'songil': {'kind': 'glass', 'x': at(6, 312) * K, 'y': FLOOR_Y + 10, 'to': 'jr_songil', 'toDoor': 'out', 'label': '손길 의원', 'door': door(at(6, 275), at(6, 350), 110, 318)},
    'down': {'kind': 'door', 'x': at(6, 565) * K, 'y': FLOOR_Y + 10, 'to': 'jr_b2', 'toDoor': 'up', 'label': '지하 2층으로', 'door': door(at(6, 495), at(6, 632), 190, 345)},
}
m = {'file': 'jr_b1_strip', 'bgScale': K, 'w': W, 'h': H, 'under': True,
     'floor': [[0, FLOOR_Y], [W, FLOOR_Y], [W, H], [0, H]], 'lane': [FLOOR_Y, H - 12],
     'blocks': [], 'doors': doors, 'lamps': [], 'spots': [], 'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, len(objects), 'doors', list(doors))
