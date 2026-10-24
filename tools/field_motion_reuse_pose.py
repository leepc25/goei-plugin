"""Reuse exact poses, or explicitly reviewed nearby transition poses, without pixel edits."""
import argparse,copy,fcntl,hashlib,json,shutil,time
from field_character_production import OUT,atomic

def main():
 p=argparse.ArgumentParser();p.add_argument('slug');p.add_argument('slot');p.add_argument('source',type=int);p.add_argument('target',type=int);p.add_argument('--source-slot');p.add_argument('--transition-adjustment',help='Explicit reason for a nearby pose change; requires source clip pass');p.add_argument('--findings',required=True);a=p.parse_args()
 with (OUT/'.runner.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  state=json.loads((OUT/'state.json').read_text());c=state['characters'][a.slug];jid=c['motions'][a.slot]
  assert state['jobs'][jid]['status']=='completed'
  source_slot=a.source_slot or a.slot;source_jid=c['motions'][source_slot]
  assert state['jobs'][source_jid]['status']=='completed'
  req=json.loads((OUT/a.slug/(a.slot+'-request.json')).read_text());source_req=json.loads((OUT/a.slug/(source_slot+'-request.json')).read_text())
  assert source_slot!=a.slot or a.source!=a.target
  assert source_req['direction']==req['direction'] and source_req['view']==req['view']
  source_pose=source_req['keypoints'][a.source];target_pose=req['keypoints'][a.target]
  if a.transition_adjustment:
   review=json.loads((OUT/a.slug/'motions'/source_slot/'visual-review.json').read_text())
   assert review['job_id']==source_jid and review['result']=='pass'
   sp={v['label']:v for v in source_pose};tp={v['label']:v for v in target_pose};assert sp.keys()==tp.keys()
   assert max(abs(sp[k][axis]-tp[k][axis]) for k in sp for axis in ['x','y'])<=0.06,'Transition adjustment must remain nearby'
  else:assert source_pose==target_pose,'Only exact repeated poses may reuse pixels without explicit transition review'
  folder=OUT/a.slug/'motions'/a.slot;assembly=c['motion_assemblies'][a.slot];assert assembly['base_job_id']==jid
  source_assembly=c['motion_assemblies'][source_slot];assert source_assembly['base_job_id']==source_jid
  source=source_assembly['frame_sources'][a.source];assert source.get('findings'),'Source requires an explicit candidate selection review'
  data=(OUT/a.slug/'motions'/source_slot/f'{a.source}.png').read_bytes();assert hashlib.sha256(data).hexdigest()==source['sha256']
  sj=state['jobs'][source['source_job_id']];assert sj['status']=='completed' and sj['slug']==a.slug
  backup=OUT/'motion-frame-reuse'/a.slug/a.slot/f'{source_slot}-{a.source}-to-{a.target}'
  assert not backup.exists(),'Reuse operation is immutable'
  backup.mkdir(parents=True);shutil.copy2(folder/f'{a.target}.png',backup/'frame-before.png')
  record=copy.deepcopy(source);record.update(frame_index=a.target,target_pose_index=a.target,reused_from_frame_index=a.source,reused_from_slot=source_slot,findings=a.findings)
  if a.transition_adjustment:record['transition_adjustment']={'reason':a.transition_adjustment,'original_target_keypoints':target_pose,'replacement_requested_keypoints':source_pose}
  atomic(backup/'reuse.json',{'at':time.time(),'base_job_id':jid,'source':source,'result':record,'reason':a.transition_adjustment or 'Exact matching requested skeleton poses; copy whole PNG without editing pixels'})
  (folder/f'{a.target}.png').write_bytes(data);assembly['frame_sources'][a.target]=record;assembly['visual_reviewed']=False
  review=folder/'visual-review.json'
  if review.exists():shutil.copy2(review,backup/'clip-review-before.json');review.unlink()
  c['exported']=False;c['motions_visual_reviewed']=False;atomic(OUT/'state.json',state)
  print('Reviewed whole frame reused; full clip review still required')

if __name__=='__main__':main()
