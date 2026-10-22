"""Build a self-contained Deadpole-only action review without touching the game."""
import base64
import hashlib
import io
import json
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'game-src/action/deadpole/resume'
FINAL=OUT/'final'
DEMO=ROOT/'release/demo/deadpole-resume.html'

def uri(path): return 'data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode()
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def pack(name,attempt,indices,label,fps,old,anchors=None):
    folder=OUT/'attempts'/attempt
    if not (folder/'result.json').exists(): return None
    meta=json.loads((folder/'result.json').read_text(encoding='utf-8'))
    frames=[folder/f'{i:02d}.png' for i in indices]
    strip=Image.new('RGBA',(192*len(frames),144))
    for i,path in enumerate(frames): strip.paste(Image.open(path),(i*192,0))
    strip.save(FINAL/f'{name}.png')
    data=dict(name=name,label=label,frames=len(frames),fps=fps,job_id=meta['job_id'],
              source_indices=indices,source_sha256=[digest(p) for p in frames],
              image=uri(FINAL/f'{name}.png'),old_image=uri(ROOT/f'game-src/action/deadpole/full/final/{old}.png'),
              old_frames=Image.open(ROOT/f'game-src/action/deadpole/full/final/{old}.png').width//192,
              anchors=anchors or [],offsets=[135-Image.open(p).getbbox()[3] for p in frames],
              draw_width=120 if attempt=='combo_bridge' else 192,user_visual_approval=False)
    return data

def main():
    FINAL.mkdir(exist_ok=True)
    hands=json.loads((OUT/'review/hand-anchors.json').read_text(encoding='utf-8')) if (OUT/'review/hand-anchors.json').exists() else {}
    specs=[
        ('pipe','pipe_body',list(range(7)),'쇠파이프 휘두르기',12,'pipe'),
        ('cq1','close_combo',list(range(4)),'근접 1타 · 낮은 리텐션',14,'cq1'),
        ('cq2','close_combo',list(range(4,8)),'근접 2타 · 두 손 뻗기',14,'cq2'),
        ('cq_bridge','combo_bridge',[1,2,3],'2타 → 3타 연결',14,'cq3'),
        ('cq3','close_combo',list(range(8,14)),'근접 3타 · 손바닥 밀기',12,'cq3'),
        ('catch','catch_counter',list(range(6)),'칼날 잡기',12,'catch'),
        ('counter','catch_counter',list(range(5,10)),'잡은 채 맞쏘기',12,'counter'),
    ]
    clips=[c for s in specs if (c:=pack(*s,anchors=hands.get(s[0],[])))]
    if not clips: raise RuntimeError('No recovered candidate frames')
    reviews=json.loads((OUT/'review/frame-review.json').read_text(encoding='utf-8')) if (OUT/'review/frame-review.json').exists() else {}
    for clip in clips: clip['review']=reviews.get(clip['name'],{'status':'내부 검수 중','note':'사용자 시각 승인 전'})
    weapons={key:uri(ROOT/path) for key,path in {'pipe':'game-src/art/items/dot/pipe.png','pistol':'game-src/art/items/dot/sig_deadpole_pistol.png'}.items()}
    data={'clips':clips,'weapons':weapons,'user_visual_approval':False}
    template=Path(__file__).with_name('resume_template.html').read_text(encoding='utf-8')
    DEMO.write_text(template.replace('__DATA__',json.dumps(data,ensure_ascii=False)),encoding='utf-8')
    manifest={**data,'clips':[{k:v for k,v in c.items() if k not in ('image','old_image')} for c in clips],
              'weapons':{k:{'source':str(v),'sha256':digest(ROOT/v)} for k,v in {'pipe':'game-src/art/items/dot/pipe.png','pistol':'game-src/art/items/dot/sig_deadpole_pistol.png'}.items()},
              'boundary':{'catch_last_counter_first':'same immutable generated frame 05.png','shared_source_index':5},
              'scope':'independent review only; no engine or shared atlas change'}
    (FINAL/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(DEMO,DEMO.stat().st_size,'bytes',len(clips),'clips')

if __name__=='__main__': main()
