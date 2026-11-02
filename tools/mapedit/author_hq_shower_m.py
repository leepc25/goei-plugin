"""본부 B1 남자 탈의실(shower_m) 장면 원본 (2026-11-01 14:47 사용자 「남자탈의실 이걸로 픽스해」 = p3b 확정).
그림: game-src/art/pixellab-hq-20261031/hq_shower_m_p3b_632x424.png, 배경 2배 = 1264×848.
가림은 어림 다각형 금지(사용자 14:27·14:48 「정교하게 따라」): 물건마다 대강 테두리(ROUGH)를 준 뒤
줄(y)마다 왼·오른 끝, 기둥(x)마다 위·아래 끝을 ±SNAP px 안의 검은 윤곽선 픽셀에 붙여 픽셀 단위로 딴다.
결과 가림은 배경에서 오려 낸 그림(coverMask)이고, 긴 사물함 줄은 세로 띠(4px)마다 그 x의 앞 바닥선을 깊이선(sortY)으로.
막힘 = 물건이 바닥에 닿는 자국(밑 윤곽선에서 물건 깊이만큼 위). 바구니·가방 위로 못 올라섬(사용자 14:48).
사용: python3 tools/mapedit/author_hq_shower_m.py [확인그림폴더]"""
import base64, io, json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/art/pixellab-hq-20261031/hq_shower_m_p3b_632x424.png'
OUT = ROOT / 'game-src/mapedit/shower_m'
K, SNAP, DARK = 2, 4, 50
im = Image.open(SRC).convert('RGB'); A = np.array(im).astype(int); BR = A.max(2); W, H = im.size
dark = BR <= DARK

# 물건: id, 대강 테두리 다각형들(1x), 깊이선(sortY 1x, None이면 띠마다 FOOT 함수), 바닥 자국 깊이(px)
ROUGH = {
    'umbrellaL': ([[(0, 333), (37, 333), (36, 394), (0, 397)], [(4, 268), (24, 268), (24, 334), (4, 334)]], 397, 14),
    'hamperL':   ([[(117, 301), (162, 301), (162, 344), (120, 346)], [(116, 258), (136, 258), (136, 302), (116, 302)]], 345, 12),
    'sink':      ([[(140, 258), (220, 258), (220, 334), (186, 345), (140, 345)], [(148, 238), (164, 238), (164, 259), (148, 259)]], 344, 16),
    'bench':     ([[(219, 280), (287, 280), (287, 323), (219, 323)]], 322, 10),
    'hamperM':   ([[(276, 325), (327, 325), (327, 383), (276, 383)]], 382, 14),
    'duffel':    ([[(323, 346), (376, 346), (376, 388), (323, 388)]], 387, 12),
    'lockC':     ([[(286, 150), (379, 150), (466, 196), (466, 300), (379, 374), (286, 374)],
                   [(298, 136), (341, 136), (341, 151), (298, 151)], [(345, 124), (400, 124), (466, 160), (466, 197), (379, 151), (345, 151)]], 'lockC', None),
    'lockR':     ([[(552, 140), (632, 110), (632, 424), (600, 386), (552, 301)]], 'lockR', None),
    'binR':      ([[(603, 325), (632, 325), (632, 401), (603, 401)]], 400, 12),
    'binB':      ([[(468, 272), (490, 272), (490, 303), (468, 303)]], 302, 8),
    'boxB':      ([[(497, 282), (530, 282), (530, 303), (497, 303)]], 302, 8),
    'umbB':      ([[(536, 248), (551, 248), (551, 301), (536, 301)]], 300, 4),
    'basketF':   ([[(55, 395), (136, 395), (136, 424), (55, 424)]], 424, 99),
}
FOOT = {   # 긴 사물함 줄: x(1x)에서의 앞 바닥선 y
    'lockC': lambda x: 374 if x <= 379 else 374 - (x - 379) * 74 / 87,
    'lockR': lambda x: 301 + (x - 552) * 85 / 48 if x <= 600 else 386 + (x - 600) * 38 / 32,
}


def poly_mask(polys):
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    for p in polys: d.polygon(p, fill=255)
    return np.array(m) > 0


