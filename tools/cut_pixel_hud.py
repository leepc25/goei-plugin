"""PixelLab에서 뽑은 HUD 틀(game-src/art/ui/pixellab)을 잘라 src/game/action/ui/pixelHudArt.ts(데이터 URL)로 만든다.
각 그림: 불투명 픽셀의 가장 큰 덩어리 범위로 자르고, 안쪽 빈칸(가장 어두운 색으로 칠해진 칸) 범위를 같이 적는다."""
import base64, io, json, sys
from PIL import Image
SRC = 'game-src/art/ui/pixellab/'
OUT = 'src/game/action/ui/pixelHudArt.ts'

def biggest(im):
    w, h = im.size; a = im.load(); seen = set(); best = None
    for y in range(h):
        for x in range(w):
            if (x, y) in seen or a[x, y][3] < 128: continue
            st = [(x, y)]; seen.add((x, y)); box = [x, y, x, y]; n = 0
            while st:
                cx, cy = st.pop(); n += 1
                box = [min(box[0], cx), min(box[1], cy), max(box[2], cx), max(box[3], cy)]
                for nx, ny in ((cx+1, cy), (cx-1, cy), (cx, cy+1), (cx, cy-1)):
                    if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and a[nx, ny][3] >= 128:
                        seen.add((nx, ny)); st.append((nx, ny))
            if not best or n > best[0]: best = (n, box)
    b = best[1]
    return im.crop((b[0], b[1], b[2] + 1, b[3] + 1))

DARK = lambda p: p[3] > 128 and p[0] + p[1] + p[2] < 60

def hollow(im):
    """안쪽 홈: 가운데 줄의 어두운 칸에서 시작해 어두운 픽셀로 번진 영역 (바깥 테두리 검정과는 밝은 테로 떨어져 있다)"""
    w, h = im.size; a = im.load(); y = h // 2
    seeds = [(x, y) for x in range(w // 8, w - w // 8) if DARK(a[x, y])]
    reg = set(seeds); st = list(seeds)
    while st:
        cx, cy = st.pop()
        for nx, ny in ((cx+1, cy), (cx-1, cy), (cx, cy+1), (cx, cy-1)):
            if 0 < nx < w - 1 and 0 < ny < h - 1 and (nx, ny) not in reg and DARK(a[nx, ny]):
                reg.add((nx, ny)); st.append((nx, ny))
    return reg

out = {}
for key, f in [('btn', 'slot_0.png'), ('slot', 'slot_5.png'), ('item', 'slot_14.png'), ('portrait', 'portrait_3.png'), ('hp', 'hp_0.png'), ('gauge', 'gauge_0.png')]:
    im = biggest(Image.open(SRC + f).convert('RGBA'))
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True)
    reg = hollow(im) if key != 'portrait' else {(x, y) for x in range(8, im.size[0] - 8) for y in range(8, im.size[1] - 8)}
    xs = [p[0] for p in reg]; ys = [p[1] for p in reg]
    o = {'src': 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode(), 'w': im.size[0], 'h': im.size[1], 'inner': [min(xs), min(ys), max(xs) + 1, max(ys) + 1]}
    if key in ('hp', 'gauge'):
        # 줄마다 홈 구간들 [[x0,x1],...] (칸이 나뉜 게이지·기울어진 막대도 홈 모양대로 채운다)
        rows = []
        for y in range(im.size[1]):
            runs, s0 = [], None
            for x in range(im.size[0] + 1):
                d = (x, y) in reg
                if d and s0 is None: s0 = x
                if not d and s0 is not None: runs.append([s0, x]); s0 = None
            rows.append(runs)
        o['rows'] = rows
    out[key] = o
    print(key, im.size, out[key]['inner'], [len(r) for r in out[key].get('rows', [])])
open(OUT, 'w').write('// tools/cut_pixel_hud.py 가 만든다 (PixelLab generate-ui-v2 원본: game-src/art/ui/pixellab). 손으로 고치지 말 것\n'
                     'export const HUD_ART = ' + json.dumps(out) + ' as const;\n')
