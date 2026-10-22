"""Download only already-paid, known Eileen results. Never submits a job."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import urllib.request
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / 'game-src/action/eileen/resume/live-20261022'
jobs = [('https://api.pixellab.ai/mcp/pixel-tools/f5621540-ebeb-43e3-871d-2dfdbceffe15/image.png', OUT/'precise-edit/exact-result.png')]
jobs += [('https://api.pixellab.ai/mcp/pixel-tools/4e74f296-d7bf-453b-a90e-bf8858ec1c7c/image.png', OUT/'precise-edit/exact-02.png')]
jobs += [(f'https://api.pixellab.ai/mcp/images/e92bce68-f025-4757-94b0-b16566cebe5d/download?index={i}', OUT/f'transition-bridge/{i:02d}.png') for i in range(9)]
jobs += [(f'https://api.pixellab.ai/mcp/images/5ce7b76d-7f1a-43e5-a28a-76f10b039fbd/download?index={i}', OUT/f'transition-rig/{i:02d}.png') for i in range(8)]

def fetch(pair):
    url, path = pair
    if not path.exists():
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read()
        tmp = path.with_suffix('.download')
        tmp.write_bytes(data)
        with Image.open(tmp) as im:
            assert im.size == (192,144), im.size
            im.verify()
        tmp.replace(path)
    return str(path.relative_to(ROOT))

if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=3) as pool:
        for path in pool.map(fetch,jobs): print(path)
    sheet = Image.new('RGBA',(192*5,164*2),(65,68,76,255))
    d=ImageDraw.Draw(sheet)
    for i in range(9):
        x,y=(i%5)*192,(i//5)*164
        d.text((x,y),f'transition new {i:02d}',fill='white')
        sheet.alpha_composite(Image.open(OUT/f'transition-bridge/{i:02d}.png').convert('RGBA'),(x,y+20))
        d.line((x,y+157,x+191,y+157),fill='#68ac72')
    sheet.resize((1920,656),Image.Resampling.NEAREST).save(OUT/'transition-bridge/review.png')
