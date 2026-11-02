"""협회(영등포) 거리(sdra_street) 장면 원본 만들기 (사용자 2026-11-02 13:46 「아쉬운대로 쓴다. 따고 오브젝트 연결하고」, 13:47 「버스정류장이랑 협회 출입문은 상호작용 연결 잘하고」).
그림: game-src/art/pixellab-street-1102/sd_street_final_1232x424.png (협회 p2 + 왼쪽 잇기1 v2(베이지→회색) + 오른쪽 잇기1). 배경 2배 = 2464×848.
사람 배율(사용자 13:56 「문이 작기 때문에 앞으로 나와도 급격하게 커지면 안 돼」): 협회 유리문 1x y138~290(152 → 2배 304) × 0.82 ≈ 249px = 걷는 띠 맨 뒤. 에일린 몸 234px → 맨 뒤 1.065, 맨 앞은 6%만 더 커지게 → dotK 1.13, far 0.94. 14:00 사용자 「문에 비해 너무 커」: 유리문 문짝(1x y166~289, 2배 246) 기준 맨 뒤 214px(0.87), 앞 +6% 227px → dotK 0.97, far 0.94.
걷는 바닥: 인도만(건물 밑선 앞 1x y302 ~ 연석 위 y364), 차도는 못 감. 좌우 끝까지.
가림(사람이 뒤에 서면 앞에 그림): 인도 한가운데 물건만 — 정류장 표지 기둥·볼라드 3개·가로등 기둥. 4배 격자로 손으로 읽은 다각형 안에서 줄마다 검은 윤곽선 처음~끝만 채움.
벽에 붙은 소화전·배관 밸브·전기함은 가림 없음, 막힘만(바닥선이 그 앞을 돌아감).
문: 협회 출입문 = 「특수재난대응협회」 간판 아래 유리 자동문(1x x590~800, y133~290) → 협회 1층 정문. 버스 정류장 = 맨 왼쪽 표지 기둥(노선 고르기: 종로·영등포·중림).
14:00 「6%는 너무 적지 않냐」 → 앞 +12%: 맨 뒤 215, 맨 앞 240 (dotK 1.025, far 0.895).
출력: game-src/mapedit/sdra_street/ → python3 tools/mapedit/import.py game-src/mapedit/sdra_street sdra_street"""
import json
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'game-src/art/pixellab-street-1102'
OUT = ROOT / 'game-src/mapedit/sdra_street'; OUT.mkdir(parents=True, exist_ok=True)
for f in OUT.glob('part_*.png'): f.unlink()
K = 2
orig = Image.open(ART / 'sd_street_final_1232x424.png').convert('RGB')
orig.save(OUT / 'sdra_street.png')
W, H = orig.width * K, orig.height * K
Y0, Y1 = 302, 364   # 걷는 띠(1x)
def R(x0, y0, x1, y1): return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
# (id, 다각형들(1x), 밑동 y(1x) = 깊이선, 막힘 x범위(1x))
PARTS = [
    ('stop_sign', [[(40, 117), (76, 117), (76, 268), (63, 270), (63, 366), (51, 366), (51, 270), (40, 268)]], 365, (51, 63)),
    ('bollard1', [R(195, 266, 209, 321)], 319, (195, 209)),
    ('pole', [R(371, 0, 389, 368)], 366, (371, 389)),
    ('bollard2', [R(347, 266, 362, 322)], 320, (347, 362)),
    ('bollard3', [R(432, 264, 450, 322)], 319, (432, 450)),
]
# 벽에 붙은 물건: 가림 없이 막힘만 (x0, x1, 앞 끝 y) 1x
WALL = [(320, 349, 306), (400, 424, 310)]
# 건물 밑선이 앞으로 나온 곳(전기함·세진빌딩 기둥 x856~1000은 y306, 그 오른쪽 기둥·문턱은 y304): 바닥 윗선을 그 밑 +2로
STEPS = [(0, Y0), (856, 308), (1000, 306)]
px = orig.load()
lum = lambda p: (p[0] + p[1] + p[2]) / 3
objects, holes = [], []
for oid, polys, base, (bx0, bx1) in PARTS:
    poly = Image.new('L', orig.size, 0); d = ImageDraw.Draw(poly)
    for q in polys: d.polygon(q, fill=255)
    pp = poly.load(); x0, y0, x1, y1 = poly.getbbox()
    mk = Image.new('L', orig.size, 0); mp = mk.load()
    # 줄마다 다각형 안 검은 윤곽선(밝기<60) 처음~끝 (다리 사이처럼 다각형이 끊긴 줄은 조각마다)
    for y in range(y0, y1):
        runs, cur = [], None
        for x in range(x0, x1 + 1):
            if x < x1 and pp[x, y]: cur = [x, x] if cur is None else [cur[0], x]
            elif cur: runs.append(cur); cur = None
        for a, b in runs:
            dk = [x for x in range(a, b + 1) if lum(px[x, y]) < 60]
            if len(dk) < 2: continue   # 윤곽선 없는 줄은 비움(다각형 폭 그대로 채우면 인도 띠가 가림이 됨)
            for x in range(min(dk), max(dk) + 1): mp[x, y] = 255
    bb = mk.getbbox(); cx0, cy0, cx1, cy1 = bb
    im = orig.crop(bb).convert('RGBA'); im.putalpha(mk.crop(bb))
    im = im.resize((im.width * K, im.height * K), Image.NEAREST); im.save(OUT / f'part_{oid}.png')
    mk.save(Path('/tmp/claude-0/z') / f'_mask_{oid}.png')
    objects.append({'id': oid, 'file': f'part_{oid}', 'x': cx0 * K, 'y': cy0 * K, 'w': (cx1 - cx0) * K, 'h': (cy1 - cy0) * K, 'sortY': base * K})
    holes.append({'poly': [[(bx0 - 4) * K, (base - 8) * K], [(bx1 + 4) * K, (base - 8) * K], [(bx1 + 4) * K, (base + 2) * K], [(bx0 - 4) * K, (base + 2) * K]], 'h': 999})
for wx0, wx1, wy in WALL:
    holes.append({'poly': [[wx0 * K, Y0 * K - 4], [wx1 * K, Y0 * K - 4], [wx1 * K, (wy + 2) * K], [wx0 * K, (wy + 2) * K]], 'h': 999})
def door(x0, x1, y0, y1): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'anim': 'none', 'behind': 'dark'}
doors = {
    'main': {'kind': 'glass', 'x': 695 * K, 'y': Y0 * K + 10, 'to': 'sdra_lobby', 'toDoor': 'main', 'label': '특수재난대응협회', 'door': door(590, 800, 133, 290)},
    'bus': {'kind': 'exit', 'x': 57 * K, 'y': Y0 * K + 10, 'label': '버스 정류장', 'door': door(40, 76, 117, 300)},
}
floor_top = []
for i, (sx, sy) in enumerate(STEPS):
    ex = STEPS[i + 1][0] if i + 1 < len(STEPS) else W // K
    floor_top += [[sx * K, sy * K], [ex * K, sy * K]]
m = {'file': 'sdra_street', 'bgScale': K, 'dotK': 1.025, 'far': 0.895, 'w': W, 'h': H, 'under': True,
     'floor': floor_top + [[W, Y1 * K + 12], [0, Y1 * K + 12]], 'lane': [Y0 * K, Y1 * K],
     'blocks': holes, 'doors': doors, 'lamps': [], 'spots': [], 'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, list(doors), [o['id'] for o in objects])
