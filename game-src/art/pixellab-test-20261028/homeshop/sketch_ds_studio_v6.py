"""망상홈쇼핑 방송 장면 구도 선 밑그림 592×444(4:3), 흰 바탕·검은 선 3점 굵기. generate-image-v2 참고 그림용(11-09 v6).
진행자: 가슴 위 근접, 얼굴 폭 70점(가로 125~195), 머리 꼭대기 y 50, 어깨 y 225, 단상 윗면 y 330. 시연 테이블 오른쪽(윗면 y 330, 상품 85점 자리 x 400~485)."""
from PIL import Image, ImageDraw
W,H=592,444; im=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(im); C='black'; w=3
d.line([0,30,W,30],fill=C,width=w)                                  # 조명 트러스 아래 선
for x in range(30,W,80): d.rectangle([x,6,x+22,30],outline=C,width=w)
d.line([0,350,10,350],fill=C,width=w); d.line([310,350,350,350],fill=C,width=w)   # 뒷벽·바닥 경계(단상·테이블 뒤는 가려짐)
d.rectangle([360,60,570,110],outline=C,width=w)                      # 전광판
# 진행자(가슴 위 근접)
d.ellipse([125,50,195,140],outline=C,width=w)                        # 얼굴 70×90
d.arc([118,40,202,110],190,350,fill=C,width=w)                       # 머리칼
d.ellipse([138,80,154,96],outline=C,width=w); d.ellipse([166,80,182,96],outline=C,width=w)   # 눈
d.arc([142,104,178,126],20,160,fill=C,width=w)                       # 입
d.line([148,138,148,158],fill=C,width=w); d.line([172,138,172,158],fill=C,width=w)          # 목
d.line([50,330,66,200,148,160,172,160,254,200,270,330],fill=C,width=w)                      # 어깨·몸
d.line([148,160,160,250,172,160],fill=C,width=w)                     # 깃·넥타이
d.rectangle([10,330,310,444],outline=C,width=w)                      # 단상
d.ellipse([70,316,120,340],outline=C,width=w); d.ellipse([200,316,250,340],outline=C,width=w)   # 손
# 시연 테이블(윗면 비움)
d.polygon([(350,330),(582,330),(572,316),(360,316)],outline=C,width=w); d.rectangle([350,330,582,444],outline=C,width=w)
im.save('ref_v6_1_layout.png')
