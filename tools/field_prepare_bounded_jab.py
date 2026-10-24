"""Prepare a jab using only this character's measured limb lengths and pixels."""
import argparse,copy,json,math
from PIL import Image,ImageDraw
from field_character_production import OUT,ROOT,atomic
from field_prepare_remaining_skeletons import knee
from field_prepare_character_jumps import EDGES

def main():
 p=argparse.ArgumentParser();p.add_argument('slug');a=p.parse_args()
 source=json.loads((OUT/'motion-inputs'/a.slug/'jumping-1-v1/spec.json').read_text())
 own={p['label']:(p['x']*256,p['y']*256) for p in source['request']['first_frame_keypoints']}
 sign=1 if source['request']['direction']=='east' else -1;frames=[]
 for extended in [False,True,False]:
  f={k:(x,y+7) for k,(x,y) in own.items()}
  for side,offset in [('LEFT',12),('RIGHT',-12)]:
   hip=f[side+' HIP'];foot=(own[side+' LEG'][0]+sign*offset,own[side+' LEG'][1])
   u=math.dist(own[side+' HIP'],own[side+' KNEE']);l=math.dist(own[side+' KNEE'],own[side+' LEG'])
   kx,ky=knee((-sign*hip[0],hip[1]),(-sign*foot[0],foot[1]),u,l)
   f[side+' KNEE']=(-sign*kx,ky);f[side+' LEG']=foot
   sx,sy=f[side+' SHOULDER'];u=math.dist(own[side+' SHOULDER'],own[side+' ELBOW']);l=math.dist(own[side+' ELBOW'],own[side+' ARM'])
   dx=(u+l)*(.94 if extended and side=='LEFT' else .34);dy=3 if extended and side=='LEFT' else (u+l)*.35
   dist=math.hypot(dx,dy);along=(u*u-l*l+dist*dist)/(2*dist);bend=math.sqrt(max(0,u*u-along*along))
   f[side+' ELBOW']=(sx+sign*(along*dx/dist-bend*dy/dist),sy+along*dy/dist+bend*dx/dist)
   f[side+' ARM']=(sx+sign*dx,sy+dy)
  frames.append([dict(label=k,x=x/256,y=y/256) for k,(x,y) in f.items()])
 assert all(.02<=p['x']<=.98 and .02<=p['y']<=.97 for fr in frames for p in fr)
 spec=copy.deepcopy(source);spec.update(slot='lead-jab',skeleton_visually_reviewed=False);spec.pop('review_findings',None)
 spec['request'].update(action='lead jab and recover',keypoints=frames,seed=2026112201)
 root=OUT/'motion-inputs'/a.slug/'lead-jab-bounded-v1';assert not (root/'spec.json').exists(),'Input revision is immutable'
 atomic(root/'spec.json',spec);sheet=Image.new('RGBA',(1024,280),'#9baea6');d=ImageDraw.Draw(sheet)
 for i,fr in enumerate([spec['request']['first_frame_keypoints'],*frames]):
  ox=i*256;pts={p['label']:(p['x']*256+ox,p['y']*256+20) for p in fr}
  if i==0:sheet.alpha_composite(Image.open(ROOT/spec['first_frame_path']).convert('RGBA'),(0,20))
  d.text((ox+3,3),'reference' if i==0 else str(i),fill='black')
  for x,y in EDGES:d.line((*pts[x],*pts[y]),fill='red',width=2)
 sheet.save(root/'skeleton-preview.png');print(root/'skeleton-preview.png')

if __name__=='__main__':main()
