# 의무실 p6 눕히기 시험: merge-1101 motion3 76(누워 쉬기) 첫 칸, 좌우 뒤집어 머리 = 베개 쪽.
# 원근(사용자 11-02 11:09): 가장 큰 남자 기준으로 장면 배율을 정하고 모든 캐릭터에 같은 배율. 앞 침대는 침대 길이 비율만큼만 키움.
# 인자: 출력폴더 [스프라이트 k rx by]...
from PIL import Image, ImageOps
import numpy as np, sys
S=sys.argv[1]; a=sys.argv[2:]
bg=Image.open('game-src/art/pixellab-hq-20261031/hq_b2_infirmary_p6_632x424.png').convert('RGBA')
for i in range(0,len(a),4):
    sp=Image.open(a[i]).convert('RGBA'); al=np.array(sp)[:,:,3]>0; ys,xs=np.where(al)
    sp=ImageOps.mirror(sp.crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1)))
    k,rx,by=float(a[i+1]),int(a[i+2]),int(a[i+3])
    sp=sp.resize((round(sp.width*k),round(sp.height*k)),Image.NEAREST)
    bg.alpha_composite(sp,(rx-sp.width,by-sp.height)); print(a[i].split('/')[-1],k,sp.size)
bg.resize((1264,848),Image.NEAREST).save(S+'/lie_x2.png')
bg.crop((390,200,632,360)).resize((968,640),Image.NEAREST).save(S+'/lie_x4.png')
