"""본부 B2 의무실(infirmary) 장면 레이어 — 그림 hq_b2_infirmary_p9_fix2.png (872×424), 배경 2배.
사용자 11-02 12:11 「난간만 따면 되는 게 아니라 이 방 전체를 레이어 작업 해야지」.
값은 전부 4배 격자 그림과 줄마다 검은 윤곽 픽셀 목록을 눈으로 읽고 손으로 적은 것(자동 찾기 없음).
층:
 1) 바닥선(걷는 곳 뒤 끝): 벽·벽 앞 물건(카트·상자·쓰레기통·링거대·모니터 카트·침대 셋)은 그 밑(+2)을 돌아감, 옆 ±20.
    침대 셋은 벽에 붙어 뒤에 설 곳이 없으므로 가림 없이 바닥선으로만 막는다.
 2) 앞줄 물건(아래 끝에 잘린 상자·장비·카트·저울·모니터): 뒤로 설 수 있으므로 가림(줄마다 손으로 읽은 칸) + 발자국 막힘.
    오른쪽 아래 콘솔(벽에 붙음)은 가림 없이 바닥에서 뺀다.
 3) 눕기 자리 3곳: 서는 자리 + 매트리스 위 눕는 자리, 침대 앞 난간 가림(infirmary_bed_front_p9.py)은 누운 몸 위에 덮는다.
 4) 출입문: 아래 끝 x≈233 (사용자 11-02 11:59 핀).
사용: python3 tools/mapedit/author_hq_infirmary.py [확인그림폴더]"""
import base64, io, json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/objects'))
from infirmary_bed_front_p9 import BEDS as RAILS
SRC = ROOT / 'game-src/art/pixellab-hq-20261031/hq_b2_infirmary_p9_fix2.png'
OUT = ROOT / 'game-src/mapedit/infirmary'
K = 2
im = Image.open(SRC).convert('RGB'); A = np.array(im); W, H = im.size

# ── 1) 바닥선: 벽 밑선 + 벽 앞 물건 (이름, x0, x1, 밑 윤곽선 y) — 1x
WALL = [(0, 84, 254), (84, 150, 254), (150, 412, 256), (412, 593, 256), (593, 640, 256), (640, W, 256)]
AGAINST = [
    ('왼쪽 바퀴 카트',        0,  36, 320),
    ('왼쪽 바닥 상자',       36,  81, 305),
    ('작은 상자(조리대 앞)', 124, 165, 277),
    ('링거대·혈압계 받침',  150, 210, 311),
    ('왼쪽 침대',           165, 340, 300),
    ('모니터 카트',          343, 392, 289),
    ('쓰레기통',            593, 620, 255),
    ('오른쪽 뒤 침대',       643, 805, 297),
    ('오른쪽 앞 침대',       662, 852, 366),
]
FOOT_W = 20
top = np.zeros(W, int)
for x0, x1, y in WALL: top[x0:x1] = y + 2
for name, x0, x1, y in AGAINST:
    a, b = max(0, x0 - FOOT_W), min(W, x1 + FOOT_W + 1)
    top[a:b] = np.maximum(top[a:b], y + 2)
top[852:] = np.maximum(top[852:], 368)       # 앞 침대 오른쪽 = 오른벽·콘솔
def _f(a, f): p = np.pad(a, 10, mode='edge'); return np.array([f(p[i:i + 21]) for i in range(len(a))])
top = _f(_f(top, np.max), np.min)   # 사람 폭보다 좁은 홈 메움

# ── 2) 앞줄 물건 가림: 줄 y → [(x0, x1), ...] (1x, 양끝 포함). 줄마다 검은 윤곽 목록을 읽고 적음.
def R(y0, y1, *spans): return {y: list(spans) for y in range(y0, y1 + 1)}
FRONT = {}
# 왼쪽 무리: 빨간 물건(x0~7) + 상자1(0~40) + 상자2(83~135) + 상자3(124~161)
L = {360: [(0, 5)], **R(361, 380, (0, 7)), 381: [(0, 11)], 382: [(0, 22)], 383: [(0, 33), (101, 134)], 384: [(0, 39), (100, 135)],
     385: [(0, 40), (98, 135)], 386: [(0, 40), (97, 135)], 387: [(0, 40), (95, 135)], 388: [(0, 40), (93, 135)], 389: [(0, 40), (92, 135)],
     390: [(0, 40), (90, 135)], 391: [(0, 40), (89, 135)], 392: [(0, 40), (86, 135)], 393: [(0, 40), (85, 135)],
     **R(394, 400, (0, 40), (83, 135)), 401: [(0, 40), (83, 135), (142, 149)], 402: [(0, 40), (83, 135), (140, 153)],
     403: [(0, 40), (83, 135), (138, 158)], 404: [(0, 40), (83, 160)], **R(405, 414, (0, 40), (83, 161)),
     415: [(0, 39), (83, 161)], 416: [(0, 38), (83, 161)], 417: [(0, 37), (83, 161)], 418: [(0, 35), (83, 161)], 419: [(0, 34), (83, 161)],
     420: [(0, 33), (83, 161)], 421: [(0, 31), (83, 161)], 422: [(0, 30), (83, 161)], 423: [(0, 28), (83, 161)]}
