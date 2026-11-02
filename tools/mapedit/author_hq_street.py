"""관리국(종로) 거리(street) 장면 원본 만들기 (사용자 2026-11-02 12:21 「이걸 그대로 쓰고 청진빌딩 출입구를 관리국 출입구로」, 「버스정류장이랑 출입구 오브젝트화, 레이어 가림 따고 진행」).
그림: game-src/art/pixellab-street-1102/hq_street_final_1272x424.png (p5 + 왼쪽 잇기1 + 왼쪽 잇기2). 배경 2배 = 2544×848.
사람 배율: 출입문 틀(1x y143~280, 137px → 2배 274) × 0.82 ≈ 225px = 걷는 띠 맨 뒤(원근 0.85) → dotK = 225 / (큐라스 247 × 0.85) ≈ 1.07 → 미리보기에서 0.78배로 작아 1.12.
걷는 바닥: 인도만(건물 밑선 앞 1x y300 ~ 연석 위 y364), 차도는 못 감. 좌우 끝까지.
가림(사람이 뒤에 서면 앞에 그림): 인도 한가운데 물건만 — 정류장 표지 기둥·그 옆 회색 함·볼라드 4개·회색 함 2개·「종로」 안내판.
  손으로 읽은 다각형(6배 격자) 안에서 줄마다 검은 윤곽선 처음~끝만 채움. 안내판은 다리 사이(인도 보임)를 비움. 건물에 붙은 송수구·배관 기둥은 가림 없음.
막힘: 그 물건들 밑동(밑 8px, 옆 ±4px, 1x).
문: 관리국 출입구 = 「청진빌딩」 간판 아래 유리문(1x x774~876, y143~280) → 1층 로비 현관. 버스 정류장 = 표지 기둥(임시로 중림 지하상가 입구로, 예전 거리 동쪽 끝 연결을 옮김).
사람 배율 고침(사용자 13:59 「문에 비해 너무 작아」, 13:56 「앞으로 나와도 급격히 커지면 안 돼」): 문 앞 맨 뒤 245px(문 274의 0.89), 맨 앞 +6% 260px → dotK 1.11, far 0.94.
출력: game-src/mapedit/street/ → python3 tools/mapedit/import.py game-src/mapedit/street street"""
import json
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'game-src/art/pixellab-street-1102'
OUT = ROOT / 'game-src/mapedit/street'; OUT.mkdir(parents=True, exist_ok=True)
for f in OUT.glob('part_*.png'): f.unlink()
K = 2
orig = Image.open(ART / 'hq_street_final_1272x424.png').convert('RGB')
orig.save(OUT / 'hq_street.png')
W, H = orig.width * K, orig.height * K
Y0, Y1 = 300, 364   # 걷는 띠(1x)
def R(x0, y0, x1, y1): return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
# (id, 다각형들(1x), 밑동 y(1x) = 깊이선, 막힘 x범위(1x))
PARTS = [
    ('stop_sign', [[(43, 158), (87, 158), (87, 231), (70, 235), (70, 361), (58, 361), (58, 235), (43, 231)]], 360, (58, 71)),
    ('stop_box', [R(83, 310, 112, 359)], 358, (83, 112)),
    ('bollard1', [R(478, 332, 492, 358)], 357, (478, 492)),
    ('bollard2', [R(607, 317, 628, 358)], 357, (607, 628)),
    ('boxes', [R(1076, 327, 1099, 362), R(1096, 317, 1130, 362)], 361, (1076, 1130)),
    ('bollard3', [R(1132, 302, 1146, 358)], 357, (1132, 1146)),
    ('board', [R(1161, 227, 1221, 313), R(1161, 313, 1170, 362), R(1203, 313, 1214, 362), R(1155, 355, 1176, 362), R(1198, 355, 1221, 362)], 361, (1157, 1219)),
    ('bollard4', [R(1244, 302, 1259, 358)], 357, (1244, 1259)),
]
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
def door(x0, x1, y0, y1): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'anim': 'none', 'behind': 'dark'}
doors = {
    'main': {'kind': 'glass', 'x': 825 * K, 'y': Y0 * K + 10, 'to': 'lobby', 'toDoor': 'main', 'label': '관리국 현관', 'door': door(774, 876, 143, 280)},
    'jr': {'kind': 'door', 'x': 64 * K, 'y': Y0 * K + 10, 'to': 'jr_entry', 'toDoor': 'west', 'label': '버스 정류장', 'door': door(47, 86, 160, 300)},
}
m = {'file': 'hq_street', 'bgScale': K, 'dotK': 1.11, 'far': 0.94, 'w': W, 'h': H, 'under': True,
     'floor': [[0, Y0 * K], [W, Y0 * K], [W, Y1 * K + 12], [0, Y1 * K + 12]], 'lane': [Y0 * K, Y1 * K],
     'blocks': holes, 'doors': doors, 'lamps': [], 'spots': [], 'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, list(doors), [o['id'] for o in objects])
