from production_ops import *
# Artist-defined tapered closed-finger silhouette for the lowered recovery hand.
# Palette read from PixelLab inspect; guarded patches, no AI or rescaling.
p=PROD/'stab1-exact-r3';p.mkdir(exist_ok=True)
src=PROD/'stab1-recovery-r2/result-00.png';im=Image.open(src).convert('RGBA')
rows={85:(98,101),86:(98,105),87:(98,108),88:(98,110),89:(99,110),90:(101,108)}
patch=[]
for y in range(85,93):
 for x in range(98,112):
  old='#'+bytes(im.getpixel((x,y))).hex();new='#00000000'
  if y in rows:
   l,r=rows[y]
   if l<=x<=r:
    edge=x==r or (y==85) or (y==90) or x==l and x>98
    new='#171a1eff' if edge else '#d79e89ff' if y>=89 else '#f6cdb8ff'
  if old!=new:patch.append([x,y,old,new])
changes=[{'operation':'patch_pixels','layer':'image','frames':[1],'pixels':patch,'reason':'Remove dangling curled-finger mass and make four joined straight fingers one tapered blade; preserve wrist at x98 y87.'}]
save(p/'request.json',{'argv':['edit','3de880f6-3f37-45de-8d15-4ec87392d602','--changes',json.dumps(changes)],'mode':'low'})
save(p/'provenance.json',{'input_sha256':sha(src),'source':str(src.relative_to(BASE)),'cost':0,'method':'PixelLab exact guarded patch','user_visual_approval':False})
