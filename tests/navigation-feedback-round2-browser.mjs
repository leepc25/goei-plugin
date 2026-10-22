// HTTP Chromium. 안내 연결 패치를 메모리에만 적용: 공용 소스/생성 HTML은 커밋하지 않는다.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { wiringPlugin } from './navigation-feedback-round2-wiring.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/codex/cua_node/lib/node_modules/playwright');
const out='out/navigation-feedback-round2';await mkdir(out,{recursive:true});
const common={bundle:true,write:false,format:'esm',loader:{'.css':'text'},plugins:[wiringPlugin]};
const built=await build({...common,entryPoints:['src/game/action/engine/demo.ts']});
const base=await readFile('dist/goei-action-game.html','utf8');
const game=base.replace(/<script type="module">[\s\S]*?<\/script>/,()=>`<script type="module">${built.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script>`);
await writeFile(`${out}/navigation-feedback-round2-game.html`,game);
const fixture=await build({...common,stdin:{resolveDir:process.cwd(),contents:`
import {Hud} from './src/game/action/ui/hud';
import {drawMiniMap} from './src/game/action/stage/runmap';
window.fixture=(compact=false)=>{
 const canvas=document.querySelector('canvas'), c=canvas.getContext('2d'),hud=new Hud();
 const s={agent:{name:'쟈알디'},hp:75,maxHp:100,gauge:100,weapon:{name:'권총',mag:3,magMax:8,reserve:24},items:[{label:'약',count:2}],floor:{depth:'L1',name:'안내 검사'},favor:0,money:{cash:0,budget:0,research:0,teeth:0},timer:{label:'생존',sec:45},meters:[{label:'가드',v:60,max:100,color:'#fff'}],status:[{label:'출혈',good:false}],boss:{name:'수호자',hp:60,max:100},compact,device:compact?'touch':'kb',message:'귀환은 다락방 로프',navigation:{objective:'열린 방을 탐색해 열쇠 ①을 찾고 잠긴 길을 여세요. 층 목표를 해결하면 패널이 켜집니다.',target:{id:'door',text:'오른쪽 출입구',kind:'locked',reason:'열쇠 ① 필요 · 열린 방을 탐색하세요'}}};
 c.fillStyle='#18232d';c.fillRect(0,0,1280,720);window.boxes=[];
 const original=c.fillText.bind(c);c.fillText=(s,x,y,...args)=>{const t=c.getTransform(),m=c.measureText(s),w=m.width;const left=c.textAlign==='right'?x-w:c.textAlign==='center'?x-w/2:x;const asc=m.actualBoundingBoxAscent||22,desc=m.actualBoundingBoxDescent||4;window.boxes.push({s,x:left*t.a+t.e,y:(y-asc)*t.d+t.f,w:w*t.a,h:(asc+desc)*t.d});original(s,x,y,...args)};
 hud.draw(c,s,1/60);
 drawMiniMap(c,{where:'floor',depth:1,room:[0,0],roomW:1280,cell:null,worlds:[],services:[],keys:[],upgrades:[],goal:s.navigation.objective,seed:1},0,0);
 c.fillText=original;
};
`}});
const fixtureHtml=`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}canvas{width:100%;max-height:100vh;object-fit:contain}</style><canvas width="1280" height="720"></canvas><script type="module">${fixture.outputFiles[0].text}</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(req.url.startsWith('/fixture')?fixtureHtml:game)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[],report=[];
try {
 for(const [name,width,height,touch] of [['pc',1280,720,false],['mobile',844,390,true],['small-mobile',667,375,true]].filter(v=>!process.env.NAV_VIEW||v[0]===process.env.NAV_VIEW)) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const interact=async()=>{if(!touch)return page.keyboard.press('KeyE');const b=await page.locator('[data-id="interact"]').boundingBox();assert.ok(b);await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);};
  await page.goto(url+'/fixture');await page.waitForFunction(()=>window.fixture);await page.evaluate(touch=>window.fixture(touch),touch);
  const boxes=await page.evaluate(()=>window.boxes);
  const relevant=boxes.filter(b=>b.s.length>2);
  for(const a of relevant) assert.ok(a.x>=-1&&a.x+a.w<=1281&&a.y>=-1&&a.y+a.h<=721,`${name}: 범위 초과 ${a.s}`);
  for(let i=0;i<relevant.length;i++) for(const b of relevant.slice(i+1)) {
   const a=relevant[i],overlap=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1;
   assert.ok(!overlap,`${name}: HUD 겹침 ${a.s} / ${b.s}`);
  }
  assert.ok(boxes.some(b=>b.s.includes('[잠김]')));assert.ok(boxes.some(b=>b.s.includes('열쇠 1번 필요')));
  await page.screenshot({path:`${out}/${name}-hud.png`});
  await page.addInitScript(()=>{const old=CanvasRenderingContext2D.prototype.fillText;window.textLog=[];CanvasRenderingContext2D.prototype.fillText=function(s,...args){window.textLog.push({s:String(s),t:performance.now()});if(window.textLog.length>1500)window.textLog.splice(0,500);return old.call(this,s,...args)};});
  await page.goto(url+`/?start=stage=elevator${touch?'&touch=1':''}`);await page.waitForFunction(()=>window.__goeiEngine?.world?.stage?.mapView);await page.waitForTimeout(350);
  // 생성된 실제 소품까지 키보드로 걷기. 도달 가능한 시작 승강기에서는 위치 주입 없음.
  const targetX=await page.evaluate(()=>window.__goeiEngine.world.props.find(p=>p.kind==='elevator').x);
  const walkTo=async(target)=>{
   const x=await page.evaluate(()=>window.__goeiEngine.world.player.x);if(Math.abs(x-target)<24)return;
   const code=x>target?'ArrowLeft':'ArrowRight',sign=x>target?-1:1;
   // 같은 브라우저 프레임에서 키를 떼어 원격 검사 지연으로 조사 범위를 지나치지 않는다.
   await page.evaluate(({target,code,sign})=>{window.walkDone=new Promise((resolve,reject)=>{const start=performance.now();const check=()=>{if(sign*(window.__goeiEngine.world.player.x-target)>=-24){window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));resolve();}else if(performance.now()-start>30000)reject(new Error('보행 시간 초과'));else requestAnimationFrame(check);};requestAnimationFrame(check);});},{target,code,sign});
   await page.keyboard.down(code);await page.evaluate(()=>window.walkDone);await page.keyboard.up(code);
  };
  await walkTo(targetX);
  await page.waitForFunction(()=>window.textLog.some(v=>v.t>performance.now()-2000&&v.s.includes('돌아갈 수 없음')));
  if(touch) {assert.equal(await page.locator('[data-id="interact"] b').innerText(),'잠김');assert.match(await page.locator('[data-id="interact"]').getAttribute('aria-label'),/돌아갈 수 없음/);}
  await page.screenshot({path:`${out}/${name}-blocked-elevator.png`});
  assert.ok(await page.evaluate(x=>Math.abs(window.__goeiEngine.world.player.x-x)<60,targetX),`${name}: 승강기 조사 거리`);
  await interact();
  await page.waitForFunction(()=>window.__goeiEngine.world.subtitle?.text.includes('귀환'));
  assert.equal(await page.evaluate(()=>window.__goeiEngine.world.ended),null);
  // 실제 해치까지 걷기 및 E/터치 조사 → 정비 구역. 벽·가구가 없는 시작 방 경로.
  const hatchX=await page.evaluate(()=>window.__goeiEngine.world.props.find(p=>['hatch','servicedoor'].includes(p.kind)).x);
  await walkTo(hatchX);
  await page.waitForFunction(()=>window.textLog.some(v=>v.t>performance.now()-2000&&/\[(E|조사)\] 출구/.test(v.s)));
  if(touch)assert.equal(await page.locator('[data-id="interact"] b').innerText(),'조사');
  await interact();
  await page.waitForFunction(()=>window.__goeiEngine.world.stage.mapView().where==='service');
  await page.screenshot({path:`${out}/${name}-service.png`});
  report.push(`${name}: HUD bounds/overlap, keyboard walk, ${touch?'touch':'E'} interaction, elevator refusal, service entry PASS`);
  await context.close();
 }
 const hq=await browser.newPage({viewport:{width:1280,height:720}});hq.on('pageerror',e=>errors.push(e.message));
 await hq.goto(url);await hq.waitForFunction(()=>window.__goeiEngine);
 await hq.getByText('새로 시작',{exact:true}).click();await hq.waitForTimeout(1500);await hq.evaluate(()=>window.__goeiStory.skip());
 await hq.waitForFunction(()=>window.__goeiEngine.world?.floor.id==='hq:office'&&!window.__goeiEngine.mods.blocking());
 const door=await hq.evaluate(()=>window.__goeiEngine.world.stage.current().doors.find(d=>d.to));
 const walk=async(key,axis,value,sign)=>{await hq.keyboard.down(key);await hq.waitForFunction(({axis,value,sign})=>sign*(window.__goeiEngine.world.player[axis]-value)>=0,{axis,value,sign},{timeout:25000});await hq.keyboard.up(key);};
 await walk('ArrowUp','y',486,-1);await walk('ArrowRight','x',door.x+78,1);await walk('ArrowDown','y',676,1);await walk('ArrowLeft','x',door.x+20,-1);
 await hq.screenshot({path:out+'/pc-hq-exit.png'});await hq.keyboard.press('KeyE');
 await hq.waitForFunction(()=>window.__goeiEngine.world.floor.id==='hq:f2',{},{timeout:5000});
 report.push('HQ: 새로 시작 → 가구를 돌아 첫 출구까지 키보드 이동 → E → 2층 복도 PASS');await hq.close();
 assert.deepEqual(errors,[]);
 console.log(report.join('\n'));await writeFile(`${out}/browser-report.json`,JSON.stringify({report,errors},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
