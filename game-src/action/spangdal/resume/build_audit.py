"""스팡달 기존 그림을 수정하지 않고 장별 검수 시트·해시·관측값을 만든다."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw
BASE=Path(__file__).resolve().parents[1]
OUT=Path(__file__).resolve().parent/'review'
CLIPS=['stab1','slash2','pierce3','execute','spineup','throw','fan','toss','reargrab','grabstab','super',
       'pipe','idle_pipe','walk_pipe','shotgun','idle_shotgun','walk_shotgun','run_shotgun',
       'walk','run','jump','passslash','carry2_run','stepup','sneak','stance']
# 아래는 시트에서 확인한 결함이며 숫자 검사로 시각 합격을 자동 판정하지 않는다.
FINDINGS={
 'stab1':{i:'관수보다 검지 가리키기로 읽힘' for i in [1,2,3,4]},
 'slash2':{i:'손·팔 겹침: 1타와 다른 손인지 근접 확인 필요' for i in range(6)},
 'pierce3':{i:'양손 X 관통 대신 나란한 주먹 지르기로 읽힘' for i in range(2,7)},
 'execute':{i:'검지 가리키기. 1→2 위 손 높이 급변' for i in range(1,7)},
 'spineup':{i:'위 손 가리키기. 2·3은 빌더 교체로 같은 그림' for i in [2,3,4]},
 'throw':{0:'위 손 검지 가리키기',1:'앞으로 뻗은 손이 주먹',2:'양손 가리키기',3:'위 손 검지 가리키기'},
 'toss':{i:'2·3·4 같은 교체 그림, 손끝 가리키기. 끝 장은 자세 재진입 필요' for i in [2,3,4,5]},
 'reargrab':{i:'얼굴·겹친 손: 잡은 상대 없는 상태에서 파지 세부 판정 보류' for i in range(6)},
 'grabstab':{i:'두 손 검지 가리키기, 손날 관수 불충족' for i in range(4)},
 'super':{i:'마무리 X 대신 두 손 가리키기' for i in [7,8]},
 'run':{2:'다리 옆 회색 이중 윤곽',3:'다리 윤곽·팔 경계 추가 근접 확인',4:'눈색과 허벅지 색 경계 추가 근접 확인'},
 'jump':{i:'공중 다리 앞뒤 벌림이 설계보다 좁음. 양 무릎 몸 쪽으로 모임' for i in [2,3,4,5,6]},
 'passslash':{0:'다리 이중 윤곽',5:'다리 이중 윤곽·마무리 상체 높이 변화'},
 'carry2_run':{2:'발 옆 회색 조각'},
 'stepup':{0:'발·다리 외곽 이중 윤곽'},
 'sneak':{5:'발목 옆 회색 줄'},
 'stance':{i:'손 외곽이 뭉쳐 손가락 모양 판정 어려움' for i in range(4)},
}
manifest=json.loads((BASE/'full/final/manifest.json').read_text())
rows=[]
for clip in CLIPS:
 meta=manifest['clips'][clip]; n=meta['frames']; strip=Image.open(BASE/'full/final'/f'{clip}.png').convert('RGBA')
 sheet=Image.new('RGB',(4*384,((n+3)//4)*312),(52,62,71)); draw=ImageDraw.Draw(sheet)
 for i in range(n):
  frame=strip.crop((i*192,0,(i+1)*192,144)); x=(i%4)*384; y=(i//4)*312
  draw.text((x+6,y+4),f'{clip} {i:02}',fill='white');sheet.paste(frame.resize((384,288),Image.Resampling.NEAREST),(x,y+22),frame.resize((384,288),Image.Resampling.NEAREST))
  bb=frame.getchannel('A').getbbox()
  note=FINDINGS.get(clip,{}).get(i,'시트 열람: 이 장에서 추가 결함을 단정하지 않음. 클립 시각 합격은 보류')
  if 'pipe' in clip or 'shotgun' in clip:
   note='무기가 캐릭터 그림에 포함됨. 빈손 파지 원칙 불충족; 전환 클립 간 무기 길이·형태 불일치'
  rows.append({'clip':clip,'frame':i,'rendered_rgba_sha256':hashlib.sha256(frame.tobytes()).hexdigest(),
               'bbox':bb,'opaque_bottom_y':bb[3]-1 if bb else None,
               'source':meta.get('frameSources',[None]*n)[i],
               'face_body_clothing':'기준 S0·손수정본과 비교 열람. 프레임별 사용자 승인 없음',
               'hands_grounding_and_motion':note,
               'loop_boundary':'마지막→0을 시연판 장넘김으로 확인 필요' if meta['loop'] else '비반복: 다음 자세 진입 별도 확인',
               'review_state':'needs_clip_review_or_correction','user_visual_approval':False})
 sheet.save(OUT/f'frames-{clip}.png')
(OUT/'frames.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print(len(CLIPS),'clips',len(rows),'frames')
