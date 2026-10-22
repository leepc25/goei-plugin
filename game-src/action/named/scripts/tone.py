# 쟈알디 A2 톤 맞추기(색만, 형태 그대로): 정장 청색 채도·명도를 A2 쪽으로, 외곽선 순검정, 색 수 78 이하.
# 사용: python3 tone.py <id> <후보 seed>  → ../base/<id>/ref.png, ref-pad.png(192×144, 발바닥 y=136), stats 출력
import sys,colorsys,statistics as st
from PIL import Image
def stats(im):
    px=[p[:3] for p in im.getdata() if p[3]>0]; hs=[colorsys.rgb_to_hsv(*[q/255 for q in c]) for c in px]
    return dict(n=len(set(px)),s=round(st.median(h[1] for h in hs),3),v=round(st.median(h[2] for h in hs),3),black=sum(1 for c in px if c==(0,0,0)))
def tone(im,sf,vf,skin=1.0):
    out=im.copy(); W,H=im.size; a=im.split()[-1]
    for y in range(H):
        for x in range(W):
            p=im.getpixel((x,y))
            if not p[3]: continue
            h,s,v=colorsys.rgb_to_hsv(*[q/255 for q in p[:3]])
            edge=any(not(0<=x+dx<W and 0<=y+dy<H) or a.getpixel((x+dx,y+dy))==0 for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)))
            if v<0.16 and (edge or v<0.08): out.putpixel((x,y),(0,0,0,255)); continue
            if 0.5<=h<=0.75: s*=sf; v=min(1,v*vf)            # 정장·청색
            elif 0.02<=h<=0.11 and s>0.25 and v>0.5: s*=skin    # 피부
            out.putpixel((x,y),tuple(round(q*255) for q in colorsys.hsv_to_rgb(h,s,v))+(255,))
    return out.quantize(colors=78,method=Image.Quantize.FASTOCTREE).convert('RGBA') if len(set(out.getdata()))>78 else out
if __name__=='__main__':
    A=Image.open('../../jyaldi-v5/full/A2.png').convert('RGBA'); print('A2',stats(A))
    i,s=sys.argv[1],sys.argv[2]; sf=float(sys.argv[3]) if len(sys.argv)>3 else 0.55; vf=float(sys.argv[4]) if len(sys.argv)>4 else 0.95
    im=Image.open(f'../base/{i}/cand-{s}.png').convert('RGBA'); print('cand',stats(im))
    out=tone(im,sf,vf,0.8); print('ref',stats(out)); out.save(f'../base/{i}/ref.png')
    bb=out.split()[-1].getbbox(); pad=Image.new('RGBA',(192,144),(0,0,0,0))
    pad.alpha_composite(out.crop(bb),(76-(bb[2]-bb[0])//2,136-(bb[3]-bb[1]))); pad.save(f'../base/{i}/ref-pad.png')
    print('pad bbox',pad.split()[-1].getbbox())
