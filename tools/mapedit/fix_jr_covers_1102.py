"""중림 가림 손질 (2026-11-02, 스레드 「중림 사무실별 가구 배치」).

4배 확대 그림을 눈으로 보고 검은 윤곽선 꼭짓점을 1배 좌표로 손으로 읽은 다각형.
- jr_daebak plant : 화분·우산꽂이 (뒤 유리창까지 들어가 있던 것 → 물건만)
- jr_heolgap fan  : 왼쪽 앞 선풍기 (없던 가림 새로)
- jr_op table     : 수술대 (상판 아래 바닥 넓게 들어가 있던 것 → 상판·기둥·받침판만)
map.json 좌표는 2배, 다각형은 1배로 적고 2배로 그린다.
"""
import base64, io, json, sys
from PIL import Image, ImageDraw

ROOT = 'game-src/mapedit'

POLYS = {
    ('jr_daebak', 'plant'): dict(name='화분·우산꽂이', sortY=820, polys=[
        # 잎 + 줄기
        [(3, 250), (8, 235), (15, 228), (30, 230), (40, 240), (45, 255), (55, 260), (62, 268), (60, 278), (50, 282),
         (46, 300), (36, 302), (35, 370), (25, 370), (25, 302), (12, 300), (4, 293)],
        # 위쪽 갈색 잎 끝
        [(36, 228), (42, 224), (47, 235), (52, 250), (46, 252), (40, 240)],
        # 화분
        [(8, 372), (20, 368), (45, 368), (54, 373), (54, 385), (50, 422), (15, 422), (10, 385)],
        # 우산꽂이 + 우산
        [(36, 298), (42, 296), (48, 305), (55, 300), (68, 292), (70, 285), (76, 284), (80, 290), (80, 300), (76, 310),
         (80, 330), (80, 400), (72, 405), (45, 405), (38, 398), (38, 330), (36, 320)],
    ]),
    ('jr_heolgap', 'fan'): dict(name='선풍기', sortY=822, polys=[
        # 머리(날개 테 + 왼쪽 모터)
        [(25, 310), (30, 306), (40, 306), (42, 295), (50, 287), (60, 285), (70, 290), (75, 305), (75, 330), (72, 345),
         (65, 350), (50, 350), (43, 342), (40, 325), (30, 325), (25, 320)],
        # 기둥
        [(37, 345), (48, 345), (48, 392), (37, 392)],
        # 받침
        [(32, 392), (40, 387), (66, 387), (74, 394), (74, 404), (69, 411), (38, 411), (32, 405)],
    ]),
    ('jr_op', 'table'): dict(name='수술대', sortY=670, polys=[
        # 상판(옆면 포함)
        [(207, 233), (411, 233), (420, 241), (420, 258), (384, 258), (384, 262), (207, 262)],
        # 띠(왼·오른)
        [(252, 262), (265, 262), (265, 270), (252, 270)],
        [(360, 262), (372, 262), (372, 270), (360, 270)],
        # 상판 밑 다리·유압 머리
        [(283, 262), (356, 262), (356, 272), (343, 272), (343, 283), (296, 283), (296, 272), (283, 272)],
        # 기둥 + 칼라
        [(300, 283), (335, 283), (335, 300), (338, 300), (338, 310), (297, 310), (297, 300), (300, 300)],
        # 받침판
        [(276, 307), (355, 307), (360, 312), (360, 335), (272, 335), (272, 312)],
    ]),
}


def mask_for(polys):
    xs = [p[0] for poly in polys for p in poly]; ys = [p[1] for poly in polys for p in poly]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs) + 1, max(ys) + 1
    mk = Image.new('L', ((x1 - x0) * 2, (y1 - y0) * 2), 0)
    d = ImageDraw.Draw(mk)
    for poly in polys:
        d.polygon([((x - x0) * 2, (y - y0) * 2) for x, y in poly], fill=255)
    return x0 * 2, y0 * 2, mk


def main():
    for (scene, oid), spec in POLYS.items():
        path = f'{ROOT}/{scene}/map.json'
        m = json.load(open(path))
        x, y, mk = mask_for(spec['polys'])
        buf = io.BytesIO(); mk.convert('RGB').save(buf, 'PNG')
        obj = {'id': oid, 'name': spec['name'], 'file': '', 'x': x, 'y': y, 'w': mk.width, 'h': mk.height,
               'sortY': spec['sortY'], 'coverMask': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()}
        for i, o in enumerate(m['objects']):
            if o['id'] == oid:
                m['objects'][i] = obj; break
        else:
            m['objects'].append(obj)
        json.dump(m, open(path, 'w'), ensure_ascii=False, indent=1)
        print(scene, oid, x, y, mk.size)


if __name__ == '__main__':
    main()
