"""물건 톤을 다른 물건(책상)에 맞춘다: 빛나는 화면·장치(채도·밝기 높은 픽셀)는 그대로 두고, 나머지 불투명 픽셀의 RGB 평균·분산을 기준 물건과 같게 (사용자 11-02 10:27 「코드로 책상이랑 톤 맞춰」).
사용: python3 tone_match.py <물건.png> <출력.png> <기준1.png> [기준2.png ...]  STRENGTH=0..1(기본 1)"""
import os, sys
import numpy as np
from PIL import Image
def load(p):
    a=np.asarray(Image.open(p).convert('RGBA')).astype(float); return a
def body(a):
    rgb=a[:,:,:3]/255; mx=rgb.max(2); mn=rgb.min(2); s=np.where(mx>0,(mx-mn)/np.maximum(mx,1e-6),0)
    glow=(s>0.45)&(mx>0.5)
    return (a[:,:,3]>0)&~glow
src=load(sys.argv[1]); refs=[load(p) for p in sys.argv[3:]]
R=np.concatenate([r[body(r)][:,:3] for r in refs]); m=body(src); X=src[m][:,:3]
k=float(os.environ.get('STRENGTH',1))
Y=(X-X.mean(0))/(X.std(0)+1e-6)*R.std(0)+R.mean(0)
out=src.copy(); out[m,:3]=np.clip(X*(1-k)+Y*k,0,255)
Image.fromarray(out.round().astype(np.uint8)).save(sys.argv[2])
print('src mean',X.mean(0).round(1),'ref mean',R.mean(0).round(1))
