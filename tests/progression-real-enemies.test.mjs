// 실제 적 개체/World 틱/입력 경계. 적 처치는 진행 판정 검증용 직접 die이며 전투 균형 시험은 아니다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const out=await build({stdin:{contents:`export * from './src/game/action/stage';export {World} from './src/game/action/engine/world';export {createEnemy,isThreat,signalEnemies} from './src/game/action/enemy';`,resolveDir:process.cwd()},bundle:true,format:'esm',write:false,loader:{'.css':'text'}});
const M=await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const clips=JSON.parse(readFileSync('game-pack/jyaldi/frames.json','utf8')).clips;
const idle={mx:0,my:0,run:false,evade:false,downDouble:false,held:new Set(),pressed:new Set(),released:new Set()};
function setup(seed,type,depth,sub=null,guardian=false){
 const save={load:()=>null,save(){}};const stage=M.createElevatorStage(save),run={agent:'jyaldi',seed,stageId:'elevator'};
 const factory=(s,w)=>M.createEnemy(s.kind,s.x,s.y,()=>w.rand(),{elite:s.elite});
 const w=new M.World(run,clips,stage,factory);w.threat=M.isThreat;w.enterFloor(stage.firstFloor(run));
 stage.outing().pending={to:'floor',depth,type,sub};w.enterFloor(stage.nextFloor(run,w.floor,'next'));
 if(guardian){const rm=stage.worldAt(depth).rooms.find(r=>r.guardian);assert.ok(rm,`${seed}:${type} 수호자 방`);stage.outing().pending={to:'floor',depth,type,sub,room:[rm.col,rm.row]};w.enterFloor(stage.nextFloor(run,w.floor,'next'));}
 const roomClear=()=>{const [col,row]=stage.outing().room;return stage.mapView().worlds.find(x=>x.depth===depth).rooms.find(x=>x.col===col&&x.row===row).clear};
 return {stage,w,run,save,factory,roomClear};
}
function finishRegular(c){
 for(let i=0;i<100;i++){
  c.w.player.hp=c.w.player.hpMax;c.w.step(idle);
  for(const b of c.w.bodies)if(b.team==='enemy'&&!b.boss&&b.hp>0)b.die(c.w);
  if(c.w.encActive<0&&c.w.encIndex>=c.w.floor.encounters.length)return;
 }
 assert.fail('일반 전투 완료 시간 초과');
}
test('208호 가족: 대기 중 encounter가 풀려도 방 정리와 출구는 양쪽 수호자 해결 전 잠김',()=>{
 const c=setup(4,'replica',5,'red',true);finishRegular(c);
 assert.equal(c.roomClear(),false);
 const f=c.w.bodies.find(b=>b.kind==='family_f'),m=c.w.bodies.find(b=>b.kind==='family_m');assert.ok(f&&m,'실제 짝 자동 생성');
 assert.equal(c.w.encActive,-1,'대기 상태는 일반 전투 잠금을 풀지만 수호자는 남아 있음');
 const door=c.w.props.find(p=>c.w.floor.stage.floor.placed.some(pl=>`p${pl.id}`===p.id&&pl.kind==='wdoor'));
 assert.ok(door);c.w.player.x=c.w.player.px=door.x;c.w.player.y=door.y;c.w.step({...idle,pressed:new Set(['interact'])});
 assert.equal(c.w.ended,null);assert.match(c.w.subtitle.text,/수호자/);
 f.die(c.w);assert.equal(c.roomClear(),false);m.die(c.w);assert.equal(c.roomClear(),true);
 const resumed=M.createElevatorStage(c.save),w2=new M.World(c.run,clips,resumed,c.factory);w2.threat=M.isThreat;
 w2.enterFloor(resumed.restore(c.stage.snapshot()));w2.restore(c.w.snapshot());for(let i=0;i<5;i++)w2.step(idle);
 assert.equal(w2.bodies.some(b=>b.kind==='family_f'||b.kind==='family_m'),false,'해결한 가족은 복원해도 재생성 안 함');
});
test('일어난 집: 실제 규칙 신호로 사라진 수호자는 처치 없이 방 진행을 연다',()=>{
 const c=setup(4,'replica',5,'vacant',true);
 for(let i=0;i<100&&!c.w.bodies.some(b=>b.kind==='risenhouse');i++){
  c.w.step(idle);for(const b of c.w.bodies)if(b.team==='enemy'&&!b.boss&&b.hp>0)b.die(c.w);
 }
 assert.ok(c.w.bodies.some(b=>b.kind==='risenhouse'));assert.equal(c.roomClear(),false);
 M.signalEnemies(c.w,{kind:'clock'});c.w.step(idle);
 assert.equal(c.roomClear(),true);assert.equal(c.w.notes['stage.elderDefeated'],undefined);
});
test('구형 대기 중 저장 복원: 노부부를 다시 소환하고 가족 수호자만 재생성',()=>{
 for(const sub of ['pretending','red']){
  const c=setup(4,'replica',5,sub,true);finishRegular(c);
  if(sub==='pretending'){
   const g=c.w.floor.stage.floor.spawns.find(s=>s.role==='guardian');c.w.player.x=c.w.player.px=g.x;c.w.step(idle);c.w.step(idle);
  }
  assert.ok(c.w.bodies.some(b=>b.boss));
  const st=c.stage.snapshot(),wt=c.w.snapshot();const s2=M.createElevatorStage(c.save),w2=new M.World(c.run,clips,s2,c.factory);w2.threat=M.isThreat;
  w2.enterFloor(s2.restore(st));w2.restore(wt);
  for(let i=0;i<5;i++)w2.step(idle);
  assert.ok(w2.bodies.some(b=>b.kind===(sub==='red'?'family_f':'elder_f')),`${sub} 수호자 복원`);
  assert.ok(w2.bodies.some(b=>b.kind===(sub==='red'?'family_m':'elder_m')),`${sub} 짝 복원`);
  assert.ok(!w2.bodies.some(b=>!b.boss&&b.kind!=='mummy'),'이미 정리한 일반 적은 반복 생성 안 함');
 }
});
test('안전 저장: 비적대 수호자와 B-12 손도 몸이 남아 있는 동안 저장하지 않는다',()=>{
 const c=setup(4,'replica',5,'red',true);finishRegular(c);
 assert.equal(c.w.encActive,-1);assert.equal(c.w.bodies.filter(b=>b.boss).every(b=>!M.isThreat(b)),true);
 assert.equal(c.w.canCheckpoint(),false,'비적대 대기 상태 수호자를 생략한 저장 금지');
 const deep=setup(17,'deep',15);const hand=deep.w.spawn({kind:'toucher',x:deep.w.player.x+100,y:deep.w.player.y});
 deep.w.step(idle);assert.equal(M.isThreat(hand),false);assert.equal(hand.boss,false);
 assert.equal(deep.w.canCheckpoint(),false,'전투를 잠그지 않는 환경 위협도 생략 금지');
 for(const b of deep.w.bodies)b.alive=false;
 assert.equal(deep.w.canCheckpoint(),true,'몸이 사라진 안전 지점에서는 저장 가능');
});
test('추격 역방향 진입과 B-12: 벽/encounter 유무와 별개로 근처 계획 적이 한 번 생성',()=>{
 for(const [type,depth] of [['chase',4],['deep',15]]){
  const c=setup(17,type,depth);
  const rm=c.stage.worldAt(depth).rooms.find(r=>r.open.r&&!r.hidden.r);
  c.stage.outing().pending={to:'floor',depth,type,sub:null,room:[rm.col,rm.row],from:'r'};c.w.enterFloor(c.stage.nextFloor(c.run,c.w.floor,'next'));
  const spawns=c.w.floor.stage.floor.spawns.filter(s=>s.role==='enemy'||type==='deep'&&s.role==='stalker');assert.ok(spawns.length);
  const target=spawns[0];c.w.player.x=c.w.player.px=target.x;c.w.player.y=620;
  c.w.step(idle);const first=c.w.bodies.filter(b=>b.kind===target.kind).length;assert.ok(first>0,`${type}:${target.kind} 실제 생성`);
  c.w.step(idle);assert.equal(c.w.bodies.filter(b=>b.kind===target.kind).length,first,'같은 spawn 반복 생성 없음');
 }
});

