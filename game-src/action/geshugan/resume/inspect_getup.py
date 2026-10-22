from pathlib import Path
from PIL import Image,ImageDraw
p=Path('game-src/action/geshugan/resume/getup-edit')
a=Image.open('game-src/action/geshugan/clips/getup/03.png').convert('RGBA');b=Image.open(p/'result.png').convert('RGBA')
c=Image.new('RGBA',(640,320),(90,104,116,255))
for i,im in enumerate([a,b]):c.alpha_composite(im.crop((35,58,75,98)).resize((320,320),Image.Resampling.NEAREST),(i*320,0))
c.save(p/'faces.png')
import numpy as np
x,y=np.array(a),np.array(b);diff=np.any(x!=y,axis=2); yy,xx=np.where(diff); print('changed pixels',len(xx),'bbox', [int(xx.min()),int(yy.min()),int(xx.max()),int(yy.max())]); print('outside head',int(diff[90:,:].sum()))
