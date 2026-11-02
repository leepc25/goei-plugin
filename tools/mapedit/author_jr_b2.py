"""중림 지하 2층(jr_b2) 장면 원본 만들기 (사용자 10-31 「이걸로 쓰고 작업해」).
5칸: ① 영창(창고 B-7) v10 · ② 청운기원 v3 · ③ 제일전당포 v2 · ④ 천수보살 v2 · ⑤ 황금오락실+B1 계단 v2 (632×424씩 이어 붙임)
+ 이음선 4곳에 앞 기둥(뒷골목 v3 정면을 지하 2층 벽 색으로 보정, tools/pixellab/pillar_tone_b2.py). 배경 2배 = 6320×848.
걷는 바닥 y690~848. 왼쪽 끝은 ① 막힌 계단 난간 앞까지, 오른쪽 끝은 ⑤ 올라가는 계단 입구 앞까지.
출력: game-src/mapedit/jr_b2/ → python3 tools/mapedit/import.py game-src/mapedit/jr_b2 jr_b2"""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
A = ROOT / 'game-src/art/pixellab-test-20261028'
OUT = ROOT / 'game-src/mapedit/jr_b2'; OUT.mkdir(parents=True, exist_ok=True)
PANELS = ['jr_b2_p1_v10', 'jr_b2_p2_v3', 'jr_b2_p3_v2', 'jr_b2_p4_v2', 'jr_b2_p5_v2']
PW, K = 632, 2
strip = Image.new('RGB', (PW * len(PANELS), 424))
for i, n in enumerate(PANELS): strip.paste(Image.open(A / f'{n}_632x424.png').convert('RGB'), (PW * i, 0))
strip.save(OUT / 'jr_b2_strip.png')
W, H = strip.width * K, 848
FLOOR_Y = 690
def at(i, x): return PW * i + x
X0, X1 = 150 * K, at(4, 620) * K          # ① 계단 난간 앞 ~ ⑤ 계단 입구(문 E 자리까지 걸어감)
objects = []
for i in range(1, len(PANELS)):
    pl = Image.open(A / f'jr_pillar5_b2_tone_front_{i}.png'); pl.save(OUT / f'pillar{i}.png')
    w = pl.width * K
    objects.append({'id': f'pillar{i}', 'name': f'앞 기둥 {i}', 'file': f'pillar{i}', 'x': PW * i * K - w // 2, 'y': 0, 'w': w, 'h': H, 'sortY': 9999})
def door(x0, x1, y0, y1): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'anim': 'none', 'behind': 'dark'}
doors = {
    'youngchang': {'kind': 'steel', 'x': at(0, 315) * K, 'y': FLOOR_Y + 10, 'to': 'jr_youngchang', 'toDoor': 'out', 'label': '창고 B-7 (영창 컨설팅)', 'door': door(at(0, 272), at(0, 358), 145, 307)},
    'up': {'kind': 'door', 'x': at(4, 535) * K, 'y': FLOOR_Y + 10, 'to': 'jr_b1', 'toDoor': 'down', 'label': '지하 1층으로', 'door': door(at(4, 545), at(4, 632), 80, 330)},
}
m = {'file': 'jr_b2_strip', 'bgScale': K, 'w': W, 'h': H, 'under': True,
     'floor': [[X0, FLOOR_Y], [X1, FLOOR_Y], [X1, H], [X0, H]], 'lane': [FLOOR_Y, H - 12],
     'blocks': [], 'doors': doors, 'lamps': [], 'spots': [], 'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, len(objects), list(doors))
