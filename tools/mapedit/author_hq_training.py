"""관리국 지하 1층 훈련장 장면 원본 (2026-11-02 15:17 사용자 「훈련장은 관리국걸로 연결해야지 왜 회색방이야」).
그림: game-src/art/pixellab-hq-20261031/hq_b1_training_ext2R.png (1277×424, 11-01 11:07 사용자 확정). 배경 2배 = 2554×848.
협회 훈련장(sdra_training)도 같은 그림(painted.ts PAINTED.sdra_training = PAINTED.training).
바닥 윗선(1x, 4배 격자로 읽음) = 뒷벽에 붙은 물건 밑 +2: 덤벨 랙 0~85 y352, 소화기·타이어·자루 85~165 y344, 늑목·바벨 165~275 y340,
모래자루 275~335 y345, 타이어·공 335~400 y343, 거울 부스·케틀벨 400~520 y343, 가방 520~580 y343, 목검 걸이 580~655 y350,
허수아비 655~805 y348, 철망장 805~870 y342, 모래자루 870~955 y342, 벽 955~1000 y338, 사격 부스(철망 기둥 발) 1000~1277 y352.
벽 붙은 물건은 가림 없음. 바닥 한가운데 물건 3무리 = 가림(사람보다 앞) + 발밑 막힘(옆 여유 12):
 A 왼쪽 아래 공구함·케틀벨·타이어 2(x0~200, y375~424), B 가운데 상자·밧줄 뭉치(x485~610, y376~424), C 오른쪽 가방·물병(x810~897, y361~422).
가림 다각형은 8배 격자에서 손으로 읽은 꼭짓점 → 검은 윤곽선까지 깎음(trim, 협회 창구와 같음). 밧줄·호스·매트는 바닥에 납작 → 걷는다.
훈련 장비(gear, 2배 좌표): 그림 속 샌드백(거울 부스 안 검은 자루 x497, 벽 빨간 자루 x538) · 허수아비(x735·776) · 사격 과녁(부스 안 종이 과녁 x1095·1210, 사수는 부스 앞 y356).
출력: game-src/mapedit/training/ → python3 tools/mapedit/import.py game-src/mapedit/training training"""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/art/pixellab-hq-20261031/hq_b1_training_ext2R.png'
OUT = ROOT / 'game-src/mapedit/training'; OUT.mkdir(parents=True, exist_ok=True)
K = 2
im = Image.open(SRC).convert('RGB'); im.save(OUT / 'training.png')
IW, IH = im.size; W, H = IW * K, IH * K
A = np.array(im).astype(int); DK = A.max(2) <= 60; BR = A.max(2) >= 150
# 바닥 윗선 구간 (x0, x1, y)
SEG = [(0, 85, 354), (85, 165, 346), (165, 275, 342), (275, 335, 347), (335, 400, 345), (400, 520, 345), (520, 580, 345), (580, 655, 352),
       (655, 805, 350), (805, 870, 344), (870, 955, 344), (955, 1000, 340), (1000, IW, 354)]
poly = []
for x0, x1, y in SEG: poly += [[x0 * K, y * K], [x1 * K, y * K]]
floor = [[0, H]] + poly + [[W, H]]
LANE = [min(y for _, _, y in SEG) * K, H - 12]
def trim(m, n=4):
    m = m.copy()
    for y in range(IH):
        xs = np.flatnonzero(m[y])
        if not len(xs): continue
        x = xs[0]; k = 0
        while k < n and m[y, x] and not DK[y, x]: m[y, x] = False; x += 1; k += 1
        x = xs[-1]; k = 0
        while k < n and m[y, x] and not DK[y, x]: m[y, x] = False; x -= 1; k += 1
    for x in range(IW):
        ys = np.flatnonzero(m[:, x])
        if not len(ys): continue
        y = ys[0]; k = 0
        while k < n and m[y, x] and not DK[y, x] and not BR[y, x]: m[y, x] = False; y += 1; k += 1
    return m
COVERS = {
 # A: 공구함(0~85, 윗선 380) · 케틀벨(52~78, 손잡이 375) · 큰 타이어(88~195, 윗선 385) · 작은 타이어(165~200, 윗선 393)
 'left_pile': [(0, 382), (46, 382), (50, 390), (53, 381), (58, 376), (66, 374), (74, 376), (80, 382), (84, 391), (87, 398), (92, 395), (98, 391), (108, 388), (120, 386),
               (140, 385), (156, 386), (168, 389), (176, 392), (186, 392), (194, 395), (200, 400), (200, IH), (0, IH)],
 # B: 상자(487~568, 윗선 377, 오른쪽 윗 모서리 비스듬) · 밧줄 뭉치(518~604, 윗선 393)
 'box_rope': [(486, 383), (489, 378), (497, 376), (560, 376), (568, 381), (569, 392), (590, 392), (602, 396), (607, 403), (606, 412), (598, 418), (584, 421), (560, 423), (540, 422),
              (522, 418), (516, 410), (515, 400), (489, 400), (487, 424), (486, 424)],
 # C: 물병(848~866, 윗선 361) · 가방(812~896, 손잡이 윗선 382)
 'bag': [(848, 362), (866, 362), (866, 382), (878, 384), (888, 390), (894, 398), (896, 408), (892, 416), (884, 421), (860, 423), (836, 422), (818, 418), (811, 410), (812, 398),
         (820, 388), (832, 383), (847, 381)],
}
objects, blocks = [], []
for i, (name, pts) in enumerate(COVERS.items()):
    mi = Image.new('L', (IW, IH), 0); ImageDraw.Draw(mi).polygon(pts, fill=255, outline=255)
    m = trim(np.array(mi) > 0)
    mk = Image.fromarray((m * 255).astype('uint8')); bb = mk.getbbox()
    cut = im.crop(bb).convert('RGBA'); cut.putalpha(mk.crop(bb)); cut = cut.resize((cut.width * K, cut.height * K), Image.NEAREST)
    cut.save(OUT / f'part_{name}.png')
    objects.append({'id': name, 'file': f'part_{name}', 'x': bb[0] * K, 'y': bb[1] * K, 'w': cut.width, 'h': cut.height, 'sortY': min(bb[3], IH - 6) * K})
# 발밑 막힘 (1x): A 공구함·케틀벨 x0~88 y374~, 타이어 x88~207 y386~ / B x475~612 y392~ / C x800~905 y394~
for pts in ([(0, 374), (88, 374), (88, 386), (207, 386), (207, IH + 6), (0, IH + 6)], [(475, 392), (612, 392), (612, IH + 6), (475, IH + 6)],
            [(800, 394), (905, 394), (905, IH + 6), (800, IH + 6)]):
    blocks.append({'poly': [[x * K, y * K] for x, y in pts], 'h': 999})
doors = {'out': {'kind': 'exit', 'side': 'S', 'x': 300 * K, 'y': H - 40, 'to': 'b1', 'toDoor': 'training', 'label': '복도로'}}
# 15:26 사용자 「훈련 장비는 아직 넣지 말고」: 장비 자리 비움(빈 목록 = 코드 장비도 안 그림·안 씀). 그림 속 후보: 샌드백 x497·538, 허수아비 x735·776, 과녁 x1095·1210(1x)
gear = []
m = {'file': 'training', 'bgScale': K, 'w': W, 'h': H, 'under': True, 'floor': floor, 'lane': LANE,
     'blocks': blocks, 'doors': doors, 'lamps': [], 'spots': [], 'objects': objects, 'gear': gear}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, LANE, [(o['id'], o['x'], o['y'], o['w'], o['h']) for o in objects])
