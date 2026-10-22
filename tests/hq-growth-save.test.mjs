import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: `
export * from './src/game/action/hq/logic';
export * from './src/game/action/hq/state';
export { emptyResult } from './src/game/action/hq/contract';
export { MISSION_BY_ID } from './src/game/action/hq/data';
export { memorySaves } from './src/game/action/hq/store';
export { SessionStore } from './src/game/action/engine/sessionStore';
`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false, loader: { '.css':'text' } });
const H=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const result=(how,patch={})=>({...H.emptyResult(how),...patch});
const journal=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}};
const meta={title:'본부',summary:'',schema:'goei-hq/1'};

test('m1→m9 연속 임무: 해금·출동 저장·조건 충족 정산·성장·중복 거부',()=>{
 let s=H.newSave(), seed=1;
 const evidence=[
  ['m1',{depth:2,found:['entry','lobby']}],
  ['m2',{depth:3,notes:{bosses:['guard']}}],
  ['m7',{depth:3,bag:[{id:'checklist',name:'점검표',research:8,value:40}]}],
  ['m3',{depth:5,notes:{'stage.visited':['B-1 추격의 층'],'stage.clearedFloors':[4]}}],
  ['m4',{depth:5,rescued:['missing:5']}],
  ['m5',{depth:5,found:['r_greet','r_quiet','r_meal'],notes:{'stage.visited':['B-2 재현의 층']}}],
  ['m6',{depth:5,notes:{'stage.elderDefeated':true}}],
  ['m8',{depth:6,notes:{'stage.trial':'success'}}],
  ['m9',{depth:8}],
 ];
 for(const [id,proof] of evidence){
  const cards=H.missionBoard(s);H.noteDeadlines(s,cards);
  assert.ok(cards.some(c=>c.def.id===id),`${id} 게시판 해금`);
  const launch=H.launch(s,id,seed++);assert.equal(typeof launch,'object');
  const beforeXp=s.agents.jyaldi.xp, beforeRuns=s.runs;
  s=H.parseSave(H.saveText(s));assert.equal(s.active.runId,launch.runId);
  const r=result('return',{...proof,runId:launch.runId,floors:proof.depth,kills:3,itemsLeft:launch.items});
  H.settle(s,launch,r,()=>.9);
  assert.ok(s.missionsDone.includes(id));assert.equal(s.runs,beforeRuns+1);assert.equal(s.active,null);
  assert.ok(s.agents.jyaldi.xp>beforeXp);
  const settled=H.saveText(s);H.settle(s,launch,r,()=>.9);assert.equal(H.saveText(s),settled);
  s=H.parseSave(settled);
 }
 assert.equal(s.missionsDone.length,9);assert.equal(s.deepest,8);assert.ok(s.rescued.includes('worker'));
 assert.equal(s.appraisal[0].research,8);H.appraise(s);
 assert.match(H.doResearch(s,'rs_relic1'),/연구 완료/);
 H.equipRelic(s,0,'first_guard');H.restDay(s);
 const next=H.launch(s,'m1',100);assert.ok(next.relics.includes('first_guard'));assert.equal(next.stats.hp,220);
});

test('아직 잠긴/완료된/기한 지난 임무는 출동 경계에서도 거부, 상태 무변경',()=>{
 const s=H.newSave();let before=H.saveText(s);
 assert.equal(typeof H.launch(s,'m8',1),'string');assert.equal(H.saveText(s),before);
 s.missionsDone=['m1','m2','m3'];s.failedRescues=['m4'];before=H.saveText(s);
 assert.equal(typeof H.launch(s,'m2',2),'string');assert.equal(typeof H.launch(s,'m4',3),'string');assert.equal(H.saveText(s),before);
 assert.equal(typeof H.launch(s,'m1',4),'object','정규 조사는 반복 출동 가능');
});