# 가운데 무리: 상자 M1(308~339), 장비 E(344~396), 탁자 카트 T(403~478, 병 462~470), 저울 S(485~507)
M1 = {392: (317, 338), 393: (316, 339), 394: (315, 339), 395: (315, 339), 396: (314, 339), 397: (314, 339), 398: (313, 339), 399: (313, 339),
      400: (312, 339), 401: (312, 339), 402: (311, 339), 403: (310, 339), 404: (310, 339), 405: (309, 339), 406: (309, 339), **{y: (308, 339) for y in range(407, 424)}}
E = {360: (360, 391), 361: (359, 392), 362: (357, 392), 363: (357, 392), 364: (357, 392), 365: (345, 395), **{y: (344, 396) for y in range(366, 377)},
     377: (345, 396), 378: (346, 396), 379: (347, 396), 380: (347, 396), 381: (346, 396), 382: (346, 396), 383: (346, 396), 384: (345, 396), 385: (345, 396),
     **{y: (344, 396) for y in range(386, 391)}, **{y: (345, 396) for y in range(391, 418)}, **{y: (346, 396) for y in range(418, 424)}}
TL = {367: 413, 368: 412, 369: 412, 370: 411, 371: 411, 372: 410, 373: 410, 374: 409, 375: 409, 376: 408, 377: 408, 378: 408, 379: 407, 380: 407,
      381: 406, 382: 406, 383: 406, 384: 405, 385: 404, 386: 404, 387: 404, **{y: 403 for y in range(388, 424)}}
T = {356: [(465, 467)], **{y: [(463, 468)] for y in range(357, 362)}, 362: [(416, 448), (462, 469)], 363: [(415, 449), (462, 470)],
     364: [(414, 449), (462, 470)], 365: [(414, 449), (462, 470)], 366: [(414, 449), (462, 470)], **{y: [(TL[y], 478)] for y in range(367, 424)}}
SR = {373: 505, 374: 506, 375: 507, 376: 507, 377: 507, 378: 507, 379: 507, 380: 506, 381: 505, 382: 505, 383: 504, 384: 503, 385: 502, 386: 501, 387: 501}
SL = {373: 494, 374: 492, 375: 490, 376: 490, 377: 490, 378: 489, 379: 488, 380: 487, 381: 487, 382: 486, 383: 486}
S = {**{y: (SL.get(y, 485), SR[y]) for y in range(373, 388)}, 388: (485, 500), 389: (485, 500), **{y: (485, 499) for y in range(390, 418)}, **{y: (486, 499) for y in range(418, 424)}}
# 오른쪽 무리: 쟁반 카트 TC(601~717, 파란 물건 705~710), 모니터 MO(722~783)
TCR = {378: 711, 379: 712, 380: 712, 381: 712, 382: 713, 383: 713, 384: 714, 385: 714, **{y: 715 for y in range(386, 391)}, **{y: 717 for y in range(391, 424)}}
TC = {373: [(634, 676)], 374: [(634, 677), (707, 709)], 375: [(633, 678), (706, 710)], 376: [(633, 678), (705, 710)], 377: [(601, 710)],
      **{y: [(601, TCR[y])] for y in range(378, 424)}}
MOL = {**{y: 729 for y in range(352, 375)}, 350: 731, 351: 730, 375: 728, 376: 726, 377: 726, **{y: 726 for y in range(378, 384)}, 384: 725, 385: 723, 386: 723,
       **{y: 722 for y in range(387, 393)}, 393: 724, 394: 724, **{y: 725 for y in range(395, 399)}, **{y: 726 for y in range(399, 424)}}
