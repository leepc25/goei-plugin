"""Back up and remove one verified failed registration, retaining its source."""
import argparse,fcntl,io,json,shutil,time,urllib.error,zipfile
from field_character_production import OUT,atomic
from field_delete_rejected import call

def main():
 p=argparse.ArgumentParser();p.add_argument('slug');p.add_argument('reason');a=p.parse_args()
 with (OUT/'.runner.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  s=json.loads((OUT/'state.json').read_text());c=s['characters'][a.slug]
  assert c.get('image_visually_reviewed') and not c.get('motions')
  assert s['jobs'][c['registration']]['status'] in {'completed','failed'}
  cid=c['character_id'];assert cid
  b=OUT/'history/rebuild-20261024/deleted-library'/cid;b.mkdir(parents=True,exist_ok=True)
  gone=False
  try:detail=call('characters/'+cid)
  except urllib.error.HTTPError as e:
   if e.code!=404:raise
   assert (b/'character.json').exists() and (b/'character.zip').exists() and (b/'rejection.json').exists()
   gone=True
  if not gone:
   (b/'character.json').write_bytes(detail)
   data=call('characters/'+cid+'/zip');assert zipfile.ZipFile(io.BytesIO(data)).testzip() is None
   (b/'character.zip').write_bytes(data)
   atomic(b/'rejection.json',{'at':time.time(),'slug':a.slug,'reason':a.reason,'state_before':c})
   for filename in ['registration-request.json','registration-queue.json','eight-way-visual-review.json']:
    src=OUT/a.slug/filename
    if src.exists():shutil.copy2(src,b/filename)
   try:(b/'delete-receipt.json').write_bytes(call('characters/'+cid,'DELETE'))
   except Exception as e:atomic(b/'delete-uncertain.json',{'error':str(e)})
   try:call('characters/'+cid)
   except urllib.error.HTTPError as e:
    if e.code!=404:raise
   else:raise RuntimeError('Deletion not confirmed; state retained')
  atomic(b/'verification.json',{'id':cid,'get_status':404})
  c.setdefault('registration_rejections',[]).append({'character_id':cid,'job':c['registration'],'reason':a.reason,'at':time.time()})
  c.update(character_id=None,registration=None,ready=False,exported=False,eight_way_visual_reviewed=False)
  for k in ['skeleton_problem','skeleton_joints','rotation_count','readiness_error']:c.pop(k,None)
  for filename in ['character.zip','character-verification.json','export-metadata.json','registration-request.json','registration-queue.json','eight-way-visual-review.json','review.html']:
   path=OUT/a.slug/filename
   if path.exists():path.unlink()
  atomic(OUT/'state.json',s)
  print(a.slug,'failed registration removed, source retained',cid)

if __name__=='__main__':main()
