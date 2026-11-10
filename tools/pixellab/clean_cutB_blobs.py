"""컷 B 진행자 클립 회색 얼룩 정리(사용자 11-10 15:43 「회색 얼룩과 찌꺼기 코드로 정리」).
1) 기준 그림에 없는 단색 회색(+둘레 푸른 회색 띠)(무채색, 밝기 100~150)이 60칸 이상 뭉친 덩어리 중 바깥(투명·가장자리)에 닿은 것 = 배경 얼룩 → 투명
2) 몸(가장 큰 덩어리)에서 떨어진 조각 중 어둡지 않은 것(평균 밝기 60 초과) → 투명 (검은 눈물 방울은 남김)
3) 푸른 회색 두 색이 기준보다 훨씬 큰 덩어리(300·500칸 이상)로 바깥에 닿으면 얼룩 → 투명
4) 회색 선 덩어리(푸른 회색 6색 묶음, 바깥에 닿고 15칸 이상) → 투명 (11-10 18:46 사용자)
사용: python3 clean_cutB_blobs.py <기준.png> <in_dir> <out_dir>"""
import sys, os, numpy as np
from collections import Counter
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from clean_clip_specks import label
BIG={(124,131,149):300,(108,116,134):500}  # 기준 그림 최대 덩어리 20·146칸
LINE=[(132,139,155),(124,131,149),(108,116,134),(139,147,163),(131,130,134),(141,140,144)]
RIM=[(124,131,149),(108,116,134)]  # 얼룩 둘레 푸른 회색
def same_color_components(a, col):
    m=np.all(a[...,:3]==col,axis=-1)&(a[...,3]>0); return label(m)
def clean(a, basec):
    a=a.copy(); log={'bg':0,'detached':0}
    cnt=Counter(map(tuple,a[a[...,3]>0][:,:3].tolist()))
    sus=[c for c,n in cnt.items() if n>=60 and basec.get(c,0)<20 and max(c)-min(c)<=40 and 100<=max(c)<=150]
    if sus:
        m=np.zeros(a.shape[:2],bool)
        for c in sus+RIM: m|=np.all(a[...,:3]==np.array(c),axis=-1)
        m&=a[...,3]>0
        lab,k=label(m); tr=np.pad(a[...,3]==0,1,constant_values=True)
        out=tr[:-2,1:-1]|tr[2:,1:-1]|tr[1:-1,:-2]|tr[1:-1,2:]
        for j in range(1,k+1):
            mm=lab==j
            if mm.sum()>=60 and (mm&out).any() and any(np.all(a[mm][:,:3]==np.array(c),axis=-1).any() for c in sus): a[mm,3]=0; log['bg']+=int(mm.sum())
    # 3) 몸 색과 같은 푸른 회색이라도 기준 그림보다 훨씬 큰 한 덩어리(바깥에 닿음) = 얼룩
    for col,lim in BIG.items():
        m=np.all(a[...,:3]==np.array(col),axis=-1)&(a[...,3]>0); lab,k=label(m)
        tr=np.pad(a[...,3]==0,1,constant_values=True); out=tr[:-2,1:-1]|tr[2:,1:-1]|tr[1:-1,:-2]|tr[1:-1,2:]
        for j in range(1,k+1):
            mm=lab==j
            if mm.sum()>=lim and (mm&out).any(): a[mm,3]=0; log['bg']+=int(mm.sum())
    # 4) 회색 선 덩어리: 푸른 회색 계열 묶음이 바깥에 닿고 15칸 이상(기준 그림에는 이런 덩어리 0개)
    m=np.zeros(a.shape[:2],bool)
    for col in LINE: m|=np.all(a[...,:3]==np.array(col),axis=-1)
    m&=a[...,3]>0; lab,k=label(m)
    tr=np.pad(a[...,3]==0,1,constant_values=True); out=tr[:-2,1:-1]|tr[2:,1:-1]|tr[1:-1,:-2]|tr[1:-1,2:]
    for j in range(1,k+1):
        mm=lab==j
        if mm.sum()>=15 and (mm&out).sum()>=4: a[mm,3]=0; log['line']=log.get('line',0)+int(mm.sum())
    lab,k=label(a[...,3]>0); sz=np.bincount(lab.ravel()); sz[0]=0
    if k:
        main=sz.argmax()
        for j in range(1,k+1):
            if j==main: continue
            m=lab==j
            if a[m][:,:3].astype(int).mean()>60 or sz[j]<4: a[m,3]=0; log['detached']+=int(sz[j])
    return a,log
if __name__=='__main__':
    base,i,o=sys.argv[1:4]; os.makedirs(o,exist_ok=True)
    b=np.array(Image.open(base).convert('RGBA')); basec=Counter(map(tuple,b[b[...,3]>0][:,:3].tolist()))
    for f in sorted(os.listdir(i)):
        if not f.endswith('.png'): continue
        a,log=clean(np.array(Image.open(f'{i}/{f}').convert('RGBA')),basec)
        Image.fromarray(a).save(f'{o}/{f}')
        if log['bg'] or log['detached'] or log.get('line'): print(f,log)
