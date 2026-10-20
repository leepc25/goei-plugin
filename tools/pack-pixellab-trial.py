from pathlib import Path
from PIL import Image
import json
p=Path(__file__).resolve().parents[1]/'game-src/action/pixellab-trial'
frames=[Image.open(p/'input.png').convert('RGBA')]+[Image.open(p/f'frame-{i}.png').convert('RGBA') for i in range(1,9)]
assert all(im.size==(160,160) for im in frames)
atlas=Image.new('RGBA',(160*3,160*3))
rects=[]
for i,im in enumerate(frames):
    x,y=i%3*160,i//3*160
    atlas.alpha_composite(im,(x,y))
    rects.append([x,y,160,160,80,144,128])
atlas.save(p/'atlas.png')
contact=Image.new('RGB',(960,960),(48,58,68))
for i,im in enumerate(frames):
    contact.paste(im.resize((320,320),Image.Resampling.NEAREST),(i%3*320,i//3*320),im.resize((320,320),Image.Resampling.NEAREST))
contact.save(p/'contact-sheet.png')
frames[1].save(p/'walk.gif',save_all=True,append_images=frames[2:],duration=150,loop=0,disposal=2)
meta=dict(profile='pixellab-trial-walk-01',scale=2,nativeHeight=128,displayHeight=256,frames=rects,clips=dict(idle=[0],relaxed=[0],walk=list(range(1,9))),perFrameScaling=False,releaseReady=False)
(p/'atlas.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
print(json.dumps(dict(frameBounds=[im.getbbox() for im in frames],perFrameScaling=False)))
