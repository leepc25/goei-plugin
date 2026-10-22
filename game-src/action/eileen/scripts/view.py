# 뼈대 확대 보기: python3 view.py out.png 클립... (소총 = 가까운 손→먼 손 연장선, 노란색)
import sys; sys.path.insert(0,'.')
import erig
from PIL import Image,ImageDraw
from rig import J
BONES=erig.rig.BONES
def fr(p,s=3,gun=False):
    im=Image.new('RGB',(110*s,120*s),(36,44,50)); d=ImageDraw.Draw(im)
    o=lambda v:((v[0]-5)*s,(v[1]-0)*s)
    d.line([o((0,100)),o((110,100))],fill=(90,100,110))
    for a,b in BONES:
        c=(255,90,90) if 'RIGHT' in a+b else (90,170,255) if 'LEFT' in a+b else (230,230,230)
        d.line([o(p[a]),o(p[b])],fill=c,width=s)
    if gun:
        n,f=p['RIGHT ARM'],p['LEFT ARM']; dx,dy=f[0]-n[0],f[1]-n[1]; L=max(1,(dx*dx+dy*dy)**.5)
        d.line([o((n[0]-dx/L*12,n[1]-dy/L*12)),o((f[0]+dx/L*14,f[1]+dy/L*14))],fill=(250,220,60),width=s)
    d.ellipse([o(p['NOSE'])[0]-4,o(p['NOSE'])[1]-4,o(p['NOSE'])[0]+4,o(p['NOSE'])[1]+4],fill=(255,230,80))
    return im
out=sys.argv[1]; names=sys.argv[2:]
rows=[]
for n in names:
    a,pr,b,ps=erig.CLIPS[n]; gun=('rifle' in pr or 'shotgun' in pr or 'pipe' in pr) and 'back' not in pr.split(',')[0]
    ims=[fr(p,2,gun) for p in ps]; w=sum(i.width for i in ims)
    r=Image.new('RGB',(w,ims[0].height+16),(20,20,24)); x=0
    for i in ims: r.paste(i,(x,16)); x+=i.width
    ImageDraw.Draw(r).text((4,2),f'{n} [{b}] {a[:90]}',fill=(255,255,0)); rows.append(r)
W=max(r.width for r in rows); Hh=sum(r.height for r in rows)
sheet=Image.new('RGB',(W,Hh)); y=0
for r in rows: sheet.paste(r,(0,y)); y+=r.height
sheet.save(out)
