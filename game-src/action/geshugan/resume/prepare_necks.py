from pathlib import Path
from PIL import Image,ImageDraw
import sys,json,hashlib,base64
src=Path('game-src/action/geshugan').resolve();sys.path.insert(0,str(src/'scripts'));import grig
out=src/'resume'/'neck-edit';out.mkdir(exist_ok=True)
items=[('crouch',1),('crouch',2),('crouch',3),('chain3',12),('chain3',13),('airstomp',3),('airstomp',4),('tackle',1),('tackle',3),('grabreap',4),('grabreap',5),('chain2',2),('chain2',4)]
rows=[];canvas=Image.new('RGBA',(7*256,2*280),(90,104,116,255));d=ImageDraw.Draw(canvas)
for n,(clip,frame) in enumerate(items):
 p=src/'clips'/clip/f'{frame:02}.png';im=Image.open(p).convert('RGBA');pose=grig.CLIPS[clip][2][frame]
 nx,ny=pose['NOSE'];nx+=grig.J.DX;ny+=grig.J.DY
 left,top=round(nx)-32,round(ny)-24;box=[left,top,left+64,top+64]
 crop=im.crop(box);target=out/f'input-{n:02}-{clip}-{frame:02}.png';crop.save(target)
 rows.append({'index':n,'clip':clip,'frame':frame,'source':str(p.relative_to(src)).replace('\\','/'),'source_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'crop_box':box,'crop_file':target.name,'crop_sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
 canvas.alpha_composite(crop.resize((256,256),Image.Resampling.NEAREST),((n%7)*256,(n//7)*280+24));d.text(((n%7)*256+3,(n//7)*280+5),f'{n} {clip}/{frame} at {left},{top}',fill='white')
canvas.save(out/'inputs.png');(out/'inputs.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
args={'images_base64':[base64.b64encode((out/r['crop_file']).read_bytes()).decode() for r in rows],'description':'Remove the beard-like grey-white strands hanging directly below this adult woman\'s chin, revealing a clean feminine jawline and small natural neck above her white shirt collar. Keep the white chin-length bob on the sides of the head. Preserve each distinct pose, face direction, eye, head silhouette, shirt collar, black tie, hands, original limited pixel palette, black pixel outlines and transparent background. Make only this tiny chin cleanup; do not redesign or move anything.','width':64,'height':64,'no_background':True,'seed':221013}
(out/'arguments.json').write_text(json.dumps(args,indent=2),encoding='utf-8');print('Prepared',len(rows),'crops; maxcost25; not submitted')
