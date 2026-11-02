"""사무의자 후면 맞춤 후보(11-02): 후면 앉기 끝 장(61)에서
 - 엉덩이 밑 y = 뒤에서 본 두 다리 사이 빈칸의 위 끝(가랑이)
 - 등 가운데 x = 등 띠(그림 높이 30~45%) 줄마다 몸통 덩어리 가운데의 중앙값
후보일 뿐, 손 확인(office_pick_grid.py MARK)으로 고친 뒤 office_fit_all.py pick back 에 넣음.
  python3 tools/objects/office_back_measure.py [키..]  → 키 x:y
"""
import sys, os, json
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
A=sys.argv[1:]; sys.argv=sys.argv[:1]
os.environ['CHAIR_DIR']=str(ROOT/'game-src/action/objects/C01_사무의자_1배')
sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa'))
import fit_chair as fc, numpy as np
def spine(a,bb):
    top,bot=bb[1],bb[3]; h=bot-top; mid=(bb[0]+bb[2])/2; xs=[]
    for y in range(top+int(h*.30),top+int(h*.45)):
        r=a[y]; c=int(round(mid))
        if not r[c]:
            on=np.where(r)[0]
            if not len(on): continue
            c=on[np.argmin(abs(on-mid))]
        l=c; 
        while l>0 and r[l-1]: l-=1
        rr=c
        while rr<len(r)-1 and r[rr+1]: rr+=1
        xs.append((l+rr)/2)
    return float(np.median(xs)) if xs else mid
def crotch(a,bb,cx):
    bot=min(a.shape[0]-4,bb[3]); best=None
    for x in range(int(cx)-8,int(cx)+9):
        col=a[:,x]; y=bot
        if col[y-1]: continue
        while y>0 and not col[y-1]: y-=1
        if bot-y<20: continue
        if best is None or y<best: best=y
    return best
def meas(k):
    c,_=fc.load(k); im=fc.last(c,'61'); a=np.array(im)[:,:,3]>40; bb=im.getbbox()
    x=spine(a,bb); return x, crotch(a,bb,x)
if __name__=='__main__':
    J=json.loads((ROOT/'game-src/art/objects/chairs_office/fit_all.json').read_text())
    for k in (A or [k for k in J if k!='5.2_브라우니']):
        x,y=meas(k); print(f'{k}:{x:g}:{y}')
