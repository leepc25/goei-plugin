# 뼈대 미리보기(생성 0회): 클립마다 한 줄, 첫 칸 기준 그림 + 기준 관절, 다음 칸부터 장별 뼈대. ../preview/plan-NN.png
import sys,os
from PIL import Image,ImageDraw
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import grig as R
J=R.J; OUT=os.path.join(os.path.dirname(__file__),'../preview'); os.makedirs(OUT,exist_ok=True)
base=Image.open(os.path.join(os.path.dirname(__file__),'../base/G0.png')).convert('RGBA')
CW,CH=(4,16,170,144)[2]-4,144-16
def cell(p,b=None):
    im=J.draw(p,b,1).crop((4,16,170,144)); return im
names=sys.argv[1:] or list(R.CLIPS)
rows=[]
for n in names:
    ps=R.CLIPS[n][2]
    row=Image.new('RGBA',(CW*(len(ps)+1),CH),(30,34,40,255)); row.alpha_composite(cell(J.anatomic(R.BASE),base),(0,0))
    for i,p in enumerate(ps): row.alpha_composite(cell(p),((i+1)*CW,0))
    d=ImageDraw.Draw(row); d.rectangle([0,0,90,10],fill=(0,0,0,255)); d.text((2,0),n,fill=(255,255,0,255)); rows.append(row)
for i in range(0,len(rows),8):
    grp=rows[i:i+8]; w=max(r.width for r in grp)
    sheet=Image.new('RGBA',(w,CH*len(grp)),(20,20,24,255))
    for j,r in enumerate(grp): sheet.alpha_composite(r,(0,j*CH))
    sheet.save(f'{OUT}/plan-{i//8:02d}.png')
print(len(rows),'rows')
