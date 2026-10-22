from production_ops import *
import copy
sys.path.insert(0,str(BASE.parent/'jyaldi-v5/scripts'));sys.path.insert(0,str(BASE/'scripts'))
import rig
for clip,name in [('execute','execute-stable-hands-r1'),('jump','jump-split-r1')]:
 poses=copy.deepcopy(rig.CLIPS[clip][2])
 if clip=='execute':
  # Anchor holding wrist to one pixel location through preparation and contact.
  fixed=poses[2]['RIGHT ARM'];elbow=poses[2]['RIGHT ELBOW']
  for i in range(1,6):poses[i]['RIGHT ARM']=fixed;poses[i]['RIGHT ELBOW']=elbow
  action='high near hand holds still; lower far spear-hand stabs once from waist, then both recover'
 else:
  for i,t in [(2,.7),(3,1),(4,1),(5,.7),(6,.25)]:
   p=poses[i];hx=(p['RIGHT HIP'][0]+p['LEFT HIP'][0])/2;hy=(p['RIGHT HIP'][1]+p['LEFT HIP'][1])/2
   goals={'RIGHT KNEE':(hx+18,hy-6),'RIGHT LEG':(hx+32,hy+13),'LEFT KNEE':(hx-15,hy+9),'LEFT LEG':(hx-26,hy+20)}
   for k,xy in goals.items():p[k]=tuple(p[k][j]*(1-t)+xy[j]*t for j in (0,1))
  action='light high leap, legs clearly split front and back in air, upright torso, land and recover'
 p=PROD/name;p.mkdir(exist_ok=False);src=PROD/'hand-inpaint-r1/result-00.png'
 req={'description':'slim adult woman, short wavy dark purple bob, one golden eye, pale skin, black fitted suit jacket white shirt black tie knee-length pencil skirt dark stockings low heels. Empty OPEN FLAT HANDS: four straight fingers pressed together, thumbs tucked. NO pointing index fingers, NO fists, NO weapons, NO effects. Same face and outfit as reference.','action':action,'direction':'east','view':'side','first_frame_url':'data:image/png;base64,'+base64.b64encode(src.read_bytes()).decode(),'first_frame_keypoints':rig.kp(rig.CLIPS['stab1'][2][2]),'keypoints':[rig.kp(x) for x in poses],'seed':1022503 if clip=='execute' else 1022504,'no_background':True}
 save(p/'request.json',req);save(p/'provenance.json',{'clip':clip,'input_sha256':sha(src),'source':str(src.relative_to(BASE)),'estimated_generations':3,'changed_method':'new open hand reference plus stable holding wrist' if clip=='execute' else 'explicit separated front/back leg geometry with same torso','user_visual_approval':False})
 out=Image.new('RGBA',(192*3,144*3))
 for i,kp in enumerate(poses):out.paste(rig.draw(kp,s=1),(i%3*192,i//3*144))
 out.resize((1152,864),Image.Resampling.NEAREST).save(p/'skeleton-review.png')
