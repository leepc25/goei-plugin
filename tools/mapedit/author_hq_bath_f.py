"""본부 B1 여자 샤워실(bath_f) 장면 원본 — 18:19 사용자 「자동 돌리지 말고 니가 하나하나 보고 찍으라고」 → 손으로 찍은 판.
그림: game-src/art/pixellab-hq-20261031/hq_bath_f_p5_extL1_heads.png (924×424). 배경 2배 = 1848×848.
6배 격자 그림(10px 눈금)으로 물건 하나하나 눈으로 읽은 테두리(1x)가 아래 OBJ 표. 자동 찾기 없음.
규칙(사용자 17:48~18:19): 겹치기(cover) 금지(뒤에 설 수 있는 주황 바구니 S 하나만 예외), 빗금 막힘 없음(S 발자국 하나만),
벽·칸막이·기둥에 붙은 물건은 바닥선이 그 밑(+2)을 돌아감(옆 ±20), 한가운데 물건은 ±12. 사용자 자리 6곳은 반드시 걸을 수 있어야 한다.
사용: python3 tools/mapedit/author_hq_bath_f.py [확인그림폴더] → game-src/mapedit/bath_f/, 이어서 import.py game-src/mapedit/bath_f bath_f"""
import base64, io, json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/art/pixellab-hq-20261031/hq_bath_f_p5_extL1_heads.png'
OUT = ROOT / 'game-src/mapedit/bath_f'
K = 2
im = Image.open(SRC).convert('RGB'); A = np.array(im).astype(int); W, H = im.size
dark = A.max(2) <= 60
wall2 = nd.binary_dilation(dark, structure=np.ones((2, 2)))

# 손으로 읽은 물건 (이름, x0, y0, x1, y1(밑 윤곽선), 종류). 종류: wall=벽·칸막이에 붙음(옆 ±20), mid=한가운데(±12), back=바닥선 뒤(격자 위)라 바닥과 무관
OBJ = [
    ('A 파란 대야(맨 왼쪽)',        0, 308,  27, 326, 'wall'),
    ('B 하늘색 받침통',             12, 298,  47, 320, 'wall'),
    ('C 노란 대야(격자 위)',        47, 283,  77, 306, 'back'),
    ('D 회색 바구니(기둥A 왼쪽)',   86, 325, 118, 365, 'wall'),
    ('E 핑크 바구니(흰 병)',       167, 328, 220, 364, 'wall'),
    ('F 노란 대야(바닥)',          218, 349, 252, 366, 'mid'),
    ('G 핑크 기운 대야',           212, 303, 243, 333, 'wall'),
    ('H 파란 바구니(병, 뒷벽)',     232, 288, 272, 322, 'wall'),
    ('I 파란 양동이(수건)',        278, 282, 307, 310, 'wall'),
    ('J 노란 바구니(격자 위)',     319, 280, 355, 306, 'back'),
    ('K 파란 대야(바닥)',          342, 323, 380, 345, 'mid'),
    ('L 회색 바구니(기둥B 왼쪽)',  373, 322, 406, 364, 'wall'),
    ('M 핑크 바구니(기둥B 오른쪽)', 461, 324, 513, 366, 'wall'),
    ('N 회청 바구니(병, 뒷벽)',     492, 290, 530, 323, 'wall'),
    ('O 보라 바구니(뒷벽 오른쪽)',  633, 288, 668, 322, 'wall'),
    ('P 파란 바구니(칸막이C)',      658, 328, 710, 367, 'wall'),
    ('Q 빨간 바구니(격자 위)',     757, 282, 793, 309, 'back'),
    ('R 하늘색 통(격자 위)',       793, 272, 838, 308, 'back'),
    ('S 주황 바구니(기둥C 오른쪽)', 757, 318, 791, 364, 'mid'),
    ('T 분홍 양동이+파란 대야(오른벽)', 889, 288, 924, 372, 'wall'),
]
PILLARS = [(118, 152, 372), (405, 437, 372), (707, 749, 372)]   # x0, x1, 발
FOOT_W, MID_W = 20, 12
SPOTS = [(268, 356), (296, 318), (527, 352), (554, 314), (610, 314), (637, 356), (785, 314)]   # 사용자 자리 6 + 기둥C 오른쪽(「여긴 왜 못 가는데」)


