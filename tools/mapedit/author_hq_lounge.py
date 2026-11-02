"""본부 3층 휴게실(lounge) 장면 원본 (사용자 11-02 06:07 「이대로 확정한다」).
그림: game-src/art/pixellab-hq-20261031/hq_lounge_p13s_extL5_fix.png (896×424, 배경 2배 = 1792×848).
좌표(1x)는 4~6배 확대 + 5px 격자로 윤곽선을 직접 읽었다(scratchpad zA~zF).
- 뒷벽 밑(바닥 시작): 걸레받이 아래 y290. 벽 물건 밑: 전자레인지 장 x68~143 y298, 정수기 2대 x143~221 y301,
  보라 자판기 x221~318 y303(다리), 소화기·쓰레기통 x398~500 y292, 출입문(비상구 표지 밑 유리문) 틀 x501~568 y98~287,
  흰 자판기 x563~645 y300, 싱크대 조리대 x647~835 y295, 오른쪽 분리수거함 앞 윤곽 (835,295)→(896,353).
- 테이블 3개는 배경에 그려져 있고, 오려 낸 그림(game-src/art/objects/lounge_tables)을 가림으로 다시 그린다.
  뒷다리 부분은 뒷다리 바닥(y348)에서, 나머지는 앞다리 바닥(y377)에서 정렬(앉혀 보기 v8과 같은 나눔).
- 벽에 붙은 물건은 가림 없음(사용자 규칙). 분리수거함도 벽에 붙어 뒤로 못 감 → 막힘만.
- 상호작용(사용자 06:07 확정, NPC 생활 동작): 싱크대 104 / 자판기 57→27→142 / 정수기·커피메이커 57→142 /
  전자레인지·간식 찬장 57→157 / 게시판 57 / 출입문 걸어 나감. 의자 12개 = 앉혀 보기 v8 자리.
출력: game-src/mapedit/lounge/ (map.json + 그림) → python3 tools/mapedit/import.py game-src/mapedit/lounge lounge"""
import json, os, shutil, sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/art/pixellab-hq-20261031/hq_lounge_p13s_extL5_fix.png'
TD = ROOT / 'game-src/art/objects/lounge_tables'
OUT = ROOT / 'game-src/mapedit/lounge'; OUT.mkdir(parents=True, exist_ok=True)
K = 2
im = Image.open(SRC).convert('RGB'); im.save(OUT / 'hq_lounge_strip.png')
W, H = im.width * K, im.height * K
P = lambda pts: [[x * K, y * K] for x, y in pts]
# 바닥 윗선(1x): 06:19 사용자 「픽셀 단위로 정교하게」 → 8배 격자 crop(f00~f12, zE)을 열마다 눈으로 읽고 V<70 윤곽 검사로 맞춘 값.
# 값 = 그 열의 가장 아래 검은 윤곽 y + 1 (발이 윤곽 바로 밑). 구간 (x0, x1, y) 또는 열별 목록.
SEG = [(0, 68, 293),            # 걸레받이 밑 검은 줄 y292
       (69, 142, 301),          # 전자레인지 장 밑 y300(테이블1 뒤까지 같은 선)
       (143, 219, 303),         # 정수기 2대 밑 y302
       (220, 223, 293),         # 정수기·자판기 사이 벽
       (224, 224, 302), (225, 226, 303), (227, 227, 305), (228, 234, 306), (235, 235, 305),   # 보라 자판기 왼발
       (236, 298, 303),         # 자판기 밑판 y302
       (299, 299, 305), (300, 305, 306), (306, 306, 305),                                      # 오른발
       (307, 307, 303), (308, 308, 302), (309, 309, 301), (310, 310, 300), (311, 311, 299), (312, 312, 298),
       (313, 313, 297), (314, 314, 296), (315, 315, 294),                                      # 오른쪽 비스듬한 모서리
       (316, 394, 292),         # 벽 y291
       (395, 504, 293),         # 소화기·쓰레기통(테이블2 뒤) 밑 y292
       (505, 564, 292),         # 출입문 문턱 y290~291
       (565, 644, 300),         # 흰 자판기 밑 y299
       (645, 646, 297),         # 자판기·조리대 사이 모서리
       (647, 816, 300),         # 조리대 밑 y299
       (817, 835, 299), (836, 837, 298)]
