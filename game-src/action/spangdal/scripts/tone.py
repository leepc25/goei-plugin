# 쟈알디 톤 맞추기: 스팡달 기준 후보(edit-l744)의 정장 회색을 쟈알디 A2 정장 청회 단계로, 머리·피부 채도를 쟈알디 쪽(낮은 채도)으로 옮김.
# 새로 그린 그림의 색만 바꿈(크기·형태 그대로). 결과: ../base/S0.png(88) / S0-pad.png(192×144, 발바닥 y=136)
import colorsys
from PIL import Image
SRC='../base/edit-l744.png'
SUIT={'1e1e1f':'15191a','222222':'1a1e21','252526':'1e2225','34363a':'2e353c','444749':'3d4a53','4e4f53':'3e4d59',
      '343e50':'3f4c54','3b475f':'41515e','556b83':'56697a','768799':'6c7f8e','0a0c0e':'0c0f10','040206':'040505','070400':'040505'}
h2=lambda s:tuple(int(s[i:i+2],16) for i in (0,2,4))
def tone(c,y):
    k='%02x%02x%02x'%c
    if k in SUIT: return h2(SUIT[k])
    h,s,v=colorsys.rgb_to_hsv(*[q/255 for q in c])
    if 0.72<=h<=0.86 and s>0.3:                    # 머리: 채도 낮추고 조금 어둡게(기본 그림 #574457 쪽)
        s*=0.72; v*=0.9
    elif 0.02<=h<=0.08 and s>0.3 and v>0.55:        # 피부: 창백하게
        s*=0.55; v=min(1,v*1.02)
    elif 0.02<=h<=0.09 and y>52:                   # 스타킹: 따뜻한 갈색 → 검은 비침(채도↓)
        s*=0.55; v*=0.85
    return tuple(round(q*255) for q in colorsys.hsv_to_rgb(h,s,v))
im=Image.open(SRC).convert('RGBA'); out=im.copy()
for y in range(im.height):
    for x in range(im.width):
        p=im.getpixel((x,y))
        if p[3]: out.putpixel((x,y),tone(p[:3],y)+(255,))
out.save('../base/S0.png')
bb=out.split()[-1].getbbox(); pad=Image.new('RGBA',(192,144),(0,0,0,0))
a=Image.open('../../jyaldi-v5/full/A2-pad.png'); ab=a.split()[-1].getbbox()
cx=(ab[0]+ab[2])//2; pad.alpha_composite(out.crop(bb),(cx-(bb[2]-bb[0])//2,136-(bb[3]-bb[1])))
pad.save('../base/S0-pad.png'); print('S0 bbox',bb,'h',bb[3]-bb[1],'pad bbox',pad.split()[-1].getbbox())
