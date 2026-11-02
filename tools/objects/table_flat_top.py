"""T02 테이블 윗판을 배경 각도(싱크대 윗면처럼 거의 옆에서 본 띠)에 맞춘다: 사다리꼴 → 직사각, 윗면 깊이 N줄.
사용: python3 table_flat_top.py <윗면줄수> <out.png>
원본 table_t02_w142_f100.png: 0줄 윤곽, 1~27 윗면(위로 갈수록 좁아짐), 28~34 앞 모서리, 35~ 기둥."""
import sys
import numpy as np
from PIL import Image
N=int(sys.argv[1]); OUT=sys.argv[2]
a=np.array(Image.open('/home/user/goei-plugin/game-src/art/objects/table_t02_w142_f100.png').convert('RGBA'))
W=a.shape[1]
outline=a[0,15].copy()
top=np.zeros((1,W,4),np.uint8); top[0]=outline; top[0,0,3]=0; top[0,W-1,3]=0   # 모서리 둥글게
# 윗면: 원래 1~27줄을 N줄로 줄여 씀(가운데 결은 그대로), 각 줄은 26줄(전폭)의 양끝 윤곽을 붙여 전폭
src=a[1:28]
idx=np.round(np.linspace(0,len(src)-1,N)).astype(int)
rows=[]
for i in idx:
    r=a[26].copy()                       # 전폭 줄(양끝 윤곽 포함)
    xs=np.where(src[i,:,3]>0)[0]; l,rr=xs.min(),xs.max()
    # 윤곽 바로 안쪽 색은 이 줄 가운데 결을 가로로 늘려 채움
    mid=src[i,l+2:rr-1]
    stretch=np.round(np.linspace(0,len(mid)-1,W-4)).astype(int)
    r[2:W-2]=mid[stretch]
    rows.append(r)
out=np.concatenate([top,np.array(rows),a[28:]],0)
Image.fromarray(out).save(OUT); print(out.shape)
