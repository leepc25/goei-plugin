"""Pack the new whole-body candidates at one scale; no limb or anatomy manipulation."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parents[1]
folder = root / 'game-src/action/production-v5'
source = Image.open(folder / 'core-poses-candidate-02.png').convert('RGBA')
regions = [(100,0,510,528),(550,0,995,528),(1000,0,1500,528),
           (100,530,510,1024),(540,530,1024,1024),(1040,525,1510,1024)]
anchors = [(326,524),(779,524),(1230,524),(330,1005),(780,1005),(1235,1005)]
pieces = []
for region in regions:
    cell = source.crop(region)
    box = cell.getchannel('A').point(lambda a: 255 if a >= 240 else 0).getbbox()
    assert box
    pieces.append((cell.crop(box), (region[0]+box[0], region[1]+box[1])))
scale = 128 / pieces[0][0].height
atlas = Image.new('RGBA', (576,320))
frames = []
for i, ((piece, origin), anchor) in enumerate(zip(pieces, anchors)):
    w,h = round(piece.width*scale),round(piece.height*scale)
    piece = piece.resize((w,h), Image.Resampling.NEAREST)
    piece.putalpha(piece.getchannel('A').point(lambda a:255 if a>=240 else 0))
    x,y = i%3*192, i//3*160
    assert w <=192 and h<=160
    atlas.alpha_composite(piece,(x,y))
    # These are grounded key poses: sole contact anchors the floor, without scaling anatomy.
    frames.append([x,y,w,h,round((anchor[0]-origin[0])*scale),h,h])
atlas.save(folder/'atlas-preview.png',optimize=True)
data = {'profile':'production-v5-preview','nativeHeight':128,'displayHeight':256,
        'source':'production-v5/core-poses-candidate-02.png','scale':2,'frames':frames,
        'clips':{'idle':[0],'relaxed':[0],'walk':[1],'run':[2],'crouch':[3],'crouchwalk':[3],
                 'melee3':[4],'shot':[5],'airfire':[5]},
        'previewOnly':True, 'sheetScale':scale}
(folder/'atlas-preview.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
print(json.dumps({'neutralHeight':frames[0][3],'scale':scale,'frames':frames}))
