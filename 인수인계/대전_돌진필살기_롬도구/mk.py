import sys,glob
from PIL import Image
fs=sorted(glob.glob(sys.argv[1]+'/**/*.png',recursive=True))
a,b,out=int(sys.argv[2]),int(sys.argv[3]),sys.argv[4]
sel=fs[a:b];cols=8;W,H=320,224
rows=(len(sel)+cols-1)//cols
m=Image.new('RGB',(W*cols,H*rows))
from PIL import ImageDraw
for i,f in enumerate(sel):
  im=Image.open(f).convert('RGB');ImageDraw.Draw(im).text((150,30),str(a+i),fill=(255,0,255))
  m.paste(im,((i%cols)*W,(i//cols)*H))
m.save(out)
