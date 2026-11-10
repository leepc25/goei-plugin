"""망상홈쇼핑 컷 F 「시연대와 방청석」 구도 선 v1 592×444 (11-10 18:45, 사용자 「그래」: 방청석·시연대를 한 장으로).
앞: 시연 테이블(윗면 + 수직 앞면, 화면 아래 끝까지 아님) / 오른쪽 테이블 뒤에 시연 모델(동작 칸 320~576×100~356).
가운데: 무대와 객석 사이 바닥 테이프 줄. 뒤: 계단식 방청석 4줄(앉은 관객, 빈 팻말), 왼쪽 관객 출입문 + 그 위 빈 표지등(EXIT는 코드),
천장 가운데 빈 큐 표지등(「박수」는 코드)."""
from PIL import Image, ImageDraw
W,H=592,444; im=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(im); C='black'; w=3; F='white'
# 큐 표지등 (천장 가운데, 꺼짐, 글자 없음)
d.rectangle([236,14,356,44],fill=F,outline=C,width=w); d.line([296,0,296,14],fill=C,width=2)
# 관객 출입문 + 위 표지등
d.rectangle([18,120,86,262],fill=F,outline=C,width=w); d.line([52,120,52,262],fill=C,width=2)
d.rectangle([24,96,80,114],fill=F,outline=C,width=w)
# 계단식 방청석 4줄 (뒤로 갈수록 높고 작게)
rows=[(110,18,10),(150,20,11),(192,23,12),(236,26,13)]  # (머리 y, 간격 반, 머리 반지름)
for i,(y,gap,r) in enumerate(rows):
    d.line([96,y+r*3,W,y+r*3],fill=C,width=2)  # 단 앞선
    for x in range(110+i*6,W-10,gap*2+6):
        d.ellipse([x-r//1.4,y-r,x+r//1.4,y+r//2],outline=C,width=2)          # 머리
        d.arc([x-r*1.4,y+r//2,x+r*1.4,y+r*3+4],180,360,fill=C,width=2)     # 어깨
        if (x//7+i)%3==0: d.rectangle([x+r//2,y-r-r,x+r*2,y-r+r//2],outline=C,width=2)  # 든 팻말(빈)
# 바닥 테이프 줄 (무대와 객석 사이)
for x in range(0,W,24): d.polygon([(x,280),(x+12,280),(x+6,288),(x-6,288)],fill=C)
d.line([0,279,W,279],fill=C,width=2); d.line([0,289,W,289],fill=C,width=2)
# 시연 모델 (테이블 오른쪽 뒤, 칸 320~576×100~356)
mx=448
d.ellipse([mx-22,128,mx+22,186],fill=F,outline=C,width=w)                   # 머리
d.polygon([(mx-70,320),(mx-60,214),(mx-22,192),(mx+22,192),(mx+60,214),(mx+70,320)],fill=F,outline=C,width=w)  # 몸(조끼)
d.line([mx-30,200,mx-24,320],fill=C,width=2); d.line([mx+30,200,mx+24,320],fill=C,width=2)  # 조끼 앞섶
d.line([mx-60,230,mx-64,300],fill=C,width=w); d.line([mx+60,230,mx+64,300],fill=C,width=w)   # 굳은 팔
# 시연 테이블 (앞, 왼쪽~가운데로 길게, 모델 아래쪽을 가림)
d.polygon([(30,300),(520,300),(540,316),(14,316)],fill=F,outline=C,width=w)   # 윗면
d.rectangle([14,316,540,420],fill=F,outline=C,width=w)                        # 앞면
d.line([14,404,540,404],fill=C,width=2)
im.save('cutF/cutF_v1_layout.png')
ck=im.convert('RGBA'); dd=ImageDraw.Draw(ck); dd.rectangle([320,100,575,355],outline=(220,0,0,255),width=2)
ck.resize((W*2,H*2),Image.NEAREST).save('/mnt/project-files/망상홈쇼핑_1109/컷F_시연대방청석_구도선_2배.png')
print('ok')
