"""Create palette-preserving guarded edits from individually inspected hand locations."""
from pathlib import Path
from PIL import Image
import json,sys
ROOT=Path(__file__).resolve().parents[1];clip=sys.argv[1]
spec=json.loads((ROOT/'resume'/(clip+'-hand-spec.json')).read_text(encoding='utf8'))
patterns={'ready':['.OO......','.OL......','.OL..OO..','.OL.OLLO.','.OL.O..O.','.OL.OLLO.','.OLLLLO..','.OLMLLO..','..OMLO...','...OO....'],'released':['..OO.....','..OL.....','..OL.....','..OL..OO.','..OL.OLLO','..OLLLOO.','..OLMLO..','..OMLLO..','...OMO...','....OO...']}
colors={'.':'#00000000','O':'#15191aff','L':'#f7cea6ff','M':'#d6a17cff'};changes=[]
for index,x0,y0,kind in spec['hands']:
 im=Image.open(ROOT/'generated'/spec['job_id']/f'{index:02}.png').convert('RGBA');pixels=[]
 pat=patterns[kind.removesuffix('_flip')]
 if kind.endswith('_flip'):pat=[r[::-1] for r in pat]
 for dy,row in enumerate(pat):
  for dx,ch in enumerate(row):
   x,y=x0+dx,y0+dy;old=im.getpixel((x,y));new=colors[ch];skin=old[3] and old[0]>70 and old[0]>old[1]*1.12
   if ch=='.' and old[3] and not skin:continue
   expected='#'+''.join(f'{v:02x}' for v in old)
   if expected!=new:pixels.append([x,y,expected,new])
 changes.append(dict(operation='patch_pixels',layer='image',frames=[index+1],pixels=pixels,reason='Separate index, thumb-middle contact loop and release for inspected '+kind+' hand'))
(ROOT/'resume'/(clip+'-hand-edits.json')).write_text(json.dumps(changes),encoding='utf8');print('Prepared',len(changes),'hand regions')
