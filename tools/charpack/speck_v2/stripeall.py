import json,os,sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import stripe
S=os.path.dirname(__file__); r=json.load(open(f'{S}/rimfix/report.json')); rep={}
for i,(k,v) in enumerate(r.items()):
    p=f"{S}/rimfix/{v['char']}/{os.path.basename(v['path'])}.png"; im=Image.open(p).convert('RGBA'); cw=v['cw']; got=[]
    so=Image.open(v['src']).convert('RGBA').load(); halo={so[x,y][:3] for x,y in v['px']}
    ip=im.load()
    for f in range(v['n']):
        for c in stripe.stripes(im.crop((f*cw,0,(f+1)*cw,im.height))):
            if c['touch'] and 0<=c['nbmax']<=70 and c['interior']<=0.1*c['n'] and c['n']>=3 and sum(1 for x,y in c['px'] if ip[f*cw+x,y][:3] in halo)>=0.8*c['n']:
                got.append({'f':f,'px':[(f*cw+x,y) for x,y in c['px']]})
    if got: rep[k]={**{kk:v[kk] for kk in ('char','key','name','motion','path','src','cw','n')},'clumps':got}
    if i%2000==0: print(i,flush=True)
json.dump(rep,open(f'{S}/stripes.json','w'),ensure_ascii=False)
print('done',len(rep),sum(len(v['clumps']) for v in rep.values()),sum(len(c['px']) for v in rep.values() for c in v['clumps']))
