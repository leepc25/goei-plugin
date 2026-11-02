"""몸 가운데 x = 바닥 위 5~45px 띠에서 두 다리 사이 가장 넓은 빈칸의 가운데(그림 가운데 기준 +-). 다리가 붙어 빈칸이 없으면 None"""
import sys, os
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit')
sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa'))
_a=sys.argv; sys.argv=_a[:1]
import fit_chair as fc, numpy as np
sys.argv=_a
def cx_crotch(k,lid):
    c,_=fc.load(k); im=fc.last(c,lid); a=np.array(im)[:,:,3]>40; H,W=a.shape; base=H-4; best=None
    for y in range(base-45,base-5):
        xs=np.where(a[y])[0]
        gaps=[(xs[i+1]-xs[i],(xs[i]+xs[i+1])/2) for i in range(len(xs)-1) if xs[i+1]-xs[i]>2]
        if gaps:
            g=max(gaps)
            if best is None or g[0]>best[0]: best=g
    return (best[1]-W/2) if best else None

def cx_head(k,lid,rows=(6,30)):
    """머리 가운데 x: 그림 맨 위에서 6~30px 줄마다 왼끝·오른끝 가운데의 중앙값(그림 가운데 기준)"""
    c,_=fc.load(k); im=fc.last(c,lid); a=np.array(im)[:,:,3]>40; H,W=a.shape
    ys=np.where(a.any(axis=1))[0]; top=ys.min(); m=[]
    for y in range(top+rows[0],top+rows[1]):
        xs=np.where(a[y])[0]
        if len(xs): m.append((xs.min()+xs.max())/2)
    return float(np.median(m))-W/2
