"""망상홈쇼핑 장면 구도 선 v12 592×444(11-09). 사용자 「구도를 다이나믹하게, 각도·시야각·카메라 각도」.
카메라: 낮은 데서 올려다봄 + 넓은 시야각(광각, 진행자에게 바짝) + 화면 9도 기울임(더치 앵글). 세 점 원근: 세로선이 위쪽 소실점으로 모임, 트러스·천장이 크게 보임.
진행자: 왼쪽 가운데, 카메라 쪽으로 상체를 내밀고 내려다보며 다문 미소. 한 손을 오른쪽 아래 상품 쪽으로 쭉 뻗어 손바닥을 폄(광각이라 손이 큼), 다른 손은 핸드 마이크.
얼굴 → 뻗은 손 → 회전 받침 위 상품으로 사선. 뒤: 전구 아치가 머리 뒤 후광처럼, 오른쪽 위 기울어진 큰 화면·전광판, 트러스·스포트라이트 6, 큐 조명 2. 단상 없음. 조명류는 꺼진 채."""
from PIL import Image, ImageDraw
import math
CW,CH=760,570; im=Image.new('RGBA',(CW,CH),(255,255,255,255)); d=ImageDraw.Draw(im); C=(0,0,0,255); w=3
host=Image.new('RGBA',(CW,CH),(0,0,0,0)); dh=ImageDraw.Draw(host)
UP=(380,-1100)                      # 위쪽 소실점(올려다봄)
HZ=470                              # 낮은 지평선
def up(x,y,t): return (x+(UP[0]-x)*t, y+(UP[1]-y)*t)
bulb=lambda x,y,dd=d: dd.ellipse([x-4,y-4,x+4,y+4],outline=C,width=2)
# 천장 트러스: 크게, 원근(앞 막대 넓고 뒤 막대 좁게)
d.line([0,60,CW,30],fill=C,width=w); d.line([60,120,CW-40,96],fill=C,width=2)
for i,x in enumerate((90,200,310,420,530,640)):
    y=60-30*x/CW; d.rectangle([x-12,y,x+12,y+26],outline=C,width=w); d.line([x,y+26,x,y+40],fill=C,width=1)
for x in range(0,CW,60): d.line([x,60-30*x/CW,x*0.95+30,120-24*x/CW],fill=C,width=1)
# 세트 기둥: 세로선이 위로 모임
for x in (120,560,700):
    d.line([x,HZ,*up(x,HZ,0.32)],fill=C,width=2)
# 큐 조명 둘
d.polygon([(330,150),(372,146),(372,170),(330,174)],outline=C); d.polygon([(380,145),(422,141),(422,165),(380,169)],outline=C)
# 전광판(기울어 보이게 평행사변형)
d.polygon([(470,140),(700,118),(700,170),(470,192)],outline=C,width=w)
# 큰 화면 + 전구 둘레(오른쪽, 올려다본 사다리꼴)
scr=[(470,215),(700,195),(705,315),(470,330)]; d.polygon(scr,outline=C,width=w)
for t in [i/12 for i in range(13)]:
    bulb(462+(712-462)*t, 205+(185-205)*t); bulb(462+(712-462)*t, 340+(323-340)*t)
for t in [i/6 for i in range(1,6)]:
    bulb(458, 205+(340-205)*t); bulb(714, 185+(323-185)*t)
# 전구 아치: 진행자 머리 뒤 후광
d.arc([150,90,470,410],190,350,fill=C,width=w)
for a in range(192,350,11):
    r=math.radians(a); bulb(310+150*math.cos(r),250+150*math.sin(r))
# 테이블(오른쪽 아래 앞, 크게 사선)과 회전 받침
d.polygon([(400,470),(760,420),(760,570),(430,570)],outline=C,width=w)
d.ellipse([470,420,630,452],outline=C,width=w); d.line([470,436,470,446],fill=C,width=w); d.line([630,436,630,446],fill=C,width=w)
# 상자(받침 뒤)
d.rectangle([660,370,730,425],outline=C,width=2); d.rectangle([670,340,720,370],outline=C,width=2)
# 채팅 모니터(왼쪽 위, 트러스에 매달림)
d.polygon([(20,140),(70,134),(74,330),(24,338)],outline=C,width=w); d.line([45,64,45,136],fill=C,width=2)
# 진행자(따로 그려 칸 계산)
F=(255,255,255,255)
dh.polygon([(40,570),(90,380),(170,330),(250,322),(330,340),(380,380),(400,570)],fill=F,outline=C,width=w)   # 어깨·몸(아래 잘림)
dh.ellipse([180,170,310,330],fill=F,outline=C,width=w)                 # 얼굴(올려다봐서 턱 아래가 보임)
dh.arc([170,150,320,280],200,340,fill=C,width=w)
dh.ellipse([210,228,232,244],outline=C,width=w); dh.ellipse([258,226,280,242],outline=C,width=w)
dh.line([228,290,262,286],fill=C,width=w)
dh.line([230,330,246,440,262,328],fill=C,width=w)                       # 넥타이
dh.polygon([(330,360),(430,410),(450,436),(350,420)],fill=F,outline=C,width=w)   # 뻗은 팔
dh.polygon([(428,396),(478,392),(488,414),(470,438),(440,440)],fill=F,outline=C,width=w)   # 편 손(광각으로 큼)
dh.ellipse([200,400,246,446],fill=F,outline=C,width=w); dh.line([224,400,250,350],fill=C,width=6); dh.ellipse([242,334,266,358],outline=C,width=w)   # 마이크
im.alpha_composite(host)
ROT=-9
def rot_crop(img,fill):
    r=img.rotate(ROT,resample=Image.NEAREST,expand=False,fillcolor=fill)
    l=(CW-592)//2; t=(CH-444)//2; return r.crop((l,t,l+592,t+444))
out=rot_crop(im,(255,255,255,255)).convert('RGB'); out.save('ref_v12_1_layout.png')
hb=rot_crop(host,(0,0,0,0)).getbbox(); print('host bbox',hb)
