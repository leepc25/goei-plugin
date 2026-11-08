import json, os, shutil, sys
from multiprocessing import Pool
import numpy as np
from PIL import Image
S=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,S)
import blobsall
EX=set(json.load(open(f'{S}/flood_exclude.json')))
def run(jb):
    d,k,nm,mn,path,old,cw,n=jb; b=os.path.basename(path)
    src=f'{S}/final/{d}/{b}.png' if f'{d}/{k}' in EX else f'{S}/final2/{d}/{b}.png'
    new=np.array(Image.open(src).convert('RGBA'))
    cur=np.array(Image.open(path).convert('RGBA'))
    if new.shape==cur.shape and (new==cur).all(): return 0
    if not os.path.exists(old):
        os.makedirs(os.path.dirname(old),exist_ok=True); shutil.copy2(path,old)
    Image.fromarray(new,'RGBA').save(path,'WEBP',lossless=True,method=4,exact=True)
    return 1
if __name__=='__main__':
    J=blobsall.jobs()
    with Pool(os.cpu_count()) as p: r=p.map(run,J,chunksize=16)
    print('applied',sum(r),'of',len(J))
