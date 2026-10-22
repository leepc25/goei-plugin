// Read-only capture of a built integration checkout; no game source changes.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/codex/cua_node/lib/node_modules/playwright');
const root=path.dirname(fileURLToPath(import.meta.url));
const build=process.env.HQ_REVIEW_BUILD||'/tmp/hq-door-current/dist/goei-action-game.html';
const out=path.join(root,'review');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
  if(req.url.endsWith('/timing.json'))return res.end(JSON.stringify({ms:[400]}));
  if(req.url.endsWith('.png')){res.setHeader('Content-Type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>');}
  res.setHeader('Content-Type','text/html');res.end(await readFile(build));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>window.__goeiEngine);
  await page.getByText('새로 시작',{exact:true}).click();
  await page.waitForTimeout(1500);await page.evaluate(()=>window.__goeiStory.skip());
  await page.waitForFunction(()=>window.__goeiEngine.world?.floor.id==='hq:office'&&!window.__goeiEngine.mods.blocking());
  const door=await page.evaluate(()=>window.__goeiEngine.world.stage.current().doors.find(d=>d.to));
  const walk=async(key,axis,value,sign)=>{
    await page.keyboard.down(key);
    await page.waitForFunction(({axis,value,sign})=>sign*(window.__goeiEngine.world.player[axis]-value)>=0,{axis,value,sign},{timeout:20000});
    await page.keyboard.up(key);
  };
  await walk('ArrowUp','y',486,-1);await walk('ArrowRight','x',door.x+78,1);
  await walk('ArrowDown','y',676,1);await walk('ArrowLeft','x',door.x+20,-1);
  await page.screenshot({path:path.join(out,'current-office.png')});
  await page.keyboard.press('KeyE');
  await page.waitForFunction(()=>window.__goeiEngine.world.floor.id==='hq:f2',{timeout:3000});
  await page.waitForTimeout(600);
  // Move the existing actor off the doorway so the original frame is visible.
  const clearX=await page.evaluate(()=>window.__goeiEngine.world.stage.current().doors.find(d=>d.id==='office').x+240);
  await walk('ArrowRight','x',clearX,1);
  await page.waitForTimeout(300);
  const captured=await page.evaluate(()=>{
    const w=window.__goeiEngine.world;
    const d=w.stage.current().doors.find(d=>d.id==='office'&&d.kind==='glass');
    const camX=Math.round(w.camX);
    const canvas=[...document.querySelectorAll('canvas')].find(c=>c.width===1280&&c.height===720);
    const original=canvas.toDataURL('image/png');
    // Real drawBackground at the captured camera; omit only the target door
    // during this offscreen call, then restore immediately. No wall painting.
    const scene=w.stage.current(), at=scene.doors.indexOf(d);
    const background=document.createElement('canvas');background.width=1280;background.height=720;
    const c=background.getContext('2d');c.translate(-camX,0);
    scene.doors.splice(at,1);
    try{w.floor.drawBackground(c,camX)}finally{scene.doors.splice(at,0,d)}
    return {original,background:background.toDataURL('image/png'),scene:w.floor.id,camX,
      door:d,player:{x:w.player.x,y:w.player.y},canvas:{width:canvas.width,height:canvas.height},
      screenDoorX:d.x-camX,thresholdY:440,arrivalY:486};
  });
  for(const key of ['original','background']){
    await writeFile(path.join(out,`current-${key}.png`),Buffer.from(captured[key].split(',')[1],'base64'));delete captured[key];
  }
  await page.screenshot({path:path.join(out,'current-pc.png')});
  captured.errors=errors;captured.sourceCommit=process.env.HQ_REVIEW_COMMIT||'7f8fdfb0c5a6cef096d412d3d872aec6eae7de81';
  captured.captureMethod='Keyboard office → corridor; original game canvas + offscreen real drawBackground without f2.office only';
  await writeFile(path.join(out,'scene.json'),JSON.stringify(captured,null,2)+'\n');
  if(errors.length)throw Error(errors.join('\n'));
  console.log(JSON.stringify(captured,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
