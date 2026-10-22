# 뼈대 미리보기: python3 preview.py <kind>  → ../plan/<kind>.png (첫 칸 = 기준 그림 + 자동 관절)
import sys,os
from PIL import Image,ImageDraw
sys.path.insert(0,os.path.dirname(__file__))
import mobs_h
from mobrig import ROOT,flipv
k=sys.argv[1]; m=mobs_h.BUILD[k]().final(); B=m.B; sc=2
base=Image.open(f'{ROOT}/{k}/base.png').convert('RGBA')
ref=flipv(m.ref,*m.ref_tb) if m.flipped else m.ref
rows=[('REF',[ref])]+list(m.CLIPS.items())
W,H=B.W,B.H; cols=max(len(p) for _,p in rows)+1
im=Image.new('RGBA',(W*sc*cols,H*sc*len(rows)),(30,34,40,255)); d=ImageDraw.Draw(im)
for r,(n,ps) in enumerate(rows):
    for i,p in enumerate(ps):
        cell=B.draw(p,base if i==0 and n=='REF' else None,sc); im.alpha_composite(cell,((i+1)*W*sc,r*H*sc))
    d.text((4,r*H*sc+4),n,fill=(255,255,0,255))
os.makedirs(f'{ROOT}/plan',exist_ok=True); im.save(f'{ROOT}/plan/{k}.png'); print(k,len(rows)-1,'clips',sum(len(p) for _,p in rows[1:]),'frames','jobs',[sum(len(m.CLIPS[x]) for x in g) for g in m.jobs()], 'audit',B.audit() if hasattr(B,'CLIPS') else '')
