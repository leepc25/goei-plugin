"""Build provenance/verification evidence, never generate or mutate source images."""
import json,hashlib,subprocess,datetime,io
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parents[2];OUT=ROOT/'resume'
def sha(data):return hashlib.sha256(data).hexdigest()
jobs=[]
for p in sorted(OUT.glob('*-completed.json')):
 m=json.loads(p.read_text(encoding='utf8'))['structuredContent'];jobs.append(dict(clip=p.name.removesuffix('-completed.json'),job_id=m['job_id'],actual_generations=m['charged_generations'],frames=m['frames'],source='native MCP get_image charged_generations'))
for clip,jid in [('idle_shotgun','11826541-47d1-40de-9664-f05f1838bb23'),('run_shotgun','9fe0e770-b992-4299-a4c1-90d6e591828a')]:
 m=json.loads((OUT/('native-'+jid+'.json')).read_text(encoding='utf8'))['result']['structuredContent'];jobs.append(dict(clip=clip,job_id=jid,actual_generations=m['charged_generations'],frames=m['frames'],historical_charge=True,new_charge=0))
edited=[('snap1','generated/3b131a96-b98f-4c4f-b220-146ce3706ceb','generated/e09c29fd-cf1e-4ba5-8d5e-7912990b7d74'),('run_shotgun','recovered/9fe0e770-b992-4299-a4c1-90d6e591828a','generated/b0156046-4b3b-4d0d-b4e7-a21da470eb67')]
extra=OUT/'extra-hand-edits.json'
if extra.exists():edited+=json.loads(extra.read_text(encoding='utf8'))
patches=[]
for clip,old,new in edited:
 fs=sorted((ROOT/new).glob('[0-9][0-9].png'));sheet=Image.new('RGB',(1024,len(fs)*144),(70,80,90));draw=ImageDraw.Draw(sheet)
 per=[]
 for i,f in enumerate(fs):
  a=Image.open(ROOT/old/f.name).convert('RGBA');b=Image.open(f).convert('RGBA');changed=[(x,y) for y in range(144) for x in range(192) if a.getpixel((x,y))!=b.getpixel((x,y))]
  bbox=[min(x for x,y in changed),min(y for x,y in changed),max(x for x,y in changed)+1,max(y for x,y in changed)+1] if changed else None
  per.append(dict(frame=i,changed_pixels=len(changed),bbox=bbox,raw_sha256=sha((ROOT/old/f.name).read_bytes()),edited_sha256=sha(f.read_bytes())))
  box=(30,28,110,90) if clip!='run_shotgun' else (58,50,96,92)
  for k,im in enumerate([a,b]):
   crop=im.crop(box).resize(((box[2]-box[0])*4,(box[3]-box[1])*4),Image.Resampling.NEAREST);sheet.paste(crop,(k*512, i*144),crop)
  draw.text((900,i*144+5),f'{clip} {i}',fill='white')
 # A separate full-height crop row avoids overlap and preserves 4x pixels.
 rowh=(box[3]-box[1])*4+20;sheet=Image.new('RGB',(1024,len(fs)*rowh),(70,80,90));draw=ImageDraw.Draw(sheet)
 for i,f in enumerate(fs):
  for k,folder in enumerate([old,new]):
   im=Image.open(ROOT/folder/f.name).convert('RGBA').crop(box);im=im.resize((im.width*4,im.height*4),Image.Resampling.NEAREST);sheet.paste(im,(k*512,i*rowh+20),im);draw.text((k*512+5,i*rowh+3),('raw' if k==0 else 'edited')+' '+str(i),fill='white')
 sheet.save(OUT/(clip+'-hand-compare-4x.png'));patches.append(dict(clip=clip,frames=per,total_changed_pixels=sum(p['changed_pixels'] for p in per),charge=0))
refs={ref:subprocess.check_output(['git','rev-parse',ref],cwd=REPO,text=True).strip() for ref in ['HEAD','origin/codex/metroidvania-run-system','origin/codex/character-production-resume']}
result=dict(observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),jobs=jobs,completed_new_actual_generations=sum(j['actual_generations'] for j in jobs if not j.get('historical_charge')),historical_recovered_actual_generations=6,free_pixel_edits=patches,base_sha256=sha((ROOT/'base/A.png').read_bytes()),references=refs,user_visual_approval=False)
(OUT/'delivery-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'new_actual_generations':result['completed_new_actual_generations'],'old_recovered_actual_generations':6,'pixel_edit_counts':{p['clip']:p['total_changed_pixels'] for p in patches}}))
