"""Apply explicitly reviewed candidates as separate overrides, preserving originals."""
from production_ops import *
import re
CORRECTED=BASE/'resume/corrected'
def apply_grid(name,accepted=None):
 p=PROD/name;meta=json.loads((p/'provenance.json').read_text(encoding='utf-8'));raw=Image.open(p/'result-00.png').convert('RGBA');a=Image.open(p/'input.png').convert('RGBA');mask=Image.open(p/'mask.png').convert('L')
 aa=np.array(a);bb=np.array(raw);mm=np.array(mask)>0;d=np.any(aa!=bb,axis=2)
 # Explicit compositing protects a one-pixel service discrepancy outside custom masks.
 result=Image.composite(raw,a,mask);result.save(p/'masked-result.png');rows=[]
 for source in meta['sources']:
  i=source['frame']
  if accepted is not None and i not in accepted:continue
  src=BASE/source['path'];assert sha(src)==source['sha256'];source_sha=sha(src);im=Image.open(src).convert('RGBA');before=np.array(im);x,y,w,h=source['tile'];box=source['box'];im.paste(result.crop((x,y,x+w,y+h)),box[:2]);out=CORRECTED/source['clip']/f'{i:02}.png';out.parent.mkdir(parents=True,exist_ok=True)
  after=np.array(im);allowed=np.zeros((144,192),bool)
  for x0,y0,x1,y1 in source['regions']:allowed[y0:y1,x0:x1]=True
  outside=np.any(before!=after,axis=2)&~allowed;assert not outside.any()
  im.save(out)
  rows.append({'clip':source['clip'],'frame':i,'source_sha256':source_sha,'output_sha256':sha(out),'outside_allowed_region_changed':int(outside.sum()),'candidate':name,'user_visual_approval':False})
 save(p/'integration.json',{'accepted_frames':rows,'service_outside_mask_changed':int((d&~mm).sum()),'local_mask_composite':True})
def apply_single(name,frame,rect):
 p=PROD/name;src=BASE/f'full/clips/stab1/{frame:02}.png';im=Image.open(src).convert('RGBA');res=Image.open(p/'result-00.png').convert('RGBA');mask=Image.new('L',im.size);ImageDraw.Draw(mask).rectangle((rect[0],rect[1],rect[2]-1,rect[3]-1),fill=255);out=Image.composite(res,im,mask);dest=CORRECTED/f'stab1/{frame:02}.png';dest.parent.mkdir(parents=True,exist_ok=True);out.save(dest)
 save(p/'integration.json',{'accepted_frames':[{'clip':'stab1','frame':frame,'source_sha256':sha(src),'output_sha256':sha(dest),'candidate':name,'user_visual_approval':False}],'local_mask_composite':True})
def ledger():
 rows=[]
 for p in sorted(PROD.iterdir()):
  if not p.is_dir() or not(p/'submission.json').exists():continue
  sub=json.loads((p/'submission.json').read_text(encoding='utf-8'));st='\n'.join(c.get('text','') for c in sub.get('content',[]));m=re.search(r'job_id: ([\da-f-]+)',st)
  if not m:continue
  result=json.loads((p/'result.json').read_text(encoding='utf-8')) if (p/'result.json').exists() else {};rt='\n'.join(c.get('text','') for c in result.get('content',[]));cost=re.search(r'charged: ([\d.]+) generations',rt)
  row={'revision':p.name,'job_id':m[1],'actual_cost':float(cost[1]) if cost else None,'unit':'generations','cost_evidence':'get_image charged' if cost else 'pending receipt','request_sha256':sha(p/'request.json'),'completed':bool(cost),'user_visual_approval':False};rows.append(row)
 log=BASE/'spend.log';text=log.read_text(encoding='utf-8');new=[]
 for r in rows:
  marker='resume_job='+r['job_id']+' actual_cost='+str(r['actual_cost'])
  if marker not in text:new.append(datetime.now(timezone.utc).isoformat()+' '+marker+' unit=generations revision='+r['revision'])
 if new:log.write_text(text+'\n'+'\n'.join(new)+'\n',encoding='utf-8')
 save(PROD/'ledger.json',{'jobs':rows,'actual_total':sum(r['actual_cost'] or 0 for r in rows),'pending_count':sum(r['actual_cost'] is None for r in rows)})
if __name__=='__main__':
 if sys.argv[1]=='ledger':ledger()
 elif sys.argv[1]=='grid':apply_grid(sys.argv[2],[int(x) for x in sys.argv[3:]] or None)
 elif sys.argv[1]=='single':apply_single(sys.argv[2],int(sys.argv[3]),[int(x) for x in sys.argv[4:8]])
