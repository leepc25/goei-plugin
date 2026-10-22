# 클립 장들을 한 줄로(검수용, 회색 바탕, 배율 s). 사용: strip.py 출력.png 폴더...
import sys,os,glob
from PIL import Image,ImageDraw
out=sys.argv[1]; dirs=sys.argv[2:]; s=3
rows=[]
for d in dirs:
    fs=sorted(glob.glob(d+'/*.png')); ims=[Image.open(f).convert('RGBA') for f in fs]
    if not ims: continue
    W,H=ims[0].size; row=Image.new('RGBA',(W*len(ims),H),(170,170,170,255))
    for i,im in enumerate(ims):
        row.alpha_composite(im,(i*W,0)); ImageDraw.Draw(row).line([(i*W,0),(i*W,H)],fill=(120,120,120,255))
        ImageDraw.Draw(row).line([(i*W,136),(i*W+W,136)],fill=(220,120,120,255))
    ImageDraw.Draw(row).text((2,2),os.path.basename(d),fill=(0,0,0,255)); rows.append(row)
Wm=max(r.width for r in rows); sheet=Image.new('RGBA',(Wm,sum(r.height for r in rows)),(150,150,150,255)); y=0
for r in rows: sheet.alpha_composite(r,(0,y)); y+=r.height
sheet.resize((sheet.width*s//2,sheet.height*s//2),Image.NEAREST).save(out)
