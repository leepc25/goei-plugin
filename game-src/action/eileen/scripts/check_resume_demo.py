"""기존 납품 RGBA 보존 + 독립 HTML 실제 재생/PC/터치 검사."""
import json
import os
import shutil
import functools
import http.server
import threading
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[4]
ART=ROOT/'game-src/action/eileen'
OUT=ART/'resume/review'
OUT.mkdir(parents=True,exist_ok=True)
manifest=json.loads((ART/'final/manifest.json').read_text())
assert len(manifest['clips'])==93
for clip,count in [('undress',7),('showerturn',3),('shower',6),('bath',4)]:
    strip=Image.open(ART/'final'/f'{clip}.png').convert('RGBA')
    assert manifest['clips'][clip]['frames']==count
    for i in range(count):
        raw=Image.open(ART/'clips'/clip/f'{i:02d}.png').convert('RGBA')
        assert raw.tobytes()==strip.crop((192*i,0,192*(i+1),144)).tobytes(),(clip,i)
results=[]
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'))
    for label,w,h,touch in [('pc',1280,800,False),('mobile-landscape',844,390,True),('mobile-portrait',390,844,True)]:
        context=browser.new_context(viewport={'width':w,'height':h},has_touch=touch,is_mobile=touch)
        page=context.new_page(); errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/release/demo/eileen-full.html')
        page.wait_for_function('Object.values(imgs).every(i=>i.complete && i.naturalWidth>0)')
        assert page.evaluate('Object.keys(M.clips).length')==93
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),label
        page.evaluate("G.hq=true; play('shower',{lock:true,loops:3}); window.observed=[0]; window.track=true; function trackFrames(){if(!window.track)return;if(observed.at(-1)!==G.f)observed.push(G.f);requestAnimationFrame(trackFrames)};trackFrames()")
        page.wait_for_timeout(1900)
        observed=page.evaluate('window.track=false; observed')
        assert any(a==5 and b==2 for a,b in zip(observed,observed[1:])),observed
        assert not any(a==5 and b==0 for a,b in zip(observed,observed[1:])),observed
        page.evaluate("G.hq=false; G.lock=false; G.x=360; play('guard')")
        if touch:
            page.locator('#padt').check()
            button=page.locator('button[data-k="ArrowRight"]')
            button.scroll_into_view_if_needed()
            box=button.bounding_box();assert box
            x,y=box['x']+box['width']/2,box['y']+box['height']/2
            session=context.new_cdp_session(page)
            session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
            page.wait_for_timeout(250)
            session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        else:
            page.keyboard.down('ArrowRight');page.wait_for_timeout(250);page.keyboard.up('ArrowRight')
        moved=page.evaluate('G.x');assert moved>360,(label,moved)
        page.evaluate("G.hq=true; play('shower',{lock:true,loops:3}); document.getElementById('screen').scrollIntoView({block:'center'})")
        page.wait_for_timeout(150)
        page.screenshot(path=str(OUT/f'demo-{label}.png'))
        assert not errors,errors
        results.append({'viewport':label,'width':w,'height':h,'touch':touch,'shower_frames_observed':observed,'movement_x':moved,'page_errors':errors,'horizontal_overflow':False})
        context.close()
    browser.close()
server.shutdown()
(OUT/'browser-check.json').write_text(json.dumps({'rgba_pack_matches_all_20_sources':True,'clips':93,'results':results},ensure_ascii=False,indent=2)+'\n')
print('PASS: 20 RGBA 원본 동일 / 93클립 / 5→2 반복 / PC·모바일 3화면 / 실제 이동 입력')
