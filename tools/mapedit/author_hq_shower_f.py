"""본부 지하 1층 여자 탈의실(shower_f) 장면 원본 만들기 (2026-11-01 14:23 사용자 「일단 여자 탈의실은 이걸로 쓴다」).
그림: game-src/art/pixellab-hq-20261031/hq_shower_f_p1_632x424.png (원근 있는 방, 왼쪽 옆벽 유리문). 배경 2배 = 1264×848.
사용자 결정: 왼쪽 유리문 = 목욕탕 가는 문(별도 장면, 아직 없음 → 잠금), 탈의실 입구 = 화면 아래쪽.
좌표(1x)는 5px 격자 4배 확대로 윤곽선을 읽었다(scratchpad z_lockL·z_lockR·z_van·z_lw).
- 바닥선: 왼쪽 옆벽 밑 (0,337)→(140,286), 뒷벽 밑 y286, 세면대 밑 (455,290)→(632,402).
- 사물함 왼쪽 줄: 앞면 x175~235·y166~343, 오른쪽 옆면 뒤 끝 x279(위 187, 아래 299). 발자국 (175,343)(235,343)(279,299)(241,299).
- 사물함 오른쪽 줄(거울 달린 끝면): 앞면 x375~427·y163~348, 왼쪽 옆면 뒤 끝 x356(위 184, 아래 303). 발자국 (375,348)(427,348)(395,303)(356,303).
- 빨래통(왼쪽 줄 앞) x172~223·y292~356, 왼쪽 아래 바구니 x0~53·y345~424.
- 원근: 지평선 y≈224(1x). 사람 크기는 게임의 dotK(앞 1.5·뒤 0.85)로.
출력: game-src/mapedit/shower_f/ → python3 tools/mapedit/import.py game-src/mapedit/shower_f shower_f"""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/art/pixellab-hq-20261031/hq_shower_f_p1_632x424.png'
OUT = ROOT / 'game-src/mapedit/shower_f'; OUT.mkdir(parents=True, exist_ok=True)
K = 2
im = Image.open(SRC).convert('RGB'); im.save(OUT / 'hq_shower_f_strip.png')
W, H = im.width * K, im.height * K
P = lambda pts: [[x * K, y * K] for x, y in pts]
# 맨 뒤는 y293(2배 585)까지만 걷기 (11-02 06:12 사용자 「저 뒤 안쪽까지 들어갈 필요 없어, 여기까지만」)
BACK = 293
# ── 11-02 06:23 사용자 「이거 레이아웃 딴거야?」 → 6배·4배 확대로 윤곽선을 읽어 다시 땀(1x 좌표) ──
# 왼쪽 옆벽(유리문) 밑선: (0,328)→(50,314)→(80,302)→(117,291)→(130,288) ≈ y = 328 - 0.31x, 문 앞 매트 2장은 바닥(밟음).
# 세면대 밑장 밑선: (462,292)→(632,397), 위 상판이 6px쯤 튀어나와 몸 반폭만큼 띄움. 드라이어·줄은 세면대에 붙은 것 → 바닥선만.
# 왼쪽 아래 바구니: 위 테 y346, 오른쪽 x52, 화면 밑까지.
WALL = lambda x: 328 - 0.31 * x + 4
floor = P([(62, 424), (62, 343), (0, 343), (0, round(WALL(0))), (126, BACK), (452, BACK), (632, 404), (632, 424)])
# 바닥 한가운데 물건 = 막힘(발자국 + 옆 8px) + 가림(윤곽선을 줄마다 읽은 다각형)
blocks = [
    {'poly': P([(164, 349), (246, 349), (290, 296), (290, 290), (164, 290)]), 'h': 999},  # 사물함 왼쪽 줄 (앞면 밑 y347, 옆면 밑 (236,346)→(280,296), 몸 반폭 10)
    {'poly': P([(347, 290), (347, 299), (367, 348), (435, 348), (435, 290)]), 'h': 999},  # 사물함 오른쪽 줄 (옆면 밑 (357,299)→(377,345), 앞면 x377~425 밑 y346)
    {'poly': P([(163, 346), (228, 346), (228, 361), (163, 361)]), 'h': 999},  # 빨래통 (밑 y358, x171~220)
    {'poly': P([(0, 346), (62, 346), (62, 424), (0, 424)]), 'h': 999},        # 왼쪽 아래 바구니
    {'poly': P([(39, 405), (113, 405), (113, 424), (39, 424)]), 'h': 999},    # 맨 아래 검은 가방 (x47~105, y411~)
    {'poly': P([(327, 299), (368, 299), (368, 314), (327, 314)]), 'h': 999},  # 오른쪽 사물함 뒤 왼쪽 운동가방 (x335~360, y297~311)
    {'poly': P([(419, 326), (465, 326), (465, 348), (419, 348)]), 'h': 999},  # 오른쪽 사물함 오른쪽 가방 (x425~457, y317~344)
    {'poly': P([(383, 348), (431, 348), (431, 369), (383, 369)]), 'h': 999},  # 체중계 (x389~425, y350~367, 납작해서 가림 없음)
]
SRC_IM = im
def outline_rows(x0, y0, x1, y1, dark=60):
    """윤곽선 따기: 상자 안에서 줄(y)마다 검은 윤곽선 픽셀의 맨 왼쪽·맨 오른쪽을 읽어 그 사이를 물건으로 본다."""
    L, R = [], []
    for y in range(y0, y1 + 1):
        xs = [x for x in range(x0, x1 + 1) if sum(SRC_IM.getpixel((x, y))) / 3 < dark]
        if xs: L.append((min(xs), y)); R.append((max(xs) + 1, y))
    pts = [(x, y) for x, y in L] + [(L[-1][0], L[-1][1] + 1), (R[-1][0], R[-1][1] + 1)] + [(x, y) for x, y in reversed(R)]
    return P(pts)
