import json,sys,subprocess
r=json.load(open('/tmp/audit_1113/fix/round2_results.json')); d={x['id']:x for x in r}
for i in sys.argv[1:]:
    subprocess.run(['python3','/tmp/audit_1113/fix/show.py','-v',i])
    x=d.get(i)
    if x:
        print('--ROUND2 STATUS:',x['status']); print('--ROUND2 DONE:',x.get('what',''))
        if x.get('deferred_change'): print('--ROUND2 REMAINING CHANGE (apply this):',x['deferred_change'])
    print()
