import numpy as np, os
from scipy import ndimage as nd
K=np.ones((3,3),bool)
ISL=4; CMAX=40; TR=0.6; CL=90
def lum(a): return (a[...,0]*299+a[...,1]*587+a[...,2]*114)/1000.0
def effects(o):
    """원본에서 몸과 떨어진 밝은 조각(검·발차기 궤적 같은 효과) — 건드리지 않음"""
    A=o[...,3]>0; L=lum(o); lab,n=nd.label(A,K); sz=np.bincount(lab.ravel()); sz[0]=0
    prot=np.zeros_like(A)
    if n==0: return prot,lab,sz
    big=sz.argmax()
    for i in range(1,n+1):
        if i==big or sz[i]<5: continue
        m=lab==i
        if (L[m]<50).mean()<0.1: prot|=m
    return prot,lab,sz
def inhalo(a,m,halo):
    c=a[m][:,:3]; return sum(tuple(int(t) for t in x) in halo for x in c)>=0.8*len(c)
def islands(a,o,prot,olab,osz,halo):
    A=a[...,3]>0; lab,n=nd.label(A,K); kill=np.zeros_like(A)
    if n==0: return kill
    sz=np.bincount(lab.ravel()); sat=a[...,:3].max(2)-a[...,:3].min(2); L=lum(a)
    body=olab==osz.argmax(); near=nd.binary_dilation(body,K,iterations=2)
    for i in np.nonzero(sz<=ISL)[0]:
        if i==0: continue
        m=lab==i
        if (m&prot).any(): continue
        oid=np.unique(olab[m]); grown=osz[oid].sum()>sz[i]   # 지운 탓에 떨어져 나온 조각
        grey=(sat[m]<=40).all() and (L[m]<=200).all()
        if not inhalo(a,m,halo): continue
        if (grown and (sz[i]<=2 or grey)) or (sz[i]<=2 and grey and (m&near).any()): kill|=m
    return kill
def clumps(a,prot,halo):
    A=a[...,3]>0; L=lum(a); sat=a[...,:3].max(2)-a[...,:3].min(2)
    G=A&(L>=CL)&(L<=200)&(sat<=30)&~prot
    lab,n=nd.label(G,K); kill=np.zeros_like(A)
    if n==0: return kill
    sz=np.bincount(lab.ravel()); sl=nd.find_objects(lab)
    for i in range(1,n+1):
        if sz[i]<3 or sz[i]>CMAX: continue
        ys,xs=sl[i-1]; h,w=ys.stop-ys.start,xs.stop-xs.start
        if min(h,w)<3 or sz[i]<0.5*h*w: continue   # 가는 줄(끈·물·머리카락)은 그림
        y0,y1=max(ys.start-1,0),min(ys.stop+1,A.shape[0]); x0,x1=max(xs.start-1,0),min(xs.stop+1,A.shape[1])
        m=lab[y0:y1,x0:x1]==i; ring=nd.binary_dilation(m,K)&~m
        t=~A[y0:y1,x0:x1][ring]; op=L[y0:y1,x0:x1][ring][~t]
        if t.mean()>=TR and (op.size==0 or op.max()<=60) and inhalo(a[y0:y1,x0:x1],m,halo): kill[y0:y1,x0:x1]|=m
    return kill
def clean(a,o,halo):
    prot,olab,osz=effects(o); a=a.copy(); tot=np.zeros(a.shape[:2],bool)
    k=clumps(a,prot,halo); a[k]=0; tot|=k
    k=islands(a,o,prot,olab,osz,halo); a[k]=0; tot|=k
    return a,tot,prot
