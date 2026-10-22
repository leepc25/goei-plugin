# 검수용 밀착 인화: 클립마다 한 줄(기준 그림 A + 장들), 2배, 회색 바탕, 발바닥선(y136)·기준 x(57) 표시
# 사용: python3 sheet.py 출력.png 클립...
import sys,os
from PIL import Image,ImageDraw
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
out,names=sys.argv[1],sys.argv[2:]
K=2; W,H=192,144
A=Image.open(os.path.join(ROOT,'base','A.png')).convert('RGBA')
rows=[]
for n in names:
    d=os.path.join(ROOT,'clips',n)
    fs=[Image.open(os.path.join(d,f)).convert('RGBA') for f in sorted(os.listdir(d)) if f.endswith('.png')] if os.path.isdir(d) else []
    rows.append((n,[A]+fs))
cols=max(len(r[1]) for r in rows)
sheet=Image.new('RGBA',(cols*W*K,len(rows)*(H*K+14)),(24,28,32,255)); dr=ImageDraw.Draw(sheet)
for j,(n,fs) in enumerate(rows):
    y0=j*(H*K+14)
    dr.text((4,y0),n,fill=(255,255,180,255))
    for i,f in enumerate(fs):
        bg=Image.new('RGBA',(W,H),(70,78,86,255) if i else (50,58,50,255)); bg.alpha_composite(f)
        dd=ImageDraw.Draw(bg); dd.line([(0,136),(W,136)],fill=(255,80,80,90)); dd.line([(57,0),(57,H)],fill=(80,200,255,60))
        sheet.paste(bg.resize((W*K,H*K),Image.NEAREST),(i*W*K,y0+14))
        dr.text((i*W*K+4,y0+16),str(i-1) if i else 'A',fill=(255,255,255,255))
sheet.save(out); print(out,sheet.size)