def snap(rough):
    """대강 테두리를 SNAP px 넓힌 칸 안에서, 테두리 밖 칸 끝에서 시작해 윤곽선(검은 픽셀, 1px 틈은 메움)을 넘지 않고
    퍼지는 곳 = 배경. 칸 안에서 배경이 아닌 곳 = 물건(윤곽선 포함). 줄마다·기둥마다 윤곽선까지 픽셀 단위."""
    from scipy import ndimage as nd
    grow = nd.binary_dilation(rough, iterations=SNAP)
    ys, xs = np.nonzero(grow); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    wall = nd.binary_dilation(dark[y0:y1, x0:x1], structure=np.ones((2, 2)))      # 1px 틈 메움
    free = grow[y0:y1, x0:x1] & ~wall
    seed = np.zeros_like(free); seed[0, :] = seed[-1, :] = True; seed[:, 0] = seed[:, -1] = True
    seed |= ~grow[y0:y1, x0:x1]
    seed &= ~rough[y0:y1, x0:x1]
    lab, _ = nd.label(free | (seed & ~wall))
    bg_ids = set(np.unique(lab[seed & ~wall])) - {0}
    bg = np.isin(lab, list(bg_ids)) | ~grow[y0:y1, x0:x1]
    obj = ~bg
    obj = obj & ~(nd.binary_dilation(bg, iterations=1) & ~dark[y0:y1, x0:x1] & ~wall)   # 메운 틈 1px 되돌림
    # 대강 테두리 안쪽(2px 줄인 곳)에 닿는 덩어리만 남김 → 칸 가장자리에 갇힌 천장 배관 띠·바닥 슬리퍼 조각 버림
    dk = dark[y0:y1, x0:x1]
    core = nd.binary_erosion(rough[y0:y1, x0:x1], iterations=2)
    lab2, _ = nd.label(obj & ~dk)
    keep = np.isin(lab2, list(set(np.unique(lab2[core & obj & ~dk])) - {0}))
    keep |= obj & dk & nd.binary_dilation(keep, iterations=1)
    lab3, _ = nd.label(keep)                                  # 윤곽선으로 이어진 것까지 한 덩어리로 보고 다시 core에 닿는 것만
    keep = np.isin(lab3, list(set(np.unique(lab3[core & keep])) - {0}))
    out = np.zeros_like(rough); out[y0:y1, x0:x1] = keep
    return out


# 벽·뒷벽에 붙은 물건은 가림 없음 — 바닥선만으로 막는다 (규칙 11-01 18:0x, 11-02 06:3x 점검에서 고침)
WALL_ATTACHED = {'sink', 'bench', 'hamperL', 'umbrellaL', 'binB', 'boxB', 'umbB'}
masks = {}
for oid, (polys, _, _) in ROUGH.items():
    m = np.zeros((H, W), bool)
    for p in polys: m |= snap(poly_mask([p]))
    masks[oid] = m

big = im.resize((W * K, H * K), Image.NEAREST)
objects, blocks = [], []
for oid, (polys, sy, depth) in ROUGH.items():
    m = masks[oid]
    if isinstance(sy, str):   # 세로 띠 4px마다
        f = FOOT[sy]
        for x0 in range(0, W, 4):
            sub = np.zeros_like(m); sub[:, x0:x0 + 4] = m[:, x0:x0 + 4]
            if not sub.any(): continue
            objects.append((f'{oid}_{x0}', sub, round(f(x0 + 2)) * K))
    else:
        if oid not in WALL_ATTACHED: objects.append((oid, m, sy * K))
        if depth:   # 바닥 자국: 2px 기둥마다 물건 밑 윤곽선(그 기둥의 가장 아래)에서 depth 위까지
            for x in range(0, W, 2):
                c = np.nonzero(m[:, x:x + 2].any(1))[0]
                if not len(c): continue
                yb = c.max() + 1; yt = max(c.min(), yb - depth)
                blocks.append({'poly': [[x * K, yt * K], [(x + 2) * K, yt * K], [(x + 2) * K, yb * K], [x * K, yb * K]], 'h': 999})
