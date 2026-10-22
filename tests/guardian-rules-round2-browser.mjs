// 실행: GUARDIAN_GAME_HTML=/tmp/guardian-round2-verify/dist/goei-action-game.html node tests/guardian-rules-round2-browser.mjs
// 회색 상자 fixture: 실제 World/Input/Enemy를 사용한다. stage/HQ 연결 검증과 구분한다.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright');
const artifactDir=process.env.GUARDIAN_ARTIFACT_DIR || '/tmp/guardian-rules-round2-browser';
await mkdir(artifactDir,{recursive:true});
const fixture=await build({stdin:{resolveDir:process.cwd(),contents:`
import { World } from './src/game/action/engine/world';
import { Input } from './src/game/action/engine/input';
import { createEnemy, signalEnemies } from './src/game/action/enemy';
import { bumpIds } from './src/game/action/enemy/enemy';
const input=new Input(); input.attach();
// 별도 회귀에서 재현한 공용 ID 충돌을 이 행동 fixture와 분리한다.
bumpIds(100000);
let w, events;
window.setup=(kind)=>{
 input.clear(); input.sample();
 w=new World({seed:42,agent:'jyaldi'},{});
 w.enterFloor({id:'guardian-browser-round2',title:kind,type:'replica',depth:5,length:2400,lane:[440,690],startX:100,exitX:Infinity,encounters:[],props:kind==='elder'?[{id:'meal',kind:'table',x:700,y:565,w:80,h:40}]:[]});
 events=[];w.on(e=>events.push(structuredClone(e)));
 w.add(createEnemy(kind,700,565,()=>.9));
 w.interactHooks.push(prop=>{
   // 기존 엔진과 같은 일반 E 신호. childDoor는 성공한 아이 방 잠금 해제만 보낸다.
   signalEnemies(w,{kind:'door',x:w.player.x,y:w.player.y});
   if(prop?.kind==='table') signalEnemies(w,{kind:'mealThanks'});
 });
 window.world=w;window.events=events; window.step(12);
};
window.step=(n=1)=>{for(let i=0;i<n;i++)w.step(input.sample());window.draw()};
window.childDoor=()=>signalEnemies(w,{kind:'childDoor'});
window.draw=()=>{
 const ctx=document.querySelector('canvas').getContext('2d');ctx.fillStyle='#17202a';ctx.fillRect(0,0,1280,720);
 ctx.font='20px sans-serif';ctx.fillStyle='#fff';ctx.fillText('수호자 회귀 · 캐릭터 자산 없는 판정 시험',30,45);
 for(const b of [w.player,...w.bodies]){ctx.fillStyle=b===w.player?'#72d6c9':'#c6a2de';ctx.fillRect(b.x-15,b.y-b.z-65,30,65);ctx.fillText(b.kind+' '+b.hp,b.x-40,b.y-b.z-80)}
 document.querySelector('pre').textContent=JSON.stringify({tick:w.tick,playerHP:w.player.hp,events:events.filter(e=>e.type==='custom'||e.type==='enemyDie').slice(-8)},null,2);
};
`},bundle:true,format:'iife',write:false,logLevel:'error'});
const server=createServer(async(req,res)=>{
 try {
  if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');return res.end(fixture.outputFiles[0].text)}
  if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><meta charset="utf-8"><canvas width="1280" height="720"></canvas><pre></pre><script src="/fixture.js"></script>')}
  res.setHeader('Content-Type','text/html');res.end(await readFile(process.env.GUARDIAN_GAME_HTML || 'dist/goei-action-game.html'));
 }catch(e){res.statusCode=500;res.end(String(e))}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
const result={checks:[],errors:[]};
try {
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>result.errors.push(String(e)));
 const url='http://127.0.0.1:'+server.address().port;
 await page.goto(url);await page.waitForFunction(()=>window.__goeiEngine);
 await page.getByText('새로 시작',{exact:true}).click();await page.waitForTimeout(1200);
 await page.evaluate(()=>window.__goeiStory.skip());
 await page.waitForFunction(()=>window.__goeiEngine.world?.floor.id==='hq:office');
 result.checks.push('빌드한 단일 HTML: 새로 시작 → 본부 World');
 await page.goto(url+'/fixture');
 await page.evaluate(()=>window.setup('elder'));
 await page.keyboard.down('ArrowRight');
 await page.evaluate(()=>{while(world.player.x<670)window.step()});
 await page.keyboard.up('ArrowRight');await page.keyboard.press('KeyE');await page.evaluate(()=>window.step(80));
 const peace=await page.evaluate(()=>({events,remaining:world.bodies.filter(b=>b.kind.startsWith('elder_')).length}));
 assert.equal(peace.remaining,0);assert.equal(peace.events.filter(e=>e.type==='enemyDie').length,0);
 assert.equal(peace.events.filter(e=>e.name==='guardianCleared'&&e.data.how==='rule').length,1);
 result.checks.push('실제 방향키로 밥상 접근 → E → 노부부 소멸, 규칙 통과 1회·처치 0');
 await page.evaluate(()=>{window.setup('family208');world.player.x=500;window.step(225);const m=world.bodies.find(b=>b.kind==='family_m');world.player.x=m.x+210;world.player.y=m.y;world.player.dir=-1;});
 const hp=await page.evaluate(()=>world.bodies.find(b=>b.kind==='family_m').hp);
 // 첫 S는 총 뽑기, 두 번째 S가 발사다.
 await page.keyboard.press('KeyS');await page.evaluate(()=>window.step(32));
 await page.keyboard.press('KeyS');await page.evaluate(()=>window.step(24));
 assert.equal(await page.evaluate(()=>world.bodies.find(b=>b.kind==='family_m').hp),hp);
 assert.ok(await page.evaluate(()=>events.some(e=>e.type==='shot')));
 assert.ok(await page.evaluate(()=>world.fxs.some(f=>f.text==='비틀거릴 뿐')),'실제 총알이 아저씨에게 닿아 면역 반응');
 await page.keyboard.press('KeyE');await page.evaluate(()=>window.step());
 assert.equal(await page.evaluate(()=>events.filter(e=>e.name==='ruleKept').length),0);
 await page.evaluate(()=>{window.childDoor();window.step(149)});
 assert.ok(await page.evaluate(()=>world.bodies.filter(b=>b.kind.startsWith('family_')).every(b=>b.state==='stunned')));
 await page.evaluate(()=>window.step(2));
 assert.ok(await page.evaluate(()=>world.bodies.filter(b=>b.kind.startsWith('family_')).every(b=>b.state!=='stunned')));
 result.checks.push('208호 실제 S 총격 무피해·일반 E 무효·childDoor 150틱 후 전투 재개');
 for(const jump of [false,true]){
  await page.evaluate(()=>{window.setup('proctor');window.step(288);const e=world.bodies.find(b=>b.kind==='proctor');world.player.x=e.x+130;world.player.y=e.y;window.step(22)});
  if(jump)await page.keyboard.press('Space');
  const before=await page.evaluate(()=>world.player.hp);
  await page.evaluate(()=>window.step(30));
  const lost=before-await page.evaluate(()=>world.player.hp);
  if(jump)assert.equal(lost,0);else assert.equal(lost,6);
 }
 result.checks.push('감독관 호루라기: 지상 피해 6 / 실제 Space 점프 피해 0');
 await page.screenshot({path:artifactDir+'/guardian-rules-round2.png'});
 assert.deepEqual(result.errors,[]);
 await writeFile(artifactDir+'/guardian-rules-round2.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r))}
