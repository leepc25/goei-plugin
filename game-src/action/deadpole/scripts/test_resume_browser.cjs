let playwright;try{playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright')}catch{playwright=require('C:/Users/leepc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')}
const {chromium}=playwright;
const {pathToFileURL}=require('node:url');const path=require('node:path');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../../../..'),out=path.join(root,'game-src/action/deadpole/resume/review');
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});const page=await browser.newPage({viewport:{width:1280,height:860}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(root,'release/demo/deadpole-resume.html')).href);
 await page.waitForFunction(()=>window.reviewState?.().loaded);
 await page.locator('#play').click();
 const names=await page.locator('#actions button').evaluateAll(bs=>bs.map(b=>b.dataset.name));
 for(const name of names){await page.locator(`[data-name="${name}"]`).click();let s=await page.evaluate(()=>window.reviewState());assert.equal(s.clip,name);assert.equal(s.frame,0);await page.locator('#next').click();s=await page.evaluate(()=>window.reviewState());assert.equal(s.frame,1);await page.locator('#view').screenshot({path:path.join(out,`browser-${name}.png`)});await page.locator('#prev').click();}
 await page.locator('[data-name="pipe"]').click();await page.screenshot({path:path.join(out,'browser-desktop.png'),fullPage:true});
 await page.locator('#chain').click();await page.waitForFunction(()=>window.reviewState().clip==='counter');
 await page.locator('#play').click();await page.screenshot({path:path.join(out,'browser-transition.png'),fullPage:true});
 if(names.includes('cq3')){await page.locator('#combo').click();await page.waitForFunction(()=>window.reviewState().clip==='cq3');await page.locator('#play').click();}
 await page.setViewportSize({width:844,height:390});await page.locator('[data-name="pipe"]').click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(out,'browser-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'browser-test.json'),JSON.stringify({tested_at:new Date().toISOString(),clips:names,viewports:[[1280,860],[844,390]],errors,chain_pass:true,frame_controls_pass:true,mobile_horizontal_overflow:false},null,2));
 await browser.close();console.log('PASS: '+names.length+' clips, frame controls, shared transition, desktop/mobile, no console errors');
})().catch(e=>{console.error(e);process.exit(1)});
