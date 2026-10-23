"""Persist an explicit visual decision; never infers identity from file checks."""
import argparse,json,shutil,math,time
from pathlib import Path
from field_character_production import OUT,atomic

def native_prompt(a):
 a.pop('image_edit_source',None);a.pop('image_edit_description',None)
 lo,hi=a['stature_rendering']['target_body_pixels']
 h=min(256,4*math.ceil((hi+12)/4))
 a['native_height_canvas']=True
 r=a['pixel_request'];r['image_size']={'width':128,'height':h}
 r.pop('style_reference_local',None);r.pop('style_usage_description',None)
 r['seed']=int(time.time())
 r['description']=('Full-body native pixel-art game sprite, STRICTLY FRONT SOUTH view: face, nose, chest, belt and knees directly toward viewer, both ears equally visible. No sideways head or three-quarter turn. IDENTITY: '+a['appearance']+' Relaxed upright stance, empty hands at sides. Natural adult anatomy, normal torso/pelvis, 7-head proportions. Anatomical crown to soles '+str(lo)+'-'+str(hi)+'px; feet 6px above bottom, hair fully inside frame. Crisp single-pixel clusters, selective dark outlines, restrained game-sprite shading, no antialiasing. Transparent background, no ground shadow, text or weapons. Preserve individual hair, face, stature and clothing. Do not copy any generic character. Anatomical height excludes high hair/headwear. Every outer edge must border transparency directly, never a light gray halo.')
 assert len(r['description'])<=2000

def main():
 p=argparse.ArgumentParser();p.add_argument('slug');p.add_argument('decision',choices=['pass','reroll']);p.add_argument('reason');p.add_argument('--style-source');args=p.parse_args()
 m=json.loads((OUT/'manifest.json').read_text());s=json.loads((OUT/'state.json').read_text());control=json.loads((OUT/'control.json').read_text())
 a=next(a for a in m if a['slug']==args.slug);c=s['characters'][args.slug]
 status=s['jobs'][c['image']]['status']
 assert status=='completed' or (args.decision=='reroll' and status=='failed')
 record={'job':c['image'],'job_status':status,'decision':args.decision,'reason':args.reason,'at':time.time(),'rules_rechecked':['AVIF primary identity','lore/user height','south-facing','transparent edge without gray halo','no motions before all roster eight-way review']}
 atomic(OUT/args.slug/'visual-review.json',record)
 if args.decision=='pass':
  assert c.get('image_verified'),'Format checks must pass separately from visual review'
  c['image_visually_reviewed']=True
  if args.slug not in control['registration_approved_slugs']:control['registration_approved_slugs'].append(args.slug)
 else:
  assert not c.get('registration')
  dest=OUT/'history/rebuild-20261024/rerolls'/args.slug/c['image'];dest.parent.mkdir(parents=True,exist_ok=True)
  shutil.copytree(OUT/args.slug,dest)
  s['jobs'][c['image']]['visual_rejection']=record
  for f in (OUT/args.slug).iterdir():
   if f.is_file():f.unlink()
  c['image']=None
  for k in ['image_verified','image_invalid','image_visually_reviewed','download_error']:c.pop(k,None)
  c.setdefault('visual_rejections',[]).append(record)
  if args.slug in control['registration_approved_slugs']:control['registration_approved_slugs'].remove(args.slug)
  native_prompt(a)
  if args.style_source:
   assert s['characters'][args.style_source].get('image_visually_reviewed'),'Style source must have passed visual review'
   a.pop('native_height_canvas',None);r=a['pixel_request'];r['image_size']={'width':128,'height':256}
   r['style_reference_local']='game-src/art/field/production/'+args.style_source+'/reference.png'
   r['style_usage_description']='Use only native pixel rendering, standing scale and FRONT SOUTH pose. Preserve target individual identity, age, hair, face, build and clothes from description.'
   crown=250-round(sum(a['stature_rendering']['target_body_pixels'])/2)
   r['description']+=' Use target anatomical height at reference pixel scale. Feet at y250, crown around y'+str(crown)+'. Do not copy reference identity or body fat.'
   record['new_style_source']=args.style_source
 atomic(OUT/'manifest.json',m);atomic(OUT/'state.json',s);atomic(OUT/'control.json',control)
 print(args.slug,args.decision,args.reason)

if __name__=='__main__':main()
