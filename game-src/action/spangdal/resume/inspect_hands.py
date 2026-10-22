from production_ops import *
def components(mask):
 mask=mask.copy();out=[]
 for y,x in zip(*np.where(mask)):
  if not mask[y,x]:continue
  todo=[(x,y)];mask[y,x]=False;pts=[]
  while todo:
   xx,yy=todo.pop();pts.append((xx,yy))
   for dy in (-1,0,1):
    for dx in (-1,0,1):
     x2,y2=xx+dx,yy+dy
     if 0<=x2<mask.shape[1] and 0<=y2<mask.shape[0] and mask[y2,x2]:mask[y2,x2]=False;todo.append((x2,y2))
  if len(pts)>=3:out.append((min(x for x,y in pts),min(y for x,y in pts),max(x for x,y in pts)+1,max(y for x,y in pts)+1,len(pts)))
 return out
if __name__=='__main__':
 for clip,ids in [('execute',range(1,7)),('spineup',[3,4]),('throw',range(4)),('toss',[3]),('grabstab',range(4)),('super',[7,8])]:
  for i in ids:
   path=PROD/f'execute-stable-hands-r1/result-{i:02}.png' if clip=='execute' else BASE/f'full/clips/{clip}/{i:02}.png';a=np.array(Image.open(path).convert('RGBA'));r,g,b=a[:,:,:3].astype(int).transpose(2,0,1);m=(r>105)&(r>g*1.15)&(g>b*1.05)&(a[:,:,3]>0);m[:48]=False;m[:,:80]=False;print(clip,i,components(m))
