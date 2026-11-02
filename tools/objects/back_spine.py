"""후면(61) 등 중앙선 후보: 어깨가 넓어지는 줄부터 아래 18줄의 몸 바깥선 가운데(중앙값). 후보일 뿐 — 확대 그림에서 사람이 눈으로 보고 고친다."""
import sys, os, json
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit')
sys.argv=sys.argv[:1]; sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa'))
import fit_chair as fc, numpy as np
def spine(k, lid='61', n=18):
    c,_=fc.load(k); im=fc.last(c,lid); a=np.array(im)[:,:,3]>40; H,W=a.shape
    ys=np.where(a.any(axis=1))[0]; top=ys.min()
    wd=lambda y:(np.where(a[y])[0].max()-np.where(a[y])[0].min()) if a[y].any() else 0
    hw=np.median([wd(y) for y in range(top+8,top+20)])
    sh=next(y for y in range(top+15,H) if wd(y)>1.5*hw)
    m=[(np.where(a[y])[0].min()+np.where(a[y])[0].max())/2 for y in range(sh+2,sh+2+n) if a[y].any()]
    return float(np.median(m))-W/2, sh
