// Source-only HQ UI regression. No release build or forced mission completion.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const bundle=await build({stdin:{contents:`
import {createHq} from './src/game/action/hq/view';
import {newSave,saveText} from './src/game/action/hq/state';
import {launch} from './src/game/action/hq/logic';
import {memorySaves} from './src/game/action/hq/store';
import {SessionStore} from './src/game/action/engine/sessionStore';
const info={title:'검증',summary:'',schema:'goei-hq/1'};
window.setup=async function() {
 if(window.hq) window.hq.unmount();
 const disk=memorySaves(), session=new SessionStore(disk,0);
 await session.ready;
 const s=newSave();s.currencies.budget=0;s.agents.jyaldi.injured=1;s.agents.jyaldi.fatigue=3;
 await session.hqSaves.write(0,saveText(s),info);
 const hq=createHq();window.hq=hq;window.session=session;window.deployments=[];window.restores=0;
 hq.mount(document.body,{load:()=>session.hqSaves.read(0),save:data=>session.hqSaves.write(0,data,info),
 saves:{...session.hqSaves,restore:async n=>{window.restores++;return session.hqSaves.restore(n)}},
 deploy:l=>window.deployments.push(l),resuming:()=>!!session.checkpoint},{walk:false});
 await hq.ready();hq.openPlace('clinic');
};
window.prepareActive=async function() {
 const s=newSave();s.day=4;launch(s,'m1',33);
 session.setMeta({deepest:3});session.setCheckpoint({version:1,marker:'active-slot'});
 await session.hqSaves.write(2,saveText(s),info);
 session.setCheckpoint(null);session.setMeta({deepest:9});hq.state.active=null;hq.openMenu();
};
`,resolveDir:process.cwd()},bundle:true,format:'iife',write:false,loader:{'.css':'text'}});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
const errors=[];
try {
 for(const mobile of [false,true]) {
  const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:950},isMobile:mobile,hasTouch:mobile});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});await page.evaluate(()=>window.setup());
  await page.click('[data-rest="day"]');
  assert.deepEqual(await page.evaluate(()=>({day:hq.state.day,budget:hq.state.currencies.budget,injury:hq.state.agents.jyaldi.injured,fatigue:hq.state.agents.jyaldi.fatigue,runs:hq.state.runs})),{day:2,budget:0,injury:0,fatigue:0,runs:0});
  await page.evaluate(()=>hq.openPlace('jaemtri'));await page.click('[data-act="brief"]');await page.click('[data-act="deploy"]');
  // 2026-10-25 사용자: 브리핑의 「출동」은 출동 준비(B3 승합차)만 하고, 실제 출동은 승합차에서 E(depart). 걷지 않는 창(walk:false)도 같다
  assert.equal(await page.evaluate(()=>deployments.length),0,'브리핑 단추는 출동 준비만');
  assert.equal(await page.evaluate(()=>hq.armed()),true,'출동 준비됨');
  assert.equal(await page.evaluate(()=>hq.depart()),null,'승합차에서 출발');
  assert.equal(await page.evaluate(()=>deployments.length),1,'휴식 뒤 브리핑 → 승합차로 출동');
  await page.evaluate(()=>window.setup());await page.click('[data-rest="day"]');
  await page.evaluate(()=>{session.setMeta({deepest:3});hq.openMenu()});
  await page.click('[data-saveslot="1"]');await page.waitForSelector('[data-loadslot="1"]');
  await page.evaluate(()=>{hq.state.day=9;session.setMeta({deepest:9})});
  await page.click('[data-loadslot="1"]');await page.waitForFunction(()=>hq.state.day===2);
  assert.equal(await page.evaluate(()=>session.meta.deepest),3,'불러오기 UI가 영구 탐사도 복원');
  await page.evaluate(()=>window.prepareActive());await page.waitForSelector('[data-loadslot="2"]');
  await page.click('[data-loadslot="2"]');await page.waitForFunction(()=>!!hq.state.active);
  assert.match(await page.locator('.hq-notice').innerText(),/시작 화면의 이어하기/);
  assert.deepEqual(await page.evaluate(()=>({checkpoint:session.checkpoint.marker,deepest:session.meta.deepest,restores:window.restores})),{checkpoint:'active-slot',deepest:3,restores:2});
  await page.evaluate(()=>session.flush());
  await ctx.close();
 }
 assert.deepEqual(errors,[]);console.log('hq-growth-browser: PC/mobile rest → deployment and full-slot restore passed');
} finally {await browser.close()}
