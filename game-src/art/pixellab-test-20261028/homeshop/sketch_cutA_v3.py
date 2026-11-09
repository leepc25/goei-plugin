"""망상홈쇼핑 컷 A 와이드 구도 선 v2 592×444 (11-09 23:20). 진행자(양팔 포함)가 동작 칸 90~346×76~332(256) 안에 전부.
자세: 4분의 3으로 오른쪽을 향해 몸을 내밈. 오른팔을 오른쪽 아래(진열대 위 회전판)로 쭉 뻗어 손바닥으로 상품을 가리킴(손 x≤340, y≈290). 왼손은 가슴 앞 핸드 마이크.
깊이: 소실점 (420,170). 양옆 세트 판이 소실점으로 꺾임. 진열대 윗면이 뒤로 물러나는 좁은 면(위 332~348). 앞면 수직 하나(348~444), 전구 줄 366, 타일 줄 388~426.
회전판: 칸 바로 오른쪽 x 360~440, 윗면 위. 뒷벽 오른쪽에 꺼진 큰 화면(테두리 꺼진 전구). 전구 아치(머리 뒤), 트러스 스포트 3(꺼짐)."""
from PIL import Image, ImageDraw
import math
W,H=592,444; im=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(im); C='black'; w=3; F='white'
bulb=lambda x,y: d.ellipse([x-3,y-3,x+3,y+3],outline=C,width=2)
VX,VY=420,170
# 배경 선 없음 (v3: 옆 판 사선·뒷벽 세로선 지움 — 모델이 쐐기 무늬로 그림)
# 뒷벽 오른쪽 큰 화면(꺼짐) + 테두리 전구
d.rectangle([380,60,548,170],fill=F,outline=C,width=w)
for x in range(386,548,14): bulb(x,54); bulb(x,176)
for y in range(68,170,14): bulb(374,y); bulb(554,y)
# 트러스 + 스포트라이트 3 (꺼짐)
d.line([330,20,592,20],fill=C,width=w)
for x in (380,460,540): d.rectangle([x-11,4,x+11,28],outline=C,width=w); d.line([x,28,x-6,38],fill=C,width=2)
# 전구 아치 (머리 뒤)
cx,cy,R=210,236,126
d.arc([cx-R,cy-R,cx+R,cy+R],190,350,fill=C,width=2)
for a in range(192,350,9):
    r=math.radians(a); bulb(cx+R*math.cos(r),cy+R*math.sin(r))
# 진행자 몸 (어깨 y≈190, 허리는 진열대 뒤)
d.polygon([(100,336),(112,206),(162,180),(206,176),(250,190),(282,214),(296,336)],fill=F,outline=C,width=w)
# 머리 50×66
d.ellipse([162,94,212,160],fill=F,outline=C,width=w); d.arc([156,86,218,138],195,345,fill=C,width=w)
d.ellipse([174,120,183,128],outline=C,width=2); d.ellipse([194,120,203,128],outline=C,width=2); d.line([184,146,202,144],fill=C,width=w)
d.line([178,160,180,180],fill=C,width=w); d.line([202,158,204,178],fill=C,width=w)
d.line([180,180,192,262,204,178],fill=C,width=w)  # 넥타이
# 오른팔: 오른쪽 아래 회전판 쪽으로 쭉 뻗음, 손바닥 펼침 (손 x≤340, y≈290)
d.polygon([(250,196),(312,268),(300,284),(240,214)],fill=F,outline=C,width=w)          # 팔
d.polygon([(306,272),(338,282),(340,296),(322,304),(302,292)],fill=F,outline=C,width=w) # 펼친 손(손바닥 위)
# 왼손 마이크 (가슴 앞)
d.ellipse([140,250,170,280],fill=F,outline=C,width=w); d.line([156,250,164,222],fill=C,width=5); d.ellipse([158,206,176,226],outline=C,width=w)
# 진열대: 윗면(뒤로 물러나는 좁은 면) + 수직 앞면 (아래 끝 = 화면 끝)
d.polygon([(0,336),(W,330),(W,348),(0,348)],fill=F,outline=C,width=w)
d.rectangle([0,348,W,H],fill=F,outline=C,width=w)
for x in range(10,W,18): bulb(x,366)
for x in range(6,W,46): d.rectangle([x,388,x+38,426],outline=C,width=2)
# 회전 받침 (칸 바로 오른쪽, 윗면 위)
tx,ty=400,334
d.ellipse([tx-44,ty-12,tx+44,ty+4],outline=C,width=w); d.rectangle([tx-44,ty-4,tx+44,ty+8],outline=C,width=2)
im.save('cutA3_ref1_layout.png')
ck=im.convert('RGBA'); dd=ImageDraw.Draw(ck); dd.rectangle([90,76,345,331],outline=(220,0,0,255),width=2)
ic=Image.open('/mnt/project-files/망상홈쇼핑_1109/_prod1.webp').convert('RGBA'); ck.alpha_composite(ic,(tx-42,ty-8-85))
ck.resize((W*2,H*2),Image.NEAREST).save('/mnt/project-files/망상홈쇼핑_1109/컷A_v3_구도선_칸_상품_2배.png')
print('ok')
