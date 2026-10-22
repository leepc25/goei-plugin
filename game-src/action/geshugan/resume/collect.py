"""Repository evidence only: never infer live status or actual costs from old balances."""
from pathlib import Path
import subprocess, json, re, hashlib
ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).resolve().parent

def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT)
def save(name,data): (OUT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
rows={}
for p in sorted((ROOT/'game-src/action').rglob('spend.log')):
    context=(1,'')
    for no,line in enumerate(p.read_text().splitlines(),1):
        if re.match(r'^\d{4}-\d\d-\d\d',line): context=(no,line)
        for jid in re.findall(r'\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b',line):
            if jid not in rows:
                rel=p.relative_to(ROOT)
                rows[jid]={'job_id':jid,'character':rel.parts[2],'source':str(rel),'line':context[0],
                    'historical_event':context[1] or line,'actual_cost':None,
                    'cost_status':'server_usage_not_available','live_status':'unverified'}
save('historical-job-ledger.json',list(rows.values()))
print('Known job IDs',len(rows),'Geshugan',sum(r['character']=='geshugan' for r in rows.values()))
ref='origin/codex/character-production-resume';commit=git('rev-parse',ref).decode().strip()
groups={
 'kyuras':['tools/recover_character_jobs.py','tests/character-recovery.test.py','docs/character-resume/kyuras-audit.md'],
 'jyaldi':['game-src/action/jyaldi-v5/resume/build_drafts.py','game-src/action/jyaldi-v5/resume/README.md','game-src/action/jyaldi-v5/resume/walk-request.draft.json','game-src/action/jyaldi-v5/resume/run-request.draft.json','docs/character-resume/jyaldi-audit.md'],
 'all':['tools/build_character_delivery.py','tools/build_character_resume_demo.py','tools/character_resume_demo.html','docs/character-resume/other-agents-audit.md','game-src/action/character-resume/queue.json']}
handoff={'source_commit':commit,'scope':'참조 인계만. 전체 브랜치 병합 없음. 담당 수령 미확인.','owners':{}}
for owner,paths in groups.items():
    handoff['owners'][owner]=[{'path':p,'sha256':hashlib.sha256(git('show',ref+':'+p)).hexdigest(),
        'url':f'https://github.com/leepc25/goei-plugin/blob/{commit}/{p}'} for p in paths]
save('tool-handoff.json',handoff)
queue={'as_of_commit':git('rev-parse','HEAD').decode().strip(),'account_queue_verified':False,
 'character_submission_limit':1,'new_paid_calls':0,'current_balance':None,'current_account_limit':None,'entries':[
 {'owner':'kyuras','action':'recover_only','job_id':'11826541-47d1-40de-9664-f05f1838bb23','clip':'idle_shotgun','paid_previously_reported':True,'actual_cost':None,'handoff':'prepared; recipient acknowledgement unavailable'},
 {'owner':'kyuras','action':'recover_only','job_id':'9fe0e770-b992-4299-a4c1-90d6e591828a','clip':'run_shotgun','paid_previously_reported':True,'actual_cost':None,'handoff':'prepared; recipient acknowledgement unavailable'},
 {'owner':'geshugan','action':'edit_getup_frame_03','state':'blocked_auth_not_submitted','job_id':None,'actual_cost':None,'published_estimate_generations':1,'estimate_source':'edit_image_pixen tools/list read this session'},
 {'owner':'geshugan','action':'bathing_20_frames','state':'already_delivered_hash_identical_do_not_generate'}]}
save('queue.json',queue)
status=json.loads((OUT/'account-status.json').read_text())
status.update(authenticated=False,current_balance=None,active_jobs=None,account_limit=None,
    service_error='401 Missing Authorization header (MCP HTTP transport was 200)')
save('account-status.json',status)
