"""Regenerate an explicitly reviewed mask on one frame; preserve other pixels."""
import argparse,base64,fcntl,io,json,shutil,zipfile,hashlib
from PIL import Image,ImageDraw
from field_character_production import OUT,Production,atomic,request

def main():
 p=argparse.ArgumentParser();p.add_argument('config');p.add_argument('--submit',action='store_true');p.add_argument('--apply',help='Findings after inspecting repaired frame and neighboring poses');a=p.parse_args()
 cfg=json.load(open(a.config));slug=cfg['slug'];slot=cfg['slot'];idx=cfg['frame_index'];base=cfg['base_job_id']
 with (OUT/'.runner.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  prod=Production();c=prod.s['characters'][slug]
  assert all(x.get('eight_way_visual_reviewed') for x in prod.s['characters'].values())
  assert c['character_id']==cfg['character_id'] and c['motions'][slot]==base
  assert prod.s['jobs'][base]['status']=='completed'
  root=OUT/'motion-frame-repairs'/slug/slot/cfg['revision'];root.mkdir(parents=True,exist_ok=True)
  key='motion-frame-repair-'+slot+'-'+cfg['revision'];jid=c.get(key)
  if jid:assert json.loads((root/'config.json').read_text())==cfg,'Submitted repair configuration is immutable; use another revision'
  current=OUT/slug/'motions'/slot/f'{idx}.png';source=root/'source.png'
  if not source.exists():shutil.copy2(current,source)
  atomic(root/'config.json',cfg)
  with Image.open(source) as raw:im=raw.convert('RGBA')
  mask=Image.new('RGB',im.size);d=ImageDraw.Draw(mask)
  for rect in cfg['rectangles']:d.rectangle(rect,fill='white')
  mask.save(root/'mask.png')
  preview=Image.new('RGBA',im.size,'#9baea6');preview.alpha_composite(im);mark=Image.new('RGBA',im.size,(255,0,0,0));mark.putalpha(mask.convert('L').point(lambda v:75 if v else 0));preview.alpha_composite(mark);preview.resize((im.width*3,im.height*3),Image.Resampling.NEAREST).save(root/'mask-preview.png')
  if a.submit and not jid:
   assert cfg.get('mask_visually_reviewed') and not c.get('motions_visual_reviewed')
   assert sum(j['status']=='processing' for j in prod.s['jobs'].values())<20
   assert current.read_bytes()==source.read_bytes(),'Current frame changed since repair preparation'
   encode=lambda path:{'type':'base64','base64':base64.b64encode(path.read_bytes()).decode(),'format':'png'}
   input_source=source;input_mask=root/'mask.png'
   if cfg.get('rotate_180'):
    input_source=root/'model-source.png';input_mask=root/'model-mask.png'
    im.transpose(Image.Transpose.ROTATE_180).save(input_source);mask.transpose(Image.Transpose.ROTATE_180).save(input_mask)
   prod.submit(key,slug,'inpaint-image-pro-flash',{'image':encode(input_source),'mask_image':encode(input_mask),'context_image':encode(input_source),'bounding_box':{'x':0,'y':0,'width':im.width,'height':im.height},'description':cfg['description'],'no_background':True,'crop_to_mask':True,'output_method':'Modify current layer','seed':cfg['seed']})
   c['exported']=False;prod.save();return
  if not jid or prod.s['jobs'].get(jid,{}).get('status')!='completed':print(root/'mask-preview.png');return
  dest=root/'result.png'
  if not dest.exists():
   data=request('/mcp/images/'+jid+'/download')
   if data[:2]==b'PK':
    z=zipfile.ZipFile(io.BytesIO(data));names=[n for n in z.namelist() if n.endswith('.png')];assert len(names)==1;data=z.read(names[0])
   if cfg.get('rotate_180'):
    (root/'model-result.png').write_bytes(data)
    with Image.open(io.BytesIO(data)) as raw:raw.transpose(Image.Transpose.ROTATE_180).save(dest)
   else:dest.write_bytes(data)
  with Image.open(dest) as raw:result=raw.convert('RGBA')
  assert result.size==im.size
  assert all(before==after for before,after,m in zip(im.getdata(),result.getdata(),mask.getdata()) if m==(0,0,0)),'Unmasked RGBA changed'
  assert set(result.getchannel('A').getdata())=={0,255}
  verification={'base_job_id':base,'repair_job_id':jid,'frame_index':idx,'unmasked_rgba_preserved':True,'result_sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'new_user_approval':False}
  atomic(root/'verification.json',verification);print('REVIEW',dest)
  if a.apply:
   assert current.read_bytes() in (source.read_bytes(),dest.read_bytes())
   shutil.copy2(dest,current);verification['findings']=a.apply
   atomic(root/'visual-review.json',verification)
   c.setdefault('motion_frame_repairs',{}).setdefault(slot,{})[str(idx)]=verification
   c['motions_visual_reviewed']=False;c['exported']=False
   review=current.parent/'visual-review.json'
   if review.exists():shutil.copy2(review,root/'clip-review-before.json');review.unlink()
   prod.save();print('Applied reviewed region regeneration; whole-clip review still required')

if __name__=='__main__':main()
