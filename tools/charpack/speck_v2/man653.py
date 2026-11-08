# 학생여2 돌진 공격(char-6.53/13): 바지·속도선은 두고 5번째 장 왼발 밑 회색 타원만 지움 (사용자 11-08)
# 줄마다 신발 왼쪽 윤곽(어두운 점) 또는 흰 밑창이 처음 나오는 곳 왼쪽을 지움, 211~232줄.
import os
import numpy as np
from PIL import Image
S=os.path.dirname(os.path.abspath(__file__)); F0=4*230
p=f'{S}/final/char-6.53/13.webp.png'; a=np.array(Image.open(p).convert('RGBA'))
L=a[...,:3].astype(int).mean(-1); tot=0
for y in range(211,233):
    xs=[x for x in range(F0+60,F0+100) if a[y,x,3] and (L[y,x]<=30 or L[y,x]>=180)]
    b=xs[0]; tot+=int((a[y,F0:b,3]>0).sum()); a[y,F0:b]=0
Image.fromarray(a,'RGBA').save(p); print('removed',tot)
