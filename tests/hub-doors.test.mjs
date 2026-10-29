import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ stdin:{contents:`export {makeHub} from './src/game/action/engine/hub';export {World} from './src/game/action/engine/world';export {hqMap,LANE_TOP,LANE_BOT} from './src/game/action/hq/map';`,resolveDir:process.cwd()},bundle:true,format:'esm',write:false,loader:{'.css':'text'} });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const pad = {mx:0,my:0,run:false,evade:false,downDouble:false,held:new Set(),pressed:new Set(),released:new Set()};
test('본부: 열린 문 앞에서 E 한 번 → 문 열기 → 암전 → 연결된 방 (이동 예약 반복 없음)', () => {
 const map=M.hqMap();let checked=0;
 for(const scene of map.scenes) for(const door of scene.doors.filter(d=>d.open && d.to)) {
  const y=door.side==='S'?M.LANE_BOT-14:M.LANE_TOP+16;
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
 const f2=map.scenes.find(s=>s.id==='f2'),f3=map.scenes.find(s=>s.id==='f3');
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
 const st=run(f2.doors.find(d=>d.id==='stairs'),1);
 assert.deepEqual(st.asked.map(o=>o.label),['3','1']);
 assert.equal(st.w.ended,'next');
 st.w.enterFloor(st.stage.nextFloor(st.w.run,st.w.floor,'next'));
 assert.equal(st.w.floor.id,'hq:lobby');
 const ch=run(f3.doors.find(d=>d.id==='pantry'),undefined,f3);
 assert.equal(ch.opened,'pantry');assert.equal(ch.w.ended,null);
 const wc=run(f2.doors.find(d=>d.id==='meeting'));
 assert.equal(wc.opened,null);assert.equal(wc.w.ended,null);
});
