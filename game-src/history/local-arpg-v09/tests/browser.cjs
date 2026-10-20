const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}));
const root=path.join(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'output/Jyaldi_ARPG.html')).href);
  await page.waitForFunction(()=>window.JyaldiLab?.renderer);
  await page.evaluate(()=>{const a=JyaldiLab;a.world.dummyMode=true;a.world.enemies=[];window.motionTrace=[];const watch=()=>{const p=a.world.player;motionTrace.push({action:p.action,pose:JyaldiEngine.poseFor(p),t:p.t,x:p.x});if(motionTrace.length<800)requestAnimationFrame(watch);};requestAnimationFrame(watch);});
  await page.locator('.jy-stage').focus();
  for(let i=0;i<3;i++){await page.keyboard.press('z');await page.waitForTimeout(55);}
  await page.waitForFunction(()=>JyaldiLab.world.player.action==='finish'&&JyaldiEngine.poseFor(JyaldiLab.world.player)===86,{},{timeout:5000,polling:'raf'});
  await page.screenshot({path:path.join(root,'output/browser-heavy-impact.png')});
  await page.waitForTimeout(650);
  const combo=await page.evaluate(()=>motionTrace.filter(p=>['jab','cross','finish'].includes(p.action)));
  for(const a of ['jab','cross','finish'])assert(combo.some(p=>p.action===a));
  assert(combo.some(p=>p.action==='finish'&&p.pose===86));
  await page.evaluate(()=>{JyaldiLab.world.reset();JyaldiLab.world.dummyMode=true;JyaldiLab.world.enemies=[];motionTrace.length=0;});
  await page.keyboard.down('ControlLeft');await page.waitForTimeout(350);
  const crouch=await page.evaluate(()=>{const a=JyaldiLab,p=a.world.player,f=a.renderer.meta.frames[JyaldiEngine.poseFor(p)];return {action:p.action,height:f.h,pose:JyaldiEngine.poseFor(p)};});
  assert.equal(crouch.action,'crouch');
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(1100);await page.screenshot({path:path.join(root,'output/browser-crouch-moving.png')});await page.keyboard.up('ArrowRight');
  const moving=await page.evaluate(()=>motionTrace.filter(p=>p.action==='crouch_walk').map(p=>({pose:p.pose,height:JyaldiLab.renderer.meta.frames[p.pose].h})));
  assert(moving.length>10);assert(new Set(moving.map(p=>p.pose)).size>=6);
  assert(moving.every(p=>Math.abs(p.height-crouch.height)<=7),'Moving crouch changes body height');
  await page.screenshot({path:path.join(root,'output/browser-crouch.png')});
  await page.keyboard.up('ControlLeft');await page.waitForTimeout(350);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>JyaldiLab.world.player.action),'walk');
  await page.keyboard.down('ShiftLeft');await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>JyaldiLab.world.player.action),'run');
  await page.screenshot({path:path.join(root,'output/browser-run.png')});
  await page.keyboard.up('ArrowRight');await page.keyboard.up('ShiftLeft');
  const wholeBody=await page.evaluate(()=>{const m=JyaldiLab.renderer.meta;return {noLimbRig:!m.armRig&&!m.crouchRig,actions:['combat','jab','cross','finish','walk','run','crouch_walk','low_attack'].map(action=>({action,full:JyaldiEngine.MOTIONS[action].poses.every(id=>m.frames[id].wholeBody)}))};});
  assert(wholeBody.noLimbRig&&wholeBody.actions.every(a=>a.full));
  assert.deepEqual(errors,[]);
  const report={method:'Actual Chrome headless, offline file URL, real keyboard events and Canvas2D',checks:['three quick Z presses reach weak weak heavy','heavy extension is visible as pose86','moving crouch keeps standing-crouch scale','crouched walking cycles at least six poses','walk switches to run with Shift','core actions use complete full-body drawings with no limb rig','no browser page errors'],wholeBody,crouch,movingHeights:[...new Set(moving.map(p=>p.height))],screenshots:['browser-heavy-impact.png','browser-crouch.png','browser-crouch-moving.png','browser-run.png']};
  fs.writeFileSync(path.join(root,'output/browser-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
