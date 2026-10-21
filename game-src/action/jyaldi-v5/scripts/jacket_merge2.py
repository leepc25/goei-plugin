# A-short-31-41: 재킷이 엉덩이 길이로 맞음, 다만 바지가 새까맣게 변함 → 밑단(HEM) 위는 41, 아래는 원래 A 바지.
import sys
from PIL import Image
A=Image.open('sheet7/jyaldi-base-pixen-a.png').convert('RGBA')
E=Image.open('full/A-short-31-41.png').convert('RGBA')
HEM=int(sys.argv[1]) if len(sys.argv)>1 else 52
FRONT=int(sys.argv[2]) if len(sys.argv)>2 else 46  # 이 x부터는 앞허벅지 = A 바지
out=A.copy(); pa,pe,po=A.load(),E.load(),out.load()
for y in range(96):
    for x in range(96):
        if y<=HEM and not (x>=FRONT and y>=47): po[x,y]=pe[x,y]
out.save('full/A2.png')
S=5
st=Image.new('RGBA',(96*S*3,96*S),(200,196,188,255))
for k,i in enumerate((A,E,out)):st.alpha_composite(i.resize((96*S,96*S),Image.NEAREST),(k*96*S,0))
st.save('full/A2-compare.png')
