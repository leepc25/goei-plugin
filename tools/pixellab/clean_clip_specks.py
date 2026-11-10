"""투명 배경 클립의 회색 찌꺼기 정리(사용자 11-10 「코드로 회색 찌꺼기 정리」).
1) 몸에서 떨어진 작은 점(30px 미만) 지움 2) 바깥 테두리에 붙은 연회색(무채색, 밝기 80~210) 픽셀을 바깥부터 벗겨 냄
3) 몸 안쪽에 난 투명 구멍(바깥과 안 이어짐)은 둘레 색으로 메움.
사용: python3 clean_clip_specks.py <in_dir> <out_dir>"""
import sys, os, numpy as np
from collections import deque
from PIL import Image
def label(m):
    H,W=m.shape; lab=np.zeros((H,W),int); n=0
    for y in range(H):
        for x in range(W):
            if m[y,x] and not lab[y,x]:
                n+=1; q=deque([(y,x)]); lab[y,x]=n
                while q:
                    cy,cx=q.popleft()
                    for dy in(-1,0,1):
                        for dx in(-1,0,1):
                            ny,nx=cy+dy,cx+dx
                            if 0<=ny<H and 0<=nx<W and m[ny,nx] and not lab[ny,nx]:
                                lab[ny,nx]=n; q.append((ny,nx))
    return lab,n
XMAX=180
def clean(a):
    a=a.copy(); op=a[...,3]>0; log={}
    lab,n=label(op); sz=np.bincount(lab.ravel())
    for k in range(1,n+1):
        if sz[k]<30: a[lab==k,3]=0
    log['dots']=int(sum(sz[k] for k in range(1,n+1) if sz[k]<30))
    rgb=a[...,:3].astype(int); mx=rgb.max(-1); mn=rgb.min(-1)
    grey=(mx-mn<=40)&(mx>=70)&(mx<=235)
    br=(mx>=185)&(a[...,3]>0); nb=br.copy()
    for dy in range(-2,3):
        for dx in range(-2,3): nb|=np.roll(np.roll(br,dy,0),dx,1)
    grey&=~nb  # 얼굴·셔츠 같은 밝은 살 옆 회색은 살의 가장자리라 두기
    grey[:,XMAX:]=False  # 손(장갑) 쪽은 건드리지 않음
    peeled=0
    for _ in range(6):
        tr=a[...,3]==0; p=np.pad(tr,1,constant_values=True)
        nb=p[:-2,1:-1]|p[2:,1:-1]|p[1:-1,:-2]|p[1:-1,2:]
        kill=grey&~tr&nb
        if not kill.any(): break
        a[kill,3]=0; peeled+=int(kill.sum())
    log['peeled']=peeled
    # 머리·어깨 바깥에 붙은 작은 밝은 덩어리(흰 점 섞인 찌꺼기): 밝은 픽셀끼리 묶어 25px 미만이고 바깥(투명)에 닿으면 지움
    rgb=a[...,:3].astype(int); lt=(rgb.max(-1)>=70)&(a[...,3]>0); lt[:,XMAX:]=False
    lab,n=label(lt); tr=a[...,3]==0; p=np.pad(tr,1,constant_values=True)
    nbt=p[:-2,1:-1]|p[2:,1:-1]|p[1:-1,:-2]|p[1:-1,2:]
    blobs=0
    for k in range(1,n+1):
        m=lab==k
        if m.sum()<25 and (m&nbt).any(): a[m,3]=0; blobs+=int(m.sum())
    log['blobs']=blobs
    # 벗겨 낸 뒤 떨어져 남은 작은 점 한 번 더
    lab,n=label(a[...,3]>0); sz=np.bincount(lab.ravel())
    for k in range(1,n+1):
        if sz[k]<30: a[lab==k,3]=0; log['dots']+=int(sz[k])
    tr=a[...,3]==0; lab,n=label(tr); H,W=tr.shape
    edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))
    filled=0
    for k in range(1,n+1):
        if k in edge: continue
        for y,x in zip(*np.where(lab==k)):
            ys,xs=slice(max(0,y-1),y+2),slice(max(0,x-1),x+2)
            nb=a[ys,xs].reshape(-1,4); nb=nb[nb[:,3]>0]
            if len(nb): a[y,x]=nb[len(nb)//2]; filled+=1
    log['holes']=filled
    return a,log
if __name__=='__main__':
    i,o=sys.argv[1:3]; os.makedirs(o,exist_ok=True)
    for f in sorted(os.listdir(i)):
        if not f.endswith('.png'): continue
        a,log=clean(np.array(Image.open(f'{i}/{f}').convert('RGBA')))
        Image.fromarray(a).save(f'{o}/{f}'); print(f,log)
