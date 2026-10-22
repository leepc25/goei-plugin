from production_ops import *
# Native pixel crops on a tiled canvas; no resizing. Masks constrain changes.
def grid(name,clip,frames,box,regions,prompt,columns=4):
 p=PROD/name;p.mkdir(parents=True,exist_ok=False);w=box[2]-box[0];h=box[3]-box[1];cols=min(columns,len(frames));rows=(len(frames)+cols-1)//cols
 canvas=Image.new('RGBA',(w*cols,h*rows));mask=Image.new('RGB',canvas.size);draw=ImageDraw.Draw(mask);sources=[]
 for j,i in enumerate(frames):
  src=BASE/f'full/clips/{clip}/{i:02}.png';im=Image.open(src).convert('RGBA');x=j%cols*w;y=j//cols*h
  canvas.paste(im.crop(box),(x,y));rs=regions[i]
  for a,b,c,d in rs:draw.rectangle((x+a-box[0],y+b-box[1],x+c-box[0]-1,y+d-box[1]-1),fill='white')
  sources.append({'clip':clip,'frame':i,'path':str(src.relative_to(BASE)),'sha256':sha(src),'box':box,'tile':[x,y,w,h],'regions':rs})
 canvas.save(p/'input.png');mask.save(p/'mask.png')
 req={'description':prompt,'image_url':'data:image/png;base64,'+base64.b64encode((p/'input.png').read_bytes()).decode(),'mask_image_url':'data:image/png;base64,'+base64.b64encode((p/'mask.png').read_bytes()).decode(),'crop_to_mask':True,'no_background':True,'seed':1022451}
 save(p/'request.json',req);save(p/'provenance.json',{'clip':clip,'sources':sources,'input_sha256':sha(p/'input.png'),'mask_sha256':sha(p/'mask.png'),'actual_cost':None,'user_visual_approval':False})
 canvas.resize((canvas.width*3,canvas.height*3),Image.Resampling.NEAREST).save(p/'input-review.png')
if __name__=='__main__':
 grid('stab1-sequence-r1','stab1',[1,3,4],(80,64,144,112),{1:[(102,79,126,94)],3:[(109,78,131,92)],4:[(91,79,116,99)]},'Three sequential native pixel-art animation crops arranged horizontally. Repair ONLY white-mask hands into the SAME flat spear-hand (karate nukite) in all three frames: four straight fingers pressed tightly together, thumb folded flat against palm. A broad tapered hand blade continuing the forearm, NOT one pointing index and NOT a fist. Preserve each wrist position and arm angle, skin palette and crisp one-pixel dark outline. No weapons or effects. Preserve all unmasked pixels exactly.')
