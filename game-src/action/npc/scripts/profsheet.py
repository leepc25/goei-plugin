# 옆모습 기준 그림 4장씩 한 장에, 맨 앞은 쟈알디(흐리게). 사용: python3 profsheet.py 태그 id... -> ../review/prof-<태그>.png
import sys,os
from PIL import Image,ImageDraw
HERE=os.path.dirname(os.path.abspath(__file__)); P=os.path.join(HERE,'../profile')
J=Image.open(os.path.join(HERE,'../../jyaldi-v5/full/A2-pad.png')).convert('RGBA')
tag=sys.argv[1]; ids=sys.argv[2:]; s=2; cw,ch=130*s,124*s
im=Image.new('RGBA',(cw*5,ch*len(ids)),(44,56,62,255)); d=ImageDraw.Draw(im)
for y,id in enumerate(ids):
    for x in range(5):
        f=J if x==0 else Image.open(f'{P}/{id}/{x-1:02d}.png').convert('RGBA')
        f=f.crop((0,20,130,144)).resize((cw,ch),Image.NEAREST)
        if x==0: f.putalpha(f.getchannel('A').point(lambda v:v//3))
        im.alpha_composite(f,(x*cw,y*ch))
    d.text((4,y*ch+4),id,fill=(255,255,0,255))
im.save(os.path.join(HERE,f'../review/prof-{tag}.png'))
