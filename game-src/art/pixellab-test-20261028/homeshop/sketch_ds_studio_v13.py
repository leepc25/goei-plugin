"""망상홈쇼핑 장면 구도 선 v13 592×444(11-09, 가 안). 진행자 보이는 부분 전체를 동작 칸 60~316×40~296(256) 안에 최대한 크게.
자세: 4분의 3으로 상품 쪽(오른쪽)으로 돌고 몸을 내밂, 오른손을 펴서 상품 쪽으로 뻗음, 왼손은 가슴 앞 핸드 마이크. 어른 비율(머리 52×70).
칸 아래 몸은 앞 진열대가 가림: 살짝 사선(왼쪽 낮고 오른쪽 높음), 앞면에 전구 줄·조명 타일(꺼짐, 코드로 켬). 진열대 위 오른쪽에 회전 받침(상품 85 자리).
뒤는 단순: 세트 판, 진행자 뒤 전구 아치(꺼짐), 위 스포트라이트 3(꺼짐). 큰 화면·전광판·채팅은 코드 방송 그래픽으로(그림에 없음)."""
from PIL import Image, ImageDraw
import math
W,H=592,444; im=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(im); C='black'; w=3
bulb=lambda x,y: d.ellipse([x-3,y-3,x+3,y+3],outline=C,width=2)
# 뒤: 세트 판 이음(소실점 (420,160)으로 살짝)
for x in (40,360,470,560): d.line([x,0,x+(420-x)*0.05,330],fill=C,width=1)
# 스포트라이트 3(꺼짐)
for x in (380,470,550): d.rectangle([x-10,4,x+10,26],outline=C,width=w)
d.line([340,26,592,26],fill=C,width=w)
# 진행자 뒤 전구 아치(꺼짐)
d.arc([70,20,330,280],195,345,fill=C,width=2)
for a in range(197,345,10):
    r=math.radians(a); bulb(200+122*math.cos(r),150+122*math.sin(r))
# 진행자
F='white'
d.polygon([(64,310),(84,170),(150,140),(196,138),(250,156),(282,190),(292,310)],fill=F,outline=C,width=w)   # 어깨·몸(오른쪽으로 틀어 오른어깨가 앞)
d.ellipse([138,44,190,114],fill=F,outline=C,width=w); d.arc([132,36,196,92],195,345,fill=C,width=w)      # 머리(약간 오른쪽을 봄)
d.ellipse([150,70,160,78],outline=C,width=2); d.ellipse([170,70,180,78],outline=C,width=2); d.line([160,98,178,96],fill=C,width=w)
d.line([156,112,160,140],fill=C,width=w); d.line([180,110,184,138],fill=C,width=w)
d.line([160,140,172,226,184,138],fill=C,width=w)                                             # 넥타이
d.polygon([(250,170),(300,212),(306,232),(268,214)],fill=F,outline=C,width=w)                 # 뻗은 팔
d.polygon([(296,206),(316,204),(316,226),(304,236),(296,228)],fill=F,outline=C,width=w)       # 편 손
d.ellipse([110,214,140,244],fill=F,outline=C,width=w); d.line([126,214,140,186],fill=C,width=5); d.ellipse([134,172,152,190],outline=C,width=w)   # 마이크
# 앞 진열대(살짝 사선), 앞면 전구 줄·조명 타일
top=lambda x: 296-20*x/W   # 왼쪽 끝이 칸 아래끝(296)과 맞음: 칸 밖 몸이 안 보이게
d.polygon([(0,top(0)),(W,top(W)),(W,H),(0,H)],fill=F,outline=C,width=w)
d.line([0,top(0)+14,W,top(W)+14],fill=C,width=2)
for x in range(10,W,18): bulb(x,top(x)+30)
for x in range(6,W,46): d.rectangle([x,top(x)+48,x+38,top(x)+86],outline=C,width=2)
# 회전 받침(진열대 위 오른쪽)
cx=450; ty=top(cx)
d.ellipse([cx-62,ty-14,cx+62,ty+6],outline=C,width=w); d.line([cx-62,ty-4,cx-62,ty+2],fill=C,width=w); d.line([cx+62,ty-4,cx+62,ty+2],fill=C,width=w)
im.save('ref_v13_1_layout.png')
ck=im.convert('RGBA'); dd=ImageDraw.Draw(ck); dd.rectangle([60,40,315,295],outline=(220,0,0,255),width=2)
ic=Image.open('/home/user/goei-plugin/game-src/items/icons/medical_001.webp').convert('RGBA'); ck.alpha_composite(ic,(cx-42,int(ty)-6-85)); ck.save('ref_v13_check.png')
print('turntable top y',ty)
