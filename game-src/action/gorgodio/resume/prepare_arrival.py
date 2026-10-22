"""Build one reviewed armor transition request; never submits paid work."""
from pathlib import Path
import sys, json, hashlib
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
GD=HERE.parent
sys.path.insert(0,str(GD/'scripts'))
import rig, rig_armor as armor
from rigbase import lerp, BONES

OUT=HERE/'arrival-v2'
OUT.mkdir(exist_ok=True)
# Body summon/07 endpoint, mapped about the common pelvis/sole datum.
# New armor starts with the SAME raised near fist; no crouch on the cut.
scale=1.09
raised={k:(100+(x-86)*scale,187+(y-169)*scale) for k,(x,y) in rig.SM1.items()}
guard=dict(armor.G0)
# Keep the two planted ankles fixed while lowering the raised hand.
for side in ['RIGHT','LEFT']:
    guard[side+' LEG']=raised[side+' LEG']
poses=[raised,raised]+[lerp(raised,guard,t) for t in [.18,.38,.62,.82,1,1]]
args=dict(description=armor.DESC,action='Hold raised near fist, lower it into guard with both feet planted',
          direction='east',view='side',no_background=True,seed=2207,
          first_frame_url='https://raw.githubusercontent.com/leepc25/goei-plugin/3fb3518c324bf360db3329c28c44b1b7872e1a35/game-src/action/gorgodio/armor/ref.png',
          first_frame_keypoints=armor.B.kp(armor.REF_POSE),keypoints=[armor.B.kp(p) for p in poses])
assert all(len(p)==18 and all(0<j['x']<1 and 0<j['y']<1 for j in p) for p in args['keypoints'])
raw=json.dumps(args,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
(OUT/'request.json').write_bytes(raw)
proof={'request_sha256':hashlib.sha256(raw).hexdigest(),'reference_sha256':hashlib.sha256((GD/'armor/ref.png').read_bytes()).hexdigest(),
       'body_endpoint_sha256':hashlib.sha256((GD/'full/clips/summon/07.png').read_bytes()).hexdigest(),
       'body_endpoint_pose':rig.SM1,'armor_start_pose':raised,'armor_poses':poses,
       'mapping':{'scale':scale,'body_anchor':86,'body_sole':169,'armor_anchor':100,'armor_sole':187},
       'estimate_generations':3,'status':'prepared_not_submitted','user_visual_approval':False}
(OUT/'plan.json').write_text(json.dumps(proof,indent=2),encoding='utf-8')
sheet=Image.new('RGB',(1024,384),'#243341')
for i,p in enumerate(poses):
    im=armor.B.draw(p,None,1).convert('RGBA')
    sheet.paste(im,((i%4)*256,(i//4)*192),im)
    ImageDraw.Draw(sheet).text(((i%4)*256+4,(i//4)*192+4),str(i),fill='white')
sheet.save(OUT/'skeletons.png')
print(json.dumps({'request_sha256':proof['request_sha256'],'frames':len(poses),'estimate':3}))
