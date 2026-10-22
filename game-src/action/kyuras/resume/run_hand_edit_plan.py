from pathlib import Path
from PIL import Image
import json
ROOT=Path(__file__).resolve().parents[1];folder=ROOT/'recovered/9fe0e770-b992-4299-a4c1-90d6e591828a'
pattern=['.OOO..','OLLLLO','OLMLLO','OLMLLO','.OMMO.','..OO..'];colors={'.':'#00000000','O':'#15191aff','L':'#f5c499ff','M':'#d6a17cff'}
changes=[]
for index,y0 in [(2,78),(3,78),(4,76),(5,78),(6,78)]:
 im=Image.open(folder/f'{index:02}.png').convert('RGBA');pixels=[]
 for dy,row in enumerate(pattern):
  for dx,ch in enumerate(row):
   if ch=='.':continue
   x,y=81+dx,y0+dy;old='#'+''.join(f'{v:02x}' for v in im.getpixel((x,y)));new=colors[ch]
   if old!=new:pixels.append([x,y,old,new])
 changes.append(dict(operation='patch_pixels',layer='image',frames=[index+1],pixels=pixels,reason='Restore missing gripping hand at observed sleeve tip, keep arm and body'))
(ROOT/'resume/run-shotgun-hand-edits.json').write_text(json.dumps(changes),encoding='utf8')
