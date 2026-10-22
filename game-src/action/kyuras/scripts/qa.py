# 장 단위 자동 검사: 키·발바닥·좌우 위치, 정장 톤(쟈알디 팔레트 거리), 효과색(주황·노랑·빨강 = 폭발·불꽃이 그려짐), 외톨이 점, 회색 얼룩, 장 사이 튐
# 사용: python3 qa.py [클립...]  → 표준출력에 문제 장만
import sys,os,colorsys,json
import numpy as np
from PIL import Image
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
A=np.array(Image.open(os.path.join(ROOT,'base','A.png')).convert('RGBA'))
def stats(a):
    m=a[:,:,3]>0
    if m.sum()==0: return None
    ys,xs=np.where(m); rgb=a[:,:,:3].astype(int)
    r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
    warm=m&(r>180)&(r-b>90)&(g>90)&~((r>200)&(g>150)&(b>110))   # 주황·노랑(피부 제외)
    red=m&(r>150)&(g<90)&(b<90)
    nb=sum(np.roll(np.roll(m,dy,0),dx,1).astype(int) for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)))
    lone=(m&(nb==0)).sum()
    grey=m&(abs(r-g)<10)&(abs(g-b)<10)&(r>110)&(r<200)
    return dict(top=int(ys.min()),bot=int(ys.max()),x0=int(xs.min()),x1=int(xs.max()),n=int(m.sum()),warm=int(warm.sum()),red=int(red.sum()),lone=int(lone),grey=int(grey.sum()),
                cx=float(xs[ys>ys.max()-10].mean()))
ref=stats(A)
names=sys.argv[1:] or sorted(os.listdir(os.path.join(ROOT,'clips')))
rep={}
for n in names:
    d=os.path.join(ROOT,'clips',n)
    if not os.path.isdir(d): continue
    fs=sorted(f for f in os.listdir(d) if f.endswith('.png'))
    out=[]; prev=None
    for i,f in enumerate(fs):
        s=stats(np.array(Image.open(os.path.join(d,f)).convert('RGBA')))
        if s is None: out.append(f'{i}:빈 장'); continue
        p=[]
        if s['warm']>12: p.append(f"효과색{s['warm']}")
        if s['red']>8: p.append(f"빨강{s['red']}")
        if s['lone']>6: p.append(f"외톨이점{s['lone']}")
        if s['grey']>40: p.append(f"회색{s['grey']}")
        if s['n']<ref['n']*0.55: p.append(f"작음{s['n']}")
        if s['n']>ref['n']*1.9: p.append(f"큼{s['n']}")
        if prev and abs(s['n']-prev['n'])>ref['n']*0.35: p.append(f"면적튐{prev['n']}→{s['n']}")
        if s['x0']<2 or s['x1']>189 or s['top']<1: p.append('잘림')
        if p: out.append(f'{i}:'+','.join(p))
        prev=s
    rep[n]=out
    if out: print(n,len(fs),'|',' '.join(out))
print('ref',ref)
