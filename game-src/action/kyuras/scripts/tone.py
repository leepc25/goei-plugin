# 쟈알디와 톤 맞추기(코드, PixelLab 0회). 사용자 2026-10-22 "쟈알디를 이미 만들어 놨기 때문에 톤이 맞아야".
# - 외곽선: 거의 검정(L<0.035) → 쟈알디처럼 순검정 #000000
# - 정장(색상 180~215°, 채도<0.25, 명도 0.035~0.5): 명도 순위를 쟈알디 기준 장의 정장 픽셀 분포에 맞춘 뒤(히스토그램 맞춤) 쟈알디 정장 색으로만 칠함
# - 머리(색상 70~160°, 채도<0.3): 회록 5단으로(명도 순위 유지)
# - 피부·셔츠·눈은 그대로
# 사용: python3 tone.py 입력.png 출력.png [기준 쟈알디 장]  |  모듈로 쓰면 fit(im) → (im, 통계)
import sys,os,colorsys
from PIL import Image
HERE=os.path.dirname(os.path.abspath(__file__))
JREF=os.path.join(HERE,'..','..','jyaldi-v5','full','clips','idle','00.png')
HAIR=['#2b3528','#3b4836','#4d5e46','#617558','#7a8f6e']
hx=lambda s:(int(s[1:3],16),int(s[3:5],16),int(s[5:7],16))
def hls(c): return colorsys.rgb_to_hls(c[0]/255,c[1]/255,c[2]/255)
def is_suit(c):
    h,l,s=hls(c); return (0.035<=l<=0.5 and s<0.25 and (175<=h*360<=220 or s<0.04) )
def is_hair(c):
    h,l,s=hls(c); return 60<=h*360<=170 and s<0.35 and 0.1<l<0.75
def suit_dist(ref):
    px=[p[:3] for p in ref.getdata() if p[3]>0 and is_suit(p[:3])]
    px.sort(key=lambda c:hls(c)[1]); return px
def fit(im,ref=None):
    ref=(ref or Image.open(JREF)).convert('RGBA'); im=im.convert('RGBA')
    target=suit_dist(ref)
    W,H=im.size; P=im.load()
    suit=[(x,y) for y in range(H) for x in range(W) if P[x,y][3]>0 and is_suit(P[x,y][:3])]
    hair=[(x,y) for y in range(H) for x in range(W) if P[x,y][3]>0 and is_hair(P[x,y][:3])]
    out=im.copy(); O=out.load()
    # 외곽선
    nout=0
    for y in range(H):
        for x in range(W):
            p=P[x,y]
            if p[3]>0 and hls(p[:3])[1]<0.035: O[x,y]=(0,0,0,255); nout+=1
    # 정장: 명도 순위 → 쟈알디 분포의 같은 분위 색
    suit.sort(key=lambda q:hls(P[q][:3])[1])
    for i,q in enumerate(suit):
        c=target[min(len(target)-1,int(i/len(suit)*len(target)))]; O[q]=c+(255,)
    # 머리
    hair.sort(key=lambda q:hls(P[q][:3])[1])
    for i,q in enumerate(hair):
        O[q]=hx(HAIR[min(4,int(i/len(hair)*5))])+(255,)
    return out,dict(outline=nout,suit=len(suit),hair=len(hair))
def stats(im):
    im=im.convert('RGBA'); px=[p[:3] for p in im.getdata() if p[3]>0]
    L=[hls(c)[1] for c in px]; S=[hls(c)[2] for c in px]
    bb=im.getbbox(); cols=len(set(px))
    return dict(h=bb[3]-bb[1],w=bb[2]-bb[0],colors=cols,meanL=round(sum(L)/len(L),3),meanS=round(sum(S)/len(S),3),black=sum(1 for c in px if c==(0,0,0)))
if __name__=='__main__':
    src,dst=sys.argv[1],sys.argv[2]
    out,st=fit(Image.open(src),Image.open(sys.argv[3]) if len(sys.argv)>3 else None)
    out.save(dst); print(st,'\nref',stats(Image.open(JREF)),'\nsrc',stats(Image.open(src)),'\nout',stats(out))
