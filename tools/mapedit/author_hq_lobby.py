"""관리국 본부 1층(lobby) 장면 원본 만들기 (2026-11-01, 사용자 「차단게이트 있는 판(1층_p7_오른쪽잇기) 써라」「가운데 코드로 열리게 따」).
그림: game-src/art/pixellab-hq-20261031/hq_f1_p7_ext1R.png (944×424: 왼쪽 옆벽 유리 현관·안내데스크·차단게이트·오른쪽 벽 엘리베이터). 배경 2배 = 1888×848.
게이트 유리 날개 2장만 오려 gate 조각으로(다가가면 열림 = 흐려져 사라짐). 바탕에서는 날개 자리를 오른쪽 바닥·벽 줄을 옮겨 채움(생성 0).
게이트 몸통·기둥은 못 지나감(holes), 사람보다 앞이면 가림(cover). 통로 = 가운데 기둥과 끝 기둥 사이(y386~404, 1x).
문: 현관 유리문 60~150·y120~330, 엘리베이터 800~897·y145~327.
출력: game-src/mapedit/lobby/ → python3 tools/mapedit/import.py game-src/mapedit/lobby lobby"""
import json
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'game-src/art/pixellab-hq-20261031'
OUT = ROOT / 'game-src/mapedit/lobby'
for f in OUT.glob('part_*.png'): f.unlink()
OUT.mkdir(parents=True, exist_ok=True)
K = 2
orig = Image.open(ART / 'hq_f1_p7_ext1R.png').convert('RGB')
W, H = orig.width * K, orig.height * K
# 열리는 유리(1x 다각형)
# 사용자 08:54 「가운데 기둥 사이 저거 하나만 열리게」: 앞 게이트 두 기둥 사이 유리 한 장만. 옆 날개는 닫힌 그림 그대로(못 지나감)
FLAPS = [[(539, 277), (574, 277), (574, 333), (539, 333)]]
mask = Image.new('L', orig.size, 0); md = ImageDraw.Draw(mask)
for q in FLAPS: md.polygon(q, fill=255)
from PIL import ImageFilter
base = orig.copy(); bp = base.load(); op = orig.load(); mp = mask.load()
# 열린 바탕: 유리 자리를 원래 그림의 크게 흐린(중앙값 11) 어두운 안쪽으로 — 반사 줄 없이 비어 보이게
from PIL import ImageFilter as _F
med = orig.filter(_F.MedianFilter(11)); mdp = med.load()
for y in range(orig.height):
    for x in range(orig.width):
        if mp[x, y]: bp[x, y] = tuple(int(q * 0.8) for q in mdp[x, y])
