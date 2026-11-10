"""망상홈쇼핑 컷 F v2 방청석 (11-10 19:36 사용자: 빈 방청석 → 꽉 찬 방청석 → 구획별 동작 → 한 명씩 잘라 객체).
정면 평면 구도. 계단식 좌석 4줄 × 9자리, 줄마다 같은 의자. 좌석 띠 y 60~316(256 높이) = 동작 구획 한 줄, 가로 3구획(0·168·336).
아래: 무대 바닥 + 노랑·검정 테이프 + 오른쪽 X 표시(시연자 자리, 시연자는 따로). 왼쪽 출입문+빈 표지등, 천장 빈 큐 표지등."""
from PIL import Image, ImageDraw
import sys
W,H=592,444; C='black'; w=3; F='white'
def base(full):
    im=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(im)
    d.rectangle([240,6,352,32],fill=F,outline=C,width=w)                    # 큐 표지등
    d.rectangle([10,150,62,300],fill=F,outline=C,width=w); d.line([36,150,36,300],fill=C,width=2)  # 문
    d.rectangle([14,128,58,144],fill=F,outline=C,width=w)                   # 출입 표지등
    rows=[74,134,194,254]                                                    # 줄마다 등받이 윗선
    for i,y in enumerate(rows):
        d.rectangle([72,y+44,W-4,y+60],fill=F,outline=C,width=2)            # 단(계단 앞면)
        for k in range(9):
            x=80+k*56
            d.rectangle([x,y,x+44,y+30],fill=F,outline=C,width=2)          # 등받이
            d.rectangle([x-2,y+30,x+46,y+42],fill=F,outline=C,width=2)     # 앉는 면
            if full:
                cx=x+22
                d.ellipse([cx-9,y-16,cx+9,y+4],fill=F,outline=C,width=2)   # 머리
                d.polygon([(cx-17,y+40),(cx-15,y+8),(cx-6,y+4),(cx+6,y+4),(cx+15,y+8),(cx+17,y+40)],fill=F,outline=C,width=2)  # 몸
                if (k+i)%3==0: d.rectangle([cx+10,y-28,cx+26,y-12],fill=F,outline=C,width=2); d.line([cx+16,y-12,cx+14,y+12],fill=C,width=2)  # 팻말
    for x in range(0,W,24): d.polygon([(x,330),(x+12,330),(x+6,338),(x-6,338)],fill=C)   # 테이프
    d.line([0,329,W,329],fill=C,width=2); d.line([0,339,W,339],fill=C,width=2)
    d.line([400,380,440,410],fill=C,width=4); d.line([440,380,400,410],fill=C,width=4)   # X 자리
    return im
e=base(False); e.save('cutF/cutF_v2_empty_layout.png')
f=base(True); f.save('cutF/cutF_v2_full_layout.png')
P='/mnt/project-files/망상홈쇼핑_1109/'
for im,name in ((e,'컷F_v2_빈방청석_구도선_2배.png'),(f,'컷F_v2_꽉찬방청석_구도선_2배.png')):
    ck=im.convert('RGBA'); dd=ImageDraw.Draw(ck)
    for x0,col in ((0,(220,0,0,255)),(168,(0,120,220,255)),(336,(0,160,0,255))): dd.rectangle([x0,60,x0+255,315],outline=col,width=2)
    ck.resize((W*2,H*2),Image.NEAREST).save(P+name)
print('ok')
