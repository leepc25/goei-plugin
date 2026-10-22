#!/usr/bin/env python3
"""무료 설계만: PixelLab 네트워크 호출/원본 픽셀 수정/엔진 적용 기능 없음."""
from pathlib import Path
import hashlib,json,math
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).resolve().parent
BASE=ROOT/'game-src/action/jyaldi-v5/full/clips/guard/00.png'
W,H=192,144
LABELS=['NOSE','NECK','RIGHT SHOULDER','RIGHT ELBOW','RIGHT ARM','LEFT SHOULDER','LEFT ELBOW','LEFT ARM','RIGHT HIP','RIGHT KNEE','RIGHT LEG','LEFT HIP','LEFT KNEE','LEFT LEG','RIGHT EYE','LEFT EYE','RIGHT EAR','LEFT EAR']
BONES=[('NECK','NOSE'),('NECK','RIGHT SHOULDER'),('RIGHT SHOULDER','RIGHT ELBOW'),('RIGHT ELBOW','RIGHT ARM'),('NECK','LEFT SHOULDER'),('LEFT SHOULDER','LEFT ELBOW'),('LEFT ELBOW','LEFT ARM'),('NECK','RIGHT HIP'),('RIGHT HIP','RIGHT KNEE'),('RIGHT KNEE','RIGHT LEG'),('NECK','LEFT HIP'),('LEFT HIP','LEFT KNEE'),('LEFT KNEE','LEFT LEG')]
# 직접 본 guard/00 픽셀 좌표. 가려진 왼쪽 어깨·팔꿈치·손은 추정임을 별도 기록.
REF={'NOSE':(65,55),'NECK':(60,62),'RIGHT SHOULDER':(62,65),'RIGHT ELBOW':(77,76),'RIGHT ARM':(78,64),
 'LEFT SHOULDER':(58,64),'LEFT ELBOW':(65,72),'LEFT ARM':(69,61),
 'RIGHT HIP':(58,91),'RIGHT KNEE':(74,105),'RIGHT LEG':(68,129),'LEFT HIP':(54,92),'LEFT KNEE':(57,108),'LEFT LEG':(43,129),
 'RIGHT EYE':(63,52),'LEFT EYE':(65,52),'RIGHT EAR':(58,54),'LEFT EAR':(59,53)}

def add(a,b):return (a[0]+b[0],a[1]+b[1])
def polar(length,angle):
 a=math.radians(angle);return (length*math.sin(a),length*math.cos(a))
def knee(hip,ankle):
 dx,dy=ankle[0]-hip[0],ankle[1]-hip[1];d=math.hypot(dx,dy)
 if d>46:raise ValueError(f'다리 목표가 길이를 초과: {d}')
 # 같은 23px 두 마디, 오른쪽을 보는 무릎은 굽힌 끝이 앞으로.
 mid=((hip[0]+ankle[0])/2,(hip[1]+ankle[1])/2); h=math.sqrt(23**2-(d/2)**2)
 return (mid[0]+dy/d*h,mid[1]-dx/d*h)
def pose(x,y,lean,near_ankle,far_ankle,arm_angle,run):
 neck=add((x,y),polar(-26,-lean))
 q={'NECK':neck,'RIGHT HIP':(x+1,y),'LEFT HIP':(x-1,y)}
 q['NOSE']=add(neck,(6,-9));q['RIGHT EYE']=add(q['NOSE'],(-2,-3));q['LEFT EYE']=add(q['NOSE'],(-1,-3));q['RIGHT EAR']=add(q['NOSE'],(-7,-2));q['LEFT EAR']=add(q['NOSE'],(-6,-2))
 for side,sign,ankle in [('RIGHT',1,near_ankle),('LEFT',-1,far_ankle)]:
  q[side+' SHOULDER']=add(neck,(sign*1.5,4))
  ang=arm_angle*sign
  q[side+' ELBOW']=add(q[side+' SHOULDER'],polar(17,ang))
  q[side+' ARM']=add(q[side+' ELBOW'],polar(14,ang+(90 if run else 20)))
  q[side+' LEG']=ankle;q[side+' KNEE']=knee(q[side+' HIP'],ankle)
 return q