# 사물함 줄 막힘(바닥 자국 = 앞 바닥선부터 뒷벽까지)
# 옆면에서 몸 반폭 18px 띄움 (11-02 06:3x 「파묻혔냐」, 06:45 「왜 캐비닛이랑 겹치냐」: 이 방은 사람이 커서 10px로 모자람)
blocks.append({'poly': [[x * K, y * K] for x, y in [(285, 296), (485, 296), (485, 300), (397, 375), (285, 375)]], 'h': 999})
blocks.append({'poly': [[x * K, y * K] for x, y in [(533, 296), (632, 296), (632, 425), (582, 387), (533, 301)]], 'h': 999})


def to_cover(oid, m, sy):
    big_m = Image.fromarray((m * 255).astype('uint8')).resize((W * K, H * K), Image.NEAREST)
    bb = big_m.getbbox(); x0, y0, x1, y1 = bb
    crop = big_m.crop(bb); buf = io.BytesIO(); crop.save(buf, 'PNG')
    return {'id': oid, 'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0, 'sortY': sy,
            'coverMask': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()}


# 걷는 바닥: 기둥마다 아래(y 423)에서 위로 올라가 뒷벽 밑 윤곽선까지 — 물건 자국은 위 막힘이 맡음.
# 왼쪽 옆벽·유리문 밑선, 벤치·세면대 쪽, 뒤 통로 뒷벽 밑선은 그림의 윤곽선을 기둥마다 읽는다(시작 y 범위만 지정).
# 유리문 밑 윤곽선은 (36,357)→(90,341)로 기울어 있어 그 선 3px 아래에서 올라간다.
FLOOR_START = [(0, 36, lambda x: 400), (36, 92, lambda x: round(357 - (x - 36) * 16 / 54) + 3), (92, 140, lambda x: 352),
               (140, 222, lambda x: 349), (222, 286, lambda x: 326), (286, 467, lambda x: 300), (467, 552, lambda x: 306), (552, 632, lambda x: 300)]
top = []
for x in range(W):
    s = next(f(x) for a, b, f in FLOOR_START if a <= x < b)
    y = s
    while y > s - 16 and not dark[y, x]: y -= 1
    top.append(y + 1 if dark[y, x] else s - 3)   # 16px 안에 윤곽선이 없으면(밝은 선) 시작선 3px 위
# 맨 뒤는 y314(2배 628)까지만 걷기 (11-02 06:35 사용자 「여기까지만 들어가게 하면 돼」)
BACK = 314
top = [max(t, BACK) for t in top]
fl = [(0, H)] + [(x, top[x]) for x in range(W)] + [(W, H)]
step = []
for i, (x, y) in enumerate(fl[1:-1]):
    step += [(x, y), (x + 1, y)]
floor = [[x * K, y * K] for x, y in [(0, H)] + step + [(W, H)]]
door = {'kind': 'glass', 'x': 72 * K, 'y': 356 * K, 'locked': True, 'label': '샤워실',
        'door': {'x0': 30 * K, 'x1': 110 * K, 'y0': 120 * K, 'y1': 352 * K, 'anim': 'none', 'behind': 'dark'}}
