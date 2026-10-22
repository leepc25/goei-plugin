# 기준 그림을 쟈알디(A2·대기 장)와 같은 판에 나란히 놓고 숫자로 비교 → ../compare.png, ../compare.txt
import sys,os,colorsys,statistics as st
from PIL import Image,ImageDraw
H=os.path.dirname(os.path.abspath(__file__)); R=os.path.join(H,'..'); JY=os.path.join(H,'../../jyaldi-v5/full')
def stats(im):
    px=[p for p in im.getdata() if p[3]>0]; bb=im.getbbox()
    s=[colorsys.rgb_to_hsv(*(c/255 for c in p[:3]))[1] for p in px]; v=[colorsys.rgb_to_hsv(*(c/255 for c in p[:3]))[2] for p in px]
    blk=sum(1 for p in px if p[:3]==(0,0,0)); dark=sum(1 for p in px if max(p[:3])<30)
    return dict(height=bb[3]-bb[1],width=bb[2]-bb[0],colors=len({p[:3] for p in px}),sat=round(st.median(s),3),val=round(st.median(v),3),black=blk,dark=dark,px=len(px))
items=[('쟈알디 A2',Image.open(f'{JY}/A2-pad.png').convert('RGBA')),('쟈알디 대기',Image.open(f'{JY}/clips/idle/00.png').convert('RGBA'))]
for a in sys.argv[1:]:
    n,f=a.split('=',1); items.append((n,Image.open(os.path.join(R,f)).convert('RGBA')))
W=max(i.width for _,i in items); Hh=max(i.height for _,i in items)
sheet=Image.new('RGBA',(W*len(items),Hh+40),(58,66,74,255)); d=ImageDraw.Draw(sheet); lines=[]
for k,(n,im) in enumerate(items):
    bb=im.getbbox(); y0=Hh-im.height
    # 발바닥을 같은 선에 맞춤
    off=Hh-8-bb[3]
    sheet.alpha_composite(im,(k*W,off))
    s=stats(im); lines.append(f'{n}: 키 {s["height"]} 폭 {s["width"]} 색 {s["colors"]} 채도중앙 {s["sat"]} 명도중앙 {s["val"]} 순검정 {s["black"]}/{s["px"]}')
    d.text((k*W+4,Hh+4),f'{n} h{s["height"]} c{s["colors"]} s{s["sat"]}',fill=(255,255,0,255))
d.line([(0,Hh-8),(sheet.width,Hh-8)],fill=(120,120,120,255))
sheet.resize((sheet.width*3,sheet.height*3),Image.NEAREST).save(os.path.join(R,'compare.png'))
open(os.path.join(R,'compare.txt'),'w').write('\n'.join(lines)+'\n'); print('\n'.join(lines))
