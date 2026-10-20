"""Technical slicing of complete drawings; one scale for the entire sheet."""
from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]
folder=root/'game-src/action/walk-study'
im=Image.open(folder/'source.png').convert('RGBA')
xs=[0,432,800,1160,1536]
pieces=[]
for i in range(8):
    col,row=i%4,i//4
    box=(xs[col],0 if row==0 else 516,xs[col+1],516 if row==0 else 1024)
    cell=im.crop(box)
    bounds=cell.getchannel('A').point(lambda a:255 if a>=240 else 0).getbbox()
    pieces.append((cell.crop(bounds),(box[0]+bounds[0],box[1]+bounds[1])))
scale=128/pieces[0][0].height
atlas=Image.new('RGBA',(192*4,160*2))
frames=[]
for i,(piece,origin) in enumerate(pieces):
    w,h=round(piece.width*scale),round(piece.height*scale)
    resized=piece.resize((w,h),Image.Resampling.NEAREST)
    resized.putalpha(resized.getchannel('A').point(lambda a:255 if a>=240 else 0))
    x,y=i%4*192,i//4*160
    assert w<=192 and h<=160
    atlas.alpha_composite(resized,(x,y))
    hip=[238,595,960,1325,235,595,960,1325][i]
    frames.append([x,y,w,h,round((hip-origin[0])*scale),h,h])
atlas.save(folder/'atlas.png',optimize=True)
data={'profile':'walk-study-01','scale':2,'nativeHeight':128,'displayHeight':256,
      'frames':frames,'clips':{'idle':[0],'relaxed':[0],'walk':[1,2,3,4,5,6]},
      'sheetScale':scale,'perFrameScaling':False,'releaseReady':False}
(folder/'atlas.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
print(json.dumps({'heights':[f[3] for f in frames],'scale':scale}))
