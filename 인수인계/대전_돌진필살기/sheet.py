import numpy as np, sys
from PIL import Image
bank,start,cols,rows,colh=map(int,sys.argv[1:6]); out=sys.argv[6]
t=np.load('tiles%d.npy'%bank,mmap_mode='r')
# 연속 타일을 세로 줄(colh개)로 쌓음
W=cols*16; H=rows*colh*16; img=np.zeros((H,W),np.uint8)
k=start
for r in range(rows):
    for c in range(cols):
        for j in range(colh):
            if k<len(t): img[(r*colh+j)*16:(r*colh+j+1)*16, c*16:(c+1)*16]=t[k]
            k+=1
lut=np.array([20]+[60+i*13 for i in range(15)],np.uint8)
Image.fromarray(lut[img]).save(out); print(out, k)
