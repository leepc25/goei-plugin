"""Audit the immutable remote snapshot and the local delivery without rebuilding art."""
import hashlib,json,subprocess
from io import BytesIO
from PIL import Image
from build_cutscene_frames import ROOT,ART,MANIFEST,check_cut

ref=subprocess.check_output(['git','rev-parse','origin/main'],cwd=ROOT,text=True).strip()
manifest=json.loads(MANIFEST.read_text(encoding='utf-8-sig'))
index=json.loads(subprocess.check_output(['git','show',ref+':game-src/art/cutscene/frames/index.json'],cwd=ROOT))
expected=list(dict.fromkeys(c['scene'] for c in manifest['cuts']))
assert set(index)==set(expected) and len(index)==len(expected)
report=[]
for cut in manifest['cuts']:
    key=cut['scene']+'/'+cut['cut']
    remote=check_cut(key,ref)
    local=check_cut(key)
    assert remote['valid'] and local['valid'],(remote,local)
    folder=ART/'frames'/key
    timing=json.loads((folder/'timing.json').read_text(encoding='utf-8-sig'))
    if 'loop' not in timing:assert sum(timing['ms'])==cut['duration'],key
    palettes=[]
    colors=set()
    for i in range(1,remote['frames']+1):
        path=folder/f'{i:04d}.png'
        data=path.read_bytes()
        remote_data=subprocess.check_output(['git','show',ref+':'+str(path.relative_to(ROOT)).replace('\\','/')],cwd=ROOT)
        assert data==remote_data,(key,i,'local/remote mismatch')
        with Image.open(BytesIO(data)) as im:
            if im.mode=='P':palettes.append(hashlib.sha256(bytes(im.getpalette())).hexdigest())
            else:
                entries=im.convert('RGB').getcolors(maxcolors=256)
                assert entries is not None,(key,'unbounded RGB colors')
                colors.update(color for _,color in entries)
    assert not palettes or len(set(palettes))==1,(key,'palette changes')
    assert len(colors)<=256,(key,'RGB palette union exceeds 256')
    report.append({**remote,'durationMs':cut['duration'],'sharedPalette':True,
                   'rgbPaletteUnionColors':len(colors) if colors else None,
                   'paletteSha256':palettes[0] if palettes else hashlib.sha256(bytes(n for c in sorted(colors) for n in c)).hexdigest()})
result={'ref':ref,'scenes':index,'sceneCount':len(index),'cutCount':len(report),
        'frameCount':sum(r['frames'] for r in report),
        'durationMs':sum(c['duration'] for c in manifest['cuts']),
        'checks':['remote/local match','640x360 PNG','continuous filenames','timing count','valid loops','cut duration','shared indexed palette'],
        'cuts':report}
(ART/'production/validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='cuts'},ensure_ascii=False))
