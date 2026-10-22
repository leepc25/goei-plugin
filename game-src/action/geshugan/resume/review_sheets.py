from pathlib import Path
import hashlib,json
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent;SRC=OUT.parent
manifest=json.loads((SRC/'final/manifest.json').read_text());rows=[];inventory=[]
for name,c in manifest['clips'].items():
 if name in ['undress','showerturn','shower','bath','lookback','snap','mark','slam']:continue
 strip=Image.open(SRC/'final'/f'{name}.png').convert('RGBA')
 for start in range(0,c['frames'],8):
  row=Image.new('RGBA',(1536,164),(90,104,116,255));d=ImageDraw.Draw(row)
  for i in range(start,min(c['frames'],start+8)):
   im=strip.crop((i*192,0,(i+1)*192,144));x=(i-start)*192;source=c['frameSources'][i]
   row.alpha_composite(im,(x,20));d.text((x+4,2),f'{name} {i} / {source["clip"]} {source["frame"]}',fill='white');d.line((x,156,x+191,156),fill=(160,90,90))
   inventory.append({'clip':name,'final_frame':i,'source':source,'rgba_sha256':hashlib.sha256(im.tobytes()).hexdigest()})
  rows.append(row)
(OUT/'sheets').mkdir(exist_ok=True)
for p in range(0,len(rows),4):
 sheet=Image.new('RGBA',(1536,164*len(rows[p:p+4])))
 for j,row in enumerate(rows[p:p+4]):sheet.paste(row,(0,j*164))
 sheet.save(OUT/'sheets'/f'page-{p//4:02d}.png')
(OUT/'frame-inventory.json').write_text(json.dumps(inventory,indent=2)+'\n')
print(len(inventory),'frames')
