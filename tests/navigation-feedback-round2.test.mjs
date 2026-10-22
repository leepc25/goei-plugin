import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
await build({ stdin: { contents: `
export {navigationFeedback,navigationTarget} from './src/game/action/engine/navigationFeedback';
export {World} from './src/game/action/engine/world';
export {createElevatorStage} from './src/game/action/stage/module';
export {makeHub} from './src/game/action/engine/hub';
export {hqMap,LANE_TOP,LANE_BOT} from './src/game/action/hq/map';
export {newSave} from './src/game/action/hq/state';
`, resolveDir: process.cwd() }, bundle: true, outfile: 'dist-test/navigation-feedback-round2.mjs', format: 'esm', loader: { '.css': 'text' } });
const M = await import('../dist-test/navigation-feedback-round2.mjs');
const pad = { mx:0,my:0,run:false,evade:false,downDouble:false,held:new Set(),pressed:new Set(),released:new Set() };
const prop = (id,x,kind='decor') => ({ id,x,y:560,w:40,h:40,kind,label:id });
function setup(seed=4242,depth=1) {
 const stage=M.createElevatorStage({load:()=>null,save(){}}),run={seed,agent:'jyaldi',stageId:'elevator'};
 const w=new M.World(run,{},stage);w.enterFloor(stage.firstFloor(run));
 if(depth>1) {stage.outing().pending={to:'floor',depth,type:'replica',sub:'pretending'};w.enterFloor(stage.nextFloor(run,w.floor,'next'));}
 return {w,stage,run,depth};
}
function at(w,p) { w.player.x=p.x;w.player.y=p.y;w.player.move=null;w.player.phase='free'; }
function use(w,p) { at(w,p);w.step({...pad,pressed:new Set(['interact'])}); }
function clear(w) {
 for(let i=0;i<100;i++) {
  for(const b of w.bodies) if(b.team==='enemy') {b.hp=0;b.alive=false;}
  w.player.hp=w.player.hpMax;w.step(pad);
  if(w.encIndex>=w.floor.encounters.length&&w.encActive<0) return;
 }
 assert.fail('전투 fixture 정리 실패');
}
function enter(c,rm) {
 const world=c.stage.worldAt(c.depth);
 c.stage.outing().pending={to:'floor',depth:c.depth,type:world.type,sub:world.sub,room:[rm.col,rm.row]};
 c.w.enterFloor(c.stage.nextFloor(c.run,c.w.floor,'next'));
}


