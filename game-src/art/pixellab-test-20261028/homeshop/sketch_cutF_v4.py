"""망상홈쇼핑 컷 F v4 방청석 — 11-10 19:46 사용자 「무대는 좁고 방청객 위는 텅 비었다」.
v3 대비: 계단식 좌석을 화면 위까지 올림(7줄, 뒤로 갈수록 작고 높음), 무대 바닥을 아래 1/3로 넓힘.
출입문·표지등은 맨 뒷줄 위 뒷벽 왼쪽에 작게(표지등은 문 오른쪽 옆). 동작 구획 256 칸 3개(x 0·168·336, y 30~285)."""
from PIL import Image, ImageDraw
import math
W,H=592,444; C='black'; F='white'; VX=296
SC=[0.34,0.42,0.52,0.64,0.78,0.95,1.15]   # 뒤→앞 배율
FRONT=284; TAPE=298
def ys():
    y=[FRONT]
    for s in reversed(SC[1:]): y.insert(0,y[0]-52*s)
    return y
def base(full):
    im=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(im)
    Y=ys(); top=Y[0]-40*SC[0]
    d.line([0,top-4,W,top-4],fill=C,width=2)                                    # 뒷벽 밑선
    d.rectangle([60,top-34,96,top-5],fill=F,outline=C,width=3); d.line([78,top-34,78,top-5],fill=C,width=2)  # 출입문(뒷벽 왼쪽)
    d.rectangle([102,top-32,132,top-24],fill=F,outline=C,width=2)               # 출입 표지등
    d.rectangle([262,4,330,22],fill=F,outline=C,width=3)                        # 큐 표지등
    for s,yb in zip(SC,Y):
        n=math.ceil(W/(58*s))+2; span=n*58*s; x0=VX-span/2
        d.rectangle([x0,yb,x0+span,yb+14*s],fill=F,outline=C,width=2)          # 단 앞면
        for k in range(n):
            x=x0+k*58*s+6*s; bw=46*s
            d.rectangle([x,yb-40*s,x+bw,yb-10*s],fill=F,outline=C,width=2)
            d.rectangle([x-2*s,yb-10*s,x+bw+2*s,yb],fill=F,outline=C,width=2)
            if full:
                cx=x+bw/2; r=10*s
                d.ellipse([cx-r,yb-58*s,cx+r,yb-36*s],fill=F,outline=C,width=2)
                d.polygon([(cx-18*s,yb-2*s),(cx-16*s,yb-32*s),(cx-6*s,yb-36*s),(cx+6*s,yb-36*s),(cx+16*s,yb-32*s),(cx+18*s,yb-2*s)],fill=F,outline=C,width=2)
                if (k*7+int(s*10))%3==0: d.rectangle([cx+10*s,yb-74*s,cx+28*s,yb-56*s],fill=F,outline=C,width=2)
    for x in range(0,W,24): d.polygon([(x,TAPE),(x+12,TAPE),(x+6,TAPE+8),(x-6,TAPE+8)],fill=C)
    d.line([0,TAPE-1,W,TAPE-1],fill=C,width=2); d.line([0,TAPE+9,W,TAPE+9],fill=C,width=2)
    d.line([396,370,450,408],fill=C,width=4); d.line([450,370,396,408],fill=C,width=4)   # X 표시
    return im,Y,top
e,Y,top=base(False); f,_,_=base(True)
print('rows',[round(y) for y in Y],'top',round(top))
e.save('cutF/cutF_v4_empty_layout.png'); f.save('cutF/cutF_v4_full_layout.png')
Pp='/mnt/project-files/망상홈쇼핑_1109/'
for im,name in ((e,'컷F_v4_빈방청석_원근_구도선_2배.png'),(f,'컷F_v4_꽉찬방청석_원근_구도선_2배.png')):
    ck=im.convert('RGBA'); dd=ImageDraw.Draw(ck)
    for x0,col in ((0,(220,0,0,255)),(168,(0,120,220,255)),(336,(0,160,0,255))): dd.rectangle([x0,30,x0+255,285],outline=col,width=2)
    ck.resize((W*2,H*2),Image.NEAREST).save(Pp+name)
