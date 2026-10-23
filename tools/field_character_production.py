#!/usr/bin/env python3
"""Resumable PixelLab production. Authorized scope: manifest roster, 20 classified-direction clips each.
Never blindly repeat ambiguous paid submissions. Confirmed failures are archived and
retried with a reviewed correction through field_visual_decision.py.
Run with PIXELLAB_API_KEY; secrets and image payloads are never written to logs.
"""
import argparse,shutil,base64,concurrent.futures,fcntl,io,json,os,re,subprocess,time,urllib.request,urllib.error,zipfile
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game-src/art/field/production'
STATE=OUT/'state.json'
API='https://api.pixellab.ai'
TEMPLATES=[('breathing-idle','숨쉬기 대기'),('walking-8-frames','걷기'),('running-8-frames','달리기'),('running-jump','뛰다 점프'),('running-slide','뛰다 미끄러지기'),('crouched-walking','웅크려 걷기'),('sad-walk','풀죽어 걷기'),('front-flip','앞 공중제비'),('backflip','뒤 공중제비'),('jumping-1','점프 1'),('jumping-2','점프 2'),('two-footed-jump','두발 점프'),('drinking','마시기'),('picking-up','물건 줍기'),('pushing','밀기'),('pull-heavy-object','무거운 것 끌기'),('throw-object','던지기'),('fight-stance-idle-8-frames','전투 대기'),('lead-jab','잽'),('cross-punch','스트레이트')]
def atomic(path,data):
 path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');tmp.replace(path)
