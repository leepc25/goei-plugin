# 고그니쟈(char-1.5): 흰 가운 그림자도 같은 회색이라 색으로 가름 (사용자 11-08 판정)
# 지움: 바닥·다리 사이 회색(117,115,120 / 132,132,134가 주된 판). 앉은 자세의 의자 자리 큰 판은 가운이라 남김.
import json,os,collections
import numpy as np
from PIL import Image
from scipy import ndimage as nd
S=os.path.dirname(os.path.abspath(__file__)); K=np.ones((3,3),bool)
JUNK={(117,115,120),(132,132,134)}
r=json.load(open(f'{S}/flood.json')); kept=0
for k,v in list(r.items()):
    if v['char']!='char-1.5': continue
    b=os.path.basename(v['path']); pre=np.array(Image.open(f'{S}/final/char-1.5/{b}.png').convert('RGBA'))
    out=np.array(Image.open(f'{S}/final2/char-1.5/{b}.png').convert('RGBA'))
    kill=np.zeros(pre.shape[:2],bool)
    for x,y in v['px']: kill[y,x]=True
    lab,n=nd.label(kill,K); newpx=[]
    mo=v['motion']; sit=mo.startswith('정면 앉') or mo.startswith('앉아') or mo.startswith('정면 기대')
    A=pre[...,3]>0
    for i in range(1,n+1):
        m=lab==i; c=collections.Counter(tuple(int(t) for t in p) for p in pre[m][:,:3]).most_common(1)[0][0]
        ys_,xs_=np.nonzero(m); ring=nd.binary_dilation(m,K)&~m; tr=(~A[ring]).mean()
        if sit: ok=ys_.min()>=165          # 앉은 자세: 의자 자리(가운)는 두고 바닥 조각만
        else: ok=(c in JUNK) or tr>=0.9    # 그 밖: 바닥·다리 사이 회색, 완전히 떠 있는 판
        if ok:
            ys,xs=np.nonzero(m); newpx+=[[int(x),int(y)] for x,y in zip(xs,ys)]
        else:
            out[m]=pre[m]; kept+=int(m.sum())
    Image.fromarray(out,'RGBA').save(f'{S}/final2/char-1.5/{b}.png'); v['px']=newpx
json.dump(r,open(f'{S}/flood.json','w'),ensure_ascii=False)
print('restored px',kept)
