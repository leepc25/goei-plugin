from production_ops import *
items=[('run',2),('run',3),('run',4),('passslash',0),('passslash',5),('carry2_run',2),('stepup',0),('sneak',5)]
p=PROD/'motion-contours-r1';p.mkdir(exist_ok=True);canvas=Image.new('RGBA',(576,432));changes=[];sources=[]
for j,(clip,i) in enumerate(items):
 src=BASE/f'full/clips/{clip}/{i:02}.png';im=Image.open(src).convert('RGBA');a=np.array(im);tx=j%3*192;ty=j//3*144;canvas.paste(im,(tx,ty));pixels=[]
 # Grey/purple foreign streaks below the skirt, observed in contact sheets.
 for y in range(112,136):
  for x in range(40,110):
   r,g,b,al=map(int,a[y,x]);bad=al and ((min(r,g,b)>=108 and max(r,g,b)-min(r,g,b)<18) or (b>r+6 and r>g+12 and r>85))
   if bad:pixels.append([x+tx,y+ty,'#'+bytes(a[y,x]).hex(),'#2f2724ff'])
 if pixels:changes.append({'operation':'patch_pixels','frames':[1],'pixels':pixels,'reason':f'{clip}:{i} foreign bright grey/purple leg streaks replaced by existing stocking shadow; silhouette and contact unchanged'})
 sources.append({'clip':clip,'frame':i,'tile':[tx,ty,192,144],'source_sha256':sha(src),'changed_pixels':len(pixels)})
canvas.save(p/'input.png');save(p/'provenance.json',{'sources':sources,'input_sha256':sha(p/'input.png'),'cost':0,'user_visual_approval':False});save(p/'request.json',{'argv':['edit','data:image/png;base64,'+base64.b64encode((p/'input.png').read_bytes()).decode(),'--changes',json.dumps(changes)],'mode':'low'})