objects = [   # 가림: 사람보다 앞에 다시 그릴 그림 자리(다각형), sortY = 앞 발 y
    # 사물함 앞면: 한 장, sortY = 앞면 밑 윤곽선
    {'id': 'lockL', 'cover': [P([(174, 166), (236, 166), (236, 348), (174, 348)])], 'sortY': 347 * K},
    {'id': 'lockR', 'cover': [P([(376, 163), (428, 163), (428, 347), (376, 347)])], 'sortY': 346 * K},
    {'id': 'hamper', 'cover': [outline_rows(170, 293, 222, 360)], 'sortY': 358 * K},
    {'id': 'basket', 'cover': [P([(0, 345), (53, 345), (53, 424), (0, 424)])], 'sortY': 424 * K},
    {'id': 'bagB', 'cover': [outline_rows(46, 409, 106, 423)], 'sortY': 424 * K},
    {'id': 'bagL', 'cover': [outline_rows(333, 295, 361, 312)], 'sortY': 311 * K},
    {'id': 'bagR', 'cover': [outline_rows(424, 315, 458, 345)], 'sortY': 344 * K},
]
# 사물함 옆면(비스듬히 뒤로 가는 면) = 1x 2px 세로 띠, 띠마다 sortY = 그 x의 밑 윤곽선 y (11-02 사용자 「해」, 남자 탈의실 lockC 방식).
# 윤곽선은 그림 픽셀을 한 줄씩 읽음(검은 선 y): 왼쪽 옆면 밑 x236→344·x250→328·x265→311·x278→296, 위 (235,167)→(280,191)
#   오른쪽 옆면 밑 x357→299·x365→320·x374→342, 위 (356,191)→(375,165)
SIDES = {
    'lockL_side': (236, 280, lambda x: 167 + (x - 235) * 24 / 45, lambda x: 344 - (x - 236) * 48 / 42),
    'lockR_side': (356, 376, lambda x: 191 - (x - 356) * 26 / 19, lambda x: 299 + (x - 357) * 43 / 17.6),
}
for oid, (xa, xb, top, bot) in SIDES.items():
    for x in range(xa, xb, 2):
        xm = x + 1
        objects.append({'id': f'{oid}{x}', 'cover': [P([(x, int(top(xm)) - 1), (x + 2, int(top(xm)) - 1), (x + 2, int(bot(xm)) + 2), (x, int(bot(xm)) + 2)])],
                        'sortY': round(bot(xm)) * K})
door = lambda q: {'x0': min(p[0] for p in q), 'x1': max(p[0] for p in q), 'y0': min(p[1] for p in q), 'y1': max(p[1] for p in q), 'anim': 'none', 'quad': q, 'behind': 'dark'}
doors = {
    'bath': {'kind': 'glass', 'x': 70 * K, 'y': 326 * K, 'locked': True, 'label': '목욕탕', 'door': door(P([(0, 112), (118, 140), (118, 300), (0, 335)]))},
    'out': {'kind': 'exit', 'side': 'S', 'x': 316 * K, 'y': H - 12, 'label': '나가기'},
}
# 사람 크기 = 왼쪽 유리문(목욕탕 출입문) 기준 (11-02 06:11 사용자 「이거 기준으로 캐릭터 크기 맞춘 다음에 원근을 잡아야지」).
# 문 높이(1x 픽셀로 읽음): 문 위 끝 = 유리 위 점선(x20→y159, x28→y161, 기울기 0.25 → x48에서 y166; 06:15 사용자 「출입문 크기는 여기까지, 이 위는 아니야」) ~ 밑 바닥 y320 (154px). 문 앞 사람 = 0.82 = 126px @ 발 y320.
# 원근 = 그림 지평선 y226 (왼쪽 사물함 옆면 앞 178px@344·뒤 104px@295 로 역산) → 사람 키 = 155/(320-226) × (발y-226).
# 앞쪽도 끝까지 같은 원근(고정 구간 없음).
SPR_DOTS = 247
KH = 0.82 * 154 / (320 - 226)
MILD = 2 / 3   # 06:19 사용자 「원근 너무 급격」 → 문 앞(y320) 크기는 그대로, 앞뒤 변화율만 그림의 2/3
hy = lambda y: KH * (320 - 226) + MILD * KH * (y - 320)
REFS = [(BACK, hy(BACK)), (320, hy(320)), (424, hy(424))]
TOP = max(h for _, h in REFS)
m = {'file': 'hq_shower_f_strip', 'bgScale': K, 'dotK': round(TOP * K / SPR_DOTS, 4), 'sizes': [[y * K, round(h / TOP, 3)] for y, h in REFS], 'w': W, 'h': H, 'under': True,
     'floor': floor, 'lane': [BACK * K, H - 12], 'blocks': blocks, 'doors': doors, 'lamps': [], 'spots': [], 'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, list(doors))
