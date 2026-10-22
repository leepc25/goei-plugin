"""Four disjoint rifle-only masks. Full-body input; face, hands and feet frozen."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,base64,hashlib,numpy as np
ROOT=Path(__file__).resolve().parents[4];OUT=ROOT/'game-src/action/eileen/resume/live-20261022'
D=OUT/'transition-mask';D.mkdir(exist_ok=True)
sheet=Image.new('RGBA',(256,256));mask=Image.new('L',(256,256));md=ImageDraw.Draw(mask)
# Source coordinates on 192x144. Keep rifle path narrow; no body/face pose edits.
polygons=[[(57,77),(67,76),(81,118),(74,121),(61,100)],[(55,76),(65,74),(75,113),(67,116),(57,96)],[(38,65),(49,67),(49,105),(36,112),(34,103)],[(33,54),(45,54),(50,107),(42,113),(33,90)]]
inputs=[]
for slot,index in enumerate([2,3,4,5]):
 p=OUT/f'transition-rig/{index:02d}.png';src=Image.open(p).convert('RGBA');crop=src.crop((16,16,144,144));x,y=(slot%2)*128,(slot//2)*128;sheet.paste(crop,(x,y))
 md.polygon([(x+a-16,y+b-16) for a,b in polygons[slot]],fill=255)
 inputs.append({'source_frame':index,'path':p.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sheet_slot':[x,y],'source_crop':[16,16,144,144]})
a=np.array(sheet);m=np.array(mask)
# Hold every skin and hair pixel fixed even where the rifle passes behind them.
rgb=a[:,:,:3].astype(int);r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
skin=(r>g*1.10)&(g>b*1.05)&(r>110)
hair=(r>100)&(g>90)&(r>=g)&(g>b)&((r-g)<60)&((g-b)<70)
m[skin|hair]=0;mask=Image.fromarray(m)
sheet.save(D/'input.png');mask.save(D/'mask.png')
overlay=Image.new('RGBA',sheet.size,'#41444c');overlay.alpha_composite(sheet);red=Image.new('RGBA',sheet.size,(255,80,80,0));red.putalpha(mask.point(lambda v:100 if v else 0));overlay.alpha_composite(red);overlay.resize((768,768),Image.Resampling.NEAREST).save(D/'mask-review.png')
url=lambda p:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()
args={'image_url':url(D/'input.png'),'mask_image_url':url(D/'mask.png'),'description':'Repair ONLY the four masked black carbine silhouettes in this 2 by 2 chronological pixel-art sprite sheet. Each cell has the same ONE short rifle, solid dark steel receiver and shoulder stock, short barrel and small magazine. Top left: rifle hangs diagonally downward beside the front thigh. Top right: rifle hangs muzzle-down close to the hip. Bottom left: the same rifle passes behind the hip, muzzle down. Bottom right: rifle is slung diagonally behind the shoulder, muzzle down. Keep each rifle aligned with the existing wrist and sling. Existing fingers overlap the grip naturally. No second rifle, no pistol, no new limbs, no effects. Use the existing black and blue-grey pixel shading. Transparent background.','crop_to_mask':True,'no_background':True,'seed':111}
request={'tool':'inpaint_image','estimated_generations':10,'state':'prepared_not_submitted','inputs':inputs,'sheet_sha256':hashlib.sha256((D/'input.png').read_bytes()).hexdigest(),'mask_sha256':hashlib.sha256((D/'mask.png').read_bytes()).hexdigest(),'arguments':args}
(D/'request.json').write_text(json.dumps(request,indent=2),encoding='utf-8');print(json.dumps(request))
