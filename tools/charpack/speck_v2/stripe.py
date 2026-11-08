import os,sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from npspeck import shift, shifts
def stripes(fr, maxsz=800, need_tr=True):
    a=np.asarray(fr).astype(np.int32); A=a[...,3]>0
    r,g,b=a[...,0],a[...,1],a[...,2]; L=(r*299+g*587+b*114)/1000.0
    sat=np.max(a[...,:3],axis=2)-np.min(a[...,:3],axis=2)
    G=A&(L>=70)&(L<=200)&(sat<=30)
    tr=np.zeros_like(A)
    for dy,dx in shifts(1): tr|=~shift(A,dy,dx,False)
    H,W=A.shape; seen=np.zeros_like(A); out=[]
    for y0,x0 in zip(*np.nonzero(G)):
        if seen[y0,x0]: continue
        comp=[(y0,x0)]; seen[y0,x0]=True; q=[(y0,x0)]
        while q:
            cy,cx=q.pop()
            for dy,dx in shifts(1):
                ny,nx=cy+dy,cx+dx
                if 0<=ny<H and 0<=nx<W and G[ny,nx] and not seen[ny,nx]: seen[ny,nx]=True; q.append((ny,nx)); comp.append((ny,nx))
        if len(comp)>maxsz: continue
        cs=set(comp); nb=[]; touch=any(tr[y,x] for y,x in comp)
        for cy,cx in comp:
            for dy,dx in shifts(1):
                n=(cy+dy,cx+dx)
                if n in cs: continue
                if 0<=n[0]<H and 0<=n[1]<W and A[n]: nb.append(L[n])
        interior=sum(1 for y,x in comp if all((y+dy,x+dx) in cs for dy,dx in shifts(1)))
        out.append({'px':[(int(x),int(y)) for y,x in comp],'touch':bool(touch),'nbmax':float(max(nb) if nb else -1),'interior':interior,'n':len(comp)})
    return out
