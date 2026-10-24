"""Prepare Jyaldi's remaining motion rigs for visual inspection, without paid calls."""
import copy,json,math
from PIL import Image,ImageDraw
from field_character_production import OUT,ROOT,atomic
from field_prepare_jump_skeleton import knee

EDGES=[('NECK','NOSE'),('NECK','LEFT SHOULDER'),('NECK','RIGHT SHOULDER'),('LEFT SHOULDER','LEFT ELBOW'),('LEFT ELBOW','LEFT ARM'),('RIGHT SHOULDER','RIGHT ELBOW'),('RIGHT ELBOW','RIGHT ARM'),('LEFT SHOULDER','LEFT HIP'),('RIGHT SHOULDER','RIGHT HIP'),('LEFT HIP','LEFT KNEE'),('LEFT KNEE','LEFT LEG'),('RIGHT HIP','RIGHT KNEE'),('RIGHT KNEE','RIGHT LEG')]
source=json.loads((OUT/'motion-inputs/jyaldi/jumping-2-v1/spec.json').read_text())
base={p['label']:(p['x']*256,p['y']*256) for p in source['request']['first_frame_keypoints']}
HEAD=['NOSE','NECK','LEFT EYE','RIGHT EYE','LEFT EAR','RIGHT EAR']

def shifted(drop=0,dx=0):return {k:(x+dx,y+drop) for k,(x,y) in base.items()}
def leg(f,side,ankle):
 f[side+' LEG']=ankle;f[side+' KNEE']=knee(f[side+' HIP'],ankle,53,59)
def arm(f,side,wrist):
 shoulder=f[side+' SHOULDER'];dx,dy=wrist[0]-shoulder[0],wrist[1]-shoulder[1];d=math.hypot(dx,dy)
 assert 3<d<77,(side,d)
 a=(37**2-40**2+d*d)/(2*d);h=math.sqrt(max(0,37**2-a*a))
 f[side+' ELBOW']=(shoulder[0]+a*dx/d+h*dy/d,shoulder[1]+a*dy/d-h*dx/d);f[side+' ARM']=wrist
def rotate_point(p,origin,angle):
 x,y=p[0]-origin[0],p[1]-origin[1];c,s=math.cos(angle),math.sin(angle)
 return origin[0]+c*x-s*y,origin[1]+s*x+c*y
def bend(f,angle):
 origin=((f['LEFT HIP'][0]+f['RIGHT HIP'][0])/2,(f['LEFT HIP'][1]+f['RIGHT HIP'][1])/2)
 for k in HEAD+['LEFT SHOULDER','RIGHT SHOULDER','LEFT ELBOW','RIGHT ELBOW','LEFT ARM','RIGHT ARM']:f[k]=rotate_point(f[k],origin,angle)

def run_frames():
 frames=[]
 for i in range(8):
  phase=2*math.pi*i/8;f=shifted(8+2*math.cos(2*phase));bend(f,-0.08)
  for side,sign in [('LEFT',1),('RIGHT',-1)]:
   swing=sign*math.sin(phase);leg(f,side,(130+34*swing,228-25*max(0,-swing)))
   sx,sy=f[side+' SHOULDER'];arm(f,side,(sx+30*swing,sy+43+18*swing))
  frames.append(f)
 return frames

def jump_frames(kind):
 frames=[]
 for i,(drop,lift) in enumerate([(0,0),(18,0),(31,0),(-2,18),(-2,38),(8,24),(25,0),(0,0)]):
  f=shifted(drop)
  if i not in (0,7):
   for side,offset in [('LEFT',0),('RIGHT',-5)]:
    extra=15 if kind=='jumping-1' and side=='LEFT' and 3<=i<=5 else 0
    leg(f,side,(131+offset,231-lift-extra))
    sx,sy=f[side+' SHOULDER'];arm(f,side,(sx-28,sy+12 if kind=='two-footed-jump' else sy+30+offset))
  frames.append(f)
 return frames

def flips(back=False):
 frames=[shifted()]
 prep=shifted(27)
 for side in ['LEFT','RIGHT']:leg(prep,side,(131,230));arm(prep,side,(108,108))
 frames.append(prep)
 compact=shifted(25)
 for side,off in [('LEFT',0),('RIGHT',-6)]:
  leg(compact,side,(140+off,180));arm(compact,side,(99+off,140))
 # A compact body rotates inside the canvas; no long straight leg crosses its edge.
 for degrees in [35,80,125,170,215,260,305,350]:
  angle=math.radians(degrees)*(1 if back else -1)
  frames.append({k:rotate_point(p,(128,139),angle) for k,p in compact.items()})
 frames.extend([prep,shifted()]);return frames

