"""Prepare bounded jumps from each character's own image and landmarks, no submission."""
import argparse,copy,json,math,zipfile
from PIL import Image,ImageDraw
from field_character_production import OUT,ROOT,atomic

EDGES=[('NECK','NOSE'),('NECK','LEFT SHOULDER'),('NECK','RIGHT SHOULDER'),('LEFT SHOULDER','LEFT ELBOW'),('LEFT ELBOW','LEFT ARM'),('RIGHT SHOULDER','RIGHT ELBOW'),('RIGHT ELBOW','RIGHT ARM'),('LEFT SHOULDER','LEFT HIP'),('RIGHT SHOULDER','RIGHT HIP'),('LEFT HIP','LEFT KNEE'),('LEFT KNEE','LEFT LEG'),('RIGHT HIP','RIGHT KNEE'),('RIGHT KNEE','RIGHT LEG')]

def main():
 p=argparse.ArgumentParser();p.add_argument('slug');p.add_argument('--motion-scale',type=float,default=1.0);a=p.parse_args();slug=a.slug
 assert 0<a.motion_scale<=1,'Only reduce displacement; never resize character pixels'
 s=json.loads((OUT/'state.json').read_text());c=s['characters'][slug]
 manifest=next(x for x in json.loads((OUT/'manifest.json').read_text()) if x['slug']==slug)
 ctl=json.loads((OUT/'control.json').read_text());direction=ctl.get('character_direction_overrides',{}).get(slug,{}).get('movement_and_combat','east')
 detail=json.loads((OUT/'motion-inputs'/slug/'character-before.json').read_text());assert detail['id']==c['character_id']
 raw=detail['skeletons']['2d_references'][direction]['keypoints']
 with zipfile.ZipFile(OUT/slug/'character.zip') as z:im=Image.open(z.open('Idle/rotations/'+direction+'.png')).convert('RGBA')
 assert im.size==(128,256);canvas=Image.new('RGBA',(256,256));canvas.paste(im,(64,0))
 root=OUT/'motion-inputs'/slug;canvas.save(root/'first-frame.png')
 own={k:{'label':k,'x':(64+v['x']*128)/256,'y':v['y']} for k,v in raw.items()}
 for index,slot in enumerate(['jumping-1','jumping-2','two-footed-jump']):
  source=json.loads((OUT/'motion-inputs/jyaldi'/(slot+'-v1')/'spec.json').read_text())
  ref={v['label']:v for v in source['request']['first_frame_keypoints']}
  own_length=sum(own[side+' LEG']['y']-own['NECK']['y'] for side in ['LEFT','RIGHT'])/2
  ref_length=sum(ref[side+' LEG']['y']-ref['NECK']['y'] for side in ['LEFT','RIGHT'])/2
  scale=own_length/ref_length
  # Slender, quiet Spangdal uses restrained movement; source landmarks keep her
  # individual proportions. No other character's pixels are used.
  restraint=a.motion_scale*(0.94 if slug=='spangdal' else 1.0)
  frames=[]
  for f in source['request']['keypoints']:
   frame=[]
   for v in f:
    k=v['label'];dx=(v['x']-ref[k]['x'])*scale*restraint*(1 if direction=='west' else -1);dy=(v['y']-ref[k]['y'])*scale*restraint
    frame.append({'label':k,'x':own[k]['x']+dx,'y':own[k]['y']+dy})
   assert all(0.03<=v['x']<=0.97 and 0.04<=v['y']<=0.95 for v in frame)
   frames.append(frame)
  spec={'slug':slug,'slot':slot,'character_id':c['character_id'],'skeleton_visually_reviewed':False,'first_frame_path':str((root/'first-frame.png').relative_to(ROOT)),'new_user_approval':False,'landmark_source':'current character own '+direction+' estimated 2d reference','request':{'description':manifest['appearance'],'action':slot.replace('-',' '),'direction':direction,'view':'low top-down','first_frame_keypoints':list(own.values()),'keypoints':frames,'template_id':'mannequin','seed':2026110000+index,'no_background':True}}
  spec['motion_displacement_scale']=restraint
  target=root/(slot+'-v1');target.mkdir(exist_ok=True);atomic(target/'spec.json',spec)
  sheet=Image.new('RGBA',(1024,840),'#9baea6');draw=ImageDraw.Draw(sheet)
  for i,f in enumerate([list(own.values()),*frames]):
   points={v['label']:(v['x']*256,v['y']*256) for v in f};ox=i%4*256;oy=i//4*280
   if i==0:sheet.alpha_composite(canvas,(ox,oy+20))
   draw.text((ox+4,oy+3),'reference' if i==0 else f'{slot} {i}',fill='black')
   for k,l in EDGES:draw.line((ox+points[k][0],oy+20+points[k][1],ox+points[l][0],oy+20+points[l][1]),fill='red',width=2)
   for x,y in points.values():draw.ellipse((ox+x-2,oy+20+y-2,ox+x+2,oy+20+y+2),fill='yellow')
  sheet.save(target/'skeleton-preview.png');print(target/'skeleton-preview.png')

if __name__=='__main__':main()
