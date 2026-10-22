from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import urllib.request,json
from PIL import Image,ImageDraw
out=Path('game-src/action/geshugan/resume/neck-edit');rows=json.loads((out/'inputs.json').read_text())
def fetch(row):
 i=row['index'];data=urllib.request.urlopen(f'https://api.pixellab.ai/mcp/images/c679844b-e541-48e4-9006-4b615ddb9dcc/download?index={i}',timeout=45).read();(out/f'result-{i:02}.png').write_bytes(data)
with ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(fetch,rows))
canvas=Image.new('RGBA',(7*256,4*280),(90,104,116,255));d=ImageDraw.Draw(canvas)
for n,row in enumerate(rows):
 for k,fn in enumerate([row['crop_file'],f'result-{n:02}.png']):
  im=Image.open(out/fn).convert('RGBA');print(n,k,im.size)
  x,y=(n%7)*256,((n//7)*2+k)*280
  canvas.alpha_composite(im.resize((256,256),Image.Resampling.NEAREST),(x,y+24));d.text((x+3,y+5),f'{n} {row["clip"]}/{row["frame"]} '+('BEFORE' if k==0 else 'AFTER'),fill='white')
canvas.save(out/'comparison.png')
