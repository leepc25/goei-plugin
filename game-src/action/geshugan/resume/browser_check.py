from pathlib import Path
import json
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[4];OUT=Path(__file__).resolve().parent
results=[]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for name,w,h,mobile in [('pc',1366,900,False),('phone-landscape',844,390,True),('phone-portrait',390,844,True)]:
  page=browser.new_page(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/release/demo/geshugan-full.html');page.wait_for_function('loaded===total')
  page.evaluate("$('inspect').checked=true; play('jump'); G.f=0")
  page.locator('#next').click();page.wait_for_timeout(300)
  assert page.evaluate('G.f')==1
  assert 'fall/00' in page.locator('#state').inner_text()
  page.locator('#prev').click();page.wait_for_timeout(100)
  assert page.evaluate('G.f')==0
  page.locator('#prev').click();assert page.evaluate('G.f')==6
  page.locator('#resume').click();page.keyboard.down('ArrowRight');page.wait_for_timeout(150)
  page.evaluate("window.dispatchEvent(new Event('blur'))")
  assert page.evaluate('keys.size')==0
  if mobile:
   button=page.locator('[data-k="ArrowRight"]')
   button.dispatch_event('pointerdown',{'pointerId':9,'pointerType':'touch','bubbles':True})
   assert page.evaluate("keys.has('ArrowRight')")
   button.dispatch_event('pointercancel',{'pointerId':9,'pointerType':'touch','bubbles':True})
   assert not page.evaluate("keys.has('ArrowRight')")
  # Freeze a known posture for direct visual review.
  page.evaluate("$('inspect').checked=true; play('stance'); G.x=360; G.y=0; G.z=.55")
  page.wait_for_timeout(50);page.screenshot(path=str(OUT/(name+'.png')))
  assert not errors,errors
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  results.append({'viewport':name,'errors':errors,'frame_step_wrap':True,'source_label':True,'blur_reset':True,'touch_cancel':mobile,'pad_bottom':page.locator('#pad').bounding_box()['y']+page.locator('#pad').bounding_box()['height'] if mobile else None})
  page.close()
 browser.close()
(OUT/'browser-results.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
