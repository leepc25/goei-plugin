"""Retarget reviewed motion geometry to Aileen's own measured body; no paid calls."""
import copy,json,math
from PIL import Image,ImageDraw
from field_character_production import OUT,ROOT,atomic
from field_prepare_character_jumps import EDGES

def xy(points):return {p['label']:(p['x'],p['y']) for p in points}
def midpoint(p):return tuple((p['LEFT HIP'][i]+p['RIGHT HIP'][i])/2 for i in (0,1))
def main():
 ctl=json.loads((OUT/'control.json').read_text())
 source=json.loads((OUT/'motion-inputs/aileen/jumping-1-v1/spec.json').read_text())
 own=xy(source['request']['first_frame_keypoints'])
 reference=OUT/'motion-inputs/aileen/measured-air-reference'
 measured=[{k:p[k] for k in ('label','x','y')} for p in json.loads((reference/'estimate-response.json').read_text())['keypoints']]
 base=xy(json.loads((OUT/'motion-inputs/jaemtri/jumping-1-v1/spec.json').read_text())['request']['first_frame_keypoints'])
 ownroot,baseroot=midpoint(own),midpoint(base)
 scale=math.dist(own['NECK'],own['LEFT LEG'])/math.dist(base['NECK'],base['LEFT LEG'])
 slots=['walking-8-frames','running-8-frames','running-jump','running-slide','crouched-walking','sad-walk','front-flip','backflip','picking-up','pushing','pull-heavy-object','throw-object','fight-stance-idle-8-frames','cross-punch']
 for n,slot in enumerate(slots):
  template={'walking-8-frames':'sad-walk','pull-heavy-object':'pushing','fight-stance-idle-8-frames':'lead-jab'}.get(slot,slot)
  geometry=json.loads((ROOT/ctl['custom_motion_specs']['jaemtri'][template]).read_text())['request']['keypoints']
  if slot=='fight-stance-idle-8-frames':geometry=[geometry[0]]*4
  frames=[]
  for fr in geometry:
   p=xy(fr);pr=midpoint(p);root=tuple(ownroot[i]+(pr[i]-baseroot[i])*scale*.85 for i in (0,1));f={}
   # Preserve each of Aileen's measured segment lengths; borrow only angles.
   def place(label,parent,src_parent,own_parent):
    vx,vy=p[label][0]-src_parent[0],p[label][1]-src_parent[1];length=math.hypot(vx,vy)
    target=math.dist(own[label],own_parent)
    if length<1e-7:vx,vy=own[label][0]-own_parent[0],own[label][1]-own_parent[1];length=max(math.hypot(vx,vy),1e-7)
    f[label]=(parent[0]+vx/length*target,parent[1]+vy/length*target)
   for label in ['LEFT HIP','RIGHT HIP','NECK']:place(label,root,pr,ownroot)
   for side in ['LEFT','RIGHT']:
    for label,parent in [(side+' SHOULDER','NECK'),(side+' ELBOW',side+' SHOULDER'),(side+' ARM',side+' ELBOW'),(side+' KNEE',side+' HIP'),(side+' LEG',side+' KNEE')]:place(label,f[parent],p[parent],own[parent])
   angle=math.atan2(p['NOSE'][1]-p['NECK'][1],p['NOSE'][0]-p['NECK'][0])-math.atan2(own['NOSE'][1]-own['NECK'][1],own['NOSE'][0]-own['NECK'][0])
   if slot=='walking-8-frames':angle=0
   for label in ['NOSE','LEFT EYE','RIGHT EYE','LEFT EAR','RIGHT EAR']:
    dx,dy=own[label][0]-own['NECK'][0],own[label][1]-own['NECK'][1]
    f[label]=(f['NECK'][0]+dx*math.cos(angle)-dy*math.sin(angle),f['NECK'][1]+dx*math.sin(angle)+dy*math.cos(angle))
   # Translate the complete pose into the canvas, never resize body parts.
   shifts=[]
   for axis in (0,1):
    lo=min(v[axis] for v in f.values());hi=max(v[axis] for v in f.values());assert hi-lo<.88,(slot,axis,hi-lo)
    shifts.append(max(.06-lo,min(0,.94-hi)))
   frames.append([dict(label=k,x=v[0]+shifts[0],y=v[1]+shifts[1]) for k,v in f.items()])
  spec=copy.deepcopy(source);spec.update(slot=slot,skeleton_visually_reviewed=False,first_frame_path=str((reference/'first-frame.png').relative_to(ROOT)));spec.pop('review_findings',None)
  action={'pushing':'Lean forward and push with open palms, elbows nearly straight','pull-heavy-object':'Grasp firmly and pull backward with both hands','fight-stance-idle-8-frames':'Balanced combat guard with subtle breathing','walking-8-frames':'Natural forward walking'}.get(slot,slot.replace('-',' '))
  spec['request'].update(action=action,first_frame_keypoints=measured,keypoints=frames,seed=2026112400+n)
  spec['reference_provenance']={'source_job_id':'b922a7a6-f01a-4dce-a06f-4f213187824b','frame_index':4,'actual_pose_receipt':str((reference/'estimate-response.json').relative_to(ROOT)),'geometry_only_template':template,'limbs':'Aileen own measured segment lengths; no other character pixels'}
  target=OUT/'motion-inputs/aileen'/(slot+'-own-lengths-v1');assert not (target/'spec.json').exists();atomic(target/'spec.json',spec)
  poses=[measured,*frames];sheet=Image.new('RGBA',(1024,280*math.ceil(len(poses)/4)),'#9baea6');d=ImageDraw.Draw(sheet)
  for i,pose in enumerate(poses):
   ox=i%4*256;oy=i//4*280
   if i==0:sheet.alpha_composite(Image.open(reference/'first-frame.png').convert('RGBA'),(ox,oy+20))
   pts={p['label']:(p['x']*256+ox,p['y']*256+oy+20) for p in pose};d.text((ox+4,oy+3),'reference' if i==0 else str(i),fill='black')
   for a,b in EDGES:d.line((*pts[a],*pts[b]),fill='red',width=2)
  sheet.save(target/'skeleton-preview.png');print(slot,len(frames))
if __name__=='__main__':main()
