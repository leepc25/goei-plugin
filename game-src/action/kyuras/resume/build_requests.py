import sys,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import krig,krig_v4_snaps_unrun as v4
DESC='thin adult man early thirties, gaunt face hollow cheeks, short grey-green swept back hair with one loose forehead strand, green eye, friendly smile, black hip-length suit jacket, white shirt, black necktie, black trousers, black shoes, bare slender hands, strict right-facing profile, character alone, no effects, no fire, no smoke, no weapons or props'
out=ROOT/'resume'/'requests';out.mkdir(exist_ok=True)
for name in ['snap1','snap2','snap3','idle_pipe','walk_pipe','shotgun']:
 rig=v4 if name.startswith('snap') else krig
 action,prop,poses=rig.CLIPS[name]
 action={'snap1':'Bent-elbow lead finger snap beside face, hand upright, step back','snap2':'Bent-elbow rear finger snap high above head, step back','snap3':'Cross arms then snap both hands, front high and back low, step back','idle_pipe':'Idle with empty gripping hand resting on shoulder','walk_pipe':'Walk with empty gripping hand on shoulder','shotgun':'Empty gripping hand at hip recoils upward, stumble back'}[name]
 req=dict(description=DESC+(', open fingers with thumb and middle finger poised to snap, index raised, never a fist' if name.startswith('snap') else ', empty hands curled to grip an invisible handle'),action=action,direction='east',view='side',first_frame_url='https://raw.githubusercontent.com/leepc25/goei-plugin/5e1cc01a1b61785af0ea3b52b670c3cbe1fa956b/game-src/action/kyuras/base/A.png',first_frame_keypoints=rig.kp(rig.BASE_KP),keypoints=[rig.kp(p) for p in poses],seed=11,no_background=True)
 raw=(json.dumps(req,ensure_ascii=False,indent=2)+'\n').encode();(out/(name+'.json')).write_bytes(raw)
 (out/(name+'.provenance.json')).write_text(json.dumps(dict(input_sha256=hashlib.sha256((ROOT/'base/A.png').read_bytes()).hexdigest(),request_sha256=hashlib.sha256(raw).hexdigest(),rig_sha256=hashlib.sha256(Path(rig.__file__).read_bytes()).hexdigest(),estimated_generations=3,frames=len(poses),historical_input=False),indent=2),encoding='utf8')
print('Prepared six bounded requests; no generation submitted')
