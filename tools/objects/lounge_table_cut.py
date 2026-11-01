"""inpaint 결과에서 테이블만 오려 내기: 마스크 칸 안에서 원본 p8s와 다른 픽셀을 찾고, 가장 큰 덩어리(테이블)만 남겨 투명 png로.
사용: python3 lounge_table_cut.py <inpaint 전체.png> <out_table.png> [차이 문턱=40]"""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage
ROOT='/home/user/goei-plugin/game-src/art/pixellab-hq-20261031'
res=np.array(Image.open(sys.argv[1]).convert('RGB')).astype(int); org=np.array(Image.open(f'{ROOT}/hq_lounge_p8s.png').convert('RGB')).astype(int)
TH=int(sys.argv[3]) if len(sys.argv)>3 else 40
spec=json.load(open(f'{ROOT}/lounge_table/inpaint_spec.json')); x0,y0,x1,y1=spec['mask']
diff=np.abs(res-org).sum(2)>TH
m=np.zeros_like(diff); m[y0:y1,x0:x1]=diff[y0:y1,x0:x1]
m=ndimage.binary_closing(m,iterations=2); m=ndimage.binary_fill_holes(m)
lab,n=ndimage.label(m); sizes=ndimage.sum(m,lab,range(1,n+1)); keep=lab==(1+int(np.argmax(sizes)))
ys,xs=np.where(keep); bb=(xs.min(),ys.min(),xs.max()+1,ys.max()+1)
out=np.zeros((res.shape[0],res.shape[1],4),np.uint8); out[...,:3]=res; out[...,3]=np.where(keep,255,0)
Image.fromarray(out[bb[1]:bb[3],bb[0]:bb[2]]).save(sys.argv[2])
print(json.dumps({'bbox':[int(v) for v in bb],'size':[int(bb[2]-bb[0]),int(bb[3]-bb[1])],'pieces':int(n),'changed_px_outside_mask':int((diff&~np.pad(np.ones((y1-y0,x1-x0),bool),((y0,res.shape[0]-y1),(x0,res.shape[1]-x1)))).sum())}))
