from production_ops import *
import re
for p in sorted(list(PROD.glob('*-exact-r2'))+[PROD/'motion-contours-r1']):
 if not (p/'result.json').exists():continue
 r=json.loads((p/'result.json').read_text(encoding='utf-8'));text='\n'.join(c.get('text','') for c in r.get('content',[]));match=re.search(r'image_id: ([\da-f-]+)',text)
 if not match:continue
 dest=p/'result-00.png'
 if not dest.exists():urllib.request.urlretrieve('https://api.pixellab.ai/mcp/pixel-tools/'+match[1]+'/image.png',dest)
 im=Image.open(dest).convert('RGBA');meta=json.loads((p/'provenance.json').read_text(encoding='utf-8'));accepted=[]
 for source in meta['sources']:
  x,y,w,h=source['tile'];clip=source['clip'];i=source['frame'];src=BASE/f'full/clips/{clip}/{i:02}.png';assert sha(src)==source['source_sha256'];out=BASE/f'resume/corrected/{clip}/{i:02}.png';out.parent.mkdir(exist_ok=True,parents=True);crop=im.crop((x,y,x+w,y+h));crop.save(out)
  before=np.array(Image.open(src).convert('RGBA'));after=np.array(crop);assert np.array_equal(before[:70,:],after[:70,:]),'face changed'
  accepted.append({'clip':clip,'frame':i,'source_sha256':sha(src),'output_sha256':sha(out),'pixel_tool_id':match[1],'cost':0,'user_visual_approval':False})
 save(p/'integration.json',{'accepted_frames':accepted,'face_pixels_preserved':True})
