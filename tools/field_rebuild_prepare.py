"""Prepare the explicitly authorized rebuild; never submits paid requests."""
import json, shutil, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'game-src/art/field/production'
NOTES = {
 'sa-jang': 'Adult male silhouette with broad straight shoulders and a tapered waist. Thick black wavy hair swept back with loose curved locks. Entire face is an opaque pitch-black shadow, including eyes and nose: ONLY a tiny thin white smile is visible. NO sunglasses. Black single-breasted tailored suit, white pointed collar, straight black necktie. Pale hands.',
 'do-pil-heon': 'Mature man with lean ordinary build, narrow angular long face, slight restrained smile and creases beside mouth. Dark brown-black wavy side-parted hair swept back, curved forelock on forehead. Black aviator sunglasses. Dark warm-charcoal single-breasted two-button suit, white shirt and neatly tightened black tie. No armor.',
 'lee-gil-hwan': 'Stocky plump middle-aged man with broad rounded torso and visible belly, round full cheeks and soft double chin, mild closed-mouth smile. Smooth dark brown-black BOWL haircut with thick straight rounded fringe touching the sunglasses. Black aviator sunglasses. Charcoal suit fitted over the round belly, white shirt, neat black tie. NOT slim or muscular.',
 'lee-gi-seok': 'Lean wiry adult man with narrow waist, angular narrow cheeks, pointed chin and confident crooked smile. Glossy black SIDE-PARTED hair, long curved curtain lock hanging over one side of forehead, opposite side swept back. Black aviator sunglasses. Fitted black single-breasted suit, white shirt, neat narrow black tie. Both hands look human; do not invent an exposed robot arm.',
 'kim-jo-hak': 'Mature middle-aged man, ordinary solid build, broad forehead with pronounced horizontal wrinkles, long angular lined cheeks, deep nasolabial folds and restrained thin-lipped smile. Short dark brown hair receding slightly at temples, combed back and sideways. Black aviator sunglasses. Dark charcoal suit, white shirt, straight black tie. No scars and no beard.',
 'lee-do-hyeong': 'Tall solid muscular mature man. SILVER-WHITE hair swept back into a visible low PONYTAIL behind neck. Black aviator sunglasses. Rugged angular face with several long parallel diagonal old scars across cheek, light chin stubble and confident smirk. Black suit jacket AND white shirt sleeves ROLLED UP TO BOTH ELBOWS; strong bare forearms and hands covered with many branching old scars. White shirt and black tie. Ponytail, cheek scars, rolled sleeves and forearm scars are essential.',
 'go-young-hoon': 'Lean hard-bodied mature man with narrow waist and squared shoulders, long angular expressionless face. Short dark brown-black hair side-parted and swept back. MANY clearly visible old scars: branching vertical scar on forehead above one lens, diagonal scars crossing BOTH cheeks and near mouth. Black aviator sunglasses do not hide all scars. Dark brown-black suit, long sleeves down to wrists, white shirt and neatly tied black tie. No smile.',
 'no-gi-gyun': 'Fit adult man with broad shoulders and tapered waist. Dark brown-black hair swept upward and back with a side part. Black aviator sunglasses. Narrow face and VERY DISTINCT healed jagged Glasgow-smile scars extending from BOTH mouth corners across the cheeks, with short perpendicular stitch-like scar marks. Closed-mouth sinister slight smile. This is scar tissue, not a moustache or beard. Black tailored suit, white shirt, neat black tie.',
 'song-ju-ik': 'Young athletic man, wide shoulders, long neck and lean strong torso. Very short dark BUZZ CUT, almost shaved, NOT swept hair. Black aviator sunglasses and thick eyebrows. Exceptionally LARGE long square projecting lower JAW and chin, conspicuously bigger lower face, confident closed mouth. Preserve the oversized angular jaw as his identifying trait without making a giant head. Dark black-brown fitted suit, white shirt, black tie.',
 'kwak-seong-ju': 'Huge heavily muscular mature man, by far broadest largest build in this faction, thick arms and massive torso. Tall spiky BLACK hair with very short shaved sides, thick eyebrows, black aviator sunglasses, square jaw with short dark beard stubble. Black suit and white shirt with black tie. SILVER-GRAY METAL PLATES bolted OVER BOTH shoulders, two long angular upper-chest plates beside lapels, and paired plates on BOTH upper arms. Cloth suit remains visible at torso center, abdomen and forearms. No helmet, no full torso cuirass, no ammunition belts.',
 'cho-seong-choon': 'Lean ordinary young adult man, slender long neck and narrow jaw, sly sideways smile. Smooth black bowl-like hair with thick long blunt bangs hanging down to aviator sunglasses. Black jacket sleeves and white shirt sleeves ROLLED to elbows, both forearms bare. White shirt collar OPEN revealing upper chest, black necktie very LOOSE with knot low on chest. Black jacket open. Do not button collar or tighten tie.',
 'yun-byeong-su': 'Adult man with moderately broad shoulders, lean firm torso, long angular clean-shaven face, strong jaw and flat unimpressed mouth. Short dark brown-black hair swept back with a shallow side part and small lifted tufts, short sides. Black aviator sunglasses. Dark charcoal-brown tailored suit, white shirt, correctly tied black tie, sleeves down. No scars, beard, cigarette or handheld device in this default appearance.',
 'kim-seong-jin': 'Slim young adult man with narrow youthful face, smooth pale skin, small pointed chin and playful slanted smile. Messy medium-length BLACK hair parted near center, long separated curtain strands falling across forehead toward sunglasses, tousled outward wisps at sides. Black aviator sunglasses. OPEN black suit jacket, white shirt OPEN at collar, slightly loosened long black necktie. Narrow natural shoulders and slim limbs, not muscular.',
 'song-jin-seob': 'Slim youthful man with soft oval face, small chin, gentle modest closed-mouth smile, NOT rugged. Neat rounded dark brown-black BOWL haircut with SHORT straight fringe well ABOVE eyebrows, visible forehead strip. Large black aviator sunglasses. Narrow natural shoulders and slender arms. Dark brown-charcoal single-breasted suit neatly buttoned, white shirt and tidy black necktie. No scars, beard or muscular bulk.'
}

