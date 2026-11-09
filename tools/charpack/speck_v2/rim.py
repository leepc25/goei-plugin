import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from npspeck import shift, shifts
LMIN,GAP,SAT,PASSES=int(os.environ.get('LMIN',60)),int(os.environ.get('GAP',25)),30,int(os.environ.get('PASSES',5))
def rim_pass(a,prot):
    A=a[...,3]>0; r,g,b=a[...,0],a[...,1],a[...,2]
    L=(r*299+g*587+b*114)/1000.0
    sat=np.max(a[...,:3],axis=2)-np.min(a[...,:3],axis=2); purple=(r-g>=8)&(b-g>=8)
    tr=np.zeros_like(A)
    for dy,dx in shifts(1): tr|=~shift(A,dy,dx,False)
    B=A&tr
    cand=B&(L>=LMIN)&(L<=200)&(sat<=SAT)&~prot
    inner=A&~B
    # 안쪽 이웃(경계 아닌 불투명) 밝기 최대
    M=np.where(inner,L,-1.0); mx=np.full(L.shape,-1.0)
    for dy,dx in shifts(1): mx=np.maximum(mx,shift(M,dy,dx,-1.0))
    # 안쪽 이웃이 없으면(가는 곳) 후보 아닌 불투명 이웃
    M2=np.where(A&~cand,L,-1.0); mx2=np.full(L.shape,-1.0)
    for dy,dx in shifts(1): mx2=np.maximum(mx2,shift(M2,dy,dx,-1.0))
    ref=np.where(mx>=0,mx,mx2)
    return cand&(ref>=0)&(ref<=L-GAP)
def clean_frame(fr):
    a=np.array(fr).astype(np.int32); tot=np.zeros(a.shape[:2],bool)
    L0=(a[...,0]*299+a[...,1]*587+a[...,2]*114)/1000.0
    W0=(a[...,3]>0)&(L0>200); prot=W0.copy()
    for dy,dx in shifts(2): prot|=shift(W0,dy,dx,False)
    for _ in range(PASSES):
        k=rim_pass(a,prot)
        if not k.any(): break
        a[k]=0; tot|=k
    return Image.fromarray(a.astype(np.uint8),'RGBA'), [(int(x),int(y)) for y,x in zip(*np.nonzero(tot))]
def clean(path,cw,n):
    im=Image.open(path).convert('RGBA'); allp=[]
    for f in range(n):
        fr,p=clean_frame(im.crop((f*cw,0,(f+1)*cw,im.height)))
        im.paste(fr,(f*cw,0)); allp+=[(f*cw+x,y) for x,y in p]
    return im,allp
