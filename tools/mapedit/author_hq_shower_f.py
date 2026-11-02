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
floor = P([(0, 337), (140, 286), (455, 286), (455, 290), (632, 402), (632, 424), (0, 424)])
blocks = [
    {'poly': P([(165, 344), (246, 344), (289, 295), (289, 289), (231, 289)]), 'h': 999},  # 사물함 왼쪽 줄 (옆면에서 몸 반폭 10px 띄움, 11-02 「파묻혔냐」)
    {'poly': P([(366, 347), (437, 347), (405, 290), (347, 290), (347, 299)]), 'h': 999},  # 사물함 오른쪽 줄 (옆면에서 몸 반폭 10px 띄움)
    {'poly': P([(172, 342), (223, 342), (223, 356), (172, 356)]), 'h': 999},          # 빨래통
    {'poly': P([(0, 360), (53, 360), (53, 424), (0, 424)]), 'h': 999},                # 왼쪽 아래 바구니
]
objects = [   # 가림: 사람보다 앞에 다시 그릴 그림 자리(다각형), sortY = 앞 발 y
    # 사물함 앞면: 한 장, sortY = 앞면 밑 윤곽선(1x 픽셀로 읽음: 왼쪽 y344, 오른쪽 y347)
    {'id': 'lockL', 'cover': [P([(174, 166), (236, 166), (236, 345), (174, 345)])], 'sortY': 344 * K},
    {'id': 'lockR', 'cover': [P([(376, 163), (428, 163), (428, 348), (376, 348)])], 'sortY': 347 * K},
    {'id': 'hamper', 'cover': [P([(172, 292), (223, 292), (223, 356), (172, 356)])], 'sortY': 356 * K},
    {'id': 'basket', 'cover': [P([(0, 345), (53, 345), (53, 424), (0, 424)])], 'sortY': 424 * K},
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
# 사람 크기: 사람 = 문틀 0.82. 이 그림의 사물함은 뒷문 문틀과 높이가 같아서(둘 다 104px, 거의 같은 깊이) 사물함에도 0.82 (11-02 사용자 「거인」). 1x로 잰 값:
# - 뒷벽 문: 문틀 위 y177 ~ 밑 y281 (104px) → 사람 85, 발 y286
# - 왼쪽 사물함 뒤 끝: x279 위 y191 ~ 밑 y295 (104px) → 사람 95, 발 y295
# - 오른쪽 사물함 앞면: 위 y163 ~ 밑 y347 (184px) → 사람 167, 발 y347 (왼쪽 앞면 178px→162 @y344 와 맞음)
# 기준점 사이에서만 바뀌고 그 밖은 끝값 그대로.
SPR_DOTS = 247
REFS = [(286, 0.82 * 104), (295, 0.82 * 104), (347, 0.82 * 184)]
TOP = max(h for _, h in REFS)
m = {'file': 'hq_shower_f_strip', 'bgScale': K, 'dotK': round(TOP * K / SPR_DOTS, 4), 'sizes': [[y * K, round(h / TOP, 3)] for y, h in REFS], 'w': W, 'h': H, 'under': True,
     'floor': floor, 'lane': [286 * K, H - 12], 'blocks': blocks, 'doors': doors, 'lamps': [], 'spots': [], 'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, list(doors))