test('치료비 없는 쟈알디도 하루 휴식 → 부상 회복 → 재출동, 보상/마감 횟수 불변',()=>{
 const s=H.newSave();s.currencies.budget=0;
 s.missionsDone=['m1','m2','m3'];H.noteDeadlines(s,H.missionBoard(s));
 assert.ok(s.deadlines.m4>0,'구조 요청 마감이 설정된 상태');
 const l=H.launch(s,'m1',1);H.settle(s,l,result('evac'),()=>0);
 assert.equal(H.canDeploy(s,'jyaldi').ok,false);assert.match(H.treat(s,'jyaldi'),/모자라/);
 const before={day:s.day,runs:s.runs,xp:s.agents.jyaldi.xp,currency:{...s.currencies},deadlines:{...s.deadlines},failedRescues:[...s.failedRescues]};
 assert.match(H.restDay(s),/하루 쉬었다/);
 assert.equal(s.day,before.day+1);assert.equal(s.runs,before.runs);assert.equal(s.agents.jyaldi.xp,before.xp);assert.deepEqual(s.currencies,before.currency);
 assert.deepEqual(s.deadlines,before.deadlines);assert.deepEqual(s.failedRescues,before.failedRescues);
 assert.equal(s.agents.jyaldi.fatigue,0);assert.equal(H.canDeploy(s,'jyaldi').ok,true);
 H.launch(s,'m1',2);const active=H.saveText(s);assert.match(H.restDay(s),/출동 중/);assert.equal(H.saveText(s),active);
});

test('수동 슬롯은 HQ만이 아니라 영구 탐사/meta와 출동 체크포인트를 함께 복원한다',async()=>{
 const disk=H.memorySaves(), j=journal(), session=new H.SessionStore(disk,0,j);await session.ready;
 const hq=H.newSave();hq.day=3;session.setMeta({favor:2,deepest:3});
 const cp={version:1,run:{seed:7,agent:'jyaldi',stageId:'elevator'},stage:'roomA',world:'worldA',savedAt:1};
 session.setCheckpoint(cp);await session.hqSaves.write(0,H.saveText(hq),meta);await session.hqSaves.write(1,H.saveText(hq),meta);
 hq.day=8;session.setMeta({favor:9,deepest:12});session.setCheckpoint(null);await session.hqSaves.write(0,H.saveText(hq),meta);
 assert.equal(H.parseSave(await session.hqSaves.read(1)).day,3);assert.equal(session.meta.deepest,12,'조회만으로 복원하지 않음');
 const restored=await session.hqSaves.restore(1);assert.equal(H.parseSave(restored).day,3);assert.equal(session.meta.deepest,3);assert.deepEqual(session.checkpoint,cp);
 const afterReload=new H.SessionStore(disk,0,j);await afterReload.ready;
 assert.equal(H.parseSave(await afterReload.hqSaves.read(0)).day,3);assert.deepEqual(afterReload.meta,{favor:2,deepest:3});assert.deepEqual(afterReload.checkpoint,cp);
 // 이전 자동 저널보다 높은 revision으로 기록되어 다시 켜도 최신 진행으로 되돌아가지 않는다.
 assert.ok(JSON.parse(await disk.read(0)).revision>JSON.parse(await disk.read(1)).revision);
});

test('수동 저장 대상의 낡은 저널을 대체하며, 깨진 슬롯 불러오기는 현재 진행 보존',async()=>{
 const disk=H.memorySaves(),j=journal(), s=new H.SessionStore(disk,0,j);await s.ready;
 const hq=H.newSave();await s.hqSaves.write(0,H.saveText(hq),meta);
 const old={schema:'goei-session/1',revision:Date.now()+100000,hq:H.saveText({...hq,day:99}),meta:{deepest:99},checkpoint:null};j.setItem('goei-session-journal:2',JSON.stringify(old));
 s.setMeta({deepest:2});await s.hqSaves.write(2,H.saveText({...hq,day:2}),meta);
 const loaded=new H.SessionStore(disk,2,j);await loaded.ready;assert.equal(H.parseSave(await loaded.hqSaves.read(2)).day,2);
 await disk.write(3,'broken',meta);const before=await s.hqSaves.read(0), beforeMeta={...s.meta};
 assert.equal(await s.hqSaves.restore(3),null);assert.equal(await s.hqSaves.read(0),before);assert.deepEqual(s.meta,beforeMeta);
});
