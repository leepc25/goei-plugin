"""사무실 배치 미리보기용: 요원 앉기 끝 장 + C01 의자를 의자 1배 좌표(200캔버스, 위로 PAD 여유)에 합성해 내보냄.
맞춤값 = qgoupv 의 game-src/art/objects/chairs_office/fit_all.json (엉덩이·가랑이 손찍기). 사람 위치: x = 100 - w/2 - dx, y = 171 - bot - dy (office_fit_all.py pick 공식, bot = min(h-4, 그림 바닥)).
후면(61)은 의자가 사람 앞, 정면(60)은 사람이 의자 앞.
python3 tools/objects/office_seat_export.py <qgoupv 작업트리> <out_dir> key:view ...
"""
import sys, json
from pathlib import Path
from PIL import Image
QG = Path(sys.argv[1]); OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
TR = QG / 'game-src/action/testroom3'; sys.path.insert(0, str(TR)); sys.path.insert(0, str(TR / 'qa'))
import os; os.environ['CHAIR_DIR'] = str(QG / 'game-src/action/objects/C01_사무의자_1배')
argv = sys.argv; sys.argv = sys.argv[:1]
import fit_chair as fc
J = json.loads((QG / 'game-src/art/objects/chairs_office/fit_all.json').read_text())
LID = {'front': '60', 'back': '61'}; PAD = 160
for t in argv[3:]:
    k, v = t.split(':'); cfg, _ = fc.load(k); im = fc.last(cfg, LID[v]); p = J[k][v]
    ch = Image.open(fc.chair_png(p['img'])).convert('RGBA')
    w, h = im.size; bot = min(h - 4, im.getbbox()[3] - 1)
    C = Image.new('RGBA', (200, 200 + PAD), (0, 0, 0, 0))
    px, py = round(100 - w / 2 - p['dx']), round(171 - bot - p['dy']) + PAD
    if v == 'back': C.alpha_composite(im, (px, py)) if px >= 0 and py >= 0 else C.paste(im, (px, py), im); C.alpha_composite(ch, (0, PAD))
    else: C.alpha_composite(ch, (0, PAD)); C.paste(im, (px, py), im) if px < 0 or py < 0 else C.alpha_composite(im, (px, py))
    C.save(OUT / f'{k.split("_")[0]}_{v}.png'); print(k, v, p)
