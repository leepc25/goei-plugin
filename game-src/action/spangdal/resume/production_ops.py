"""스팡달만: MCP 요청/영수증 보존, 후보 회수, 마스크 외 원본 불변 검증."""
from pathlib import Path
import json, hashlib, base64, io, sys, urllib.request
from datetime import datetime, timezone
from PIL import Image, ImageDraw
import numpy as np
BASE=Path(__file__).resolve().parents[1]
PROD=BASE/'resume/production'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,obj): p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def init():
 p=PROD/'hand-inpaint-r1'; src=BASE/'full/clips/stab1/02.png'
 (p/'input.png').write_bytes(src.read_bytes())
 save(p/'provenance.json',{'source':'full/clips/stab1/02.png','input_sha256':sha(src),'source_commit':'986d160287a9b6c4c98a5434d86d12507c38f50d','job_id':'6aa5567e-0ffc-45df-a3a3-702ca373d66c','tool':'inpaint_image','estimated_generations':10,'reported_cost':'~10 generations','actual_cost':None,'actual_cost_status':'server receipt approximate; never inferred from shared balance','user_visual_approval':False})
def sheet(name,paths):
 imgs=[Image.open(p).convert('RGBA') for p in paths]; w,h=imgs[0].size
 ncol=min(4,len(imgs)); out=Image.new('RGB',(w*3*ncol,(h*3+22)*((len(imgs)+ncol-1)//ncol)),(52,62,71)); d=ImageDraw.Draw(out)
 for i,im in enumerate(imgs):
  x=i%ncol*w*3;y=i//ncol*(h*3+22);d.text((x+4,y+3),f'{name} {i:02}',fill='white'); im=im.resize((w*3,h*3),Image.Resampling.NEAREST);out.paste(im,(x,y+22),im)
 out.save(PROD/name/'review.png')
def recover(name):
 p=PROD/name;r=json.loads((p/'result.json').read_text(encoding='utf-8')); imgs=[c for c in r.get('content',[]) if c.get('type')=='image']
 if not imgs: raise RuntimeError('No inline image: save downloaded frame separately')
 for i,c in enumerate(imgs): (p/f'result-{i:02}.png').write_bytes(base64.b64decode(c['data']))
 sheet(name,sorted(p.glob('result-*.png')))
 if name=='hand-inpaint-r1':
  a=np.array(Image.open(p/'input.png').convert('RGBA')); b=np.array(Image.open(p/'result-00.png').convert('RGBA'))
  changed=np.any(a!=b,axis=2); outside=changed.copy();outside[78:92,109:131]=False
  save(p/'pixel-check.json',{'changed_pixels':int(changed.sum()),'outside_mask_changed':int(outside.sum()),'input_sha256':sha(p/'input.png'),'result_sha256':sha(p/'result-00.png')})
def crop_job(name,clip,indices,box,prompt):
 p=PROD/name;p.mkdir(parents=True,exist_ok=False);refs=[];sources=[]
 for i in indices:
  src=BASE/f'full/clips/{clip}/{i:02}.png';im=Image.open(src).convert('RGBA');im.crop(box).save(p/f'input-{i:02}.png'); raw=(p/f'input-{i:02}.png').read_bytes()
  refs.append('data:image/png;base64,'+base64.b64encode(raw).decode());sources.append({'frame':i,'path':str(src.relative_to(BASE)),'sha256':sha(src),'crop_sha256':hashlib.sha256(raw).hexdigest(),'box':box})
 save(p/'request.json',{'description':prompt,'image_urls':refs,'width':box[2]-box[0],'height':box[3]-box[1],'no_background':True,'seed':1022420})
 save(p/'provenance.json',{'clip':clip,'sources':sources,'tool':'edit_image','estimated_generations_max':25,'actual_cost':None,'user_visual_approval':False})
 sheet(name,sorted(p.glob('input-*.png')))
if __name__=='__main__':
 if sys.argv[1]=='init':init()
 elif sys.argv[1]=='recover':recover(sys.argv[2])
