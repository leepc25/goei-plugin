# 고그니쟈 손 지정(사용자 11-08 짚은 곳): 다리 사이 회색 판·무릎 사이 조각만 지움. 번호는 gcomp.py 회색 덩어리 번호.
import json,os
import numpy as np
from PIL import Image
from scipy import ndimage as nd
S=os.path.dirname(os.path.abspath(__file__))
PICK={'8':[786,709],'9':[],'44':[545,898,1140]}   # 누운 채 움찔 다리 밑 판은 가운이라 둠(사용자 11-08)
r=json.load(open(f'{S}/flood.json')); log={}
for b,ids in PICK.items():
    p=f'{S}/final2/char-1.5/{b}.webp.png'; a=np.array(Image.open(p).convert('RGBA'))
    rgb=a[...,:3].astype(int); L=rgb.mean(-1); sat=rgb.max(-1)-rgb.min(-1); A=a[...,3]>0
    lab,n=nd.label(A&(sat<=12)&(L>=70)&(L<=175),np.ones((3,3),bool))
    m=np.isin(lab,ids)
    if b=='9': m=(lab==1100)|((lab==851)&(np.arange(a.shape[0])[:,None]>=146)&(np.arange(a.shape[1])[None,:]<=925))   # 약1: 가운 밑에 떨어진 회색 덩이 두 곳만
    a[m]=0
    ys,xs=np.nonzero(m); px=[[int(x),int(y)] for x,y in zip(xs,ys)]; log[b]=px
    Image.fromarray(a,'RGBA').save(p)
    k=f'char-1.5/{b}'; r[k]['px']=r[k]['px']+px; print(b,len(px))
json.dump(r,open(f'{S}/flood.json','w'),ensure_ascii=False); json.dump(log,open(f'{S}/man15.json','w'))