def pickup():
 frames=[]
 for deg in [0,15,35,50,60,40,20,0]:
  f=shifted(50*deg/60);bend(f,-math.radians(deg))
  for side,x,y in [('LEFT',133,231),('RIGHT',128,228)]:leg(f,side,(x,y))
  for side in ['LEFT','RIGHT']:
   sx,sy=f[side+' SHOULDER'];arm(f,side,(sx-5,sy+70))
  frames.append(f)
 return frames

def punch():
 frames=[]
 for reach in [0,0.2,0.5,1,0.5,0.15,0,0]:
  f=shifted(7);bend(f,-0.08*reach)
  leg(f,'LEFT',(103,230));leg(f,'RIGHT',(151,228))
  arm(f,'LEFT',(105,74));sx,sy=f['RIGHT SHOULDER'];arm(f,'RIGHT',(sx-23-48*reach,sy+21-18*reach))
  frames.append(f)
 return frames

def throwing():
 frames=[]
 # A gloved empty-hand throwing gesture: no discontinuous generated prop.
 targets=[(115,110),(148,80),(162,57),(147,29),(92,43),(63,75),(100,120),(119,127)]
 for i,target in enumerate(targets):
  f=shifted(8);bend(f,-0.12 if i>=4 else 0.04)
  leg(f,'LEFT',(106,230));leg(f,'RIGHT',(150,228));arm(f,'LEFT',(107,100));arm(f,'RIGHT',target);frames.append(f)
 return frames

def slide():
 frames=[]
 for drop,lean in [(8,-0.08),(26,0.15),(55,0.45),(75,0.5),(67,0.25),(42,0.08),(18,0),(0,0)]:
  f=shifted(drop);bend(f,lean)
  for side,off in [('LEFT',0),('RIGHT',10)]:
   leg(f,side,(53+off if drop>=55 else 128+off,226))
   sx,sy=f[side+' SHOULDER'];arm(f,side,(sx-25,sy+30))
  frames.append(f)
 return frames

def main():
 motions={'running-8-frames':run_frames(),'running-jump':jump_frames('jumping-1'),'running-slide':slide(),'front-flip':flips(),'backflip':flips(True),'jumping-1':jump_frames('jumping-1'),'two-footed-jump':jump_frames('two-footed-jump'),'picking-up':pickup(),'throw-object':throwing(),'cross-punch':punch()}
 # Running jump keeps an asymmetric stride through the air, unlike the standing jump.
 for i,f in enumerate(motions['running-jump']):
  if 2<=i<=5:
   leg(f,'LEFT',(100,202 if i in (3,4) else 226));leg(f,'RIGHT',(153,211 if i in (3,4) else 226))
 for i,j in [(0,0),(1,2),(6,4),(7,6)]:motions['running-jump'][i]=copy.deepcopy(motions['running-8-frames'][j])
 for number,(slot,frames) in enumerate(motions.items()):
  target=OUT/'motion-inputs/jyaldi'/(slot+'-v1');target.mkdir(parents=True,exist_ok=True)
  spec=copy.deepcopy(source);spec.update(slot=slot,skeleton_visually_reviewed=False);spec.pop('review_findings',None)
  spec['request'].update(action=slot.replace('-',' '),seed=2026102600+number,keypoints=[[{'label':k,'x':x/256,'y':y/256} for k,(x,y) in f.items()] for f in frames])
  for f in frames:
   assert all(6<=x<=250 and 12<=y<=242 for x,y in f.values()),(slot,f)
  atomic(target/'spec.json',spec)
  sheet=Image.new('RGB',(1024,280*math.ceil(len(frames)/4)),'#9baea6');d=ImageDraw.Draw(sheet)
  for i,f in enumerate(frames):
   ox=i%4*256;oy=i//4*280;d.text((ox+4,oy+3),f'{slot} {i+1}',fill='black');d.line((ox,oy+264,ox+255,oy+264),fill='#6c8178')
   for a,b in EDGES:d.line((ox+f[a][0],oy+20+f[a][1],ox+f[b][0],oy+20+f[b][1]),fill='#e83b35',width=2)
   for x,y in f.values():d.ellipse((ox+x-2,oy+20+y-2,ox+x+2,oy+20+y+2),fill='yellow')
  sheet.save(target/'skeleton-preview.png');print(slot,len(frames),target/'skeleton-preview.png')

if __name__=='__main__':main()
