import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ stdin:{contents:`export {makeHub} from './src/game/action/engine/hub';export {World} from './src/game/action/engine/world';export {hqMap,LANE_TOP,LANE_BOT} from './src/game/action/hq/map';`,resolveDir:process.cwd()},bundle:true,format:'esm',write:false,loader:{'.css':'text'} });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const pad = {mx:0,my:0,run:false,evade:false,downDouble:false,held:new Set(),pressed:new Set(),released:new Set()};
test('본부: 열린 문 앞에서 E 한 번 → 문 열기 → 암전 → 연결된 방 (이동 예약 반복 없음)', () => {
 const map=M.hqMap();let checked=0;
 for(const scene of map.scenes) for(const door of scene.doors.filter(d=>d.open && d.to)) {
  const y=door.side==='S'?(scene.lane?.[1]??M.LANE_BOT)-14:(scene.lane?.[0]??M.LANE_TOP)+16; // 맵 에디터 장면은 자기 걷는 띠
  const host={map:()=>({...map,start:{scene:scene.id,x:door.x,y}}),openPlace(){},bark:()=>null,chooseFloor(){},sfx(){}};
  const stage=M.makeHub(host,()=>({scene:scene.id,x:door.x,y}));
  const w=new M.World({agent:'jyaldi',seed:1,stageId:'hq'},{},stage);
  w.enterFloor(stage.firstFloor(w.run));w.step(pad);
  assert.ok(w.props.some(p=>p.id===`door:${door.id}`),`${scene.id}:${door.id} 접근 가능`);
  w.step({...pad,pressed:new Set(['interact'])});
  for(let i=0;i<60 && !w.ended;i++) w.step(pad);
  assert.equal(w.ended,'next',`${scene.id}:${door.id} 문 전환 완료`);
  w.enterFloor(stage.nextFloor(w.run,w.floor,'next'));
  assert.equal(w.floor.id,`hq:${door.to}`);
  checked++;
 }
 assert.ok(checked>=12);console.log(`본부 문 ${checked}개 연결 통과`);
});

test('본부 그림 층: 계단 문 → 고른 층의 계단, 메뉴 문 → 문 열린 뒤 장소 창', () => {
 const map=M.hqMap();
 const f2=map.scenes.find(s=>s.id==='f2');
 const run=(door,pick,sc=f2)=>{
  const y=M.LANE_TOP+16;let opened=null,asked=null;
  const host={map:()=>({...map,start:{scene:sc.id,x:door.x,y}}),openPlace(id){opened=id},bark:()=>null,chooseFloor(o,cb){asked=o;cb(pick)},sfx(){}};
  const stage=M.makeHub(host,()=>({scene:sc.id,x:door.x,y}));
  const w=new M.World({agent:'jyaldi',seed:1,stageId:'hq'},{},stage);
  w.enterFloor(stage.firstFloor(w.run));w.step(pad);
  w.step({...pad,pressed:new Set(['interact'])});
  for(let i=0;i<60 && !w.ended;i++) w.step(pad);
  return {w,stage,opened,asked};
 };
 // 본부는 새 그림(11-01)으로 모든 층에 계단이 없다(엘리베이터만)
 const b1=map.scenes.find(s=>s.id==='b1');
 assert.ok(!map.scenes.some(s=>!s.id.startsWith('jr_')&&s.doors.some(d=>d.kind==='stairs')),'본부 계단 없음');
 // 3층은 새 그림(11-01)이라 장소 문(탕비실)이 없다 → 지하 주차장 보급실 문으로 같은 것을 본다
 const b3=map.scenes.find(s=>s.id==='b3');
 const ch=run(b3.doors.find(d=>d.id==='supply'),undefined,b3);
 assert.equal(ch.opened,'supply');assert.equal(ch.w.ended,null);
 const wc=run(b1.doors.find(d=>d.id==='shower_m'),undefined,b1); // 잠긴 문(2층 회의실은 새 그림에 없음)
 assert.equal(wc.opened,null);assert.equal(wc.w.ended,null);
});
