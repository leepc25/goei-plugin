"""Prepare Jaemtri own-image bounded motion inputs; no paid API calls."""
import json,copy,math,shutil
from PIL import Image,ImageDraw
from field_character_production import OUT,ROOT,atomic
from field_prepare_remaining_skeletons import EDGES,HEAD,rotate_point,arm,knee

def main():
 source=json.loads((OUT/'motion-inputs/jaemtri/jumping-1-v1/spec.json').read_text());own={p['label']:p for p in source['request']['first_frame_keypoints']};motions={}
 for slot in ['running-8-frames','running-jump','running-slide','crouched-walking','front-flip','backflip','throw-object','cross-punch']:
  ref=json.loads((OUT/'motion-inputs/spangdal'/(slot+'-repair-v1')/'spec.json').read_text());base={p['label']:p for p in ref['request']['first_frame_keypoints']};scale=(own['LEFT LEG']['y']-own['NECK']['y'])/(base['LEFT LEG']['y']-base['NECK']['y']);frames=[]
  for fr in ref['request']['keypoints']:
   frames.append([dict(label=p['label'],x=own[p['label']]['x']-(p['x']-base[p['label']]['x'])*scale*.96,y=own[p['label']]['y']+(p['y']-base[p['label']]['y'])*scale*.96) for p in fr])
  motions[slot]=frames
 # Build a small balanced stepping cycle from her own measured leg segments.
 base={k:(p['x']*256,p['y']*256) for k,p in own.items()}
 for slot in ['sad-walk','pushing']:
  frames=[]
  for i in range(8):
   phase=i*math.pi/4;drop=6 if slot=='sad-walk' else 17;f={k:(x,y+drop) for k,(x,y) in base.items()}
   for k in HEAD:f[k]=rotate_point(f[k],f['NECK'],.12 if slot=='sad-walk' else .02)
   for side,sign in [('LEFT',1),('RIGHT',-1)]:
    swing=math.sin(phase)*sign;hip=f[side+' HIP'];upper=math.dist(base[side+' HIP'],base[side+' KNEE']);lower=math.dist(base[side+' KNEE'],base[side+' LEG']);foot=(base[side+' LEG'][0]+14*swing,base[side+' LEG'][1]-4*max(0,swing));f[side+' LEG']=foot
    mirrored_hip=(-hip[0],hip[1]);mirrored_foot=(-foot[0],foot[1]);kx,ky=knee(mirrored_hip,mirrored_foot,upper,lower);f[side+' KNEE']=(-kx,ky)
    sx,sy=f[side+' SHOULDER']
    if slot=='pushing':
     wrist=(sx+43,sy+12+(4 if side=='LEFT' else -4));dx,dy=wrist[0]-sx,wrist[1]-sy;distance=math.hypot(dx,dy)
     upper_arm=math.dist(base[side+' SHOULDER'],base[side+' ELBOW']);forearm=math.dist(base[side+' ELBOW'],base[side+' ARM'])
     assert abs(upper_arm-forearm)<distance<upper_arm+forearm
     along=(upper_arm**2-forearm**2+distance**2)/(2*distance);bend=math.sqrt(max(0,upper_arm**2-along**2))
     f[side+' ELBOW']=(sx+along*dx/distance-bend*dy/distance,sy+along*dy/distance+bend*dx/distance);f[side+' ARM']=wrist
    else:
     for joint in ['ELBOW','ARM']:
      x,y=base[side+' '+joint];f[side+' '+joint]=(x+4*swing,y+drop)
   frames.append([dict(label=k,x=x/256,y=y/256) for k,(x,y) in f.items()])
  motions[slot]=frames
 for index,(slot,frames) in enumerate(motions.items()):
  spec=copy.deepcopy(source);spec.update(slot=slot,skeleton_visually_reviewed=False);spec.pop('review_findings',None);spec['request'].update(action=slot.replace('-',' '),keypoints=frames,seed=2026110400+index)
  spec['request']['description']+=' Her own long chestnut wavy hair, continuous fitted skirt and high heels; balanced restrained movements, bare hands.'
  save(slot+'-repair-v1',spec)
 for i,slot in enumerate(['jumping-1','jumping-2','two-footed-jump']):
  spec=json.loads((OUT/'motion-inputs/jaemtri'/(slot+'-v1')/'spec.json').read_text());root=OUT/'motion-inputs/jaemtri'/(slot+'-v2');root.mkdir(exist_ok=True);shutil.copy2(OUT/'jaemtri/motions'/slot/'3.png',root/'first-frame.png')
  spec.update(skeleton_visually_reviewed=False,first_frame_path=str((root/'first-frame.png').relative_to(ROOT)));spec.pop('review_findings',None);spec['request']['first_frame_keypoints']=copy.deepcopy(spec['request']['keypoints'][3]);spec['request']['seed']=2026110450+i
  spec['reference_provenance']={'current_job_id':json.loads((OUT/'state.json').read_text())['characters']['jaemtri']['motions'][slot],'frame_index':3,'reason':'clean own airborne pose; no other character image'}
  save(slot+'-v2',spec)

def save(revision,spec):
 frames=spec['request']['keypoints'];assert all(0<=p['x']<=1 and 0<=p['y']<=1 for fr in frames for p in fr)
 root=OUT/'motion-inputs/jaemtri'/revision;atomic(root/'spec.json',spec);sheet=Image.new('RGBA',(1024,280*math.ceil((len(frames)+1)/4)),'#9baea6');d=ImageDraw.Draw(sheet)
 for i,fr in enumerate([spec['request']['first_frame_keypoints'],*frames]):
  ox=i%4*256;oy=i//4*280;pts={p['label']:(p['x']*256+ox,p['y']*256+oy+20) for p in fr}
  if i==0:sheet.alpha_composite(Image.open(ROOT/spec['first_frame_path']).convert('RGBA'),(ox,oy+20))
  d.text((ox+4,oy+4),'reference' if i==0 else str(i),fill='black')
  for a,b in EDGES:d.line((*pts[a],*pts[b]),fill='red',width=2)
 sheet.save(root/'skeleton-preview.png');print(revision,len(frames))
if __name__=='__main__':main()