def request(path,data=None):
 req=urllib.request.Request(API+path,data=None if data is None else json.dumps(data).encode(),headers={'Authorization':'Bearer '+os.environ['PIXELLAB_API_KEY'],'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=70)as r:return r.read()
def api(path,data=None):return json.loads(request('/v2/'+path,data))
def public(value):
 if isinstance(value,dict):return{k:('[image payload omitted]'if k=='base64'else public(v))for k,v in value.items()}
 if isinstance(value,list):return[public(x)for x in value]
 return value
class Production:
 def __init__(self):
  self.manifest=json.loads((OUT/'manifest.json').read_text());self.by={a['slug']:a for a in self.manifest};self.s=json.loads(STATE.read_text())if STATE.exists()else{'version':1,'created_at':time.time(),'jobs':{},'characters':{},'events':[]}
  for a in self.manifest:self.s['characters'].setdefault(a['slug'],{'name':a['name'],'group':a['group'],'character_id':a.get('character_id'),'image':None,'registration':None,'motions':{},'ready':bool(a.get('character_id'))})
  self.save()
 def event(self,kind,slug,detail):
  row={'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'kind':kind,'slug':slug,'detail':detail};self.s['events'].append(row);print(json.dumps(row,ensure_ascii=False),flush=True)
 def save(self):
  self.s['updated_at']=time.time();atomic(STATE,self.s)
 def import_existing(self,path):
  path=Path(path);c=self.s['characters']['jyaldi']
  for template,filename in [('breathing-idle','template-idle-queue.json'),('running-8-frames','template-running-queue.json')]:
   if template in c['motions']:continue
   r=json.loads((path/filename).read_text());txt='\n'.join(x['text']for x in r['result']['content']if x['type']=='text');jid=re.search(r'job_ids: south-east=([a-f0-9-]+)',txt)[1];group=re.search(r'group: ([a-f0-9-]+)',txt)[1]
   self.s['jobs'][jid]={'kind':'animation','slug':'jyaldi','template':template,'status':'processing','created_epoch':time.time(),'receipt':txt,'animation_group_id':group};c['motions'][template]=jid
  for f in(path/'batch20').glob('*.json'):
   r=json.loads(f.read_text())
   if not r.get('job_ids'):continue
   template=r['request']['template_animation_id'];jid=r['job_ids'][0]
   if template in c['motions']:continue
   self.s['jobs'][jid]={'kind':'animation','slug':'jyaldi','template':template,'status':'processing','created_epoch':time.time(),'receipt':r['receipt']};c['motions'][template]=jid
  for a in self.manifest:
   f=OUT/a['slug']/'image-queue.json';c=self.s['characters'][a['slug']]
   if f.exists()and not c['image']:
    d=json.loads(f.read_text());jid=d['background_job_id'];self.s['jobs'][jid]={'kind':'image','slug':a['slug'],'status':'processing','created_epoch':time.time(),'receipt':d};c['image']=jid
  self.save()
 def submit(self,kind,slug,path,args,template=None):
  if json.loads((OUT/'control.json').read_text()).get('stop_all')or time.time()<self.s.get('retry_after',0):return False
  c=self.s['characters'][slug];key=template if kind=='animation'else kind;slot=c['motions']if kind=='animation'else c
  if slot.get(key):return False
  # An uncertain POST is deliberately never retried: it may already be billed.
  marker='submitting:'+str(int(time.time()*1000));slot[key]=marker;self.save()
  safe=public(args);atomic(OUT/slug/((template or kind)+'-request.json'),safe)
  started=time.time()
  try:d=api(path,args)
  except urllib.error.HTTPError as e:
   detail=e.read().decode()[:3500]
   if e.code in [401,429]:
    slot[key]=None;self.s['retry_after']=time.time()+65;self.event('capacity',slug,detail);self.save();return False
   slot[key]='failed:'+str(e.code);self.event('submission-failed',slug,{'kind':kind,'template':template,'code':e.code,'detail':detail});self.save();return False
  except Exception as e:
   slot[key]='uncertain:'+marker;self.event('submission-uncertain',slug,{'kind':kind,'template':template,'error':str(e),'action':'skip without duplicate POST'});self.save();return False
  jid=d.get('background_job_id')or next(iter(d.get('background_job_ids',[])),None)
  if not jid:
   slot[key]='uncertain:'+marker;self.event('submission-unknown-response',slug,public(d));self.save();return False
  job={'kind':kind,'slug':slug,'template':template,'status':'processing','created_epoch':started,'receipt':d};self.s['jobs'][jid]=job;slot[key]=jid
  if kind=='registration':c['character_id']=d['character_id']
  if kind=='animation':c['exported']=False
  atomic(OUT/slug/((template or kind)+'-queue.json'),d);self.event('submitted',slug,{'kind':kind,'template':template,'job_id':jid,'receipt':d});self.save();return True
 def poll(self):
  active=[(jid,j)for jid,j in self.s['jobs'].items()if j['status']=='processing']
  def one(pair):
   jid,j=pair
   try:return jid,api('background-jobs/'+jid),None
   except Exception as e:return jid,None,str(e)
  with concurrent.futures.ThreadPoolExecutor(max_workers=8)as pool:
   for jid,d,err in pool.map(one,active):
    j=self.s['jobs'][jid]
    if err:j['poll_error']=err;continue
    j.pop('poll_error',None);j['last_response']=public(d);status=d.get('status');last=d.get('last_response')or{}
    if status in ['completed','failed']:
     j['status']=status;j['observed_end_epoch']=time.time();j['elapsed_observed_seconds']=time.time()-j['created_epoch'];j['usage']=last.get('billing_usage')or d.get('usage');self.save_frames(j,last);self.event(status,j['slug'],{'kind':j['kind'],'template':j.get('template'),'job_id':jid,'usage':j['usage'],'detail':public(last)if status=='failed'else None})
    elif last.get('status')=='stalled':
     j['status']='stalled';self.event('stalled',j['slug'],{'job_id':jid,'action':'skip, do not resubmit'})
  self.save()
 def save_frames(self,j,last):
  if j['kind']!='animation' or j['status']!='completed':return
  frames=last.get('images')or[]
  folder=(OUT/j['archive_output'] if j.get('archive_output') else OUT/j['slug']/'motions'/j['template']);folder.mkdir(parents=True,exist_ok=True)
  sizes=[]
  for i,frame in enumerate(frames):
   if frame.get('base64'):
    data=base64.b64decode(frame['base64'].split(',')[-1]);im=Image.open(io.BytesIO(data));im.load();(folder/(str(i)+'.png')).write_bytes(data);sizes.append(list(im.size))
  j['saved_frames']=len(sizes)
  atomic(folder/'receipt.json',{'job_status':j['status'],'frame_count':len(sizes),'sizes':sizes,'usage':j.get('usage'),'elapsed_observed_seconds':j.get('elapsed_observed_seconds'),'visual_approval':False})
 def validate_image(self,slug):
  c=self.s['characters'][slug];jid=c.get('image');j=self.s['jobs'].get(jid,{})
  if j.get('status')!='completed'or c.get('image_verified')or c.get('image_invalid'):return
  try:
   cached=OUT/slug/('.download-'+jid)
   data=cached.read_bytes() if cached.exists() else request('/mcp/images/'+jid+'/download')
   if data[:2]==b'PK':
    z=zipfile.ZipFile(io.BytesIO(data));pngs=[n for n in z.namelist()if n.endswith('.png')];assert len(pngs)==1;data=z.read(pngs[0])
   im=Image.open(io.BytesIO(data)).convert('RGBA');im.load();native_size=im.size
   if self.by[slug].get('native_height_canvas'):
    expected=self.by[slug]['pixel_request']['image_size'];assert im.size==(expected['width'],expected['height']),'wrong native canvas'
    (OUT/slug/'native-generation.png').write_bytes(data)
    assert im.width==128 and im.height<=256
    padded=Image.new('RGBA',(128,256));padded.paste(im,(0,256-im.height));im=padded
    buf=io.BytesIO();im.save(buf,format='PNG');data=buf.getvalue()
   bbox=im.getbbox();colors=len({px for px in im.getdata()if px[3]});alpha=sorted(set(im.getchannel('A').getdata()));checks={'size':list(im.size),'native_size':list(native_size),'bbox':list(bbox)if bbox else None,'colors':colors,'alpha':alpha,'original_pixels_preserved':True,'resampled':False}
   a=self.by[slug]
   if a.get('image_inpaint_source'):
    source=Image.open(ROOT/a['image_inpaint_source']).convert('RGBA');mask=Image.open(ROOT/a['image_inpaint_mask']).convert('RGB')
    assert source.size==mask.size==im.size,'inpaint canvas changed'
    assert all(before==after for before,after,mark in zip(source.getdata(),im.getdata(),mask.getdata())if mark==(0,0,0)),'inpaint modified unmasked RGBA'
    checks['unmasked_rgba_preserved']=True
   (OUT/slug/'reference.png').write_bytes(data);atomic(OUT/slug/'image-verification.json',checks)
   palette_limit=a.get('image_validation_palette_limit',48);checks['palette_limit']=palette_limit
   atomic(OUT/slug/'image-verification.json',checks)
   assert im.size==(128,256),'wrong canvas';assert bbox and bbox[3]-bbox[1]>=180,'figure too small';assert colors<=palette_limit,'palette cap exceeded';assert alpha==[0,255],'unexpected alpha'
   c['image_verified']=True;self.event('image-format-verified',slug,checks)
   if cached.exists():cached.unlink()
  except urllib.error.HTTPError as e:
   c['download_error']=str(e) # transient delivery is read-only and can be checked again
  except Exception as e:
   c['image_invalid']=str(e);self.event('image-quarantined',slug,str(e))
  self.save()
 def check_ready(self,slug):
  c=self.s['characters'][slug];jid=c.get('registration');j=self.s['jobs'].get(jid,{})
  if c.get('ready')or not c.get('character_id')or j.get('status')!='completed':return
  try:
   d=api('characters/'+c['character_id']);skeleton=(d.get('skeletons')or{}).get('3d',{}).get('keypoints',{});rot=d.get('rotation_urls')or{}
   if d.get('status')=='completed'and len(skeleton)==18 and len(rot)==8:
    c['ready']=True;c['skeleton_joints']=18;c['rotation_count']=8;atomic(OUT/slug/'character-verification.json',{'character_id':c['character_id'],'status':d['status'],'3d_joints':18,'rotation_count':8,'size':d.get('size'),'view':d.get('view'),'skeletons':d['skeletons']});self.event('character-ready',slug,{'3d_joints':18,'directions':8})
   elif time.time()-j.get('observed_end_epoch',time.time())>900:c['skeleton_problem']=True;self.event('skeleton-not-ready',slug,{'status':d.get('status'),'joints':len(skeleton),'directions':len(rot)})
  except Exception as e:c['readiness_error']=str(e)
  self.save()
 def image_request(self,a):
  if a.get('image_inpaint_source'):
   encoded=lambda path:{'type':'base64','base64':base64.b64encode((ROOT/path).read_bytes()).decode(),'format':'png'}
   return {'image':encoded(a['image_inpaint_source']),'mask_image':encoded(a['image_inpaint_mask']),'description':a['image_inpaint_description'],'no_background':True,'output_method':'Modify current layer','crop_to_mask':True,'seed':a['pixel_request'].get('seed',0)}
  if a.get('image_edit_source'):
   return {'image':{'type':'base64','base64':base64.b64encode((ROOT/a['image_edit_source']).read_bytes()).decode(),'format':'png'},'method':'text','description':a['image_edit_description'],'no_background':True,'use_color_palette_correction':True,'seed':a['pixel_request'].get('seed',0)}
  args=dict(a['pixel_request']);usage=args.pop('style_usage_description',None);source=args.pop('style_reference_local',None)
  if source:
   path=ROOT/source;im=Image.open(path);args['style_image']={'image':{'type':'base64','base64':base64.b64encode(path.read_bytes()).decode(),'format':'png'},'size':{'width':im.width,'height':im.height},'usage_description':usage}
  return args
 def registration_request(self,a):
  return{'description':a['name']+' / '+a['english']+'. '+a['appearance']+' Preserve supplied native height, scale, blank margins, identity, anatomy, iris color and clothing across every direction. Empty hands, relaxed upright stance, no weapons or shadow. Transparent outside silhouette; no opaque gray halo or painted gray exterior patches.','reference_image':{'type':'base64','base64':base64.b64encode((OUT/a['slug']/'reference.png').read_bytes()).decode(),'format':'png'},'n_directions':8,'view':'low top-down','template_id':'mannequin','name':a['name'],'seed':10222027,'no_background':True}
 @staticmethod
 def motion_direction(template):
  return 'south-east'if template in {'breathing-idle','drinking'}else'east'
 def animation_request(self,a,template,label):
  policy=json.loads((OUT/'control.json').read_text()).get('character_direction_overrides',{}).get(a['slug'],{})
  direction=policy.get('stationary_noncombat' if template in {'breathing-idle','drinking'} else 'movement_and_combat',self.motion_direction(template))
  args={'character_id':self.s['characters'][a['slug']]['character_id'],'mode':'skeleton-v3','template_animation_id':template,'directions':[direction],'animation_name':label+' ('+{'east':'동쪽','south-east':'남동','west':'서쪽','south-west':'남서'}[direction]+')'}
  if template=='walking-8-frames':
   if any(x in a['appearance']for x in ['broad','muscular','heavy']):gait='walking with grounded measured strides, a stable heavy torso and restrained arm swing'
   elif any(x in a['appearance']for x in ['nervous','shy','worried','weary','exhausted']):gait='walking carefully with short measured steps, slightly restrained shoulders and a gentle arm swing'
   elif any(x in a['appearance']for x in ['friendly','cheerful','playful','lively']):gait='walking with light confident even steps and a relaxed natural arm swing'
   else:gait='walking confidently with an upright steady torso, measured strides and restrained arm swing'
   args['action_description']=gait
  elif template=='running-8-frames':args['action_description']='running decisively with a steady torso, controlled arm swing and firm purposeful strides'
  args['action_description']=args.get('action_description',template.replace('-',' '))+'. Preserve this character identity, costume, hair and native proportions. Keep a clean transparent silhouette in every frame. No gray painted patches, gray halo, ground shadow or opaque background around hair, hands, clothes or feet.'
  return args
 def apply_repairs(self):
  path=OUT/'repair-queue.json'
  if not path.exists():return
  for repair in json.loads(path.read_text()):
   if repair['id']in self.s.get('applied_repairs',[]):continue
   slug=repair['slug'];c=self.s['characters'][slug]
   # An accepted job must finish and be accounted for before replacing its slot.
   if any(j['slug']==slug and j['status']=='processing'for j in self.s['jobs'].values()):continue
   if any(str(v).startswith(('submitting:','uncertain:'))for v in [c.get('image'),c.get('registration'),*c['motions'].values()]):continue
   if repair.get('action')!='regenerate-front-and-register':continue
   history=OUT/'history'/repair['id'];history.mkdir(parents=True,exist_ok=True)
   atomic(history/'previous-character-state.json',c)
   atomic(history/'repair-reason.json',repair)
   folder=OUT/slug
   for file in folder.iterdir():
    if file.is_file():shutil.copy2(file,history/file.name)
   for file in folder.iterdir():
    if file.is_file():file.unlink()
   self.s['characters'][slug]={'name':c['name'],'group':c['group'],'character_id':None,'image':None,'registration':None,'motions':{},'ready':False,'repair_id':repair['id'],'visual_review_required':True}
   self.s.setdefault('applied_repairs',[]).append(repair['id'])
   self.event('repair-started',slug,repair);self.save()
 def schedule(self):
  if json.loads((OUT/'control.json').read_text()).get('stop_all'):return
  if time.time()<self.s.get('retry_after',0):return
  self.manifest=json.loads((OUT/'manifest.json').read_text());self.by={a['slug']:a for a in self.manifest}
  self.apply_repairs()
  # Independent read-only downloads run concurrently; state decisions remain serial.
  pending=[(a['slug'],self.s['characters'][a['slug']].get('image')) for a in self.manifest
           if not self.s['characters'][a['slug']].get('image_verified')
           and not self.s['characters'][a['slug']].get('image_invalid')]
  def download_one(pair):
   slug,jid=pair
   if self.s['jobs'].get(jid,{}).get('status')!='completed':return
   path=OUT/slug/('.download-'+jid)
   if path.exists():return
   try:path.write_bytes(request('/mcp/images/'+jid+'/download'))
   except Exception:return # validate_image records/retries delivery errors serially
  with concurrent.futures.ThreadPoolExecutor(max_workers=8)as pool:list(pool.map(download_one,pending))
  for a in self.manifest:
   slug=a['slug'];self.validate_image(slug);self.check_ready(slug)
  # Keep room for both production streams; 20 global in-flight requests at most.
  active=lambda:[j for j in self.s['jobs'].values()if j['status']=='processing']
  for a in self.manifest:
   if len(active())>=20:return
   c=self.s['characters'][a['slug']]
   if c.get('image_verified')and not c.get('registration')and a['slug']in json.loads((OUT/'control.json').read_text()).get('registration_approved_slugs',[x['slug']for x in self.manifest])and a['slug']not in json.loads((OUT/'control.json').read_text()).get('registration_held_slugs',[]):
    self.submit('registration',a['slug'],'create-character-v3',self.registration_request(a))
  for a in self.manifest:
   if len(active())>=20:return
   c=self.s['characters'][a['slug']]
   if a.get('pixel_request')and not c.get('image')and a['slug']in json.loads((OUT/'control.json').read_text()).get('image_approved_slugs',[x['slug']for x in self.manifest])and sum(j['kind']in['image','registration']for j in active())<json.loads((OUT/'control.json').read_text()).get('max_character_pipeline_in_flight',6):
    route='inpaint-image-pro-flash' if a.get('image_inpaint_source') else 'edit-image-pro-flash' if a.get('image_edit_source') else 'create-image-pro-flash'
    self.submit('image',a['slug'],route,self.image_request(a))
  # A visual gate prevents spreading a broken animation route to the whole roster.
  control=json.loads((OUT/'control.json').read_text())
  if not control.get('release_skeleton_v3_motions'):return
  # User requires every roster member's eight directions before the first new motion.
  if not all(self.s['characters'][a['slug']].get('ready') and
             self.s['characters'][a['slug']].get('eight_way_visual_reviewed')
             for a in self.manifest):return
  # Fill motion slots in roster/faction order without waiting for previous clip completion.
  for a in self.manifest:
   c=self.s['characters'][a['slug']]
   if not c.get('ready')or a['slug']not in control.get('motion_allowed_slugs',[]):continue
   for template,label in TEMPLATES:
    if len(active())>=20:return
    if not c['motions'].get(template):self.submit('animation',a['slug'],'animate-character',self.animation_request(a,template,label),template)
   # Finish and visually review this person before moving to the next one.
   if not c.get('motions_visual_reviewed'):return
 def overview(self):
  jobs=list(self.s['jobs'].values());counts={k:sum(j['status']==k for j in jobs)for k in ['processing','completed','failed','stalled']};chars=list(self.s['characters'].values());self.s['summary']={'jobs':counts,'characters_ready':sum(bool(c.get('ready'))for c in chars),'characters_total':len(self.manifest),'images_format_verified':sum(bool(c.get('image_verified'))for c in chars),'new_images_visually_reviewed':sum(bool(c.get('image_visually_reviewed'))for c in chars),'eight_way_visually_reviewed':sum(bool(c.get('eight_way_visual_reviewed'))for c in chars),'characters_motions_visually_reviewed':sum(bool(c.get('motions_visual_reviewed'))for c in chars),'motions_submitted':sum(len(c['motions'])for c in chars),'motions_target':len(self.manifest)*len(TEMPLATES)};self.save();print(json.dumps(self.s['summary'],ensure_ascii=False),flush=True)
 def done(self):
  if any(j['status']=='processing'for j in self.s['jobs'].values()):return False
  for a in self.manifest:
   c=self.s['characters'][a['slug']]
   if not all(c.get(k)for k in ['ready','eight_way_visual_reviewed','motions_visual_reviewed','exported']):return False
   if any(self.s['jobs'].get(c['motions'].get(t),{}).get('status')!='completed'for t,_ in TEMPLATES):return False
  return True
 def export_ready(self):
  for a in self.manifest:
   slug=a['slug'];c=self.s['characters'][slug]
   if c.get('exported')or not c.get('character_id')or not c.get('ready'):continue
   if any(self.s['jobs'].get(j,{}).get('status')=='processing'for j in c['motions'].values()):continue
   try:
    data=request('/v2/characters/'+c['character_id']+'/zip');(OUT/slug/'character.zip').write_bytes(data)
    z=zipfile.ZipFile(io.BytesIO(data));meta=json.loads(z.read('metadata.json'));atomic(OUT/slug/'export-metadata.json',meta);c['exported']=True;self.event('exported',slug,{'bytes':len(data),'files':len(z.namelist())})
   except Exception as e:c['export_error']=str(e)
  self.save()
 def checkpoint(self):
  # Stage only this production tree. Never touch unrelated work or merge main.
  if time.time()-self.s.get('last_git_checkpoint',0)<300:return
  try:
   subprocess.run(['git','add','--','game-src/art/field/production','tools/field_character_production.py'],cwd=ROOT,check=True,capture_output=True)
   changed=subprocess.run(['git','diff','--cached','--quiet','--','game-src/art/field/production','tools/field_character_production.py'],cwd=ROOT).returncode
   if changed:
    subprocess.run(['git','commit','-m','art: checkpoint field character production','--','game-src/art/field/production','tools/field_character_production.py'],cwd=ROOT,check=True,capture_output=True)
    subprocess.run(['git','push','origin','HEAD'],cwd=ROOT,check=True,capture_output=True,timeout=120)
   self.s['last_git_checkpoint']=time.time()
  except Exception as e:self.event('checkpoint-error','all',str(e))
  self.save()
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--import-existing');parser.add_argument('--once',action='store_true');parser.add_argument('--preflight',action='store_true');args=parser.parse_args()
 OUT.mkdir(parents=True,exist_ok=True);lock=(OUT/'.runner.lock').open('w')
 try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:raise SystemExit('Another production runner owns the lock')
 p=Production()
 if args.import_existing:p.import_existing(args.import_existing)
 if args.preflight:
  assert len(p.manifest)==55 and len(TEMPLATES)==20
  for a in p.manifest:
   assert(ROOT/a['original_art']).exists()
   if a.get('pixel_request'):assert len(p.image_request(a)['description'])<=2000
  print('Preflight passed; no paid calls.');return
 while True:
  try:
   p.poll();p.schedule();p.export_ready();p.overview();p.checkpoint()
   if p.done():p.event('all-production-visually-reviewed','all',p.s['summary']);p.save();break
  except Exception as e:
   p.event('runner-cycle-error','all',str(e));p.save()
  if args.once:break
  time.sleep(30)
if __name__=='__main__':main()
