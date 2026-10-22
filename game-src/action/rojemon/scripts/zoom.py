import sys
from PIL import Image,ImageDraw
import rig_rojemon as R, rig_puppets as PP, preview as V
allc={**R.CLIPS,**PP.CLIPS}
out=sys.argv[1]; names=sys.argv[2:]
rows=[]
for n in names:
    b,ps=allc[n]; f,kp,w,h=V.BASE[b]; s=3 if w>100 else 5
    box=(10*s,35*s,130*s,140*s) if w>100 else (0,10*s,96*s,96*s)
    cw=box[2]-box[0]; row=Image.new('RGBA',(cw*(len(ps)),box[3]-box[1]),(20,22,26,255))
    for i,p in enumerate(ps): row.alpha_composite(V.draw(p,w,h,None,s).crop(box),(i*cw,0))
    ImageDraw.Draw(row).text((4,4),n,fill=(255,255,0,255)); rows.append(row)
W=max(r.width for r in rows); sheet=Image.new('RGBA',(W,sum(r.height for r in rows)),(0,0,0,255)); y=0
for r in rows: sheet.alpha_composite(r,(0,y)); y+=r.height
sheet.save(out)
