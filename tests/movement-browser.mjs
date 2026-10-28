// 실제 Game/Input/World/Player/Renderer와 현재 아틀라스를 사용한 격리된 이동 검사.
// Playwright와 Chromium 필요. 장면만 고정하며 키보드 입력을 우회하지 않는다.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
const require=createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')); } catch { ({ chromium } = require('/opt/codex/cua_node/lib/node_modules/playwright')); }
const fixture=await build({stdin:{contents:`
import {Game} from './src/game/action/engine/game';
import {loadArt} from './src/game/action/engine/art';
import {blockByProps} from './src/game/action/engine/propBlock';
const stage={id:'movement',label:'이동 검사',firstFloor:()=>({id:'movement',title:'이동 검사',length:4000,startX:500,lane:[470,690],encounters:[],props:[],exitX:Infinity,drawBackground(c,cam){c.fillStyle='#17212a';c.fillRect(0,0,4000,720);c.fillStyle='#4f5960';c.fillRect(0,440,4000,280);c.strokeStyle='#879199';for(let x=0;x<4000;x+=100){c.beginPath();c.moveTo(x,440);c.lineTo(x,720);c.stroke()}}}),nextFloor:()=>null};
loadArt(async f=>'/art/'+f).then(art=>{
 const game=new Game(document.body,art,{stages:[stage],hud:false,onWorld(w){w.hooks.push(()=>{if(window.wall)blockByProps([w.player],[window.wall],w.lane)})}});
 window.game=game;game.start();game.start_new('movement');
});
`,resolveDir:process.cwd()},bundle:true,format:'iife',write:false,loader:{'.css':'text'}});
const server=createServer(async(req,res)=>{
 try{
  if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');return res.end(fixture.outputFiles[0].text)}
  if(req.url?.startsWith('/art/')){const file=req.url.slice(5);if(!['atlas.png','cutin.png','frames.json'].includes(file))return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.json')?'application/json':'image/png');return res.end(await readFile('game-pack/jyaldi/'+file))}
  res.end('<html><body style="margin:0;overflow:hidden;background:#17212a"><script src="/fixture.js"></script></body></html>');
 }catch(e){res.writeHead(500).end(String(e))}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
const errors=[],shots=process.env.SHOTS;
if(shots)await mkdir(shots,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.game?.world);
 const state=()=>page.evaluate(()=>{const w=window.game.world,p=w.player;return {x:p.x,y:p.y,dir:p.dir,anim:p.anim(),vx:p.vx,vy:p.vy,tick:w.tick}});
 let before=await state();await page.keyboard.down('ArrowRight');await page.waitForTimeout(500);let after=await state();
 assert.equal(after.anim.clip,'walk');assert.equal(after.x-before.x,(after.tick-before.tick)*9);
 if(shots)await page.screenshot({path:shots+'/walk.png'});
 await page.keyboard.up('ArrowRight');await page.waitForTimeout(100);let stopped=await state();assert.equal(stopped.anim.clip,'idle');await page.waitForTimeout(200);assert.equal((await state()).x,stopped.x);
 await page.keyboard.down('Shift');await page.keyboard.down('ArrowRight');await page.waitForTimeout(400);assert.equal((await state()).anim.clip,'run');await page.keyboard.up('ArrowRight');await page.keyboard.up('Shift');await page.waitForTimeout(120);
 // 가구와 같은 blockByProps로 걷는 깊이를 덮는 벽. 입력 속도가 남아도 위치는 멈춘다.
 await page.evaluate(()=>{const p=window.game.world.player;window.wall={x:p.x+100,y:700,w:80,back:240,front:0}});
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(500);stopped=await state();await page.waitForTimeout(350);after=await state();
 assert.equal(after.x,stopped.x);assert.equal(after.anim.clip,'idle');assert.ok(after.vx>0,'入力が消えたのでなく衝突で停止');
 if(shots)await page.screenshot({path:shots+'/blocked.png'});
 await page.keyboard.up('ArrowRight');await page.keyboard.down('ArrowLeft');await page.waitForTimeout(180);after=await state();assert.ok(after.x<stopped.x);assert.equal(after.dir,-1);assert.equal(after.anim.clip,'walk');
 await page.keyboard.up('ArrowLeft');await page.waitForTimeout(120);assert.equal((await state()).anim.clip,'idle');
 assert.deepEqual(errors,[]);console.log('PASS Chromium: 걷기/달리기/정지/가구 충돌/반대 방향 이탈. 기본 이동속도 유지, 막힌 상태의 제자리 보행 제거.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