function elderTableScene(){
 const c=setup(4,'replica',5,'pretending',true);finishRegular(c);
 const placed=c.w.floor.stage.floor.placed.find(p=>p.kind==='table'&&p.data.guardian);
 const table=c.w.props.find(p=>p.id===`p${placed.id}`);assert.ok(table,'405호 전용 밥상');
 c.w.player.x=c.w.player.px=table.x;c.w.player.y=c.w.player.py=table.y;
 for(let i=0;i<3;i++)c.w.step(idle);
 assert.equal(c.w.bodies.filter(b=>b.kind==='elder_f'||b.kind==='elder_m').length,2);
 // engine/modules.ts의 현행 밥상 연결과 동일. 실제 E→신호→스테이지 상호작용 순서.
 c.w.interactHooks.push(prop=>{if(prop?.kind==='table'||prop?.kind==='meal')M.signalEnemies(c.w,{kind:'mealThanks',x:c.w.player.x,y:c.w.player.y})});
 const events=[];c.w.on(e=>events.push(e));
 const useTable=()=>{c.w.player.x=c.w.player.px=table.x;c.w.player.y=c.w.player.py=table.y;c.w.player.phase='free';c.w.player.move=null;c.w.step({...idle,pressed:new Set(['interact'])})};
 return {...c,events,useTable};
}
test('405호 실제 밥상 E: 평화 신호 직후는 미정리, 노부부 소멸 완료 뒤에만 방·저장 해제',()=>{
 const c=elderTableScene();assert.equal(c.roomClear(),false);c.useTable();
 assert.ok(c.w.bodies.filter(b=>b.kind.startsWith('elder_')).every(b=>b.mem.mode==='peace'));
 assert.equal(c.roomClear(),false,'밥상 클릭만으로 guardianSkip를 앞당기지 않는다');
 assert.equal(c.w.canCheckpoint(),false,'소멸 중인 수호자가 남은 저장 금지');
 for(let i=0;i<60;i++)c.w.step(idle);
 assert.equal(c.roomClear(),true);assert.equal(c.w.canCheckpoint(),true);
 assert.equal(c.events.filter(e=>e.type==='custom'&&e.name==='guardianCleared'&&e.data.how==='rule').length,1);
 assert.equal(c.w.notes['stage.elderDefeated'],undefined,'평화 통과는 m6 진압 실적 아님');
});
test('405호 적대 후 실제 밥상 E: 규칙 통과·방 정리·안전 저장을 우회하지 않는다',()=>{
 const c=elderTableScene();M.signalEnemies(c.w,{kind:'turnAway'});c.useTable();
 assert.ok(c.w.bodies.filter(b=>b.kind.startsWith('elder_')).every(b=>b.mem.mode==='fight'));
 assert.equal(c.roomClear(),false,'적대한 밥상 E가 guardianSkip를 만들지 않는다');
 for(let i=0;i<60;i++){c.w.player.hp=c.w.player.hpMax;c.w.step(idle)}
 assert.equal(c.roomClear(),false);assert.equal(c.w.canCheckpoint(),false);
 assert.equal(c.events.filter(e=>e.type==='custom'&&e.name==='guardianCleared').length,0);
});
