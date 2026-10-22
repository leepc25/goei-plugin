# 후보 비교 시트: 쟈알디 A2 옆에 후보들을 같은 발 기준으로 4배
import sys,glob
from PIL import Image,ImageDraw
A=Image.open('../../jyaldi-v5/full/A2.png').convert('RGBA')
def crop(im): b=im.split()[-1].getbbox(); return im.crop(b)
ims=[('A2',crop(A))]
for i in sys.argv[2:]:
    for p in sorted(glob.glob(f'../base/{i}/cand-*.png'))+sorted(glob.glob(f'../base/{i}/ref*.png')):
        if 'pad' in p: continue
        ims.append((p.split('/')[-2]+' '+p.split('/')[-1][5:-4],crop(Image.open(p).convert('RGBA'))))
S=4; H=max(im.height for _,im in ims); Wt=sum(im.width+8 for _,im in ims)
out=Image.new('RGBA',(Wt*S,(H+10)*S),(60,66,72,255)); x=0
for n,im in ims:
    out.alpha_composite(im.resize((im.width*S,im.height*S),Image.NEAREST),(x*S,(H+10-im.height)*S))
    ImageDraw.Draw(out).text((x*S+2,2),f'{n} h{im.height}',fill=(255,255,0,255)); x+=im.width+8
out.save(sys.argv[1])
