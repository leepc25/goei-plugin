"""Export the ten bathroom rigs as PixelLab MCP arguments (no paid requests)."""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'game-src/action/jyaldi-v5/scripts'))
import rig
NAMES = 'showerin shower showerout bathin bath bathout toiletin toilet toiletout handwash'.split()
DESC = ('adult woman in her thirties, long straight black hair to waist, red eyes, pale skin, '
        'same face and body proportions as reference sprite, calm expression, pixel art')
def export():
    return {n: dict(action=rig.CLIPS[n][0], description=DESC+', '+rig.CLIPS[n][1],
        direction='east', view='side', no_background=True, seed=11,
        first_frame_url='https://raw.githubusercontent.com/leepc25/goei-plugin/main/game-src/action/jyaldi-v5/full/A2-pad.png',
        first_frame_keypoints=rig.kp(rig.A_KP), keypoints=[rig.kp(p) for p in rig.CLIPS[n][2]]) for n in NAMES}
if __name__ == '__main__':
    if '--corrected' in sys.argv:
        out=export()
        # Change geometry AND reference: furniture now exists in the input image.
        inside=rig.sh(rig.INSIDE,55)
        step=rig.sh(rig.STEP_OVER,25)
        bathpose=rig.P((rig.X+39,63),-28,0,0,(rig.X+80,82),(rig.X+74,84),(20,16),(14,17),tilt=-9,lk=rig.KNEE_UP,rk=rig.KNEE_UP)
        poses={'showerin':[rig.ENTRY,rig.REACH,rig.sh(rig.walkf(0),20),rig.sh(rig.walkf(.25),40),inside,inside],
               'bathin':[rig.ENTRY,rig.REACH,step,rig.lerp(step,bathpose,.5),bathpose,bathpose],
               'toilet':[rig.TS(0),rig.TS(.5),rig.TS(1),rig.TS(.5)]}
        first={'showerin':rig.ENTRY,'bathin':rig.ENTRY,'toilet':rig.TS()}
        for n in poses:
            out[n]['first_frame_keypoints']=rig.kp(first[n])
            out[n]['keypoints']=[rig.kp(p) for p in poses[n]]
            job={'showerin':'b98d6fff-bd6b-4f81-8869-3dae137ab378','bathin':'ac44e189-f127-418e-92b9-47805383eb7b','toilet':'f0e43b9e-bd19-409f-82b5-31f83575e7b3'}[n]
            idx=5 if n=='toilet' else 0
            out[n]['first_frame_url']=f'https://api.pixellab.ai/mcp/images/{job}/download?index={idx}'
        print(json.dumps({n:out[n] for n in poses}))
    else:
        print(json.dumps(export()))
