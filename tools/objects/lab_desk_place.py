"""격리팀 실험책상 2개를 실험실 p20 뒷벽 가까이 배치한 미리보기 (사용자 11-02 09:36)."""
import os
from PIL import Image
import numpy as np
D='game-src/action/objects/'
FOOT=int(os.environ.get('FOOT',332))   # 발끝 y(1배). 벽 밑선 ≈299
XS=[int(v) for v in os.environ.get('XS','665,880').split(',')]  # 캔버스 왼쪽 x
bg=Image.open('game-src/art/pixellab-hq-20261031/hq_b2_lab_p20_1703x424.png').convert('RGBA')
for x,p in zip(XS,['L01v4_고그니쟈_실험책상','L02v2_데쥬레_실험책상']):
    im=Image.open(D+p+'/unknown.png').convert('RGBA'); a=np.array(im)[:,:,3]>0
    f=np.where(a.any(1))[0][-1]; bg.alpha_composite(im,(x,FOOT-f))
bg.save('/tmp/lab_place.png')
bg.crop((560,100,1240,424)).resize((1360,648),Image.NEAREST).save(os.environ.get('OUT','/mnt/project-files/hq-b2/lab_desks_place_v1_x2.png'))
