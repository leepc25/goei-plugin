"""Pack accepted PixelLab chin pixels at original coordinates; never change raw clips."""
from pathlib import Path
import json,hashlib
from PIL import Image
import numpy as np
SRC=Path(__file__).resolve().parents[1]
OUT=Path(__file__).resolve().parent

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def apply(folder,job,input_name,result_name,rows_name,tool='inpaint_image',image_id=None):
 root=OUT/folder;rows=json.loads((root/rows_name).read_text(encoding='utf-8'))
 atlas=Image.open(root/result_name).convert('RGBA');before=Image.open(root/input_name).convert('RGBA');mask=Image.open(root/'mask.png').convert('L')
 assert atlas.size==before.size==mask.size
 data=json.loads((OUT/'accepted-edits.json').read_text(encoding='utf-8'));stats=[]
 for r in rows:
  n=r['index'];x,y=(n%4)*64,(n//4)*64
  source=SRC/r['source'];original=Image.open(source).convert('RGBA');assert digest(source)==r['source_sha256']
  left,top,_,_=r['crop_box'];box=r['repair_crop_box'];global_box=[left+box[0],top+box[1],left+box[2],top+box[3]]
  patch=atlas.crop((x+box[0],y+box[1],x+box[2],y+box[3]));result=original.copy();result.paste(patch,global_box[:2])
  a,b=np.array(original),np.array(result);changed=np.any(a!=b,axis=2);allowed=np.zeros(changed.shape,dtype=bool);allowed[global_box[1]:global_box[3],global_box[0]:global_box[2]]=True
  assert not (changed&~allowed).any();assert changed.any()
  target=OUT/'repaired'/r['clip']/f'{r["frame"]:02}.png';target.parent.mkdir(parents=True,exist_ok=True);result.save(target)
  key=f'{r["clip"]}/{r["frame"]:02d}'
  data['frames'][key]={'original':r['source'],'original_sha256':digest(source),'replacement':target.relative_to(SRC).as_posix(),'replacement_sha256':digest(target),'job_id':job,'image_id':image_id,'tool':tool,'patch_box':global_box,'atlas_index':n,'atlas_source_sha256':digest(root/input_name),'atlas_result_sha256':digest(root/result_name),'mask_sha256':digest(root/'mask.png'),'transform':'copy reviewed chin region from guarded exact edit; original RGBA outside patch preserved exactly','review':'original face skin, eye and head size retained; beard tail removed with explicit pixels; user visual approval pending'}
  stats.append({'frame':key,'changed_pixels':int(changed.sum()),'outside_patch_changed':0})
 (OUT/'accepted-edits.json').write_text(json.dumps(data,indent=2),encoding='utf-8');(root/'accepted-validation.json').write_text(json.dumps(stats,indent=2),encoding='utf-8');print(folder,len(stats),'frames packed')
if __name__=='__main__':
 apply('neck-exact',None,'input.png','result.png','inputs.json','pixelart_workbench','79a13fde-b17e-47b7-8e9b-11c47ba8f0f9')