base.save(OUT / 'hq_f1_strip.png')
# 닫힌 날개 조각(원본 그대로)
bx0, by0, bx1, by1 = mask.getbbox()
flap = orig.crop((bx0, by0, bx1, by1)).convert('RGBA'); flap.putalpha(mask.crop((bx0, by0, bx1, by1)))
flap.save(OUT / 'gate_flaps.png')
objects = [{'id': 'gate_flaps', 'file': 'gate_flaps', 'x': bx0 * K, 'y': by0 * K, 'w': (bx1 - bx0) * K, 'h': (by1 - by0) * K, 'sortY': 352 * K, 'gate': True}]
def rect(x0, y0, x1, y1): return [[x0 * K, y0 * K], [x1 * K, y0 * K], [x1 * K, y1 * K], [x0 * K, y1 * K]]
# 가림(사람이 뒤에 서면 앞에 그림) — 사용자 09:07 「테두리 제대로 안 따서 다리 밑 투명한 거」: 네모 금지, 8배 확대 격자에서 읽은 그림 윤곽 그대로(docs/가림_따기_지침.md).
# 각 조각은 바탕(열린 판)에서 윤곽 마스크로 오려 낸 그림. 유리 날개 두 장은 비쳐 보이게 반투명, 앞으로 비스듬한 유리는 세로 4px 띠마다 그 x의 아래 모서리를 깊이선으로.
PARTS = [
    # 뒤 게이트: 윗 레일 + 왼 기둥 + 아래 레일(오른쪽은 앞 게이트 왼 기둥 x525에서 끝)
    ('gate_back', [[(491, 256), (493, 255), (575, 255), (576, 256), (576, 264), (525, 264), (525, 325), (497, 325), (491, 319)]], 325, None),
    # 앞 게이트: 윗 레일(526~629) + 왼 기둥·몸통(525~577) + 가운데 기둥(~586) + 레일 끝 뒤 기둥(621~629, 유리2 위까지). 여는 유리 자리 539~574·277~333 빼고
    ('gate_front', [[(526, 265), (627, 265), (629, 267), (629, 299), (626, 299), (626, 291), (621, 291), (621, 277), (586, 277), (586, 354), (575, 354), (572, 350), (530, 350), (525, 345), (525, 267)]], 352, None),
    ('post_mid', [[(617, 292), (626, 292), (626, 377), (627, 378), (627, 382), (616, 382), (616, 378), (617, 377)],
                  [(615, 304), (617, 304), (617, 309), (615, 309)], [(615, 356), (617, 356), (617, 361), (615, 361)]], 382, None),
    ('post_end', [[(665, 304), (673, 304), (674, 305), (674, 410), (678, 411), (678, 416), (661, 416), (661, 411), (664, 410), (664, 305)],
                  [(661, 321), (664, 321), (664, 326), (661, 326)], [(661, 381), (664, 381), (664, 386), (661, 386)]], 416, None),
    # 유리 두 장(위 모서리·아래 모서리 직선): (x0, 위y0, 아래y0) → (x1, 위y1, 아래y1)
    ('glass1', None, None, ((587, 286, 348), (616, 296, 368))),
    ('glass2', None, None, ((627, 300, 370), (663, 311, 397))),
]
objects = [objects[0]]
bpx = base.load()
def cut(oid, polys, sy, alpha=None):
    mk = Image.new('L', orig.size, 0); d = ImageDraw.Draw(mk)
    for q in polys: d.polygon(q, fill=255)
    if oid == 'gate_front':
        for q in FLAPS: d.polygon(q, fill=0)
    bb = mk.getbbox(); x0, y0, x1, y1 = bb
    im = base.crop(bb).convert('RGBA'); a = mk.crop(bb)
    if alpha is not None: a = a.point(lambda v: alpha if v else 0)
    if alpha is not None:  # 유리의 테두리선(아주 어둡거나 밝은 칸)은 또렷하게
        ip = im.load(); ap = a.load()
        for yy in range(im.height):
            for xx in range(im.width):
                if ap[xx, yy]:
                    r, g, b, _ = ip[xx, yy]; lum = (r + g + b) / 3
                    if lum < 25 or lum > 115: ap[xx, yy] = 255
    im.putalpha(a)
    im = im.resize((im.width * K, im.height * K), Image.NEAREST)
    im.save(OUT / f'part_{oid}.png')
    objects.append({'id': oid, 'file': f'part_{oid}', 'x': x0 * K, 'y': y0 * K, 'w': (x1 - x0) * K, 'h': (y1 - y0) * K, 'sortY': sy * K})
for oid, polys, sy, gl in PARTS:
    if gl is None: cut(oid, polys, sy); continue
    (ax, at, ab), (bx, bt, bb_) = gl
    for i, sx in enumerate(range(ax, bx + 1, 4)):
        ex = min(sx + 4, bx + 1)
        f = lambda x: (x - ax) / (bx - ax)
        t0, t1 = at + (bt - at) * f(sx), at + (bt - at) * f(ex - 1)
        b0, b1 = ab + (bb_ - ab) * f(sx), ab + (bb_ - ab) * f(ex - 1)
        poly = [(sx, round(t0)), (ex - 1, round(t1)), (ex - 1, round(b1)), (sx, round(b0))]
        cut(f'{oid}_{i}', [poly], round(max(b0, b1)), alpha=150)
