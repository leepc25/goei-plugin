from production_ops import *
import math
p=PROD/'jump-split-r1';req=json.loads((p/'request.json').read_text(encoding='utf-8'));out=BASE/'resume/corrected/jump';out.mkdir(exist_ok=True,parents=True);rows=[];hands=[]
for i in range(9):
 src=p/f'result-{i:02}.png';dest=out/f'{i:02}.png';dest.write_bytes(src.read_bytes());kp={x['label']:(x['x']*192,x['y']*144) for x in req['keypoints'][i]};hd=[]
 for side in ('RIGHT','LEFT'):
  x,y=kp[side+' ARM'];ex,ey=kp[side+' ELBOW'];hd.append([round(x,1),round(y,1),round(math.degrees(math.atan2(y-ey,x-ex)))])
 hands.append(hd);rows.append({'clip':'jump','frame':i,'output_sha256':sha(dest),'generation_job_id':'896b959c-f221-462b-a84f-c37c117c8377','user_visual_approval':False})
save(out/'hands.json',hands);save(p/'integration.json',{'accepted_frames':rows[:8],'discarded_tail_frame':8,'review':'전9장 열람. 공중2~5 앞뒤 다리 분리, 얼굴/복식 유지. 준비0~1 착지6~7. 사용자 시각 승인 대기.'})
save(PROD/'execute-stable-hands-r1/integration.json',{'accepted_frames':[],'rejected_frames':list(range(8)),'reason':'Holding wrist stable but upper fingers still point and lower hand shape inconsistent. Do not promote or repeat same skeleton/reference method.','user_visual_approval':False})
