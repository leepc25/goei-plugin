"""의무실 레이어 확인 그림: map.json(author_hq_infirmary.py)으로 사람 세우기·눕히기, 깊이(sortY) 순서로 가림 다시 그림. 2배.
사용: python3 tools/mapedit/preview_hq_infirmary.py <출력.png> <x,y>... (1x 발 자리) — 침대 3곳 눕기는 자동으로 같이."""
import base64, io, json, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
ROOT = Path(__file__).resolve().parents[2]
D = ROOT / 'game-src/mapedit/infirmary'
m = json.loads((D / 'map.json').read_text())
bg = Image.open(D / 'hq_infirmary_strip.png').convert('RGBA').resize((m['w'], m['h']), Image.NEAREST)
REF = 'origin/claude/merge-1101:game-src/action/motion3/1.6_큐라스/'
def sprite(path):
    s = Image.open(io.BytesIO(subprocess.run(['git', 'show', REF + path], cwd=ROOT, capture_output=True, check=True).stdout)).convert('RGBA')
    return s.crop(s.getbbox())
STAND, LIE = sprite('1/00.png'), sprite('76/00.png')
def k_at(y):
    sz = m['sizes']
    if y <= sz[0][0]: return sz[0][1]
    if y >= sz[-1][0]: return sz[-1][1]
    for (y0, k0), (y1, k1) in zip(sz, sz[1:]):
        if y <= y1: return k0 + (k1 - k0) * (y - y0) / (y1 - y0)
def inside(pt, poly):
    x, y = pt; c = False
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c
layers = []
feet = [tuple(map(int, a.split(','))) for a in sys.argv[2:]]
for fx, fy in feet:
    X, Y = fx * 2, fy * 2; s = STAND; f = 1.0 * 247 / s.height
    h = round(s.height * m['dotK'] * k_at(Y) * f); s = s.resize((round(s.width * h / s.height), h), Image.NEAREST)
    layers.append((Y, 1, (s, X - s.width // 2, Y - s.height)))
for sp in m['spots']:                      # 눕기: 몸 밑 가운데 = seat, 머리 = face 쪽 (원본 그림 머리 왼쪽)
    X, Y = sp['seat']['x'], sp['seat']['y']; s = LIE if sp['face'] < 0 else ImageOps.mirror(LIE)
    k = m['dotK'] * k_at(Y); s = s.resize((round(s.width * k), round(s.height * k)), Image.NEAREST)
    layers.append((Y, 1, (s, X - s.width // 2, Y - s.height)))
for o in m['objects']:
    mk = Image.open(io.BytesIO(base64.b64decode(o['coverMask'].split(',', 1)[1]))).convert('L')
    piece = bg.crop((o['x'], o['y'], o['x'] + o['w'], o['y'] + o['h'])); piece.putalpha(mk)
    layers.append((o['sortY'], 0, (piece, o['x'], o['y'])))
img = bg.copy()
for _, _, (s, x, y) in sorted(layers, key=lambda t: (t[0], t[1])): img.alpha_composite(s, (x, y))
d = ImageDraw.Draw(img)
for fx, fy in feet:
    X, Y = fx * 2, fy * 2
    ok = inside((X, Y), m['floor']) and not any(inside((X, Y), b['poly']) for b in m['blocks'])
    print(fx, fy, '걷기 가능' if ok else '못 감')
    if not ok: d.line([(X - 8, Y - 8), (X + 8, Y + 8)], fill=(255, 0, 0), width=3); d.line([(X - 8, Y + 8), (X + 8, Y - 8)], fill=(255, 0, 0), width=3)
img.convert('RGB').save(sys.argv[1])
