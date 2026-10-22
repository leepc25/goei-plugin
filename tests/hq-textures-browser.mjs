import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright');
const html=await readFile('dist/goei-action-game.html');
const server=createServer((q,r)=>{if(q.url==='/')r.end(html);else r.writeHead(404).end()});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox'],headless:true});
const results=[];const out='out/hq-textures';await mkdir(out,{recursive:true});
try {
for(const mobile of [false,true]) {
 const page=await browser.newPage({viewport:mobile?{width:844,height:390}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{
  window.artDraws=new Set();const orig=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(im,...a){if(im.src)window.artDraws.add(im.src);return orig.call(this,im,...a)};
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.getByText('새로 시작',{exact:true}).click();
 await page.waitForFunction(()=>window.__goeiEngine?.world?.floor.id==='hq:office');
 await page.waitForTimeout(1700);await page.evaluate(()=>window.__goeiStory.skip());
 await page.waitForFunction(()=>window.artDraws.has(window.__GOEI_BG_ART__.hq_office.hq_office_wall_1));
 const office=await page.evaluate(()=>{
  const bg=window.__GOEI_BG_ART__;return {wall:artDraws.has(bg.hq_office.hq_office_wall_1),desk:artDraws.has(bg.hq_office['objects/hq_office_objects_1'])};
 });assert.ok(office.wall&&office.desk);
 await page.screenshot({path:`${out}/${mobile?'mobile':'pc'}-office.png`});
 const door=await page.evaluate(()=>__goeiEngine.world.stage.current().doors.find(d=>d.to));
 async function walk(key,axis,value,sign){await page.keyboard.down(key);await page.waitForFunction(({axis,value,sign})=>sign*(__goeiEngine.world.player[axis]-value)>=0,{axis,value,sign},{timeout:20000});await page.keyboard.up(key)}
 await walk('ArrowUp','y',486,-1);await walk('ArrowRight','x',door.x+78,1);await walk('ArrowDown','y',676,1);await walk('ArrowLeft','x',door.x+20,-1);await page.keyboard.press('KeyE');
 await page.waitForFunction(()=>__goeiEngine.world.floor.id==='hq:f2');await page.waitForTimeout(500);
 const corridor=await page.evaluate(()=>({wall:artDraws.has(__GOEI_BG_ART__.hq_corridor.hq_corridor_wall_2),door:artDraws.has(__GOEI_HQ_DOOR_ROUND2__.frame)}));
 assert.ok(corridor.wall&&corridor.door);assert.deepEqual(errors,[]);
 await page.screenshot({path:`${out}/${mobile?'mobile':'pc'}-corridor.png`});
 results.push({mobile,office,corridor,errors});await page.close();
}
}finally{await browser.close();await new Promise(r=>server.close(r))}
await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
