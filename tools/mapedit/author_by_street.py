"""백일몽(강남) 거리(by_street) 장면 원본 만들기 (사용자 2026-11-02 16:07 「둘다 쓴다. 이대로 합쳐서 픽스」, 16:15 「이거 땄어? 라인이랑 상호작용?」).
그림: game-src/art/pixellab-street-1102/by_street_p6_full_fix.png (p6 + 왼쪽 잇기6 + 오른쪽 잇기6, 1312×424). 배경 2배 = 2624×848.
사람 배율(사용자 14:00 거리 원근 12%, 맨 뒤 크기는 그 거리 문으로): 백일몽 유리 양문 문짝 1x y150~293(143 → 2배 286) × 0.87 ≈ 249px = 맨 뒤,
  맨 앞 +12% ≈ 278px → dotK 1.19, far 0.895 (맨 뒤 = dotK × far × 234).
걷는 바닥: 인도만(건물 밑선 ~ 연석 위 1x y366), 차도는 못 감. 바닥 윗선은 4배 확대로 건물·기둥 밑선을 손으로 읽은 꺾은선(+2).
  맨 왼쪽 건물(잇기6) 밑선은 비스듬해(1x x0 y272 → x190 y298) 그대로 따라간다.
가림: 인도 한가운데 물건 = 정류장 표지 기둥 하나뿐. 다각형 안에서 줄마다 검은 윤곽선 처음~끝만 채움.
벽에 붙은 물건(작은 함 x1018~1030, 환기 함은 기둥 밑선 안쪽)은 가림 없이 바닥선이 그 앞을 돌아감.
문: 「백일몽 주식회사」 간판 아래 유리 양문(1x x720~872, y140~293) → 백일몽 1층 로비 정문. 버스 정류장 = 맨 왼쪽 표지 기둥(강남).
출력: game-src/mapedit/by_street/ → python3 tools/mapedit/import.py game-src/mapedit/by_street by_street"""
import json
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'game-src/art/pixellab-street-1102'
OUT = ROOT / 'game-src/mapedit/by_street'; OUT.mkdir(parents=True, exist_ok=True)
for f in OUT.glob('part_*.png'): f.unlink()
K = 2
orig = Image.open(ART / 'by_street_p6_full_fix.png').convert('RGB')
orig.save(OUT / 'by_street.png')
W, H = orig.width * K, orig.height * K
Y0, Y1 = 296, 366   # 걷는 띠(1x): 문 앞 밑선 ~ 연석 위
# 건물 밑선(1x, 손으로 읽음, 서→동). 바닥 윗선 = 이 선 +2
BASE = [(0, 272), (28, 274), (58, 276), (62, 282), (118, 283), (122, 287), (150, 290), (186, 292), (188, 300), (232, 300), (236, 296),
        (368, 296), (370, 302), (406, 302), (410, 297), (524, 300), (582, 300), (585, 297), (678, 297), (680, 299), (720, 299), (722, 293),
        (868, 293), (870, 298), (910, 298), (912, 292), (1015, 292), (1016, 303), (1029, 303), (1030, 293), (1036, 293), (1037, 296), (1063, 296), (1064, 292), (1198, 292),
        (1199, 302), (1283, 302), (1285, 292), (1312, 292)]
# (id, 다각형들(1x), 밑동 y(1x) = 깊이선, 막힘 x범위(1x))
PARTS = [
    ('stop_sign', [[(29, 194), (54, 194), (54, 261), (47, 262), (47, 360), (51, 360), (51, 367), (33, 367), (33, 360), (37, 360), (37, 262), (29, 261)]], 365, (36, 48)),
]
px = orig.load()
lum = lambda p: (p[0] + p[1] + p[2]) / 3
objects, holes = [], []
for oid, polys, base, (bx0, bx1) in PARTS:
    poly = Image.new('L', orig.size, 0); d = ImageDraw.Draw(poly)
    for q in polys: d.polygon(q, fill=255)
    pp = poly.load(); x0, y0, x1, y1 = poly.getbbox()
    mk = Image.new('L', orig.size, 0); mp = mk.load()
    for y in range(y0, y1):
        runs, cur = [], None
        for x in range(x0, x1 + 1):
            if x < x1 and pp[x, y]: cur = [x, x] if cur is None else [cur[0], x]
            elif cur: runs.append(cur); cur = None
        for a, b in runs:
            dk = [x for x in range(a, b + 1) if lum(px[x, y]) < 60]
            if len(dk) < 2: continue
            for x in range(min(dk), max(dk) + 1): mp[x, y] = 255
    bb = mk.getbbox(); cx0, cy0, cx1, cy1 = bb
    im = orig.crop(bb).convert('RGBA'); im.putalpha(mk.crop(bb))
    im = im.resize((im.width * K, im.height * K), Image.NEAREST); im.save(OUT / f'part_{oid}.png')
    objects.append({'id': oid, 'file': f'part_{oid}', 'x': cx0 * K, 'y': cy0 * K, 'w': (cx1 - cx0) * K, 'h': (cy1 - cy0) * K, 'sortY': base * K})
    holes.append({'poly': [[(bx0 - 4) * K, (base - 6) * K], [(bx1 + 4) * K, (base - 6) * K], [(bx1 + 4) * K, (base + 2) * K], [(bx0 - 4) * K, (base + 2) * K]], 'h': 999})
def door(x0, x1, y0, y1): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'anim': 'none', 'behind': 'dark'}
doors = {
    'main': {'kind': 'glass', 'x': 796 * K, 'y': 296 * K + 10, 'to': 'by_lobby', 'toDoor': 'main', 'label': '백일몽 주식회사', 'door': door(720, 872, 140, 293)},
    'bus': {'kind': 'exit', 'x': 42 * K, 'y': 290 * K + 10, 'label': '버스 정류장', 'door': door(29, 54, 194, 300)},
}
floor_top = [[x * K, (y + 2) * K] for x, y in BASE]
m = {'file': 'by_street', 'bgScale': K, 'dotK': 1.19, 'far': 0.895, 'w': W, 'h': H, 'under': True,
     'floor': floor_top + [[W, Y1 * K + 12], [0, Y1 * K + 12]], 'lane': [Y0 * K, Y1 * K],
     'blocks': holes, 'doors': doors, 'lamps': [], 'spots': [], 'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, list(doors), [o['id'] for o in objects])
