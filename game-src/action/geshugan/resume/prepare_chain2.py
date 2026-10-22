from pathlib import Path
from PIL import Image,ImageDraw
import sys,json,hashlib,base64,numpy as np
from scipy import ndimage
src=Path('game-src/action/geshugan').resolve();sys.path.insert(0,str(src/'scripts'));import grig
out=src/'resume'/'neck-chain2';out.mkdir(exist_ok=True);rows=[]
atlas=Image.new('RGBA',(256,128));mask=Image.new('RGB',atlas.size);md=ImageDraw.Draw(mask)
for n,i in enumerate([0,1,3,5,6,7]):
 p=src/'clips/chain2'/f'{i:02}.png';im=Image.open(p).convert('RGBA');nx,ny=grig.CLIPS['chain2'][2][i]['NOSE'];left,top=round(nx+grig.J.DX)-32,round(ny+grig.J.DY)-24;box=[left,top,left+64,top+64];crop=im.crop(box);a=np.array(crop).astype(int)
 skin=(a[:,:,3]>0)&(a[:,:,0]>a[:,:,1]+15)&(a[:,:,1]>a[:,:,2]+10);skin[33:]=False;labels,count=ndimage.label(skin);groups=[]
 for k in range(1,count+1):
  yy,xx=np.where(labels==k)
  if len(xx)>3:groups.append((int(yy.min()),xx,yy))
 _,xx,yy=min(groups,key=lambda v:v[0]);repair=[int(xx.min())-1,int(yy.max())-3,int(xx.max())+4,int(yy.max())+6]
 x,y=(n%4)*64,(n//4)*64;atlas.paste(crop,(x,y));md.rectangle([x+repair[0],y+repair[1],x+repair[2]-1,y+repair[3]-1],fill='white')
 rows.append({'index':n,'clip':'chain2','frame':i,'source':p.relative_to(src).as_posix(),'source_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'crop_box':box,'repair_crop_box':repair})
atlas.save(out/'input.png');mask.save(out/'mask.png');(out/'inputs.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
args={'image_base64':base64.b64encode((out/'input.png').read_bytes()).decode(),'mask_image_base64':base64.b64encode((out/'mask.png').read_bytes()).decode(),'description':'This is a grid of separate pixel-art poses of the SAME adult woman. In EACH masked chin region only, remove the beard-like grey or white strands dangling below her chin. Reveal a clean feminine jawline and small natural skin-colored neck above the existing white shirt collar. Preserve the existing side bob outside the mask. Follow each face angle and the original limited palette, crisp 1px outline and transparent background. Do not connect cells or add any new objects.','crop_to_mask':True,'no_background':True,'seed':221014}
(out/'arguments.json').write_text(json.dumps(args,indent=2),encoding='utf-8');print('Prepared chain2 remainder6, not submitted')
