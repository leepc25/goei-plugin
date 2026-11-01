"""옆 맞춤 잰 값: 등-등받이 틈(gap), 엉덩이 밑-좌판 윗면(sit). 쟈알디 값과 비교용."""
import sys, json, os
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit')
A=sys.argv[1:]; sys.argv=sys.argv[:1]
sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa'))
import fit_chair as fc, numpy as np
from PIL import Image
J=json.loads((ROOT/'game-src/art/objects/chairs_shell/fit_all.json').read_text())
CH={}
def chair(n):
    if n not in CH: CH[n]=np.array(Image.open(fc.chair_png(n)).convert('RGBA'))[:,:,3]>40
    return CH[n]
def side(k,dx,dy):
    c,_=fc.load(k); im=fc.last(c,'96'); P=np.array(im)[:,:,3]>40; Hh,Ww=P.shape
    W,H=190,280; base=H-15; ox,oy=W//2-Ww//2, base-(Hh-4); cx,cy=round(W/2+dx-100),round(base+dy-171)
    C=chair('east'); gaps=[]
    for r in range(70,95):
        y=cy+r; py=y-oy
        if not(0<=py<Hh): continue
        xs=np.where(P[py])[0]; cr=np.where(C[r])[0]
        if len(xs) and len(cr): gaps.append((xs.min()+ox)-(cr.max()+cx))
    # 엉덩이: 좌판 뒤쪽 열(의자 x 72~95)에서 사람 가장 낮은 점 vs 좌판 윗면(열마다 의자 가장 높은 점, r>=95)
    sits=[]
    for xc in range(72,96):
        X=cx+xc; px=X-ox
        if not(0<=px<Ww): continue
        ys=np.where(P[:,px])[0]; cs=[r for r in np.where(C[:,xc])[0] if r>=95]
        if len(ys) and cs: sits.append((min(cs)+cy)-(ys.max()+oy))
    return (min(gaps) if gaps else None), (min(sits) if sits else None)
if __name__=='__main__':
    ks=A if A else list(J)
    for k in ks:
        p=J[k]['side']; print(k, p['dx'],p['dy'], side(k,p['dx'],p['dy']))

def thigh(k,dx,dy,cols=range(100,116)):
    """좌판 앞쪽 열에서 좌판 윗면 - 그 위 사람 허벅지 밑(좌판 윗면 위 30px 안에서 사람 마지막 칸)"""
    c,_=fc.load(k); im=fc.last(c,'96'); P=np.array(im)[:,:,3]>40; Hh,Ww=P.shape
    W,H=190,280; base=H-15; ox,oy=W//2-Ww//2, base-(Hh-4); cx,cy=round(W/2+dx-100),round(base+dy-171)
    C=chair('east'); r=[]
    for xc in cols:
        cs=[q for q in np.where(C[:,xc])[0] if q>=95]
        if not cs: continue
        st=min(cs)+cy; px=cx+xc-ox
        if not(0<=px<Ww): continue
        col=P[:,px]; y=st-oy
        # 좌판 윗면에서 위로 올라가며 사람이 시작되는 곳
        g=0
        while 0<=y-g<Hh and not col[y-g] and g<40: g+=1
        r.append(g)
    return int(np.median(r)) if r else None

def depth(k,dx,dy,cols=range(80,116)):
    """좌판(의자 95~125줄) 윗면부터 사람이 덮은 깊이(열 중앙값). 쟈알디 = 6"""
    c,_=fc.load(k); im=fc.last(c,'96'); P=np.array(im)[:,:,3]>40; Hh,Ww=P.shape
    W,H=190,280; base=H-15; ox,oy=W//2-Ww//2, base-(Hh-4); cx,cy=round(W/2+dx-100),round(base+dy-171)
    C=chair('east'); r=[]
    for xc in cols:
        cs=[q for q in np.where(C[:,xc])[0] if 95<=q<=125]
        if not cs: continue
        st=min(cs); px=cx+xc-ox
        if not(0<=px<Ww): continue
        d=0
        while st+d<=max(cs) and 0<=st+d+cy-oy<Hh and P[st+d+cy-oy,px]: d+=1
        r.append(d)
    return int(np.median(r)) if r else None
