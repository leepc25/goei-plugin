"""소지품 그림 회차 미리보기: python3 tools/pixellab/item_icons_preview.py <회차>..."""
import json, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
fp = subprocess.run(['fc-match', '-f', '%{file}', ':lang=ko'], capture_output=True, text=True).stdout
f = ImageFont.truetype(fp, 16)
for n in map(int, sys.argv[1:]):
    B = f'game-src/items/raw/batch_{n:02d}'
    items = json.load(open(f'{B}/request.json', encoding='utf-8'))['items']
    S, P = 120, 10; W = 8 * (S + P) + P; H = 2 * (S + P + 24) + P
    im = Image.new('RGB', (W, H), '#16181d'); d = ImageDraw.Draw(im)
    for i in range(16):
        x = P + (i % 8) * (S + P); y = P + (i // 8) * (S + P + 24)
        d.rounded_rectangle([x, y, x + S, y + S], 8, fill='#23262e', outline='#3a3e48')
        try:
            ic = Image.open(f'{B}/{i + 1:02d}.png').convert('RGBA').resize((S, S), Image.NEAREST); im.paste(ic, (x, y), ic)
        except FileNotFoundError: pass
        name = items[i]['ko'] if i < len(items) else '(공용)'
        d.text((x + 3, y + S + 3), f"{i + 1}.{name}"[:11], font=f, fill='#d8dce4')
    im.save(f'{B}/preview.png')
