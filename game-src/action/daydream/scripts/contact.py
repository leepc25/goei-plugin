# 검수용 접촉 시트: 클립마다 한 줄, 장을 나란히(몸 둘레만 잘라 S배). 사용: python3 contact.py <id> <out.png> [이름...]
import sys,os,glob
from PIL import Image,ImageDraw
CID,OUT=sys.argv[1],sys.argv[2]; S=2
names=sys.argv[3:] or sorted(os.listdir(f'../{CID}/clips'))
X0,Y0,CW,CH=20,24,150,118
rows=[]
for n in names:
    fs=sorted(glob.glob(f'../{CID}/clips/{n}/*.png'))
    if not fs: continue
    r=Image.new('RGBA',(90+len(fs)*CW*S,CH*S),(52,58,64,255)); d=ImageDraw.Draw(r); d.text((4,4),n,fill=(255,255,0))
    for i,f in enumerate(fs):
        im=Image.open(f).convert('RGBA').crop((X0,Y0,X0+CW,Y0+CH)).resize((CW*S,CH*S),Image.NEAREST)
        r.alpha_composite(im,(90+i*CW*S,0)); d.line([(90+i*CW*S,0),(90+i*CW*S,CH*S)],fill=(90,90,90))
        d.line([(90+i*CW*S,(136-Y0)*S),(90+(i+1)*CW*S,(136-Y0)*S)],fill=(110,120,130))
    rows.append(r)
W=max(r.width for r in rows); o=Image.new('RGBA',(W,sum(r.height+4 for r in rows)),(30,30,34,255)); y=0
for r in rows: o.alpha_composite(r,(0,y)); y+=r.height+4
o.save(OUT); print(o.size)
