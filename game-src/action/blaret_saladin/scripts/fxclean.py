# 모델이 금지어에도 그려 넣는 효과(총구 불꽃·연기·빛 조각)를 지움. 효과는 엔진 코드가 그림.
#  1) 불꽃색(밝은 노랑·주황) 화소 + 그 둘레 1칸의 따뜻한 색 화소 삭제
#  2) 몸통(가장 큰 덩어리)과 떨어진 작은 덩어리 삭제(연기·불티). keep_far=True면 큰 떨어진 덩어리(던진 물건)는 남김
import numpy as np
from collections import deque
from PIL import Image
def comps(m):
    h,w=m.shape; lab=np.zeros((h,w),int); n=0; sizes=[]
    for y,x in zip(*np.nonzero(m)):
        if lab[y,x]: continue
        n+=1; q=deque([(y,x)]); lab[y,x]=n; c=0
        while q:
            cy,cx=q.popleft(); c+=1
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    yy,xx=cy+dy,cx+dx
                    if 0<=yy<h and 0<=xx<w and m[yy,xx] and not lab[yy,xx]: lab[yy,xx]=n; q.append((yy,xx))
        sizes.append(c)
    return lab,sizes
def clean(im,flash=True,minfrac=0.2):
    a=np.array(im.convert('RGBA')).astype(int); m=a[...,3]>0
    r,g,b=a[...,0],a[...,1],a[...,2]
    if flash:
        f=m&(r>200)&(g>110)&(b<130)&((r-b)>110)
        if f.any():
            grow=f.copy()
            for dy in (-1,0,1):
                for dx in (-1,0,1): grow|=np.roll(np.roll(f,dy,0),dx,1)
            warm=m&(r>140)&(r>g)&(g>b)&((r-b)>60)
            f|=grow&warm
            a[f,3]=0; m=a[...,3]>0
    lab,sizes=comps(m)
    if sizes:
        big=max(sizes)
        for i,s in enumerate(sizes,1):
            if s<big*minfrac: a[lab==i,3]=0
    return Image.fromarray(a.astype('uint8'))
