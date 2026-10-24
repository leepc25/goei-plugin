"""Record explicit full-frame visual findings and gate the next character."""
import argparse,fcntl,json,time,hashlib
from field_character_production import OUT,TEMPLATES,atomic

def main():
 p=argparse.ArgumentParser();p.add_argument('slug');p.add_argument('template',choices=[t for t,_ in TEMPLATES]);p.add_argument('result',choices=['pass','reroll-required']);p.add_argument('findings');a=p.parse_args()
 with (OUT/'.runner.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  s=json.loads((OUT/'state.json').read_text());c=s['characters'][a.slug]
  assert all(x.get('ready') and x.get('eight_way_visual_reviewed') for x in s['characters'].values())
  jid=c['motions'][a.template];job=s['jobs'][jid];assert job['status']=='completed'
  folder=OUT/a.slug/'motions'/a.template;frames=list(folder.glob('*.png'));assert frames
  repairs=c.get('motion_frame_repairs',{}).get(a.template,{})
  repairs={i:r for i,r in repairs.items() if r['base_job_id']==jid}
  for i,r in repairs.items():
   assert s['jobs'][r['repair_job_id']]['status']=='completed'
   assert hashlib.sha256((folder/(i+'.png')).read_bytes()).hexdigest()==r['result_sha256']
  assembly=c.get('motion_assemblies',{}).get(a.template)
  if assembly and assembly['base_job_id']!=jid:assembly=None
  if assembly:
   sources=assembly['frame_sources'];assert sorted(x['frame_index'] for x in sources)==list(range(len(frames)))
   for r in sources:
    source_job=s['jobs'][r['source_job_id']]
    assert source_job['status']=='completed' and source_job['slug']==a.slug
    assert hashlib.sha256((folder/(str(r['frame_index'])+'.png')).read_bytes()).hexdigest()==r['sha256']
  reqpath=OUT/a.slug/(a.template+'-request.json');req=json.loads(reqpath.read_text()) if reqpath.exists() else {}
  atomic(folder/'visual-review.json',{'at':time.time(),'job_id':jid,'result':a.result,'findings':a.findings,'frame_count':len(frames),'directions':req.get('directions') or [req.get('direction')],'actual_template':req.get('template_animation_id','custom-skeleton' if 'keypoints' in req else a.template),'new_user_approval':False,'rules_rechecked':['AVIF identity primary','lore stature supplemental','all55 eight-way barrier','correct face-visible direction','no gray exterior paint in every frame','pose and foot contact consistency']})
  if repairs:
   path=folder/'visual-review.json';record=json.loads(path.read_text());record['frame_repairs']=repairs;atomic(path,record)
  if assembly:
   assembly['visual_reviewed']=a.result=='pass'
   path=folder/'visual-review.json';record=json.loads(path.read_text());record['frame_assembly']=assembly;atomic(path,record)
  passed=[]
  for template,_ in TEMPLATES:
   review=OUT/a.slug/'motions'/template/'visual-review.json'
   if not review.exists():continue
   r=json.loads(review.read_text());current=c['motions'].get(template)
   if r.get('result')=='pass' and r.get('job_id')==current and s['jobs'].get(current,{}).get('status')=='completed':passed.append(template)
  c['motions_visual_reviewed']=len(passed)==len(TEMPLATES)
  c['exported']=False
  atomic(OUT/'state.json',s);print(a.slug,len(passed),'/',len(TEMPLATES),'clips reviewed')

if __name__=='__main__':main()
