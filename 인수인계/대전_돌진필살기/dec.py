import numpy as np, sys
from PIL import Image
def load_pair(a,b):
    d1=np.frombuffer(open(a,'rb').read(),np.uint8); d2=np.frombuffer(open(b,'rb').read(),np.uint8)
    n=len(d1)//64
    d1=d1.reshape(n,4,8,2); d2=d2.reshape(n,4,8,2)   # tile, block, row, plane
    bits=np.arange(8)
    p0=(d1[...,0,None]>>bits)&1; p1=(d1[...,1,None]>>bits)&1
    p2=(d2[...,0,None]>>bits)&1; p3=(d2[...,1,None]>>bits)&1
    pix=(p0|(p1<<1)|(p2<<2)|(p3<<3)).astype(np.uint8)   # n,4,8,8
    t=np.zeros((n,16,16),np.uint8)
    t[:,0:8,8:16]=pix[:,0]; t[:,8:16,8:16]=pix[:,1]; t[:,0:8,0:8]=pix[:,2]; t[:,8:16,0:8]=pix[:,3]
    return t
if __name__=='__main__':
    for i,(a,b) in enumerate([('x/242-c1.bin','x/242-c2.bin'),('x/242-c3.bin','x/242-c4.bin'),('x/242-c5.bin','x/242-c6.bin'),('x/242-c7.bin','x/242-c8.bin')]):
        t=load_pair(a,b); np.save('tiles%d.npy'%i,t); print(i,t.shape, (t.reshape(len(t),-1).max(1)>0).mean())
