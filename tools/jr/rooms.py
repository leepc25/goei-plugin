"""중림 가게 안 방 6개: GPT 빈 방 배경을 1m = 142px로 맞추고(세로는 그대로), GPT 가구(원본 해상도)를 실제 크기로 줄여 오브젝트로 만든다.
좌표는 모두 원본 배경 px로 적고 s를 곱한다. 결과: game-pack/jr-field/jr_<방>.webp, jo_<방>_<번호>.webp, 그리고 src/game/action/hq/jrRooms.gen.ts.
사용: python3 tools/jr/rooms.py <jungnim_interiors 압축 푼 폴더> <수술실 png>
"""
import json, sys
from pathlib import Path
from PIL import Image

Z = Path(sys.argv[1]); OP = Path(sys.argv[2])
OUT = Path('game-pack/jr-field'); MASTER = Path('game-src/art/field/jr')
PX = 142  # 맨 뒤 줄 1m

def bg(name):
    names = {'daebak': '#Ub300#Ubc15#Uc54c#Uc120.png', 'jinryo': '#Uc190#Uae38#Uc758#Uc6d0 #Uc9c4#Ub8cc#Uc2e4.png', 'songil': '#Uc190#Uae38#Uc758#Uc6d0.png',
             'youngchang': '#Uc601#Ucc3d#Ucee8#Uc124#Ud305.png', 'heolgap': '#Ud5d0#Uac12#Ub9e4#Uc785.png'}
    return Image.open(OP if name == 'op' else Z / 'backgrounds' / names[name]).convert('RGB')

# 방: s(축척), wall(뒷벽 바닥선), doors{id: (anim, rect 또는 quad, hinge)}, floor, blocks[(x0,x1,앞y,높이)], objs[(가구, 방향, 가운데x, 앞y, 실제 폭 m, 깊이 m, 높이 m)]
ROOMS = {
  'songil': dict(s=0.92, wall=440,
    doors={'out': ('none', [[20, 75], [200, 90], [200, 465], [20, 500]]), 'jinryo': ('swing', (1245, 1400, 110, 435), 'R'),
           'wc': ('swing', (1473, 1627, 110, 435), 'R'), 'store': ('swing', (1705, 1855, 110, 435), 'R'),
           'op': ('none', [[1985, 145], [2095, 125], [2095, 540], [1985, 480]])},
    floor=[[0, 510], [236, 452], [1955, 452], [2172, 565], [2172, 724], [0, 724]],
    blocks=[(425, 500, 452, 120)],
    objs=[('songil_reception_counter', 'S', 900, 500, 2.4, 0.7, 1.1), ('songil_reception_chair', 'S', 900, 468, 0.65, 0.5, 1.0),
          ('songil_bench_teal', 'S', 420, 580, 1.7, 0.5, 0.8), ('songil_bench_ivory', 'S', 700, 580, 1.7, 0.5, 0.8)]),
  'jinryo': dict(s=0.76, wall=540,
    doors={'out': ('none', [[40, 60], [200, 115], [200, 580], [40, 640]])},
    floor=[[0, 660], [280, 552], [1590, 552], [1880, 650], [1880, 837], [0, 837]],
    blocks=[(1000, 1375, 560, 160), (1400, 1530, 560, 300), (1590, 1830, 650, 999)],
    objs=[('songil_doctor_desk', 'S', 560, 630, 1.4, 0.7, 0.75), ('songil_doctor_chair', 'N', 560, 700, 0.6, 0.5, 1.0),
          ('songil_patient_chair', 'E', 330, 680, 0.5, 0.5, 0.85), ('songil_exam_bed', 'E', 1180, 760, 1.9, 0.7, 0.7)]),
  'op': dict(s=0.76, wall=500,
    doors={'out': ('none', [[45, 73], [215, 100], [215, 527], [45, 590]])},
    floor=[[0, 620], [300, 510], [1810, 510], [1832, 520], [1832, 859], [0, 859]],
    blocks=[(385, 690, 515, 200), (690, 1240, 620, 130), (415, 690, 645, 120), (1265, 1495, 645, 120), (1080, 1175, 535, 300), (1215, 1810, 520, 300)],
    objs=[('songil_surgery_stool', 'S', 1110, 700, 0.45, 0.45, 0.6)]),
  'youngchang': dict(s=0.74, wall=530,
    doors={'out': ('none', [[60, 50], [365, 70], [365, 545], [60, 580]])},
    floor=[[0, 610], [370, 548], [500, 538], [1712, 538], [1712, 919], [0, 919]],
    blocks=[(1350, 1712, 585, 999)],
    objs=[('youngchang_chair_owner', 'S', 900, 640, 0.7, 0.6, 1.1), ('youngchang_desk', 'S', 900, 720, 1.5, 0.75, 0.78),
          ('youngchang_chair_customer', 'N', 900, 810, 0.5, 0.5, 0.9)]),
  'daebak': dict(s=1.07, wall=378,
    doors={'out': ('none', [[25, 35], [205, 55], [205, 440], [25, 475]])},
    floor=[[0, 485], [210, 450], [605, 384], [2172, 384], [2172, 724], [0, 724]],
    blocks=[(1180, 1460, 505, 999), (2110, 2172, 600, 999), (240, 300, 410, 200), (600, 750, 380, 200), (740, 950, 384, 120)],
    objs=[('daebak_sofa', 'S', 470, 470, 2.1, 0.9, 0.85), ('daebak_coffee_table', 'S', 470, 560, 1.2, 0.6, 0.45),
          ('daebak_reception_chair', 'S', 900, 450, 0.65, 0.6, 1.1), ('daebak_reception_counter', 'S', 900, 540, 2.4, 0.7, 1.05),
          ('daebak_poker_chair_ochre', 'S', 1790, 520, 0.6, 0.6, 1.0), ('daebak_poker_chair_red', 'E', 1560, 610, 0.6, 0.6, 1.0),
          ('daebak_poker_chair_tan', 'W', 2030, 610, 0.6, 0.6, 1.0), ('daebak_poker_table', 'S', 1790, 610, 2.0, 1.1, 0.8),
          ('daebak_poker_chair_green', 'N', 1790, 700, 0.6, 0.6, 1.0)]),
  'heolgap': dict(s=0.85, wall=445,
    doors={'out': ('none', [[30, 40], [225, 75], [225, 540], [30, 600]])},
    floor=[[0, 620], [300, 452], [1953, 452], [1953, 805], [0, 805]],
    blocks=[(500, 1265, 655, 160), (1560, 1953, 720, 999), (315, 545, 535, 999), (1405, 1600, 495, 999)],
    objs=[('heolgap_chair', 'N', 615, 770, 0.55, 0.5, 1.0), ('heolgap_chair', 'N', 1225, 770, 0.55, 0.5, 1.0)]),
}

