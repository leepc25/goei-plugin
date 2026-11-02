"""특수재난대응협회 2층 창구 장면 원본 (2026-11-02, 사용자 13:30 「이걸로 킵하고 따기 진행해」).
그림: game-src/art/pixellab-hq-20261031/sdra_counter_p7_ext1L_v2.png (952×424, p7 + 왼쪽 잇기 v2). 배경 2배 = 1904×848.
바닥 윗선(1배, 4배 격자·픽셀 값으로 읽음): 창구 밑 검은 윤곽 y314 → 바닥 316, 칸막이 기둥(519~528, 743~752) 밑 326 → 328,
창구 왼쪽 끝판(272~292) 밑 324 → 326, 왼쪽 통로 앞줄 물건 밑: 책장 0~108 y299→301, 파란 상자 108~165 y298→300,
종이 상자 165~218 y295→297, 서랍장 앞 218~272 → 300. 왼쪽 끝 = 출입구(사용자 13:? 핀 「출입구는 이쪽」).
대기의자 C06 셋(오브젝트, game-src/action/objects/C06_대기의자_3인): 창구 세 칸 앞 x 800/1270/1700(2배), 다리 바닥 y835, 그림 1배×1.5.
의자는 바닥 한가운데 물건 → 그림(오브젝트, sortY=다리 바닥)으로 앞뒤 가림, 막힘 = 다리 자국(뒷다리 y96~앞다리 y124) ±12.
창구 직원 자리 3(창구 뒤, 걷기 불가 구역 — 앉은 채로만): 서윤지·차여진 고정, 오른쪽 = 협회 직원 돌림.
출력: game-src/mapedit/sdra_counter/ → python3 tools/mapedit/import.py game-src/mapedit/sdra_counter sdra_counter"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/art/pixellab-hq-20261031/sdra_counter_p7_ext1L_v2.png'
BENCH = ROOT / 'game-src/action/objects/C06_대기의자_3인/north.png'
OUT = ROOT / 'game-src/mapedit/sdra_counter'; OUT.mkdir(parents=True, exist_ok=True)
K = 2
im = Image.open(SRC).convert('RGB'); im.save(OUT / 'sdra_counter.png')
W, H = im.width * K, im.height * K
# 바닥 윗선 (1배 x0, x1, y)
TOP = [(0, 108, 301), (108, 165, 300), (165, 218, 297), (218, 272, 300), (272, 292, 326), (292, 519, 316),
       (519, 529, 328), (529, 743, 316), (743, 753, 328), (753, 952, 316)]
poly = []
for x0, x1, y in TOP: poly += [[x0 * K, y * K], [x1 * K, y * K]]
floor = [[0, H]] + poly + [[W, H]]
# 대기의자
BSC = 1.5; BXS = [800, 1270, 1700]; FOOT_Y = 835
b = Image.open(BENCH).convert('RGBA'); bw, bh = round(b.width * BSC), round(b.height * BSC)
bimg = b.resize((bw, bh), Image.NEAREST); bimg.save(OUT / 'sdra_counter_bench.png')
sm = Image.new('L', b.size, 0); ImageDraw.Draw(sm).rounded_rectangle((10, 98, 212, 125), radius=10, fill=int(255 * 0.45))
sh = Image.new('RGBA', b.size, (40, 32, 26, 0)); sh.putalpha(sm.filter(ImageFilter.GaussianBlur(3)))
sh.resize((bw, bh), Image.NEAREST).save(OUT / 'sdra_counter_bench_shadow.png')
objects, blocks, spots = [], [], []
SEATS = [(40, 61), (111.5, 61), (183.5, 61)]   # 잘라낸 판 1배: 좌석 점(사무의자 north 좌석 점과 같은 뜻)
for i, bx in enumerate(BXS):
    ox, oy = round(bx - 110.5 * BSC), round(FOOT_Y - 124 * BSC)
    objects.append({'id': f'bench{i+1}_shadow', 'file': 'sdra_counter_bench_shadow.png', 'x': ox, 'y': oy, 'w': bw, 'h': bh, 'sortY': 0, 'kind': 'shadow'})
    objects.append({'id': f'bench{i+1}', 'file': 'sdra_counter_bench.png', 'x': ox, 'y': oy, 'w': bw, 'h': bh, 'sortY': FOOT_Y, 'kind': 'chair'})
    x0, x1 = round(ox + 13 * BSC) - 12, round(ox + 210 * BSC) + 12; y0 = round(oy + 96 * BSC)
    blocks.append({'poly': [[x0, y0], [x1, y0], [x1, H], [x0, H]], 'h': 999})
    for j, (sx, sy) in enumerate(SEATS):
        x = round(ox + sx * BSC)
        spots.append({'id': f'wait{i+1}_{j+1}', 'x': x, 'y': FOOT_Y, 'shared': True, 'verb': '앉기', 'face': 1, 'act': ['sit_back'],
                      'seat': {'x': x, 'y': FOOT_Y}, 'bench': 'C06', 'seatPt': {'x': x, 'y': round(oy + sy * BSC)}})
# 창구 직원 자리(창구 뒤, 사무의자 C01 정면, 2배 x·바닥 y, 미리보기 tools/objects/sdra_counter_sit_preview.py 값)
for sid, x, who in [('clerk1', 914, '서윤지'), ('clerk2', 1274, '차여진'), ('clerk3', 1704, None)]:
    spots.append({'id': sid, 'x': x, 'y': 555, **({'owner': who} if who else {'owner_pool': '협회 직원'}), 'verb': '앉기', 'face': 0,
                  'act': ['sit_front'], 'seat': {'x': x, 'y': 555}, 'chairImg': 'south-east.png', 'staffOnly': True, 'scale': 1.2})
doors = {'out': {'kind': 'exit', 'side': 'W', 'x': 24, 'y': 720, 'to': 'sdra_f2', 'toDoor': 'office', 'label': '복도로'}}
m = {'file': 'sdra_counter', 'bgScale': K, 'w': W, 'h': H, 'under': False, 'floor': floor, 'lane': [min(p[1] for p in poly), H - 12],
     'blocks': blocks, 'doors': doors, 'lamps': [], 'spots': spots, 'objects': objects,
     'note': '사람 배율: 대기의자에 앉은 사람 1.6(다리 바닥 y835), 창구 직원 1.2(바닥 555). 서 있는 사람 배율 표는 필드 연결 때 정함.'}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, len(blocks), len(spots), len(objects))
