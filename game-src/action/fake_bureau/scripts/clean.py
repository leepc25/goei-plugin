# 생성기가 멋대로 그린 효과(불꽃·불빛·불티·연기 조각) 지우기: 불 색(채도>0.58, 색상 0~60도, 명도>0.55) 화소 제거 후
# 가장 큰 덩어리(8방향 연결)와, 그 덩어리 바운딩 박스 근처의 큰 조각(칼·총이 몸과 떨어져 보이는 경우)만 남김.
import colorsys
from PIL import Image
def firey(c):
    h,s,v=colorsys.rgb_to_hsv(*[q/255 for q in c]); return s>0.5 and h*360<=62 and v>0.6
def bloody(c):  # 피(채도 높은 빨강) — 칼 털기 프롬프트가 그려 넣는 핏자국
    h,s,v=colorsys.rgb_to_hsv(*[q/255 for q in c]); return s>0.55 and (h*360<=12 or h*360>=340) and v>0.22
def comps(px,W,H):
    seen=set(); out=[]
    for y in range(H):
        for x in range(W):
            if (x,y) in seen or px[x,y][3]<=128: continue
            st=[(x,y)]; seen.add((x,y)); cur=[]
            while st:
                a,b=st.pop(); cur.append((a,b))
                for dx in (-1,0,1):
                    for dy in (-1,0,1):
                        q=(a+dx,b+dy)
                        if 0<=q[0]<W and 0<=q[1]<H and q not in seen and px[q][3]>128: seen.add(q); st.append(q)
            out.append(cur)
    return sorted(out,key=len,reverse=True)
def palette(im):
    return list({p[:3] for p in im.convert('RGBA').getdata() if p[3]>128})
def near(c,pal,tol=16):
    return any(abs(c[0]-q[0])+abs(c[1]-q[1])+abs(c[2]-q[2])<=tol for q in pal)
def _dseg(p,a,b):
    ax,ay=a; bx,by=b; dx,dy=bx-ax,by-ay; L=dx*dx+dy*dy or 1
    t=max(0,min(1,((p[0]-ax)*dx+(p[1]-ay)*dy)/L)); return ((p[0]-ax-t*dx)**2+(p[1]-ay-t*dy)**2)**0.5
def skinstray(im,kp,r=7):
    """살·불 색(채도>0.3, 색상<70도, 명도>0.45) 화소 중 머리·목·아래팔·몸통 뼈에서 먼 것 = 생성기가 그린 불빛 → 지움."""
    im=im.convert('RGBA'); px=im.load(); n=0
    segs=[(kp['NOSE'],kp['NECK'],12),(kp['NECK'],kp['NECK'],13)]
    for sd in ('RIGHT','LEFT'):
        segs+= [(kp[f'{sd} ELBOW'],kp[f'{sd} ARM'],r),(kp[f'{sd} SHOULDER'],kp[f'{sd} ELBOW'],r)]
        segs+= [(kp['NECK'],kp[f'{sd} HIP'],9)]
    for y in range(im.height):
        for x in range(im.width):
            p=px[x,y]
            if p[3]<=128: continue
            h,s,v=colorsys.rgb_to_hsv(*[q/255 for q in p[:3]])
            if s>0.3 and h*360<70 and v>0.45 and all(_dseg((x,y),a,b)>rr for a,b,rr in segs): px[x,y]=(0,0,0,0); n+=1
    return im,n
def clean(im,fire=True,minpart=40,pal=None,kp=None):
    im=im.convert('RGBA'); px=im.load(); W,H=im.size; n=0
    if fire:
        for y in range(H):
            for x in range(W):
                p=px[x,y]
                if p[3]>128 and (firey(p[:3]) or bloody(p[:3])) and not (pal and near(p[:3],pal)): px[x,y]=(0,0,0,0); n+=1
    if kp: im,m=skinstray(im,kp); px=im.load(); n+=m
    cs=comps(px,W,H)
    for c in cs[1:]:
        vs=sorted(colorsys.rgb_to_hsv(*[q/255 for q in px[p][:3]])[2] for p in c)
        if len(c)<minpart or vs[len(vs)//2]>0.4:      # 작은 조각, 또는 떨어진 밝은 조각(연기·불빛) — 떨어진 칼·총(어두움)은 남김
            for q in c: px[q]=(0,0,0,0); n+=1
    return im,n
if __name__=='__main__':
    import sys
    for f in sys.argv[1:]:
        im,n=clean(Image.open(f)); im.save(f.replace('.png','.clean.png')); print(f,n)
def unspray(im,wrist_x,margin=7):
    """소각부대: 노즐 앞 분사 구름(밝은 무채색·불 색) 지우기. 손목보다 margin 이상 앞에 있는 밝은 화소."""
    im=im.convert('RGBA'); px=im.load(); n=0
    for y in range(im.height):
        for x in range(int(wrist_x+margin),im.width):
            p=px[x,y]
            if p[3]<=128: continue
            h,s,v=colorsys.rgb_to_hsv(*[q/255 for q in p[:3]])
            if (v>0.3 and s<0.3) or firey(p[:3]): px[x,y]=(0,0,0,0); n+=1
    im,m=clean(im,fire=False,minpart=40)
    return im,n+m
def bodyonly(im,kp,r=11,keepdark=True):
    """다른 사람·들고 있는 물건 지우기: 뼈대에서 r보다 먼 화소들을 덩어리로 묶어, 가늘고 어두운 덩어리(칼집)만 남기고 지움."""
    from rig import BONES
    im=im.convert('RGBA'); px=im.load(); W,H=im.size
    segs=[(kp[a],kp[b]) for a,b in BONES]
    hc=((kp['NOSE'][0]+kp['RIGHT EAR'][0])/2,(kp['NOSE'][1]+kp['RIGHT EAR'][1])/2)
    far=set()
    for y in range(H):
        for x in range(W):
            if px[x,y][3]<=128: continue
            if ((x-hc[0])**2+(y-hc[1])**2)**0.5<=15: continue
            if min(_dseg((x,y),a,b) for a,b in segs)>r: far.add((x,y))
    seen=set(); n=0
    for s0 in list(far):
        if s0 in seen: continue
        st=[s0]; seen.add(s0); cur=[]
        while st:
            a,b=st.pop(); cur.append((a,b))
            for dx in (-1,0,1):
                for dy in (-1,0,1):
                    q=(a+dx,b+dy)
                    if q in far and q not in seen: seen.add(q); st.append(q)
        vs=sorted(colorsys.rgb_to_hsv(*[c/255 for c in px[p][:3]])[2] for p in cur)
        xs=[p[0] for p in cur]; ys=[p[1] for p in cur]
        thin=len(cur)<=3.2*max(max(xs)-min(xs)+1,max(ys)-min(ys)+1)
        if keepdark and thin and vs[len(vs)//2]<0.3: continue
        for q in cur: px[q]=(0,0,0,0); n+=1
    im,m=clean(im,fire=False,minpart=40)
    return im,n+m
