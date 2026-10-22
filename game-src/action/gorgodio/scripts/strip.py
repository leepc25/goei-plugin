# 클립 장들을 한 줄로 이어 보기(검수용). 사용: python3 strip.py 폴더 이름... [--s=3] → scratchpad
import sys,os
from PIL import Image,ImageDraw
root=sys.argv[1]; names=[a for a in sys.argv[2:] if not a.startswith('--')]
s=int(([a[4:] for a in sys.argv if a.startswith('--s=')] or ['2'])[0])
rows=[]
for n in names:
    fs=sorted(f for f in os.listdir(f'{root}/{n}') if f.endswith('.png'))
    ims=[Image.open(f'{root}/{n}/{f}').convert('RGBA') for f in fs]
    w,h=ims[0].size; row=Image.new('RGBA',(w*len(ims),h),(90,100,110,255))
    for i,im in enumerate(ims):
        row.alpha_composite(im,(i*w,0)); ImageDraw.Draw(row).line([(i*w,0),(i*w,h)],fill=(60,70,80,255))
    ImageDraw.Draw(row).text((3,3),n,fill=(255,255,0,255)); rows.append(row)
W=max(r.width for r in rows); out=Image.new('RGBA',(W,sum(r.height for r in rows)),(40,44,50,255)); y=0
for r in rows: out.alpha_composite(r,(0,y)); y+=r.height
out=out.resize((out.width*s,out.height*s),Image.NEAREST)
p='/tmp/claude-0/-home-user-goei-plugin/e5155e2f-7173-501a-9ff8-5259b6d64981/scratchpad/g/strip-'+names[0]+'.png'; out.save(p); print(p,out.size)
