from pathlib import Path
from PIL import Image,ImageDraw
import urllib.request,json,numpy as np
p=Path('game-src/action/geshugan/resume/neck-exact');data=urllib.request.urlopen('https://api.pixellab.ai/mcp/pixel-tools/79a13fde-b17e-47b7-8e9b-11c47ba8f0f9/image.png',timeout=40).read();(p/'result.png').write_bytes(data)
a=Image.open(p/'result.png').convert('RGBA');pred=Image.open(p/'exact-predicted.png').convert('RGBA');assert a.size==pred.size and a.tobytes()==pred.tobytes()
mask=Image.new('L',a.size);d=ImageDraw.Draw(mask)
for o in json.loads((p/'exact-changes.json').read_text()):
 for x,y,_,_ in o['pixels']:d.point((x,y),fill=255)
mask.save(p/'mask.png');original=np.array(Image.open(p/'input.png').convert('RGBA'));diff=np.any(original!=np.array(a),axis=2)
(p/'validation.json').write_text(json.dumps({'matches_guarded_prediction':True,'changed_pixels':int(diff.sum()),'outside_exact_pixels_changed':int((diff&(np.array(mask)==0)).sum()),'free_tool':True},indent=2));print('Free tool output matches',int(diff.sum()),'guarded changed pixels')
