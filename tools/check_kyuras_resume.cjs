const {chromium}=require(process.env.CODEX_NODE_MODULES+'/playwright');
const fs=require('fs'),path=require('path');
(async()=>{
const root=path.resolve(__dirname,'..');const out=path.join(root,'game-src/action/kyuras/resume/browser');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report=[];
for(const [name,width,height] of [['pc',1280,900],['mobile',844,390]]){
 const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.join(root,'release/demo/kyuras-full.html').replaceAll('\\','/'));await page.waitForFunction(()=>loaded===total);
 await page.selectOption('#bg','grey');await page.uncheck('#rim');
 for(const clip of ['snap1','snap2','snap3','idle_pipe','walk_pipe','shotgun','idle_shotgun','run_shotgun']){
  if(!await page.locator(`#reviewClip option[value="${clip}"]`).count())continue;
  await page.selectOption('#reviewClip',clip);await page.check('#reviewPause');
  const frames=await page.evaluate(()=>C().frames);
  for(let f=0;f<frames;f++){
   await page.evaluate(f=>{G.f=f;draw();},f);await page.locator('#c').screenshot({path:path.join(out,`${name}-${clip}-${f}.png`)});
  }
  await page.evaluate(()=>{G.f=C().frames-1;});await page.click('#reviewNext');
  const wrapped=await page.evaluate(()=>G.f===0);report.push({viewport:name,clip,frames,lastToFirst:wrapped});
 }
 await page.selectOption('#reviewClip','');await page.keyboard.down('ArrowRight');await page.waitForTimeout(300);await page.keyboard.up('ArrowRight');
 const motion=await page.evaluate(()=>({clip:G.clip,x:G.x,loaded,total}));await page.screenshot({path:path.join(out,name+'-play.png')});report.push({viewport:name,errors,motion,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});await page.close();
}
await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})();
