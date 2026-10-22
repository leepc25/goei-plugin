from production_ops import *
import math
p=PROD/'pierce3-cross-r1';req=json.loads((p/'request.json').read_text(encoding='utf-8'));out=BASE/'resume/corrected/pierce3';out.mkdir(exist_ok=True,parents=True);rows=[];hands=[]
for i in range(9):
 src=p/f'result-{i:02}.png';dest=out/f'{i:02}.png';dest.write_bytes(src.read_bytes());kp={x['label']:(x['x']*192,x['y']*144) for x in req['keypoints'][i]};hd=[]
 for side in ('RIGHT','LEFT'):
  x,y=kp[side+' ARM'];ex,ey=kp[side+' ELBOW'];hd.append([round(x,1),round(y,1),round(math.degrees(math.atan2(y-ey,x-ex)))])
 hands.append(hd);rows.append({'clip':'pierce3','frame':i,'output_sha256':sha(dest),'generation_job_id':'a3743d39-b041-4287-96ad-c62228b484b3','user_visual_approval':False})
save(out/'hands.json',hands);save(p/'integration.json',{'accepted_frames':rows[:8],'discarded_tail_frame':8,'review':'팔 교차·기준 얼굴/복식 유지. 준비2·회수6 손끝 추가 검수, 사용자 승인 전'})
