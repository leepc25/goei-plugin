"""화장실 장면 확인 그림: 걷는 바닥(초록 선), 칸 앞 기둥·문 층, 사람을 소변기·세면대·칸 안·칸 앞·끝 기둥 옆에 세워 본다.
게임과 같은 배율: 사람 도트 1칸 = 원근(0.85~1) × dotK(1.5 × 848 / 890) 월드 px.
사용: python3 tools/mapedit/preview_wc.py <wc|wc3> <출력.png> [문 장면 예: 0,5,0]"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
sid, outp = sys.argv[1], sys.argv[2]
SRC = ROOT / 'game-src/mapedit' / sid
m = json.loads((SRC / 'map.json').read_text())
K = m['bgScale']
bg = Image.open(SRC / (m['file'] + '.png')).convert('RGBA')
bg = bg.resize((bg.width * K, bg.height * K), Image.NEAREST)
W, H = bg.size
dotK = 1.5 * H / 890
lane = m['lane']
persp = lambda y: 0.85 + 0.15 * max(0, min(1, (y - lane[0]) / (lane[1] - lane[0])))
M = ROOT / 'game-src/action/motion3'
def sprite(who, line, fr, x, y, flip=False, hip=False):
    im = Image.open(M / who / line / f'{fr:02d}.png').convert('RGBA')
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    s = persp(y) * dotK
    im = im.resize((round(im.width * s), round(im.height * s)), Image.NEAREST)
    # 발 = 캔버스 아래 가운데(도트 x = 폭/2, y = 252)
    return im, (round(x - im.width / 2), round(y - 252 * s))
states = [int(v) for v in sys.argv[3].split(',')] if len(sys.argv) > 3 else None
objs = sorted(m['objects'], key=lambda o: o['sortY'])
toi = {t['id']: t for t in m['toilets']}
people = []
kyu, eil = '1.6_큐라스', '1.4_에일린'
if sid == 'wc':
    u = toi['urinal1']; people.append((u['y'], *sprite(kyu, '100', 3, u['x'], u['y'])))
    u = toi['urinal3']; people.append((u['y'], *sprite(kyu, '100', 0, u['x'], u['y'])))
s = toi['sink0']; people.append((s['y'], *sprite(kyu if sid == 'wc' else eil, '104', 2, s['x'], s['y'])))
st = toi['stall1']; seat = st['seat']
im, xy = sprite(kyu if sid == 'wc' else eil, '102', 0, seat['x'], seat['y'] + 60)
people.append((seat['y'], im, xy))
# 칸 앞 바닥선 바로 앞에 선 사람, 끝 기둥 오른쪽 벽 가까이 선 사람, 맨 앞
f0 = toi['stall0']
people.append((f0['y'] + 4, *sprite(kyu, '1', 0, f0['x'] - 60, f0['y'] + 4)))
fl = m['floor']
endx = max(o['x'] + o['w'] for o in objs if o['id'].startswith('front'))
ytop = min(p[1] for p in fl if abs(p[0] - (endx + 40)) < 60) + 2
people.append((ytop, *sprite(kyu, '1', 0, endx + 40, ytop)))
people.append((H - 14, *sprite(kyu, '1', 0, W // 2, H - 14)))
out = bg.copy()
layers = [(o['sortY'], 'o', o) for o in objs] + [(p[0], 'p', p) for p in people]
for sy, k, v in sorted(layers, key=lambda t: t[0]):
    if k == 'p': out.alpha_composite(v[1], v[2]) if v[2][0] >= 0 else out.paste(v[1], v[2], v[1])
    else:
        name = v['file']
        if v.get('frames') and states:
            i = int(v['id'][4:]); name = v['frames'][states[i] if i < len(states) else 0]
        im = Image.open(SRC / f'{name}.png').convert('RGBA')
        out.paste(im, (v['x'], v['y']), im)
d = ImageDraw.Draw(out)
d.line([tuple(p) for p in fl[:-2]], fill=(0, 255, 90, 255), width=2)
for t in m['toilets']:
    d.ellipse([t['x'] - 6, t['y'] - 6, t['x'] + 6, t['y'] + 6], outline=(255, 60, 60, 255), width=2)
out.convert('RGB').save(outp)
print('lane', lane, 'dotK', round(dotK, 3))
