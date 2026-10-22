"""Artist-specified hands/forearms; PixelLab applies guarded exact pixel patches."""
from production_ops import *
import math
# Each hand: old hand bounds, wrist, direction in degrees, joined-finger length.
S={
 'execute':{
  1:[((95,50,104,61),(97,58),-48,9),((80,80,88,86),(82,83),-8,9)],
  2:[((95,50,104,61),(97,58),-48,9),((83,77,90,83),(84,80),-12,9)],
  3:[((95,50,104,61),(97,58),-48,9),((91,61,101,70),(92,67),-38,9)],
  4:[((95,50,104,61),(97,58),-48,9),((91,61,100,70),(92,67),-38,9)],
  5:[((95,50,104,61),(97,58),-48,9),((91,61,100,70),(92,67),-38,9)],
  6:[((92,68,100,76),(93,73),-12,9),((89,76,96,82),(90,79),-12,8)]},
 'spineup':{3:[((86,57,94,71),(89,68),-85,10),((83,89,95,97),(85,93),0,10)],4:[((92,61,102,75),(94,72),-60,11),((88,91,102,98),(90,95),0,10)]},
 'throw':{0:[((86,58,94,69),(89,67),-85,10)],1:[((102,70,113,79),(103,75),-8,10)],2:[((96,64,112,72),(98,69),-14,12),((103,73,119,81),(105,78),-5,12)],3:[((87,63,103,70),(89,67),-8,12),((83,90,96,97),(85,94),0,10)]},
 'toss':{3:[((100,62,112,69),(102,66),-6,11)]},
 'grabstab':{0:[((102,57,116,65),(104,62),-10,11),((92,72,106,79),(94,76),-5,11)],1:[((103,57,116,65),(105,62),-10,10),((103,70,116,78),(105,75),-5,11)],2:[((106,57,122,66),(108,63),-12,11),((99,84,114,93),(101,88),28,11)],3:[((104,56,117,64),(106,61),-12,10),((99,76,113,85),(101,80),15,11)]},
 'super':{7:[],8:[]}}
def hand(im,box,wrist,angle,length):
 d=ImageDraw.Draw(im);d.rectangle((box[0]-1,box[1]-1,box[2],box[3]),fill=(0,0,0,0))
 a=math.radians(angle);u=(math.cos(a),math.sin(a));v=(-u[1],u[0]);x,y=wrist
 def pt(t,s):return (round(x+u[0]*t+v[0]*s),round(y+u[1]*t+v[1]*s))
 # Four straight joined fingers form one tapered palm, no index extension or hanging fist.
 d.line([pt(-5,0),pt(1,0)],fill='#171a1e',width=5);d.line([pt(-5,-1),pt(1,-1)],fill='#293943',width=2)
 shape=[pt(0,-2),pt(3,-2),pt(length,-1),pt(length,1),pt(4,2),pt(0,2)]
 d.polygon(shape,fill='#f6cdb8',outline='#171a1e');d.line([pt(2,1),pt(length-2,1)],fill='#d79e89',width=1)
def sleeve(im,start,end,width=6):
 d=ImageDraw.Draw(im);d.line([start,end],fill='#11191f',width=width);d.line([start,end],fill='#293943',width=max(1,width-2));d.line([(start[0],start[1]-1),(end[0],end[1]-1)],fill='#40515d',width=1)
p=PROD/'combat-exact-r2';p.mkdir(exist_ok=False);items=[]
for clip,frames in S.items():
 for i,hs in frames.items():
  src=PROD/f'execute-stable-hands-r1/result-{i:02}.png' if clip=='execute' else BASE/f'full/clips/{clip}/{i:02}.png';before=Image.open(src).convert('RGBA');after=before.copy()
  if clip=='grabstab' and i==2:
   ImageDraw.Draw(after).rectangle((89,71,122,81),fill=(0,0,0,0));sleeve(after,(87,75),(101,88),7)
  if clip=='super':
   ImageDraw.Draw(after).rectangle((90,53,119,88),fill=(0,0,0,0));sleeve(after,(88,73),(105,83),7);sleeve(after,(88,81),(107,64),7)
   hs=[((104,80,106,82),(105,83),18,10),((106,61,108,63),(107,64),-43,10)]
  for spec in hs:hand(after,*spec)
  # These regions are below/right of the head; verify the head and all lower body pixels exactly.
  a=np.array(before);b=np.array(after);assert np.array_equal(a[:50],b[:50]) and np.array_equal(a[102:],b[102:])
  items.append((clip,i,src,before,after))
w=960;h=((len(items)+4)//5)*144;canvas=Image.new('RGBA',(w,h));patch=[];sources=[]
for j,(clip,i,src,before,after) in enumerate(items):
 tx=j%5*192;ty=j//5*144;canvas.paste(before,(tx,ty));a=np.array(before);b=np.array(after);ys,xs=np.where(np.any(a!=b,axis=2))
 for y,x in zip(ys,xs):patch.append([int(tx+x),int(ty+y),'#'+bytes(a[y,x]).hex(),'#'+bytes(b[y,x]).hex()])
 sources.append({'clip':clip,'frame':i,'path':str(src.relative_to(BASE)),'sha256':sha(src),'tile':[tx,ty,192,144],'changed_pixels':len(xs),'hands':S[clip][i]})
canvas.save(p/'input.png');save(p/'provenance.json',{'sources':sources,'input_sha256':sha(p/'input.png'),'cost':0,'method':'Artist-specified joined palm silhouettes; remove third arm; cross super forearms. No other character pixels.','user_visual_approval':False})
save(p/'request.json',{'argv':['edit','data:image/png;base64,'+base64.b64encode((p/'input.png').read_bytes()).decode(),'--changes',json.dumps([{'operation':'patch_pixels','layer':'image','frames':[1],'pixels':patch,'reason':'Correct pointing index fingers to joined-finger spear hands. Remove grabstab third arm. Super forearms cross in X. Preserve original face/outfit/feet outside these exact artist-reviewed pixels.'}])],'mode':'low'})
print(len(items),'frames',len(patch),'pixels',canvas.size)