MOR = {350: 765, 351: 767, 352: 768, 353: 769, 354: 770, 355: 770, 356: 771, **{y: 772 for y in range(357, 378)}, **{y: 773 for y in range(378, 385)},
       385: 774, 386: 774, **{y: 773 for y in range(387, 390)}, 390: 774, 391: 774, 392: 774, 393: 775, 394: 776, 395: 777, 396: 777, 397: 777,
       398: 778, 399: 778, **{y: 783 for y in range(400, 409)}, **{y: 778 for y in range(409, 424)}}
MO = {y: (MOL[y], MOR[y]) for y in range(350, 424)}

# 물건 단위로 묶음: (id, 줄표, 발자국 막힘 시작 y(뒤 바닥 닿는 곳, 눈대중), 막힘 x 범위)
def one(d): return {y: [v] for y, v in d.items()}
GROUPS = [
    ('F_left_boxes', L, 395, (0, 161)),
    ('F_box_mid', one(M1), 405, (308, 339)),
    ('F_equip', one(E), 385, (344, 396)),
    ('F_table_cart', T, 390, (403, 478)),
    ('F_scale', one(S), 400, (485, 507)),
    ('F_tray_cart', TC, 395, (601, 717)),
    ('F_monitor', one(MO), 395, (722, 783)),
]
MID_W = 12
CONSOLE_X = 795          # 오른쪽 아래 콘솔(810~)과 모니터 사이 좁은 틈(783~810)까지 바닥에서 뺌


def spans_mask(rows):
    m = np.zeros((H, W), bool)
    for y, sp in rows.items():
        for x0, x1 in sp: m[y, x0:x1 + 1] = True
    return m


covers = [(gid, spans_mask(rows), H * K) for gid, rows, _, _ in GROUPS]   # 아래 끝에 잘린 물건 = 늘 맨 앞
blocks = []
for gid, rows, yb, (bx0, bx1) in GROUPS:
    x0, x1 = max(0, bx0 - MID_W), min(W, bx1 + MID_W)
    blocks.append({'id': gid, 'poly': [[x0 * K, yb * K], [x1 * K, yb * K], [x1 * K, H * K], [x0 * K, H * K]], 'h': 999})
blocks.append({'id': 'console', 'poly': [[CONSOLE_X * K, 368 * K], [W * K, 368 * K], [W * K, H * K], [CONSOLE_X * K, H * K]], 'h': 999})

# ── 3) 눕기: 서는 자리(발), 눕는 자리(몸 밑 가운데), 머리 쪽(-1 왼쪽 / 1 오른쪽), 난간 가림
BEDS = [
    # id, 레일 키, 서기(x, y), 눕기(x, y), 머리
    ('bed_left',  'bed3_left',  (258, 308), (252, 257), -1),
    ('bed_back',  'bed1_back',  (628, 304), (738, 263), 1),
    ('bed_front', 'bed2_front', (760, 374), (768, 324), 1),
]


def rail_mask(key):
    b = RAILS[key]; m = np.zeros((H, W), bool)
    for y, (x0, x1) in b['ROWS'].items(): m[y, x0:x1 + 1] = True
    for x0, y0, x1, y1 in b['HOLES']: m[y0:y1 + 1, x0:x1 + 1] = False
    return m


for bid, key, _, (lx, ly), _ in BEDS:
    covers.append((f'rail_{bid}', rail_mask(key), ly * K + 1))   # 누운 몸(깊이 = 눕는 자리 y) 바로 앞