BINS = [308, 314, 315, 316, 317, 317, 317, 320, 321, 322, 322, 323, 324, 324, 325, 326, 327, 327, 327, 327, 327, 327, 330, 331, 332, 333,
        333, 334, 335, 335, 336, 336, 337, 338, 338, 338, 338, 338, 338, 338, 342, 343, 344, 345, 346, 346, 347, 348, 348, 349, 350, 350,
        351, 351, 351, 351, 351, 351]   # x838~895 분리수거함 앞 밑 윤곽 y (zE 6배 눈 읽기 + 검사 일치)
top = [None] * 896
for x0, x1, y in SEG:
    for x in range(x0, x1 + 1): top[x] = y
for i, y in enumerate(BINS): top[838 + i] = y + 1
assert None not in top, [i for i, v in enumerate(top) if v is None]
pts, prev = [], None
for x in range(896):
    if top[x] != prev:
        if prev is not None: pts.append((x, prev))
        pts.append((x, top[x])); prev = top[x]
pts.append((896, prev))
floor = P(pts + [(896, 424), (0, 424)])
# 테이블 = 올라설 수 있는 발판(사용자 06:14 「올라가게 잡아」). 바닥 자리 = 상판이 덮는 바닥(뒷다리 y348~앞다리 y377, 상판 좌우 끝),
# 높이 = 앞다리 바닥 y377 - 상판 앞끝 윗면 y302 = 75(1x) → 150(2x). import.py가 h<400이면 발판(solid)으로 굽는다.
TOP_H = (377 - 302) * K
# 06:18 사용자 「왜 갑자기 이렇게 바뀌었어」: 네모 하나로 잡아 다리 밖까지 번짐 → 다리 바닥 사다리꼴(뒤 y348, 앞 y377)을
# 얇은 띠 6줄로 쌓아 비스듬함을 따름. 띠는 테이블 앞쪽 그림(object)의 solid로 넣는다(게임 solid = 네모 목록).
LEGS = {'table1': ((120, 203), (85, 183)), 'table2': ((420, 504), (386, 483)), 'table3': ((671, 755), (692, 789))}   # (뒤 좌우), (앞 좌우)
NSTRIP = 29   # 뒤 y348~앞 y377 한 줄씩(픽셀 단위)
def strips(n):
    (bl, br), (fl, fr) = LEGS[n]; out = []
    for i in range(NSTRIP):
        y0 = 348 + (377 - 348) * i / NSTRIP; y1 = 348 + (377 - 348) * (i + 1) / NSTRIP; t = (i + 0.5) / NSTRIP
        out.append({'x0': round((bl + (fl - bl) * t) * K), 'x1': round((br + (fr - br) * t) * K), 'y0': round(y0 * K), 'y1': round(y1 * K), 'h': TOP_H})
    return out
blocks = []
TM = json.loads((TD / 'tables.json').read_text())
BACKLEG = {'table1': [(120, 128, 308, 348), (197, 203, 296, 348)], 'table2': [(420, 427, 308, 348), (498, 504, 295, 348)],
           'table3': [(671, 677, 294, 348), (748, 755, 308, 348)]}
objects = []
for n, t in TM.items():
    src = Image.open(TD / f'{n}.png').convert('RGBA'); tb = Image.new('RGBA', src.size, (0, 0, 0, 0)); tf = src.copy()
    for x0, x1, y0, y1 in BACKLEG[n]:
        box = (x0 - t['x'], y0 - t['y'], x1 - t['x'] + 1, y1 - t['y'] + 1)
        tb.paste(src.crop(box), box[:2]); tf.paste((0, 0, 0, 0), box)
    tb.save(OUT / f'{n}_back.png'); tf.save(OUT / f'{n}_front.png')
    for part, sy in (('back', 348), ('front', 377)):
        objects.append({'id': f'{n}_{part}', 'file': f'{n}_{part}.png', 'x': t['x'] * K, 'y': t['y'] * K,
                        'w': src.width * K, 'h': src.height * K, 'sortY': sy * K, **({'solid': strips(n)} if part == 'front' else {})})
