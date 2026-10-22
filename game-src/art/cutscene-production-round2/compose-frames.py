"""Reproducible, integer-grid composition; PixelLab originals remain untouched."""
from PIL import Image, ImageDraw, ImageChops
from pathlib import Path
import json, hashlib, sys
R=Path(__file__).resolve().parent
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def rgba_hash(im): return hashlib.sha256(im.convert('RGBA').tobytes()).hexdigest()
def save(im,path):
    p=R/path; p.parent.mkdir(parents=True,exist_ok=True); im.save(p); return str(path)
bg=Image.open(R/'raw/background/pixellab-21ec4c32.png').convert('RGBA')
assert bg.size==(320,180)
# Preserve source pixel scale: insert 12 identical wall rows before floor (no resampling).
fixed=Image.new('RGBA',(320,180))
fixed.paste(bg.crop((0,0,320,144)),(0,0))
for y in range(144,156): fixed.paste(bg.crop((0,143,320,144)),(0,y))
fixed.paste(bg.crop((0,144,320,168)),(0,156))
save(fixed,'layers/corridor-fixed.png')
D=R/'references/hq-door'
dm=json.loads((D/'manifest.json').read_text(encoding='utf-8-sig'))
frame=Image.open(D/'layers/frame.png').convert('RGBA')
left=Image.open(D/'layers/leaf-left.png').convert('RGBA')
right=Image.open(D/'layers/leaf-right.png').convert('RGBA')
aperture=Image.open(D/'layers/aperture.png').convert('RGBA')
assert left.size==right.size==(40,125)
origin=(180,20)
opening=(188,31,268,156)
def compose(offset):
    door=aperture.copy()
    leaves=Image.new('RGBA',(80,125))
    leaves.alpha_composite(left,(-offset,0))
    leaves.alpha_composite(right,(40+offset,0))
    door.alpha_composite(leaves,(8,11))
    door.alpha_composite(frame)
    out=fixed.copy();out.alpha_composite(door,origin)
    return out,door
first,door=compose(0)
save(first,'review/first-frame-320.png')
save(first.resize((640,360),Image.Resampling.NEAREST),'review/first-frame-640.png')
if '--first-only' in sys.argv:
    print('First composite ready; no animation frames built.');sys.exit()
assert (R/'review/first-frame-review.json').exists(), 'Review actual first composite before animation'
offsets=[0,1,2,4,6,9,12,16,20,24,28,31,34,36,38,39,40]
ms=[400]+[100]*15+[500]
frames=[];mask=Image.new('L',(320,180),255)
ImageDraw.Draw(mask).rectangle((opening[0],opening[1],opening[2]-1,opening[3]-1),fill=0)
for i,offset in enumerate(offsets):
    im,door=compose(offset)
    src=save(im,f'frames/source/{i:04d}.png')
    dst=save(im.resize((640,360),Image.Resampling.NEAREST),f'frames/final/{i:04d}.png')
    save(door,f'raw/animation-composites/{i:04d}.png')
    diff=ImageChops.difference(first.convert('RGB'),im.convert('RGB'))
    outside=ImageChops.multiply(diff,Image.merge('RGB',(mask,mask,mask)))
    assert outside.getbbox() is None, 'Pixels changed outside opening'
    frames.append(dict(index=i,sourceFile=src,file=dst,ms=ms[i],leafOffsetPx=offset,openWidthPx=offset*2,sha256=sha(R/dst),sourceSha256=sha(R/src),rgbaSha256=rgba_hash(im)))
assert len(set(f['rgbaSha256'] for f in frames))==17
manifest=dict(schemaVersion=2,id='first-day-empty-hall-door-round2',status='produced-for-visual-review',
    canvas=dict(width=640,height=360,sourceWidth=320,sourceHeight=180,integerScale=2,padding=[0,0,0,0],resample='nearest-neighbor',mobile=dict(portraitSourceScale=1,landscapeSourceScale=2,center=True,fillRemainder='#101720')),
    frames=frames,playback=dict(order=list(range(17)),ms=ms,durationMs=sum(ms),loop=False),
    composition=dict(doorOrigin=list(origin),openingXYWH=[188,31,80,125],thresholdSourceY=156,fixedFrameSource='references/hq-door/layers/frame.png',backgroundPreparation='Insert twelve copies of source wall row143 at y144..155; shift original floor rows144..167 to156..179. No resampling.',camera='locked',characters=False,animation='deterministic integer translation of shared new PixelLab leaves clipped to fixed aperture'),
    sourceJobs=[dict(jobId='21ec4c32-1bf3-4dba-a2c4-a8368d8af51f',role='new corridor',tool='create_image_pixen',chargedGenerations=1,recovered=True),dict(jobId=dm['job_id'],role='shared new door from door owner',chargedGenerations=dm['charged_generations'],chargedTo='codex/pixellab-doors-round2',newCallHere=False,recovered=True)],
    actualGeneratedImages=1,actualPaidCalls=1,actualChargedGenerations=1,sharedSourceImages=1,aiAnimationGeneratedFrames=0,compositedUniqueFrames=17,duplicateFrames=0,
    accountBalance=dict(before=14160.30,afterObservation=14158.30,creditsUSD=0,note='Shared account delta includes door owner. This task cost is server receipt 1 generation, not balance subtraction.',usdCharge=None),
    review=dict(firstFrame='agent inspected before animation',desktop='passed Chrome 1100x850' if (R/'review/browser-validation.json').exists() else 'pending',mobile='passed touch emulation 390x844 and 844x390; physical device not tested' if (R/'review/browser-validation.json').exists() else 'pending',visualApproval=False),
    integration=dict(target='first_day/c3 opening environment segment',originalDurationMs=6000,environmentDurationMs=2400,remainingCharacterSegmentMs=3600,characterSegmentOwner='character production',status='Main integrator reconciles timing and captions; no automatic replacement',sharedFilesModified=False))
(R/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(R/'playback.json').write_text(json.dumps(dict(order=[f['file'] for f in frames],ms=ms,durationMs=sum(ms)),indent=2)+'\n',encoding='utf8')
(R/'frames/final/timing.json').write_text(json.dumps(dict(ms=ms))+'\n')
(R/'frames/source/timing.json').write_text(json.dumps(dict(ms=ms))+'\n')
sheet=Image.new('RGB',(640,180*5),'#101720')
for j,i in enumerate([0,2,4,6,8,10,12,14,16]):
    im=Image.open(R/frames[i]['sourceFile']);sheet.paste(im,((j%2)*320,(j//2)*180))
save(sheet,'review/contact-sheet.png')
report=dict(uniqueFrames=17,duplicateFrames=0,changedPixelsOutsideAperture=0,sourceSize=[320,180],finalSize=[640,360],integerScale=2,doorOpeningWidths=[x*2 for x in offsets],thresholdSourceY=156,durationMs=sum(ms),aiAnimationFrames=0)
(R/'review/pixel-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
