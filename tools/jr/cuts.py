"""중림 장면 그림에서 소품을 투명 PNG로 오린다(가림용). 배경은 고치지 않는다: 오린 그림을 같은 자리에 겹쳐 두고,
캐릭터가 소품 뒤(발 y < sortY)에 있을 때만 캐릭터 위로 그려진다.
테두리는 GrabCut: rect 안을 '아마 소품', 밖을 배경으로 시작하고, fg/bg 다각형으로 확실한 곳을 알려 준다.
결과: game-pack/jr-field/jc_<장면>_<id>.webp, src/game/action/hq/jrCuts.gen.ts, 확인 시트(인자로 폴더를 주면).
사용: python3 tools/jr/cuts.py [확인 시트 폴더]
"""
import json, sys
from pathlib import Path
import numpy as np, cv2
from PIL import Image

SRC = Path('game-src/art/field/jr'); OUT = Path('game-pack/jr-field')
from jr_cut_spec import CUTS  # noqa: E402  (tools/jr/jr_cut_spec.py)

def cut(scene, c):
    im = np.asarray(Image.open(SRC / f'{scene}.webp').convert('RGB'))
    H, W = im.shape[:2]
    x0, y0, x1, y1 = c['rect']
    m = 24
    X0, Y0, X1, Y1 = max(0, x0 - m), max(0, y0 - m), min(W, x1 + m), min(H, y1 + m)
    crop = np.ascontiguousarray(im[Y0:Y1, X0:X1][:, :, ::-1])
    mask = np.full(crop.shape[:2], cv2.GC_BGD, np.uint8)
    mask[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = cv2.GC_PR_FGD
    if not c.get('fg'):   # 정의가 없으면 가운데(안쪽 30%)는 확실한 소품
        ix, iy = (x1 - x0) * 0.3, (y1 - y0) * 0.3
        mask[int(y0 + iy) - Y0:int(y1 - iy) - Y0, int(x0 + ix) - X0:int(x1 - ix) - X0] = cv2.GC_FGD
    for key, val in (('bg', cv2.GC_BGD), ('fg', cv2.GC_FGD)):
        for poly in c.get(key, []):
            cv2.fillPoly(mask, [np.array([[px - X0, py - Y0] for px, py in poly], np.int32)], val)
    if c.get('mode', 'grabcut') == 'grabcut':
        bgm, fgm = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
        cv2.grabCut(crop, mask, None, bgm, fgm, 6, cv2.GC_INIT_WITH_MASK)
        a = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
        # 작은 구멍 메우고 떨어진 부스러기 빼기
        a = cv2.morphologyEx(a, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        n, lab, st, _ = cv2.connectedComponentsWithStats(a)
        keep = np.zeros_like(a)
        for i in range(1, n):
            if st[i, cv2.CC_STAT_AREA] >= c.get('minArea', 120): keep[lab == i] = 255
        a = keep
    else:
        a = np.where(mask >= cv2.GC_FGD, 255, 0).astype(np.uint8)
        a[mask == cv2.GC_PR_FGD] = 255; a[mask == cv2.GC_BGD] = 0
        for poly in c.get('fg', []): cv2.fillPoly(a, [np.array([[px - X0, py - Y0] for px, py in poly], np.int32)], 255)
    rgba = np.dstack([im[Y0:Y1, X0:X1], a])
    ys, xs = np.nonzero(a)
    if not len(xs): raise SystemExit(f'{scene}.{c["id"]}: 빈 오리기')
    bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    out = Image.fromarray(rgba[by0:by1, bx0:bx1], 'RGBA')
    f = f'jc_{scene}_{c["id"]}'
    out.save(OUT / f'{f}.webp', 'WEBP', lossless=True, method=6)
    return dict(id=f'c_{c["id"]}', file=f, x=int(X0 + bx0), y=int(Y0 + by0), w=out.width, h=out.height, sortY=c['sortY'],
                **({'solid': c['solid']} if c.get('solid') else {})), out

gen, files, sheets = {}, [], []
for scene, cs in CUTS.items():
    gen[scene] = []
    for c in cs:
        o, img = cut(scene, c); gen[scene].append(o); files.append(o['file']); sheets.append((scene, c['id'], img))
Path('src/game/action/hq/jrCuts.gen.ts').write_text(
    '// tools/jr/cuts.py 가 만든다 (정의는 tools/jr/jr_cut_spec.py). 손대지 말 것.\n'
    "import type { PaintedObject } from './painted';\n\n"
    f'export const JR_CUTS: Record<string, PaintedObject[]> = {json.dumps(gen, ensure_ascii=False)};\n'
    f'export const JR_CUT_FILES: string[] = {json.dumps(files)};\n')
if len(sys.argv) > 1:
    d = Path(sys.argv[1]); d.mkdir(parents=True, exist_ok=True)
    for scene, cid, img in sheets:
        k = 2 if img.width < 500 else 1
        bg = Image.new('RGBA', (img.width * k + 20, img.height * k + 20), (255, 0, 255, 255))
        bg.alpha_composite(img.resize((img.width * k, img.height * k), Image.NEAREST), (10, 10))
        bg.convert('RGB').save(d / f'{scene}_{cid}.png')
print(len(files), 'cuts')
