from production_ops import *
p=PROD/'throw-waist-r3';p.mkdir(exist_ok=False);src=PROD/'combat-exact-r2/throw-02.png';im=Image.open(src).convert('RGBA');pixels=[]
for y in range(93,101):
 for x in range(79,85):
  old=im.getpixel((x,y));new=(0,0,0,0)
  if old!=new:pixels.append([x,y,'#'+bytes(old).hex(),'#00000000'])
save(p/'provenance.json',{'source':str(src.relative_to(BASE)),'input_sha256':sha(src),'region':[79,93,85,101],'cost':0,'reason':'Remove the third pale hand fragment outside right waist silhouette after both real hands extend forward.','user_visual_approval':False})
save(p/'request.json',{'argv':['edit','data:image/png;base64,'+base64.b64encode(src.read_bytes()).decode(),'--changes',json.dumps([{'operation':'patch_pixels','frames':[1],'pixels':pixels,'reason':'Remove reviewed third hand fragment outside waist silhouette; actual two arms and hands stay unchanged.'}])],'mode':'low'})