def make(clip):
 if clip=='walk':
  dx=6;ys=[86,88,85,85]*2;angles=[-22,-12,0,12,22,12,0,-12]
  # 0..4 near support x73, 4..virtual8 far support x97.
  near=[(73,128),(73,128),(73,128),(73,128),(73,128),(82,124),(93,120),(109,124)]
  far=[(49,128),(58,124),(69,120),(85,124),(97,128),(97,128),(97,128),(97,128)]
  phases=['근측 접촉','근측 체중 싣기','원측 통과','원측 발 내밀기','원측 접촉','원측 체중 싣기','근측 통과','근측 발 내밀기']
  contact=[['RIGHT','LEFT'],['RIGHT'],['RIGHT'],['RIGHT'],['LEFT','RIGHT'],['LEFT'],['LEFT'],['LEFT']]
  lean=3
 else:
  dx=10;ys=[91,94,85,84]*2;angles=[-50,-15,30,55,50,15,-30,-55]
  near=[(80,128),(80,128),(80,128),(71,109),(84,113),(92,102),(115,102),(140,115)]
  far=[(44,113),(52,102),(75,102),(100,115),(120,128),(120,128),(120,128),(111,109)]
  phases=['근측 접촉','근측 압축','근측 추진','비행·원측 앞으로','원측 접촉','원측 압축','원측 추진','비행·근측 앞으로']
  contact=[['RIGHT'],['RIGHT'],['RIGHT'],[],['LEFT'],['LEFT'],['LEFT'],[]]
  lean=22
 poses=[pose(57+dx*i,ys[i],lean,near[i],far[i],angles[i],clip=='run') for i in range(8)]
 return poses,dict(root_x=[dx*i for i in range(8)],cycle_delta_x=dx*8,phases=phases,contact=contact)

