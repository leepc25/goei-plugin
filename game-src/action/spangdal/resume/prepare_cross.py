from production_ops import *
import copy,os
sys.path.insert(0,str(BASE.parent/'jyaldi-v5/scripts'));sys.path.insert(0,str(BASE/'scripts'))
import rig
poses=copy.deepcopy(rig.CLIPS['pierce3'][2])
# Original pelvis/feet retained; forearms now visibly cross instead of parallel fists.
for i,p in enumerate(poses):
 t={0:0,1:0,2:.65,3:1,4:1,5:1,6:.5,7:0,8:0}.get(i,0)
 if not t:continue
 neck=p['NECK'];targets={'RIGHT ELBOW':(neck[0]+22,neck[1]+17),'RIGHT ARM':(neck[0]+43,neck[1]+2),'LEFT ELBOW':(neck[0]+22,neck[1]-1),'LEFT ARM':(neck[0]+42,neck[1]+14)}
 for label,xy in targets.items():p[label]=tuple(p[label][j]*(1-t)+xy[j]*t for j in (0,1))
p=PROD/'pierce3-cross-r1';p.mkdir(exist_ok=False)
src=PROD/'hand-inpaint-r1/result-00.png'
req={'description':'slim adult woman agent, short wavy dark purple bob, one golden eye, pale skin, black fitted suit jacket white shirt black tie knee-length pencil skirt dark stockings low heels. EMPTY OPEN SPEAR HANDS: all four fingers straight and tightly together, thumbs tucked. No pointing index, no fists, no weapons, no effects. Same face and clothes as reference.', 'action':'both open spear hands thrust in an X, forearms crossing, front foot lunges, then recover','direction':'east','view':'side','first_frame_url':'data:image/png;base64,'+base64.b64encode(src.read_bytes()).decode(),'first_frame_keypoints':rig.kp(rig.CLIPS['stab1'][2][2]),'keypoints':[rig.kp(x) for x in poses],'seed':1022446,'no_background':True}
save(p/'request.json',req);save(p/'provenance.json',{'source':str(src.relative_to(BASE)),'input_sha256':sha(src),'tool':'animate_with_skeleton_v3','estimated_generations':3,'changed_method':'new inpainted open hand reference plus crossed forearm skeleton, not old parallel wrists','user_visual_approval':False})
out=Image.new('RGBA',(192*3,144*3))
for i,kp in enumerate(poses):out.paste(rig.draw(kp,s=1),(i%3*192,i//3*144))
out.resize((1152,864),Image.Resampling.NEAREST).save(p/'skeleton-review.png')
rig.draw(rig.CLIPS['stab1'][2][2],Image.open(src),s=3).save(p/'reference-skeleton.png')
