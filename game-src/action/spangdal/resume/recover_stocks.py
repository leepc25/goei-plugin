from production_ops import *
p=PROD/'stock-colors-r2';urllib.request.urlretrieve('https://api.pixellab.ai/mcp/pixel-tools/8fcdbbef-3d3b-4deb-98dc-ac5579c2848f/image.png',p/'result-00.png')
im=Image.open(p/'result-00.png').convert('RGBA');rows=[]
for s in json.loads((p/'provenance.json').read_text(encoding='utf-8'))['sources']:
 dest=BASE/f"resume/corrected/{s['clip']}/{s['frame']:02}.png";assert sha(dest)==s['source_sha256']
 x,y,w,h=s['tile'];before=np.array(Image.open(dest).convert('RGBA'));out=im.crop((x,y,x+w,y+h));after=np.array(out)
 assert np.array_equal(before[:70],after[:70]) and np.array_equal(before[:,:,3],after[:,:,3])
 out.save(dest);rows.append({**s,'output_sha256':sha(dest),'user_visual_approval':False})
save(p/'integration.json',{'accepted_frames':rows,'alpha_and_face_unchanged':True})
sheet('stock-colors-r2',[BASE/f"resume/corrected/{s['clip']}/{s['frame']:02}.png" for s in rows])
