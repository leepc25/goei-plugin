"""Reconcile native MCP observations and owner reports; never submits jobs."""
import json, subprocess, datetime
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
def read(name):
    return json.loads((HERE / name).read_text(encoding='utf-8'))
def write(name, value):
    (HERE / name).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True, encoding='utf-8').strip()
snap = read('control-evidence/local-auth-20261022/account-snapshot.json')
owners = read('local-owners.json')['owners']
receipts = read('local-receipts.json')['receipts']
assert len({r['job_id'] for r in receipts}) == len(receipts), 'duplicate job ID'
assert len({r['character'] for r in owners}) == len(owners), 'duplicate character owner'
balance_text = '\n'.join(c.get('text', '') for c in snap['balance']['content'])
jobs_text = '\n'.join(c.get('text', '') for c in snap['jobs']['content'])
import re
balance = float(re.search(r'generations_remaining: ([\d.]+)', balance_text).group(1))
active = len(re.findall(r'^[-a-f0-9]{36} (?:processing|queued|pending|running)', jobs_text, re.M))
account = {'observed_at':snap['observed_at'], 'authentication':'native_mcp_success',
           'balance_generations':balance, 'active_jobs':active, 'documented_tier_limit':20,
           'account_specific_limit':None, 'limit_note':'Tier 3 documentation: 20; no separate account cap returned',
           'evidence':'control-evidence/local-auth-20261022/account-snapshot.json'}
write('account-latest.json', account)
q = read('queue.json')
q.update(account=account, observed_at=snap['observed_at'], dispatch_enabled=True,
         dispatch_blocker=None, per_owner_in_flight_limit=1, local_owners=owners)
for item in q['items']:
    owner = next((o for o in owners if o['character']==item['character']), None)
    if owner:
        item.update(owner_branch=owner['branch'], owner_thread_id=owner['thread_id'], owner_status='handoff_received')
    receipt = next((r for r in receipts if r['character']==item['character'] and r['clip']==item.get('clip')), None)
    if receipt:
        item.update(job_id=receipt['job_id'], cost_record=receipt, state='recovered_pending_review' if receipt['billing_period']=='historical_paid_recovery' else 'submitted_pending_review')
        item.pop('actual_charge', None)
        item.pop('actual_cost', None)
q['external_reservations'] = json.loads(git('show', 'origin/codex/character-production-resume:game-src/action/character-resume/queue.json')).get('external_reservations', [])
q['coordination'] = 'One owner per character and one in-flight job per owner. Account cap includes unrelated jobs. Git ledger is an audit record, not a distributed lock.'
write('queue.json', q)
comparison=read('source-comparison.json')
comparison['latest_system_ref']=git('rev-parse','origin/codex/metroidvania-run-system')
comparison['latest_preparation_ref']=git('rev-parse','origin/codex/character-production-resume')
comparison['current_art_diff_since_control_base']=git('diff','--name-only', comparison['system_base'], 'origin/codex/metroidvania-run-system','--','game-src/action').splitlines()
comparison['verification_time']=datetime.datetime.now(datetime.timezone.utc).isoformat()
write('source-comparison.json',comparison)
print(json.dumps({'balance':balance,'active':active,'owners':len(owners),'receipts':len(receipts),'art_changes':len(comparison['current_art_diff_since_control_base'])}))
