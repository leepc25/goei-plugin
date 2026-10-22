"""Prepare guarded PixelLab pixel edits; does not alter image files."""
from pathlib import Path
from PIL import Image
import json
ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/'generated/3b131a96-b98f-4c4f-b220-146ce3706ceb'
# Long index and a distinct thumb/middle contact loop, then middle tucked into palm.
ready=['.OO......','.OL......','.OL..OO..','.OL.OLLO.','.OL.O..O.','.OL.OLLO.','.OLLLLO..','.OLMLLO..','..OMLO...','...OO....']
released=['..OO.....','..OL.....','..OL.....','..OL..OO.','..OL.OLLO','..OLLLOO.','..OLMLO..','..OMLLO..','...OMO...','....OO...']
colors={'.':'#00000000','O':'#15191aff','L':'#f7cea6ff','M':'#d6a17cff'}
# Frame 2 is beside the brow: preserve all face pixels x<63, replace only the hand silhouette.
positions=[(76,54),(63,42),(74,44),(72,49),(69,52)]
changes=[]
for index,(x0,y0) in enumerate(positions):
 im=Image.open(folder/f'{index:02}.png').convert('RGBA');pat=ready if index in [0,1,4] else released
 pixels=[]
 for dy,row in enumerate(pat):
  for dx,ch in enumerate(row):
   x,y=x0+dx,y0+dy;old=im.getpixel((x,y));new=colors[ch]
   # Do not erase suit/cuff pixels: only replace observed warm hand or outside silhouette.
   skin=old[3] and old[0]>70 and old[0]>old[1]*1.12
   if ch=='.' and old[3] and not skin: continue
   expected='#'+''.join(f'{v:02x}' for v in old)
   if expected!=new:pixels.append([x,y,expected,new])
 changes.append(dict(operation='patch_pixels',layer='image',frames=[index+1],pixels=pixels,reason='Replace fist with raised index and thumb-middle contact loop, then release into palm'))
(ROOT/'resume/snap1-hand-edits.json').write_text(json.dumps(changes,indent=2),encoding='utf8')
print('Prepared guarded hand-only pixel edits for five frames')
