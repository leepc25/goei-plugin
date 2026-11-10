"""망상홈쇼핑 컷 F v3 방청석 — 원근 넣음(11-10 19:38 사용자 「너무 평면, 원근감 없이?」).
소실점 위쪽 한 점 원근. 앞줄이 크고 뒤로 갈수록 작아짐, 좌석 줄은 화면 양끝 밖까지 이어짐(빈 삼각형 없음), 출입문은 맨 뒤 왼쪽 위, 단마다 계단 앞면이 보임.
같은 줄 안의 의자는 같은 크기 → 사람 옮겨 앉히기는 같은 줄 안에서만. 동작 구획 256 칸 3개(x 0·168·336, y 50~305)."""
from PIL import Image, ImageDraw
W,H=592,444; C='black'; F='white'; VX,VY=296,-40
def P(x,y,s): return (VX+(x-VX)*s, VY+(y-VY)*s)
def base(full):
    im=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(im)
    # 양옆 벽선(소실점으로)
    d.rectangle([254,4,338,26],fill=F,outline=C,width=3)                         # 큐 표지등
    # 왼쪽 벽 출입문(벽면 따라 기울어짐)
    d.rectangle([40,56,96,118],fill=F,outline=C,width=3); d.line([68,56,68,118],fill=C,width=2)   # 맨 뒤 왼쪽 출입문(객석 위)
    d.rectangle([44,38,92,52],fill=F,outline=C,width=3)                          # 출입 표지등
    rows=[(0.56,18),(0.68,15),(0.82,13),(1.0,11)]  # 화면 밖까지 이어짐                                     # 뒤→앞 (배율, 자리 수)
    ybase=330
    for i,(s,n) in enumerate(rows):
        sw=58*s; seatw=46*s; y=ybase-(len(rows)-1-i)*0  # 아래에서 계산
    ys=[150,190,236,290]                                                         # 줄마다 좌석 바닥선(뒤→앞)
    for (s,n),yb in zip(rows,ys):
        span=n*58*s; x0=VX-span/2
        d.rectangle([x0-10*s,yb,x0+span+10*s,yb+14*s],fill=F,outline=C,width=2)  # 단 앞면
        for k in range(n):
            x=x0+k*58*s+6*s; bw=46*s
            d.rectangle([x,yb-40*s,x+bw,yb-10*s],fill=F,outline=C,width=2)       # 등받이
            d.rectangle([x-2*s,yb-10*s,x+bw+2*s,yb],fill=F,outline=C,width=2)    # 앉는 면
            if full:
                cx=x+bw/2; r=10*s
                d.ellipse([cx-r,yb-58*s,cx+r,yb-36*s],fill=F,outline=C,width=2)
                d.polygon([(cx-18*s,yb-2*s),(cx-16*s,yb-32*s),(cx-6*s,yb-36*s),(cx+6*s,yb-36*s),(cx+16*s,yb-32*s),(cx+18*s,yb-2*s)],fill=F,outline=C,width=2)
                if (k*7+int(s*10))%3==0: d.rectangle([cx+10*s,yb-74*s,cx+28*s,yb-56*s],fill=F,outline=C,width=2)
    for x in range(0,W,24): d.polygon([(x,330),(x+12,330),(x+6,338),(x-6,338)],fill=C)
    d.line([0,329,W,329],fill=C,width=2); d.line([0,339,W,339],fill=C,width=2)
    d.line([400,382,446,414],fill=C,width=4); d.line([446,382,400,414],fill=C,width=4)
    return im
e=base(False); e.save('cutF/cutF_v3_empty_layout.png'); f=base(True); f.save('cutF/cutF_v3_full_layout.png')
Pp='/mnt/project-files/망상홈쇼핑_1109/'
for im,name in ((e,'컷F_v3_빈방청석_원근_구도선_2배.png'),(f,'컷F_v3_꽉찬방청석_원근_구도선_2배.png')):
    ck=im.convert('RGBA'); dd=ImageDraw.Draw(ck)
    for x0,col in ((0,(220,0,0,255)),(168,(0,120,220,255)),(336,(0,160,0,255))): dd.rectangle([x0,50,x0+255,305],outline=col,width=2)
    ck.resize((W*2,H*2),Image.NEAREST).save(Pp+name)
print('ok')
