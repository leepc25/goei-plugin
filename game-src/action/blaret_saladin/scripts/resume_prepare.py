"""Offline requests only. Never submits, retries, deletes or overwrites originals."""
import hashlib, json, sys
from pathlib import Path
from PIL import Image, ImageDraw
import bsrig

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'resume'
COMMIT = '59a2a883'  # replaced with full immutable commit by caller
JOINTS = bsrig.J

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def baseline_kp(cn):
    # Measured from the selected character's actual pixels, not another character's rig.
    pts = {'blaret': [(104,83),(98,92),(96,96),(94,109),(96,122),(94,96),(91,109),(94,121),(98,120),(101,139),(102,161),(96,120),(94,140),(93,161),(103,80),(104,80),(98,81),(98,81)],
           'saladin': [(104,80),(97,87),(92,91),(88,109),(92,122),(98,92),(99,108),(102,122),(96,119),(101,140),(102,161),(94,119),(92,139),(90,161),(103,77),(104,77),(97,78),(98,78)]}[cn]
    return [dict(label=n,x=round(x/256,5),y=round(y/176,5),z_index=8 if n.startswith('RIGHT') else 2 if n.startswith('LEFT') else 5) for n,(x,y) in zip(JOINTS,pts)]

def prepare(cn,clip,commit):
    key=f'{cn}-{clip}'; folder=OUT/key; folder.mkdir(parents=True,exist_ok=True)
    if (folder/'receipt.json').exists():
        raise SystemExit('Receipt exists; never resubmit. Inspect/recover first.')
    ch=bsrig.CHARS[cn]; action,prop,poses=ch['clips'][clip]
    kp=[bsrig.kp(p,ch['scale']) for p in poses]
    root_motion=None
    if cn=='saladin' and clip in ('walk','run'):
        # Advance inside the frame: lock the stance ankle in world coordinates.
        # At the wrap the actor advances a whole cycle, exactly once.
        near='RIGHT LEG'; far='LEFT LEG'
        x0=poses[0][near][0]; shift4=x0-poses[4][near][0]
        far_target=poses[4][far][0]+shift4
        shifts=[(x0-p[near][0]) if i<=4 else (far_target-p[far][0]) for i,p in enumerate(poses)]
        poses=[bsrig.sh(p,s) for p,s in zip(poses,shifts)]
        kp=[bsrig.kp(p,ch['scale']) for p in poses]
        cycle=(far_target-bsrig.CHARS[cn]['clips'][clip][2][0][far][0])*ch['scale']
        root_motion={'per_frame':[round(s*ch['scale'],3) for s in shifts],'cycle_dx':round(cycle,3),'apply':'sprite contains progression; actor moves only on loop wrap','right_contact':[0,1,2,3,4],'left_contact':[4,5,6,7]}
    source=ROOT/'base'/f'{cn}.png'; first=baseline_kp(cn)
    if cn=='saladin':
        # His own completed draw endpoint visibly holds both weapons. Preserve identity.
        source=ROOT/'clips/saladin/draw/07.png'
        first=bsrig.kp(bsrig.SA['clips']['draw'][2][7],ch['scale'])
        overrides={'RIGHT ARM':(110,104),'LEFT ARM':(115,116),'RIGHT ELBOW':(97,113),'LEFT ELBOW':(101,122),'NOSE':(104,80),'NECK':(97,90)}
        for p in first:
            if p['label'] in overrides: p['x'],p['y']=[round(v/d,5) for v,d in zip(overrides[p['label']],(256,176))]
    if cn=='blaret' and clip=='guns_idle':
        # Separate hands in silhouette, move elbows away from the chest/face.
        for frame in kp:
            for p in frame:
                if p['label']=='LEFT ARM': p['x']-=0.035; p['y']+=0.035
        action='low ready stance with two separate pistols, hands at waist height, subtle breathing'
    if cn=='blaret' and clip=='stake_finish':
        action='kneels and lowers both hands to an empty floor, one isolated character'
        # Remove overhead leap: grounded preparation, controlled kneel, clear face.
        kp=[bsrig.kp(p) for p in [bsrig.BS(0),bsrig.SF1,bsrig.SF1,bsrig.staged(bsrig.SF1,bsrig.SF2,.35),bsrig.staged(bsrig.SF1,bsrig.SF2,.7),bsrig.SF2,bsrig.SF2,bsrig.sh(bsrig.SF2,0,-1)]]
    if cn=='blaret' and clip=='super_ready':
        action='reaches diagonally forward and upward, head stays in right profile and face unobstructed'
        for i,frame in enumerate(kp):
            if i<2: continue
            for p in frame:
                if p['label'] in ('RIGHT ARM','LEFT ARM','RIGHT ELBOW','LEFT ELBOW'): p['x']+=0.055
    args=dict(action=action,description=(ch['desc']+', '+prop+', one character only, isolated, strict right side profile, no effects, no other people')[:1000],direction='east',first_frame_url=f'https://raw.githubusercontent.com/leepc25/goei-plugin/{commit}/'+source.relative_to(ROOT.parents[2]).as_posix(),first_frame_keypoints=first,keypoints=kp,seed=122,view='side',no_background=True)
    for frame in [first]+kp:
        assert len(frame)==18 and len({p['label'] for p in frame})==18
        assert all(0<=p['x']<=1 and 0<=p['y']<=1 for p in frame)
    request=dict(character=cn,clip=clip,tool='animate_with_skeleton_v3',estimated_generations=3,input_path=source.relative_to(ROOT.parents[2]).as_posix(),input_sha256=digest(source),root_motion=root_motion,arguments=args)
    request['request_sha256']=hashlib.sha256(json.dumps(args,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    (folder/'request.json').write_text(json.dumps(request,indent=2)+'\n',encoding='utf-8')
    im=Image.open(source).convert('RGBA'); bg=Image.new('RGBA',im.size,'#465265');bg.alpha_composite(im); d=ImageDraw.Draw(bg)
    for p in first:
        x,y=p['x']*256,p['y']*176;d.ellipse((x-1,y-1,x+1,y+1),fill='red')
    bg.resize((768,528),Image.Resampling.NEAREST).save(folder/'input-overlay.png')
    print(key,request['input_sha256'],request['request_sha256'])

if __name__=='__main__': prepare(*sys.argv[1:])
