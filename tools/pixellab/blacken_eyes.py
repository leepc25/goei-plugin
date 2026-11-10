"""눈 흰자를 검은 눈으로 덮기(사용자 11-10 「둘다 코드로 해봐」, 놀람 클립). 진행자 설정: 눈동자가 기이하게 큰 검은 눈.
얼굴 칸에서 눈 크기(38~75px, 너비 8~14, 높이 4~10)의 어두운 덩어리(눈 테두리+눈동자)를 눈으로 봄. 눈썹은 더 작아 빠짐.
눈 덩어리의 줄마다 가장 왼쪽~오른쪽 어두운 점 사이의 밝은 픽셀을 검게 칠함.
사용: python3 blacken_eyes.py <in_dir> <out_dir>"""
import sys, os, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from clean_clip_specks import label
BOX=(85,25,165,80)
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
    cnt=0; eyes=[]
    for c in comps:
        ys,xs=c[2],c[3]; eyes.append((int(xs.min()),int(ys.min())))
        for y in np.unique(ys):
            row=xs[ys==y]; l,r=row.min(),row.max()
            for x in range(l,r+1):
                if mx[y,x]>=60: a[y,x,:3]=(1,1,1); cnt+=1
    return a,cnt,eyes
if __name__=='__main__':
    i,o=sys.argv[1:3]; os.makedirs(o,exist_ok=True)
    for f in sorted(os.listdir(i)):
        if f.endswith('.png'):
            a,c,e=fix(np.array(Image.open(f'{i}/{f}').convert('RGBA'))); Image.fromarray(a).save(f'{o}/{f}'); print(f,c,e)
