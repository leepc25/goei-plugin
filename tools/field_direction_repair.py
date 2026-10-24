"""Submit/poll explicitly masked direction repairs; never grants visual approval."""
import argparse,base64,fcntl,io,json,time,zipfile
from PIL import Image,ImageDraw
from field_character_production import OUT,ROOT,Production,atomic,request

def main():
 p=argparse.ArgumentParser();p.add_argument('config');p.add_argument('--finalize',help='Explicit findings after viewing every repaired direction');args=p.parse_args()
 cfg=json.load(open(args.config))
 with (OUT/'.runner.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  prod=Production();slug=cfg['slug'];c=prod.s['characters'][slug]
  assert c['character_id']==cfg['character_id'] and not c.get('eight_way_visual_reviewed')
  folder=OUT/'direction-repairs'/slug/cfg['character_id']
  if cfg.get('revision'):folder=folder/cfg['revision']
  folder.mkdir(parents=True,exist_ok=True)
  atomic(folder/'config.json',cfg)
  source_zip=OUT/slug/'character.zip'
  if cfg.get('base_zip'):
   source_zip=ROOT/cfg['base_zip'];meta=json.loads((source_zip.parent/'rejection.json').read_text())
   assert meta['slug']==slug and meta['state_before']['image']==c['image']
  with zipfile.ZipFile(source_zip) as z:
   for direction,rects in cfg['rectangles'].items():
    key='direction-repair-'+direction+('-'+cfg['revision'] if cfg.get('revision') else '')
    source=folder/(direction+'-source.png');maskpath=folder/(direction+'-mask.png')
    if not source.exists():source.write_bytes(z.read('Idle/rotations/'+direction+'.png'))
    im=Image.open(source).convert('RGBA');mask=Image.new('RGB',im.size);draw=ImageDraw.Draw(mask)
    for rect in rects:draw.rectangle(rect,fill='white')
    for rect in cfg.get('exclude_rectangles',{}).get(direction,[]):draw.rectangle(rect,fill='black')
    mask.save(maskpath)
    jid=c.get(key)
    if not jid:
     if sum(j['status']=='processing' for j in prod.s['jobs'].values())>=20:break
     encode=lambda path:{'type':'base64','base64':base64.b64encode(path.read_bytes()).decode(),'format':'png'}
     data={'image':encode(source),'mask_image':encode(maskpath),'description':cfg['description'],'no_background':True,'output_method':'Modify current layer','crop_to_mask':True,'seed':int(time.time())}
     if cfg.get('context_full_frame'):
      data['context_image']=encode(source);data['bounding_box']={'x':0,'y':0,'width':im.width,'height':im.height}
     prod.submit(key,slug,'inpaint-image-pro-flash',data)
     continue
    job=prod.s['jobs'].get(jid,{})
    if job.get('status')!='completed':continue
    dest=folder/(direction+'-result.png')
    if not dest.exists():
     data=request('/mcp/images/'+jid+'/download')
     if data[:2]==b'PK':
      pack=zipfile.ZipFile(io.BytesIO(data));names=[n for n in pack.namelist() if n.endswith('.png')];assert len(names)==1;data=pack.read(names[0])
     dest.write_bytes(data)
    result=Image.open(dest).convert('RGBA');assert result.size==im.size
    assert all(a==b for a,b,m in zip(im.getdata(),result.getdata(),mask.getdata()) if m==(0,0,0))
    assert set(result.getchannel('A').getdata())=={0,255}
    atomic(folder/(direction+'-verification.json'),{'job':jid,'unmasked_rgba_preserved':True,'visual_reviewed':False})
    print('REVIEW',dest)
   if args.finalize:
    for direction in cfg['rectangles']:
     assert (folder/(direction+'-verification.json')).exists()
     jid=c['direction-repair-'+direction+('-'+cfg['revision'] if cfg.get('revision') else '')]
     assert prod.s['jobs'][jid]['status']=='completed'
    with zipfile.ZipFile(folder/'character.zip','w',zipfile.ZIP_DEFLATED) as target:
     for name in z.namelist():
      direction=name.removeprefix('Idle/rotations/').removesuffix('.png')
      data=(folder/(direction+'-result.png')).read_bytes() if direction in cfg['rectangles'] else z.read(name)
      target.writestr(name,data)
    atomic(folder/'rejection.json',{'slug':slug,'state_before':c,'reason':'Original rotation defects repaired locally through PixelLab masked inpainting'})
    atomic(folder/'visual-review.json',{'findings':args.finalize,'directions':list(cfg['rectangles']),'new_user_approval':False,'rules_rechecked':['AVIF primary','lore height supplementary','all55 barrier','gray exterior rejection']})
    manifest=json.loads((OUT/'manifest.json').read_text());a=next(a for a in manifest if a['slug']==slug)
    a['registration_import_zip']=str((folder/'character.zip').relative_to(OUT.parents[3]))
    a['registration_import_review']=args.finalize;a['registration_regenerate_directions']=[]
    atomic(OUT/'manifest.json',manifest)
    print('Reviewed import prepared; remove failed registration with field_registration_retry.py before rescheduling.')

if __name__=='__main__':main()
