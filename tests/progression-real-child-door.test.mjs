// 기존 명일 설계 3·6장: 규칙 11 → 전용 열쇠 → 아이 방 E → 일회성 약점. 실제 World/Enemy/연결기를 쓴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const out=await build({stdin:{contents:`export * from './src/game/action/stage';export {World} from './src/game/action/engine/world';export {createEnemy,isThreat} from './src/game/action/enemy';export {bindEnemyInteractions} from './src/game/action/engine/enemyInteractions';`,resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const M=await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const clips=JSON.parse(readFileSync('game-pack/jyaldi/frames.json','utf8')).clips;
const idle={mx:0,my:0,run:false,evade:false,downDouble:false,held:new Set(),pressed:new Set(),released:new Set()};
function attach(w,events){w.threat=M.isThreat;M.bindEnemyInteractions(w);w.on(e=>events.push(e));}
function setup({guardian=true,known=false}={}){
 const meta=M.newMeta();if(known)meta.known.r11=0;
 const save={load:()=>meta,save(){}},stage=M.createElevatorStage(save),run={agent:'jyaldi',seed:4,stageId:'elevator'};
 const factory=(s,w)=>M.createEnemy(s.kind,s.x,s.y,w.rand,{elite:s.elite});
 const w=new M.World(run,clips,stage,factory),events=[];attach(w,events);w.enterFloor(stage.firstFloor(run));
 stage.outing().pending={to:'floor',depth:5,type:'replica',sub:'red'};w.enterFloor(stage.nextFloor(run,w.floor,'next'));
 const rm=stage.worldAt(5).rooms.find(r=>guardian?r.guardian:!r.guardian&&r.open.r&&r.lock.r==null&&!r.hidden.r);
 assert.ok(rm);stage.outing().pending={to:'floor',depth:5,type:'replica',sub:'red',room:[rm.col,rm.row]};w.enterFloor(stage.nextFloor(run,w.floor,'next'));
 const c={w,stage,run,save,factory,events};regular(c);return c;
}
function step(c,n=1,pad=idle){for(let i=0;i<n;i++){c.w.player.invuln=100;c.w.player.hp=c.w.player.hpMax;c.w.step(pad);}}
function regular(c){for(let i=0;i<150;i++){step(c);for(const b of c.w.bodies)if(b.team==='enemy'&&!b.boss&&b.kind!=='wallface'&&b.hp>0)b.die(c.w);if(c.w.encActive<0&&c.w.encIndex>=c.w.floor.encounters.length)return;}assert.fail('일반 전투 정리 시간초과');}
function placed(c,kind){const q=c.w.floor.stage.floor.placed.find(p=>p.kind===kind);assert.ok(q,kind);return q;}
function prop(c,kind){const q=placed(c,kind);return c.w.props.find(p=>p.id===`p${q.id}`);}
function tap(c,p){assert.ok(p,'상호작용 소품 존재');c.w.player.x=c.w.player.px=p.x;c.w.player.y=c.w.player.py=p.y;step(c,1,{...idle,pressed:new Set(['interact'])});}
function read(c){const q=c.w.floor.stage.floor.placed.find(p=>p.kind==='sign'&&p.data.rule==='r11');tap(c,c.w.props.find(p=>p.id===`p${q.id}`));assert.ok(c.stage.outing().found.includes('r11')||c.stage.meta().known.r11===0);}
function fight(c){const f=c.w.bodies.find(b=>b.kind==='family_f');assert.ok(f);c.w.player.x=c.w.player.px=f.x-200;c.w.player.y=c.w.player.py=650;for(let i=0;i<240&&f.mem.mode!=='fight';i++)step(c);assert.equal(f.mem.mode,'fight');step(c);}
function childEvents(c){return c.events.filter(e=>e.type==='custom'&&e.name==='guardianRule'&&e.data.kind==='childDoor');}
function restore(c){const st=M.createElevatorStage(c.save),w=new M.World(c.run,clips,st,c.factory),events=[];attach(w,events);w.enterFloor(st.restore(c.stage.snapshot()));w.restore(c.w.snapshot());return {...c,w,stage:st,events};}
function hitFace(c){
 const sp=c.w.floor.stage.floor.spawns.find(s=>s.kind==='wallface');assert.ok(sp);
 c.w.player.x=c.w.player.px=sp.x;c.w.player.y=c.w.player.py=650;step(c,35);
 const face=c.w.bodies.find(b=>b.kind==='wallface');assert.ok(face);
 const hp=face.hp,box=face.frame().hurt[0];c.w.addBullet({x:face.x-35,y:face.y,z:(box.z0+box.z1)/2,dir:1});step(c);
 assert.ok(face.hp<hp,'실제 권총탄이 벽 얼굴에 명중');assert.ok(c.events.some(e=>e.type==='custom'&&e.name==='ruleBroken'&&e.data.rule==='r11'));
}

