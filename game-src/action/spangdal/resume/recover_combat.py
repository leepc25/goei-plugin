from production_ops import *
name=sys.argv[1] if len(sys.argv)>1 else 'combat-exact-r1'
import re
p=PROD/name;response=json.loads((p/'result.json').read_text(encoding='utf-8'));text='\n'.join(c.get('text','') for c in response['content']);image_id=re.search(r'image_id: ([a-f0-9-]+)',text)[1]
urllib.request.urlretrieve(f'https://api.pixellab.ai/mcp/pixel-tools/{image_id}/image.png',p/'result-00.png');im=Image.open(p/'result-00.png').convert('RGBA');groups={}
for s in json.loads((p/'provenance.json').read_text(encoding='utf-8'))['sources']:
 src=BASE/s['path'];assert sha(src)==s['sha256'];x,y,w,h=s['tile'];out=p/f"{s['clip']}-{s['frame']:02}.png";im.crop((x,y,x+w,y+h)).save(out);groups.setdefault(s['clip'],[]).append(out)
for clip,paths in groups.items():
 sheet(name,paths);(p/'review.png').replace(p/f'review-{clip}.png')
