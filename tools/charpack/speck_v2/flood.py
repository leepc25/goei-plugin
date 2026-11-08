import json, os, sys, collections
from multiprocessing import Pool
import numpy as np
from PIL import Image
from scipy import ndimage as nd
S=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,S)
import blob, blobsall
RF=json.load(open(f'{S}/rimfix/report.json')); K=np.ones((3,3),bool)
POCKET=os.environ.get('POCKET','1')=='1'
def palette(src,px):
    p=Image.open(src).convert('RGBA').load(); c=collections.Counter(p[x,y][:3] for x,y in px)
    out=set()
    for col,n in c.items():
        r,g,b=col; L=(r*299+g*587+b*114)/1000; s=max(col)-min(col)
        if n>=3 and s<=10 and 55<=L<=200: out.add(col)   # 찌꺼기 판은 거의 무채색
    return out
def frame(a,o,pal,junk=None):
    A=a[...,3]>0
    if not pal: return np.zeros_like(A)
    code=(a[...,0]<<16)|(a[...,1]<<8)|a[...,2]
    pc=np.array([(r<<16)|(g<<8)|b for r,g,b in pal])
    H=A&np.isin(code,pc)
    prot,olab,osz=blob.effects(o)
    same=np.zeros_like(A)
    for dy,dx in ((0,1),(1,0)):
        same|=(code==np.roll(code,(dy,dx),(0,1)))&(code==np.roll(code,(-dy,-dx),(0,1)))
    # 떨어져 있어도 크고 밋밋한 회색 판은 효과가 아니라 찌꺼기
    plab,pn=nd.label(prot,K)
    for i in range(1,pn+1):
        m=plab==i
        if m.sum()>=60 and same[m].mean()>=0.6 and (H[m]).mean()>=0.8: prot&=~m
    H&=~prot
    lab,n=nd.label(H,K)
    if n==0: return H
    T=nd.binary_dilation(~A,K)
    touch=np.unique(lab[T&H]); touch=touch[touch>0]; kill=np.zeros_like(A)
    for i in touch:   # 크고 밋밋하게 칠해진 회색 판(바닥·그림자 찌꺼기)만
        m=lab==i; sz=m.sum()
        if sz<60 or same[m].mean()<0.6: continue
        if nd.distance_transform_edt(m).max()<3: continue   # 가는 선(효과선·칼 궤적)은 그림
        ring=nd.binary_dilation(m,K)&~m
        tr=(~A[ring]).mean(); op=blob.lum(a)[ring&A]; dk=(op<=60).mean() if op.size else 1.0
        if tr>=0.5: kill|=m   # 둘레 절반 이상이 투명 = 몸 밖에 떠 있는 판
        elif junk is not None and tr>=0.1 and dk>=0.8 and sz<=1500 and np.isin(code[m],junk).mean()>=0.8: kill|=m   # 검은 다리·몸 사이에 낀 판(같은 동작의 떠 있는 판과 같은 색)
    if POCKET:
        L=blob.lum(a); sz=np.bincount(lab.ravel()); sl=nd.find_objects(lab)
        for i in range(1,n+1):
            if i in touch or sz[i]<2: continue
            ys,xs=sl[i-1]; y0,y1=max(ys.start-1,0),min(ys.stop+1,A.shape[0]); x0,x1=max(xs.start-1,0),min(xs.stop+1,A.shape[1])
            m=lab[y0:y1,x0:x1]==i; ring=nd.binary_dilation(m,K)&~m
            if L[y0:y1,x0:x1][ring].max()<=60: kill[y0:y1,x0:x1]|=m
    return kill
def run(jb):
    d,k,nm,mn,path,old,cw,n=jb; src=old if os.path.exists(old) else path
    b=os.path.basename(path); a=np.array(Image.open(f'{S}/final/{d}/{b}.png').convert('RGBA')).astype(np.int32)
    o=np.array(Image.open(src).convert('RGBA')).astype(np.int32)
    pal=palette(src,RF.get(f'{d}/{k}',{}).get('px',[])); px=[]
    if mn!='손 씻기':
        jk=set()
        for f in range(n):   # 1차: 떠 있는 판의 색 모으기
            sl=slice(f*cw,(f+1)*cw); fa=a[:,sl]; t=frame(fa,o[:,sl],pal)
            c=(fa[...,0]<<16)|(fa[...,1]<<8)|fa[...,2]; jk|=set(np.unique(c[t]).tolist())
        junk=np.array(sorted(jk)) if jk else None
        for f in range(n):
            sl=slice(f*cw,(f+1)*cw); t=frame(a[:,sl],o[:,sl],pal,junk); a[:,sl][t]=0
            if t.any():   # 판을 지우고 남은 부스러기
                pr,ol,os_=blob.effects(o[:,sl]); t2=blob.islands(a[:,sl],o[:,sl],pr,ol,os_,pal); a[:,sl][t2]=0; t|=t2
            ys,xs=np.nonzero(t); px+=[(int(x)+f*cw,int(y)) for x,y in zip(xs,ys)]
    os.makedirs(f'{S}/final2/{d}',exist_ok=True); Image.fromarray(a.astype(np.uint8),'RGBA').save(f'{S}/final2/{d}/{b}.png')
    return f'{d}/{k}',{'char':d,'key':k,'name':nm,'motion':mn,'path':path,'src':src,'cw':cw,'n':n,'px':px}
if __name__=='__main__':
    J=blobsall.jobs(); rep={}
    if len(sys.argv)>1: J=[j for j in J if f'{j[0]}/{j[1]}' in sys.argv[1].split(',')]
    with Pool(os.cpu_count()) as p:
        for i,(key,v) in enumerate(p.imap_unordered(run,J,chunksize=8)):
            if v['px']: rep[key]=v
    json.dump(rep,open(f'{S}/flood.json','w'),ensure_ascii=False)
    print('done',len(J),len(rep),sum(len(v['px']) for v in rep.values()))
