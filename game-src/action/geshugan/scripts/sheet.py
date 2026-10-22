# 후보 비교판: 첫 칸 쟈알디, 나머지 후보. 사용: python3 sheet.py out.png a.png b.png ...
import sys
from PIL import Image
out,fs=sys.argv[1],sys.argv[2:]
ims=[Image.open('../jyaldi-v5/full/clips/idle/00.png').convert('RGBA')]+[Image.open(f).convert('RGBA') for f in fs]
o=Image.new('RGBA',(100*len(ims),110),(120,130,140,255))
for i,im in enumerate(ims): o.alpha_composite(im.crop((10,30,110,140)),(100*i,0))
o.resize((o.width*3,o.height*3),Image.NEAREST).save(out)
