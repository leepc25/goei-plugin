# 쟈알디 A2와 후보를 같은 축척·같은 바닥선에 나란히. 키·색 수·채도·명도(화소 기준)·순검정 외곽선 비율을 적음.
import sys,os,glob,colorsys,statistics
from PIL import Image,ImageDraw
ROOT=os.path.join(os.path.dirname(__file__),'..')
A2=Image.open(os.path.join(ROOT,'../jyaldi-v5/full/A2-pad.png')).convert('RGBA')
def stats(im):
    px=im.load(); W,H=im.size; pts=[(x,y) for y in range(H) for x in range(W) if px[x,y][3]>128]
    if not pts: return None
    ys=[p[1] for p in pts]; xs=[p[0] for p in pts]
    cols={}; s=[]; v=[]
    for x,y in pts:
        c=px[x,y][:3]; cols[c]=1; h,ss,vv=colorsys.rgb_to_hsv(*[q/255 for q in c]); s.append(ss); v.append(vv)
    # 외곽선: 투명과 맞닿은 화소 중 순검정에 가까운(합<40) 비율
    edge=[(x,y) for x,y in pts if any(not(0<=x+dx<W and 0<=y+dy<H) or px[x+dx,y+dy][3]<=128 for dx,dy in((1,0),(-1,0),(0,1),(0,-1)))]
    blk=sum(1 for x,y in edge if sum(px[x,y][:3])<40)/max(1,len(edge))
    return dict(top=min(ys),bot=max(ys),h=max(ys)-min(ys)+1,x0=min(xs),x1=max(xs),colors=len(cols),sat=statistics.median(s),val=statistics.median(v),outline=blk)
def norm(im,W=192,H=144,ax=None):
    """바닥(맨 아래 불투명 화소)을 y=135에 맞춰 W×H 판에 놓음."""
    st=stats(im); c=Image.new('RGBA',(W,H)); x=(W-im.width)//2 if ax is None else ax
    c.alpha_composite(im,(max(0,x),135-st['bot'])); return c
if __name__=='__main__':
    files=sys.argv[1:]
    ims=[('A2',A2)]+[(os.path.basename(f)[5:-4],norm(Image.open(f).convert('RGBA'),256 if ('dohyeong' in f or 'seongju' in f) else 192)) for f in files]
    s=3; Wt=sum(i.width for _,i in ims)*s; sheet=Image.new('RGBA',(Wt,144*s+70),(200,200,200,255)); d=ImageDraw.Draw(sheet); x=0
    a=stats(A2)
    for n,im in ims:
        st=stats(im); sheet.alpha_composite(im.resize((im.width*s,im.height*s),Image.NEAREST),(x,0))
        d.line([(x,a['top']*s),(x+im.width*s,a['top']*s)],fill=(255,0,0,255))
        d.text((x+4,144*s+4),f"{n} h{st['h']} c{st['colors']} s{st['sat']:.2f} v{st['val']:.2f} ol{st['outline']:.2f}",fill=(0,0,0,255))
        print(n,st); x+=im.width*s
    sheet.save(os.path.join(ROOT,'base','compare.png'))
