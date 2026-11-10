"""놀람 클립 눈을 원래 진행자 눈(첫 장 f00) 모양으로 옮겨 붙이기(사용자 11-10: 칠한 눈 거절).
각 장의 눈 위치(blacken_eyes와 같은 눈 덩어리 찾기)에 f00 눈 칸(눈 덩어리 둘레 +M px)을 가운데 맞춰 붙임.
사용: python3 paste_orig_eyes.py <in_dir> <out_dir> [M]"""
import sys, os, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from clean_clip_specks import label
BOX=(85,25,165,80)
def eyes(a):
    x0,y0,x1,y1=BOX; mx=a[...,:3].max(-1); dark=(mx<60)&(a[...,3]>0)
    lab,n=label(dark[y0:y1,x0:x1]); H,W=lab.shape; out=[]
    for k in range(1,n+1):
        ys,xs=np.where(lab==k)
        if not (38<=len(ys)<=75): continue
        if ys.min()==0 or xs.min()==0 or ys.max()==H-1 or xs.max()==W-1: continue
        w,h=xs.max()-xs.min()+1, ys.max()-ys.min()+1
        if not (8<=w<=14 and 4<=h<=10): continue
        out.append((xs.min()+x0,ys.min()+y0,xs.max()+x0,ys.max()+y0))
    return sorted(out)
if __name__=='__main__':
    i,o=sys.argv[1:3]; M=int(sys.argv[3]) if len(sys.argv)>3 else 2
    os.makedirs(o,exist_ok=True)
    ref=np.array(Image.open(f'{i}/f00.png').convert('RGBA')); re=eyes(ref)
    for f in sorted(os.listdir(i)):
        if not f.endswith('.png'): continue
        a=np.array(Image.open(f'{i}/{f}').convert('RGBA')); e=eyes(a)
        if f in('f00.png','f16.png') or len(e)!=2: Image.fromarray(a).save(f'{o}/{f}'); print(f,'skip',e); continue
        for (rx0,ry0,rx1,ry1),(ex0,ey0,ex1,ey1) in zip(re,e):
            # 아래·가운데 맞춤
            dx=round((ex0+ex1)/2-(rx0+rx1)/2); dy=ey1-ry1
            p=ref[ry0-M:ry1+M+1, rx0-M:rx1+M+1]
            ty,tx=ry0-M+dy, rx0-M+dx
            a[ty:ty+p.shape[0], tx:tx+p.shape[1]]=p
        Image.fromarray(a).save(f'{o}/{f}'); print(f,e)
