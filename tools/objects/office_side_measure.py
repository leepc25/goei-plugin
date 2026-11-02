"""사무의자 옆(96) 엉덩이 뒤·밑 점 후보(11-02): 몸 덩어리 아래쪽 윤곽에서 찾음 → 확대 그림에 찍어 눈으로 확인·고침.
  엉덩이 뒤 x = 좌판 높이 띠(가장 오른쪽으로 뻗은 허벅지 줄 ±4)에서 몸 왼쪽 끝, 밑 y = 그 x+6 열의 허벅지 줄 아래 첫 빈칸 위."""
import sys, os
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa'))
os.environ.setdefault('CHAIR_DIR',str(ROOT/'game-src/action/objects/C01_사무의자_1배'))
import fit_chair as fc, numpy as np
def side_pts(k):
    c,_=fc.load(k); im=fc.last(c,'96'); a=np.array(im)[:,:,3]>40; H,W=a.shape
    rows=[y for y in range(150,200) if a[y].any()]
    # 허벅지 줄: 무릎 쪽(오른쪽)으로 가장 멀리 뻗은 줄
    ky=max(rows,key=lambda y:(np.where(a[y])[0].max(), -y))
    hb=int(np.median([np.where(a[y])[0].min() for y in range(ky-4,ky+5) if a[y].any()]))
    x=hb+6; y=ky
    while y<H-1 and a[y+1,x]: y+=1
    return hb, y
if __name__=='__main__':
    for k in sys.argv[1:]: print(k, side_pts(k))