test('규칙·전용열쇠 없이 E/일반열쇠/만능열쇠로 아이 방을 열 수 없다',()=>{
 const c=setup();assert.equal(prop(c,'childkey'),undefined);
 c.stage.outing().keys.push(5);c.stage.outing().wkeys.push('5:1');c.stage.outing().upgrades.push('master');
 tap(c,prop(c,'childdoor'));assert.equal(childEvents(c).length,0);assert.match(prop(c,'childdoor').label,/잠긴/);
 const ordinary=c.w.props.find(p=>p.kind==='door'&&p.id!==prop(c,'childdoor').id);assert.ok(ordinary);tap(c,ordinary);
 assert.equal(childEvents(c).length,0);assert.equal(c.events.filter(e=>e.name==='ruleKept'&&e.data.rule==='r_child').length,0);
});
test('규칙을 전투 전에 알면 전투 개시 후 열쇠 1개, E로 주워 E로 열면 150틱만 약점',()=>{
 const c=setup();read(c);assert.equal(prop(c,'childkey'),undefined);fight(c);assert.ok(prop(c,'childkey'));
 const p=prop(c,'childdoor');tap(c,p);assert.equal(childEvents(c).length,0,'줍기 전에 열 수 없음');
 tap(c,prop(c,'childkey'));assert.equal(prop(c,'childkey'),undefined);
 const family=c.w.bodies.filter(b=>b.kind.startsWith('family_')),hp=family.map(b=>b.hp);
 tap(c,p);assert.equal(childEvents(c).length,1);assert.ok(family.every(b=>b.state==='stunned'&&b.weakOpen>0));
 const before=family[0].stunT;tap(c,prop(c,'childdoor'));assert.equal(childEvents(c).length,1);assert.ok(family[0].stunT<before,'반복 E가 그로기 시간 연장 안 함');
 step(c,151);assert.ok(family.every(b=>b.state!=='stunned'));assert.deepEqual(family.map(b=>b.hp),hp);
 assert.equal(c.events.filter(e=>e.name==='childKeyDropped').length,1);assert.equal(c.events.filter(e=>e.name==='guardianCleared').length,0);
 const door=c.w.props.find(p=>c.w.floor.stage.floor.placed.some(q=>`p${q.id}`===p.id&&q.kind==='wdoor'));tap(c,door);assert.equal(c.w.ended,null,'약점이 수호자 처치/출구 해제를 대신하지 않음');
});
test('전투 진입 뒤 규칙을 읽어도 열쇠가 한 번 떨어지고 저장 복원 후 중복되지 않음',()=>{
 const c=setup();fight(c);assert.equal(prop(c,'childkey'),undefined);read(c);assert.ok(prop(c,'childkey'));
 const resumed=restore(c);step(resumed,3);assert.ok(prop(resumed,'childkey'));assert.equal(resumed.events.filter(e=>e.name==='childKeyDropped').length,0);
 tap(resumed,prop(resumed,'childkey'));assert.equal(prop(resumed,'childkey'),undefined);step(resumed,5);assert.equal(prop(resumed,'childkey'),undefined);
});
test('벽 얼굴을 실제로 쏜 기록은 다른 방과 저장 복원을 거쳐도 열쇠 조건을 막음',()=>{
 const c=setup({guardian:false});hitFace(c);
 const resumed=restore(c),g=resumed.stage.worldAt(5).rooms.find(r=>r.guardian);
 resumed.stage.outing().pending={to:'floor',depth:5,type:'replica',sub:'red',room:[g.col,g.row]};resumed.w.enterFloor(resumed.stage.nextFloor(resumed.run,resumed.w.floor,'next'));
 regular(resumed);read(resumed);fight(resumed);assert.equal(prop(resumed,'childkey'),undefined);tap(resumed,prop(resumed,'childdoor'));assert.equal(childEvents(resumed).length,0);
});
test('벽 얼굴은 강제 처치 대상이 아니며 실제 E 방 이동과 재방문에서 다시 나타남',()=>{
 const c=setup({guardian:false}),sp=c.w.floor.stage.floor.spawns.find(s=>s.kind==='wallface');
 c.w.player.x=c.w.player.px=sp.x;c.w.player.y=c.w.player.py=650;step(c,35);
 const face=c.w.bodies.find(b=>b.kind==='wallface');assert.ok(face&&face.hp>0);
 assert.ok(!c.w.floor.encounters.some(e=>e.waves.flat().some(s=>s.kind==='wallface')));
 const old=c.w.floor,room=[...c.stage.outing().room];
 const q=c.w.floor.stage.floor.placed.find(p=>p.kind==='wdoor'&&p.data.dir==='r');tap(c,c.w.props.find(p=>p.id===`p${q.id}`));assert.equal(c.w.ended,'next','살아 있는 얼굴 때문에 출입을 막지 않음');
 c.w.enterFloor(c.stage.nextFloor(c.run,old,'next'));
 c.stage.outing().pending={to:'floor',depth:5,type:'replica',sub:'red',room};c.w.enterFloor(c.stage.nextFloor(c.run,c.w.floor,'next'));
 c.w.player.x=c.w.player.px=sp.x;step(c,2);assert.equal(c.w.bodies.filter(b=>b.kind==='wallface').length,1,'살아서 지나친 환경 몸 복원');
});
test('이미 연 문은 저장 복원 뒤에도 열린 채 유지되며 약점·열쇠를 재발급하지 않음',()=>{
 const c=setup({known:true});fight(c);tap(c,prop(c,'childkey'));tap(c,prop(c,'childdoor'));assert.equal(childEvents(c).length,1);
 const resumed=restore(c);regular(resumed);fight(resumed);tap(resumed,prop(resumed,'childdoor'));
 assert.match(prop(resumed,'childdoor').label,/열린/);assert.equal(childEvents(resumed).length,0);assert.equal(prop(resumed,'childkey'),undefined);
});

