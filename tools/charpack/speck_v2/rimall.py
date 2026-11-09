import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import rim
out=sys.argv[1]; os.makedirs(out,exist_ok=True); rep={}; jobs=[]
for d in sorted(os.listdir('game-src/looks')):
    j=json.load(open(f'game-src/looks/{d}/look.json')); p=f'game-src/looks/{d}/{j["file"]}'
    jobs.append((d,'idle',j['name'],'대기',p,os.path.join(os.path.dirname(p),'_old',j['file']),j['cw'],j['n']))
for d in sorted(os.listdir('game-pack')):
    if not d.startswith('char-'): continue
    j=json.load(open(f'game-pack/{d}/char.json'))
    for k,m in j['A'].items():
        if isinstance(m,dict) and 'file' in m:
            jobs.append((d,k,j.get('cfg',{}).get('name',''),m.get('name',''),f'game-pack/{d}/{m["file"]}',f'game-pack/_old/{d}/{m["file"]}',m['cw'],m['n']))
for i,(d,k,nm,mn,path,old,cw,n) in enumerate(jobs):
    src=old if os.path.exists(old) else path
    im,p=rim.clean(src,cw,n)
    if p:
        os.makedirs(f'{out}/{d}',exist_ok=True); im.save(f'{out}/{d}/{os.path.basename(path)}.png')
        rep[f'{d}/{k}']={'char':d,'key':k,'name':nm,'motion':mn,'path':path,'old':old,'src':src,'cw':cw,'n':n,'px':p}
    if i%2000==0: print(i,len(jobs),flush=True)
json.dump(rep,open(f'{out}/report.json','w'),ensure_ascii=False)
print('done',len(jobs),len(rep),sum(len(v['px']) for v in rep.values()))
