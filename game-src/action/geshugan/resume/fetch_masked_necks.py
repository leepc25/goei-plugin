from pathlib import Path
from PIL import Image,ImageDraw
import urllib.request,numpy as np,json
out=Path('game-src/action/geshugan/resume/neck-edit');data=urllib.request.urlopen('https://api.pixellab.ai/mcp/images/ee5ef44a-a16d-4ed1-a494-6578590bb498/download',timeout=40).read();(out/'masked-result.png').write_bytes(data)
a=Image.open(out/'masked-input.png').convert('RGBA');b=Image.open(out/'masked-result.png').convert('RGBA');mask=np.array(Image.open(out/'mask.png').convert('L'))>127
diff=np.any(np.array(a)!=np.array(b),axis=2);print('outside-mask changed',int((diff&~mask).sum()),'inside-mask changed',int((diff&mask).sum()))
(out/'mask-validation.json').write_text(json.dumps({'size':b.size,'outside_mask_changed':int((diff&~mask).sum()),'inside_mask_changed':int((diff&mask).sum())},indent=2))
canvas=Image.new('RGBA',(7*256,4*280),(90,104,116,255));d=ImageDraw.Draw(canvas);rows=json.loads((out/'masked-inputs.json').read_text())
for i,r in enumerate(rows):
 for k,im in enumerate([a,b]):
  x,y=(i%4)*64,(i//4)*64;crop=im.crop((x,y,x+64,y+64));px,py=(i%7)*256,((i//7)*2+k)*280
  canvas.alpha_composite(crop.resize((256,256),Image.Resampling.NEAREST),(px,py+24));d.text((px+2,py+5),f'{i} {r["clip"]}/{r["frame"]} '+('BEFORE' if k==0 else 'MASKED'),fill='white')
canvas.save(out/'masked-comparison.png')
