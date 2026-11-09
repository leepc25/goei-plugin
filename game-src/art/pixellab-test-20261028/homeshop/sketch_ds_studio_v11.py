"""망상홈쇼핑 장면 구도 선 v11 592×444(11-09). 사용자 「진행자를 작게 다 그릴 필요 없다, 아나운서도 아니고」 →
진행자를 왼쪽 앞에 크게, 화면 끝에서 잘리게(어깨·가슴 아래 화면 밖). 몸은 상품 쪽으로 4분의 3 틀고, 한 손은 펴서 상품을 가리키고 다른 손은 핸드 마이크.
단상 없음. 상품 받침·세트는 진행자 뒤 오른쪽. 소실점 (430,170).
움직이는 칸: 진행자 70~326×50~306(얼굴+뻗은 손+마이크 손), 큰 화면 360~560×110~200, 채팅 모니터 568~590×100~300."""
from PIL import Image, ImageDraw
W,H=592,444; im=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(im); C='black'; w=3
VX,VY=430,170
bulb=lambda x,y: d.ellipse([x-3,y-3,x+3,y+3],outline=C,width=2)
# 뒤: 트러스·스포트라이트 6(꺼짐)
d.line([0,22,W,22],fill=C,width=w)
for x in (40,130,220,330,430,530): d.rectangle([x-9,4,x+9,22],outline=C,width=w)
# 큐 조명 둘(진행자 머리 오른쪽 위 뒤)
d.rectangle([236,36,272,58],outline=C,width=w); d.rectangle([280,36,316,58],outline=C,width=w)
# 전광판
d.rectangle([360,34,560,84],outline=C,width=w)
# 전구 아치(뒤, 진행자 머리 뒤로 일부 가려짐)
d.arc([180,70,360,250],180,360,fill=C,width=w)
import math
for a in range(185,360,12):
    r=math.radians(a); bulb(270+90*math.cos(r)*0.86,160+90*math.sin(r)*0.86)
# 큰 화면(전구 둘레)
d.rectangle([360,110,560,200],outline=C,width=w)
for x in range(356,566,16): bulb(x,102); bulb(x,208)
for y in range(118,200,16): bulb(350,y); bulb(570,y)
# 채팅 모니터(오른쪽 끝)
d.rectangle([576,96,592,300],outline=C,width=w)
# 무대 바닥선·세트 판 꺾임
d.line([180,300,592,300],fill=C,width=2); d.line([592,300,560,320],fill=C,width=1)
for x in range(200,592,50): d.line([x,300,x+(x-VX)*0.6,444],fill=C,width=1)
# 시연 테이블(오른쪽 앞, 아래 잘림)과 회전 받침
d.polygon([(340,330),(592,330),(592,316),(352,316)],outline=C,width=w); d.line([340,330,340,444],fill=C,width=w)
d.ellipse([370,304,490,324],outline=C,width=w); d.line([370,314,370,322],fill=C,width=w); d.line([490,314,490,322],fill=C,width=w)
# 상자(받침 뒤 오른쪽)
d.rectangle([512,262,566,312],outline=C,width=2); d.rectangle([522,236,556,262],outline=C,width=2)
# 진행자: 크게, 4분의 3 돌림, 얼굴 110×140
W_=255
d.rectangle([0,0,0,0],fill='white')
d.polygon([(0,250),(60,214),(120,206),(170,212),(240,236),(270,270),(282,444),(0,444)],fill='white',outline=C,width=w)   # 어깨·몸(왼쪽·아래 잘림)
d.ellipse([78,60,188,200],fill='white',outline=C,width=w)                 # 얼굴(오른쪽으로 살짝 돈)
d.arc([70,46,196,150],195,345,fill=C,width=w)                               # 머리칼
d.ellipse([112,112,130,126],outline=C,width=w); d.ellipse([146,112,164,126],outline=C,width=w)   # 눈
d.line([128,164,156,162],fill=C,width=w)                                    # 다문 입
d.line([110,196,120,214],fill=C,width=w); d.line([156,196,152,212],fill=C,width=w)   # 목
d.line([120,214,136,300,152,212],fill=C,width=w)                            # 깃·넥타이
# 뻗은 팔(오른쪽, 손바닥 펴서 상품 쪽)
d.polygon([(232,236),(300,248),(316,262),(250,276)],fill='white',outline=C,width=w)
d.polygon([(300,240),(328,236),(334,250),(322,262),(304,262)],fill='white',outline=C,width=w)    # 편 손
# 마이크 쥔 손(가슴 앞)
d.ellipse([150,268,184,300],fill='white',outline=C,width=w); d.line([168,268,186,238],fill=C,width=5); d.ellipse([180,226,198,244],outline=C,width=w)
im.save('ref_v11_1_layout.png')
ck=im.convert('RGBA'); dd=ImageDraw.Draw(ck)
for b,c in (((70,50,325,305),(220,0,0,255)),((360,110,560,200),(0,90,220,255)),((576,96,591,300),(0,160,0,255))): dd.rectangle(b,outline=c,width=2)
ic=Image.open('/home/user/goei-plugin/game-src/items/icons/medical_001.webp').convert('RGBA'); ck.alpha_composite(ic,(388,312-85)); ck.save('ref_v11_check.png')
