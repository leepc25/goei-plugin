// 실제 본부 첫 방을 걸어서 나가기 + 지연된 컷 로딩 중 시간/자막 보존.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/codex/cua_node/lib/node_modules/playwright');
const fixture=await build({stdin:{contents:`import {VideoPlayer} from './src/game/action/story/video';window.video=new VideoPlayer(document.body);`,resolveDir:process.cwd()},bundle:true,format:'iife',write:false,loader:{'.css':'text'}});
const server=createServer(async(req,res)=>{
 if(req.url==='/fixture')return res.end('<body><script src="/fixture.js"></script>');
 if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');return res.end(fixture.outputFiles[0].text)}
 if(req.url?.endsWith('/timing.json'))return res.end(JSON.stringify({ms:[400]}));
 if(req.url?.endsWith('.png')){
  if(req.url.includes('/c2/'))await new Promise(r=>setTimeout(r,1500));
  res.setHeader('Content-Type','image/svg+xml');return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="${req.url.includes('/c1/')?'red':req.url.includes('/c2/')?'blue':'green'}"/></svg>`);
 }
 res.setHeader('Content-Type','text/html');res.end(await readFile('dist/goei-action-game.html'));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url);await page.waitForFunction(()=>window.__goeiEngine);
 await page.getByText('새로 시작',{exact:true}).click();await page.waitForTimeout(1500);await page.evaluate(()=>window.__goeiStory.skip());
 await page.waitForFunction(()=>window.__goeiEngine.world?.floor.id==='hq:office'&&!window.__goeiEngine.mods.blocking());
 const door=await page.evaluate(()=>window.__goeiEngine.world.stage.current().doors.find(d=>d.to));
 // 위치 주입 없이 가구 뒤 통로 → 문 오른쪽 빈자리 → 남쪽 출입구로 걷는다.
 const walk=async(key,axis,value,sign)=>{
  await page.keyboard.down(key);
  await page.waitForFunction(({axis,value,sign})=>sign*(window.__goeiEngine.world.player[axis]-value)>=0,{axis,value,sign},{timeout:20000});
  await page.keyboard.up(key);
 };
 await walk('ArrowUp','y',486,-1);
 await walk('ArrowRight','x',door.x+78,1);
 await walk('ArrowDown','y',676,1);
 await walk('ArrowLeft','x',door.x+20,-1);
 await page.keyboard.press('KeyE');
 await page.waitForFunction(()=>window.__goeiEngine.world.floor.id==='hq:f2',{timeout:3000});
 await page.waitForTimeout(400);
 const arrivalX=await page.evaluate(()=>window.__goeiEngine.world.player.x);
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(400);await page.keyboard.up('ArrowRight');
 assert.ok(await page.evaluate(()=>window.__goeiEngine.world.player.x)>arrivalX,'복도 도착 후 이동 입력 재개');
 await page.screenshot({path:'/workspace/goei-hq-door-fixed.png'});
 console.log('PASS 새로 시작 → 첫 방 가구를 돌아 문까지 걷기 → E → 2층 복도');
 await page.goto(url+'/fixture');
 await page.evaluate(()=>{
  window.drawn=[];window.done=0;const draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(img,...a){window.drawn.push(img.src);return draw.call(this,img,...a)};
  void window.video.play('/video/',[.4,.4,.4],[{t:.4,text:'두 번째 컷'}],()=>window.done++);
 });
 await page.waitForFunction(()=>window.drawn.length===1);
 await page.waitForTimeout(650);
 assert.equal(await page.evaluate(()=>window.done),0,'다음 컷 로딩 중 조기 종료 안 함');
 assert.equal(await page.locator('.gsy-vloading').isVisible(),true);
 assert.equal(await page.locator('.gsy-vsub').isVisible(),false,'자막도 다음 컷보다 먼저 진행 안 함');
 await page.waitForFunction(()=>window.done===1,{},{timeout:6000});
 const drawn=await page.evaluate(()=>window.drawn.map(s=>s.match(/c\d/)[0]));
 assert.deepEqual(drawn,['c1','c2','c3'],'각 컷을 빠짐없이 표시하고 같은 그림 재출력 안 함');
 await page.evaluate(()=>{void window.video.play('/video/',[.4,.4,.4],[],()=>window.done++);window.video.finish()});
 await page.waitForTimeout(1800);assert.equal(await page.evaluate(()=>window.done),2,'로딩 중 건너뛰기 콜백 한 번');
 assert.deepEqual(errors,[]);console.log('PASS 컷 지연: 화면·자막 대기, 3컷 순서 보존, 중복 draw 제거, 로딩 중 건너뛰기');
}finally{await browser.close();await new Promise(r=>server.close(r))}
