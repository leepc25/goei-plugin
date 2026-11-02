"""테이블 v2 상판: 윗면(0~23줄)을 남기되 옆선이 모이지 않게 전폭으로 펴고, 깊이를 D줄로 줄인다(결 유지, 줄 고르게 추림).
앞면(24~30)·기둥·받침은 그대로, 기둥을 늘려 높이 98 유지. 사용: python3 table_v2_persp.py <D> <out.png>"""
import sys
import numpy as np
from PIL import Image
D=int(sys.argv[1]); OUT=sys.argv[2]
a=np.array(Image.open('/home/user/goei-plugin/game-src/art/objects/table_v2_crop.png').convert('RGBA'))
W=a.shape[1]
def full(row):
    xs=np.where(row[:,3]>0)[0]; l,r=xs.min(),xs.max()
    inner=row[l+1:r]; idx=np.round(np.linspace(0,len(inner)-1,W-2)).astype(int)
    out=np.zeros_like(row); out[0]=row[l]; out[W-1]=row[r]; out[1:W-1]=inner[idx]; return out
pick=np.round(np.linspace(0,23,D)).astype(int)
surf=np.array([full(a[y]) for y in pick])
body=np.concatenate([surf,a[24:]],0)
top_h=D+7; col=body[top_h+10:top_h+11]; extra=98-body.shape[0]
out=np.concatenate([body[:top_h+10],np.repeat(col,extra,0),body[top_h+10:]],0) if extra>0 else body
Image.fromarray(out).save(OUT); print(out.shape)
