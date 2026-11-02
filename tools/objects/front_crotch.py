"""정면 앉기 끝 장의 사타구니 높이: 엉덩이 가운데 열에서 발부터 위로 올라가며 두 다리 사이 빈칸이 끝나는 곳(그림 바닥 h-4 기준 위로 몇 px)."""
import sys, os, json
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit')
sys.argv=sys.argv[:1]; sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa'))
import fit_chair as fc, chairfit2, numpy as np
from PIL import Image
def crotch(k, lid='60'):
    c,_=fc.load(k); im=fc.last(c,lid); a=np.array(im)[:,:,3]>40; H,W=a.shape
    cx,_=chairfit2.hip_center(im); base=H-4
    best=None
    for x in range(int(cx)-6,int(cx)+7):   # 가운데 둘레 열마다: 바닥에서 위로 빈칸(두 다리 사이)이 이어지는 끝 = 사타구니 밑
        col=a[:,x]; y=base
        while y>0 and not col[y]: y-=1
        if base-y<20: continue                  # 다리 사이가 거의 막힘(다리 붙임·치마) → 이 열은 못 씀
        if best is None or y<best[0]: best=(y,x)
    return (base-best[0]) if best else None, best
if __name__=='__main__':
    J=json.loads((ROOT/'game-src/art/objects/chairs_shell/fit_all.json').read_text())
    for i,k in enumerate(J): print(i,k,crotch(k)[0], J[k]['front'])
