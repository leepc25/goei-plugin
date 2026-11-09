import numpy as np
from PIL import Image
from vr import load
T=np.concatenate([np.load('tiles%d.npy'%i,mmap_mode='r') for i in range(4)])
def col(w):
    r=((w>>8)&0xf)<<1|((w>>14)&1); g=((w>>4)&0xf)<<1|((w>>13)&1); b=(w&0xf)<<1|((w>>12)&1)
    dark=(w>>15)&1
    f=lambda v:int(v*255/31*(0.9 if dark else 1))
    return (f(r),f(g),f(b))
def render(n,spr,nspr,h):
    scb1,_,_,_,pal=load(n)
    im=Image.new('RGBA',(16*nspr,16*h),(0,0,0,0)); px=im.load(); pals=set(); used=set()
    for s in range(nspr):
        for t in range(h):
            a=scb1[spr+s][t*2]; b=scb1[spr+s][t*2+1]
            tile=a|(((b>>4)&0xf)<<16); p=b>>8; hf=b&1; vf=(b>>1)&1
            if not tile: continue
            tl=T[tile]
            if hf: tl=tl[:,::-1]
            if vf: tl=tl[::-1,:]
            for y in range(16):
                for x in range(16):
                    c=int(tl[y,x])
                    if c: px[s*16+x,t*16+y]=col(pal[p*16+c])+(255,); used.add((p,c))
    return im,used
