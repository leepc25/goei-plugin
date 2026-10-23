"""Prepare a bounded jump rig and preview; never submit or approve generation."""
import copy,json,math,zipfile
from PIL import Image,ImageDraw
from field_character_production import OUT,ROOT,atomic

def knee(hip,ankle,upper,lower):
 dx,dy=ankle[0]-hip[0],ankle[1]-hip[1];distance=math.hypot(dx,dy)
 assert abs(upper-lower)<distance<=upper+lower
 along=(upper*upper-lower*lower+distance*distance)/(2*distance)
 offset=math.sqrt(max(0,upper*upper-along*along))
 return (hip[0]+along*dx/distance-offset*dy/distance,hip[1]+along*dy/distance+offset*dx/distance)

def main():
 slug='jyaldi';slot='jumping-2';s=json.loads((OUT/'state.json').read_text());c=s['characters'][slug]
 target=OUT/'motion-inputs'/slug/'jumping-2-v1';target.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(OUT/slug/'character.zip') as z:
  source=Image.open(z.open('Idle/rotations/west.png')).convert('RGBA');assert source.size==(128,256)
 # Transparent horizontal padding only. The sprite pixels and stature stay unchanged.
 first=Image.new('RGBA',(256,256));first.paste(source,(64,0));first.save(target/'first-frame.png')
 raw=json.loads((OUT/'history/rebuild-20261024/jyaldi-motion-phase-preflight/after-cleanup.json').read_text())['skeletons']['2d_references']['west']['keypoints']
 base={name:(64+p['x']*128,p['y']*256) for name,p in raw.items()}
 # Landmark corrections from the actual source overlay: wrists at the glove wrists,
 # hips below the blazer waist. No image pixels are altered.
 base.update({'LEFT HIP':(129,120),'RIGHT HIP':(123,118),'LEFT ARM':(121,133),'RIGHT ARM':(119,127),'LEFT ELBOW':(131,93),'RIGHT ELBOW':(125,87)})
 frames=[]
 for i,(drop,lift) in enumerate([(0,0),(18,0),(34,0),(-2,22),(-2,48),(8,30),(28,0),(0,0)]):
  f={name:(x,y+drop) for name,(x,y) in base.items()}
  if i not in (0,7):
   for side,anklex,ankley in [('LEFT',133,231),('RIGHT',128,228)]:
    ankle=(anklex,ankley-lift);hip=f[side+' HIP']
    f[side+' KNEE']=knee(hip,ankle,53,59);f[side+' LEG']=ankle
    sx,sy=f[side+' SHOULDER']
    # Arms swing forward to chest height, staying well below the top edge.
    f[side+' ELBOW']=(sx-22,sy+31);f[side+' ARM']=(sx-43,sy+10)
  frames.append(f)
 encode=lambda f:[{'label':name,'x':x/256,'y':y/256} for name,(x,y) in f.items()]
 spec={'slug':slug,'slot':slot,'character_id':c['character_id'],'skeleton_visually_reviewed':False,'first_frame_path':str((target/'first-frame.png').relative_to(ROOT)),'new_user_approval':False,'request':{'description':'Adult woman with long straight loose black hair, crimson eyes, black fitted business pantsuit, white collared shirt, black necktie, black gloves and black formal shoes.','action':'compact vertical tuck jump and stable landing','direction':'west','view':'low top-down','first_frame_keypoints':encode(base),'keypoints':[encode(f) for f in frames],'template_id':'mannequin','seed':2026102501,'no_background':True}}
 atomic(target/'spec.json',spec)
 edges=[('NECK','NOSE'),('NECK','LEFT SHOULDER'),('NECK','RIGHT SHOULDER'),('LEFT SHOULDER','LEFT ELBOW'),('LEFT ELBOW','LEFT ARM'),('RIGHT SHOULDER','RIGHT ELBOW'),('RIGHT ELBOW','RIGHT ARM'),('LEFT SHOULDER','LEFT HIP'),('RIGHT SHOULDER','RIGHT HIP'),('LEFT HIP','LEFT KNEE'),('LEFT KNEE','LEFT LEG'),('RIGHT HIP','RIGHT KNEE'),('RIGHT KNEE','RIGHT LEG')]
 sheet=Image.new('RGB',(256*4,280*3),'#9baea6');draw=ImageDraw.Draw(sheet)
 for i,f in enumerate([base,*frames]):
  ox=i%4*256;oy=i//4*280
  if i==0:sheet.paste(first,(ox,oy+20),first)
  draw.text((ox+4,oy+3),'reference' if i==0 else f'frame {i}',fill='black')
  draw.line((ox,oy+264,ox+255,oy+264),fill='#6c8178')
  for a,b in edges:draw.line((ox+f[a][0],oy+20+f[a][1],ox+f[b][0],oy+20+f[b][1]),fill='#e83b35',width=2)
  for name,(x,y) in f.items():draw.ellipse((ox+x-2,oy+20+y-2,ox+x+2,oy+20+y+2),fill='yellow')
 sheet.save(target/'skeleton-preview.png');print(target/'skeleton-preview.png')

if __name__=='__main__':main()
