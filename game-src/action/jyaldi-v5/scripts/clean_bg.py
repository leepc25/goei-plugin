# 회색 배경 제거: 가장자리에서 회색(채도 낮고 배경색 근처) 칸을 flood fill로 투명 처리
import sys,numpy as np
from PIL import Image
from collections import deque
def clean(src,dst):
    a=np.array(Image.open(src).convert('RGBA')); h,w=a.shape[:2]
    edge=[(0,x) for x in range(w)]+[(h-1,x) for x in range(w)]+[(y,0) for y in range(h)]+[(y,w-1) for y in range(h)]
    ops=np.array([a[y,x,:3] for y,x in edge if a[y,x,3]>0]).astype(int)
    ref=np.median(ops,0) if len(ops) else None
    seen=np.zeros((h,w),bool); q=deque(edge)
    while q:
        y,x=q.popleft()
        if y<0 or x<0 or y>=h or x>=w or seen[y,x]: continue
        p=a[y,x]
        if p[3]>0:
            pv=p[:3].astype(int)
            if ref is None or abs(pv-ref).sum()>36 or pv.max()-pv.min()>14: continue
        seen[y,x]=True; q.extend([(y+1,x),(y-1,x),(y,x+1),(y,x-1)])
    a[seen,3]=0
    im=Image.fromarray(a); im=im.crop(im.getbbox()); im.save(dst); return im.size
if __name__=='__main__':
    for f in sys.argv[1:]: print(f,clean(f,f.replace('cand-','clean-')))
