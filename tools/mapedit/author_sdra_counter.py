"""특수재난대응협회 2층 창구 장면 원본 (2026-11-02, 사용자 13:30 「이걸로 킵하고 따기 진행해」).
그림: game-src/art/pixellab-hq-20261031/sdra_counter_p7_ext1L_v2.png (952×424, p7 + 왼쪽 잇기 v2). 배경 2배 = 1904×848.
바닥 윗선(1배, 4배 격자·픽셀 값으로 읽음): 창구 밑 검은 윤곽 y314 → 바닥 316, 칸막이 기둥(519~528, 743~752) 밑 326 → 328,
창구 왼쪽 끝판(272~292) 밑 324 → 326, 왼쪽 통로 앞줄 물건 밑: 책장 0~108 y299→301, 파란 상자 108~165 y298→300,
종이 상자 165~218 y295→297, 서랍장 앞 218~272 → 300. 왼쪽 끝 = 출입구(사용자 13:? 핀 「출입구는 이쪽」).
대기의자 C06 셋(오브젝트, game-src/action/objects/C06_대기의자_3인): 창구 세 칸 앞 x 800/1270/1700(2배), 다리 바닥 y835, 그림 1배×1.5.
의자는 바닥 한가운데 물건 → 그림(오브젝트, sortY=다리 바닥)으로 앞뒤 가림, 막힘 = 다리 자국(뒷다리 y96~앞다리 y124) ±12.
창구 직원 자리 3(창구 안쪽 띠, 왼쪽 통로로 드나듦): 서윤지·차여진 고정, 오른쪽 = 협회 직원 돌림.
출력: game-src/mapedit/sdra_counter/ → python3 tools/mapedit/import.py game-src/mapedit/sdra_counter sdra_counter"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/art/pixellab-hq-20261031/sdra_counter_p7_ext1L_v2.png'
BENCH = ROOT / 'game-src/action/objects/C06_대기의자_3인/north.png'
OUT = ROOT / 'game-src/mapedit/sdra_counter'; OUT.mkdir(parents=True, exist_ok=True)
K = 2
im = Image.open(SRC).convert('RGB'); im.save(OUT / 'sdra_counter.png')
W, H = im.width * K, im.height * K
# 바닥 윗선 (1배 x0, x1, y). 11-02 13:45 사용자 「저 안으로 어떻게 들어가냐」 → 창구 안쪽(직원 자리)도 바닥.
# 왼쪽 통로(파란 서랍장 오른쪽 x266~창구 끝판 x272)로 끝판 뒤를 돌아 창구 안쪽 띠(뒤 책상 밑 y227 아래 ~ 창구 뒷면)로 들어간다.
# 서랍장 밑 검은 윤곽 y268 → 270. 창구 안쪽 띠 윗선 = y266(13:53 사용자 「얜 왜 이렇게 높이 올라가냐」: 뒤 책상 밑 y232까지 열었더니 뒤 사무공간에 선 것처럼 보임 → 직원 자리 바닥 277 바로 뒤까지만).
# 13:54 사용자 「이런 거 모서리」: 왼쪽(x0~271)은 계단 네모 말고 열마다 물건 밑 검은 윤곽선(맨 아래 어두운 점, max≤60)을 읽어
# +2 → 상자·서랍장 비스듬한 밑 모서리를 그대로 따라감. 윤곽이 흐린 외톨이 열은 둘레 5열 중간값으로 메움.
# x267~271(서랍장~끝판 사이 5px 틈)은 사람 폭보다 좁아 서랍장 밑선 끝값을 이어 씀. x272~ = 창구 안쪽 띠 윗선 288.
import numpy as _np
_A = _np.array(im).astype(int); _dk = _A.max(2) <= 60
_raw = []
for x in range(272):
    y = 335
    while y > 150 and not _dk[y, x]: y -= 1
    _raw.append(y)
# 물건 속 세로 윤곽(상자 접힌 면 등)에 걸린 열은 버리고 양옆 값으로 잇는다: 책장·상자 줄(x<218)은 밑선이 y280 아래,
# 서랍장(218~266)은 y245 아래에만 있음(4배로 확인).
_ok = [(_raw[x] >= 280) if x < 218 else (_raw[x] >= 245) for x in range(272)]
_fix = list(_raw)
for x in range(272):
    if not _ok[x]:
        l = next((i for i in range(x - 1, -1, -1) if _ok[i]), None); r = next((i for i in range(x + 1, 272) if _ok[i]), None)
        _fix[x] = max(_raw[l] if l is not None else 0, _raw[r] if r is not None else 0)
for a, b in [(0, 218), (218, 267)]:   # 외톨이 한두 열 튐(쓰레기통·서랍장 모서리의 세로 윤곽) → 같은 물건 줄 안에서만 양옆 큰 값
    snap = list(_fix)
    for x in range(a + 2, b - 2):
        nb = max(snap[x - 2], snap[x + 2])
        if snap[x] < nb - 6 and snap[x] < min(snap[x - 2], snap[x + 2]): _fix[x] = nb
_med = _fix
LEFT = [m + 2 for m in _med]
for x in range(267, 272): LEFT[x] = 231   # 서랍장~끝판 사이 통로는 뒤로 y229까지 보임(14:10 사용자: 안으로 들어가는 길)
poly = []
for x in range(272): poly += [[x * K, LEFT[x] * K], [(x + 1) * K, LEFT[x] * K]]
poly += [[272 * K, 232 * K], [952 * K, 232 * K]]   # 창구 안쪽 바닥: 뒤 책상 밑 y227 → 232 (13:53 원근 지적은 사람 크기 문제였음, 띠를 좁히면 길이 끊김)
floor = [[0, H]] + poly + [[W, H]]
# 창구 몸체 막힘(구멍): 앞 밑선은 앞 판과 같음(창구 밑 316, 칸막이 기둥 519~529·743~753 밑 328, 끝판 밑 324→대각선 292,316),
# 뒷면은 끝판 뒤끝 깊이로 y300. 끝판 왼쪽 x270에서 y312까지만 막아 그 뒤(y<312)로 돌아 들어갈 수 있게.
CB = [(270, 326), (284, 326), (293, 317), (519, 317), (519, 329), (529, 329), (529, 317), (743, 317), (743, 329), (753, 329),
      (753, 317), (952, 317), (952, 304), (286, 304), (272, 312)]
counter_block = {'poly': [[x * K, y * K] for x, y in CB], 'h': 999}
# 창구 가림(안쪽 사람 앞에 그림): 창구 윗면 뒤 윤곽 y229 아래 몸체 전부 + 그 위로 솟은 물건·칸막이·끝판은
# 손으로 읽은 상자 안에서 검은 윤곽선을 따라 딴다(상자 가장자리에서 윤곽을 못 넘고 번지는 곳 = 뒤 배경).
import io, base64
import numpy as np
A = np.array(im).astype(int); IH, IW = A.shape[:2]
# 11-02 14:16 사용자 「이거 제대로 안따냐」(가림판·끝판·서랍장): 자동 번짐 따기(trace_in_box)가 물건 속으로 새어 뒤 사람 다리가 앞에 나옴.
# → 창구 위 물건은 전부 검은 윤곽선 꼭짓점을 6~12배 격자에서 손으로 읽은 다각형(1배)으로 딴다. y229 = 창구 윗면 뒤 윤곽선.
HAND = {
 '끝판': [(272, 207), (276, 203), (288, 200), (300, 196), (316, 193), (326, 190), (328, 190), (328, 212), (332, 216), (336, 221), (339, 226), (340, 230), (272, 230)],
 '가림판': [(371, 207), (375, 203), (385, 199), (395, 196), (401, 194), (403, 196), (403, 230), (371, 230)],
 '스테이플러': [(462, 224), (465, 219), (470, 219), (472, 224), (474, 230), (460, 230)],
 '프린터': [(478, 230), (483, 224), (497, 223), (497, 207), (500, 204), (513, 203), (516, 206), (516, 223), (521, 223), (521, 230)],
 '칸막이A': [(516, 198), (522, 191), (530, 186), (538, 183), (542, 183), (542, 230), (516, 230)],
 '책A': [(542, 207), (552, 205), (556, 202), (570, 201), (572, 204), (572, 230), (542, 230)],
 '펜꽂이': [(574, 219), (578, 213), (586, 213), (589, 219), (590, 230), (573, 230)],
 '도장': [(592, 224), (596, 217), (601, 217), (603, 224), (604, 230), (592, 230)],
 '모니터1': [(664, 197), (668, 194), (706, 193), (709, 196), (709, 230), (664, 230)],
 '서랍': [(710, 215), (714, 212), (740, 211), (740, 230), (710, 230)],
 '칸막이B': [(729, 186), (731, 184), (735, 184), (745, 191), (750, 195), (750, 230), (729, 230)],
 '책B': [(751, 212), (756, 208), (764, 208), (770, 212), (771, 230), (751, 230)],
 '도장2': [(793, 222), (796, 219), (800, 219), (802, 222), (803, 230), (793, 230)],
 '모니터2': [(877, 198), (882, 196), (918, 196), (921, 199), (921, 230), (877, 230)],
 '칸막이R': [(921, 186), (924, 183), (935, 185), (950, 188), (952, 189), (952, 230), (921, 230)],
}
def hand_mask(polys):
    mi = Image.new('L', (IW, IH), 0); dm = ImageDraw.Draw(mi)
    for pts in polys: dm.polygon(pts, fill=255, outline=255)
    return np.array(mi) > 0
cmask = hand_mask(HAND.values())
for x in range(272, IW):
    bot = 324 if x <= 284 else 324 - (x - 284) if x <= 292 else 328 if (519 <= x <= 529 or 743 <= x <= 753) else 316
    cmask[229:bot + 1, x] = True   # 창구 몸체(윗면 뒤 윤곽 y229 ~ 밑선)
Image.fromarray((cmask * 255).astype('uint8')).save(OUT / 'counter_cover_mask_1x.png')
big = Image.fromarray((cmask * 255).astype('uint8')).resize((W, H), Image.NEAREST); bb = big.getbbox()
buf = io.BytesIO(); big.crop(bb).save(buf, 'PNG')
# 통로 옆 파란 서랍장(+위 종이 더미): 손으로 읽은 검은 윤곽. 오른쪽 옆면 밑 모서리 (242,268)→(265,256).
CAB = [(216, 174), (221, 172), (244, 172), (249, 176), (250, 179), (260, 179), (261, 199), (266, 200), (266, 256), (242, 268), (226, 268), (226, 246), (212, 244), (212, 205), (216, 205)]
cab = hand_mask([CAB])
Image.fromarray((cab * 255).astype('uint8')).save(OUT / 'cabinet_cover_mask_1x.png')
cbig = Image.fromarray((cab * 255).astype('uint8')).resize((W, H), Image.NEAREST); cbb = cbig.getbbox()
cbuf = io.BytesIO(); cbig.crop(cbb).save(cbuf, 'PNG')
cabinet_cover = {'id': 'cabinet_cover', 'x': cbb[0], 'y': cbb[1], 'w': cbb[2] - cbb[0], 'h': cbb[3] - cbb[1], 'sortY': 262 * K,
                 'coverMask': 'data:image/png;base64,' + base64.b64encode(cbuf.getvalue()).decode()}
counter_cover = {'id': 'counter_cover', 'x': bb[0], 'y': bb[1], 'w': bb[2] - bb[0], 'h': bb[3] - bb[1], 'sortY': 316 * K,
                 'coverMask': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()}
# 대기의자
BSC = 1.5; BXS = [800, 1270, 1700]; FOOT_Y = 835
b = Image.open(BENCH).convert('RGBA'); bw, bh = round(b.width * BSC), round(b.height * BSC)
bimg = b.resize((bw, bh), Image.NEAREST); bimg.save(OUT / 'sdra_counter_bench.png')
sm = Image.new('L', b.size, 0); ImageDraw.Draw(sm).rounded_rectangle((10, 98, 212, 125), radius=10, fill=int(255 * 0.45))
sh = Image.new('RGBA', b.size, (40, 32, 26, 0)); sh.putalpha(sm.filter(ImageFilter.GaussianBlur(3)))
sh.resize((bw, bh), Image.NEAREST).save(OUT / 'sdra_counter_bench_shadow.png')
objects, blocks, spots = [counter_cover, cabinet_cover], [counter_block], []
SEATS = [(40, 61), (111.5, 61), (183.5, 61)]   # 잘라낸 판 1배: 좌석 점(사무의자 north 좌석 점과 같은 뜻)
for i, bx in enumerate(BXS):
    ox, oy = round(bx - 110.5 * BSC), round(FOOT_Y - 124 * BSC)
    objects.append({'id': f'bench{i+1}_shadow', 'file': 'sdra_counter_bench_shadow.png', 'x': ox, 'y': oy, 'w': bw, 'h': bh, 'sortY': 0, 'kind': 'shadow'})
    objects.append({'id': f'bench{i+1}', 'file': 'sdra_counter_bench.png', 'x': ox, 'y': oy, 'w': bw, 'h': bh, 'sortY': FOOT_Y, 'kind': 'chair'})
    x0, x1 = round(ox + 13 * BSC) - 12, round(ox + 210 * BSC) + 12; y0 = round(oy + 96 * BSC)
    blocks.append({'poly': [[x0, y0], [x1, y0], [x1, H], [x0, H]], 'h': 999})
    for j, (sx, sy) in enumerate(SEATS):
        x = round(ox + sx * BSC)
        spots.append({'id': f'wait{i+1}_{j+1}', 'x': x, 'y': FOOT_Y, 'shared': True, 'verb': '앉기', 'face': 1, 'act': ['sit_back'],
                      'seat': {'x': x, 'y': FOOT_Y}, 'bench': 'C06', 'seatPt': {'x': x, 'y': round(oy + sy * BSC)}})
# 창구 직원 자리(창구 뒤, 사무의자 C01 정면, 2배 x·바닥 y, 미리보기 tools/objects/sdra_counter_sit_preview.py 값)
for sid, x, who in [('clerk1', 914, '서윤지'), ('clerk2', 1274, '차여진'), ('clerk3', 1704, None)]:
    spots.append({'id': sid, 'x': x, 'y': 555, **({'owner': who} if who else {'owner_pool': '협회 직원'}), 'verb': '앉기', 'face': 0,
                  'act': ['sit_front'], 'seat': {'x': x, 'y': 555}, 'chairImg': 'south-east.png', 'staffOnly': True, 'scale': 1.2})
doors = {'out': {'kind': 'exit', 'side': 'W', 'x': 24, 'y': 720, 'to': 'sdra_f2', 'toDoor': 'office', 'label': '복도로'}}
m = {'file': 'sdra_counter', 'bgScale': K, 'w': W, 'h': H, 'under': False, 'floor': floor, 'lane': [min(p[1] for p in poly), H - 12],
     'blocks': blocks, 'doors': doors, 'lamps': [], 'spots': spots, 'objects': objects,
     'note': '사람 배율: 대기의자에 앉은 사람 1.6(다리 바닥 y835), 창구 직원 1.2(바닥 555). 서 있는 사람 배율 표는 필드 연결 때 정함.'}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, len(blocks), len(spots), len(objects))