def lin(x0, y0, x1, y1):
    return lambda x: y0 + (x - x0) * (y1 - y0) / (x1 - x0)


# 1) 벽·칸막이 밑선(물건 없을 때 바닥 윗선)
base = np.zeros(W, int)
for x in range(W):
    if x < 118: y = 310
    elif x < 152: y = 372
    elif x < 243: y = lin(152, 372, 243, 300)(x)
    elif x < 405: y = 310
    elif x < 437: y = 372
    elif x < 505: y = lin(437, 372, 505, 312)(x)
    elif x < 667: y = 310
    elif x < 707: y = lin(667, 310, 707, 372)(x)
    elif x < 749: y = 372
    elif x < 850: y = 310
    else: y = lin(850, 312, 924, 342)(x)
    base[x] = round(y)
top = base.copy()
# 2) 물건 밑으로 돌아가기
for name, x0, y0, x1, y1, kind in OBJ:
    if kind == 'back': continue
    w = FOOT_W if kind == 'wall' else MID_W
    if kind == 'mid' and name.startswith('S'): continue          # S: 사용자 「(785,314) 왜 못 가」 → 뒤는 걸을 수 있게, 발자국 막힘+가림만
    sx0, sx1 = x0 - w, x1 + w
    if name.startswith('T'): sx0 = x0 - 6                          # T: 왼쪽은 출입문(x852~887) — 문 폭을 남긴다
    if name.startswith('M'): sx1 = 517                           # M: 칸막이B에 붙은 왼쪽만(자리 4 = 527,352 는 바구니 오른쪽 바로 옆, 사용자가 찍음)
    for x in range(max(0, sx0), min(W - 1, sx1) + 1): top[x] = max(top[x], y1 + 2)
for x0, x1, yf in PILLARS:
    for x in range(x0 - FOOT_W, x1 + FOOT_W + 1): top[x] = max(top[x], yf + 4)
top = np.minimum(top, H - 1)
top = nd.grey_erosion(nd.grey_dilation(top, size=21, mode='nearest'), size=21, mode='nearest')   # 사람 폭(≈40)의 절반보다 좁은 홈은 바닥에서 뺀다(모양만, 자리 검사는 아래서)
floor_region = np.zeros((H, W), bool)
for x in range(W): floor_region[top[x]:, x] = True

# 3) 검사: 물건 테두리 안에 바닥이 들어오면 실패(허용: back, S, M의 518~)
for name, x0, y0, x1, y1, kind in OBJ:
    if kind == 'back' or name.startswith('S'): continue
    xs = range(x0, min(x1, 517 if name.startswith('M') else x1, W - 1) + 1)
    n = sum(1 for x in xs if top[x] <= y1)
    if n: raise SystemExit(f'바닥선이 {name} 안으로 {n}열 들어감 — 실패')
for sx, sy in SPOTS:
    print(f'  자리 ({sx},{sy}) 바닥선 {top[sx]} →', '감' if sy >= top[sx] else '못 감!!')
if any(sy < top[sx] for sx, sy in SPOTS): raise SystemExit('사용자 자리 막힘 — 실패')
print('검사 통과: 물건', len(OBJ), '기둥', len(PILLARS))


# 4) S 가림: 테두리 상자 안에서 가장자리에서 윤곽선을 못 넘고 번져 오는 곳 = 배경, 나머지 = 바구니(픽셀 윤곽)
def trace_in_box(x0, y0, x1, y1):
    box = np.zeros((H, W), bool); box[y0:y1 + 1, x0:x1 + 1] = True
    free = box & ~wall2
    lab, _ = nd.label(free)
    edge = np.zeros_like(box); edge[y0, x0:x1 + 1] = edge[y1, x0:x1 + 1] = True; edge[y0:y1 + 1, x0] = edge[y0:y1 + 1, x1] = True
    bg_ids = set(np.unique(lab[edge & free])) - {0}
    obj = box & ~np.isin(lab, list(bg_ids))
    obj = nd.binary_fill_holes(obj)
    lab2, n2 = nd.label(obj); sz = nd.sum(obj, lab2, range(1, n2 + 1))
    return lab2 == (int(np.argmax(sz)) + 1)


