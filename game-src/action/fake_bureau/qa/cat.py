import sys
from PIL import Image
out=sys.argv[1]; ims=[Image.open(f) for f in sys.argv[2:]]
W=max(i.width for i in ims); s=Image.new('RGBA',(W,sum(i.height for i in ims)),(80,80,80,255)); y=0
for i in ims: s.paste(i,(0,y)); y+=i.height
s.save(out)
