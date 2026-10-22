# 확대 검수 인화: 장들을 공통 범위로 잘라 3배. 사용: python3 csheet.py 출력.png 클립... (클립마다 한 줄, 첫 칸 = 기준 그림)
import sys,os
from PIL import Image,ImageDraw
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
out,names=sys.argv[1],sys.argv[2:]; K=3
rows=[]
for n in names:
    d=os.path.join(ROOT,'clips',n)
    rows.append((n,[Image.open(os.path.join(d,f)).convert('RGBA') for f in sorted(os.listdir(d)) if f.endswith('.png')]))
bb=[999,999,0,0]
for _,fs in rows:
    for f in fs:
        b=f.getbbox()
        if b: bb=[min(bb[0],b[0]),min(bb[1],b[1]),max(bb[2],b[2]),max(bb[3],b[3])]
bb=[max(0,bb[0]-2),max(0,bb[1]-2),min(192,bb[2]+2),min(144,bb[3]+2)]
w,h=bb[2]-bb[0],bb[3]-bb[1]
cols=max(len(fs) for _,fs in rows)
S=Image.new('RGBA',(cols*(w*K+4),len(rows)*(h*K+16)),(24,28,32,255)); dr=ImageDraw.Draw(S)
for j,(n,fs) in enumerate(rows):
    y0=j*(h*K+16); dr.text((4,y0+2),n,fill=(255,255,160,255))
    for i,f in enumerate(fs):
        bg=Image.new('RGBA',(192,144),(78,86,94,255)); bg.alpha_composite(f)
        S.paste(bg.crop(bb).resize((w*K,h*K),Image.NEAREST),(i*(w*K+4),y0+16)); dr.text((i*(w*K+4)+60,y0+2),str(i),fill=(255,255,255,255))
S.save(out); print(out,S.size)
