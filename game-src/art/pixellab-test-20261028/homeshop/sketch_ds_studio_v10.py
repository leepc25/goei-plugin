"""망상홈쇼핑 장면 구도 선 v10 592×444(11-09). v8 움직이는 칸 그대로 + 깊이(사용자 「스테이지가 너무 입체감 없다」).
소실점 (296,150), 카메라 눈높이보다 살짝 위(약 10도). 겹: 앞(무대 턱·단상·테이블) → 가운데(진행자·우체통) → 뒤(세트 판) → 더 뒤(벽에 들어간 큰 화면·트러스).
무대 턱 앞면(y 404~444)에 바닥 조명 줄. 움직이는 칸: 진행자 40~296×60~316, 큰 화면 350~574×128~218, 채팅 4~36×60~240."""
from PIL import Image, ImageDraw
W,H=592,444; im=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(im); C='black'; w=3
VX,VY=296,150
def to_vp(x,y,t):  # (x,y)에서 소실점 쪽으로 t만큼
    return (x+(VX-x)*t, y+(VY-y)*t)
bulb=lambda x,y: d.ellipse([x-3,y-3,x+3,y+3],outline=C,width=2)
# 트러스: 앞 막대와 뒤 막대(원근), 사이 사선
d.line([0,24,W,24],fill=C,width=w); d.line([40,40,552,40],fill=C,width=2)
for x in range(0,W,48): d.line([x,24,*to_vp(x,24,0.12)],fill=C,width=1)
for x in (60,150,240,350,450,540):
    d.rectangle([x-9,6,x+9,24],outline=C,width=w)
    if x > 300: d.line([x-6,26,x-30,110],fill=C,width=1); d.line([x+6,26,x+30,110],fill=C,width=1)
# 뒷벽 바닥선(무대 뒤 끝) y 330, 양옆은 소실점 쪽으로 꺾인 세트 판
d.line([40,330,552,330],fill=C,width=w)
d.line([0,350,40,330],fill=C,width=w); d.line([592,350,552,330],fill=C,width=w)   # 양옆 바닥 모서리
d.line([40,44,40,330],fill=C,width=2); d.line([552,44,552,330],fill=C,width=2)      # 뒷벽 양 끝 모서리(옆 판이 앞으로 꺾여 나옴)
# 세트 아치 전구
d.line([48,44,300,44],fill=C,width=w); [bulb(x,52) for x in range(56,300,16)]
d.rectangle([308,40,340,62],outline=C,width=w); d.rectangle([308,68,340,90],outline=C,width=w)   # 큐 조명
d.rectangle([350,40,574,92],outline=C,width=w)                                                   # 전광판
# 큰 화면: 벽 안으로 들어간 자리(안쪽 모서리를 소실점 쪽으로)
d.rectangle([350,128,574,218],outline=C,width=w)
for (x,y) in ((350,128),(574,128),(350,218),(574,218)): d.line([x,y,*to_vp(x,y,0.05)],fill=C,width=1)
for x in range(346,580,16): bulb(x,120); bulb(x,226)
for y in range(136,218,16): bulb(342,y); bulb(582,y)
# 채팅 모니터(트러스에 매달려 정면)
d.line([20,24,20,60],fill=C,width=2); d.rectangle([4,60,36,240],outline=C,width=w); [d.line([8,y,32,y],fill=C,width=1) for y in range(70,236,10)]
# 무대 바닥: 소실점으로 모이는 줄 + 무대 턱
d.line([0,404,W,404],fill=C,width=w)                                   # 무대 앞 모서리
for x in range(-200,W+200,60):
    t=(404-330)/(404-VY); x2=x+(VX-x)*t
    d.line([x,404,x2,330],fill=C,width=1)
for x in range(4,W,37): d.rectangle([x,412,x+29,436],outline=C,width=2)   # 턱 앞면 바닥 조명 줄
# 선물·택배 상자(왼쪽 앞 무대 위)
d.rectangle([4,262,36,296],outline=C,width=2); d.rectangle([8,240,34,262],outline=C,width=2)
# 진행자: 실제 어른 비율(사용자 11-09 「가분수·머리 크다」). 머리 50×66(꼭대기 y 70), 턱~단상 윗면 = 머리 높이 2.5배, 어깨 폭 ≈ 머리 폭 3배
d.ellipse([143,70,193,136],outline=C,width=w); d.arc([139,64,197,110],190,350,fill=C,width=w)
d.ellipse([153,94,163,104],outline=C,width=w); d.ellipse([173,94,183,104],outline=C,width=w); d.line([160,120,176,120],fill=C,width=w)
d.line([159,134,159,150],fill=C,width=w); d.line([177,134,177,150],fill=C,width=w)
d.line([84,300,92,176,159,150,177,150,244,176,252,300],fill=C,width=w); d.line([159,150,168,236,177,150],fill=C,width=w)
# 단상: 앞면 + 윗면(소실점 쪽으로) + 오른쪽 옆면
d.rectangle([50,304,250,400],fill='white',outline=C,width=w)
tl,tr=to_vp(50,304,0.08),to_vp(250,304,0.08); d.polygon([(50,304),(250,304),tr,tl],fill='white',outline=C)
br=to_vp(250,400,0.08); d.polygon([(250,304),tr,br,(250,400)],fill='white',outline=C)
d.ellipse([104,290,140,308],outline=C,width=w); d.ellipse([196,290,232,308],outline=C,width=w)
# 우체통(가운데 깊이)
d.rectangle([272,322,302,372],outline=C,width=w); d.rectangle([276,308,298,322],outline=C,width=w)
# 시연 테이블: 앞면 + 윗면 + 왼쪽 옆면
d.rectangle([360,330,580,400],fill='white',outline=C,width=w)
tl,tr=to_vp(360,330,0.12),to_vp(580,330,0.12); d.polygon([(360,330),(580,330),tr,tl],fill='white',outline=C)
bl=to_vp(360,400,0.12); d.polygon([(360,330),tl,bl,(360,400)],fill='white',outline=C)
d.ellipse([410,306,530,324],outline=C,width=w); d.line([410,315,410,322],fill=C,width=w); d.line([530,315,530,322],fill=C,width=w)   # 회전 받침
im.save('ref_v10_1_layout.png')
ck=im.convert('RGBA'); dd=ImageDraw.Draw(ck)
for b,c in (((40,60,295,315),(220,0,0,255)),((350,128,574,218),(0,90,220,255)),((4,60,36,240),(0,160,0,255))): dd.rectangle(b,outline=c,width=2)
ic=Image.open('/home/user/goei-plugin/game-src/items/icons/medical_001.webp').convert('RGBA'); ck.alpha_composite(ic,(428,314-85)); ck.save('ref_v10_check.png')
