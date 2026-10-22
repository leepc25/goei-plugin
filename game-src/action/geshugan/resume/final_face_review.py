from pathlib import Path
from PIL import Image,ImageDraw
import json
src=Path('game-src/action/geshugan');out=src/'resume';edits=json.loads((out/'accepted-edits.json').read_text())['frames'];canvas=Image.new('RGBA',(4*256,5*184),(90,104,116,255));d=ImageDraw.Draw(canvas)
for n,(key,e) in enumerate(edits.items()):
 x,y=(n%4)*256,(n//4)*184;box=e['patch_box'];left,top=box[0]-18,box[1]-22
 for k,p in enumerate([e['original'],e['replacement']]):
  im=Image.open(src/p).convert('RGBA').crop((left,top,left+32,top+40)).resize((128,160),Image.Resampling.NEAREST);canvas.alpha_composite(im,(x+k*128,y+24))
  d.text((x+k*128+2,y+4),key+(' old' if k==0 else ' NEW'),fill='white')
canvas.save(out/'final-face-review.png')
