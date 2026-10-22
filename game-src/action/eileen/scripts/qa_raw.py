# 생성 원본(clips/) 검수 묶음: python3 qa_raw.py out.png 클립... (2배, 캔버스 전체, 바닥선 y=136 빨강)
import sys,os
from PIL import Image,ImageDraw
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'../clips')
out,names=sys.argv[1],sys.argv[2:]
rows=[]
for n in names:
    fs=sorted(f for f in os.listdir(f'{D}/{n}') if f.endswith('.png'))
    rows.append((n,[Image.open(f'{D}/{n}/{f}').convert('RGBA') for f in fs]))
mx=max(len(r[1]) for r in rows); W,H=192,144
c=Image.new('RGBA',(W*mx,(H+12)*len(rows)),(70,78,86,255)); d=ImageDraw.Draw(c)
for k,(n,ims) in enumerate(rows):
    y=k*(H+12); d.text((2,y),n,fill='white')
    for i,im in enumerate(ims):
        c.alpha_composite(im,(i*W,y+12)); d.line((i*W,y+12+136,i*W+W-1,y+12+136),fill=(160,40,40,255)); d.rectangle((i*W,y+12,i*W+W-1,y+12+H-1),outline=(40,44,50,255))
c.resize((c.width*2,c.height*2),Image.NEAREST).save(out)
