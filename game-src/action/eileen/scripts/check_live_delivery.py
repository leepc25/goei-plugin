"""Verify exact edit scope, intact originals, grounding and real browser playback."""
from pathlib import Path
from PIL import Image
import numpy as np
import subprocess,io,json,sys,os,functools,http.server,threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[4]
ART=ROOT/'game-src/action/eileen';OUT=ART/'resume/live-20261022'
sys.path.insert(0,str(ART/'scripts'))
from resume_grounding import OFFSETS
def old(path):return subprocess.check_output(['git','show','3ffba089:'+path],cwd=ROOT)
def image(b):return Image.open(io.BytesIO(b)).convert('RGBA')
def frames(im):return [im.crop((i*192,0,(i+1)*192,144)) for i in range(im.width//192)]

changed=[]
for path in (ART/'final').glob('*.png'):
 rel=path.relative_to(ROOT).as_posix();a=image(old(rel));b=Image.open(path).convert('RGBA')
 if a.tobytes()!=b.tobytes():changed.append(path.stem)
assert set(changed)=={'precise','pushkick','step','limp','transition'},changed
trans=frames(Image.open(ART/'final/transition.png').convert('RGBA'))
previous_trans=frames(image(old('game-src/action/eileen/final/transition.png')))
assert len(trans)==11
assert [im.tobytes() for im in trans[6:]]==[im.tobytes() for im in previous_trans[1:]]
request=json.loads((OUT/'transition-exact/request.json').read_text(encoding='utf-8'))
before=np.array(Image.open(OUT/'transition-mask/input.png').convert('RGBA'))
after=np.array(Image.open(OUT/'transition-exact/result.png').convert('RGBA'))
expected=before.copy()
for change in request['changes']:
 for x,y,old_color,new_color in change['pixels']:
  assert '#'+''.join(f'{c:02x}' for c in expected[y,x])==old_color
  expected[y,x]=tuple(bytes.fromhex(new_color[1:]))
assert np.array_equal(expected,after)
assert int(np.any(before!=after,axis=2).sum())==541
for i in range(6):
 source=OUT/f'{"transition-rig" if i<2 else "transition-exact"}/{i:02d}.png'
 assert trans[i].tobytes()==Image.open(source).convert('RGBA').tobytes()
assert len(json.loads((ART/'final/manifest.json').read_text(encoding='utf-8'))['clips']['transition']['anchors'])==11
orig=frames(image(old('game-src/action/eileen/final/precise.png')))
current=frames(Image.open(ART/'final/precise.png').convert('RGBA'))
for i,(a,b) in enumerate(zip(orig,current)):
 n=int(np.any(np.array(a)!=np.array(b),axis=2).sum())
 assert n=={1:19,2:18}.get(i,0),(i,n)
 assert a.getchannel('A').tobytes()==b.getchannel('A').tobytes()
for clip,offsets in OFFSETS.items():
 a=frames(image(old(f'game-src/action/eileen/final/{clip}.png')));b=frames(Image.open(ART/f'final/{clip}.png').convert('RGBA'))
 for i,(before,after) in enumerate(zip(a,b)):
  expected=Image.new('RGBA',(192,144));expected.paste(before,(0,offsets.get(i,0)))
  assert expected.tobytes()==after.tobytes(),(clip,i)
  if i in offsets:assert after.getbbox()[3]==137,(clip,i,after.getbbox())
 baseline=json.loads(old('game-src/action/eileen/final/manifest.json'))['clips'][clip]['anchors']
 current=json.loads((ART/'final/manifest.json').read_text(encoding='utf-8'))['clips'][clip]['anchors']
 for i,(a,b) in enumerate(zip(baseline,current)):
  for key in ('hand','hand2','hip','muzzle'):
   if key in a:
    expected=list(a[key]);expected[1]+=offsets.get(i,0)
    assert b[key]==expected,(clip,i,key,b[key],expected)
assert subprocess.check_output(['git','diff','--name-only','3ffba089','--','game-src/action/eileen/clips','game-src/action/eileen/base'],cwd=ROOT)==b''

server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
checks=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'))
 for name,w,h in [('pc',1280,800),('mobile',390,844)]:
  context=browser.new_context(viewport={'width':w,'height':h});page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/release/demo/eileen-resume-review.html');page.wait_for_function('reviewReady()')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.locator('input[type=range]').first.fill('1');page.wait_for_timeout(80)
  page.screenshot(path=str(OUT/f'review-{name}.png'))
  page.locator('button').first.click();page.wait_for_timeout(300)
  assert int(page.locator('input[type=range]').first.input_value())!=1
  page.goto(f'http://127.0.0.1:{server.server_port}/release/demo/eileen-full.html');page.wait_for_function('Object.values(imgs).every(i=>i.complete&&i.naturalWidth>0)')
  assert page.evaluate('M.clips.precise.editedPixelCounts.join(",")')=='19,18'
  page.evaluate("G.hq=false;G.lock=false;G.pistol=false;play('guard')")
  page.keyboard.press('s');page.wait_for_timeout(40);assert page.evaluate("G.pistol&&G.clip==='transition'")
  page.wait_for_timeout(700);page.keyboard.press('s');page.wait_for_timeout(40);assert page.evaluate("!G.pistol&&G.clip==='transition'&&G.rev")
  page.evaluate("play('precise',{lock:true});G.f=1;G.pause=true")
  page.wait_for_timeout(80);page.screenshot(path=str(OUT/f'game-{name}.png'))
  assert not errors,errors
  checks.append({'viewport':name,'review_loaded':True,'scrub_and_play':True,'weapon_toggle_both_directions':True,'page_errors':errors})
  context.close()
 browser.close()
server.shutdown()
report={'changed_strips':changed,'exact_edit_pixels':[19,18],'support_frames':10,'raw_clips_and_base_unchanged':True,'visual_approval':'pending','browser':checks}
(OUT/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
