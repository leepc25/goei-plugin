"""Deterministic preparation of one PixelLab generation; no resizing or AI reroll."""
import hashlib, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
R=Path(__file__).resolve().parent
SIZE=(96,144); ANCHOR=[48,136]; OPENING=[8,11,80,125]
raw=Image.open(R/'raw/pixellab-d0105c20.png').convert('RGBA')
assert raw.size==SIZE
def save(im,name):
    p=R/name;p.parent.mkdir(parents=True,exist_ok=True);im.save(p)
    return {'file':name,'size':list(im.size),'anchor':ANCHOR,'alpha_bbox':list(im.getbbox()) if im.getbbox() else None,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def write(name,data):
    (R/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# The output is two 41x135 panels, not a complete architectural frame.
# Keep 40 columns per leaf; remove ten redundant frosted-band rows (raw y64..73).
# This is strip deletion, never anisotropic resampling; top/bottom and glass pixels stay 1:1.
def leaf(x):
    result=Image.new('RGBA',(40,125))
    result.paste(raw.crop((x,4,x+40,64)),(0,0))
    result.paste(raw.crop((x,74,x+40,139)),(0,60))
    return result
left,right=leaf(4),leaf(52)
left.save(R/'layers/leaf-left.png');right.save(R/'layers/leaf-right.png')
# Fixed rectangular joinery assembled with the generated panel's metallic rim colours.
# Explicit local construction: these frame pixels are not claimed as model-generated.
rim=[raw.getpixel((x,20)) for x in (4,5,6)]
frame=Image.new('RGBA',SIZE);d=ImageDraw.Draw(frame)
d.rectangle((3,5,92,137),fill=rim[0])
d.rectangle((4,6,91,136),outline=rim[1],width=2)
d.rectangle((6,8,89,135),outline=rim[2],width=2)
d.rectangle((8,11,87,135),fill=(0,0,0,0))
d.line((8,136,87,136),fill=rim[1])
base=Image.new('RGBA',SIZE);ImageDraw.Draw(base).rectangle((8,11,87,135),fill='#05070a')
frame_meta=save(frame,'layers/frame.png')
save(base,'layers/aperture.png')
def compose(progress):
    moving=Image.new('RGBA',(80,125))
    off=round(40*progress)
    moving.alpha_composite(left,(-off,0));moving.alpha_composite(right,(40+off,0))
    result=base.copy();result.alpha_composite(moving,(8,11));result.alpha_composite(frame)
    return result
states={}
for name,p in [('closed',0),('half',.5),('open',1)]:
    im=compose(p);meta=save(im,f'states/{name}.png')
    meta.update({'schema':'goei-hq-door-state/1','state':name,'progress':p,'opening':OPENING,'scale':2,'fixed_frame':'layers/frame.png','frame_sha256':frame_meta['sha256']})
    write(f'states/{name}.manifest.json',meta);states[name]=meta
for i in range(9):save(compose(i/8),f'frames/open-{i:02d}.png')
# All state differences must be strictly within the opening.
closed=compose(0);opened=compose(1)
outside=Image.new('L',SIZE,255);ImageDraw.Draw(outside).rectangle((8,11,87,135),fill=0)
for i in range(9):
    delta=ImageChops.difference(closed,compose(i/8)).convert('RGB')
    assert ImageChops.multiply(delta,Image.merge('RGB',(outside,outside,outside))).getbbox() is None
    assert compose(i/8).getpixel((0,0))[3]==0
assert opened.crop((8,11,88,136)).getcolors()==[(80*125,(5,7,10,255))]
assert closed.getbbox()==opened.getbbox()==frame.getbbox()
manifest=json.loads((R/'manifest.json').read_text(encoding='utf-8'))
manifest.update({'status':'delivered_for_visual_review','canvas':[96,144],'anchor':ANCHOR,'opening':OPENING,'measurement_status':'Measured and normalized without resampling; see preparation.json','states':states,'raw':'raw/pixellab-d0105c20.png','job_id':'d0105c20-4b44-4ebb-b3a5-32ea1a4158c1','generation_calls':1,'charged_generations':1,'missing':[],'integration_status':'handoff_patch_only_not_applied','layers':{'frame':'layers/frame.png','aperture':'layers/aperture.png','left':{'file':'layers/leaf-left.png','size':[40,125],'closed_origin':[8,11],'travel':[-40,0]},'right':{'file':'layers/leaf-right.png','size':[40,125],'closed_origin':[48,11],'travel':[40,0]}},'animation':{'files':[f'frames/open-{i:02d}.png' for i in range(9)],'progress':[i/8 for i in range(9)],'note':'Mechanical review samples, not newly generated frames; integration uses its existing open progress.'}})
write('manifest.json',manifest)
write('preparation.json',{'raw_size':list(raw.size),'raw_alpha_bbox':list(raw.getbbox()),'raw_sha256':hashlib.sha256((R/'raw/pixellab-d0105c20.png').read_bytes()).hexdigest(),'raw_issue':'Two separate leaves; no common fixed frame; panel height135 versus target125.','source_leaf_rects_xywh':[[4,4,40,135],[52,4,40,135]],'removed_source_rows_in_each_leaf_y_half_open':[64,74],'reason':'Remove 10 repeated frosted-band rows to meet125px opening; preserve top/bottom and all other source pixels without scaling.','frame':'Locally constructed rectangular frame using three sampled PixelLab rim colours.','frame_colors':rim,'no_resampling':True,'ai_edit_calls':0,'text_in_asset':False})
write('evidence/pixel-check.json',{'size':SIZE,'anchor':ANCHOR,'opening':OPENING,'frames_tested':9,'fixed_pixels_identical':True,'open_aperture_uniform':True,'outside_alpha_zero':True,'frame_bbox':list(frame.getbbox()),'user_visual_approval':False})
print('Prepared closed/half/open +9 mechanical frames; fixed-frame invariance PASS')