# 줄 맨 뒤 배율(사용자 15:03 「해봐」): 맨 앞은 게임 공통 크기 그대로, 맨 뒤(y300, 뒤 통로)에서 사람 키 ≈ 사물함(104px)보다 조금 작은 97px(1x)
# = 194(2x) ÷ 게임 맨 앞 키 353(2x, 도트 247 × dotK 1.4292) ≈ 0.55
# 사람 크기 = 기준점 셋 사이에서만 바뀜 (사용자 15:21: 「문을 기준점, 앞 캐비닛을 기준점 — 키우기는 그 사이에서만,
# 줄이기는 문부터 제일 안쪽 캐비닛 사이에서만」). 그 밖은 끝 기준점 크기 그대로.
# 사람 = 문틀의 0.82 = 캐비닛의 0.91 (문 2.1m·캐비닛 1.9m·사람 1.72m). 1x로 잰 값:
# - 제일 안쪽 캐비닛: 가운데 줄 뒤 끝 x464 위 y190 ~ 밑 y300 (110px) → 사람 100, 발 y300
# - 문: 왼쪽 유리문 문틀 앞 모서리 x30 위 y110 ~ 밑 y358 (248px) → 사람 203, 발 y358
# - 앞 캐비닛: 가운데 줄 끝판 x300 위 y150 ~ 밑 y374 (224px) → 사람 204, 발 y374
SPR_DOTS = 247
# 11-02 06:41 사용자 「기준을 문과 캐비닛으로 두라고」「문 앞 맞아」「뒤로 작아지는 부분도 캐비닛 기준」:
# 기준점 = 문(문 앞 사람 = 문틀 248px의 0.82 @ 발 y358) + 캐비닛(사람 = 그 깊이 캐비닛 높이의 0.91).
# 캐비닛 높이는 그림 3배 확대로 읽음(1x): 가운데 줄 옆면 뒤 끝 x466 위 y191~밑 y298(107), 중간 x423 y173~333(160),
#   앞 끝 x378 y152~370(216) / 오른쪽 줄 뒤 끝 x553 y190~298(108), 앞 끝 x598 y140~387(247) → 높이 ≈ 1.53×(발y−227).
CAB = lambda y: 0.91 * 1.53 * (y - 227)
# 06:45 「이게 너무 커」(문 앞 줄의 사물함 옆 사람): 이 그림은 문이 캐비닛보다 크게 그려져 있어 문 기준과 캐비닛 기준이 어긋남 → 캐비닛 하나로 통일
# 06:55 「앞으로 나올 때 너무 급격하게 커져」 → 문 앞 줄(y358)까지는 그대로, 그 앞은 커지는 정도 2/3
REFS = [(BACK, CAB(BACK)), (358, CAB(358)), (424, CAB(358) + 2 / 3 * (CAB(424) - CAB(358)))]
TOP = max(h for _, h in REFS)
DOTK_HERE = round(TOP * K / SPR_DOTS, 4)
SIZES = [[y * K, round(h / TOP, 3)] for y, h in REFS]
m = {'file': 'hq_shower_m_strip', 'bgScale': K, 'dotK': DOTK_HERE, 'sizes': SIZES, 'w': W * K, 'h': H * K, 'under': True, 'floor': floor,
     'lane': [BACK * K, H * K - 12], 'blocks': blocks, 'lamps': [], 'spots': [],
     'doors': {'shower': door, 'out': {'kind': 'exit', 'side': 'S', 'x': 316 * K, 'y': H * K - 12, 'label': '나가기'}},
     'objects': [to_cover(o, mm, sy) for o, mm, sy in objects]}
OUT.mkdir(parents=True, exist_ok=True)
im.save(OUT / 'hq_shower_m_strip.png')
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, default=int))
# 확인 그림
if len(sys.argv) > 1:
    P = Path(sys.argv[1]); allm = np.zeros((H, W), bool)
    for mm in masks.values(): allm |= mm
    v = (A * np.where(allm[..., None], 1.0, 0.35)).astype('uint8')
    vi = Image.fromarray(v).resize((W * 4, H * 4), Image.NEAREST); d = ImageDraw.Draw(vi)
    for b in blocks: d.polygon([(x * 2, y * 2) for x, y in b['poly']], outline=(255, 40, 40))
    d.line([(x * 2, y * 2) for x, y in floor], fill=(40, 255, 40))
    vi.save(P / 'shower_m_check_x4.png')
    # 가림 윤곽 확인: 가림 테두리 픽셀을 자홍색으로 4배
    e = Image.fromarray(A.astype('uint8')).resize((W * 4, H * 4), Image.NEAREST); ed = ImageDraw.Draw(e)
    for mm in masks.values():
        edge = mm & ~(np.roll(mm, 1, 0) & np.roll(mm, -1, 0) & np.roll(mm, 1, 1) & np.roll(mm, -1, 1))
        for y, x in zip(*np.nonzero(edge)): ed.rectangle([x * 4 + 1, y * 4 + 1, x * 4 + 2, y * 4 + 2], fill=(255, 0, 255))
    ed.line([(x * 2, y * 2) for x, y in floor], fill=(40, 255, 40))
    for b in blocks: ed.polygon([(x * 2, y * 2) for x, y in b['poly']], outline=(255, 60, 60))
    e.save(P / 'shower_m_edge_x4.png')
print(len(m['objects']), 'objects', len(blocks), 'blocks')
