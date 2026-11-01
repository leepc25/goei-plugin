"""장면 확인 그림: 배경(2배)에 요원을 원근 크기로 세우고, 깊이선(sortY)이 발보다 아래(앞)인 가림 그림을 그 위에 다시 그린다.
걷는 바닥 밖·막힘 안이면 발 자리에 빨간 X. 사용: python3 preview_scene.py <장면id> <출력.png> <지평선y(1x)> <x,y>...(1x 발 자리)
지평선y를 0으로 주면 게임과 똑같은 크기(dotK·원근 0.85~1, 사용자 15:02 「장면마다 캐릭터 크기 오락가락」→ 항상 이것으로). 아니면 옛 방식 1.35 × (발 y − 지평선)."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
sid, out, hz = sys.argv[1], sys.argv[2], float(sys.argv[3])
feet = [tuple(map(int, a.split(','))) for a in sys.argv[4:]]
g = json.loads((ROOT / f'game-src/mapedit/{sid}/game.json').read_text())['scene']
PACK = ROOT / 'game-pack/jr-field'
bg = Image.open(PACK / f"{g['file']}.webp").convert('RGBA')
import os
spr = Image.open(os.environ.get('PREVIEW_SPRITE') or ROOT / 'game-src/action/motion3/1.6_큐라스/1/00.png').convert('RGBA')   # PREVIEW_SPRITE=투명 PNG 로 바꿀 수 있음(샤워실은 실제 샤워 그림)
spr = spr.crop(spr.getbbox())


def inside(pt, poly):
    x, y = pt; c = False; n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c


people = []
for fx, fy in feet:
    if hz == 0:   # 게임과 같은 크기: 도트 키 × dotK × 원근(줄 맨 뒤 0.85 ~ 맨 앞 1, engine/view.ts FAR)
        a, b = g['lane'][0], g.get('growTo') or g['lane'][1]; t = min(1, max(0, (fy * 2 - a) / (b - a)))
        far = g.get('far', 0.85); k = far + (1 - far) * t
        sz = g.get('sizes')
        if sz:   # 기준점 사이에서만 바뀜 (engine/view.ts persp와 같은 계산)
            y = fy * 2
            if y <= sz[0][0]: k = sz[0][1]
            elif y >= sz[-1][0]: k = sz[-1][1]
            else:
                for (y0, k0), (y1, k1) in zip(sz, sz[1:]):
                    if y <= y1: k = k0 + (k1 - k0) * (y - y0) / (y1 - y0); break
        h = round(spr.height * g['dotK'] * k)
    else:
        h = round(1.35 * (fy - hz) * 2)
    s = spr.resize((max(1, round(spr.width * h / spr.height)), h), Image.NEAREST)
    people.append((fy * 2, fx * 2, s))
layers = [(p[0], 'p', p) for p in people] + [(o['sortY'], 'o', o) for o in g['objects'] if o.get('file')]
img = bg.copy()
for sy, kind, it in sorted(layers, key=lambda t: (t[0], t[1] == 'p')):
    if kind == 'p':
        fy2, fx2, s = it; img.alpha_composite(s, (fx2 - s.width // 2, fy2 - s.height))
    else:
        im = Image.open(PACK / f"{it['file']}.webp").convert('RGBA'); img.alpha_composite(im, (it['x'], it['y']))
d = ImageDraw.Draw(img)
for fx, fy in feet:
    ok = inside((fx * 2, fy * 2), g['floor']) and not any(inside((fx * 2, fy * 2), h) for h in g['holes'])
    if not ok: d.line([(fx * 2 - 8, fy * 2 - 8), (fx * 2 + 8, fy * 2 + 8)], fill=(255, 0, 0), width=3); d.line([(fx * 2 - 8, fy * 2 + 8), (fx * 2 + 8, fy * 2 - 8)], fill=(255, 0, 0), width=3)
    print(fx, fy, '걷기 가능' if ok else '못 감')
img.convert('RGB').save(out)
