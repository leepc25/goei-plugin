# 검수용 장 묶음: python3 qa_sheet.py out.png 클립... (final 스트립 기준, 총구=노랑 점, 앞손=빨강, 뒷손=파랑)
import sys,os,json
from PIL import Image,ImageDraw
F=os.path.join(os.path.dirname(os.path.abspath(__file__)),'../final')
m=json.load(open(f'{F}/manifest.json'))['clips']
out,names=sys.argv[1],[n for n in sys.argv[2:] if n in m]
Z=2; cw,ch=120,104   # 몸 둘레만 자름(x 10~130, y 36~140)
rows=[]
for n in names:
    s=Image.open(f'{F}/{n}.png').convert('RGBA'); k=m[n]['frames']
    row=Image.new('RGBA',(cw*Z*k+150,ch*Z+4),(74,82,90,255)); d=ImageDraw.Draw(row)
    d.text((4,4),n,fill=(255,255,255,255))
    for i in range(k):
        fr=s.crop((i*192+10,36,i*192+130,140)).resize((cw*Z,ch*Z),Image.NEAREST)
        row.alpha_composite(fr,(150+i*cw*Z,2))
        a=m[n].get('anchors',[{}]*k)[i]
        for key,col in (('muzzle',(255,225,74,255)),):
            if key in a: x,y=a[key][0],a[key][1]; X,Y=150+i*cw*Z+(x-10)*Z,2+(y-36)*Z; d.rectangle([X-2,Y-2,X+2,Y+2],fill=col)
        d.text((150+i*cw*Z+3,ch*Z-12),str(i),fill=(255,255,255,255))
    rows.append(row)
W=max(r.width for r in rows); im=Image.new('RGBA',(W,sum(r.height for r in rows)),(40,44,50,255)); y=0
for r in rows: im.paste(r,(0,y)); y+=r.height
im.save(out)
