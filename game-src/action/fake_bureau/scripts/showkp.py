import sys,json
from PIL import Image,ImageDraw
from rig import BONES
im=Image.open(sys.argv[1]).convert('RGBA'); kp=json.load(open(sys.argv[2])); s=4
bg=Image.new('RGBA',im.size,(190,190,190,255)); bg.alpha_composite(im); bg=bg.resize((im.width*s,im.height*s),Image.NEAREST); d=ImageDraw.Draw(bg)
for a,b in BONES:
    c=(255,0,0,255) if 'RIGHT' in a+b else (0,90,255,255) if 'LEFT' in a+b else (0,160,0,255)
    d.line([(kp[a][0]*s,kp[a][1]*s),(kp[b][0]*s,kp[b][1]*s)],fill=c,width=3)
for k,v in kp.items(): d.ellipse([v[0]*s-4,v[1]*s-4,v[0]*s+4,v[1]*s+4],outline=(255,255,0,255))
bg.save(sys.argv[3])