test('열쇠를 주운 뒤에도 벽 얼굴을 공격하면 문은 잠겨 있고 약점 신호를 보내지 않음',()=>{
 const c=setup({known:true});fight(c);tap(c,prop(c,'childkey'));hitFace(c);tap(c,prop(c,'childdoor'));
 assert.match(prop(c,'childdoor').label,/잠긴/);assert.equal(childEvents(c).length,0);
});
test('붉은 방 100시드: 아이 방·전용열쇠·규칙 단서는 수호자 방에만 생성되고 접근 가능한 위치',()=>{
 for(let seed=1;seed<=100;seed++){
  const world=M.makeWorld({seed,depth:5,type:'replica',sub:'red',epoch:0});
  for(const rm of world.rooms){
   const f=M.roomFloor(world,rm,{seed,danger:0,growth:0,flags:[],epoch:0}),plan=M.floorPlan(f,'child-generation');
   const doors=f.placed.filter(p=>p.kind==='childdoor'),keys=f.placed.filter(p=>p.kind==='childkey');
   assert.equal(doors.length,rm.guardian?1:0);assert.equal(keys.length,doors.length);
   assert.ok(!plan.encounters.some(e=>e.waves.flat().some(s=>s.kind==='wallface')));
   if(!doors.length)continue;
   assert.ok(f.placed.some(p=>p.kind==='sign'&&p.data.rule==='r11'));
   const door=plan.props.find(p=>p.id===`p${doors[0].id}`),key=keys[0];
   assert.equal(plan.props.some(p=>p.id===`p${key.id}`),false,'미획득 열쇠를 처음부터 놓지 않음');
   for(const q of [door,key]){
    assert.ok(!plan.stage.terrain.some(t=>q.x>t.x0-25&&q.x<t.x1+25&&['pit','block','low'].includes(t.kind)));
    assert.ok(!plan.props.some(p=>p!==door&&p.x===q.x),'다른 소품이 E를 가로채지 않음');
   }
  }
 }
});
