"""Prepare own-image Spangdal motion corrections; no paid calls or approval."""
import json,math,copy
from PIL import Image,ImageDraw
from field_character_production import OUT,atomic
from field_prepare_remaining_skeletons import EDGES,HEAD,rotate_point,arm,knee

def main():
 source=json.loads((OUT/'motion-inputs/spangdal/jumping-1-v1/spec.json').read_text())
 own={q['label']:(q['x'],q['y']) for q in source['request']['first_frame_keypoints']}
 mappings={'running-8-frames':'running-8-frames-v1','running-jump':'running-jump-v1','running-slide':'running-slide-v2','front-flip':'front-flip-v3','backflip':'backflip-v5','picking-up':'picking-up-v3','throw-object':'throw-object-v2','cross-punch':'cross-punch-v1'}
 motions={}
 for slot,revision in mappings.items():
  ref=json.loads((OUT/'motion-inputs/jyaldi'/revision/'spec.json').read_text());base={q['label']:(q['x'],q['y']) for q in ref['request']['first_frame_keypoints']}
  scale=(own['LEFT LEG'][1]-own['NECK'][1])/(base['LEFT LEG'][1]-base['NECK'][1])
  frames=[]
  for fr in ref['request']['keypoints']:
   points=[]
   for q in fr:
    k=q['label'];dx=q['x']-base[k][0];dy=q['y']-base[k][1]
    restraint=0.94
    if slot=='running-jump' and any(part in k for part in ['KNEE','LEG']):dx*=0.70;dy*=0.85
    if slot=='running-8-frames' and any(part in k for part in ['ARM','ELBOW']):dx*=0.85
    points.append(dict(label=k,x=own[k][0]+dx*scale*restraint,y=own[k][1]+dy*scale*restraint))
   frames.append(points)
  motions[slot]=frames
 base={k:(x*256,y*256) for k,(x,y) in own.items()};frames=[]
 for i in range(8):
  phase=2*math.pi*i/8;f={k:(x,y+28) for k,(x,y) in base.items()};origin=f['LEFT HIP']
  for k in HEAD+['LEFT SHOULDER','RIGHT SHOULDER','LEFT ELBOW','RIGHT ELBOW','LEFT ARM','RIGHT ARM']:f[k]=rotate_point(f[k],origin,-0.12)
  for side,sign in [('LEFT',1),('RIGHT',-1)]:
   swing=sign*math.sin(phase);foot=(128+22*swing,225-7*max(0,-swing));upper=math.dist(base[side+' HIP'],base[side+' KNEE']);lower=math.dist(base[side+' KNEE'],base[side+' LEG'])
   f[side+' LEG']=foot;f[side+' KNEE']=knee(f[side+' HIP'],foot,upper,lower);sx,sy=f[side+' SHOULDER'];arm(f,side,(sx-18+8*swing,sy+40))
  frames.append([dict(label=k,x=x/256,y=y/256) for k,(x,y) in f.items()])
 motions['crouched-walking']=frames
 for index,(slot,frames) in enumerate(motions.items()):
  spec=copy.deepcopy(source);spec.update(slot=slot,skeleton_visually_reviewed=False);spec.pop('review_findings',None)
  spec['request'].update(action=slot.replace('-',' '),keypoints=frames,seed=2026103100+index)
  spec['request']['description']+=' Single continuous fitted skirt hem, bare hands, pumps; her own light slender build.'
  assert all(0.02<=q['x']<=0.98 and 0.02<=q['y']<=0.98 for f in frames for q in f),slot
  p=OUT/'motion-inputs/spangdal'/(slot+'-repair-v1');atomic(p/'spec.json',spec)
  im=Image.new('RGB',(1024,280*math.ceil(len(frames)/4)),'#9baea6');d=ImageDraw.Draw(im)
  for i,fr in enumerate(frames):
   pts={q['label']:(q['x']*256,q['y']*256) for q in fr};ox=i%4*256;oy=i//4*280;d.text((ox+4,oy+3),f'{slot} {i+1}',fill='black')
   for a,b in EDGES:d.line((ox+pts[a][0],oy+20+pts[a][1],ox+pts[b][0],oy+20+pts[b][1]),fill='red',width=2)
   for x,y in pts.values():d.ellipse((ox+x-2,oy+20+y-2,ox+x+2,oy+20+y+2),fill='yellow')
  im.save(p/'skeleton-preview.png');print(slot,len(frames))

if __name__=='__main__':main()
