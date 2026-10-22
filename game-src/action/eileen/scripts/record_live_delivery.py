"""Build an auditable Eileen-only ledger from stored MCP responses, not balance deltas."""
from pathlib import Path
from PIL import Image
import json,re,hashlib,datetime
ROOT=Path(__file__).resolve().parents[4]
ART=ROOT/'game-src/action/eileen';OUT=ART/'resume/live-20261022'
now=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).isoformat(timespec='seconds')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def text(d):return '\n'.join(c.get('text','') for c in d.get('content',[]) if c.get('type')=='text')
notes={
 'precise-edit':'Face/stock separation improves but head top y47 -> y39 and body pose drifts. Full AI redraw rejected; exact pixel edits selected instead.',
 'transition-bridge':'Frames02-04 duplicate front/back rifle; front rifle disappears. Endpoint interpolation does not preserve prop identity.',
 'transition-rig':'Arm path improved but rifle becomes thin/deformed at02-04. Frame07 returns weapon to front. Face remains partly front-facing. Rejected.',
 'transition-pro':'Upper crop body position changes. Frames00-03 leave gaps at knee boundary; frame03 rotates rifle horizontally instead of preserving path. Rejected.',
 'transition-mask':'Full-body position retained but rifle still indistinct at02-03 and inconsistent at04-05. One unmasked opaque pixel at sheet22,192 became transparent. Rejected.'}
