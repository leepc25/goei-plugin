from pathlib import Path
from playwright.sync_api import sync_playwright
import json,hashlib,subprocess,io
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[4];BASE=ROOT/'game-src/action/spangdal';OUT=BASE/'resume/review'
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 page=browser.new_page(viewport={'width':1440,'height':1000});page.goto((ROOT/'release/demo/spangdal-full.html').as_uri());page.wait_for_function('loaded===total')
 shots=[];results=[]
 for clip,frame in [('stab1',2),('pierce3',3),('jump',3),('pipe',2),('shotgun',1),('idle_shotgun',0),('walk_shotgun',2),('run_shotgun',3),('execute',3),('spineup',3),('throw',2),('toss',3),('grabstab',2),('super',7)]:
  page.select_option('#reviewclip',clip);page.evaluate('(f)=>G.f=f',frame);page.uncheck('#hand');page.uncheck('#eatk');page.wait_for_timeout(70)
  canvas=page.locator('canvas').first;on=canvas.screenshot();page.uncheck('#weaponview');page.wait_for_timeout(70);off=canvas.screenshot();page.check('#weaponview');page.wait_for_timeout(70)
  weapon=page.evaluate('M.clips[G.clip].weaponOverlay || null')
  if weapon:assert on!=off,'weapon toggle has no effect'
  shots.append((clip,frame,Image.open(io.BytesIO(on)).convert('RGB')));results.append({'clip':clip,'frame':frame,'weapon':weapon,'toggle_changes_pixels':on!=off})
 browser.close()
w,h=shots[0][2].size;sheet=Image.new('RGB',(w*2,(h+24)*((len(shots)+1)//2)),(32,32,32));d=ImageDraw.Draw(sheet)
for j,(clip,frame,im) in enumerate(shots):
 x=j%2*w;y=j//2*(h+24);d.text((x+5,y+5),f'{clip} {frame}',fill='white');sheet.paste(im,(x,y+24))
sheet.save(OUT/'candidate-demo.png')
sheet.crop((0,4*(h+24),w*2,7*(h+24))).save(OUT/'combat-demo.png')
assert not subprocess.check_output(['git','diff','--name-only','HEAD','--','game-src/action/spangdal/full/clips'],cwd=ROOT).strip()
ledger=json.loads((BASE/'resume/production/ledger.json').read_text(encoding='utf-8'));assert ledger['pending_count']==0 and ledger['actual_total']==59
manifest=json.loads((BASE/'full/final/manifest.json').read_text(encoding='utf-8'));changed=[]
for clip,meta in manifest['clips'].items():
 for i,s in enumerate(meta.get('frameSources',[])):
  if s.get('correction'):
   src=BASE/s['correction'];assert src.exists();changed.append({'clip':clip,'frame':i,'sha256':hashlib.sha256(src.read_bytes()).hexdigest()})
(OUT/'candidate-check.json').write_text(json.dumps({'demo_checks':results,'original_frames_unchanged':True,'ledger_actual_total':59,'rendered_overrides':changed,'user_visual_approval':False},indent=2)+'\n',encoding='utf-8')
print(len(changed),'rendered overrides in',len({x['clip'] for x in changed}),'clips')
