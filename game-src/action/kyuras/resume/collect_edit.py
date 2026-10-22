import sys,json,hashlib,urllib.request
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];clip,eid=sys.argv[1:3];spec=json.loads((ROOT/'resume'/(clip+'-hand-spec.json')).read_text(encoding='utf8'));job=spec['job_id'];source=ROOT/'generated'/job;n=len(list(source.glob('[0-9][0-9].png')))
folder=ROOT/'generated'/eid;folder.mkdir(exist_ok=True)
for name in ['frames.png','animation.gif']:
 target=folder/name
 if not target.exists():target.write_bytes(urllib.request.urlopen('https://api.pixellab.ai/mcp/pixel-tools/'+eid+'/'+name,timeout=45).read())
sheet=Image.open(folder/'frames.png').convert('RGBA');cols=sheet.width//192;frames=[]
changes=json.loads((ROOT/'resume'/(clip+'-hand-edits.json')).read_text(encoding='utf8'));allowed={i:set() for i in range(n)}
for c in changes:
 for f in c['frames']:allowed[f-1].update((p[0],p[1]) for p in c['pixels'])
for i in range(n):
 x=i%cols*192;y=i//cols*144;im=sheet.crop((x,y,x+192,y+144));old=Image.open(source/f'{i:02}.png').convert('RGBA');diff={(xx,yy) for yy in range(144) for xx in range(192) if im.getpixel((xx,yy))!=old.getpixel((xx,yy))};assert diff<=allowed[i]
 target=folder/f'{i:02}.png';im.save(target);frames.append(dict(index=i,file=target.name,sha256=hashlib.sha256(target.read_bytes()).hexdigest(),changed_pixels=len(diff)))
manifest=dict(clip=clip,source_job_id=job,pixel_edit_id=eid,charged_generations=0,frames=frames,changed_pixels=sum(f['changed_pixels'] for f in frames),status='candidate_precise_hands',user_visual_approval=False)
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
print(json.dumps(manifest))
