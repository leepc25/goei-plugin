from pathlib import Path
import json,base64
from PIL import Image,ImageDraw
import numpy as np
from scipy import ndimage
out=Path('game-src/action/geshugan/resume/neck-edit');rows=json.loads((out/'inputs.json').read_text())
atlas=Image.new('RGBA',(256,256));mask=Image.new('RGB',(256,256));md=ImageDraw.Draw(mask)
preview=Image.new('RGBA',(1024,1024),(90,104,116,255));d=ImageDraw.Draw(preview)
for r in rows:
 i=r['index'];im=Image.open(out/r['crop_file']).convert('RGBA');a=np.array(im).astype(int)
 skin=(a[:,:,3]>0)&(a[:,:,0]>a[:,:,1]+15)&(a[:,:,1]>a[:,:,2]+10);skin[33:]=False
 labels,n=ndimage.label(skin)
 candidates=[]
 for k in range(1,n+1):
  yy,xx=np.where(labels==k)
  if len(xx)>3:candidates.append((int(yy.min()),xx,yy))
 _,xx,yy=min(candidates,key=lambda x:x[0])
 box=[int(xx.min())-1,int(yy.max())-3,int(xx.max())+4,int(yy.max())+6]
 r['repair_crop_box']=box
 x,y=(i%4)*64,(i//4)*64
 atlas.paste(im,(x,y));md.rectangle([x+box[0],y+box[1],x+box[2]-1,y+box[3]-1],fill='white')
 preview.alpha_composite(im.resize((256,256),Image.Resampling.NEAREST),(x*4,y*4))
 d.rectangle([(x+box[0])*4,(y+box[1])*4,(x+box[2])*4-1,(y+box[3])*4-1],outline='red',width=1)
 d.text((x*4+2,y*4+2),f'{i} {r["clip"]}/{r["frame"]}',fill='yellow')
atlas.save(out/'masked-input.png');mask.save(out/'mask.png');preview.save(out/'mask-preview.png')
(out/'masked-inputs.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
args={'image_base64':base64.b64encode((out/'masked-input.png').read_bytes()).decode(),'mask_image_base64':base64.b64encode((out/'mask.png').read_bytes()).decode(),'description':'This is a grid of separate pixel-art poses of the SAME adult woman. In EACH masked chin region only, remove the beard-like grey or white strands dangling below her chin. Reveal a clean feminine jawline and small natural skin-colored neck above the existing white shirt collar. Preserve the existing side bob outside the mask. Follow each face angle and the original limited palette, crisp 1px outline and transparent background. Do not connect cells or add any new objects.','crop_to_mask':True,'no_background':True,'seed':221014}
(out/'masked-arguments.json').write_text(json.dumps(args,indent=2),encoding='utf-8');print([(r['index'],r['repair_crop_box']) for r in rows])
