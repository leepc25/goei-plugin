from production_ops import *
# Remove only the observed external blade/barrel, preserving original body/hand.
# Shotgun firing stock overlaps the sleeve: reserved for inpainting, not erased.
jobs={'pipe':(6,[(85,88),(121,87),(132,86),(132,86),(108,88),(90,90)]),'idle_pipe':(4,[(76,93)]*4),'walk_pipe':(7,[(78,94)]*7),'idle_shotgun':(4,[(90,89)]*4),'walk_shotgun':(7,[(91,90)]*7),'run_shotgun':(8,[(99,104)]*8)}
for clip,(n,centers) in jobs.items():
 p=PROD/(clip+'-exact-r2');p.mkdir(exist_ok=True);canvas=Image.new('RGBA',(192*3,144*((n+2)//3)));changes=[];sources=[]
 for i,(cx,cy) in enumerate(centers):
  tx=i%3*192;ty=i//3*144
  src=BASE/f'full/clips/{clip}/{i:02}.png';im=Image.open(src).convert('RGBA');canvas.paste(im,(tx,ty));arr=np.array(im);skin=(arr[:,:,0]>140)&(arr[:,:,1]>85)&(arr[:,:,2]>65)&(arr[:,:,0]>arr[:,:,1]+10)&(arr[:,:,3]>0)
  ys,xs=np.where(skin[max(0,cy-5):cy+6,cx-6:cx+7]);assert len(xs),clip
  handx=int(xs.max()+cx-6);handy=float(np.median(ys)+cy-5)
  pixels=[]
  for y in range(55,132):
   for x in range(handx+1,192):
    if not arr[y,x,3]:continue
    if clip=='pipe': selected=abs(y-handy)<8
    else:
     slope=.4 if 'run' in clip else .7
     selected=abs(y-(handy+(x-handx)*slope))<8
    if selected:pixels.append([x+tx,y+ty,'#'+bytes(arr[y,x]).hex(),'#00000000'])
  if pixels:changes.append({'operation':'patch_pixels','frames':[1],'pixels':pixels,'reason':clip+' external weapon removed beyond inspected hand; body and hand retained'})
  sources.append({'clip':clip,'frame':i,'tile':[tx,ty,192,144],'source_sha256':sha(src),'hand_right_x':handx,'hand_y':handy,'erased_pixels':len(pixels)})
 canvas.save(p/'input.png');save(p/'changes.json',changes);save(p/'provenance.json',{'sources':sources,'input_sha256':sha(p/'input.png'),'cost':0,'scope':'external weapon removal only; grip/hidden stock still needs review','user_visual_approval':False})
 save(p/'request.json',{'argv':['edit','data:image/png;base64,'+base64.b64encode((p/'input.png').read_bytes()).decode(),'--changes',json.dumps(changes)],'mode':'low'})
