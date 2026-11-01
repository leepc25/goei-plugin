"""테이블 v1(table_v1_crop.png 174×169, 256 캔버스 원본) 상판 손질: 윗면 1~16줄(옆선 모임)을 전폭으로 펴고 깊이 D줄로,
앞면 17~25줄·기둥·받침 그대로. 축소 없음. 사용: python3 table_v1_persp.py <D> <out.png>"""
import sys
import numpy as np
from PIL import Image
D=int(sys.argv[1]); OUT=sys.argv[2]
a=np.array(Image.open('/home/user/goei-plugin/game-src/art/objects/table_v1_crop.png').convert('RGBA'))
W=a.shape[1]
# 앞면 줄 중 가장 넓은 줄(15~16, 163px)을 상판 폭으로 삼고, 전부 그 폭에 맞춤
xs=np.where(a[15,:,3]>0)[0]; L,R=xs.min(),xs.max(); TW=R-L+1
def full(row):
    x=np.where(row[:,3]>0)[0]; l,r=x.min(),x.max()
    inner=row[l+1:r]; idx=np.round(np.linspace(0,len(inner)-1,TW-2)).astype(int)
    out=np.zeros_like(row); out[L]=row[l]; out[R]=row[r]; out[L+1:R]=inner[idx]; return out
pick=np.round(np.linspace(0,16,D)).astype(int)
surf=np.array([full(a[y]) for y in pick])
front=np.array([full(a[y]) for y in range(17,26)])     # 앞면도 전폭 평행
out=np.concatenate([surf,front,a[26:]],0)
Image.fromarray(out).save(OUT); print(out.shape, 'top width',TW)
