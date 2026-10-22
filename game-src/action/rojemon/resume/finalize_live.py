"""Offline accounting consolidation from preserved server receipts; no paid API."""
from pathlib import Path
import datetime, hashlib, json, subprocess
HERE=Path(__file__).resolve().parent;CHAR=HERE.parent;ROOT=CHAR.parents[2]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
rows=[]
for key in ['down','man_throw','man_throw_edit']:
    folder=HERE/'live'/key;state=read(folder/'state.json');qa=read(folder/'qa.json')
    req=HERE/'requests'/f'{key}.json' if key!='man_throw_edit' else folder/'request.json'
    image=HERE/'inputs'/('A-pad.png' if key=='down' else 'M-pad.png') if key!='man_throw_edit' else HERE/'live/man_throw/raw/05.png'
    job=state['job_id'];cost=3 if key!='man_throw_edit' else 1
    result=read(folder/'result.json')
    assert any(f'charged: {cost} generation' in c.get('text','') for c in result['content'])
    row=dict(clip=key,job_id=job,tool='animate_with_skeleton_v3' if cost==3 else 'edit_image_pixen',actual_cost=cost,cost_unit='generations',cost_evidence=str((folder/'result.json').relative_to(CHAR)),request_sha256=sha(req),input_sha256=sha(image),output_hashes=[sha(p) for p in sorted((folder/'raw').glob('*.png'))],status='recovered',qa=qa['visual_status'],user_visual_approval=False)
    rows.append(row);state.update(row);write(folder/'state.json',state)
    line=f"2026-10-22 local-resume {key} job_id={job} actual_cost={cost} generations receipt={row['cost_evidence']} input_sha256={row['input_sha256']} qa={row['qa']} user_visual_approval=false\n"
    log=CHAR/'spend.log';text=log.read_text(encoding='utf-8')
    if f'local-resume {key} job_id={job}' not in text:
        with log.open('a',encoding='utf-8') as f:f.write(line)
write(HERE/'live/ledger.json',dict(owner='codex/art-rojemon-resume',max_pending=1,active_jobs=0,paid_calls=len(rows),actual_generations=sum(r['actual_cost'] for r in rows),jobs=rows,historical_actual_total=None,historical_note='Earlier approx330 is not independently itemized actual usage; do not infer this owner cost from shared balance delta.'))
queue=read(HERE/'queue.json');queue.update(current_balance_snapshot='live/balance-delivery.json',current_account_limit=20,current_limit_basis='Live Tier3 balance plus official search_help; 2x separate limit not confirmed',current_account_active_jobs_snapshot='live/jobs-delivery.json',current_balance=None,current_account_active_jobs=None,jobs=rows)
write(HERE/'queue.json',queue)
refs={r:subprocess.check_output(['git','rev-parse',r],cwd=ROOT,text=True).strip() for r in ['HEAD','origin/codex/metroidvania-run-system','origin/codex/character-production-resume']}
write(HERE/'live/provenance.json',dict(refs=refs,base_branch='codex/art-rojemon-resume',merged_branches=[],original_assets_unchanged=True,tool_reference='087dec121b9d65ad1c91fd3b1d5b1d669ba70fe4:tools/build_character_resume_demo.py',adaptation='Same embedding/hash audit pattern; Rojemon-only standalone source, no other agent image reuse',account_controller='01a1632e-358b-7931-b8ab-c3487b5b6095',cost_total=7,user_visual_approval=False))
print(json.dumps({'paid_calls':3,'actual_generations':7,'active_owner_jobs':0,'jobs':[{k:r[k] for k in ['clip','job_id','actual_cost','request_sha256','input_sha256']} for r in rows]},ensure_ascii=False))
