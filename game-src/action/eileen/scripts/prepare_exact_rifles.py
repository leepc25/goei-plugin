"""Prepare guarded coordinates for PixelLab's free edit tool; does not render edits."""
from pathlib import Path
from PIL import Image
import json,base64,hashlib,math
ROOT=Path(__file__).resolve().parents[4];OUT=ROOT/'game-src/action/eileen/resume/live-20261022'
D=OUT/'transition-exact';D.mkdir(exist_ok=True)
source=OUT/'transition-mask/input.png';im=Image.open(source).convert('RGBA')
# Fixed-pose carbine, stock-to-muzzle coordinates on the original 192x144 frame.
# Each rifle has a butt, receiver, short magazine, and muzzle; no body transform.
poses=[((58,76),(77,115)),((57,80),(72,119)),((43,105),(38,64)),((42,105),(33,54))]
changes=[]
for slot,(start,end) in enumerate(poses):
 ox,oy=(slot%2)*128-16,(slot//2)*128-16
 dx,dy=end[0]-start[0],end[1]-start[1];length=math.hypot(dx,dy);ux,uy=dx/length,dy/length;vx,vy=-uy,ux
 pixels=[]
 for y in range(max(0,min(start[1],end[1])-5),min(144,max(start[1],end[1])+6)):
  for x in range(max(0,min(start[0],end[0])-8),min(144,max(start[0],end[0])+9)):
   t=(x-start[0])*ux+(y-start[1])*uy;v=(x-start[0])*vx+(y-start[1])*vy
   # One continuous short rifle with angled stock, receiver and inserted magazine.
   half=2.5 if 0<=t<7 else 1.5 if t<10 else 2.5 if t<27 else 1.0
   inside=0<=t<=length and abs(v)<=half
   magazine=20<=t<=25 and 2<=v<=6
   if not (inside or magazine):continue
   sx,sy=x+ox,y+oy;old=im.getpixel((sx,sy));r,g,b,a=old
   skin=r>g*1.10 and g>b*1.05 and r>110
   hair=r>100 and g>90 and r>=g and g>b and r-g<60 and g-b<70
   if skin or hair:continue
   color=(19,25,26,255)
   if inside and abs(v)<half-0.8 and 2<t<28:color=(39,45,50,255)
   if inside and -half+0.4<v<-half+1.7 and 10<t<28:color=(81,98,108,255)
   if inside and abs(v)<0.55 and 29<t<length-1:color=(59,73,82,255)
   if old!=color:
    hexcolor=lambda rgba:'#'+''.join(f'{c:02x}' for c in rgba)
    pixels.append([sx,sy,hexcolor(old),hexcolor(color)])
 changes.append({'operation':'patch_pixels','frames':[1],'pixels':pixels,'reason':f'Frame {slot+2}: restore one continuous short carbine with fixed stock, receiver, magazine and muzzle; every original skin/hair pixel protected.'})
request={'tool':'pixelart_workbench','estimated_generations':0,'input_path':source.relative_to(ROOT).as_posix(),'input_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'poses':poses,'changes':changes,'source_url':'data:image/png;base64,'+base64.b64encode(source.read_bytes()).decode()}
(D/'request.json').write_text(json.dumps(request,indent=2),encoding='utf-8')
print('Prepared exact gun pixels:',[len(c['pixels']) for c in changes])