door = lambda x0, x1, y0, y1: {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'anim': 'none', 'behind': 'dark'}
doors = {'out': {'kind': 'glass', 'x': 534 * K, 'y': 296 * K, 'to': 'f3', 'toDoor': 'lounge', 'label': '복도', 'door': door(504, 566, 131, 285)}}
# 의자 자리 = 앉혀 보기 v8 (tools/objects/lounge_p13_people.py) 그대로: 의자 발 y와 기준점 x(1x)
TAB = {'table1': (162, 134, 82, 205), 'table2': (462, 434, 383, 506), 'table3': (713, 740, 669, 793)}
FB, FF, FS, TUCK = 340, 395, 371, 12
spots = []
for n, (xb, xf, xl, xr) in TAB.items():
    spots += [{'id': f'{n}_N', 'x': xb * K, 'y': FB * K, 'dir': 'front', 'face': 1, 'verb': '앉기', 'chair': 'front'},
              {'id': f'{n}_W', 'x': (xl + TUCK) * K, 'y': FS * K, 'dir': 'side', 'face': 1, 'verb': '앉기', 'chair': 'side', 'edge': 'inner'},
              {'id': f'{n}_E', 'x': (xr - TUCK) * K, 'y': FS * K, 'dir': 'side', 'face': -1, 'verb': '앉기', 'chair': 'side', 'edge': 'inner'},
              {'id': f'{n}_S', 'x': xf * K, 'y': FF * K, 'dir': 'back', 'face': 1, 'verb': '앉기', 'chair': 'back'}]
# 생활 동작 자리(1x 발 위치, 물건 정면 앞; 테이블 뒤 의자 줄 y340보다 뒤)
USE = [('microwave_L', 105, 312, [57, 157]), ('water', 200, 314, [57, 142]), ('vend_purple', 265, 318, [57, 27, 142]),
       ('board', 370, 312, [57]), ('vend_white', 604, 314, [57, 27, 142]), ('coffee', 668, 312, [57, 142]),
       ('sink', 728, 312, [104]), ('snack', 775, 312, [57, 157]), ('microwave_R', 815, 312, [57, 157])]
for sid, x, y, seq in USE:
    spots.append({'id': sid, 'x': x * K, 'y': y * K, 'verb': '쓰기', 'face': 1, 'act': ['npc_use'], 'motions': seq, 'faceDir': 'N'})
m = {'file': 'hq_lounge_strip', 'bgScale': K, 'w': W, 'h': H, 'under': True, 'floor': floor, 'lane': [290 * K, H - 12],
     'blocks': blocks, 'doors': doors, 'lamps': [], 'spots': spots, 'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, len(spots), 'spots', len(objects), 'objects')
if len(sys.argv) > 1:   # 확인 그림: 걷는 바닥(초록), 막힘(빨강), 자리(점)
    from PIL import ImageDraw
    b = im.resize((W, H), Image.NEAREST).convert('RGBA'); ov = Image.new('RGBA', b.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    d.polygon([tuple(p) for p in floor], fill=(0, 200, 80, 70), outline=(0, 160, 60, 255))
    for o in objects:
        for r in o.get('solid', []): d.rectangle((r['x0'], r['y0'], r['x1'], r['y1'] - 1), fill=(230, 40, 40, 110))
    for s in spots:
        c = (40, 120, 255, 255) if 'chair' in s else (255, 150, 0, 255)
        d.ellipse((s['x'] - 6, s['y'] - 6, s['x'] + 6, s['y'] + 6), fill=c, outline=(0, 0, 0, 255))
        if 'chair' not in s: d.text((s['x'] - 20, s['y'] + 8), s['id'], fill=(0, 0, 0, 255))
    d.rectangle((504 * K, 131 * K, 566 * K, 285 * K), outline=(255, 0, 255, 255), width=3)
    out = Image.alpha_composite(b, ov)
    for o in objects:   # 게임처럼 테이블 그림을 위에 다시 그려 깊이를 보이게
        t = Image.open(OUT / o['file']).convert('RGBA'); t = t.resize((t.width * K, t.height * K), Image.NEAREST)
        out.alpha_composite(t, (o['x'], o['y']))
    out.convert('RGB').save(sys.argv[1])