def kp(q):return [{'label':k,'x':round(q[k][0]/W,6),'y':round(q[k][1]/H,6),'z_index':8 if k.startswith('RIGHT') else 2 if k.startswith('LEFT') else 5} for k in LABELS]
def write(name,data): (OUT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def draw(q,base=None,scale=3):
 im=Image.new('RGBA',(W*scale,H*scale),(35,43,52,255))
 if base:im.alpha_composite(base.resize(im.size,Image.Resampling.NEAREST))
 d=ImageDraw.Draw(im);d.line((0,136*scale,W*scale,136*scale),fill=(110,120,130),width=1)
 for a,b in BONES:
  col=(255,105,85) if 'RIGHT' in a+b else (85,175,255) if 'LEFT' in a+b else (235,235,235)
  d.line([(q[a][0]*scale,q[a][1]*scale),(q[b][0]*scale,q[b][1]*scale)],fill=col,width=scale)
 for k,p in q.items():
  x,y=p[0]*scale,p[1]*scale;d.ellipse((x-2,y-2,x+2,y+2),fill=(255,230,110))
 return im

def validate(clip,poses,meta):
 out={'clip':clip,'frames':8,'all_18_unique':True,'normalized_in_bounds':True,'bone_lengths':True,'stance_ankle_locked':True,'knee_bends_forward':True,'cycle_delta_x':meta['cycle_delta_x'],'visual_review':'대기: 뼈대 검수이며 그림 합격 아님'}
 for q in poses:
  assert set(q)==set(LABELS)
  assert all(0<=x<W and 0<=y<H for x,y in q.values())
  for side in ['RIGHT','LEFT']:
   for a,b,n in [('HIP','KNEE',23),('KNEE','LEG',23),('SHOULDER','ELBOW',17),('ELBOW','ARM',14)]:
    assert abs(math.dist(q[side+' '+a],q[side+' '+b])-n)<1e-6
   h,k,a=[q[side+' '+s] for s in ['HIP','KNEE','LEG']]
   assert (k[0]-h[0])*(a[1]-k[1])-(k[1]-h[1])*(a[0]-k[0])>=0
 for i in range(7):
  for s in set(meta['contact'][i])&set(meta['contact'][i+1]):assert poses[i][s+' LEG']==poses[i+1][s+' LEG']
 # 경계 7→다음0의 지지발은 걷기만 존재. 다음0은 첫 좌표+cycle delta.
 if clip=='walk':
  s='LEFT';assert poses[7][s+' LEG']==(poses[0][s+' LEG'][0]+meta['cycle_delta_x'],poses[0][s+' LEG'][1])
 last_to_next={k:math.dist(poses[-1][k],(poses[0][k][0]+meta['cycle_delta_x'],poses[0][k][1])) for k in LABELS}
 interior=max(math.dist(poses[i][k],poses[i+1][k]) for i in range(7) for k in LABELS)
 assert max(last_to_next.values())<=interior+1e-6
 out['max_joint_step_pixels']=round(interior,3)
 out['loop_boundary_max_joint_step_pixels']=round(max(last_to_next.values()),3)
 out['loop_boundary_no_larger_than_interior_step']=True
 return out

def main():
 OUT.mkdir(exist_ok=True)
 base=Image.open(BASE).convert('RGBA');assert base.size==(W,H)
 write('reference.json',{'status':'수동 맞춤 초안·가려진 관절 검수 대기','path':str(BASE.relative_to(ROOT)),'sha256':hashlib.sha256(BASE.read_bytes()).hexdigest(),'basis':'A → 재킷 수정 A2 → guard/00 후속 옆모습','approved_reference_history':'A 승인 이력. A2/guard를 독립 사용자 승인으로 간주하지 않음','coordinate_space':'192x144 pixel; RIGHT=near/east','pixel_keypoints':REF,'normalized_keypoints':kp(REF),'occluded_low_confidence':['LEFT SHOULDER','LEFT ELBOW','LEFT ARM','LEFT EYE','LEFT EAR'],'review_required':'왼팔 가림과 실제 어깨 위치를 독립 검수 후 유료 제출. 기존 G0를 무조건 복사하지 않음.'})
 draw(REF,base).save(OUT/'reference-overlay.png')
 checks=[]
 for clip in ['walk','run']:
  poses,meta=make(clip);checks.append(validate(clip,poses,meta))
  args={'description':'adult woman agent, long straight black hair, red eyes, blue-grey shaded black suit with a hip-length jacket, white shirt, black tie, black gloves, black shoes, right hip holster, identical proportions and palette to reference, character only',
  'action':'walking forward, alternating opposite arms and legs' if clip=='walk' else 'sprinting forward with bent elbows, opposite arms and legs, two flight phases',
  'direction':'east','view':'side','template_id':'mannequin','no_background':True,'seed':1022 if clip=='walk' else 1023,
  'first_frame_url':'https://raw.githubusercontent.com/leepc25/goei-plugin/0a13285205b77fd6cf33b966cea246efa0d3082e/game-src/action/jyaldi-v5/full/clips/guard/00.png',
  'first_frame_keypoints':kp(REF),'keypoints':[kp(q) for q in poses]}
  write(clip+'-request.draft.json',{'status':'미제출·미생성·시각 검수 대기','tool':'animate_with_skeleton_v3','quoted_generations':3,'quoted_at':'2026-10-22','quote_source':'공개 PixelLab MCP tools/list: 4~14장=3회, parent가 이번 세션 조회','job_id':None,'actual_cost':None,'arguments':args})
  write(clip+'-motion.json',{'status':'설계 초안·엔진 미적용','frame_size':[W,H],'anchor':[57,136],'ankle_ground_y':128,'rendered_sole_target_y':135,
   'space':'root-motion; 지지발은 그림/세계 좌표에서 고정; 캐릭터 몸통이 그림 안에서 전진','current_engine_compatible':False,
   'integration_contract':'주기 중 월드 루트를 별도로 계속 이동시키지 않음. 주기 끝에서 cycle_delta_x * 표시배율만 이동 후 0장으로. 현 엔진에 그대로 넣으면 이중 이동. 엔진 연결 검토 필요.',
   'in_place_conversion_contract':'엔진 담당이 제자리 방식을 유지할 경우 원본을 삭제/수정하지 않고 별도 파생 팩에서 frame별 root_x를 뺀다. 세계 이동은 해당 delta에 맞춰야 지지발이 고정된다. 현재 균일 이동량 동기화만으로 접지 합격 주장 금지.',
   **meta,'pixel_keypoints':poses,'frame_duration_ms':[100]*8 if clip=='walk' else [70]*8,
   'loop_boundary':'07→다음00은 root cycle_delta_x를 더해 검사. 중복 08 프레임 생성하지 않음.'})
  sheet=Image.new('RGBA',(W*3*4,H*3*2+48),(24,30,38,255))
  for i,q in enumerate(poses):
   x=(i%4)*W*3;y=(i//4)*(H*3+24)
   sheet.alpha_composite(draw(q),(x,y+24));ImageDraw.Draw(sheet).text((x+8,y+5),f'{clip} {i:02}   root +{meta["root_x"][i]}',fill='white')
  sheet.save(OUT/(clip+'-skeleton.png'))
 write('validation.json',{'status':'기하 검사 통과·그림 미생성·참조 가림 관절 검수 대기','network_calls':0,'paid_calls':0,'checks':checks})
 print('설계 2클립 저장. 네트워크/유료 호출 없음. 원본 이미지·엔진 파일 변경 없음.')
if __name__=='__main__':main()
