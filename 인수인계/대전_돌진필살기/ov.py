import numpy as np, sys
from PIL import Image
lut=np.array([20]+[60+i*13 for i in range(15)],np.uint8)
for bank in range(4):
    t=np.load('tiles%d.npy'%bank,mmap_mode='r')
    per=128*8*16
    for part in range(len(t)//per):
        img=np.zeros((8*16*16,128*16),np.uint8); k=part*per
        for r in range(8):
            for c in range(128):
                blk=t[k:k+16]; k+=16
                img[r*256:(r+1)*256, c*16:(c+1)*16]=blk.reshape(256,16)
        Image.fromarray(lut[img]).resize((1024,1024),Image.BILINEAR).save('ov_%d_%02d.png'%(bank,part))
print('done')
