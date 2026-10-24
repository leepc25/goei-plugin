"""Reroll one known skeleton pose without touching the other motion frames."""
import argparse,base64,copy,fcntl,hashlib,json,shutil
from field_character_production import OUT,ROOT,Production,atomic

def main():
 p=argparse.ArgumentParser();p.add_argument('slug');p.add_argument('slot');p.add_argument('index',type=int);p.add_argument('revision');p.add_argument('--seed',type=int,required=True);p.add_argument('--submit',action='store_true');p.add_argument('--select',type=int);p.add_argument('--findings');p.add_argument('--reference-index',type=int);p.add_argument('--action');a=p.parse_args()
 with (OUT/'.runner.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  prod=Production();c=prod.s['characters'][a.slug];base=c['motions'][a.slot];basejob=prod.s['jobs'][base]
  assert basejob['status']=='completed' and basejob.get('endpoint')=='animate-with-skeleton-v3'
  assert all(x.get('ready') and x.get('eight_way_visual_reviewed') for x in prod.s['characters'].values())
  root=OUT/'motion-frame-candidates'/a.slug/a.slot/a.revision;key='motion-frame-candidate-'+a.slot+'-'+a.revision;jid=c.get(key)
  ctl=json.loads((OUT/'control.json').read_text());specpath=json.loads((root/'config.json').read_text())['source_spec'] if jid else ctl['custom_motion_specs'][a.slug][a.slot];spec=json.loads((ROOT/specpath).read_text())
  assert spec['character_id']==c['character_id'] and spec.get('skeleton_visually_reviewed')
  request=json.loads((OUT/a.slug/(a.slot+'-request.json')).read_text())
  assert request['keypoints']==spec['request']['keypoints'] and request['direction']==spec['request']['direction']
  assert 0<=a.index<len(request['keypoints'])
  config={'slug':a.slug,'slot':a.slot,'base_job_id':base,'target_frame_index':a.index,'source_spec':specpath,'seed':a.seed,'pose':request['keypoints'][a.index],'new_user_approval':False}
  reference=None
  if a.reference_index is not None:
   assert 0<=a.reference_index<len(request['keypoints']) and a.reference_index!=a.index
   reference=OUT/a.slug/'motions'/a.slot/f'{a.reference_index}.png';assert reference.exists()
   config.update(reference_frame_index=a.reference_index,reference_sha256=hashlib.sha256(reference.read_bytes()).hexdigest())
  if a.action:config['action']=a.action
  if jid:assert json.loads((root/'config.json').read_text())==config,'Candidate revision is immutable'
  atomic(root/'config.json',config)
  if a.submit and not jid:
   assert not c.get('motions_visual_reviewed')
   assert sum(j['status']=='processing' for j in prod.s['jobs'].values())<20
   review=json.loads((OUT/a.slug/'motions'/a.slot/'visual-review.json').read_text());assert review['job_id']==base and review['result']=='reroll-required'
   args=prod.custom_motion_request(a.slug,a.slot,specpath);args['keypoints']=[copy.deepcopy(config['pose']) for _ in range(3)];args['seed']=a.seed
   if reference:
    shutil.copy2(reference,root/'reference.png')
    args['first_frame']={'type':'base64','format':'png','base64':base64.b64encode(reference.read_bytes()).decode()}
    args['first_frame_keypoints']=copy.deepcopy(request['keypoints'][a.reference_index])
   if a.action:args['action']=a.action
   prod.submit(key,a.slug,'animate-with-skeleton-v3',args,archive_output=str((root/'frames').relative_to(OUT)))
   return
  if not jid or prod.s['jobs'].get(jid,{}).get('status')!='completed':print('Candidate not completed; no frame changed');return
  print('REVIEW',root/'frames')
  if a.select is not None:
   assert a.findings and 0<=a.select<3
   chosen=root/'frames'/f'{a.select}.png';assert chosen.exists()
   folder=OUT/a.slug/'motions'/a.slot;current=folder/f'{a.index}.png';backup=root/'frame-before.png'
   assert not backup.exists(),'Use a new candidate revision for another replacement'
   files=sorted(folder.glob('*.png'),key=lambda p:int(p.stem));assert len(files)==len(request['keypoints'])
   assembly=c.get('motion_assemblies',{}).get(a.slot)
   if not assembly or assembly['base_job_id']!=base:
    assembly={'base_job_id':base,'frame_sources':[{'frame_index':i,'source_job_id':base,'source_frame_index':i,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for i,f in enumerate(files)],'method':'select complete same-pose regenerated frames; no pixel editing','new_user_approval':False}
   shutil.copy2(current,backup);shutil.copy2(chosen,current)
   assembly['frame_sources'][a.index]={'frame_index':a.index,'source_job_id':jid,'source_frame_index':a.select,'target_pose_index':a.index,'source_path':str(chosen.relative_to(OUT)),'sha256':hashlib.sha256(chosen.read_bytes()).hexdigest(),'findings':a.findings}
   assembly['visual_reviewed']=False;c.setdefault('motion_assemblies',{})[a.slot]=assembly
   review=folder/'visual-review.json'
   if review.exists():shutil.copy2(review,root/'clip-review-before.json');review.unlink()
   c['motions_visual_reviewed']=False;c['exported']=False;prod.save();atomic(root/'selection.json',assembly['frame_sources'][a.index]);print('Selected candidate; full clip must be visually reviewed again')

if __name__=='__main__':main()
