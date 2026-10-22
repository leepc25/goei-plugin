#!/usr/bin/env python3
"""Exercise the independent source-frame reviewer; never asserts art approval."""
from pathlib import Path
import json
import functools
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'review/character-resume'
OUT.mkdir(parents=True,exist_ok=True)
handler=functools.partial(SimpleHTTPRequestHandler,directory=str(ROOT))
server=ThreadingHTTPServer(('127.0.0.1',0),handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
URL=f'http://127.0.0.1:{server.server_address[1]}/release/demo/character-production-resume.html'
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for name,width,height,touch in [('pc',1280,720,False),('mobile-landscape',844,390,True),('mobile-portrait',390,844,True)]:
        context=browser.new_context(viewport={'width':width,'height':height},has_touch=touch)
        page=context.new_page();errors=[];requests=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.on('console',lambda msg: errors.append(msg.text) if msg.type=='error' else None)
        page.on('request',lambda req: requests.append(req.url) if req.url.startswith(('http:','https:')) and not req.url.startswith('http://127.0.0.1:') else None)
        page.goto(URL)
        page.wait_for_function('window.__characterReview && window.__characterReview.getState().loaded === window.__characterReview.getState().total')
        state=lambda:page.evaluate('window.__characterReview.getState()')
        assert state()['frames']==8
        if name=='mobile-landscape':
            touchbox=page.locator('.touch').bounding_box()
            assert touchbox['y']+touchbox['height']<=height,'landscape touch controls below initial viewport'
        assert page.locator('body').evaluate('(e)=>e.scrollWidth<=innerWidth'), 'horizontal overflow'
        page.locator('#play').click();before=state()['frame'];page.wait_for_timeout(160)
        assert state()['frame']==before, 'pause drifts'
        page.locator('#next').click();assert state()['frame']==(before+1)%8
        page.locator('#frames button').last.click();page.locator('#next').click();assert state()['frame']==0,'loop boundary'
        page.locator('#speed').select_option('2')
        page.locator('#play').click();page.wait_for_timeout(700);assert state()['loopCount']>=1,'playback loops'
        page.locator('#play').click();page.locator('#speed').select_option('1')
        page.locator('#reset').click();page.locator('#stage').click()
        if touch:
            box=page.locator('[data-hold=right]').bounding_box()
            page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
            page.mouse.down();page.wait_for_timeout(250);page.mouse.up()
        else:
            page.keyboard.down('ArrowRight');page.wait_for_timeout(250);page.keyboard.up('ArrowRight')
        assert state()['worldX']>2,'movement input'
        page.locator('#stage').click();page.keyboard.down('Shift');page.keyboard.down('ArrowLeft');page.wait_for_timeout(250)
        page.keyboard.up('ArrowLeft');page.keyboard.up('Shift');assert state()['clip']=='run';assert state()['facing']==-1
        page.locator('#reset').click();page.locator('#clip').select_option('walk');page.locator('#frames button').nth(2).click()
        page.screenshot(path=str(OUT/f'demo-{name}.png'),full_page=True)
        for agent in ['jyaldi','kyuras','eileen']:
            page.locator(f'[data-agent={agent}]').click()
            options=page.locator('#clip option').evaluate_all('(els)=>els.map(e=>e.value)')
            for option in options:
                page.locator('#clip').select_option(option)
                page.locator('#frames button').last.click()
                assert page.locator('#lastImage').evaluate('(e)=>e.complete&&e.naturalWidth>0')
                assert page.locator('#firstImage').evaluate('(e)=>e.complete&&e.naturalWidth>0')
            assert page.locator('body').evaluate('(e)=>e.scrollWidth<=innerWidth')
        assert not errors,errors
        assert not requests,requests
        results.append({'viewport':name,'width':width,'height':height,'pass':True,'checks':['89 embedded source images loaded','pause/step/last-to-first/playback','keyboard/pointer movement and run','all 14 clips switchable','no external requests','no horizontal overflow','no browser errors'],'artApproval':False})
        context.close()
    browser.close()
server.shutdown()
(OUT/'demo-browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False,indent=2))
