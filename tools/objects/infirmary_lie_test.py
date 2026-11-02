from PIL import Image, ImageOps
import numpy as np, sys
S=sys.argv[1]; k=float(sys.argv[2])
bg=Image.open('game-src/art/pixellab-hq-20261031/hq_b2_infirmary_p6_632x424.png').convert('RGBA')
sp=Image.open(S+'/e/76_00.png').convert('RGBA').crop((14,130,245,188))
sp=ImageOps.mirror(sp); sp=sp.resize((round(sp.width*k),round(sp.height*k)),Image.NEAREST)
# (right end x = head end, bottom y)
for rx,by in [(int(sys.argv[3]),int(sys.argv[4])),(int(sys.argv[5]),int(sys.argv[6]))]:
    bg.alpha_composite(sp,(rx-sp.width,by-sp.height))
print(sp.size)
bg.save(S+'/lie_full.png')
bg.resize((1264,848),Image.NEAREST).save(S+'/lie_x2.png')
bg.crop((390,200,632,360)).resize((968,640),Image.NEAREST).save(S+'/lie_x4.png')
