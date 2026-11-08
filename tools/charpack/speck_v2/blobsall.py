import json, os, sys
from multiprocessing import Pool
import numpy as np
from PIL import Image
S=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,S)
import blob
st=json.load(open(f'{S}/stripes.json')); RF=json.load(open(f'{S}/rimfix/report.json'))
def jobs():
    J=[]
    for d in sorted(os.listdir('game-src/looks')):
        j=json.load(open(f'game-src/looks/{d}/look.json')); p=f'game-src/looks/{d}/{j["file"]}'
        J.append((d,'idle',j['name'],'대기',p,os.path.join(os.path.dirname(p),'_old',j['file']),j['cw'],j['n']))
    for d in sorted(os.listdir('game-pack')):
        if not d.startswith('char-'): continue
        j=json.load(open(f'game-pack/{d}/char.json'))
        for k,m in j['A'].items():
            if isinstance(m,dict) and 'file' in m:
                J.append((d,k,j.get('cfg',{}).get('name',''),m.get('name',''),f'game-pack/{d}/{m["file"]}',f'game-pack/_old/{d}/{m["file"]}',m['cw'],m['n']))
    return J
def run(jb):
    d,k,nm,mn,path,old,cw,n=jb; src=old if os.path.exists(old) else path
    rf=f'{S}/rimfix/{d}/{os.path.basename(path)}.png'
    a=np.array(Image.open(rf if os.path.exists(rf) else src).convert('RGBA')).astype(np.int32)
    for c in st.get(f'{d}/{k}',{}).get('clumps',[]):
        for x,y in c['px']: a[y,x]=0
    o=np.array(Image.open(src).convert('RGBA')).astype(np.int32)
    so=Image.open(src).convert('RGBA'); sp=so.load(); halo={sp[x,y][:3] for x,y in RF.get(f'{d}/{k}',{}).get('px',[])}
    px=[]
    for f in range(n):
        if mn=='손 씻기': break   # 물줄기는 그림
        fr=a[:,f*cw:(f+1)*cw]; of=o[:,f*cw:(f+1)*cw]; b,t,pr=blob.clean(fr,of,halo)
        b[pr]=of[pr]   # 떨어진 효과 조각은 원본 그대로
        a[:,f*cw:(f+1)*cw]=b
        ys,xs=np.nonzero(t); px+=[(int(x)+f*cw,int(y)) for x,y in zip(xs,ys)]
    os.makedirs(f'{S}/final/{d}',exist_ok=True)
    Image.fromarray(a.astype(np.uint8),'RGBA').save(f'{S}/final/{d}/{os.path.basename(path)}.png')
    return f'{d}/{k}',{'char':d,'key':k,'name':nm,'motion':mn,'path':path,'src':src,'cw':cw,'n':n,'px':px}
if __name__=='__main__':
    J=jobs(); rep={}
    with Pool(os.cpu_count()) as p:
        for i,(key,v) in enumerate(p.imap_unordered(run,J,chunksize=8)):
            if v['px']: rep[key]=v
            if i%2000==0: print(i,len(J),flush=True)
    json.dump(rep,open(f'{S}/blobs.json','w'),ensure_ascii=False)
    print('done',len(J),len(rep),sum(len(v['px']) for v in rep.values()))