jobs=[];reviews=[]
for folder in notes:
 d=OUT/folder;req=json.loads((d/'request.json').read_text(encoding='utf-8'));submission=json.loads((d/'submission.json').read_text(encoding='utf-8'));result=json.loads((d/'result.json').read_text(encoding='utf-8'));s=text(submission);t=text(result)
 job=re.search(r'job_id: ([0-9a-f-]+)',s).group(1);cost=float(re.search(r'charged: ([0-9.]+) generation',t).group(1))
 outputs=[d/'result.png'] if folder=='precise-edit' else sorted(d.glob('crop-[0-9][0-9].png')) if folder=='transition-pro' else sorted(d.glob('[0-9][0-9].png'))
 jobs.append(dict(owner='eileen',folder=folder,job_id=job,tool=req['tool'],estimated_generations=req['estimated_generations'],actual_cost=cost,cost_unit='generations',cost_source=f'{folder}/result.json charged response',request_sha256=sha(d/'request.json'),inputs=req.get('inputs') or [{'path':req.get('source',req.get('input_path')),'sha256':req['input_sha256']}],recovered=True,output_count=len(outputs),state='recovered_rejected',reason=notes[folder],visual_approval='not_requested_for_rejected_candidate',outputs=[{'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p)} for p in outputs]))
 for i,p in enumerate(outputs):
  im=Image.open(p).convert('RGBA')
  reviews.append(dict(candidate=folder,frame=i,face='profile consistency fails or not proven',body='pose/placement drift' if folder in ['precise-edit','transition-pro'] else 'stance broadly retained',clothing='black suit and olive vest retained; pixel mass not approved',hands='rifle contact not approved',grounding='original legs outside crop unchanged but crop seam broken' if folder=='transition-pro' else 'frame bounds inspected; not enough to prove contact',loop_boundary='one-shot; transition-rig07 returns to starting weapon state' if folder!='precise-edit' else 'single frame differs from neighboring poses',issues=notes[folder],bbox=im.getbbox(),size=im.size,sha256=sha(p),decision='reject'))
ledger={'observed_at':now,'branch':'codex/art-eileen-resume','paid_jobs':jobs,'paid_submit_count':4,'actual_new_cost':sum(j['actual_cost'] for j in jobs),'cost_unit':'generations','balance_delta_used_for_cost':False,'free_exact_edits':[{'image_id':'f5621540-ebeb-43e3-871d-2dfdbceffe15','frame':'precise01','changed_pixels':19,'actual_cost':0},{'image_id':'4e74f296-d7bf-453b-a90e-bf8858ec1c7c','frame':'precise02','changed_pixels':18,'actual_cost':0}],'max_owner_inflight':1,'kyuras_recovery_owner':'01a1632e-358b-7931-b8ab-c3487b5b6095','historical_cost_note':'Earlier reported332 is historical, not revalidated billing; historical job IDs remain in ../job-ledger.json.'}
ledger['paid_submit_count']=len(jobs)
for j in jobs:
 if j['folder']=='transition-rig':
  j['state']='recovered_partial_used_after_exact_repair'
  j['used_source_frames']=[0,1,2,3,4,5]
  j['reason']='Raw rifle02-05 rejected then repaired by free exact edits; 00/01 retained, 06/07 omitted. Profile/suffix boundary still needs review.'
  j['visual_approval']='pending'
 if j['folder']=='transition-mask':j['service_output_count']=1;j['output_count_note']='four extracted review cells; result.png preserves the original single sheet'
ledger['free_exact_edits'] += [{'image_id':'7ea4bb62-8747-43f3-8356-772426b3f358','frames':'transition02-05','changed_pixels':543,'actual_cost':0,'state':'superseded_v1'},{'image_id':'8acaabc7-e9a8-463b-8fd9-49e22aa019ea','frames':'transition02-05','changed_pixels':541,'actual_cost':0,'state':'applied_partial_correction_visual_approval_pending'}]
ledger['remaining_issues']=['strict face profile','rifle occlusion around frame03','body and equipment silhouette change at new05 to existing suffix06']
(OUT/'ledger.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'candidate-frame-review.json').write_text(json.dumps(reviews,ensure_ascii=False,indent=2),encoding='utf-8')
spend=ART/'spend.log';existing=spend.read_text(encoding='utf-8');marker='local-resume-20261022 verified-charge'
if marker not in existing:
 with spend.open('a',encoding='utf-8') as f:
  for j in jobs:f.write(f"\n{now} {marker} tool={j['tool']} job_id={j['job_id']} actual_cost={j['actual_cost']:g} generations state=recovered_rejected evidence=resume/live-20261022/{j['folder']}/result.json")
  f.write(f'\n{now} local-resume-20261022 total_actual=18 generations; free_exact_edits=2; applied_precision_frames=2; support_placement_frames=10; washing_regeneration=0; user_visual_approval=pending\n')
for j in jobs:
 if j['job_id'] not in existing:
  with spend.open('a',encoding='utf-8') as f:
   f.write(f"\n{now} {marker} tool={j['tool']} job_id={j['job_id']} actual_cost={j['actual_cost']:g} generations state=recovered_rejected evidence=resume/live-20261022/{j['folder']}/result.json\n")
  existing+=j['job_id']
total_marker=f"local-resume-20261022 cumulative_actual={ledger['actual_new_cost']:g} generations"
if total_marker not in existing:
 with spend.open('a',encoding='utf-8') as f:f.write(f'{now} {total_marker}; paid_jobs={len(jobs)}; visual_approval=pending\n')
files=[]
transition_marker='eileen-transition-exact-v2 applied'
if transition_marker not in spend.read_text(encoding='utf-8'):
 with spend.open('a',encoding='utf-8') as f:f.write(f'{now} {transition_marker}; paid_source=5ce7b76d-7f1a-43e5-a28a-76f10b039fbd; image_id=8acaabc7-e9a8-463b-8fd9-49e22aa019ea; additional_cost=0; exact_pixels=541; frames=11; remaining=profile,occlusion,suffix_boundary; user_visual_approval=pending\n')
for p in sorted(OUT.rglob('*')):
 if p.is_file() and p.name!='inventory.json':files.append({'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p),'bytes':p.stat().st_size})
(OUT/'inventory.json').write_text(json.dumps({'observed_at':now,'files':files},indent=2),encoding='utf-8')
print('Ledger:',len(jobs),'jobs,',ledger['actual_new_cost'],'generations;',len(reviews),'candidate output frames reviewed')
