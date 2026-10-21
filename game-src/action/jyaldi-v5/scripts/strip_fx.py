# 효과(폭발·불꽃·빛) 지우기: 효과는 게임 코드가 그림(사용자 규칙). 사용: python3 strip_fx.py 이름...
# 1) 몸(가장 큰 덩어리)과 떨어진 조각 지움  2) 몸에 붙은 효과: 손목보다 앞쪽의 주황·노랑·밝은 흰 픽셀 지움
import sys,os,numpy as np
from PIL import Image
from collections import deque
def label(a):
    lab=np.zeros(a.shape,int); k=0; H,W=a.shape
    for y,x in zip(*np.nonzero(a)):
        if lab[y,x]: continue
        k+=1; q=deque([(y,x)]); lab[y,x]=k
        while q:
            cy,cx=q.popleft()
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    ny,nx=cy+dy,cx+dx
                    if 0<=ny<H and 0<=nx<W and a[ny,nx] and not lab[ny,nx]: lab[ny,nx]=k; q.append((ny,nx))
    return lab,k
import rig
for n in sys.argv[1:]:
    d=f'../full/clips/{n}'
    for i,f in enumerate(sorted(os.listdir(d))):
        im=np.array(Image.open(f'{d}/{f}').convert('RGBA')); a=im[...,3]>0
        lab,k=label(a)
        if k>1:
            sz=np.bincount(lab.ravel())[1:]; keep=1+int(np.argmax(sz))
            im[(lab!=keep)&a]=0
        r,g,b=[im[...,c].astype(int) for c in range(3)]
        fx=((r>170)&(g>90)&(b<150)&(r-b>60)) | ((r>215)&(g>215)&(b>200))
        ps=rig.CLIPS[n][2]; p=ps[min(i,len(ps)-1)]
        wx=max(p['RIGHT ARM'][0],p['LEFT ARM'][0])+rig.DX+3
        cols=np.arange(im.shape[1])[None,:]
        im[fx&(cols>wx)]=0
        mx=np.maximum(np.maximum(r,g),b); mn=np.minimum(np.minimum(r,g),b)
        suit=(mx<120)&(mx-mn<40)                      # 손목 앞에는 검은 장갑·소매만 남김
        im[(~suit)&(cols>wx+2)&(im[...,3]>0)]=0
        Image.fromarray(im).save(f'{d}/{f}')
    print('cleaned',n)
