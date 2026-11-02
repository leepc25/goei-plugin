import sys
from PIL import Image
import numpy as np
X0,X1=int(sys.argv[1]),int(sys.argv[2])
im=Image.open('hq_b1_training_p2_632x424.png').convert('RGBA')
res=np.array(Image.open('hq_b1_training_ext1R_v2_window.png').convert('RGBA')).astype(int)
keep,new=260,252; h=im.height
orig=np.array(im.crop((im.width-keep,0,im.width,h))).astype(int)
cost=np.abs(res[:,X0:X1,:3]-orig[:,X0:X1,:3]).sum(2).astype(float)
H,W=cost.shape; M=cost.copy(); back=np.zeros((H,W),int)
for y in range(1,H):
    for x in range(W):
        lo,hi=max(0,x-1),min(W,x+2); k=np.argmin(M[y-1,lo:hi])+lo; back[y,x]=k; M[y,x]+=M[y-1,k]
x=int(np.argmin(M[-1])); seam=[0]*H
for y in range(H-1,-1,-1): seam[y]=x+X0; x=back[y,x]
win=res.copy()
for y in range(h): win[y,:seam[y]]=orig[y,:seam[y]]
print(min(seam),max(seam))
out=Image.new('RGBA',(im.width+new,h)); out.paste(im,(0,0)); out.paste(Image.fromarray(win.astype('uint8')),(im.width-keep,0))
out.save('hq_b1_training_ext1R_v2.png')
bg=out.resize((out.width*2,h*2),Image.NEAREST)
bg.crop((900,0,1300,848)).save('/tmp/claude-0/-home-user-goei-plugin/b5d99c76-9bd9-5ee6-8ee4-74ea3a39b257/scratchpad/seam.png')
e=Image.open('/tmp/claude-0/-home-user-goei-plugin/b5d99c76-9bd9-5ee6-8ee4-74ea3a39b257/scratchpad/eileen_cut.png'); e=e.crop(e.getbbox())
bg.alpha_composite(e,(1450,842-e.size[1])); bg.convert('RGB').save('hq_b1_training_ext1R_v2_with_eileen.png')