test('실제 E 대상: 60 경계, 동률 순서, 장식 뒤의 문을 잘못 권하지 않음',()=>{
 const a=prop('장식',20),b=prop('문',30,'door');
 assert.equal(M.navigationTarget([a,b],0),a);
 assert.equal(M.navigationTarget([a,b],-40),null);
 assert.equal(M.navigationTarget([a,{...b,x:-20}],0),a);
 const {w}=setup();w.props=[a,b];w.player.x=0;
 assert.equal(M.navigationFeedback(w).target.kind,'decoration');
 w.player.carry={};assert.equal(M.navigationFeedback(w).target,null);
});
test('타고 온 승강기: E 이전에도 귀환 불가 이유, 실제 E의 규칙 안내와 일치',()=>{
 const {w}=setup();w.step(pad);const p=w.props.find(p=>p.kind==='elevator');at(w,p);
 assert.match(M.navigationFeedback(w).target.reason,/돌아갈 수 없음/);
 use(w,p);assert.equal(w.ended,null);assert.match(w.subtitle.text,/귀환.*로프/);
});
test('일반 방: 시작 전/전투 중 출입 잠김 → 실제 E 거부 → 정리 후 E로 이동',()=>{
 const c=setup(),world=c.stage.worldAt(1);
 const rm=world.rooms.find(r=>r.role==='fight'&&Object.entries(r.open).some(([d,v])=>v&&!r.lock[d]&&!r.hidden[d]));enter(c,rm);
 const d=Object.keys(rm.open).find(d=>rm.open[d]&&!rm.lock[d]&&!rm.hidden[d]);
 const pl=c.w.floor.stage.floor.placed.find(p=>p.data.dir===d&&['wdoor','wup','wdown'].includes(p.kind));
 const p=c.w.props.find(p=>p.id===`p${pl.id}`);at(c.w,p);
 assert.match(M.navigationFeedback(c.w).target.reason,/전투/);
 c.w.step(pad);use(c.w,p);assert.equal(c.w.ended,null);assert.match(c.w.subtitle.text,/전투 중/);
 clear(c.w);at(c.w,p);assert.equal(M.navigationFeedback(c.w).target.kind,'exit');
 use(c.w,p);assert.equal(c.w.ended,'next');
});
test('실제 번호 잠금: 열쇠 없음 → 보유 → 해제 뒤 지도/안내 모두 열림',()=>{
 const c=setup(4242,4),world=c.stage.worldAt(4),rm=world.rooms.find(r=>Object.keys(r.lock).length);
 enter(c,rm);clear(c.w);
 const pl=c.w.floor.stage.floor.placed.find(p=>p.data.lock!==undefined&&p.data.dir);
 const p=c.w.props.find(p=>p.id===`p${pl.id}`);at(c.w,p);
 assert.match(M.navigationFeedback(c.w).target.reason,/열쇠 [①②③④] 필요/);
 use(c.w,p);assert.equal(c.w.ended,null);assert.match(c.w.subtitle.text,/잠겨 있다/);
 c.stage.outing().wkeys.push(`4:${pl.data.lock}`);at(c.w,p);
 assert.notEqual(M.navigationFeedback(c.w).target.kind,'locked');
 use(c.w,p);assert.ok(c.stage.outing().unlocked.length);
 const m=c.stage.mapView(),room=m.worlds.find(w=>w.depth===4).rooms.find(r=>r.col===rm.col&&r.row===rm.row);
 assert.equal(room.lock[pl.data.dir].state,'open');
});
test('패널: 방 목표 미해결 → 실제 E 거부 → 층 정리 후 다음 층 선택',()=>{
 const c=setup(),world=c.stage.worldAt(1);enter(c,world.rooms.find(r=>r.panel));clear(c.w);
 const p=c.w.props.find(p=>p.kind==='panel');at(c.w,p);
 assert.match(M.navigationFeedback(c.w).target.reason,/모두 해결/);
 use(c.w,p);assert.equal(c.w.ended,null);assert.match(c.w.subtitle.text,/패널이 꺼져/);
 c.stage.outing().clearedFloors.push(1);at(c.w,p);
 assert.equal(M.navigationFeedback(c.w).target.kind,'exit');use(c.w,p);assert.equal(c.w.ended,'next');
});
test('본부 실제 문: 잠긴 시설은 이유 표시, 열린 출구는 E로 연결 방에 도착',()=>{
 const map=M.hqMap(M.newSave());let closed=0,opened=0;
 for(const scene of map.scenes) for(const door of scene.doors) {
  if(door.open&&!door.to) continue;
  const y=door.side==='S'?M.LANE_BOT-14:M.LANE_TOP+16;
  const stage=M.makeHub({map:()=>({...map,start:{scene:scene.id,x:door.x,y}}),openPlace(){},bark:()=>null,chooseFloor(){},sfx(){}},()=>({scene:scene.id,x:door.x,y}));
  const w=new M.World({seed:1,agent:'jyaldi',stageId:'hq'},{},stage);w.enterFloor(stage.firstFloor(w.run));w.step(pad);
  const target=M.navigationFeedback(w).target;assert.ok(target,`${scene.id}:${door.id}`);
  if(!door.open){assert.equal(target.kind,'locked');closed++;}
  else{assert.equal(target.kind,'exit');opened++;}
  w.step({...pad,pressed:new Set(['interact'])});for(let i=0;i<60&&!w.ended;i++)w.step(pad);
  if(!door.open)assert.equal(w.ended,null);else assert.equal(w.ended,'next');
 }
 assert.ok(closed>0&&opened>=20);
});