def save(p, d):
 p.write_text(json.dumps(d, ensure_ascii=False, indent=2)+'\n')

def main():
 m=json.loads((OUT/'manifest.json').read_text()); s=json.loads((OUT/'state.json').read_text())
 h=OUT/'history/rebuild-20261024'; h.mkdir(parents=True,exist_ok=True)
 if (h/'prepared.json').exists(): raise SystemExit('Already prepared; do not reset submitted work.')
 for name in ['manifest.json','state.json','control.json','repair-queue.json']:
  shutil.copy2(OUT/name,h/name)
 for a in m:
  a['source_images_visually_reviewed']=False
  if a['slug'] not in NOTES:continue
  slug=a['slug']; dest=h/slug
  if (OUT/slug).exists():shutil.copytree(OUT/slug,dest,dirs_exist_ok=True)
  a['appearance']=NOTES[slug]
  category='largest' if slug=='kwak-seong-ju' else 'tall' if slug=='lee-do-hyeong' else 'ordinary-unspecified'
  # Production pixel targets are estimates, not claims of canonical centimetres.
  target=[240,246] if category=='largest' else [230,236] if category=='tall' else [214,222]
  a['stature_rendering']={'canonical_height_cm':None,'category':category,'target_body_pixels':target,'basis':'Lore: faction largest' if category=='largest' else 'Lore: explicitly tall' if category=='tall' else 'No definite height in lore; provisional ordinary adult stature, not inferred from cowboy-crop occupancy','comparison':'Same native scale; crown-to-sole excludes hair volume; no frame-fitting enlargement.'}
  a['source_review_details']={'reviewed_individually':True,'source_priority':'AVIF identity and build first; lore supplements stature and unseen information only','original_sha256':hashlib.sha256((ROOT/a['original_art']).read_bytes()).hexdigest(),'visual_findings':NOTES[slug],'lore_appearance_read':True,'height':a['stature_rendering'],'reviewed_at':'2026-10-24'}
  a['source_images_visually_reviewed']=True
  a['pixel_request']['description']=('Single full-body native pixel-art game sprite. IDENTITY MUST MATCH: '+NOTES[slug]+' Black trousers and plain black formal shoes. Relaxed upright stance with empty hands at sides. Front-facing SOUTH, low top-down camera. Natural adult anatomy, about 7 heads tall, normal torso and pelvis. Anatomical crown-to-sole height '+str(target[0])+'-'+str(target[1])+' pixels on a 128x256 canvas; hair may extend above crown. Soles at y248; leave unused space ABOVE shorter people, do NOT enlarge to fill frame. Keep individual build and facial features. Match reference ONLY for crisp 1px pixel clusters, selective dark outlines and controlled shading. Keep own hair and costume colors. Transparent background, no ground shadow, no text, no held weapons. Whole hair and shoes within frame.')
  assert len(a['pixel_request']['description'])<=2000
  c=s['characters'][slug]
  save(h/(slug+'-previous-state.json'),c)
  s['characters'][slug]={'name':a['name'],'group':a['group'],'character_id':None,'image':None,'registration':None,'motions':{},'ready':False,'visual_review_required':True,'rebuild':'20261024'}
  for j in s['jobs'].values():
   if j['slug']==slug:j['superseded_by']='rebuild-20261024'
  # Isolate rejected files from current results, preserving them in history.
  if (OUT/slug).exists():shutil.rmtree(OUT/slug)
  (OUT/slug).mkdir(exist_ok=True)
 control=json.loads((OUT/'control.json').read_text())
 control.update(stop_all=True,reason='User authorized rebuild; held during deletion/source audit, not waiting for additional permission.',max_character_pipeline_in_flight=20,image_approved_slugs=list(NOTES),registration_approved_slugs=[],release_skeleton_v3_motions=False,motion_allowed_slugs=[],registration_held_slugs=[],source_priority='AVIF first for identity/build; lore supplements height; explicit user heights override estimates',production_priority='fake-bureau then baekilmong then remainder; all 55 registered and eight-way visually reviewed before any new motion')
 save(OUT/'manifest.json',m);save(OUT/'state.json',s);save(OUT/'control.json',control)
 save(OUT/'repair-queue.json',[]);save(h/'prepared.json',{'roster':55,'rebuild_slugs':list(NOTES),'generation_submitted':False})

if __name__=='__main__':main()
