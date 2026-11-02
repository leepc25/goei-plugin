"""격리팀 실험책상 2개를 실험실 p20 뒷벽 가까이 배치한 미리보기 (사용자 11-02 09:36, 09:37 벽에서 뗌).
그림자 = 사무실 책상과 같은 방식(타원 마스크 흐림, 1배 격자). SHADOW=0이면 그림자 끔."""
import os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
D='game-src/action/objects/'
FOOT=int(os.environ.get('FOOT',332))   # 발끝 y(1배). 벽 밑선 ≈299
FOOTS=[int(v) for v in os.environ.get('FOOTS',f'{FOOT},{FOOT},{FOOT-12}').split(',')]  # 거치대는 책상보다 벽 쪽(사용자 10:36)
XS=[int(v) for v in os.environ.get('XS','665,938,312').split(',')]  # 캔버스 왼쪽 x
SHC,SHA,SD=(20,26,38),120,14           # 사무실 책상 그림자 값 그대로
bg=Image.open('game-src/art/pixellab-hq-20261031/hq_b2_lab_p20_1703x424.png').convert('RGBA')
items=[]
for x,ft,p in zip(XS,FOOTS,['L01v4_고그니쟈_실험책상','L02v2_데쥬레_실험책상','L04v2_장비정비_거치대']):
    im=Image.open(D+p+'/unknown.png').convert('RGBA'); a=np.array(im)[:,:,3]>0
    f=np.where(a.any(1))[0][-1]; items.append((im,x,ft-f))
if os.environ.get('SHADOW','1')=='1':
    for im,x,y in items:
        m=Image.new('L',bg.size,0); bb=im.getbbox(); fy,l,r=y+bb[3],x+bb[0],x+bb[2]
        ImageDraw.Draw(m).ellipse([l-4,fy-SD,r+4,fy+4],fill=SHA)
        m=m.filter(ImageFilter.GaussianBlur(3)); lay=Image.new('RGBA',bg.size,SHC+(0,)); lay.putalpha(m); bg.alpha_composite(lay)
for im,x,y in items: bg.alpha_composite(im,(x,y))
bg.save('/tmp/lab_place.png')
bg.crop((340,100,1240,424)).resize((1800,648),Image.NEAREST).save(os.environ.get('OUT','/mnt/project-files/hq-b2/lab_desks_place_v3_shadow_x2.png'))
