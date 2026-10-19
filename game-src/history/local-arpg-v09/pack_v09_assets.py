"""Retarget complete drawings to an annotated skull axis and explicit pelvis.
No bounding-height calibration, guessed pelvis, detached limbs or runtime warp.
"""
from pathlib import Path
from PIL import Image
import numpy as np,json,math
from inspect_v09_assets import extract
R=Path(__file__).resolve().parent
old=json.loads((R/'backup-v08/jyaldi.json').read_text(encoding='utf-8'));pal=Image.open(R/'backup-v08/jyaldi.png');atlas=pal.convert('RGBA')
frames=[{k:v for k,v in f.items() if k not in ['x','y']}|dict(image=atlas.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))) for f in old['frames']]
target=math.hypot(43-35,25-1)
# Coordinates in the isolated source drawing, measured on the inspection grid.
# crown x/y, chin x/y (occluded jaw inferred for overhand), pelvis x/y.
marks={
 'move':[[55,1,60,40,54,126],[65,1,76,37,68,127],[87,1,98,37,79,127],[81,1,92,37,74,128]],
 'jab':[[246,1,265,119,190,363],[306,1,319,119,252,361],[347,1,360,119,302,361],[252,1,268,119,194,362]],
 'attack':[[184,1,197,80,128,240],[236,1,247,80,152,240],[267,1,279,79,165,240],[180,1,192,79,135,240],[224,1,242,82,147,216],[284,5,315,82,180,216],[330,1,348,81,194,214],[175,1,187,81,139,224]],
 'walk':[[126,1,137,73,137,233],[112,1,124,72,110,233],[113,1,125,72,99,231],[116,1,128,72,105,232],[140,1,150,70,145,230],[114,1,126,70,100,229],[113,1,125,70,97,228],[120,1,132,70,111,229]],
 'run':[[246,1,262,81,205,217],[229,1,248,81,183,216],[219,1,238,81,186,217],[259,1,278,81,192,213],[251,1,267,81,198,212],[228,1,246,81,182,218],[231,1,249,81,190,215],[263,1,280,81,194,215]],
 'crouch':[[112,1,120,60,70,220],[126,1,136,66,73,186],[131,1,139,66,90,165],[143,1,149,66,94,167],[157,1,171,68,102,172],[162,1,178,68,107,172],[139,1,151,69,85,170],[138,1,150,69,87,170],[159,1,169,68,102,170],[162,1,177,68,102,170],[137,1,148,68,85,168],[138,1,151,68,88,170]],
 'low':[[57,0,66,27,42,76],[65,0,74,27,54,76],[78,0,87,27,59,75],[62,0,71,27,48,76]]
}
report=[]
def put(id,kind,index,im,gap=0):
 cx,cy,jx,jy,hx,hy=marks[kind][index];scale=target/math.hypot(jx-cx,jy-cy)
 w,h=round(im.width*scale),round(im.height*scale);sprite=im.resize((w,h),Image.Resampling.NEAREST)
 ox=round(10-hx*scale);oy=-h-gap
 head=[round(cx*scale)+ox,round(cy*scale)+oy,round(jx*scale)+ox,round(jy*scale)+oy]
 f=dict(image=sprite,w=w,h=h,ox=ox,oy=oy,sourceSheet=kind+'-v09',sourceIndex=index,wholeBody=True,anatomicalScale=scale,registration='manually annotated pelvis / support sole',headAxis=head,pelvis=[10,round(hy*scale)+oy],sourceLandmarks=marks[kind][index])
 frames[id]=f;report.append(dict(id=id,sheet=kind,source=index,scale=scale,height=h,headAxisLength=math.hypot(head[2]-head[0],head[3]-head[1]),pelvisY=f['pelvis'][1]))
move=extract('move',16,240)
for i in range(4):put(72+i,'move',i,move[i])
for kind,start,count in [('jab',76,4),('attack',80,8),('walk',88,8),('run',96,8)]:
 for i,im in enumerate(extract(kind,count)):put(start+i,kind,i,im,2 if kind=='run' and i in [3,7] else 0)
cr=extract('crouch',12)
for i in range(4):put(104+i,'crouch',i,cr[i])
# Include a feet-together passing pose each half-cycle; the previous eight
# drawings only repeatedly stretched the same front leg.
for j,i in enumerate([4,5,6,2,8,9,10,3]):put(108+j,'crouch',i,cr[i])
for i in range(4):
 f=old['frames'][116+i];im=atlas.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']));put(116+i,'low',i,im)
for id in [72,104]:
 f=frames[0].copy();f.update(wholeBody=True,sourceSheet='canonical-v09',sourceIndex=0,anatomicalScale=1,registration='manually annotated pelvis / support sole',headAxis=[7,-159,15,-135],pelvis=[10,-72],sourceLandmarks=[35,1,43,25,38,88]);frames[id]=f
meta={k:v for k,v in old.items() if k!='frames'};meta['frames']=[]
canvas=Image.new('RGBA',(1024,4000));x,y,rowh=2,2,0
for f in frames:
 if x+f['w']+2>1024:x,y,rowh=2,y+rowh+3,0
 canvas.paste(f['image'],(x,y));meta['frames'].append({k:v for k,v in f.items() if k!='image'}|dict(x=x,y=y));x+=f['w']+3;rowh=max(rowh,f['h'])
canvas=canvas.crop((0,0,1024,y+rowh+2));q=canvas.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE);idx=np.array(q);data=np.array(canvas);opaque=(idx==0)&(data[:,:,3]>=140)
if opaque.any():
 colors=np.array(pal.getpalette(),dtype=np.int32).reshape(-1,3)[1:64];values=data[:,:,:3][opaque].astype(np.int32);idx[opaque]=((values[:,None,:]-colors[None,:,:])**2).sum(2).argmin(1)+1
idx[data[:,:,3]<140]=0;oldidx=np.array(pal)
for a,f in zip(old['frames'][:72],meta['frames'][:72]):idx[f['y']:f['y']+f['h'],f['x']:f['x']+f['w']]=oldidx[a['y']:a['y']+a['h'],a['x']:a['x']+a['w']]
out=Image.fromarray(idx,'P');out.putpalette(pal.getpalette());out.save(R/'assets/jyaldi.png',optimize=True,transparency=0)
meta.update(atlasSize=list(out.size),animationVersion='0.9.0',canonicalHeadAxis=[35,1,43,25],headAxisTarget=target)
meta['motionMap']['finish']=[74,83,84,85,86,87,83,74]
(R/'assets/jyaldi.json').write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(R/'assets/v09-landmarks.json').write_text(json.dumps(dict(canonical=dict(crown=[35,1],chin=[43,25],pelvis=[38,88]),sources=marks),indent=2),encoding='utf-8')
(R/'output/v09-registration-validation.json').write_text(json.dumps(dict(target=target,frames=report),indent=2),encoding='utf-8')
print(json.dumps(dict(frames=len(frames),headTarget=target,runHeights=[f['h'] for f in frames[96:104]],crouchHeights=[f['h'] for f in frames[106:116]])))
