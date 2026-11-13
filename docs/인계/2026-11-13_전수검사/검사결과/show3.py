import json,sys,subprocess
r=json.load(open('/tmp/audit_1113/fix/r34_results.json'))
for i in sys.argv[1:]:
    subprocess.run(['python3','/tmp/audit_1113/fix/show.py',i])
    for x in r:
        if x['id']==i:
            print(f"--LAST ROUND ({x['round']}/{x['group']}) STATUS:",x['status']); print('--LAST ROUND DONE:',x.get('what',''))
            if x.get('deferred_change'): print('--REMAINING CHANGE (apply the part in your files):',x['deferred_change'])
            if x.get('guide_out_later'): print('--GUIDE-OUT LATER PAIRS:',x['guide_out_later'])
            if x.get('before_after'): print('--BEFORE/AFTER:',x['before_after'])
    print()
