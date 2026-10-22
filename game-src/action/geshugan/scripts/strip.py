# 클립 장을 한 줄로 늘어놓은 검수판(배경 회색, 3배). 사용: python3 strip.py out.png 클립...
import sys,os
from PIL import Image,ImageDraw
out,names=sys.argv[1],sys.argv[2:]
rows=[]
for n in names:
    d=f'clips/{n}'; fs=sorted(f for f in os.listdir(d) if f.endswith('.png'))
    row=Image.new('RGBA',(120*(len(fs)+1),124),(120,130,140,255))
    g=Image.open('base/G0.png').convert('RGBA').crop((10,20,130,144)); row.alpha_composite(g,(0,0))
    for i,f in enumerate(fs): row.alpha_composite(Image.open(f'{d}/{f}').convert('RGBA').crop((10,20,130,144)),(120*(i+1),0))
    ImageDraw.Draw(row).text((2,2),n,fill=(255,255,0,255)); rows.append(row)
w=max(r.width for r in rows); o=Image.new('RGBA',(w,124*len(rows)),(90,90,90,255))
for i,r in enumerate(rows): o.alpha_composite(r,(0,124*i))
o.resize((o.width*2,o.height*2),Image.NEAREST).save(out)
