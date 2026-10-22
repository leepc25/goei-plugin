from pathlib import Path
import json
import shutil
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
results=[]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True, args=['--no-sandbox'])
    for label,w,h in [('pc',1280,900),('phone-landscape',844,390),('phone-portrait',390,844)]:
        page=browser.new_page(viewport={'width':w,'height':h},has_touch=label!='pc')
        errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/release/demo/gorgodio-production-review.html')
        page.wait_for_function('Object.values(images).every(im=>im.complete && im.naturalWidth>0)')
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'), label
        assert page.locator('#bare option').count()==75
        assert page.locator('#armor option').count()==28
        for value in ['walk,a_walk','run,a_glide','chop1,a_swat','cleave,a_axe','summon,a_arrive']:
            page.select_option('#pair',value)
            before=page.locator('#bodyStatus').inner_text()
            page.click('#next')
            assert page.locator('#bodyStatus').inner_text()!=before
            for source in ['final','raw']:
                page.select_option('#source',source);page.click('#seam');page.click('#seam')
                assert page.input_value('#step')=='0'
        page.select_option('#pair','walk,a_walk')
        if label!='pc':page.locator('#next').tap()
        else:page.click('#next')
        assert page.input_value('#step')=='1'
        page.click('#play');page.wait_for_timeout(600);assert page.input_value('#step')!='1';page.click('#play')
        page.screenshot(path=str(HERE/('browser-'+label+'.png')),full_page=True)
        assert not errors,errors
        results.append({'viewport':[w,h],'page_errors':errors,'horizontal_overflow':False,'embedded_images':206,'result':'pass'})
        page.close()
    browser.close()
server.shutdown()
(HERE/'browser-check.json').write_text(json.dumps(results,indent=2)+'\n')
print('PC·모바일 가로·세로 동작 검사 통과 (신규 그림/사용자 시각 승인 아님)')
