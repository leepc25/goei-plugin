from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,base64
src=Path('game-src/action/geshugan');out=src/'resume'/'neck-exact';out.mkdir(exist_ok=True);rows=json.loads((src/'resume/neck-edit/masked-inputs.json').read_text())+json.loads((src/'resume/neck-chain2/inputs.json').read_text());atlas=Image.new('RGBA',(256,320))
for n,r in enumerate(rows):
 r['index']=n;im=Image.open(src/r['source']).convert('RGBA').crop(r['crop_box']);atlas.paste(im,((n%4)*64,(n//4)*64))
atlas.save(out/'input.png');(out/'inputs.json').write_text(json.dumps(rows,indent=2));a=np.array(atlas);ops=[];preview=a.copy()
def color(v):return '#'+''.join(f'{int(c):02x}' for c in v)
for r in rows:
 i=r['index'];sx,sy=(i%4)*64,(i//4)*64;crop=a[sy:sy+64,sx:sx+64].astype(int);box=r['repair_crop_box']
 skin=(crop[:,:,3]>0)&(crop[:,:,0]>crop[:,:,1]+15)&(crop[:,:,1]>crop[:,:,2]+10);skin[33:]=False
 from scipy import ndimage
 labels,n=ndimage.label(skin);groups=[]
 for k in range(1,n+1):
  yy,xx=np.where(labels==k)
  if len(xx)>3:groups.append((yy.min(),xx,yy))
 _,xx,yy=min(groups,key=lambda v:v[0]);left=int(xx.min());bottom=int(yy.max());pixels=[]
 # The observed dangling beard sits below the existing face, in front of the bob.
 # Keep every original face pixel and the collar behind it; erase only this reviewed tail.
 for y in range(bottom+1,box[3]):
  for x in range(left,box[2]):
   v=a[sy+y,sx+x]
   if v[3]:pixels.append([sx+x,sy+y,color(v),'#00000000'])
 # A one-pixel black jaw contour directly under the original bottom skin row.
 for x in range(left,int(xx.max())+1):
  if skin[bottom,x]:
   px,py=sx+x,sy+bottom+1
   pixels=[p for p in pixels if p[:2]!=[px,py]]
   pixels.append([px,py,color(a[py,px]),'#000000ff'])
 for x,y,expected,new in pixels:preview[y,x]=[int(new[j:j+2],16) for j in (1,3,5,7)]
 ops.append({'operation':'patch_pixels','layer':'image','frames':[1],'pixels':pixels,'reason':f'{r["clip"]}/{r["frame"]:02}: remove reviewed dangling grey beard below original skin silhouette; preserve every original face pixel and add one-pixel jaw outline.'})
(out/'exact-changes.json').write_text(json.dumps(ops,indent=2));(out/'exact-input.json').write_text(json.dumps({'argv':['edit','data:image/png;base64,'+base64.b64encode((out/'input.png').read_bytes()).decode(),'--changes',json.dumps(ops)],'mode':'low','notes':'Final QA rejected oversized skin-colored chin from generative inpainting. Apply reviewed guarded pixels to ORIGINAL 19 crops: erase only beard tails below original skin silhouette, retain face/eye/hair/body, one-pixel jaw outline. Free deterministic edit; user requests PixelLab fixes.'}))
im=Image.fromarray(preview);im.save(out/'exact-predicted.png')
canvas=Image.new('RGBA',(1024,1280),(90,104,116,255));canvas.alpha_composite(im.resize((1024,1280),Image.Resampling.NEAREST));canvas.save(out/'exact-preview.png')
print('exact patch pixels',sum(len(o['pixels']) for o in ops))
