"""Prepare an unsubmitted single-rifle sling candidate; only Eileen reference."""
from pathlib import Path
from copy import deepcopy
import json,base64,hashlib
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[4]
ART=ROOT/'game-src/action/eileen'
OUT=ART/'resume/live-20261022/transition-rig'
OUT.mkdir(exist_ok=True)
source=ART/'base/R-side.png'
kp=json.loads((ART/'base/side.json').read_text(encoding='utf-8'))['R']['kp']
# Near hand releases to hip; far support hand guides the one rifle down, up,
# behind the shoulder, then returns. Feet, hips, head and torso never move.
arm_path=[
 ((66,81),(59,80),(78,87),(67,83)),
 ((66,86),(61,82),(77,94),(67,86)),
 ((63,91),(64,83),(70,96),(61,86)),
 ((61,94),(66,83),(64,79),(51,79)),
 ((61,94),(66,83),(52,65),(44,77)),
 ((61,94),(66,83),(43,74),(41,86)),
 ((61,91),(66,82),(46,88),(47,87)),
 ((64,82),(60,81),(65,82),(56,83)),
]
poses=[]
for i,coords in enumerate(arm_path):
 p=deepcopy(kp)
 for label,xy in zip(['RIGHT ARM','RIGHT ELBOW','LEFT ARM','LEFT ELBOW'],coords):
  j=next(j for j in p if j['label']==label);j.update(x=xy[0]/192,y=xy[1]/144)
  if label.startswith('LEFT'):j['z_index']=1 if i>=4 else 2
 poses.append(p)
args=dict(action='sling rifle behind shoulder, release near hand to holster',description='Compact adult woman agent with pale blonde high ponytail, black suit, olive tactical vest, black shoes, bare hands, right-facing profile. Exactly one compact black rifle on one shoulder sling; the support wrist carries this same rifle from the front toward the shoulder and back. No spare rifle, no second rifle, no pistol in hands. Same face, body mass, palette and pixel outline as reference. No effects.',direction='east',view='side',first_frame_url='data:image/png;base64,'+base64.b64encode(source.read_bytes()).decode(),first_frame_keypoints=kp,keypoints=poses,no_background=True,seed=109)
request=dict(tool='animate_with_skeleton_v3',estimated_generations=3,state='prepared_not_submitted',input_path=str(source.relative_to(ROOT)),input_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),arguments=args)
(OUT/'request.json').write_text(json.dumps(request,indent=2),encoding='utf-8')
im=Image.new('RGB',(192*4,164*2),'#41444c');d=ImageDraw.Draw(im)
edges=[('NECK','RIGHT SHOULDER'),('RIGHT SHOULDER','RIGHT ELBOW'),('RIGHT ELBOW','RIGHT ARM'),('NECK','LEFT SHOULDER'),('LEFT SHOULDER','LEFT ELBOW'),('LEFT ELBOW','LEFT ARM'),('NECK','RIGHT HIP'),('RIGHT HIP','RIGHT KNEE'),('RIGHT KNEE','RIGHT LEG'),('NECK','LEFT HIP'),('LEFT HIP','LEFT KNEE'),('LEFT KNEE','LEFT LEG')]
for i,p in enumerate(poses):
 x,y=(i%4)*192,(i//4)*164;d.text((x,y),str(i),fill='white');points={j['label']:(x+j['x']*192,y+20+j['y']*144) for j in p}
 for a,b in edges:d.line([points[a],points[b]],fill='#ffb45b' if 'RIGHT' in b else '#74bee5',width=2)
 for q in points.values():d.ellipse((q[0]-2,q[1]-2,q[0]+2,q[1]+2),fill='white')
im.save(OUT/'skeleton.png')
print(json.dumps(request))
