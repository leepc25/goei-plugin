"""Free geometric preparation for a different keypose/interpolation workflow."""
from pathlib import Path
import json,math,hashlib
import build_drafts as rig
from PIL import Image,ImageDraw
HERE=Path(__file__).resolve().parent
OUT=HERE/'walk-contact-v2'
OUT.mkdir(exist_ok=True)
poses=[rig.pose(57,83.7,1,(68,128),(48,128),-25,False),
       rig.pose(67,82.5,1,(68,128),(67,120),0,False),
       rig.pose(77,83.7,1,(68,128),(88,128),25,False)]
for q in poses:
 for side in ['RIGHT','LEFT']:
  for a,b,n in [('HIP','KNEE',23),('KNEE','LEG',23),('SHOULDER','ELBOW',17),('ELBOW','ARM',14)]:
   assert abs(math.dist(q[side+' '+a],q[side+' '+b])-n)<1e-6
args=json.loads((HERE/'walk-20261022/request.json').read_text(encoding='utf-8'))['arguments']
args['keypoints']=[rig.kp(q) for q in poses]
args['action']='upright walking contact, passing, opposite contact key poses'
args['seed']=102203
canonical=json.dumps(args,sort_keys=True,separators=(',',':')).encode()
payload={'tool':'animate_with_skeleton_v3','quoted_generations':2,'method_change':'Three upright contact/passing keyposes before pinned endpoint interpolation; stride40 instead of48; hips83.7/82.5 instead of85-88. No repeated full-cycle request.','input_sha256':'fa72194d31e4f08b1612d99b7ffcf056a6d67d8e1ff2b51139424afc631e3b0a','arguments_sha256':hashlib.sha256(canonical).hexdigest(),'arguments':args,'pixel_keypoints':poses,'cycle_delta_x':40}
(OUT/'key-request.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
sheet=Image.new('RGBA',(576*3,432))
for i,q in enumerate(poses):sheet.paste(rig.draw(q),(i*576,0))
sheet.save(OUT/'key-skeleton.png')
print('PASS unchanged bone lengths; 3 keyposes; '+payload['arguments_sha256'])
