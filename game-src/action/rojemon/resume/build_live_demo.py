"""Rojemon-only delivery. Embed new reviewed raws without cropping to legacy canvas.

Read-only reuse of the original standalone game template and existing final assets.
Never writes shared engine, atlas, background or original generated clips.
"""
from pathlib import Path
import base64, copy, hashlib, io, json
from PIL import Image

HERE=Path(__file__).resolve().parent
CHAR=HERE.parent
ROOT=CHAR.parents[2]
def b64(p): return base64.b64encode(p.read_bytes()).decode()
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    manifest=json.loads((CHAR/'final/manifest.json').read_text(encoding='utf-8'))
    strips={v['src']:b64(CHAR/'final'/f"{v['src']}.png") for v in manifest['clips'].values()}
    review={}
    delivery=HERE/'delivery'; delivery.mkdir(exist_ok=True)
    for folder in sorted((HERE/'live').iterdir()):
        if not folder.is_dir() or not (folder/'qa.json').exists(): continue
        qa=json.loads((folder/'qa.json').read_text(encoding='utf-8'))
        if not qa.get('include_in_demo'): continue
        clip=folder.name
        files=sorted((folder/'raw').glob('*.png'))
        frames=[Image.open(p).convert('RGBA') for p in files]
        indices=qa.get('selected_raw_indices',list(range(len(frames))))
        raw_frames=frames
        frames=[raw_frames[i] for i in indices]
        ent=copy.deepcopy(manifest['clips'][clip])
        anc=104 if clip.startswith('man_') else 105
        ent.update(fw=256,fh=160,foot=144,anc=anc,frames=len(frames),label='수정 검수 · '+ent['label'],raw_indices=indices)
        if 'runtime_feet' in qa: ent['feet']=qa['runtime_feet']
        if clip=='man_throw': ent['hits']=[4]
        request=json.loads((HERE/'requests'/f'{clip}.json').read_text(encoding='utf-8'))['arguments']
        ent['anchors']=[]
        for im,pose in zip(frames,[request['keypoints'][i] for i in indices]):
            p={j['label']:[round(j['x']*256),round(j['y']*160)] for j in pose}
            ent['anchors'].append(dict(hand=max(p['RIGHT ARM'],p['LEFT ARM'],key=lambda v:v[0]),head=[p['NOSE'][0]-4,im.getbbox()[1]+1]))
        sheet=Image.new('RGBA',(256*len(frames),160))
        for i,im in enumerate(frames): sheet.paste(im,(256*i,0))
        target=delivery/f'{clip}.png'; sheet.save(target)
        strips[clip]=b64(target); manifest['clips'][clip]=ent
        old=sorted((CHAR/'clips'/clip).glob('*.png'))
        state=json.loads((folder/'state.json').read_text())
        review[clip]=dict(label=ent['label'],frames=['data:image/png;base64,'+b64(files[i]) for i in indices],old=['data:image/png;base64,'+b64(p) for p in old],sha256=[digest(p) for p in files],job_id=state['job_id'],actual_cost=state['actual_cost'],qa=qa,manifest=ent)
    assert review, 'No reviewed new generated clips'
    # The legacy getup already starts with down[6] twice to replace noisy frames.
    # Keep that documented transition but use the new selected final down frame.
    # Remaining getup frames are explicit legacy comparison assets, never new art.
    if 'down' in review:
        ent=copy.deepcopy(manifest['clips']['getup'])
        old=Image.open(CHAR/'final/getup.png').convert('RGBA')
        n=ent['frames']; fw=ent['fw']; fh=ent['fh']; getup=[]
        for i in range(n):
            im=Image.new('RGBA',(256,160))
            im.paste(old.crop((i*fw,0,(i+1)*fw,fh)),(48,8));getup.append(im)
        end=Image.open(HERE/'live/down/raw/06.png').convert('RGBA')
        getup[0]=end.copy(); getup[1]=end.copy()
        feet=[139,139]+[144]*(n-2)
        ent.update(fw=256,fh=160,foot=144,anc=105,feet=feet,label=ent['label']+' · 다운 연결 보정',new_generated_frames=0)
        if 'anchors' in ent:
            for i,a in enumerate(ent['anchors']):
                ent['anchors'][i]={k:[v[0]+48,v[1]+8] for k,v in a.items()}
            ent['anchors'][0]=copy.deepcopy(manifest['clips']['down']['anchors'][-1])
            ent['anchors'][1]=copy.deepcopy(ent['anchors'][0])
        sheet=Image.new('RGBA',(256*n,160))
        for i,im in enumerate(getup): sheet.paste(im,(i*256,0))
        target=delivery/'getup.png';sheet.save(target);strips['getup']=b64(target);manifest['clips']['getup']=ent
        (delivery/'getup-provenance.json').write_text(json.dumps({'first_two_frames':'new down/raw/06.png','remaining_frames':'existing final/getup.png, translated (48,8), unchanged pixels','new_generation_count':0,'user_visual_approval':False},indent=2))
    manifest['resume_delivery']={k:{x:v[x] for x in ['job_id','actual_cost','sha256','qa']} for k,v in review.items()}
    manifest['user_visual_approval']=False
    (delivery/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    tpl=(ROOT/'tools/rojemon_full_template.html').read_text(encoding='utf-8')
    tpl=tpl.replace('로제몬 전 동작 시연판','로제몬 전투 수정 검수판')
    # Origin-only placement, no resampling/redrawing of raw pixels. Only identified
    # contact frames get a foot correction; airborne frames keep their trajectory.
    tpl=tpl.replace('-c.foot, c.fw, c.fh','-(c.feet?.[f] ?? c.foot), c.fw, c.fh')
    tpl=tpl.replace('(b.y0 - c.foot) * S','(b.y0 - (c.feet?.[f] ?? c.foot)) * S')
    tpl=tpl.replace('(a[which][1] - c.foot) * S','(a[which][1] - (c.feet?.[f] ?? c.foot)) * S')
    tpl=tpl.replace('(v - c.foot) * S','(v - (c.feet?.[G.f] ?? c.foot)) * S')
    tpl=tpl.replace('<canvas width="192" height="144"></canvas>','<canvas width="${Math.max(192,c.fw)}" height="${Math.max(144,c.fh)}"></canvas>')
    tpl=tpl.replace('cc.fillRect(0, 0, 192, 144)','cc.fillRect(0, 0, Math.max(192,c.fw), Math.max(144,c.fh))')
    # Legacy standalone list set demo state without advancing it. Fix only this
    # derived Rojemon review HTML so selecting the new puppet clip really plays.
    tpl=tpl.replace('const V = MAN;','const V = MAN;\n  if (V.state === "demo") { stepAnim(V, dt); return; }')
    tpl=tpl.replace('const K = KID;','const K = KID;\n  if (K.state === "demo") { stepAnim(K, dt); return; }')
    widget=(HERE/'review_widget.html').read_text(encoding='utf-8').replace('__REVIEW__',json.dumps(review,ensure_ascii=False))
    tpl=tpl.replace('<div class="bar">',widget+'\n<div class="bar">',1)
    html=tpl.replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False)).replace('__STRIPS__',json.dumps(strips)).replace('__BG__',b64(ROOT/'game-src/action/bureau-corridor.png'))
    output=ROOT/'release/demo/rojemon-resume.html'
    output.write_text(html,encoding='utf-8')
    print(json.dumps({'output':str(output),'new_clips':list(review),'bytes':output.stat().st_size,'sha256':digest(output)},ensure_ascii=False))
if __name__=='__main__': main()