S = next(o for o in OBJ if o[0].startswith('S'))
s_mask = trace_in_box(*S[1:5])
objects = [('S_basket', s_mask, (S[4] + 1) * K)]
depth = 10
blocks = [{'poly': [[(S[1] - MID_W) * K, (S[4] + 1 - depth) * K], [(S[3] + MID_W) * K, (S[4] + 1 - depth) * K],
                    [(S[3] + MID_W) * K, (S[4] + 2) * K], [(S[1] - MID_W) * K, (S[4] + 2) * K]], 'h': 999}]


def to_cover(oid, m, sy):
    big_m = Image.fromarray((m * 255).astype('uint8')).resize((W * K, H * K), Image.NEAREST)
    bb = big_m.getbbox(); x0, y0, x1, y1 = bb
    crop = big_m.crop(bb); buf = io.BytesIO(); crop.save(buf, 'PNG')
    return {'id': oid, 'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0, 'sortY': sy,
            'coverMask': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()}


step = []
for x in range(W): step += [(x, int(top[x])), (x + 1, int(top[x]))]
floor = [[x * K, y * K] for x, y in [(0, H)] + step + [(W, H)]]
DOOR_X = 862
door = {'kind': 'exit', 'x': DOOR_X * K, 'y': int(top[DOOR_X] + 2) * K, 'label': '나가기',
        'door': {'x0': 850 * K, 'x1': 888 * K, 'y0': 120 * K, 'y1': int(top[DOOR_X]) * K, 'anim': 'none', 'behind': 'dark'}}
SPR_DOTS = 247
REFS = [(292, 1.217 * (292 - 196)), (412, 1.217 * (412 - 196))]
TOPH = REFS[-1][1]
m = {'file': 'hq_bath_f_strip', 'bgScale': K, 'dotK': round(TOPH * K / SPR_DOTS, 4), 'sizes': [[y * K, round(h / TOPH, 3)] for y, h in REFS],
     'w': W * K, 'h': H * K, 'under': True, 'floor': floor, 'lane': [310 * K, H * K - 12], 'blocks': blocks, 'lamps': [], 'spots': [],
     'doors': {'out': door}, 'objects': [to_cover(o, mm, sy) for o, mm, sy in objects]}
OUT.mkdir(parents=True, exist_ok=True)
im.save(OUT / 'hq_bath_f_strip.png')
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, default=int))
Image.fromarray((s_mask * 255).astype('uint8')).save(OUT / 'cover_mask_1x.png')
if len(sys.argv) > 1:
    P = Path(sys.argv[1])
    e = Image.fromarray(A.astype('uint8')).resize((W * 4, H * 4), Image.NEAREST); ed = ImageDraw.Draw(e)
    for name, x0, y0, x1, y1, kind in OBJ:                      # 손으로 찍은 테두리: 노랑(wall)·주황(mid)·회색(back)
        col = {'wall': (255, 230, 0), 'mid': (255, 140, 0), 'back': (160, 160, 160)}[kind]
        ed.rectangle([x0 * 4, y0 * 4, x1 * 4 + 3, y1 * 4 + 3], outline=col, width=2)
        ed.text((x0 * 4 + 3, y0 * 4 + 3), name[0], fill=col)
    edge = s_mask & ~(np.roll(s_mask, 1, 0) & np.roll(s_mask, -1, 0) & np.roll(s_mask, 1, 1) & np.roll(s_mask, -1, 1))
    for y, x in zip(*np.nonzero(edge)): ed.rectangle([x * 4 + 1, y * 4 + 1, x * 4 + 2, y * 4 + 2], fill=(255, 0, 255))
    ed.line([(x * 2, y * 2) for x, y in floor], fill=(40, 255, 40), width=2)
    for b in blocks: ed.polygon([(x * 2, y * 2) for x, y in b['poly']], outline=(255, 60, 60), width=2)
    for sx, sy in SPOTS: ed.ellipse([sx * 4 - 6, sy * 4 - 6, sx * 4 + 6, sy * 4 + 6], outline=(0, 255, 255), width=2)
    e.crop((0, 240 * 4, W * 4, H * 4)).save(P / 'bath_f_edge_x4.png')
    e.resize((W * 2, H * 2), Image.NEAREST).crop((0, 230 * 2, W * 2, H * 2)).save(P / 'bath_f_edge_x2.png')
print(len(m['objects']), 'objects', len(blocks), 'blocks')
