"""망상홈쇼핑 장면 구도 선 v8 592×444(11-09). 움직일 것을 먼저 정하고 짠 구도(사용자 「움직임 감안해 배경 짜라」).
움직이는 칸(서로 안 겹침): ① 진행자 칸 40~296×60~316(animate) ② 큰 화면 350~574×128~218(animate) ③ 채팅 모니터 4~36×60~240(코드 흘림)
④ 전구 줄: 세트 아치 위·큰 화면 둘레(코드 따라 켜기) ⑤ 스포트라이트 6개·빛줄기(코드 번갈아) ⑥ 큐 조명 2(코드 켜짐) ⑦ 전광판 숫자(코드)
⑧ 회전 받침 옆면(코드 무늬 흘림) ⑨ 바닥 조명 타일 줄(코드 색 돌리기)."""
from PIL import Image, ImageDraw
W,H=592,444; im=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(im); C='black'; w=3
bulb=lambda x,y: d.ellipse([x-3,y-3,x+3,y+3],outline=C,width=2)
# 위: 트러스와 스포트라이트 6개(떨어뜨려), 빛줄기
d.line([0,24,W,24],fill=C,width=w)
for x in (60,150,240,350,450,540):
    d.rectangle([x-9,6,x+9,24],outline=C,width=w)
    if x > 300: d.line([x-6,26,x-30,110],fill=C,width=1); d.line([x+6,26,x+30,110],fill=C,width=1)   # 빛줄기는 진행자 칸 밖(오른쪽)만
# 진행자 쪽 세트 아치(전구 줄)
d.line([40,44,300,44],fill=C,width=w); [bulb(x,52) for x in range(48,300,16)]
d.rectangle([308,40,340,62],outline=C,width=w); d.rectangle([308,68,340,90],outline=C,width=w)   # 큐 조명 둘(진행자 칸 밖, 아치와 전광판 사이에 위아래로)
# 오른쪽 위: 전광판 + 큰 화면(둘레 전구)
d.rectangle([350,40,574,92],outline=C,width=w)
d.rectangle([350,128,574,218],outline=C,width=w)
for x in range(346,580,16): bulb(x,120); bulb(x,226)
for y in range(136,218,16): bulb(342,y); bulb(582,y)
# 왼쪽 끝 채팅 모니터
d.rectangle([4,60,36,240],outline=C,width=w); [d.line([8,y,32,y],fill=C,width=1) for y in range(70,236,10)]
d.rectangle([4,262,36,296],outline=C,width=2); d.rectangle([8,240,34,262],outline=C,width=2)     # 선물·택배 상자
# 진행자(얼굴 60, 손까지 316 안)
d.ellipse([120,88,180,166],outline=C,width=w); d.arc([114,78,186,138],190,350,fill=C,width=w)
d.ellipse([131,116,145,130],outline=C,width=w); d.ellipse([155,116,169,130],outline=C,width=w); d.line([138,146,162,146],fill=C,width=w)
d.line([140,164,140,178],fill=C,width=w); d.line([160,164,160,178],fill=C,width=w)
d.line([60,300,74,204,140,180,160,180,226,204,240,300],fill=C,width=w); d.line([140,180,150,252,160,180],fill=C,width=w)
d.ellipse([80,288,120,308],outline=C,width=w); d.ellipse([180,288,220,308],outline=C,width=w)
d.rectangle([50,300,250,400],outline=C,width=w)                       # 단상(좁힘, 아래 바닥 보이게)
# 바닥: 뒷벽선, 조명 타일 줄
d.line([0,350,50,350],fill=C,width=w); d.line([250,350,360,350],fill=C,width=w)
for x in range(0,W,37): d.rectangle([x,404,x+33,440],outline=C,width=2)
# 우체통(단상과 테이블 사이)
d.rectangle([272,312,304,370],outline=C,width=w); d.rectangle([276,296,300,312],outline=C,width=w)
# 시연 테이블 + 회전 받침(윗면 비움)
d.polygon([(360,330),(580,330),(570,316),(370,316)],outline=C,width=w); d.rectangle([360,330,580,400],outline=C,width=w)
d.ellipse([410,304,530,322],outline=C,width=w); d.line([410,313,410,320],fill=C,width=w); d.line([530,313,530,320],fill=C,width=w)
im.save('ref_v8_1_layout.png')
ck=im.convert('RGBA'); dd=ImageDraw.Draw(ck)
for b,c in (((40,60,295,315),(220,0,0,255)),((350,128,574,218),(0,90,220,255)),((4,60,36,240),(0,160,0,255))): dd.rectangle(b,outline=c,width=2)
ic=Image.open('/home/user/goei-plugin/game-src/items/icons/medical_001.webp').convert('RGBA'); ck.alpha_composite(ic,(428,312-85)); ck.save('ref_v8_check.png')
