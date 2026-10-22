from pathlib import Path
import json
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).parent/'review'
server=ThreadingHTTPServer(("127.0.0.1",0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
results=[]
with sync_playwright() as p:
 import os
 options={'headless':True,'args':['--no-sandbox']}
 if os.name!='nt': options['executable_path']='/usr/bin/chromium'
 else: options['channel']='msedge'
 browser=p.chromium.launch(**options)
 for name,w,h,mobile in [('pc',1440,1000,False),('phone-landscape',844,390,True),('phone-portrait',390,844,True)]:
  context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,device_scale_factor=1)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/release/demo/spangdal-full.html')
  page.wait_for_function('loaded === total')
  page.select_option('#reviewclip','toss')
  assert page.locator('#paused').is_checked()
  page.check('#hand');page.uncheck('#eatk')
  click=lambda s: page.tap(s) if mobile else page.click(s)
  click('#prevframe')
  assert page.evaluate('G.f === M.clips.toss.frames - 1')
  click('#nextframe');assert page.evaluate('G.f === 0')
  page.wait_for_timeout(250);assert page.evaluate('G.f === 0')
  page.select_option('#reviewclip','walk');page.uncheck('#paused')
  page.keyboard.press('ArrowRight') if not mobile else None
  page.wait_for_timeout(350)
  assert not errors,errors
  overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth')
  if overflow:
   print(name,page.evaluate("Array.from(document.querySelectorAll('*')).filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right})).slice(0,15)"))
   page.screenshot(path=str(OUT/f"failure-{name}.png"))
  assert not overflow
  page.select_option('#reviewclip','toss');click('#nextframe');click('#nextframe')
  page.screenshot(path=str(OUT/f'browser-{name}.png'))
  results.append({'viewport':[w,h],'mobile_touch':mobile,'loaded_images':page.evaluate('loaded'),
                  'js_errors':errors,'horizontal_overflow':overflow,'pause_step_wrap':'passed',
                  'screenshot':f'browser-{name}.png'})
  context.close()
 browser.close()
(OUT/'browser-check.json').write_text(json.dumps(results,indent=2)+'\n')
server.shutdown(); server.server_close()
print(json.dumps(results))
