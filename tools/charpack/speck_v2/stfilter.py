import json,os
from multiprocessing import Pool
import numpy as np
from PIL import Image
from scipy import ndimage as nd
S=os.path.dirname(os.path.abspath(__file__)); st=json.load(open(f'{S}/stripes_all.json')); K=np.ones((3,3),bool)
TH=float(os.environ.get('TH',0.3))
def run(k):
    v=st[k]; a=np.array(Image.open(f"{S}/rimfix/{v['char']}/{os.path.basename(v['path'])}.png").convert('RGBA'))
    T=nd.binary_dilation(a[...,3]==0,K); keep=[]
    for c in v['clumps']:
        xs=[x for x,y in c['px']]; ys=[y for x,y in c['px']]
        if T[ys,xs].mean()>=TH: keep.append(c)
    return k,keep
if __name__=='__main__':
    out={}
    with Pool(os.cpu_count()) as p:
        for k,keep in p.imap_unordered(run,list(st),chunksize=16):
            if keep: v=dict(st[k]); v['clumps']=keep; out[k]=v
    json.dump(out,open(f'{S}/stripes.json','w'),ensure_ascii=False)
    print(len(out),sum(len(v['clumps']) for v in out.values()),sum(len(c['px']) for v in out.values() for c in v['clumps']))
