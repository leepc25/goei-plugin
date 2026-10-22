# 검수 시트: 클립별로 장을 나란히(×3) + 장마다 수치. 사용: python3 qa.py 출력.png 클립...  (클립 없으면 전부 수치만 출력)
# 수치: 발 = 불투명 맨 아래 y(서 있는 장 135~136), 키 = 높이, 금 = 금색 눈 px, 이색 = 팔레트 밖 진한 색 px(소품·효과 의심)
import sys,os,colorsys
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,'.'); import rig
D='../full/clips'
def frames(k):
    d=f'{D}/{k}'
    if not os.path.isdir(d): return []
    fs=[Image.open(f'{d}/{f}').convert('RGBA') for f in sorted(os.listdir(d)) if f.endswith('.png')]
    return fs[:-1] if k in rig.CLIPS and len(fs)==len(rig.CLIPS[k][2]) and len(fs)>3 else fs
def metrics(im):
    a=np.array(im).astype(int); al=a[:,:,3]>40
    if not al.any(): return dict(foot=-1,h=0,gold=0,odd=0,blob=0)
    ys,xs=np.where(al)
    rgb=a[:,:,:3]/255.0; mx=rgb.max(2); mn=rgb.min(2); s=np.where(mx>0,(mx-mn)/np.maximum(mx,1e-6),0)
    r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
    gold=al&(r>0.6)&(g>0.5)&(b<0.45)&(r-b>0.3)
    # 이색: 채도 높고, 피부(주황 기 약함)·금·보라 머리가 아닌 색
    hue=np.zeros_like(r)
    import colorsys as cs
    odd=0
    for y,x in zip(*np.where(al&(s>0.5)&(mx>0.35))):
        h,_,_=cs.rgb_to_hsv(*rgb[y,x]); 
        if not (h<0.11 or 0.1<=h<=0.17 or 0.7<=h<=0.92): odd+=1
    # 떨어진 덩어리: 가장 큰 덩어리 밖 불투명 px
    from collections import deque
    seen=np.zeros_like(al); best=0; tot=al.sum()
    for y0,x0 in zip(ys,xs):
        if seen[y0,x0]: continue
        q=deque([(y0,x0)]); seen[y0,x0]=1; n=0
        while q:
            y,x=q.popleft(); n+=1
            for dy,dx in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)):
                yy,xx=y+dy,x+dx
                if 0<=yy<144 and 0<=xx<192 and al[yy,xx] and not seen[yy,xx]: seen[yy,xx]=1; q.append((yy,xx))
        best=max(best,n)
    return dict(foot=int(ys.max()),h=int(ys.max()-ys.min()+1),gold=int(gold.sum()),odd=odd,blob=int(tot-best))
if __name__=='__main__':
    out=sys.argv[1]; ks=sys.argv[2:]
    if out=='-':
        for k in rig.CLIPS:
            fs=frames(k)
            if not fs: continue
            ms=[metrics(f) for f in fs]
            flag=[]
            if any(m['odd']>12 for m in ms): flag.append('이색')
            if any(m['blob']>25 for m in ms): flag.append('덩어리')
            if any(m['gold']==0 for m in ms): flag.append('금0')
            print(k, len(fs), 'foot',sorted(set(m['foot'] for m in ms)), 'h',min(m['h'] for m in ms),'-',max(m['h'] for m in ms),
                  'odd',max(m['odd'] for m in ms),'blob',max(m['blob'] for m in ms),'gold',[m['gold'] for m in ms], ' '.join(flag))
        sys.exit()
    Z=3; rows=[]
    for k in ks:
        fs=frames(k)
        if not fs: continue
        bb=[f.split()[-1].getbbox() for f in fs]; bb=[b for b in bb if b]
        x0=max(0,min(b[0] for b in bb)-4); x1=min(192,max(b[2] for b in bb)+4); y0=max(0,min(b[1] for b in bb)-4); y1=140
        rows.append((k,[f.crop((x0,y0,x1,y1)) for f in fs],[metrics(f) for f in fs],y1-y0))
    W=max(sum(c.width*Z+6 for c in r[1]) for r in rows)+110
    H=sum(r[3]*Z+22 for r in rows)
    sh=Image.new('RGBA',(W,H),(58,68,76,255)); d=ImageDraw.Draw(sh); y=0
    for k,cs,ms,h in rows:
        d.text((4,y+4),k,fill=(255,230,120)); x=110
        for c,m in zip(cs,ms):
            sh.alpha_composite(c.resize((c.width*Z,c.height*Z),Image.NEAREST),(x,y+18))
            d.text((x,y+4),f"{m['foot']} g{m['gold']} o{m['odd']} b{m['blob']}",fill=(200,220,240))
            x+=c.width*Z+6
        y+=h*Z+22
    sh.save(out); print(out,sh.size)
