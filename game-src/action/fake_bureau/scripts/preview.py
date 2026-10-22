# 뼈대 미리보기(무료)와 자동 검사: 팔꿈치·무릎 거꾸로, 캔버스 밖, 옆모습(어깨 벌어짐), 서 있는 장의 발목 바닥선.
import sys,os,math
from PIL import Image,ImageDraw
from rig import *
from rig import _xs
from clips import CLIPS
OUT=os.path.join(os.path.dirname(__file__),'..','preview'); os.makedirs(OUT,exist_ok=True)
def draw(c,W,H,s=2):
    im=Image.new('RGBA',(W*s,H*s),(44,56,62,255)); d=ImageDraw.Draw(im)
    d.line([(0,136*s),(W*s,136*s)],fill=(120,130,140,255))
    for a,b in BONES:
        col=(255,90,90,255) if 'RIGHT' in a+b else (90,170,255,255) if 'LEFT' in a+b else (240,240,240,255)
        d.line([(c[a][0]*s,c[a][1]*s),(c[b][0]*s,c[b][1]*s)],fill=col,width=s)
    n=c['NOSE']; d.ellipse([n[0]*s-3,n[1]*s-3,n[0]*s+3,n[1]*s+3],fill=(255,230,80,255)); return im
def audit(who,name,ps):
    W,H,_,_=BODY[who]; out=[]
    for i,p in enumerate(ps):
        for s in ('RIGHT','LEFT'):
            if _xs(p[f'{s} SHOULDER'],p[f'{s} ELBOW'],p[f'{s} ARM'])>0.12: out.append(f'{i}:{s[0]}팔꿈치')
            if _xs(p[f'{s} HIP'],p[f'{s} KNEE'],p[f'{s} LEG'])<-0.12: out.append(f'{i}:{s[0]}무릎')
        c=to_canvas(p,who)
        for k,v in c.items():
            if not(3<v[0]<W-3 and 3<v[1]<H-3): out.append(f'{i}:밖 {k}'); break
        if abs(p['RIGHT SHOULDER'][0]-p['LEFT SHOULDER'][0])>8 and name!='turn': out.append(f'{i}:어깨벌어짐')
    return out
if __name__=='__main__':
    who_list=sys.argv[1:] or list(CLIPS)
    bad=0
    for who in who_list:
        W,H,_,_=BODY[who]; rows=[]
        for n,(a,_,ps) in CLIPS[who].items():
            r=audit(who,n,ps)
            if r: bad+=1; print(who,n,' '.join(r))
            s=1; row=Image.new('RGBA',(W*s*15,H*s),(30,34,40,255))
            for i,p in enumerate(ps): row.alpha_composite(draw(to_canvas(p,who),W,H,s),(i*W*s,0))
            ImageDraw.Draw(row).text((4,4),n,fill=(255,255,0,255)); rows.append(row)
        for i in range(0,len(rows),10):
            sheet=Image.new('RGBA',(rows[0].width,H*len(rows[i:i+10])))
            for j,r in enumerate(rows[i:i+10]): sheet.alpha_composite(r,(0,j*H))
            sheet.save(f'{OUT}/{who}-{i//10}.png')
    print('문제 클립',bad)
