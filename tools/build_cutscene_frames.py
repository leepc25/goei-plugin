"""Split generated cut sheets; produce indexed PNGs, exact timing and a portable player.

Run with bundled Python/Pillow. No interpolating filter or dithering is used.
Production sheets are candidates: passing this packer is not visual approval.
"""
from pathlib import Path
import argparse, base64, hashlib, json, subprocess
from io import BytesIO
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'game-src/art/cutscene'
MANIFEST = ART / 'production/manifest.json'
LOOPS = {'opening/c1','opening/c5','opening/c7','first_entry/c1','first_entry/c2',
         'first_entry/c5','first_call/c1','first_call/c2','attic/c1','attic/c2',
         'attic/c3','attic/c4','three_years/c1','three_years/c2','return/c1',
         'return/c2','return/c4','evac/c1','evac/c4','exit/c3','dinner/c1',
         'dinner/c2','dinner/c3','first_day/c2','first_day/c3'}

def build(partial=False,only=None):
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8-sig'))
    groups, report = {}, []
    for cut in manifest['cuts']:
        scene, number = cut['scene'], cut['cut']
        key = f'{scene}/{number}'
        if only and key != only: continue
        sheet = ART / 'production/sheets' / f'{scene}-{number}.png'
        if not sheet.exists():
            if partial: continue
            raise FileNotFoundError(sheet)
        im = Image.open(sheet).convert('RGB')
        w, h = im.size
        frames = []
        for i in range(8):
            x, y = i % 2, i // 2
            # Exclude generated grid seams; nearest-neighbor only, no filtering.
            box = (round(x*w/2)+6, round(y*h/4)+6,
                   round((x+1)*w/2)-6, round((y+1)*h/4)-6)
            frames.append(im.crop(box).resize((320,180), Image.Resampling.NEAREST))
        if key in {'first_entry/c2','first_call/c1'}:
            # A lighting shot must not invent gestures or change the anatomy.
            base=frames[0]
            frames=[]
            for light in [1,.35,1,.55,.35,1,.55,1]:
                f=base.copy()
                if key=='first_call/c1':
                    f=f.point(lambda v:round(v*light))
                else:
                    pixels=list(f.getdata())
                    f.putdata([tuple(round(v*light) for v in p) if p[0]>p[1]*1.6 and p[0]>p[2]*1.6 else p for p in pixels])
                frames.append(f)
        atlas = Image.new('RGB', (640,720))
        for i,f in enumerate(frames): atlas.paste(f,((i%2)*320,(i//2)*180))
        palette = atlas.quantize(colors=64, method=Image.Quantize.MEDIANCUT,
                                 dither=Image.Dither.NONE)
        frames = [f.quantize(palette=palette, dither=Image.Dither.NONE)
                  .resize((640,360), Image.Resampling.NEAREST) for f in frames]
        if key in {'opening/c3','first_entry/c3'}:
            # Hold a single contact pose. Do not redraw a static pointing hand.
            frames = [frames[0],frames[2],frames[3]]
            if key == 'opening/c3':
                flash = Image.new('RGB',(640,360),'white').quantize(palette=palette,dither=Image.Dither.NONE)
                frames.append(flash)
        out = ART / 'frames' / scene / number
        out.mkdir(parents=True,exist_ok=True)
        for stale in out.glob('[0-9][0-9][0-9][0-9].png'):
            if int(stale.stem) > len(frames): stale.unlink()
        encoded = []
        hashes = []
        for i,f in enumerate(frames,1):
            path = out / f'{i:04d}.png'
            f.save(path, optimize=True)
            assert f.size == (640,360)
            assert f.getpalette() == frames[0].getpalette()
            assert len(f.getcolors(maxcolors=65536)) <= 64
            hashes.append(hashlib.sha256(f.tobytes()).hexdigest())
            encoded.append('data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode())
        assert len(set(hashes)) > 1, key + ': no motion'
        duration = cut['duration']
        if key == 'opening/c3':
            timing = {'ms':[500,125,1250,125]}
        elif key == 'first_entry/c3':
            timing = {'ms':[500,125,1375]}
        elif key == 'first_day/c3':
            timing = {'ms':[125]*8,'loop':[4,8]}
        elif key in {'opening/c7','first_entry/c5','first_call/c2'}:
            timing = {'ms':[125]*7+[duration-875]}
        elif key in LOOPS:
            timing = {'ms':[125]*8,'loop':[1,8]}
        elif key == 'opening/c8':
            timing = {'ms':[750]*8}
        else:
            # One short animation at 8fps, with explicit initial/final pose holds.
            remain = duration-1000
            timing = {'ms':[125+remain//2]+[125]*6+[125+remain-remain//2]}
        (out/'timing.json').write_text(json.dumps(timing,separators=(',',':'))+'\n',encoding='utf-8')
        record = {**cut,'timing':timing,'frames':encoded}
        groups.setdefault(scene,[]).append(record)
        report.append({'id':key,'frames':len(frames),'size':[640,360],'colors':64,
                       'durationMs':duration,'paletteSha256':hashlib.sha256(bytes(frames[0].getpalette())).hexdigest(),
                       'uniqueFrames':len(set(hashes)),'source':str(sheet.relative_to(ROOT))})
    if only:
        assert len(report)==1, 'Cut was not built: '+only
        print(json.dumps(report[0]))
        return
    target=ROOT/'release/demo/goei-cutscenes-gpt.html'
    target.parent.mkdir(parents=True,exist_ok=True)
    template=(ART/'production/player.html').read_text(encoding='utf-8')
    target.write_text(template.replace('__CUTSCENE_DATA__',json.dumps(groups,ensure_ascii=False)),encoding='utf-8')
    (ART/'production/validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'cuts':len(report),'frames':sum(x['frames'] for x in report),'scenes':len(groups),'player':str(target)}))

def check_cut(key,ref=None):
    path='game-src/art/cutscene/frames/'+key
    try:
        if ref:
            def read(name):
                return subprocess.check_output(['git','show',ref+':'+path+'/'+name],cwd=ROOT,stderr=subprocess.DEVNULL)
            names=subprocess.check_output(['git','ls-tree','-r','--name-only',ref,'--',path],cwd=ROOT,text=True).splitlines()
            names=[p[len(path)+1:] for p in names]
        else:
            folder=ROOT/path
            names=[p.name for p in folder.iterdir() if p.is_file()]
            def read(name):return (folder/name).read_bytes()
        timing=json.loads(read('timing.json'))
        ms=timing['ms']
        assert isinstance(ms,list) and ms and all(isinstance(n,(int,float)) and not isinstance(n,bool) and n>0 for n in ms),'invalid durations'
        pngs=sorted(n for n in names if n.lower().endswith('.png'))
        assert len(pngs)==len(ms),f'PNG count {len(pngs)} != ms count {len(ms)}'
        assert pngs==[f'{i:04d}.png' for i in range(1,len(ms)+1)],'nonconsecutive frames'
        if 'loop' in timing:
            loop=timing['loop']
            assert isinstance(loop,list) and len(loop)==2 and all(isinstance(n,int) for n in loop) and 1<=loop[0]<=loop[1]<=len(ms),'invalid loop'
        for name in pngs:
            with Image.open(BytesIO(read(name))) as image:
                assert image.format=='PNG' and image.size==(640,360),'invalid PNG size or format'
                image.load()
        return {'cut':key,'valid':True,'frames':len(pngs),'ref':ref}
    except Exception as error:
        return {'cut':key,'valid':False,'reason':str(error),'ref':ref}

def register(scene):
    manifest=json.loads(MANIFEST.read_text(encoding='utf-8-sig'))
    expected=[c for c in manifest['cuts'] if c['scene']==scene]
    assert expected, 'Unknown scene: '+scene
    for c in expected:
        folder=ART/'frames'/scene/c['cut']
        timing=json.loads((folder/'timing.json').read_text())
        paths=sorted(folder.glob('[0-9][0-9][0-9][0-9].png'))
        assert len(paths)==len(timing['ms']),str(folder)
        assert [p.stem for p in paths]==[f'{i:04d}' for i in range(1,len(paths)+1)]
        if 'loop' not in timing: assert sum(timing['ms'])==c['duration']
        for p in paths:
            with Image.open(p) as im: assert im.size==(640,360)
    index=ART/'frames/index.json'
    names=json.loads(index.read_text(encoding='utf-8-sig')) if index.exists() else []
    if scene not in names:names.append(scene)
    index.write_text(json.dumps(names,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    requests=ROOT/'docs/GPT_요청_목록.md'
    lines=requests.read_text(encoding='utf-8-sig').splitlines()
    status='받음' if len(names)==10 else '제작 중: '+', '.join(names)+' 받음 ('+str(len(names))+'/10편)'
    for i,line in enumerate(lines):
        if line.startswith('| docs/GPT요청_컷신영상.md |'):
            cells=line.split('|');cells[-2]=' '+status+' ';lines[i]='|'.join(cells)
    requests.write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(json.dumps({'registered':scene,'index':names}))

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--partial',action='store_true')
    parser.add_argument('--register')
    parser.add_argument('--only')
    parser.add_argument('--check')
    parser.add_argument('--ref')
    args=parser.parse_args()
    if args.check:
        print(json.dumps(check_cut(args.check,args.ref)))
    else:
        build(args.partial,args.only)
        if args.register:register(args.register)
