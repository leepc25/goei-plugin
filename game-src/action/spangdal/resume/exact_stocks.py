from production_ops import *
p=PROD/'stock-colors-r2';p.mkdir(exist_ok=True)
meta=json.loads((PROD/'shotgun-stocks-r1/provenance.json').read_text(encoding='utf-8'))
canvas=Image.new('RGBA',(768,720));pixels=[];sources=[]
for j,s in enumerate(meta['sources']):
 src=BASE/s['path'];im=Image.open(src).convert('RGBA');tx=j%4*192;ty=j//4*144;canvas.paste(im,(tx,ty))
 for x0,y0,x1,y1 in s['regions']:
  for y in range(y0,y1):
   for x in range(x0,x1):
    r,g,b,a=im.getpixel((x,y))
    if a and 35<=r<150 and r>g*1.3 and g>b*1.12:
     pixels.append([tx+x,ty+y,'#'+bytes((r,g,b,a)).hex(),'#202a30ff'])
 sources.append({'clip':s['clip'],'frame':s['frame'],'source_sha256':sha(src),'tile':[tx,ty,192,144]})
canvas.save(p/'input.png')
save(p/'request.json',{'argv':['edit','data:image/png;base64,'+base64.b64encode((p/'input.png').read_bytes()).decode(),'--changes',json.dumps([{'operation':'patch_pixels','layer':'image','frames':[1],'pixels':pixels,'reason':'Remove remaining brown wood colors inside reviewed stock-only regions. Preserve pale hands, alpha, face, feet and all other pixels.'}])],'mode':'low'})
save(p/'provenance.json',{'sources':sources,'input_sha256':sha(p/'input.png'),'changed_pixels':len(pixels),'cost':0,'user_visual_approval':False})
print(len(pixels))
