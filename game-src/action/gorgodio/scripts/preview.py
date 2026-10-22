# 뼈대 미리보기(굵은 팔다리·머리 원, 무료). 사용: python3 preview.py [--armor] 이름... → ../skel/pv-<첫이름>.png
import sys
from PIL import Image,ImageDraw
sys.path.insert(0,'.')
ARM='--armor' in sys.argv
R=__import__('rig_armor' if ARM else 'rig'); B=R.B
from rigbase import BONES
def fr(p,sc=2):
    im=Image.new('RGBA',(B.W*sc,B.H*sc),(44,56,62,255)); d=ImageDraw.Draw(im)
    d.line([(0,(B.G+8)*sc),(B.W*sc,(B.G+8)*sc)],fill=(140,150,160,255),width=2)
    q={k:(v[0]*sc,v[1]*sc) for k,v in p.items()}
    order=[b for b in BONES if 'LEFT' in b[0]+b[1]]+[b for b in BONES if 'LEFT' not in b[0]+b[1] and 'RIGHT' not in b[0]+b[1]]+[b for b in BONES if 'RIGHT' in b[0]+b[1]]
    for a,b in order:
        c=(255,110,110,255) if 'RIGHT' in a+b else (90,150,255,255) if 'LEFT' in a+b else (235,235,235,255)
        w=(7 if 'HIP' in a+b and 'NECK' in a+b else 5)*sc//2
        d.line([q[a],q[b]],fill=c,width=w)
    n=q['NOSE']; e=q['RIGHT EAR']; cx,cy=(n[0]+e[0])/2,(n[1]+e[1])/2-2*sc; r=8*sc
    d.ellipse([cx-r,cy-r,cx+r,cy+r],outline=(255,230,80,255),width=2); d.ellipse([n[0]-3,n[1]-3,n[0]+3,n[1]+3],fill=(255,230,80,255))
    return im
names=[a for a in sys.argv[1:] if not a.startswith('--')]
rows=[]
for nm in names:
    _,_,ps=B.CLIPS[nm]
    row=Image.new('RGBA',(B.W*2*len(ps),B.H*2),(20,20,24,255))
    for i,p in enumerate(ps): row.alpha_composite(fr(p),(i*B.W*2,0))
    ImageDraw.Draw(row).text((6,6),nm,fill=(255,255,0,255)); rows.append(row)
W=max(r.width for r in rows); im=Image.new('RGBA',(W,sum(r.height for r in rows)),(20,20,24,255)); y=0
for r in rows: im.alpha_composite(r,(0,y)); y+=r.height
out=f'../skel/pv-{names[0]}.png'; im.save(out); print(out,im.size)
