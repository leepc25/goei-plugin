# 쟈알디 톤 맞추기: 채도·명도 중앙값을 쟈알디 대기 장(A2 실측 채도 0.23·명도 0.33)에 맞춤. 외곽선(순검정)은 그대로.
import colorsys,statistics,sys
from PIL import Image
def stats(im):
    s=[];v=[]
    for r,g,b,a in im.convert('RGBA').getdata():
        if a<128 or max(r,g,b)<24: continue
        h,ss,vv=colorsys.rgb_to_hsv(r/255,g/255,b/255); s.append(ss); v.append(vv)
    return statistics.median(s),statistics.median(v)
def match(im,ts=None,tv=None,ref='../../jyaldi-v5/full/clips/idle/00.png'):
    if ts is None: ts,tv=stats(Image.open(ref))
    cs,cv=stats(im); ks=ts/max(cs,1e-3); kv=tv/max(cv,1e-3)
    im=im.convert('RGBA'); px=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=px[x,y]
            if a==0 or max(r,g,b)<24: continue
            h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
            s=min(1,s*ks); v=min(1,v**(1/max(.3,min(3,kv)) if False else 1)*kv) if kv<1 else min(1,v*kv)
            R,G,B=colorsys.hsv_to_rgb(h,s,v); px[x,y]=(round(R*255),round(G*255),round(B*255),a)
    return im
if __name__=='__main__':
    im=Image.open(sys.argv[1]); print('src',stats(im),'jy',stats(Image.open('../../jyaldi-v5/full/clips/idle/00.png')))
    o=match(im); print('out',stats(o)); o.save(sys.argv[2])
