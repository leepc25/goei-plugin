# 사용: python3 join.py <anim_dir> <full.png> <out_prefix>
# 왼쪽(L) 상자 x132~388, 오른쪽(R) x207~463, y140~310. 겹침 x207~388에서
# 두 동작 모든 장에서 원본과 같은(안 움직인) 픽셀을 따라 위→아래 이음선(최소비용 경로).
import sys, glob, numpy as np
from PIL import Image, ImageDraw
A, full, outp = sys.argv[1:4]
Lb=(132,140,388,310); Rb=(207,140,463,310)
Lf=[np.array(Image.open(f).convert('RGB')).astype(int) for f in sorted(glob.glob(A+'/L/f*.png'))]
Rf=[np.array(Image.open(f).convert('RGB')).astype(int) for f in sorted(glob.glob(A+'/R/f*.png'))]
n=min(len(Lf),len(Rf)); print('frames L',len(Lf),'R',len(Rf))
base=np.array(Image.open(full).convert('RGB')).astype(int)
ox0,ox1=Rb[0],Lb[2]; H=Lb[3]-Lb[1]; W=ox1-ox0
orig=base[Lb[1]:Lb[3],ox0:ox1]
cost=np.zeros((H,W))
for i in range(n):
    l=Lf[i][:,ox0-Lb[0]:ox1-Lb[0]]; r=Rf[i][:,0:W]
    cost+=np.abs(l-orig).sum(2)+np.abs(r-orig).sum(2)+np.abs(l-r).sum(2)
# 최소비용 세로 경로(한 줄에 좌우 1칸씩 이동)
acc=cost.copy(); bk=np.zeros((H,W),int)
for y in range(1,H):
    for x in range(W):
        lo,hi=max(0,x-1),min(W,x+2); j=lo+int(np.argmin(acc[y-1,lo:hi])); bk[y,x]=j; acc[y,x]+=acc[y-1,j]
seam=[0]*H; seam[-1]=int(np.argmin(acc[-1]))
for y in range(H-1,0,-1): seam[y-1]=bk[y,seam[y]]
print('seam cost', round(acc[-1].min()), 'per-row mean', round(acc[-1].min()/H,1), 'x range', ox0+min(seam), ox0+max(seam))
frames=[]
for i in range(n):
    f=base.copy()
    for y in range(H):
        sx=ox0+seam[y]; Y=Lb[1]+y
        f[Y,Lb[0]:sx]=Lf[i][y,0:sx-Lb[0]]
        f[Y,sx:Rb[2]]=Rf[i][y,sx-Rb[0]:]
    frames.append(Image.fromarray(f.astype('uint8')))
s=2
big=[fr.resize((fr.width*s,fr.height*s),Image.NEAREST) for fr in frames]
big[0].save(outp+'.gif',save_all=True,append_images=big[1:],duration=120,loop=0)
# 이음선 표시 그림
m=frames[0].copy(); d=ImageDraw.Draw(m)
for y in range(H): d.point((ox0+seam[y],Lb[1]+y),fill=(0,255,0))
m.resize((m.width*3,m.height*3),Image.NEAREST).crop((100*3,130*3,495*3,320*3)).save(outp+'_seam.png')
import json; json.dump({'seam_x':[int(ox0+v) for v in seam],'y0':Lb[1]},open(A+'/seam.json','w'))
