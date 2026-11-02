# 의무실 p6 눕히기 시험: merge-1101 에일린 76(누워 쉬기) 첫 칸, 좌우 뒤집어 머리 = 베개 쪽.
# 원근: 침대마다 따로 배율(침대 길이 비례). 인자: 출력폴더 스프라이트 [k rx by]*2
from PIL import Image, ImageOps
import sys
S=sys.argv[1]; sp0=Image.open(sys.argv[2]).convert('RGBA').crop((14,130,245,188))
sp0=ImageOps.mirror(sp0)
bg=Image.open('game-src/art/pixellab-hq-20261031/hq_b2_infirmary_p6_632x424.png').convert('RGBA')
a=sys.argv[3:]
for i in range(0,len(a),3):
    k,rx,by=float(a[i]),int(a[i+1]),int(a[i+2])
    sp=sp0.resize((round(sp0.width*k),round(sp0.height*k)),Image.NEAREST)
    bg.alpha_composite(sp,(rx-sp.width,by-sp.height)); print(k,sp.size)
bg.resize((1264,848),Image.NEAREST).save(S+'/lie_x2.png')
bg.crop((390,200,632,360)).resize((968,640),Image.NEAREST).save(S+'/lie_x4.png')
