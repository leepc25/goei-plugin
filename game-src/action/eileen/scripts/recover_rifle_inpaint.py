"""Recover one charged mask job and measure preservation; never submit jobs."""
from pathlib import Path
from PIL import Image, ImageDraw
import urllib.request,json,hashlib,numpy as np
ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'game-src/action/eileen/resume/live-20261022'
D=OUT/'transition-mask'
job='ad4c134d-a12b-493f-996f-aa9fa2340811'
p=D/'result.png'
if not p.exists():
 with urllib.request.urlopen(f'https://api.pixellab.ai/mcp/images/{job}/download?index=0',timeout=120) as response:p.write_bytes(response.read())
before=Image.open(D/'input.png').convert('RGBA');after=Image.open(p).convert('RGBA')
mask=np.array(Image.open(D/'mask.png').convert('L'))>0
assert after.size==before.size==(256,256)
changed=np.any(np.array(before)!=np.array(after),axis=2)
report={'job_id':job,'outside_mask_changed_pixels':int((changed&~mask).sum()),'inside_mask_changed_pixels':int((changed&mask).sum()),'frames':[]}
review=Image.new('RGBA',(768,328),'#41444c');draw=ImageDraw.Draw(review)
for slot,index in enumerate([2,3,4,5]):
 x,y=slot%2*128,slot//2*128
 original=Image.open(OUT/f'transition-rig/{index:02d}.png').convert('RGBA')
 restored=original.copy();restored.paste(after.crop((x,y,x+128,y+128)),(16,16));dest=D/f'{index:02d}.png';restored.save(dest)
 report['frames'].append({'source_frame':index,'output_sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'changed_pixels':int(changed[y:y+128,x:x+128].sum())})
 for row,im in enumerate([original,restored]):
  review.alpha_composite(im,(slot*192,row*164+20));draw.text((slot*192+2,row*164),f'{"before" if row==0 else "masked"} {index:02d}',fill='white')
review.resize((1536,656),Image.Resampling.NEAREST).save(D/'comparison.png')
(D/'preservation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
