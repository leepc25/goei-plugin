from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
from scipy import ndimage
src=Path('game-src/action/geshugan');canvas=Image.new('RGBA',(8*192,192),(90,104,116,255));d=ImageDraw.Draw(canvas)
for i in range(8):
 im=Image.open(src/'clips/chain2'/f'{i:02}.png').convert('RGBA');a=np.array(im).astype(int)
 skin=(a[:,:,3]>0)&(a[:,:,0]>a[:,:,1]+15)&(a[:,:,1]>a[:,:,2]+10);lab,n=ndimage.label(skin);groups=[]
 for k in range(1,n+1):
  yy,xx=np.where(lab==k)
  if len(xx)>3:groups.append((yy.min(),xx,yy))
 _,xx,yy=min(groups,key=lambda v:v[0]);left=int(xx.min())-12;top=int(yy.min())-12
 crop=im.crop((left,top,left+32,top+32)).resize((192,192),Image.Resampling.NEAREST);canvas.alpha_composite(crop,(i*192,0));d.text((i*192+3,3),f'chain2/{i}',fill='yellow')
canvas.save(src/'resume/chain2-faces.png')
