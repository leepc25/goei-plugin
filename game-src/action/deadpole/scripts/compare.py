# 쟈알디와 나란히: 발바닥 y=136 맞춰 192×144에 놓고 4배 확대 + 키 표시. python3 compare.py out.png 그림...
import sys,os
from PIL import Image,ImageDraw
J='../jyaldi-v5/full/'
def place(path):
    im=Image.open(path).convert('RGBA'); bb=im.getbbox(); c=im.crop(bb)
    can=Image.new('RGBA',(192,144),(0,0,0,0)); x=57-c.width//2; can.alpha_composite(c,(max(0,x),136-c.height)); return can,c.height
out=sys.argv[1]; items=[(J+'base-idle-side.png','쟈알디 대기'),(J+'clips/guard/00.png','쟈알디 전투')]+[(p,os.path.basename(p)) for p in sys.argv[2:]]
s=4; W=110
sheet=Image.new('RGBA',(W*s*len(items),144*s),(88,92,104,255)); d=ImageDraw.Draw(sheet)
for i,(p,lab) in enumerate(items):
    can,h=place(p) if not p.startswith(J) else (Image.open(p).convert('RGBA'),Image.open(p).getbbox()[3]-Image.open(p).getbbox()[1])
    sheet.alpha_composite(can.crop((0,0,W,144)).resize((W*s,144*s),Image.NEAREST),(i*W*s,0))
    d.text((i*W*s+6,6),f'{lab} h={h}',fill=(255,255,0,255))
for y in (37,136): d.line([(0,y*s),(sheet.width,y*s)],fill=(255,80,80,255))
sheet.save(out)
