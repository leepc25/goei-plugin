from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np,json
R=Path(__file__).resolve().parent
exec((R/'append_v06_assets.py').read_text(encoding='utf-8').split('R=Path')[0])
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',14)
def extract(kind,count,threshold=220):
 a=np.array(Image.open(R/f'assets/{kind}-v09-source.png').convert('RGBA'));labels,n,boxes=components(a[:,:,3]>=threshold);sizes=np.bincount(labels.ravel())
 ids=sorted(range(1,n+1),key=lambda c:sizes[c],reverse=True)[:count]
 assert len(ids)==count and min(sizes[c] for c in ids)>300,(kind,len(ids),[int(sizes[c]) for c in ids])
 ids.sort(key=lambda c:boxes[c-1][0].start+boxes[c-1][0].stop)
 ids=sum([sorted(ids[k:k+4],key=lambda c:boxes[c-1][1].start) for k in range(0,count,4)],[])
 out=[]
 for cid in ids:
  ys,xs=boxes[cid-1];p=a[ys,xs].copy();p[:,:,3]=np.where(labels[ys,xs]==cid,255,0);out.append(Image.fromarray(p))
 return out
if __name__=='__main__':
 report={}
 for kind,count in [('move',16),('attack',8),('crouch',12),('run',8),('jab',4)]:
  if not (R/f'assets/{kind}-v09-source.png').exists():continue
  images=extract(kind,count,240 if kind=='move' else 220);report[kind]=[list(im.size) for im in images]
  out=R/'output/v09-inspection';out.mkdir(exist_ok=True)
  sheet=Image.new('RGB',(1280,((count+3)//4)*390),(32,39,50));d=ImageDraw.Draw(sheet)
  for i,im in enumerate(images):
   im.save(out/f'{kind}-{i}.png');scale=min(1.7,330/im.height,295/im.width);small=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.NEAREST);x=i%4*320+(320-small.width)//2;y=i//4*390+45
   sheet.paste(small,(x,y),small);d.text((i%4*320+10,i//4*390+10),f'{kind} {i} / {im.width} x {im.height}',font=font,fill='white')
  sheet.save(out/f'{kind}-sheet.png')
 (R/'output/v09-source-dimensions.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
