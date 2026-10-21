# edit_image_pixen 결과(31)는 재킷이 코트처럼 무릎까지 내려옴 → 엉덩이 아래(허벅지 위)까지만 쓰고 그 아래는 원래 A의 바지를 그대로 둔다.
import sys
from PIL import Image
A=Image.open('sheet7/jyaldi-base-pixen-a.png').convert('RGBA')
E=Image.open(f'full/A-jacket-{sys.argv[1] if len(sys.argv)>1 else 31}.png').convert('RGBA')
HEM=int(sys.argv[2]) if len(sys.argv)>2 else 58
out=A.copy(); pa,pe,po=A.load(),E.load(),out.load()
X0,X1=24,60   # 엉덩이 구간만 손댐(앞뒤 다리는 A 그대로)
for y in range(40,HEM+1):
    for x in range(X0,X1):
        po[x,y]=pe[x,y]
# 밑단 외곽선: 바꾼 구간 바로 아래 줄에서 재킷색이 바지 위로 끝나는 곳을 검게
for x in range(X0,X1):
    if pe[x,HEM][3] and pa[x,HEM+1][3]:
        po[x,HEM+1]=(0,0,0,255)
out.save('full/A2.png')
S=5;bb=(0,0,96,96)
st=Image.new('RGBA',(96*S*2,96*S),(200,196,188,255))
for k,i in enumerate((A,out)):st.alpha_composite(i.resize((96*S,96*S),Image.NEAREST),(k*96*S,0))
st.save('full/A2-compare.png')
