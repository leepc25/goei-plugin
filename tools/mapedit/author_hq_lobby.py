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
# 유리 날개 두 장(1x 다각형)
FLAPS = [[(581, 285), (616, 299), (616, 366), (582, 350)], [(626, 299), (664, 310), (664, 395), (626, 372)]]
mask = Image.new('L', orig.size, 0); md = ImageDraw.Draw(mask)
for q in FLAPS: md.polygon(q, fill=255)
from PIL import ImageFilter
mask = mask.filter(ImageFilter.MaxFilter(3))  # 유리 가장자리 1px까지
# 열린 바탕: 날개 자리를 같은 줄 x690~719 띠(소화기 반사 없는 바닥·벽)를 되풀이해 채움
base = orig.copy(); bp = base.load(); op = orig.load(); mp = mask.load()
for y in range(orig.height):
    for x in range(orig.width):
        if mp[x, y]: bp[x, y] = op[690 + (x - 570) % 30, y]
base.save(OUT / 'hq_f1_strip.png')
# 닫힌 날개 조각(원본 그대로)
bx0, by0, bx1, by1 = mask.getbbox()
flap = orig.crop((bx0, by0, bx1, by1)).convert('RGBA'); flap.putalpha(mask.crop((bx0, by0, bx1, by1)))
flap.save(OUT / 'gate_flaps.png')
objects = [{'id': 'gate_flaps', 'file': 'gate_flaps', 'x': bx0 * K, 'y': by0 * K, 'w': (bx1 - bx0) * K, 'h': (by1 - by0) * K, 'sortY': 400 * K, 'gate': True}]
def rect(x0, y0, x1, y1): return [[x0 * K, y0 * K], [x1 * K, y0 * K], [x1 * K, y1 * K], [x0 * K, y1 * K]]
# 가림(사람이 뒤에 서면 앞에 그림): 뒤 게이트·앞 게이트·가운데 기둥·끝 기둥
for oid, r, sy in (('gate_back', (488, 252, 578, 326), 326), ('gate_front', (522, 262, 628, 352), 352), ('post_mid', (613, 290, 629, 386), 386), ('post_end', (661, 300, 680, 418), 417)):
    objects.append({'id': oid, 'cover': [rect(*r)], 'sortY': sy * K})
# 막힘(발 자리): 게이트 몸통 줄, 가운데 기둥, 끝 기둥
blocks = [{'poly': rect(*r), 'h': 999} for r in ((485, 292, 628, 352), (612, 352, 630, 386), (660, 404, 680, 418))]
def door(x0, x1, y0, y1, anim='none'): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'anim': anim, 'behind': 'dark'}
doors = {
    'main': {'kind': 'glass', 'x': 110 * K, 'y': 330 * K, 'to': 'street', 'toDoor': 'main', 'label': '현관', 'door': door(60, 150, 120, 330)},
    'elev': {'kind': 'elevator', 'x': 848 * K, 'y': 330 * K, 'label': '엘리베이터', 'door': door(800, 897, 145, 327)},
}
floor = [[60, 338], [150, 306], [700, 300], [940, 334], [940, 418], [60, 418]]
m = {'file': 'hq_f1_strip', 'bgScale': K, 'w': W, 'h': H, 'under': False,
     'floor': [[x * K, y * K] for x, y in floor], 'lane': [300 * K, 418 * K],
     'blocks': blocks, 'doors': doors, 'lamps': [], 'spots': [], 'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, [o['id'] for o in objects])
