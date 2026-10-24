"""Back up and delete one explicitly rejected animation group; no generation."""
import argparse,fcntl,io,json,shutil,time,zipfile
from field_character_production import OUT,atomic,api
from field_delete_rejected import call

def main():
 p=argparse.ArgumentParser();p.add_argument('slug');p.add_argument('group');p.add_argument('reason');p.add_argument('--template');a=p.parse_args()
 with (OUT/'.runner.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  s=json.loads((OUT/'state.json').read_text());c=s['characters'][a.slug]
  assert all(x.get('ready') and x.get('eight_way_visual_reviewed') for x in s['characters'].values()),'All-roster barrier'
  # Other completed groups can be replaced while unrelated clips still render.
  # Never delete the group belonging to an active job.
  assert not any(j['slug']==a.slug and j['status']=='processing' and
                 (not a.template or a.group in json.dumps(j)) for j in s['jobs'].values())
  if a.template:
   jid=c['motions'].get(a.template);job=s['jobs'].get(jid,{})
   assert job.get('status') in {'completed','failed'}
   if job.get('endpoint')=='animate-with-skeleton-v3':
    assert a.group==jid,'Standalone retries are addressed by exact job ID'
    b=OUT/'history/rebuild-20261024/rejected-motions'/a.slug/jid
    atomic(b/'rejection.json',{'reason':a.reason,'job':job,'at':time.time(),'state_before':c,'standalone':True})
    old=OUT/a.slug/'motions'/a.template
    if old.exists():shutil.copytree(old,b/'frames',dirs_exist_ok=True);shutil.rmtree(old)
    req=OUT/a.slug/(a.template+'-request.json')
    if req.exists():shutil.copy2(req,b/'request.json')
    job['visual_rejection']={'reason':a.reason,'standalone':True};c['motions'].pop(a.template)
    c['motions_visual_reviewed']=False;c['exported']=False;atomic(OUT/'state.json',s)
    print(a.slug,jid,'standalone frames archived; no remote group exists');return
   assert a.group in json.dumps(job),'Selected group does not belong to this motion slot'
  cid=c['character_id'];detail=api('characters/'+cid)
  group=next((x for x in detail.get('animations',[]) if x['animation_group_id']==a.group),None)
  b=OUT/'history/rebuild-20261024/rejected-motions'/a.slug/a.group;b.mkdir(parents=True,exist_ok=True)
  if group:
   atomic(b/'character-before.json',detail)
   data=call('characters/'+cid+'/zip');assert zipfile.ZipFile(io.BytesIO(data)).testzip() is None;(b/'character.zip').write_bytes(data)
   atomic(b/'rejection.json',{'reason':a.reason,'group':group,'at':time.time(),'state_before':c})
   (b/'delete-receipt.json').write_bytes(call('characters/'+cid+'/animations/'+a.group,'DELETE'))
  else:assert (b/'rejection.json').exists(),'Never clear a motion without its backed-up group'
  after=api('characters/'+cid);assert all(x['animation_group_id']!=a.group for x in after.get('animations',[]))
  atomic(b/'verification.json',{'group_absent':True,'character_id':cid})
  if a.template:
   old=OUT/a.slug/'motions'/a.template
   if old.exists():shutil.copytree(old,b/'frames',dirs_exist_ok=True);shutil.rmtree(old)
   job['visual_rejection']={'reason':a.reason,'group':a.group};c['motions'].pop(a.template)
  c['motions_visual_reviewed']=False;c['exported']=False
  atomic(OUT/'state.json',s);print(a.slug,a.group,'removed after backup; no generation submitted')

if __name__=='__main__':main()
