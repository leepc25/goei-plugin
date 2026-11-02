"""고그니쟈 실험책상 v3 몸통 가운데 띠를 복제해 높이를 데쥬레 v2에 맞춘다 (사용자 11-02 09:33 지시)."""
from PIL import Image
import numpy as np
D='game-src/action/objects/'
src=np.array(Image.open(D+'L01v3_고그니쟈_실험책상/unknown.png').convert('RGBA'))
B0,N=134,8  # 몸통 가운데 띠 시작줄, 늘릴 줄 수 (몸통 58 -> 66 = 데쥬레)
band=src[B0:B0+N]
out=np.concatenate([src[:B0+N],band,src[B0+N:]],0)  # 아래로 N줄 늘어남
canvas=np.zeros_like(src); canvas[:]=out[N:N+256] if False else 0
# 다리 끝을 같은 자리로 두려고 위로 N줄 밀어 256에 맞춤
canvas=out[N:N+256]
import os
o=D+'L01v4_고그니쟈_실험책상'; os.makedirs(o,exist_ok=True)
Image.fromarray(canvas).save(o+'/unknown.png')
# 미리보기: 실험실 p20 위
bg=Image.open('game-src/art/pixellab-hq-20261031/hq_b2_lab_p20_1703x424.png').convert('RGBA').crop((620,160,1180,424))
L=Image.fromarray(canvas); R=Image.open(D+'L02v2_데쥬레_실험책상/unknown.png').convert('RGBA')
def foot(im):
    a=np.array(im)[:,:,3]>0; return np.where(a.any(1))[0][-1]
bg.alpha_composite(L,(45,218-foot(L))); bg.alpha_composite(R,(260,218-foot(R)))
bg.resize((1120,528),Image.NEAREST).save('/mnt/project-files/hq-b2/lab_desks_v4_x2.png')
for im,n in ((L,'L01v4'),(R,'L02v2')):
    a=np.array(im)[:,:,3]>0; ys=np.where(a.any(1))[0]; print(n,'top',ys[0],'foot',ys[-1])
