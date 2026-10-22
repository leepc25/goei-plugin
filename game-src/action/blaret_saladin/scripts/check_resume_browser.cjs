const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'../../../..'),out=path.join(__dirname,'../resume/browser');
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:process.env.BS_BROWSER_CHANNEL||'msedge'});
 const errors=[],results=[];
 for(const [name,width,height]of [['pc',1280,900],['mobile-landscape',844,390],['mobile-portrait',390,844]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:name!=='pc',hasTouch:name!=='pc'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'release/demo/blaret-saladin-resume.html')).href);
  await page.waitForFunction(()=>typeof reviewState==='function'&&DATA.length===6&&DATA.every(c=>c.image.complete&&c.image.naturalWidth&&(!c.old||c.before.complete)));
  const geometry=await page.evaluate(()=>{
   const bad=[];let checked=0;
   for(let i=0;i<DATA.length;i++){
    pick(i);playing=false;
    const c=DATA[i],off=document.createElement('canvas');off.width=256*c.frames;off.height=176;
    const ctx=off.getContext('2d',{willReadFrequently:true});ctx.drawImage(c.image,0,0);
    const a=ctx.getImageData(0,0,off.width,176).data;
    for(let n=0;n<c.frames;n++){
     let left=256,right=-1,top=176,bottom=-1;
     for(let y=0;y<176;y++)for(let x=0;x<256;x++)if(a[(y*off.width+n*256+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
     for(const compare of [false,true])for(const travel of [false,true])for(const flipped of [false,true]){
      $('compare').checked=compare;$('travel').checked=travel;$('flip').checked=flipped;fi=n;render();
      const W=$('stage').width,H=$('stage').height,k=(H<300||W<600||(compare&&W<1000))?1:2,anchor=W*(compare?.55:.35),progress=c.root?.per_frame?.[n]||0,dir=flipped?-1:1,dx=travel?-dir*progress*k:0;
      const xx=[anchor+dx+dir*(left-96)*k,anchor+dx+dir*(right+1-96)*k];
      if(Math.min(...xx)<0||Math.max(...xx)>W||H-24+(top-168)*k<0||H-24+(bottom+1-168)*k>H)bad.push({key:c.key,n,compare,travel,flipped,xx});
      checked++;
     }
    }
   }
   return {checked,bad};
  });
  if(geometry.bad.length)throw Error(name+' clipped artwork '+JSON.stringify(geometry.bad));
  const count=await page.locator('#list button').count();
  for(let i=0;i<count;i++){
   await page.locator('#list button').nth(i).click();
   await page.evaluate(()=>{playing=false;fi=DATA[cur].frames-1;$('compare').checked=true;$('travel').checked=false;$('hands').checked=false;$('flip').checked=false;render()});
   await page.screenshot({path:path.join(out,name+'-last-'+i+'.png'),fullPage:true});
   const state=await page.evaluate(()=>{const c=DATA[cur];rootX=0;step(1);return {fi,rootX,expected:c.root?.cycle_dx||0}});
   if(state.fi!==0||Math.abs(state.rootX-state.expected)>1e-6)throw Error('Loop root wrap mismatch');
  }
  await page.locator('#move').click();await page.locator('#travel').check();
  await page.evaluate(()=>{playing=false;fi=0});
  await page.locator('#next').click();const a=await page.evaluate(()=>reviewState());
  await page.locator('#next').click();const b=await page.evaluate(()=>reviewState());
  if(a.fi===b.fi)throw Error('Frame step failed');
  await page.locator('#attack').click();
  if(await page.evaluate(()=>DATA[cur].key!=='saladin-slash1'))throw Error('Attack button failed');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error(name+' horizontal overflow');
  await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
  results.push({name,width,height,clips:count,all_frame_geometry_checks:geometry.checked,loop_root_wrap:true,frame_step:true,horizontal_overflow:false});
  await page.close();
 }
 await browser.close();if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
})().catch(e=>{console.error(e);process.exit(1)});
