from production_ops import *
import math,itertools
sys.path.insert(0,str(BASE.parents[2]/'tools'))
import build_spangdal_full_demo as builder
p=PROD/'combat-exact-r2';meta=json.loads((p/'provenance.json').read_text(encoding='utf-8'));rows=[];hands={}
for clip in {s['clip'] for s in meta['sources']}:
 poses=builder.rig.CLIPS[clip][2]
 if clip=='execute':poses=[{k['label']:(k['x']*192,k['y']*144) for k in frame} for frame in json.loads((PROD/'execute-stable-hands-r1/request.json').read_text(encoding='utf-8'))['keypoints']]
 hands[clip]=[]
 for pose in poses:
  frame=[]
  for side in ('RIGHT','LEFT'):
   x,y=pose[side+' ARM'];ex,ey=pose[side+' ELBOW'];frame.append([round(x,1),round(y,1),round(math.degrees(math.atan2(y-ey,x-ex)))])
  hands[clip].append(frame)
for s in meta['sources']:
 clip,i=s['clip'],s['frame'];src=p/f'{clip}-{i:02}.png';out=BASE/f'resume/corrected/{clip}/{i:02}.png'
 before=np.array(Image.open(BASE/s['path']).convert('RGBA'));after=np.array(Image.open(src).convert('RGBA'))
 assert np.array_equal(before[:50],after[:50]) and np.array_equal(before[102:],after[102:])
 # Head bounds: grabstab is farther right; throw3 cuff legitimately reaches x84,y66.
 head=(slice(0,68),slice(0,90)) if clip=='grabstab' else (slice(0,70),slice(0,83))
 assert np.array_equal(before[head],after[head]),'face changed'
 out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(src.read_bytes())
 specs=s['hands'];new=[[h[1][0],h[1][1],h[2]] for h in specs]
 if clip=='super':new=[[105,83,18],[107,64,-43]]
 if len(new)==1:
  old=hands[clip][i];idx=min(range(2),key=lambda j:(old[j][0]-new[0][0])**2+(old[j][1]-new[0][1])**2);old[idx]=new[0]
 else:hands[clip][i]=new
 rows.append({'clip':clip,'frame':i,'output_sha256':sha(out),'input_sha256':s['sha256'],'pixel_tool_id':'25030636-9dfa-4690-bf53-d638c1a924c5','cost':0,'face_and_lower_body_unchanged':True,'user_visual_approval':False})
# Complete the corrected execute sequence using its already-paid same-reference source.
for i in (0,7):
 src=PROD/f'execute-stable-hands-r1/result-{i:02}.png';out=BASE/f'resume/corrected/execute/{i:02}.png';out.write_bytes(src.read_bytes())
for clip,src_i,targets in [('spineup',3,[2]),('toss',3,[2,4])]:
 for i in targets:
  out=BASE/f'resume/corrected/{clip}/{i:02}.png';out.write_bytes((out.parent/f'{src_i:02}.png').read_bytes());hands[clip][i]=hands[clip][src_i]
for clip,frames in hands.items():save(BASE/f'resume/corrected/{clip}/hands.json',frames)
wp=PROD/'throw-waist-r3';urllib.request.urlretrieve('https://api.pixellab.ai/mcp/pixel-tools/9e8c7aec-d97d-464b-976b-dfb6487e691c/image.png',wp/'result-00.png');dest=BASE/'resume/corrected/throw/02.png';dest.write_bytes((wp/'result-00.png').read_bytes());save(wp/'integration.json',{'clip':'throw','frame':2,'output_sha256':sha(dest),'cost':0,'user_visual_approval':False})
save(p/'integration.json',{'accepted_frames':rows,'execute_unedited_sequence_edges':[0,7],'existing_builder_aliases':{'spineup2':3,'toss2':3,'toss4':3},'superseded_throw2':'throw-waist-r3','user_visual_approval':False})
save(PROD/'combat-exact-r1/integration.json',{'accepted_frames':[],'reason':'First exact pass left cuff gaps. Superseded by r2 connected cuffs; free only.','cost':0})
