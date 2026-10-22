from pathlib import Path
from PIL import Image,ImageDraw
import urllib.request,numpy as np,json
out=Path('game-src/action/geshugan/resume/neck-chain2');data=urllib.request.urlopen('https://api.pixellab.ai/mcp/images/cd0766c8-87f7-4b50-8a9c-a7d79c5c3896/download',timeout=40).read();(out/'result.png').write_bytes(data)
a=Image.open(out/'input.png').convert('RGBA');b=Image.open(out/'result.png').convert('RGBA');mask=np.array(Image.open(out/'mask.png').convert('L'))>127;diff=np.any(np.array(a)!=np.array(b),axis=2)
(out/'mask-validation.json').write_text(json.dumps({'outside_mask_changed':int((diff&~mask).sum()),'inside_mask_changed':int((diff&mask).sum())},indent=2));print('outside mask',int((diff&~mask).sum()))
rows=json.loads((out/'inputs.json').read_text());canvas=Image.new('RGBA',(6*192,2*216),(90,104,116,255));d=ImageDraw.Draw(canvas)
for n,r in enumerate(rows):
 for k,im in enumerate([a,b]):
  x,y=(n%4)*64,(n//4)*64;crop=im.crop((x,y,x+64,y+64));canvas.alpha_composite(crop.resize((192,192),Image.Resampling.NEAREST),(n*192,k*216+24));d.text((n*192+2,k*216+3),f'chain2/{r["frame"]} '+('before' if k==0 else 'masked'),fill='white')
canvas.save(out/'comparison.png')
