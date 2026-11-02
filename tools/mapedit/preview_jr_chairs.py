"""중림 의자 확인 그림(2배): 배경 + 가림·소품(깊이 차례) + 지도 의자(chairs, 게임 drawChair와 같은 그림·배율) + 에일린 서기."""
import json, sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
spr = Image.open(ROOT / 'game-pack/char-1.4/1.webp').convert('RGBA').crop((0, 0, 62, 234)); spr = spr.crop(spr.getbbox())   # 지금 게임의 에일린 평상 대기 첫 장(11-02 사용자: 옛 그림 쓰지 말 것)

def persp(g, y):
    sz = g.get('sizes')
    if sz:
        if y <= sz[0][0]: return sz[0][1]
        for (y0, k0), (y1, k1) in zip(sz, sz[1:]):
            if y <= y1: return k0 + (k1 - k0) * (y - y0) / (y1 - y0)
        return sz[-1][1]
    a, b = g['lane']; t = min(1, max(0, (y - a) / (b - a))); return 0.85 + 0.15 * t

def render(sid, men, out):
    g = json.loads((ROOT / f'game-src/mapedit/{sid}/game.json').read_text())['scene']
    m = json.loads((ROOT / f'game-src/mapedit/{sid}/map.json').read_text())
    P = ROOT / 'game-pack/jr-field'
    import os
    img = Image.open(os.environ['PREVIEW_BG']).convert('RGBA').resize((g['w'] if 'w' in g else 1264, 848), Image.NEAREST) if os.environ.get('PREVIEW_BG') else Image.open(P / f"{g['file']}.webp").convert('RGBA')
    skip = set(os.environ.get('PREVIEW_SKIP', '').split(','))   # 시험: 지운 물건의 가림은 빼고 그림
    layers = [(o['sortY'], Image.open(P / f"{o['file']}.webp").convert('RGBA'), (o['x'], o['y'])) for o in g['objects'] if o.get('file') and o['id'] not in skip]
    for ch in m.get('chairs', []):
        face = ch.get('face'); st = ch.get('set')
        d = 'north' if face == 'N' else ('east' if st else 'west') if face == 'W' else 'east' if face == 'E' else ('south-east' if st else 'east')
        im = Image.open(ROOT / ('game-src/art/objects/chairs_shell/fit/%s.png' % d if st else 'game-src/art/objects/chairs/raw/c01_%s.png' % d)).convert('RGBA')
        if st and face == 'W': im = im.transpose(Image.FLIP_LEFT_RIGHT)
        k = persp(g, ch['y']) * g['dotK']
        im = im.resize((round(200 * k), round(200 * k)), Image.NEAREST)
        layers.append((ch['y'], im, (round(ch['x'] - 100 * k), round(ch['y'] - 171 * k))))
    for fx, fy in men:
        h = round(spr.height * g['dotK'] * persp(g, fy)); s = spr.resize((round(spr.width * h / spr.height), h), Image.NEAREST)
        layers.append((fy + 0.5, s, (fx - s.width // 2, fy - h)))
    for _, im, p in sorted(layers, key=lambda t: t[0]): img.alpha_composite(im, p)
    img.convert('RGB').save(out)

if __name__ == '__main__':
    render(sys.argv[1], [tuple(map(int, a.split(','))) for a in sys.argv[3:]], sys.argv[2])
