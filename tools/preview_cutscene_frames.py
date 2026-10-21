"""Build the standalone preview from registered PNGs without modifying any frame."""
from pathlib import Path
import base64,json
from build_cutscene_frames import ROOT,ART,MANIFEST,check_cut

manifest=json.loads(MANIFEST.read_text(encoding='utf-8-sig'))
names=json.loads((ART/'frames/index.json').read_text(encoding='utf-8-sig'))
groups={}
for name in names:
    clips=[]
    for cut in manifest['cuts']:
        if cut['scene']!=name:continue
        key=name+'/'+cut['cut']
        result=check_cut(key)
        if not result['valid']:raise RuntimeError(result)
        folder=ART/'frames'/name/cut['cut']
        timing=json.loads((folder/'timing.json').read_text(encoding='utf-8-sig'))
        paths=sorted(folder.glob('[0-9][0-9][0-9][0-9].png'))
        clips.append({**cut,'timing':timing,'frames':[
            'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode() for p in paths]})
    if clips:groups[name]=clips
template=(ART/'production/player.html').read_text(encoding='utf-8')
page=template.replace('__CUTSCENE_DATA__',json.dumps(groups,ensure_ascii=False))
page=page.replace('load();requestAnimationFrame(tick);',
                  'select.value='+json.dumps(names[-1])+';load();requestAnimationFrame(tick);')
target=ROOT/'release/demo/goei-cutscenes-preview.html'
target.write_text(page,encoding='utf-8')
print(json.dumps({'scenes':list(groups),'cuts':sum(len(c) for c in groups.values()),'path':str(target)}))
