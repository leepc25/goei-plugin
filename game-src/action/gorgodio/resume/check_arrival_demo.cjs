const { chromium } = require('C:/Users/leepc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const here=__dirname, root=path.resolve(here,'../../../..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const rows=[];
 for(const [name,width,height] of [['pc',1280,900],['phone',390,844],['landscape',844,390]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:name!=='pc'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'release/demo/gorgodio-resume.html')).href);
  await page.waitForFunction(()=>Object.values(imgs).every(im=>im.complete&&im.naturalWidth>0));
  const info=await page.evaluate(()=>({job:M.clips.a_arrive.job_id,count:M.clips.a_arrive.frames,stripWidth:imgs.a_arrive.naturalWidth,overflow:document.documentElement.scrollWidth>innerWidth}));
  if(info.job!=='7282832d-aa8a-4969-b050-096a6a4832ed'||info.count!==8||info.stripWidth!==2048||info.overflow)throw Error(JSON.stringify(info));
  await page.keyboard.press('KeyD');
  await page.waitForFunction(()=>G.clip==='a_arrive',{},{timeout:5000});
  await page.waitForFunction(()=>G.armor&&G.clip==='a_idle',{},{timeout:5000});
  const before=await page.evaluate(()=>G.x);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(400);await page.keyboard.up('ArrowRight');
  if((await page.evaluate(()=>G.x))<=before)throw Error('Movement failed');
  await page.keyboard.press('KeyA');
  await page.waitForFunction(()=>G.clip==='a_swat',{},{timeout:3000});
  await page.evaluate(()=>{G.armor=true;play('a_arrive',{lock:true});G.f=0;});
  await page.screenshot({path:path.join(here,'arrival-v2',`browser-${name}.png`),fullPage:false});
  if(errors.length)throw Error(errors.join('\n'));
  rows.push({name,width,height,...info,errors,result:'pass',tested:['new eight-frame strip','D body to armor transition','movement','armor attack']});
  await page.close();
 }
 await browser.close();
 fs.writeFileSync(path.join(here,'arrival-v2','browser-check.json'),JSON.stringify(rows,null,2));
 console.log(JSON.stringify(rows));
})().catch(e=>{console.error(e);process.exit(1)});
