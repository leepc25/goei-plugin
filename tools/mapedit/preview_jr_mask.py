"""중림 방 따기 확인 그림(2배 지도): 빨강 = 막힘, 파랑 = 발판(숫자 = 높이), 분홍 = 가림 윤곽, 하늘 = 가림 sortY 줄, 초록 = 걸을 바닥 끝.
사람 확인(게임 깊이 차례 그대로): 지금 게임 에일린(char-1.4 첫 장)을 발 자리에 세운다. 발판 위 사람은 'x,y,h'.
사용: python3 tools/mapedit/preview_jr_mask.py <방> <출력 겹침.png> <출력 사람.png> [x,y[,h] ...]
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, str(Path(__file__).parent))
from preview_jr_chairs import persp, spr

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / 'game-pack/jr-field'


def overlay(sid, out):
    g = json.loads((ROOT / f'game-src/mapedit/{sid}/game.json').read_text())['scene']
    img = Image.open(P / f"{g['file']}.webp").convert('RGBA')
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    union = Image.new('L', img.size, 0)   # 띠로 나눈 가림도 한 덩이 윤곽으로 보이게
    for h in g['holes']: d.polygon([tuple(p) for p in h], fill=(255, 0, 0, 70), outline=(255, 0, 0, 255))
    for o in g['objects']:
        for b in o.get('solid', []):
            d.rectangle([b['x0'], b['y0'], b['x1'], b['y1']], fill=(0, 120, 255, 80), outline=(0, 160, 255, 255))
            d.text((b['x0'] + 3, b['y0'] + 2), str(b['h']), fill=(255, 255, 255, 255))
        if o.get('file'):
            union.paste(255, (o['x'], o['y']), Image.open(P / f"{o['file']}.webp").convert('RGBA').getchannel('A'))
            d.line([(o['x'], o['sortY']), (o['x'] + o['w'], o['sortY'])], fill=(0, 230, 255, 255), width=1)
    lay.paste((255, 0, 255, 255), (0, 0), union.filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v else 0))
    d.line([tuple(p) for p in g['floor']] + [tuple(g['floor'][0])], fill=(0, 255, 0, 255), width=2)
    img.alpha_composite(lay); img.convert('RGB').save(out)


def people(sid, out, men):
    g = json.loads((ROOT / f'game-src/mapedit/{sid}/game.json').read_text())['scene']
    img = Image.open(P / f"{g['file']}.webp").convert('RGBA')
    layers = [(o['sortY'], Image.open(P / f"{o['file']}.webp").convert('RGBA'), (o['x'], o['y'])) for o in g['objects'] if o.get('file')]
    for fx, fy, z in men:
        h = round(spr.height * g['dotK'] * persp(g, fy)); s = spr.resize((round(spr.width * h / spr.height), h), Image.NEAREST)
        layers.append((fy + 0.5, s, (fx - s.width // 2, fy - z - h)))
    for _, im, p in sorted(layers, key=lambda t: t[0]): img.alpha_composite(im, p)
    d = ImageDraw.Draw(img)
    for fx, fy, z in men: d.ellipse([fx - 3, fy - 3, fx + 3, fy + 3], outline=(255, 255, 0, 255))
    img.convert('RGB').save(out)


if __name__ == '__main__':
    sid = sys.argv[1]
    overlay(sid, sys.argv[2])
    men = []
    for a in sys.argv[4:]:
        v = list(map(int, a.split(','))); men.append((v[0], v[1], v[2] if len(v) > 2 else 0))
    people(sid, sys.argv[3], men)