# 막힘(발 자리) — 11-01 09:12 사용자 「못 가는 곳·벽과 바닥 연결선·출입구·사물을 픽셀 단위로」: 8배 확대 격자에서 읽은 발자리 그대로.
# 울타리 = 차단봉 C·로프 → 뒤 게이트 → 앞 게이트 몸통 → 유리1 → 기둥2 → 유리2 → 끝 기둥(바닥 끝까지). 넘는 길은 앞 게이트 가운데 유리(열림, x539~574)뿐:
# 앞에서 유리 자리로 들어가 게이트 안(y335~349)을 지나 유리1 뒤로 나온다.
HOLES = [
    # A: 차단봉 C 받침·로프 아래 → 뒤 게이트 발자리 → 앞 게이트 윗부분(키오스크 쪽, 게이트 안 통로 y335 위) → 앞 게이트 왼 기둥·틀(x525~539)
    [(468, 288), (628, 288), (628, 335), (539, 335), (539, 353), (525, 353), (525, 326), (491, 326), (491, 307), (468, 307)],
    # B: 앞 게이트 오른 틀(574~587) → 유리1 아래 모서리 → 기둥2 받침 → 유리2 아래 모서리 → 끝 기둥 받침(바닥 끝까지). 막힘끼리 붙어 있으면 밀어낼 때 옆 막힘으로 새므로 한 덩어리로
    [(574, 349), (586, 349), (586, 344), (618, 364), (628, 364), (628, 368), (664, 393), (664, 400), (680, 400), (680, 430), (660, 430), (660, 399),
     (628, 376), (628, 384), (615, 384), (615, 369), (587, 353), (587, 356), (574, 356)],
]
blocks = [{'poly': [[x * K, y * K] for x, y in q], 'h': 999} for q in HOLES]
# 차단봉 C(로프 포함): 사람이 그 뒤(받침 앞 모서리 y306보다 위)에 서면 가림
cut('post_c', [[(477, 244), (481, 244), (481, 301), (477, 301)], [(481, 251), (484, 251), (491, 261), (491, 268), (488, 268), (481, 258)],
               [(472, 301), (487, 301), (490, 303), (490, 306), (469, 306), (469, 303)]], 306)
def door(x0, x1, y0, y1, anim='none'): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'anim': anim, 'behind': 'dark'}
doors = {
    'main': {'kind': 'glass', 'x': 110 * K, 'y': 330 * K, 'to': 'street', 'toDoor': 'main', 'label': '현관', 'door': door(60, 150, 120, 330)},
    'elev': {'kind': 'elevator', 'x': 848 * K, 'y': 330 * K, 'label': '엘리베이터', 'door': door(800, 897, 145, 327)},
}
# 바닥(발이 설 수 있는 곳) 윗선 = 벽과 바닥이 만나는 선, 벽에 붙은 물건(우산꽂이·데스크 다리)은 그 앞 모서리까지. 8배 확대에서 읽음
floor = [[0, 381], [12, 380], [20, 376], [26, 371], [27, 366], [38, 366], [55, 358], [56, 346], [60, 343], [150, 297], [154, 302], [176, 302], [177, 297],
         [205, 297], [205, 307], [398, 307], [398, 294], [468, 294], [468, 288], [660, 288], [720, 293], [760, 302], [798, 311], [818, 314],
         [850, 320], [888, 331], [897, 333], [944, 343], [944, 418], [0, 418]]
m = {'file': 'hq_f1_strip', 'bgScale': K, 'w': W, 'h': H, 'under': False,
     'floor': [[x * K, y * K] for x, y in floor], 'lane': [300 * K, 418 * K],
     'blocks': blocks, 'doors': doors, 'posts': {'desk': [300 * K, 316 * K]}, 'lamps': [], 'spots': [], 'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, [o['id'] for o in objects])
