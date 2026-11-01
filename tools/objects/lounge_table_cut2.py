"""inpaint 결과에서 테이블만 오려 내기(색 기준, 마스크 칸 안): 나무 상판(채도 높은 황갈) 가장 큰 덩어리 + 그 아래 가운데 어두운 기둥 + 바닥 어두운 받침.
사용: python3 lounge_table_cut2.py <inpaint 전체.png> <out_table.png>"""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage
ROOT='/home/user/goei-plugin/game-src/art/pixellab-hq-20261031'
im=np.array(Image.open(sys.argv[1]).convert('RGB')).astype(int)
spec=json.load(open(f'{ROOT}/lounge_table/inpaint_spec.json')); x0,y0,x1,y1=spec['mask']
box=np.zeros(im.shape[:2],bool); box[y0:y1,x0:x1]=True
R,G,B=im[...,0],im[...,1],im[...,2]
mx=im.max(2); mn=im.min(2); sat=(mx-mn)
wood=box&(R>150)&(R>B+50)&(sat>50)&(G>90)           # 황갈 나무
dark=box&(mx<120)                                    # 어두운 금속·윤곽
lab,n=ndimage.label(wood); sizes=ndimage.sum(wood,lab,range(1,n+1)); top=lab==(1+int(np.argmax(sizes)))
top=top|(ndimage.binary_dilation(top,iterations=2)&box&(mx<90))  # 바로 붙은 검은 윤곽선 포함
top=ndimage.binary_fill_holes(top)
ys,xs=np.where(top); ty1=ys.max(); cx=int(np.median(xs))
# 기둥: 가운데 줄에서 cx를 지나는 어두운 가로 구간의 폭을 재고, 그 폭(+2) 안의 어두운 픽셀만
ymid=(ty1+y1)//2
row=dark[ymid]; l=cx
while l>x0 and row[l-1]: l-=1
r=cx
while r<x1-1 and row[r+1]: r+=1
cw=r-l+1
colband=np.zeros_like(box); colband[ty1:y1, l:r+1]=True
col=dark&colband
# 받침: 바닥 쪽(y>y1-40)의 어두운 덩어리 중 cx 포함
low=np.zeros_like(box); low[y1-40:y1, x0:x1]=True
lab3,n3=ndimage.label((mx<95)&low)
base=np.zeros_like(box)
for i in range(1,n3+1):
    c=lab3==i; yy,xx=np.where(c)
    if xx.min()<=cx<=xx.max(): base|=c
base=ndimage.binary_fill_holes(base)
m=top|col|base
yy,xx=np.where(m); bb=(xx.min(),yy.min(),xx.max()+1,yy.max()+1)
out=np.zeros((im.shape[0],im.shape[1],4),np.uint8); out[...,:3]=im; out[...,3]=np.where(m,255,0)
Image.fromarray(out[bb[1]:bb[3],bb[0]:bb[2]]).save(sys.argv[2])
print(json.dumps({'bbox':[int(v) for v in bb],'size':[int(bb[2]-bb[0]),int(bb[3]-bb[1])],'top_bottom_y':int(ty1),'cx':cx,'col_w':cw}))
