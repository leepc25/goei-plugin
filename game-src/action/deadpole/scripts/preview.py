# 뼈대 미리보기(확대·잘라냄): python3 preview.py 출력.png 이름...
import sys,os
from PIL import Image,ImageDraw
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import rig
out=sys.argv[1]; names=sys.argv[2:]
s=3; cw,ch=150,130; x0,y0=-10,12
n=max(len(rig.CLIPS[k][2]) for k in names)
sheet=Image.new('RGBA',(cw*s*n,ch*s*len(names)),(30,34,40,255))
for j,k in enumerate(names):
    for i,p in enumerate(rig.CLIPS[k][2]):
        im=rig.draw(p,s).crop(((x0)*s,y0*s,(x0+cw)*s,(y0+ch)*s)); sheet.alpha_composite(im,(i*cw*s,j*ch*s))
        ImageDraw.Draw(sheet).text((i*cw*s+4,j*ch*s+16),str(i),fill=(200,200,200,255))
    ImageDraw.Draw(sheet).text((4,j*ch*s+4),k,fill=(255,255,0,255))
sheet.save(out)
