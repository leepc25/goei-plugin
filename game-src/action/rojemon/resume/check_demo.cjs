const { chromium }=require('C:/Users/leepc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('path');const fs=require('fs');const {pathToFileURL}=require('url');
(async()=>{
 const root=path.resolve(__dirname,'../../../..'),out=path.join(__dirname,'live');
 const browser=await chromium.launch({headless:true,channel:'msedge'});const errors=[];const results=[];
 for(const [name,width,height,mobile] of [['desktop',1440,1000,false],['mobile',844,390,true]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'release/demo/rojemon-resume.html')).href);
  await page.waitForFunction(()=>typeof loaded!=='undefined'&&loaded===total);
  await page.waitForFunction(()=>document.querySelector('#reviewFrame').textContent.length>0);
  const embedded=await page.evaluate(()=>Object.fromEntries(Object.keys(ROJEMON_REVIEW).map(k=>[k,{fw:M.clips[k].fw,fh:M.clips[k].fh,frames:M.clips[k].frames,stripWidth:imgs[k].naturalWidth}])));
  for(const [k,v] of Object.entries(embedded))if(v.fw!==256||v.fh!==160||v.stripWidth!==v.fw*v.frames)throw Error('bad strip '+k);
  await page.locator('#reviewNext').click();const paused=await page.locator('#reviewFrame').textContent();
  await page.waitForTimeout(180);if(paused!==await page.locator('#reviewFrame').textContent())throw Error('frame step did not pause');
  await page.waitForFunction(()=>!G.lock&&!G.down);
  await page.keyboard.press('k');await page.waitForFunction(()=>G.clip==='down'&&G.f===6&&G.lying);
  const down=await page.evaluate(()=>({clip:G.clip,frame:G.f,lying:G.lying,frames:M.clips.down.frames}));
  if(down.clip!=='down'||down.frame!==6)throw Error('new down playback '+JSON.stringify(down));
  await page.locator('#screen').screenshot({path:path.join(out,name+'-down.png')});
  const transition=await page.evaluate(()=>{
    const d=M.clips.down,g=M.clips.getup;
    function pixels(im,f,c){const cv=document.createElement('canvas');cv.width=c.fw;cv.height=c.fh;const cx=cv.getContext('2d');cx.drawImage(im,f*c.fw,0,c.fw,c.fh,0,0,c.fw,c.fh);return Array.from(cx.getImageData(0,0,cv.width,cv.height).data).join(',')}
    return {identical:pixels(imgs.down,d.frames-1,d)===pixels(imgs.getup,0,g),sameAnchor:d.anc===g.anc&&d.feet.at(-1)===g.feet[0]};
  });
  if(!transition.identical||!transition.sameAnchor)throw Error('down/getup seam mismatch');
  await page.keyboard.press('k');await page.waitForTimeout(120);
  if(await page.evaluate(()=>G.clip)!=='getup')throw Error('getup not triggered');
  await page.locator('#screen').screenshot({path:path.join(out,name+'-getup.png')});
  if(embedded.man_throw){
   await page.locator('#reviewClip').selectOption('man_throw');await page.locator('#reviewNext').click();
   await page.evaluate(()=>{MAN.state='demo';anim(MAN,'man_throw');MAN.x=G.x+120;MAN.z=G.z;MAN.dir=1;MAN.hooked=false});
   await page.waitForFunction(()=>MAN.f>=4);await page.locator('#screen').screenshot({path:path.join(out,name+'-throw.png')});
  }
  if(mobile){await page.locator('#padt').check();const button=page.locator('button[data-k="KeyK"]');if(!await button.isVisible())throw Error('touch controls missing');}
  results.push({name,embedded,down,transition,reviewStepPaused:true,horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
  await context.close();
 }
 await browser.close();if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
})().catch(e=>{console.error(e);process.exit(1)});
