# 후보 비교판: 쟈알디 A2 옆에 후보를 같은 축척(1도트=S화소), 같은 발바닥으로 놓고 키·색 수·채도·외곽선 수치를 적음.
# 사용: python3 compare.py <out.png> <png...>
import sys,colorsys,statistics as st
from PIL import Image,ImageDraw,ImageFont
FP='/tmp/claude-0/-home-user-goei-plugin/db3ea040-6c1d-5f6c-aeb8-9018d800e575/scratchpad/galmuri.ttf'
try: F=ImageFont.truetype(FP,12)
except Exception: F=ImageFont.load_default()
def stats(im):
    px=[p[:3] for p in im.getdata() if p[3]>0]; hs=[colorsys.rgb_to_hsv(*[q/255 for q in x]) for x in px]
    return len(set(px)),round(st.median(h[1] for h in hs),2),sum(1 for x in px if x==(0,0,0))
S=3
ims=[('쟈알디 A2','../../jyaldi-v5/full/A2.png')]+[(p.split('/')[-3]+' '+p.split('/')[-1][:-4],p) for p in sys.argv[2:]]
cells=[]
for n,p in ims:
    im=Image.open(p).convert('RGBA'); im=im.crop(im.split()[-1].getbbox()); cells.append((n,im,stats(im)))
H=max(i.height for _,i,_ in cells); W=sum(i.width+14 for _,i,_ in cells)+10
out=Image.new('RGBA',(W*S,(H+30)*S),(44,52,58,255)); d=ImageDraw.Draw(out); x=6
for n,im,(nc,sat,blk) in cells:
    out.alpha_composite(im.resize((im.width*S,im.height*S),Image.NEAREST),(x*S,(H+4-im.height)*S))
    d.text((x*S,(H+7)*S),f'{n}',font=F,fill=(255,230,120,255)); d.text((x*S,(H+7)*S+16),f'키{im.height} {nc}색 채도{sat} 외곽{blk}',font=F,fill=(220,220,220,255))
    x+=im.width+14
out.save(sys.argv[1]); print('saved',sys.argv[1])
