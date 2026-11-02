"""테이블 v2(table_v2_crop.png, 102×98) 상판을 얇은 띠로: 위로 좁아지는 0~22줄을 버리고
윤곽 1줄 + 윗면 N줄(원본 20~23줄을 전폭으로 늘림) + 앞면 24~30줄 + 기둥·받침 그대로.
사용: python3 table_v2_flatten.py <N> <out.png>"""
import sys
import numpy as np
from PIL import Image
N=int(sys.argv[1]); OUT=sys.argv[2]
a=np.array(Image.open('/home/user/goei-plugin/game-src/art/objects/table_v2_crop.png').convert('RGBA'))
W=a.shape[1]
def full(row):
    xs=np.where(row[:,3]>0)[0]; l,r=xs.min(),xs.max()
    inner=row[l+1:r]                               # 윤곽 안쪽
    idx=np.round(np.linspace(0,len(inner)-1,W-2)).astype(int)
    out=np.zeros_like(row); out[0]=row[l]; out[W-1]=row[r]; out[1:W-1]=inner[idx]; return out
outline=np.zeros((1,W,4),np.uint8); outline[0,:]=a[24,0]; outline[0,:,3]=255   # 검은 윤곽 전폭
src=[20,21,22,23]; pick=np.round(np.linspace(0,3,N)).astype(int)
surf=np.array([full(a[src[i]]) for i in pick])
out=np.concatenate([outline,surf,a[24:]],0)
Image.fromarray(out).save(OUT); print(out.shape)
