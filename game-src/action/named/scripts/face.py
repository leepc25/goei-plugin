# 장마다 실제 그림에서 얼굴(살색 덩어리)을 찾아 가면 기준점을 정한다. 뼈대 머리 점은 출발점으로만 쓴다.
import colorsys
from PIL import Image
def skin(p):
    if p[3]<200: return False
    h,s,v=colorsys.rgb_to_hsv(*[q/255 for q in p[:3]])
    return (h<0.12 or h>0.95) and 0.12<s<0.65 and v>0.5
def find(im,hint=None,r=16):
    """im: RGBA 192x144. hint: 뼈대 코 점(x,y). 돌려줌: (눈x, 눈y, 얼굴폭) 또는 None"""
    W,H=im.size; px=im.load()
    if hint: x0,x1,y0,y1=max(0,hint[0]-r),min(W,hint[0]+r),max(0,hint[1]-r),min(H,hint[1]+r)
    else:
        b=im.split()[-1].getbbox()
        if not b: return None
        x0,x1,y0,y1=b[0],b[2],b[1],b[1]+(b[3]-b[1])//4
    pts=[(x,y) for y in range(y0,y1) for x in range(x0,x1) if skin(px[x,y])]
    if len(pts)<8: return None
    # 가장 큰 덩어리(손이 얼굴 근처에 올 때 대비): 4-연결
    S=set(pts); best=[]
    while S:
        st=[S.pop()]; comp=[]
        while st:
            q=st.pop(); comp.append(q)
            for d in ((1,0),(-1,0),(0,1),(0,-1)):
                n=(q[0]+d[0],q[1]+d[1])
                if n in S: S.remove(n); st.append(n)
        if len(comp)>len(best): best=comp
    xs=[p[0] for p in best]; ys=[p[1] for p in best]
    top,bot=min(ys),max(ys); fw=max(xs)-min(xs)+1; B=set(best)
    # 눈 = 살색 줄 가운데가 끊긴 줄(살-눈-살). 위에서부터 첫 번째로 끊긴 줄들의 덩어리 중심.
    hits=[]
    for y in range(top,min(bot,top+16)):
        row=sorted(x for x in xs_at(B,y))
        if len(row)<2: continue
        gap=[x for x in range(row[0]+1,row[-1]) if (x,y) not in B]
        if gap: hits.append((y,gap))
    if hits:
        y0=hits[0][0]; g=[(y,x) for y,gs in hits if y<=y0+2 for x in gs]
        ey=round(sum(p[0] for p in g)/len(g)); ex=max(p[1] for p in g)
    else:
        ey=top+3; ex=max(xs)-2
    return ex,ey,fw
def xs_at(B,y): return [p[0] for p in B if p[1]==y]
