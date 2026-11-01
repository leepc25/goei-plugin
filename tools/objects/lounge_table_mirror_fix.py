"""inpaint 1차 테이블 상판 오른쪽 끝(마스크 끝 x370에서 잘림)을 왼쪽 끝 거울상으로 코드 합성(사용자 18:34 「반대쪽 참고해서 코드로 합성」).
상판 가운데 x=313.5(기둥 가운데 313, 윗줄 269~358). y 284~312 구간, x>=364 에서 거울 원본이 테이블 픽셀(나무·윤곽)일 때만 덮어쓴다."""
import numpy as np
from PIL import Image
P='/home/user/goei-plugin/game-src/art/pixellab-hq-20261031/lounge_table/'
a=np.array(Image.open(P+'hq_lounge_table_inp1.png').convert('RGB'))
CX2=627  # 2*313.5
def is_table(p):
    r,g,b=[int(v) for v in p]; mx=max(r,g,b)
    return (r>150 and r>b+50 and g>90) or mx<70 or (r>=100 and r<=120 and g>=80 and g<=95 and b>=70 and b<=85)  # 나무 / 검은 윤곽 / 앞면 그늘
n=0
for y in range(284,313):
    for x in range(364,392):
        sx=CX2-x
        if 230<=sx<313 and is_table(a[y,sx]):
            a[y,x]=a[y,sx]; n+=1
Image.fromarray(a).save(P+'hq_lounge_table_inp1_fix.png'); print('덮어쓴 픽셀',n)