# ── 검사
floor_ok = np.zeros((H, W), bool)
for x in range(W): floor_ok[top[x]:, x] = True
for b in blocks:
    (x0, y0), (x1, _), (_, y1) = b['poly'][0], b['poly'][1], b['poly'][2]
    floor_ok[y0 // K:y1 // K, x0 // K:x1 // K] = False
for name, x0, x1, y in AGAINST:
    bad = [x for x in range(x0, min(x1, W - 1) + 1) if top[x] <= y]
    if bad: raise SystemExit(f'바닥선이 {name} 안으로 {len(bad)}열 들어감 — 실패')
for gid, m, _ in covers:
    if gid.startswith('F_') and (m & floor_ok).any():
        ys, xs = np.nonzero(m & floor_ok)
        if (ys >= max(b['poly'][0][1] // K for b in blocks if b.get('id') == gid)).any(): raise SystemExit(f'{gid} 발자국이 바닥에 열림 — 실패')
DOOR_X = 233
for nm, (sx, sy) in [('출입문', (DOOR_X, 420))] + [(f'{b[0]} 서기', b[2]) for b in BEDS]:
    print(f'  {nm} ({sx},{sy}):', '감' if floor_ok[sy, sx] else '못 감!!')
    if not floor_ok[sy, sx]: raise SystemExit('자리 막힘 — 실패')
print('검사 통과')


def to_cover(oid, m, sy):
    big = Image.fromarray((m * 255).astype('uint8')).resize((W * K, H * K), Image.NEAREST)
    x0, y0, x1, y1 = big.getbbox(); buf = io.BytesIO(); big.crop((x0, y0, x1, y1)).save(buf, 'PNG')
    return {'id': oid, 'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0, 'sortY': int(sy),
            'coverMask': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()}


step = []
for x in range(W): step += [(x, int(top[x])), (x + 1, int(top[x]))]
floor = [[x * K, y * K] for x, y in [(0, H)] + step + [(W, H)]]
# 크기: 11-02 의무실 눕히기에서 정한 큐라스(가장 큰 남자) 기준 장면 배율 — 뒤 침대(y263) 0.545 · 앞 침대(y324) 0.65, 그 밖은 끝값 유지
SIZES = [(263, 0.545), (324, 0.65)]
door = {'kind': 'exit', 'x': DOOR_X * K, 'y': 420 * K, 'label': '나가기'}
spots = [{'id': bid, 'x': sx * K, 'y': sy * K, 'verb': '눕기', 'face': head, 'seat': {'x': lx * K, 'y': ly * K}, 'act': ['bedlie', 'liehold']}
         for bid, _, (sx, sy), (lx, ly), head in BEDS]
m = {'file': 'hq_infirmary_strip', 'bgScale': K, 'dotK': round(SIZES[-1][1] * K, 4), 'sizes': [[y * K, round(k / SIZES[-1][1], 3)] for y, k in SIZES],
     'w': W * K, 'h': H * K, 'under': True, 'floor': floor, 'lane': [int(top.min()) * K, H * K - 4], 'blocks': [{'poly': b['poly'], 'h': b['h']} for b in blocks],
     'lamps': [], 'spots': spots, 'doors': {'out': door}, 'objects': [to_cover(o, mm, sy) for o, mm, sy in covers]}
OUT.mkdir(parents=True, exist_ok=True)
im.save(OUT / 'hq_infirmary_strip.png')
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, default=int))
print(len(m['objects']), 'covers', len(m['blocks']), 'blocks', len(spots), 'beds')

if len(sys.argv) > 1:
    P = Path(sys.argv[1]); P.mkdir(parents=True, exist_ok=True)
    Z = 4
    e = im.resize((W * Z, H * Z), Image.NEAREST).convert('RGBA'); ov = Image.new('RGBA', e.size); od = ImageDraw.Draw(ov)
    for gid, mm, _ in covers:
        col = (255, 0, 255, 110) if gid.startswith('F_') else (0, 200, 255, 140)
        for y, x in zip(*np.nonzero(mm)): od.rectangle([x * Z, y * Z, x * Z + Z - 1, y * Z + Z - 1], fill=col)
    e.alpha_composite(ov); d = ImageDraw.Draw(e)
    d.line([(x * Z // K, y * Z // K) for x, y in floor], fill=(40, 255, 40), width=3)
    for b in blocks: d.polygon([(x * Z // K, y * Z // K) for x, y in b['poly']], outline=(255, 50, 50), width=3)
    for bid, _, (sx, sy), (lx, ly), _ in BEDS:
        d.ellipse([sx * Z - 8, sy * Z - 8, sx * Z + 8, sy * Z + 8], outline=(255, 255, 0), width=3)
        d.ellipse([lx * Z - 8, ly * Z - 8, lx * Z + 8, ly * Z + 8], outline=(0, 255, 255), width=3)
    d.ellipse([DOOR_X * Z - 10, 420 * Z - 10, DOOR_X * Z + 10, 420 * Z + 10], outline=(255, 160, 0), width=4)
    e.convert('RGB').save(P / 'infirmary_layers_x4.png')
    e.resize((W * 2, H * 2), Image.LANCZOS).convert('RGB').save(P / 'infirmary_layers_x2.png')
