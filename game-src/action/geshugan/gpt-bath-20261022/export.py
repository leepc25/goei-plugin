"""Export generated raster frames to the requested grid; no hand-drawn pixels."""
from pathlib import Path
import sys,json
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]
src=Path(sys.argv[1]);key=sys.argv[2]
out=root/'clips'/f'{key}.png'
if out.exists():
 old=root/'gpt-bath-20261022/superseded'/f'{key}.png'
 old.parent.mkdir(parents=True,exist_ok=True)
 if not old.exists(): old.write_bytes(out.read_bytes())
im=Image.open(src).convert('RGBA')
# Fixed full-canvas sampling for the entire sequence, preserving proportions.
sampling=(156,117) if key.startswith('bath/') else (202,151)
dx=0 if key.startswith('bath/') else -3
im=im.resize(sampling,Image.Resampling.NEAREST)
a=np.array(im);a[:,:,3]=np.where(a[:,:,3]>=128,255,0)
base=np.array(Image.open(root/'base/G0.png').convert('RGBA'))
palette=np.unique(base[base[:,:,3]>127,:3],axis=0)
palette=np.vstack((palette,[[242,221,191],[218,193,157],[186,157,120]])).astype(np.uint8)
mask=a[:,:,3]>0
rgb=a[mask,:3].astype(np.int32)
d=((rgb[:,None,:]-palette[None,:,:].astype(np.int32))**2).sum(axis=2)
a[mask,:3]=palette[d.argmin(axis=1)]
im=Image.fromarray(a);box=im.getbbox();dy=136-box[3]
canvas=Image.new('RGBA',(192,144));canvas.paste(im,(dx,dy))
out.parent.mkdir(parents=True,exist_ok=True);canvas.save(out)
rec={'key':key,'source':src.name,'canvas':[192,144],'bounds':canvas.getbbox(),'translation':[dx,dy],'palette':'G0 plus specified beige towel ramp','sampling':list(sampling)}
log=Path(__file__).with_name('measurements.json');rows=json.loads(log.read_text()) if log.exists() else [];rows.append(rec);log.write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps(rec))
