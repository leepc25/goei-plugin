import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/codex/cua_node/lib/node_modules/playwright');
const root=path.dirname(fileURLToPath(import.meta.url));
const html=await readFile(path.join(root,'review/index.html'));
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[];
try{
 for(const [name,width,height,touch] of [['pc',1280,800,false],['mobile-landscape',844,390,true],['mobile-portrait',390,844,true]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
  const page=await context.newPage();const errors=[],external=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:')&&!r.url().startsWith('data:'))external.push(r.url())});
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.reviewReady);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
  const before=await page.locator('#scene').evaluate(c=>c.toDataURL());
  const activate=async(selector)=>touch?page.locator(selector).tap():page.locator(selector).click();
  await activate('label:has(#marker)');
  assert.equal(await page.evaluate(()=>window.reviewState.marker),false);
  const without=await page.locator('#scene').evaluate(c=>c.toDataURL());assert.notEqual(before,without,'marker changes visible canvas');
  await activate('label:has(#marker)');await activate('label:has(#guides)');
  assert.equal(await page.evaluate(()=>window.reviewState.guides),true);
  const states=await page.evaluate(()=>Object.keys(DATA.states));
  assert.ok(states.includes('closed')&&states.includes('open'),'actual delivered states required');
  const stateImages={};
  for(const state of ['closed','open']){
   if(states.includes(state)){await activate('#'+state);assert.equal(await page.evaluate(()=>window.reviewState.state),state);stateImages[state]=await page.locator('#scene').evaluate(c=>c.toDataURL());await page.screenshot({path:path.join(root,`review/${name}-${state}.png`),fullPage:true})}
   else assert.equal(await page.locator('#'+state).isDisabled(),true,'missing asset cannot be previewed as delivered');
  }
  assert.notEqual(stateImages.closed,stateImages.open,'open and closed visibly differ');
  await activate('#animate');await page.waitForFunction(()=>window.reviewState.state==='progress'&&window.reviewState.progress>0);
  await activate('#animate');assert.equal(await page.locator('#animate').getAttribute('aria-pressed'),'false');
  await activate('#closed');
  await page.screenshot({path:path.join(root,`review/${name}.png`),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  results.push({name,viewport:{width,height},touch,doorStates:states,overflow:false,errors,externalRequests:external});
  await context.close();
 }
 await writeFile(path.join(root,'review/browser-check.json'),JSON.stringify({results,scope:'Actual closed/open images, distinct rendered states, timed opening, separate marker, floor guides. Desktop and mobile viewport emulation; no physical mobile device used.'},null,2)+'\n');
 console.log(JSON.stringify(results));
}finally{await browser.close();await new Promise(r=>server.close(r))}