man = {a['id']: a for a in json.load(open(Z / 'manifest.json'))['assets']}
gen = {}
for room, R in ROOMS.items():
    s = R['s']; im = bg(room)
    W, H = round(im.width * s), round(im.height * s)
    big = im.resize((W, H), Image.LANCZOS)
    MASTER.mkdir(parents=True, exist_ok=True)
    big.save(MASTER / f'jr_{room}.webp', 'WEBP', lossless=True, method=6)
    big.save(OUT / f'jr_{room}.webp', 'WEBP', quality=85, method=6)
    S = lambda v: round(v * s)
    wall = S(R['wall']); bot = H - 20
    lane = [wall + 10, bot]
    kAt = lambda y: 1 + 0.18 * max(0, min(1, (y - wall) / max(1, bot - wall)))
    doors = {}
    for did, d in R['doors'].items():
        if isinstance(d[1], list):
            q = [[S(x), S(y)] for x, y in d[1]]
            doors[did] = dict(x0=min(p[0] for p in q), x1=max(p[0] for p in q), y0=min(p[1] for p in q), y1=max(p[1] for p in q), anim=d[0], quad=q, behind='dark')
        else:
            x0, x1, y0, y1 = (S(v) for v in d[1])
            doors[did] = dict(x0=x0, x1=x1, y0=y0, y1=y1, anim=d[0], behind='dark', **({'hinge': d[2]} if len(d) > 2 else {}))
    objs = []
    for i, (aid, v, cx, fy, wm, dm, hm) in enumerate(R['objs']):
        cx, fy = S(cx), S(fy)
        o = Image.open(Z / man[aid]['views'][v]['original_png']).convert('RGBA')
        bb = o.getbbox(); o = o.crop(bb)
        k = kAt(fy)
        # 그림 폭 = 실제 폭(S) 또는 깊이(E·W 옆모습). 옆모습은 윗면이 보여 폭이 깊이보다 조금 넓다
        side = v in ('E', 'W')
        w = round((dm * 1.25 if side else wm) * PX * k) if aid != 'songil_exam_bed' else round(wm * PX * k)
        h = round(o.height * w / o.width)
        o = o.resize((w, h), Image.LANCZOS)
        f = f'jo_{room}_{i}'
        o.save(OUT / f'{f}.webp', 'WEBP', lossless=True, method=6)
        depth = round((wm if side and aid != 'songil_exam_bed' else dm) * 82 * k)
        objs.append(dict(id=f'o{i}', file=f, x=cx - w // 2, y=fy - h, w=w, h=h, sortY=fy,
                         solid=[dict(x0=cx - w // 2 + 4, x1=cx + w // 2 - 4, y0=fy - depth, y1=fy, h=round(hm * PX * k))]))
    gen[f'jr_{room}'] = dict(file=f'jr_{room}', w=W, h=H, under=True, lane=lane, floor=[[S(x), S(y)] for x, y in R['floor']],
                              blocks=[[S(a), S(b), S(c), d] for a, b, c, d in R['blocks']], doors=doors, lamps=[], windows=[], objects=objs)
    print(room, W, H, 'wall', wall, 'objs', [(o['file'], o['w'], o['h']) for o in objs])

files = sorted(p.stem for p in OUT.glob('jr_*.webp')) + sorted(p.stem for p in OUT.glob('jo_*.webp'))
Path('src/game/action/hq/jrRooms.gen.ts').write_text(
    '// tools/jr/rooms.py 가 만든다. 손대지 말 것: 좌표를 고치려면 rooms.py를 고쳐 다시 돌린다.\n'
    "import type { PaintedScene } from './painted';\n\n"
    f'export const JR_ROOMS: Record<string, PaintedScene> = {json.dumps(gen, ensure_ascii=False)};\n'
    f'export const JR_ROOM_FILES: string[] = {json.dumps([f for f in files if f.startswith("jo_") or f[3:] in ROOMS])};\n')
