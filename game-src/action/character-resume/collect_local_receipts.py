"""Read owner worktree receipts without issuing API calls or inferring costs from balance."""
from pathlib import Path
import json,re,hashlib,datetime
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
WORKSPACE=ROOT.parent
UUID=r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
def messages(obj):
    if isinstance(obj,dict):
        if obj.get('job_id') and isinstance(obj.get('charged_generations'),(int,float)) and ('download_url' in obj or 'asset' in obj):
            yield 'Structured server receipt fields\njob_id: '+str(obj['job_id'])+'\nstatus: '+str(obj.get('status','unknown'))+'\ncharged: '+str(obj['charged_generations'])+' generations'
        if obj.get('type')=='text' and isinstance(obj.get('text'),str):
            yield obj['text']
        for key in ('result','response','content','structuredContent'):
            if key in obj: yield from messages(obj[key])
    elif isinstance(obj,list):
        for item in obj: yield from messages(item)
owners=json.loads((HERE/'local-owners.json').read_text(encoding='utf-8'))['owners']
jobs={}
evidence=[]
for owner in owners:
    character=owner['character']
    checkout=WORKSPACE/('art-'+character+'-resume')
    folder=checkout/'game-src/action'/({'jyaldi':'jyaldi-v5','blaret-saladin':'blaret_saladin'}.get(character,character))
    for area in ('resume','recovered','generated'):
        for path in (folder/area).rglob('*.json'):
            if path.stat().st_size>2000000: continue
            try:
                raw=path.read_bytes(); obj=json.loads(raw)
            except (ValueError,OSError): continue
            texts=list(messages(obj))
            for text in texts:
                ids=re.findall(r'job_id["\s:=]+('+UUID+')',text,re.I)
                for job_id in set(ids):
                    job=jobs.setdefault(job_id,{'job_id':job_id,'character':character,'charged_generations':None,'submission_cost_generations':None,'estimated_generations':None,'server_status':None,'evidence':[],'user_visual_approval':False})
                    if job['character']!=character: raise ValueError('job shared by multiple owners')
                    charged=re.search(r'charged:\s*([\d.]+) generations?',text,re.I)
                    cost=re.search(r'cost:\s*([\d.]+) generations?',text,re.I)
                    estimated=re.search(r'cost:\s*~\s*([\d.]+) generations?',text,re.I)
                    if charged:
                        amount=float(charged.group(1))
                        assert job['charged_generations'] in (None,amount), 'conflicting server charge receipts: '+job_id
                        job['charged_generations']=amount
                    if cost: job['submission_cost_generations']=float(cost.group(1))
                    if estimated: job['estimated_generations']=float(estimated.group(1))
                    status=re.search(r'status:\s*(\w+)',text,re.I)
                    if status and (job['server_status'] not in ('completed','failed') or status.group(1) in ('completed','failed')):
                        job['server_status']=status.group(1)
                    index=len(evidence)
                    evidence.append({'owner':character,'path':path.relative_to(checkout).as_posix(),'sha256':hashlib.sha256(raw).hexdigest(),'receipt_text':text,'source':'local owner worktree; commit verification pending'})
                    job['evidence'].append(index)
historical={'11826541-47d1-40de-9664-f05f1838bb23','9fe0e770-b992-4299-a4c1-90d6e591828a'}
for job in jobs.values(): job['billing_period']='historical_paid_recovery' if job['job_id'] in historical else 'current_resume'
value={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'jobs':list(jobs.values()),'evidence':evidence,
       'current_confirmed_charged_generations':sum(j['charged_generations'] or 0 for j in jobs.values() if j['job_id'] not in historical),
       'historical_recovered_generations':sum(j['charged_generations'] or 0 for j in jobs.values() if j['job_id'] in historical),
       'note':'Only explicit server receipt fields. Missing cost remains null; submission cost and completed charged are separate. Balances are not attributed.'}
(HERE/'verified-local-receipts.json').write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
inventory_path=HERE/'job-inventory.json'
inventory=json.loads(inventory_path.read_text(encoding='utf-8'))
index={j['job_id']:j for j in inventory['jobs']}
for receipt in value['jobs']:
    item=index.setdefault(receipt['job_id'],{'job_id':receipt['job_id'],'character':receipt['character'],'sources':[],'actual_cost':None})
    item['local_receipt_record']='verified-local-receipts.json#'+receipt['job_id']
    if receipt['charged_generations'] is not None:
        item['actual_cost']={'generations':receipt['charged_generations'],'evidence':item['local_receipt_record']}
        item['cost_status']='completed_server_receipt_verified'
    else:
        item['cost_status']='submission_receipt_only_completion_charge_pending'
inventory['jobs']=sorted(index.values(),key=lambda j:(j['character'],j['job_id']))
inventory['job_count']=len(index)
inventory['local_receipts_verified_at']=value['observed_at']
inventory_path.write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in value.items() if k not in ('jobs','evidence')}))
print('jobs',len(jobs),'evidence',len(evidence))
