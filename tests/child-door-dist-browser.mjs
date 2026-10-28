// 빌드한 단일 HTML 그대로 검증. 출동/가족방 배치와 일반 적 처치·무적만 fixture로 설정한다.
// 규칙 읽기·이동·전투 시작·열쇠 줍기·문 열기는 게임 루프와 실제 키/터치 입력을 사용한다.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const html=await readFile(process.env.GAME_HTML||'dist/goei-action-game.html');
const output=process.env.SHOTS||'out/child-door-dist';await mkdir(output,{recursive:true});
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
const results=[],errors=[];
try{
 for(const phone of [false,true]){
  const viewport=phone?{width:844,height:390}:{width:1280,height:720};
  const context=await browser.newContext({viewport,hasTouch:phone,isMobile:phone});const page=await context.newPage();
  page.on('pageerror',e=>errors.push(String(e)));
  // 시연판은 제목 화면(일시정지 상태)으로 열린다: ?start=stage=elevator 로 바로 출동 화면에서 시작 (제목이 떠 있으면 paused 라 대화 종료를 영원히 기다림)
  await page.goto(`http://127.0.0.1:${server.address().port}/?start=stage=elevator`);await page.waitForFunction(()=>window.__goeiEngine?.world&&window.__goeiStory);
  const setup=await page.evaluate(()=>{
   const g=window.__goeiEngine;g.deploy({seed:4,agent:'jyaldi',stageId:'elevator'});
   const w=g.world,s=w.stage,run=w.run;window.childDoorEvents=[];w.on(e=>childDoorEvents.push(e));
   s.outing().pending={to:'floor',depth:5,type:'replica',sub:'red'};w.enterFloor(s.nextFloor(run,w.floor,'next'));
   const rm=s.worldAt(5).rooms.find(r=>r.guardian);s.outing().pending={to:'floor',depth:5,type:'replica',sub:'red',room:[rm.col,rm.row]};w.enterFloor(s.nextFloor(run,w.floor,'next'));
   const idle={mx:0,my:0,run:false,evade:false,downDouble:false,held:new Set(),pressed:new Set(),released:new Set()};
   w.player.invuln=100000;
   for(let i=0;i<150;i++){
    w.step(idle);
    for(const b of w.bodies)if(b.team==='enemy'&&!b.boss&&b.kind!=='wallface'&&b.hp>0)b.die(w);
    if(w.encActive<0&&w.encIndex>=w.floor.encounters.length)break;
   }
   const floor=w.floor.stage.floor;
   const find=kind=>{const q=floor.placed.find(p=>p.kind===kind);return w.props.find(p=>p.id===`p${q.id}`)};
   const signPlaced=floor.placed.find(p=>p.kind==='sign'&&p.data.rule==='r11');
   const sign=w.props.find(p=>p.id===`p${signPlaced.id}`),door=find('childdoor'),key=floor.placed.find(p=>p.kind==='childkey');
   window.childDoorTargets={sign:sign.id,door:door.id,key:`p${key.id}`};
   w.player.x=w.player.px=sign.x-130;w.player.y=w.player.py=650;w.player.invuln=100000;w.player.hp=w.player.hpMax;
   w.camera();w.prevCamX=w.camX;
   return {upgradeN:s.outing().upgradeN,floor:w.floor.id,seed:w.run.seed,sign:{x:sign.x,y:sign.y},door:{x:door.x,y:door.y},key:{x:key.x,y:key.lane},family:w.bodies.filter(b=>b.kind.startsWith('family_')).map(b=>({kind:b.kind,x:b.x,y:b.y}))};
  });
  assert.equal(setup.upgradeN,0,'살아 있는 가족의 대기 상태를 처치 보상으로 처리하면 안 됨');
  const unblock=async()=>{for(let i=0;i<20;i++){await page.evaluate(()=>window.__goeiStory.skip());await page.waitForTimeout(100);if(await page.evaluate(()=>!window.__goeiEngine.mods.blocking()&&!window.__goeiEngine.mods.paused()))return;}assert.fail('대화 종료 시간초과');};
  await unblock();
  const moveTo=async target=>{
   for(let tries=0;tries<8;tries++){
    const x=await page.evaluate(()=>window.__goeiEngine.world.player.x),dx=target-x;if(Math.abs(dx)<17)return;
    const code=dx>0?'ArrowRight':'ArrowLeft';await page.keyboard.down(code);
    try{await page.waitForFunction(({target,dir})=>{const x=window.__goeiEngine.world.player.x;return dir>0?x>=target-10:x<=target+10},{target,dir:Math.sign(dx)},{timeout:8000});}
    catch(e){await page.screenshot({path:`${output}/blocked-${phone?'mobile':'desktop'}.png`});console.log('MOVEMENT BLOCKED',JSON.stringify(await page.evaluate(()=>{const g=__goeiEngine,w=g.world,p=w.player;return {x:p.x,y:p.y,phase:p.phase,move:p.moveKey,bounds:w.bounds,blocked:g.mods.blocking(),paused:g.paused,solid:w.solidsNow,props:w.props,subtitle:w.subtitle,targets:childDoorTargets}})));throw e;}
    finally{await page.keyboard.up(code)}
   }
   assert.fail('이동 목표 미도달');
  };
  const investigate=async()=>{if(phone){const b=page.locator('[data-id="interact"]');await b.waitFor({state:'visible'});const rect=await b.boundingBox();assert.ok(rect);await page.touchscreen.tap(rect.x+rect.width/2,rect.y+rect.height/2);}else await page.keyboard.press('KeyE',{delay:70});await page.waitForTimeout(100);};
  await moveTo(setup.sign.x);await investigate();
  await page.waitForFunction(()=>__goeiEngine.world.stage.outing().found.includes('r11'));
  await unblock();
  assert.equal(await page.evaluate(()=>__goeiEngine.world.props.some(p=>p.id===childDoorTargets.key)),false,'전투 전 열쇠 없음');
  await moveTo(setup.family.find(e=>e.kind==='family_f').x-200);
  await unblock();
  await page.waitForFunction(()=>__goeiEngine.world.bodies.filter(b=>b.kind.startsWith('family_')).every(b=>b.mem.mode==='fight'),null,{timeout:15000});
  await unblock();
  await page.waitForFunction(()=>__goeiEngine.world.props.some(p=>p.id===childDoorTargets.key));
  await moveTo(setup.key.x);await page.waitForTimeout(200);
  const keyView=await page.evaluate(()=>{const w=__goeiEngine.world,k=w.props.find(p=>p.id===childDoorTargets.key);return {kind:k.kind,label:k.label,screenX:k.x-w.camX,y:k.y,playerX:w.player.x,camX:w.camX}});
  assert.ok(keyView.screenX>=0&&keyView.screenX<=1280,'열쇠가 카메라 안에 있음');
  await page.screenshot({path:`${output}/${phone?'mobile':'desktop'}-key.png`});
  await investigate();await page.waitForFunction(()=>!__goeiEngine.world.props.some(p=>p.id===childDoorTargets.key));
  await moveTo(setup.door.x);await page.waitForTimeout(150);
  const doorView=await page.evaluate(()=>{const w=__goeiEngine.world,p=w.props.find(p=>p.id===childDoorTargets.door);return {label:p.label,kind:p.kind,screenX:p.x-w.camX,y:p.y}});
  assert.match(doorView.label,/잠긴/);assert.ok(doorView.screenX>=0&&doorView.screenX<=1280);
  await page.screenshot({path:`${output}/${phone?'mobile':'desktop'}-locked-door.png`});
  await investigate();
  await page.waitForFunction(()=>__goeiEngine.world.bodies.filter(b=>b.kind.startsWith('family_')).every(b=>b.state==='stunned'&&b.weakOpen>0));
  const opened=await page.evaluate(()=>({label:__goeiEngine.world.props.find(p=>p.id===childDoorTargets.door).label,family:__goeiEngine.world.bodies.filter(b=>b.kind.startsWith('family_')).map(b=>({kind:b.kind,state:b.state,weak:b.weakOpen,hp:b.hp})),signals:childDoorEvents.filter(e=>e.type==='custom'&&e.name==='guardianRule'&&e.data.kind==='childDoor').length}));
  assert.match(opened.label,/열린/);assert.equal(opened.signals,1);assert.equal(opened.family.length,2);
  await page.screenshot({path:`${output}/${phone?'mobile':'desktop'}-opened-door.png`});
  await investigate();await investigate();
  assert.equal(await page.evaluate(()=>childDoorEvents.filter(e=>e.type==='custom'&&e.name==='guardianRule'&&e.data.kind==='childDoor').length),1,'열린 문 반복 입력 신호 없음');
  results.push({viewport,input:phone?'touch 조사':'keyboard E',setup,keyView,doorView,opened});
  await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`${output}/result.json`,JSON.stringify({html:'dist/goei-action-game.html',bytes:html.length,results,errors},null,2)+'\n');console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r))}
