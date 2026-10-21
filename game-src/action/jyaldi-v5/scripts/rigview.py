import sys,rig
from PIL import Image,ImageDraw
s=2;names=sys.argv[2:];out=sys.argv[1]
n=max(len(rig.CLIPS[k][2]) for k in names)
sheet=Image.new('RGBA',(150*s*n,124*s*len(names)),(30,34,40,255))
for j,k in enumerate(names):
    for i,p in enumerate(rig.CLIPS[k][2]):
        im=rig.draw(p,None,s).crop((10*s,20*s,160*s,144*s)); sheet.alpha_composite(im,(i*150*s,j*124*s))
    ImageDraw.Draw(sheet).text((4,j*124*s+4),k,fill=(255,255,0,255))
sheet.save(out)
