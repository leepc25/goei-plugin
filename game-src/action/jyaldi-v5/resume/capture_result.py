"""Recover an already completed PixelLab job from its saved tool response; no generation."""
from pathlib import Path
import argparse,json,hashlib,urllib.request
from PIL import Image,ImageDraw
p=argparse.ArgumentParser();p.add_argument('receipt');p.add_argument('output');a=p.parse_args()
receipt=Path(a.receipt);out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
r=json.loads(receipt.read_text(encoding='utf-8'));r=r.get('response',r)
data=r['structuredContent'];assert data['status']=='completed'
urls=data['download_urls'];frames=[];meta=[]
for i,url in enumerate(urls):
 path=out/f'{i:02d}.png'
 if not path.exists():
  with urllib.request.urlopen(url,timeout=45) as response:path.write_bytes(response.read())
 im=Image.open(path).convert('RGBA');frames.append(im)
 meta.append({'index':i,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'size':list(im.size),'bbox':list(im.getbbox())})
w,h=frames[0].size;cols=min(4,len(frames));rows=(len(frames)+cols-1)//cols
sheet=Image.new('RGB',(w*3*cols,(h*3+24)*rows),'#24323b');draw=ImageDraw.Draw(sheet)
for i,im in enumerate(frames):
 x=i%cols*w*3;y=i//cols*(h*3+24);big=im.resize((w*3,h*3),Image.Resampling.NEAREST)
 sheet.paste(big,(x,y+24),big);draw.text((x+10,y+4),f'{i:02d}',fill='white');draw.line((x,y+24+136*3,x+w*3,y+24+136*3),fill='#b68d71')
sheet.save(out.parent/(out.name+'-sheet.png'))
(out.parent/(out.name+'-hashes.json')).write_text(json.dumps({'job_id':data['job_id'],'charged_generations':data.get('charged_generations'),'frames':meta},indent=2)+'\n',encoding='utf-8')
print(json.dumps({'job_id':data['job_id'],'frames':len(frames),'charged':data.get('charged_generations')}))
