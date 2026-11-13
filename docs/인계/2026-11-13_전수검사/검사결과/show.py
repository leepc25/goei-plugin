import json,sys
a=json.load(open('/tmp/audit_1113/fix/all.json'))
d={f['id']:f for f in a}
full='-v' in sys.argv
for k in [x for x in sys.argv[1:] if x!='-v']:
    f=d[k]; print('=====',k,f.get('severity'),f.get('file'),f.get('line'),f['title_ko'])
    for x in ['record','old_text','new_text','evidence','scenario','fix','fix_sketch','needs_user_decision']:
        if f.get(x): print(f'--{x}:',f[x])
    if full:
        for r in f.get('vreason',[]): print('--V:',r)
    for r in f.get('vfix',[]):
        if r: print('--FIXPLAN:',r)
    for r in f.get('vfinal',[]): print('--FINAL:',json.dumps(r,ensure_ascii=False))
    for r in f.get('vdecision',[]): print('--DECISION:',r)
