"""관리국 본부 1층(lobby) 장면 원본 만들기 (2026-11-01, 사용자 「칸막이 있는 걸로 써」「가운데 부분 코드로 열리게 따」).
바탕: game-src/art/pixellab-hq-20261031/hq_f1_p7_ext1R_fix4.png (944×424, 칸막이 없는 판: 키오스크가 바닥에 섬).
칸막이: hq_f1_p7_ext1R_fix3.png(칸막이 있는 판)에서 바탕과 다른 픽셀만 오려 세 조각으로 → 왼쪽·오른쪽은 고정(못 지나감), 가운데는 gate(사람이 다가가면 코드로 열림).
현관 = 왼쪽 옆벽 유리문 60~150·y120~330, 엘리베이터 = 오른쪽 벽 800~897·y145~327. 배경 2배 = 1888×848.
출력: game-src/mapedit/lobby/ → python3 tools/mapedit/import.py game-src/mapedit/lobby lobby"""
import json
from pathlib import Path
from PIL import Image, ImageChops
ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'game-src/art/pixellab-hq-20261031'
OUT = ROOT / 'game-src/mapedit/lobby'; OUT.mkdir(parents=True, exist_ok=True)
K = 2
base = Image.open(ART / 'hq_f1_p7_ext1R_fix4.png').convert('RGB'); base.save(OUT / 'hq_f1_strip.png')
part = Image.open(ART / 'hq_f1_p7_ext1R_fix3.png').convert('RGB')
W, H = base.width * K, base.height * K
PY0, PY1, PBOT = 234, 310, 308          # 칸막이 세로 범위(1x), 발밑 깊이
CUTS = [('part_l', 466, 530, False), ('part_gate', 530, 650, True), ('part_r', 650, 688, False)]
objects, blocks = [], []
for oid, x0, x1, gate in CUTS:
    a = part.crop((x0, PY0, x1, PY1)); b = base.crop((x0, PY0, x1, PY1))
    m = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 12 else 0)
    # 칸막이 몸통(y234~291, x466~684)은 통째로 불투명, 그 아래는 차단봉 다리·받침만(가는 기둥 자리)
    body = Image.new('L', a.size, 0); body.paste(255, (0, 0, min(x1, 684) - x0, 291 - PY0))
    legs = Image.new('L', a.size, 0)
    for lx0, lx1 in ((470, 490), (580, 604)):
        if lx1 > x0 and lx0 < x1: legs.paste(255, (max(lx0, x0) - x0, 291 - PY0, min(lx1, x1) - x0, PY1 - PY0))
    m = ImageChops.lighter(body, ImageChops.multiply(m, legs))
    im = a.convert('RGBA'); im.putalpha(m)
    im.save(OUT / f'{oid}.png')
    objects.append({'id': oid, 'file': oid, 'x': x0 * K, 'y': PY0 * K, 'w': (x1 - x0) * K, 'h': (PY1 - PY0) * K, 'sortY': PBOT * K, **({'gate': True} if gate else {})})
    if not gate:  # 고정 칸막이 발밑은 못 지나감
        blocks.append({'poly': [[x0 * K, 292 * K], [x1 * K, 292 * K], [x1 * K, PBOT * K], [x0 * K, PBOT * K]], 'h': 999})
def door(x0, x1, y0, y1, anim='none'): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'anim': anim, 'behind': 'dark'}
doors = {
    'main': {'kind': 'glass', 'x': 110 * K, 'y': 330 * K, 'to': 'street', 'toDoor': 'main', 'label': '현관', 'door': door(60, 150, 120, 330)},
    'elev': {'kind': 'elevator', 'x': 848 * K, 'y': 330 * K, 'label': '엘리베이터', 'door': door(800, 897, 145, 327)},
}
# 바닥(1x): 왼쪽 비스듬한 유리벽, 가운데 데스크 앞, 칸막이 뒤(키오스크 앞)까지, 오른쪽 비스듬한 벽
floor = [[60, 338], [150, 306], [466, 306], [466, 292], [700, 292], [940, 334], [940, 418], [60, 418]]
m = {'file': 'hq_f1_strip', 'bgScale': K, 'w': W, 'h': H, 'under': False,
     'floor': [[x * K, y * K] for x, y in floor], 'lane': [292 * K, 418 * K],
     'blocks': blocks, 'doors': doors, 'lamps': [], 'spots': [], 'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, list(doors), [o['id'] for o in objects])
