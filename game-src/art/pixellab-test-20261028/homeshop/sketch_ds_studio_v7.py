"""망상홈쇼핑 장면 구도 선 v7 592×444(11-09). v6에서 진행자가 머리~손 ≈290점이라 animate 최대 256을 넘음 →
진행자를 동작 칸(가로 40~296, 세로 60~316, 256×256) 안에 손까지 들어오게 줄이고, 테이블 위 빈 벽을 큰 평판 화면으로."""
from PIL import Image, ImageDraw
W,H=592,444; im=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(im); C='black'; w=3
d.line([0,30,W,30],fill=C,width=w)
for x in range(30,W,80): d.rectangle([x,6,x+22,30],outline=C,width=w)
d.rectangle([330,48,580,110],outline=C,width=w)                      # 전광판(숫자만)
d.rectangle([330,120,580,218],outline=C,width=w)                     # 큰 평판 화면(꺼진 채, 안은 코드로)
d.line([0,350,10,350],fill=C,width=w); d.line([320,350,340,350],fill=C,width=w)
# 진행자: 얼굴 60×78, 머리 꼭대기 y 70, 손 y 285~305 → 칸 40~296 × 60~316 안
d.ellipse([120,78,180,156],outline=C,width=w)
d.arc([114,68,186,128],190,350,fill=C,width=w)
d.ellipse([131,106,145,120],outline=C,width=w); d.ellipse([155,106,169,120],outline=C,width=w)
d.line([138,136,162,136],fill=C,width=w)                             # 다문 입
d.line([140,154,140,170],fill=C,width=w); d.line([160,154,160,170],fill=C,width=w)
d.line([56,300,70,198,140,172,160,172,230,198,244,300],fill=C,width=w)
d.line([140,172,150,250,160,172],fill=C,width=w)
d.rectangle([20,300,300,444],outline=C,width=w)                      # 단상
d.ellipse([80,286,120,306],outline=C,width=w); d.ellipse([180,286,220,306],outline=C,width=w)
d.polygon([(340,330),(582,330),(572,316),(350,316)],outline=C,width=w); d.rectangle([340,330,582,444],outline=C,width=w)
# 빈 곳 채우기(사용자 11-09 「배경 저렇게 비워 놓을거냐」): 위키 메인 스튜디오 물건
d.rectangle([4,60,36,250],outline=C,width=w); [d.line([8,y,32,y],fill=C,width=1) for y in range(72,246,10)]   # 왼쪽 끝 실시간 채팅 모니터(세로로 긴 화면)
d.rectangle([196,40,228,62],outline=C,width=w); d.rectangle([236,40,268,62],outline=C,width=w)                # 큐 조명 상자 둘(박수·웃음)
d.rectangle([242,92,290,150],outline=C,width=w)                                                               # 진행자 뒤 오른쪽 벽: 채널 로고 판(글자 없음)
d.rectangle([300,312,336,350],outline=C,width=w); d.rectangle([304,290,332,312],outline=C,width=w)          # 단상과 테이블 사이 바닥: 빨간 우체통
d.line([344,140,572,140],fill=C,width=1); [d.rectangle([350+i*44,150+(3-i)*12,380+i*44,206],outline=C,width=2) for i in range(5)]  # 평판 화면 안: 주문 그래픽(막대)
d.rectangle([548,236,590,316],outline=C,width=w); [d.line([548,y,590,y],fill=C,width=w) for y in (262,288)]  # 오른쪽 끝 소품 선반
d.rectangle([4,262,36,296],outline=C,width=2); d.rectangle([8,236,34,262],outline=C,width=2)                  # 왼쪽 끝 바닥: 선물·택배 상자 더미
im.save('ref_v7_1_layout.png')
# 확인용: 동작 칸 빨간 틀 + 상품 자리
ck=im.convert('RGBA'); dd=ImageDraw.Draw(ck); dd.rectangle([40,60,295,315],outline=(220,0,0,255),width=2)
ic=Image.open('/home/user/goei-plugin/game-src/items/icons/medical_001.webp').convert('RGBA'); ck.alpha_composite(ic,(415,316-85)); ck.save('ref_v7_check.png')
