"""눈 흰자를 검은 눈으로 덮기(사용자 11-10 「둘다 코드로 해봐」, 놀람 클립). 진행자 설정: 눈동자가 기이하게 큰 검은 눈.
얼굴 칸에서 눈 크기(38~75px, 너비 8~14, 높이 4~10)의 어두운 덩어리(눈 테두리+눈동자)를 눈으로 봄. 눈썹은 더 작아 빠짐.
눈 덩어리의 줄마다 가장 왼쪽~오른쪽 어두운 점 사이의 밝은 픽셀(흰자)을 검게 칠함. 광채도 같이 칠함(사용자 11-10, KEEP_GLINT).
사용: python3 blacken_eyes.py <in_dir> <out_dir>"""
import sys, os, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from clean_clip_specks import label
BOX=(85,25,165,80)
KEEP_GLINT=False  # 사용자 11-10: 광채 남으면 어색 → 같이 칠함
def fix(a):
    a=a.copy(); x0,y0,x1,y1=BOX
    mx=a[...,:3].max(-1); dark=(mx<60)&(a[...,3]>0)
    lab,n=label(dark[y0:y1,x0:x1]); H,W=lab.shape; comps=[]
    for k in range(1,n+1):
        ys,xs=np.where(lab==k)
        if not (38<=len(ys)<=75): continue
        if ys.min()==0 or xs.min()==0 or ys.max()==H-1 or xs.max()==W-1: continue
        w,h=xs.max()-xs.min()+1, ys.max()-ys.min()+1
        if not (8<=w<=14 and 4<=h<=10): continue
        comps.append((xs.mean(),ys.mean(),ys+y0,xs+x0))
    cnt=0; eyes=[]; boxes=[]
    for c in comps:
        ys,xs=c[2],c[3]; eyes.append((int(xs.min()),int(ys.min()))); boxes.append((int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())))
        span=np.zeros_like(dark)
        for y in np.unique(ys):
            row=xs[ys==y]; l,r=row.min(),row.max()
            # 테두리 밖으로 삐져나온 흰자: 같은 줄에서 3칸 안에 테두리선(밝기 200 미만)으로 막혀 있을 때만 그 사이를 칠함
            for st in (-1,1):
                x=l-1 if st<0 else r+1; run=[]
                for _ in range(4):
                    if mx[y,x]<200: break
                    run.append(x); x+=st
                if mx[y,x]<200 and len(run)<=3:  # 바깥 테두리로 막힌 경우만(살로 번지지 않게)
                    for xx in run: span[y,xx]=True
            span[y,l:r+1]=True
        lt=span&(mx>=60)
        # 눈동자 속 광채(어두운 점에 사방이 둘러싸인 작은 밝은 점)는 남김
        ll,ln=label(lt)
        for k in range(1,ln+1):
            m=ll==k; p=np.pad(m,1)
            ring=(p[:-2,1:-1]|p[2:,1:-1]|p[1:-1,:-2]|p[1:-1,2:])&~m
            if KEEP_GLINT and m.sum()<=4 and dark[ring].all() and (mx[m]>=235).all(): continue
            a[m,:3]=(1,1,1); cnt+=int(m.sum())
    # 눈 칸(+2) 안에서 세 방향 이상이 검게 막힌 남은 점(찌꺼기)은 같이 칠함, 3번 되풀이
    for (ex0,ey0,ex1,ey1) in boxes:
        for _ in range(3):
            blk=(a[...,:3].max(-1)<60)&(a[...,3]>0); ch=[]
            for y in range(ey0-2,ey1+3):
                for x in range(ex0-2,ex1+3):
                    if blk[y,x]: continue
                    if int(blk[y-1,x])+int(blk[y+1,x])+int(blk[y,x-1])+int(blk[y,x+1])>=3: ch.append((y,x))
            if not ch: break
            for y,x in ch: a[y,x,:3]=(1,1,1); cnt+=1
    return a,cnt,eyes
if __name__=='__main__':
    i,o=sys.argv[1:3]; os.makedirs(o,exist_ok=True)
    for f in sorted(os.listdir(i)):
        if f.endswith('.png'):
            a,c,e=fix(np.array(Image.open(f'{i}/{f}').convert('RGBA'))); Image.fromarray(a).save(f'{o}/{f}'); print(f,c,e)
