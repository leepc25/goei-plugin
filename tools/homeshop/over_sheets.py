"""망상홈쇼핑 컷 A·상품 컷 가림 확인 그림 (2026-11-12). 방송 화면(src/ui/hsplayer.ts scene)이 그리는 차례를 그대로 따라 그린다.
 전 = 곧은 줄(over) 위쪽 진행자만 그림.  후 = 진행자 다 그리고 가림 판(a_over.webp)을 덮음.
손·팔이 상판 뒤 모서리 아래로 내려가는 장을 전부 찾아 4배(점 그대로)로 이어 붙인다.
쓰기: python3 -I tools/homeshop/over_sheets.py <저장 폴더> [상품 그림.webp]
"""
import json, os, sys
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from over_mask import D, NAME, measure

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
meta = json.load(open(os.path.join(D, 'homeshop.json'), encoding='utf8'))
A = meta['cuts']['A']
BOX = meta['box']
TABLE_Y = 302  # hsplayer.ts 와 같게
plate = Image.open(os.path.join(D, A['plate'])).convert('RGBA')
mask = Image.open(os.path.join(D, NAME)).convert('RGBA')
icon = Image.open(sys.argv[2]).convert('RGBA') if len(sys.argv) > 2 else None
back, front, _, split, _, _ = measure(meta)
sheets = {c['name']: Image.open(os.path.join(D, c['file'])).convert('RGBA') for c in A['clips']}


def scene(clip, i, after):
    f = sheets[clip].crop((i * BOX, 0, (i + 1) * BOX, BOX))
    if not after: f = f.crop((0, 0, BOX, max(0, min(BOX, A['over'] - A['y']))))
    lay = Image.new('RGBA', plate.size, (0, 0, 0, 0))
    lay.paste(f, (A['x'], A['y']))
    im = Image.alpha_composite(plate, lay)
    if after: im = Image.alpha_composite(im, mask)
    if icon:
        lay = Image.new('RGBA', plate.size, (0, 0, 0, 0))
        lay.paste(icon, (round(plate.width / 2 - icon.width / 2), TABLE_Y - icon.height))
        im = Image.alpha_composite(im, lay)
    return im


# 손·팔(가르는 열 오른쪽)이 옛 곧은 줄(over) 아래로 내려간 장 = 전에 잘리던 장
hit = []
for c in A['clips']:
    al = sheets[c['name']].getchannel('A').load()
    for i in range(c['frames']):
        n = sum(1 for sx in range(split - A['x'], BOX) for sy in range(A['over'] - A['y'], BOX) if al[i * BOX + sx, sy])
        if n: hit.append((c['name'], i, n))
print('손이 옛 줄 아래로 내려가 잘리던 장:', len(hit))
for h in hit: print(' ', h)


def sheet(name, frames, box, cols, after):
    w, h = (box[2] - box[0]) * 4, (box[3] - box[1]) * 4
    rows = -(-len(frames) // cols)
    out = Image.new('RGB', (cols * w, rows * h), (0, 0, 0))
    d = ImageDraw.Draw(out)
    for k, (clip, i) in enumerate(frames):
        im = scene(clip, i, after).crop(box).resize((w, h), Image.NEAREST)
        x, y = (k % cols) * w, (k // cols) * h
        out.paste(im, (x, y))
        d.rectangle([x, y, x + 150, y + 16], fill=(0, 0, 0))
        d.text((x + 4, y + 3), f'a_{clip}_1 #{i}', fill=(255, 255, 0))
    out.save(os.path.join(OUT, name))
    print(name, out.size)


all_hit = [(c, i) for c, i, _ in hit]
# 상품 컷이 보는 자리(hsplayer.ts draw: 회전판 둘레 256×192) 가운데 진열대 줄
cy = TABLE_Y - 30 - plate.height // 4
C = (plate.width // 4, cy + 50, plate.width * 3 // 4, cy + 160)
worst = [f for f in [('talk', 3), ('whisper', 1), ('whisper', 3), ('laugh', 2), ('laugh', 5), ('laugh', 6), ('angry', 6), ('angry', 7), ('angry', 14)] if f in all_hit]
for tag, after in (('전', False), ('후', True)):
    sheet(f'{tag}_상품컷.png', all_hit, C, 3, after)
    sheet(f'{tag}_와이드.png', [('idle', 0)] + worst[:8], (0, 190, 300, 340), 3, after)
