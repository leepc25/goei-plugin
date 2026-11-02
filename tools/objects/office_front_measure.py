"""사무의자 정면 맞춤 잰 값(11-02): 정면 앉기 끝 장에서 사타구니(두 다리 사이 빈칸의 위 끝) 줄·열을 재서
그 점이 의자 좌석 윗면 가운데(SEATPT)에 오게 하는 dx,dy 를 냄. 다리 붙임·치마로 빈칸이 없으면 None(눈으로 맞춤).
  python3 tools/objects/office_front_measure.py [키..]   → 키 잰사타구니(x,y) 지금값 → 계산값
"""
import sys, os, json, importlib.util
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
A=sys.argv[1:]; sys.argv=sys.argv[:1]
os.environ['CHAIR_DIR']=str(ROOT/'game-src/action/objects/C01_사무의자_1배')
sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa'))
import fit_chair as fc, numpy as np
SEATPT={'south':(92,101),'south-east':(98,100),'south-west':(86,100)}
def crotch(im):
    a=np.array(im)[:,:,3]>40; H,W=a.shape; bb=im.getbbox(); bot=min(H-4,bb[3])
    x0,x1=bb[0],bb[2]; mid=(x0+x1)//2; best=None
    for x in range(mid-14,mid+15):
        col=a[:,x]; y=bot
        if col[y-1] : continue                       # 바닥에서 바로 막힘(발) → 다리 사이 아님
        while y>0 and not col[y-1]: y-=1
        if bot-y<25: continue
        if best is None or y<best[0]: best=(y,x)
    return best, bot, W
def calc(k, img):
    c,_=fc.load(k); im=fc.last(c,'60'); b,bot,W=crotch(im)
    if not b: return None
    sx,sy=SEATPT[img]; y,x=b
    return {'dx':round(100-sx-W/2+x),'dy':round(171-sy-bot+y),'cx':x,'cy':y}
if __name__=='__main__':
    J=json.loads((ROOT/'game-src/art/objects/chairs_office/fit_all.json').read_text())
    for k in (A or list(J)):
        p=J[k]['front']; print(k,p['img'],p['dx'],p['dy'],'->',calc(k,p['img']))
